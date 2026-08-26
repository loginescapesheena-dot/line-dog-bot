// index.js
// 記帳小狗 - 主程式（全免費版本：LINE 免費方案 + Gemini 免費額度 + Render 免費主機）
// 需要環境變數: CHANNEL_ACCESS_TOKEN, CHANNEL_SECRET, GEMINI_API_KEY, CRON_SECRET

const express = require('express');
const line = require('@line/bot-sdk');

const db = require('./db');
const { processMessage, generateMonthlyReport } = require('./persona');

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

  // 加好友：記錄使用者、送歡迎訊息
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
      text: '汪！我是記帳小狗🐶\n以後花錢/賺錢都可以直接跟我說，\n例如：「晚餐 300」或是「薪水 50000」\n我會幫你記下來，順便碎念兩句 😏\n每個月1號我還會傳月報給你喔！',
    });
  }

  if (event.type !== 'message' || event.message.type !== 'text') {
    return Promise.resolve(null);
  }

  const userText = event.message.text.trim();

  // 保險起見，確保使用者存在於名單中（例如封鎖又解除封鎖的情況）
  await db.upsertUser(userId, '');

  // 拿最近幾筆紀錄當上下文，讓小狗回話更自然（非必要，但會讓語氣更連貫）
  const recent = await db.getRecentRecords(userId, 3);
  const recentContext = recent
    .map((r) => `${r.type === 'income' ? '收入' : '支出'} ${r.category} ${r.amount}`)
    .join('\n');

  const result = await processMessage(userText, recentContext);

  if (result.is_record && result.amount) {
    await db.insertRecord({
      userId,
      category: result.category || '其他',
      amount: Math.abs(result.amount),
      type: result.type === 'income' ? 'income' : 'expense',
      note: result.note,
    });
  }

  return client.replyMessage(event.replyToken, {
    type: 'text',
    text: result.dog_reply,
  });
}

// ===== 每月報告觸發端點 =====
// 因為免費主機閒置會休眠，改用外部免費排程服務（例如 cron-job.org）
// 每月 1 號定時打這支 API 來觸發月報，而不是依賴常駐的內部排程。
// 用 CRON_SECRET 當簡單的驗證，避免任何人隨便打這支 API 亂觸發推播。
app.get('/trigger-monthly-report', async (req, res) => {
  if (req.query.secret !== process.env.CRON_SECRET) {
    return res.status(403).send('Forbidden');
  }

  res.status(200).send('Monthly report job started'); // 先回應，避免呼叫端逾時

  console.log('開始發送每月財務報告...');
  const userIds = await db.getAllUserIds();
  const now = new Date();
  const monthLabel = `${now.getFullYear()}年${now.getMonth()}月`; // 現在是這個月1號，所以上個月是 getMonth()

  for (const userId of userIds) {
    try {
      const summary = await db.getMonthlySummary(userId);
      if (summary.recordCount === 0) continue; // 沒記帳就不打擾

      const reportText = await generateMonthlyReport(summary, monthLabel);
      await client.pushMessage(userId, { type: 'text', text: reportText });
    } catch (err) {
      console.error(`發送月報給 ${userId} 失敗:`, err);
    }
  }
  console.log('每月財務報告發送完成');
});

// 保留一個簡單的健康檢查端點，方便外部排程服務順便定時 ping 讓伺服器不完全休眠
app.get('/health', (req, res) => res.status(200).send('OK'));

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`記帳小狗伺服器啟動於 port ${port}`);
});
