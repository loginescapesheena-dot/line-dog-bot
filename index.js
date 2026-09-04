// index.js
// 記帳小狗 - 主程式（含 Rich Menu / Postback / 狀態機 / 收入支出 / Flex 確認卡片）
// 需要環境變數: CHANNEL_ACCESS_TOKEN, CHANNEL_SECRET, GEMINI_API_KEY, CRON_SECRET,
//              SUPABASE_URL, SUPABASE_SERVICE_KEY

const express = require('express');
const line = require('@line/bot-sdk');
const fs = require('fs');
const path = require('path');

const db = require('./db');
const { processMessage, generateMonthlyReport } = require('./persona');
const { buildRecordConfirmCard, buildCardChargeCard, buildMonthlyReportCard } = require('./flexMessages');
const { richMenuObject } = require('./richmenu');

const config = {
  channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.CHANNEL_SECRET,
};

const app = express();
const client = new line.Client(config);

// ===== Webhook 進入點 =====
app.post('/webhook', line.middleware(config), (req, res) => {
  Promise.all(req.body.events.map(handleEvent))
    .then((result) => res.json(result))
    .catch((err) => {
      console.error(err);
      res.status(500).end();
    });
});

async function handleEvent(event) {
  const userId = event.source.userId;

  // ===== 加好友 =====
  if (event.type === 'follow') {
    let displayName = '';
    try {
      const profile = await client.getProfile(userId);
      displayName = profile.displayName;
    } catch (e) {
      /* 沒拿到名字也沒關係 */
    }
    await db.upsertUser(userId, displayName);

    return client.replyMessage(event.replyToken, {
      type: 'text',
      text: '汪！我是記帳小狗🐶\n記帳最準確的方式：先點下面選單的「支出」或「收入」按鈕，我會引導你輸入項目跟金額！\n也可以直接打字跟我說，例如「晚餐 300」，我會盡量判斷。\n每個月1號我還會傳精緻月報給你喔！',
    });
  }

  // ===== Postback 事件（Rich Menu 按鈕）=====
  if (event.type === 'postback') {
    return handlePostback(event, userId);
  }

  // ===== 一般文字訊息 =====
  if (event.type !== 'message' || event.message.type !== 'text') {
    return Promise.resolve(null);
  }

  const userText = event.message.text.trim();

  await db.upsertUser(userId, '');

  // 檢查是否處於「等待輸入」狀態（剛點過 Rich Menu 的按鈕）
  const currentState = await db.getUserState(userId);

  // 目標金額設定流程優先處理，不走記帳解析邏輯
  if (currentState === 'awaiting_goal_input') {
    await db.clearUserState(userId);
    const match = userText.match(/(\d+(?:\.\d+)?)/);
    if (!match) {
      return client.replyMessage(event.replyToken, {
        type: 'text',
        text: '汪？沒看懂金額，麻煩直接打數字就好，例如：5000',
      });
    }
    const goal = parseFloat(match[1]);
    await db.setUserGoal(userId, goal);
    return client.replyMessage(event.replyToken, {
      type: 'text',
      text: `收到！這個月的存錢目標設定為 ${goal} 元，我會幫你盯緊一點 🐶`,
    });
  }

  let forcedType = null;
  if (currentState === 'awaiting_expense_input') forcedType = 'expense';
  if (currentState === 'awaiting_income_input') forcedType = 'income';

  // 拿最近幾筆紀錄當上下文，讓小狗回話更自然
  const recent = await db.getRecentRecords(userId, 3);
  const recentContext = recent
    .map((r) => `${r.type === 'income' ? '收入' : '支出'} ${r.category} ${r.amount}`)
    .join('\n');

  const result = await processMessage(userText, recentContext, forcedType);

  // 不管這次是否成功記帳，只要原本處於等待狀態，處理完就清除，避免卡住後續一般查詢
  if (currentState) {
    await db.clearUserState(userId);
  }

  if (result.is_record && result.amount) {
    const type = result.type === 'income' ? 'income' : 'expense';
    const amount = Math.abs(result.amount);
    const category = result.category || '其他';
    const paymentMethod = result.payment_method === 'credit_card' ? 'credit_card' : 'cash';
    const isCardPayment = type === 'expense' && result.is_card_payment === true;

    // ===== 分支一：繳卡費（還款）—— 記一筆一般支出 + 扣減卡費待繳 =====
    if (isCardPayment) {
      await db.insertRecord({
        userId,
        category: '卡費',
        amount,
        type: 'expense',
        note: result.note,
        paymentMethod: 'cash',
      });
      const newBalance = await db.adjustCardBalance(userId, -amount);

      let monthNet = null;
      try {
        monthNet = (await db.getMonthSummary(userId, 0)).net;
      } catch (e) {
        console.error('取得本月結餘失敗:', e);
      }

      const card = buildRecordConfirmCard({
        type: 'expense',
        category: '卡費',
        amount,
        note: result.note,
        dogReply: result.dog_reply,
        monthNet,
        cardBalance: newBalance,
      });
      return replyCardWithFallback(event, card, 'expense', '卡費', amount, result.dog_reply, monthNet, newBalance);
    }

    // ===== 分支二：一般消費刷卡 —— 不計入當月一般支出，先累加進卡費待繳 =====
    if (type === 'expense' && paymentMethod === 'credit_card') {
      const newBalance = await db.adjustCardBalance(userId, amount);
      const card = buildCardChargeCard({
        category,
        amount,
        note: result.note,
        dogReply: result.dog_reply,
        cardBalance: newBalance,
      });
      try {
        return await client.replyMessage(event.replyToken, card);
      } catch (err) {
        console.error('信用卡卡片回覆失敗，改用純文字:', err.originalError?.response?.data || err.message || err);
        return client.replyMessage(event.replyToken, {
          type: 'text',
          text: `💳 ${category} ${amount} 元（刷卡，記入卡費）\n${result.dog_reply}\n目前信用卡待繳：${newBalance} 元`,
        });
      }
    }

    // ===== 分支三：一般現金收支 =====
    await db.insertRecord({
      userId,
      category,
      amount,
      type,
      note: result.note,
      paymentMethod: 'cash',
    });

    let monthNet = null;
    try {
      monthNet = (await db.getMonthSummary(userId, 0)).net;
    } catch (e) {
      console.error('取得本月結餘失敗:', e);
    }

    let cardBalance = null;
    try {
      cardBalance = await db.getCardBalance(userId);
    } catch (e) {
      console.error('取得卡費待繳失敗:', e);
    }

    const card = buildRecordConfirmCard({
      type,
      category,
      amount,
      note: result.note,
      dogReply: result.dog_reply,
      monthNet,
      cardBalance,
    });

    return replyCardWithFallback(event, card, type, category, amount, result.dog_reply, monthNet, cardBalance);
  }

  return client.replyMessage(event.replyToken, {
    type: 'text',
    text: result.dog_reply,
  });
}

