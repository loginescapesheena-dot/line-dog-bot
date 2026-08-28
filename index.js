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
const { buildRecordConfirmCard } = require('./flexMessages');
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
      text: '汪！我是記帳小狗🐶\n可以直接打字跟我說，例如「晚餐 300」，\n也可以點下面選單的「支出」「收入」按鈕，我會引導你輸入！\n每個月1號我還會傳月報給你喔！',
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

  // 檢查是否處於「等待輸入」狀態（剛點過 Rich Menu 的支出/收入按鈕）
  const currentState = await db.getUserState(userId);
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
    await db.insertRecord({
      userId,
      category: result.category || '其他',
      amount: Math.abs(result.amount),
      type,
      note: result.note,
    });

    // 順便算一下本月結餘，顯示在確認卡片上
    let monthNet = null;
    try {
      const monthSummary = await db.getMonthSummary(userId, 0);
      monthNet = monthSummary.net;
    } catch (e) {
      console.error('取得本月結餘失敗:', e);
    }

    const card = buildRecordConfirmCard({
      type,
      category: result.category || '其他',
      amount: Math.abs(result.amount),
      note: result.note,
      dogReply: result.dog_reply,
      monthNet,
    });

    return client.replyMessage(event.replyToken, card);
  }

  return client.replyMessage(event.replyToken, {
    type: 'text',
    text: result.dog_reply,
  });
}

async function handlePostback(event, userId) {
  const data = new URLSearchParams(event.postback.data);
  const action = data.get('action');

  await db.upsertUser(userId, '');

  if (action === 'start_expense') {
    await db.setUserState(userId, 'awaiting_expense_input');
    return client.replyMessage(event.replyToken, {
      type: 'text',
      text: '汪！請輸入支出項目與金額，\n例如：午餐 120、星巴克 150',
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
    const lines = summary.byCategory.map((c) => `${c.category}: ${c.total} 元`).join('\n');
    const text = `本月目前狀況：\n收入：${summary.totalIncome} 元\n支出：${summary.totalExpense} 元\n結餘：${summary.net} 元${
      lines ? `\n\n支出分類：\n${lines}` : ''
    }`;
    return client.replyMessage(event.replyToken, { type: 'text', text });
  }

  if (action === 'settings') {
    return client.replyMessage(event.replyToken, {
      type: 'text',
      text: '設定功能還在努力開發中，之後會加入預算提醒之類的功能，敬請期待汪 🐶',
    });
  }

  return client.replyMessage(event.replyToken, {
    type: 'text',
    text: '汪？這個按鈕好像還沒接好，先跟主人說一聲喔！',
  });
}

// ===== 每月報告觸發端點 =====
app.get('/trigger-monthly-report', async (req, res) => {
  if (req.query.secret !== process.env.CRON_SECRET) {
    return res.status(403).send('Forbidden');
  }

  res.status(200).send('Monthly report job started');

  console.log('開始發送每月財務報告...');
  const userIds = await db.getAllUserIds();
  const now = new Date();
  const monthLabel = `${now.getFullYear()}年${now.getMonth()}月`;

  for (const userId of userIds) {
    try {
      const summary = await db.getMonthSummary(userId, -1);
      if (summary.recordCount === 0) continue;

      const reportText = await generateMonthlyReport(summary, monthLabel);
      await client.pushMessage(userId, { type: 'text', text: reportText });
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
