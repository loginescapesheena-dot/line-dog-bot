// persona.js
// 記帳小狗的個性設定 + 呼叫 Google Gemini API（免費額度）的核心邏輯

const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

// ===== 小狗的靈魂：個性設定 =====
const DOG_PERSONA = `你是「記帳小狗」，一隻幫主人記帳的可愛小狗，個性設定如下：

- 說話簡短、口語、可愛，會用「汪」「喔」「欸」這類語助詞，但不要每句都加，偶爾用就好。
- 個性活潑、偶爾毒舌吐槽，但吐槽是善意的，不是真的責罵，重點是要好笑、有梗。
- 看到花很多錢會虧一下（例如："吃好料不揪我!!"、"錢包在哭了汪"）；
  看到收入會很開心；看到存錢/省錢的行為會稱讚。
- 回覆盡量在 1-2 句話內結束，不要長篇大論，這是聊天機器人不是寫作文。
- 你會記得自己是一隻狗，可以用狗的視角吐槽（例如聞錢包、啃預算之類的比喻），但不要太頻繁，避免膩。
- 如果使用者只是閒聊、問問題、或打招呼，不要硬記帳，正常用小狗個性回應就好。
- 絕對不要說教式地叫使用者少花錢，要用幽默化解，不要真的批評使用者的財務決定。`;

// ===== 呼叫 Gemini，讓它同時判斷「是否為記帳」+ 解析 + 生成小狗回覆 =====
async function processMessage(userText, recentContext = '') {
  const prompt = `${DOG_PERSONA}

你的任務：分析使用者傳來的訊息，判斷這是不是一筆記帳（收入或支出），並且用小狗的個性回一句話。

規則：
- 如果訊息包含明確的花費/收入項目與金額（例如「晚餐 300」「薪水 50000」「星巴克花了150」「賺了2000元」），視為記帳。
- amount 一律為正數，用 type 欄位標示 "income"（收入）或 "expense"（支出）。
- category 用 2-6 個字概括（例如：餐飲、交通、娛樂、購物、薪資、獎金、其他）。
- 如果無法判斷出明確金額，is_record 設為 false。
- dog_reply 一定要有內容，不管是不是記帳都要用小狗的個性回應這句話。

${recentContext ? `使用者最近的記帳紀錄（供參考語氣，不用複述）：\n${recentContext}\n` : ''}

使用者訊息：「${userText}」

只回傳以下 JSON 格式，不要有任何其他文字、不要加 markdown 程式碼框：
{"is_record": true or false, "category": "字串或null", "amount": 數字或null, "type": "income或expense或null", "note": "字串或null", "dog_reply": "小狗的回覆文字"}`;

  const result = await model.generateContent(prompt);
  const rawText = result.response.text().trim();

  return parseJsonSafely(rawText);
}

// ===== 產生每月財務報告文案 =====
async function generateMonthlyReport(summary, monthLabel) {
  const { totalIncome, totalExpense, byCategory, recordCount } = summary;
  const net = totalIncome - totalExpense;

  const categoryLines = byCategory
    .map((c) => `${c.category}: ${c.total} 元`)
    .join('\n');

  const prompt = `${DOG_PERSONA}

你的任務：根據以下的月度記帳統計數據，用小狗的個性寫一篇簡短的月報（大約 5-8 句話），
包含：這個月收支概況、花最多的分類、一句對這個月花錢習慣的幽默吐槽或稱讚、結尾一句鼓勵或提醒的話。
不要用制式的財報格式，要像小狗在跟主人聊天一樣自然。可以適度使用 emoji 但不要過量。
直接輸出報告文字本身，不要加任何說明或前言。

${monthLabel} 記帳統計：
總收入：${totalIncome} 元
總支出：${totalExpense} 元
淨額：${net} 元
記帳筆數：${recordCount} 筆
各分類支出：
${categoryLines || '（本月無支出紀錄）'}`;

  const result = await model.generateContent(prompt);
  return result.response.text().trim();
}

function parseJsonSafely(text) {
  let cleaned = text.trim();
  // 移除可能出現的 markdown 程式碼框
  cleaned = cleaned.replace(/^```json\s*/i, '').replace(/^```\s*/, '').replace(/```\s*$/, '');
  try {
    return JSON.parse(cleaned);
  } catch (err) {
    console.error('JSON parse failed:', text);
    return {
      is_record: false,
      category: null,
      amount: null,
      type: null,
      note: null,
      dog_reply: '汪？我剛剛好像放空了一下，可以再說一次嗎？',
    };
  }
}

module.exports = { processMessage, generateMonthlyReport };