// Flex 卡片回覆失敗時，退而求其次改用純文字，確保使用者不會完全沒反應
async function replyCardWithFallback(event, card, type, category, amount, dogReply, monthNet, cardBalance) {
  try {
    return await client.replyMessage(event.replyToken, card);
  } catch (err) {
    console.error('Flex 卡片回覆失敗，改用純文字:', err.originalError?.response?.data || err.message || err);
    const netText = monthNet !== null ? `\n本月結餘：${monthNet >= 0 ? '+' : ''}${monthNet} 元` : '';
    const cardText = cardBalance !== null && cardBalance > 0 ? `\n💳 信用卡待繳：${cardBalance} 元` : '';
    return client.replyMessage(event.replyToken, {
      type: 'text',
      text: `${type === 'income' ? '💰' : '🧾'} ${category} ${amount} 元\n${dogReply}${netText}${cardText}`,
    });
  }
}

async function handlePostback(event, userId) {
  const data = new URLSearchParams(event.postback.data);
  const action = data.get('action');

  await db.upsertUser(userId, '');

  if (action === 'start_expense') {
    await db.setUserState(userId, 'awaiting_expense_input');
    return client.replyMessage(event.replyToken, {
      type: 'text',
      text: '汪！請輸入支出項目與金額，\n例如：午餐 120、星巴克 150\n如果是刷卡消費可以說「星巴克 150 刷卡」，我會先記到卡費待繳，不會算進這個月的一般支出喔！',
    });
  }

  if (action === 'start_income') {
    await db.setUserState(userId, 'awaiting_income_input');
    return client.replyMessage(event.replyToken, {
      type: 'text',
      text: '汪！請輸入收入來源與金額，\n例如：薪資 45000、接案收入 3000',
    });
  }

  if (action === 'query_month') {
    const summary = await db.getMonthSummary(userId, 0);
    const goal = await db.getUserGoal(userId);
    const cardBalance = await db.getCardBalance(userId);
    const lines = summary.byCategory.map((c) => `${c.category}: ${c.total} 元`).join('\n');
    let goalText = '';
    if (goal) {
      const achieved = summary.net >= goal;
      const pct = Math.max(0, Math.min(100, Math.round((summary.net / goal) * 100)));
      goalText = `\n\n存錢目標：${goal} 元\n${achieved ? '已經達成 🎉' : `目前進度 ${pct}%，還差 ${goal - summary.net} 元`}`;
    }
    const cardText = cardBalance > 0 ? `\n\n💳 信用卡待繳：${cardBalance} 元` : '';
    const text = `本月目前狀況：\n收入：${summary.totalIncome} 元\n支出：${summary.totalExpense} 元\n結餘：${summary.net} 元${
      lines ? `\n\n支出分類：\n${lines}` : ''
    }${goalText}${cardText}`;
    return client.replyMessage(event.replyToken, { type: 'text', text });
  }

  if (action === 'settings') {
    await db.setUserState(userId, 'awaiting_goal_input');
    return client.replyMessage(event.replyToken, {
      type: 'text',
      text: '汪！要幫你設定這個月的存錢目標嗎？\n直接輸入金額就好，例如：5000',
    });
  }

  return client.replyMessage(event.replyToken, {
    type: 'text',
    text: '汪？這個按鈕好像還沒接好，先跟主人說一聲喔！',
  });
}

// ===== 每月報告觸發端點 =====
// monthOffset query 參數可用來測試：-1（預設，抓上個月）｜ 0（測試用，抓這個月目前資料）
app.get('/trigger-monthly-report', async (req, res) => {
  if (req.query.secret !== process.env.CRON_SECRET) {
    return res.status(403).send('Forbidden');
  }

  const monthOffset = req.query.monthOffset !== undefined ? parseInt(req.query.monthOffset, 10) : -1;
  res.status(200).send('Monthly report job started');

  console.log('開始發送每月財務報告...');
  const userIds = await db.getAllUserIds();
  const now = new Date();
  const targetDate = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
  const monthLabel = `${targetDate.getFullYear()}年${targetDate.getMonth() + 1}月`;

  for (const userId of userIds) {
    try {
      const summary = await db.getMonthSummary(userId, monthOffset);
      if (summary.recordCount === 0) continue;

      const goal = await db.getUserGoal(userId);
      const goalInfo = goal ? { goal } : null;
      const cardBalance = await db.getCardBalance(userId);
      const report = await generateMonthlyReport(summary, monthLabel, goalInfo);

      const card = buildMonthlyReportCard({
        monthLabel,
        totalIncome: summary.totalIncome,
        totalExpense: summary.totalExpense,
        net: summary.net,
        byCategory: summary.byCategory,
        goal,
        highlight: report.highlight,
        advice: report.advice,
        cardBalance,
      });

      try {
        await client.pushMessage(userId, card);
      } catch (err) {
        console.error(`Flex 月報卡片推播失敗，改用純文字給 ${userId}:`, err.originalError?.response?.data || err.message || err);
        await client.pushMessage(userId, {
          type: 'text',
          text: `${monthLabel} 財務報告\n收入：${summary.totalIncome} 元\n支出：${summary.totalExpense} 元\n結餘：${summary.net} 元\n\n${report.highlight}\n\n🐶 ${report.advice}`,
        });
      }
    } catch (err) {
      console.error(`發送月報給 ${userId} 失敗:`, err);
    }
  }
  console.log('每月財務報告發送完成');
});

// ===== Rich Menu 一次性設定端點 =====
// 部署後用瀏覽器打開這個網址一次即可，不需要在本機跑指令
// https://你的網址/admin/setup-richmenu?secret=你的CRON_SECRET
app.get('/admin/setup-richmenu', async (req, res) => {
  if (req.query.secret !== process.env.CRON_SECRET) {
    return res.status(403).send('Forbidden');
  }

  try {
    // 如果已經有舊的 rich menu，先清掉，避免累積一堆沒用到的選單
    const existing = await client.getRichMenuList();
    for (const menu of existing) {
      await client.deleteRichMenu(menu.richMenuId);
    }

    const richMenuId = await client.createRichMenu(richMenuObject);

    const imagePath = path.join(__dirname, 'assets', 'richmenu.png');
    const imageBuffer = fs.readFileSync(imagePath);
    await client.setRichMenuImage(richMenuId, imageBuffer, 'image/png');

    await client.setDefaultRichMenu(richMenuId);

    res.status(200).send(`Rich Menu 設定完成！richMenuId: ${richMenuId}`);
  } catch (err) {
    console.error('設定 Rich Menu 失敗:', err);
    res.status(500).send(`設定失敗: ${err.message}`);
  }
});

app.get('/health', (req, res) => res.status(200).send('OK'));

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`記帳小狗伺服器啟動於 port ${port}`);
});
