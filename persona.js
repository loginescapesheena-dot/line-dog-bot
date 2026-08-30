// persona.js
// 記帳小狗的個性設定 + 呼叫 Google Gemini API（免費額度）的核心邏輯

const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-3.6-flash' });

// ===== 小狗的靈魂：個性設定 =====
const DOG_PERSONA = `你是「記帳小狗」，一隻幫主人記帳的可愛小狗，個性設定如下：

- 說話簡短、口語、可愛，會用「汪」「喔」「欸」這類語助詞，但不要每句都加，偶爾用就好。
- 個性活潑、偶爾毒舌吐槽，但吐槽是善意的，不是真的責罵，重點是要好笑、有梗。
- 看到花很多錢會虧一下（例如："吃好料不揪我!!"、"錢包在哭了汪"）；
  看到收入會很開心、會鼓勵；看到存錢/省錢的行為會稱讚。
- 回覆盡量在 1-2 句話內結束，不要長篇大論，這是聊天機器人不是寫作文。
- 你會記得自己是一隻狗，可以用狗的視角吐槽（例如聞錢包、啃預算之類的比喻），但不要太頻繁，避免膩。
- 如果使用者只是閒聊、問問題、或打招呼，不要硬記帳，正常用小狗個性回應就好。
- 絕對不要說教式地叫使用者少花錢，要用幽默化解，不要真的批評使用者的財務決定。`;

const EXPENSE_CATEGORIES = ['餐飲', '交通', '娛樂', '購物', '居家', '醫療', '其他'];
const INCOME_CATEGORIES = ['薪資', '獎金', '投資收益', '接案/兼職', '其他'];

// ===== 呼叫 Gemini，讓它同時判斷「是否為記帳」+ 解析 + 生成小狗回覆 =====
// forcedType: null（不限定，AI 自行判斷）｜ 'expense'（使用者剛點了 Rich Menu 的「支出」）｜ 'income'（點了「收入」）
async function processMessage(userText, recentContext = '', forcedType = null) {
  const forcedInstruction = forcedType
    ? `\n重要：使用者剛剛點了 LINE 選單上的「${forcedType === 'income' ? '收入' : '支出'}」按鈕，
所以這則訊息「很可能」是要記一筆${forcedType === 'income' ? '收入' : '支出'}。
如果訊息確實包含項目與金額，type 請直接設為 "${forcedType}"，category 請從這個清單挑最接近的：
${forcedType === 'income' ? INCOME_CATEGORIES.join('、') : EXPENSE_CATEGORIES.join('、')}。
但如果這則訊息明顯不是記帳（例如使用者改問問題、閒聊、或查詢類的話，像是「今天能花多少」），
還是要把 is_record 設為 false，正常用小狗個性回應，不要硬記帳。`
    : `\n如果訊息包含明確的花費/收入項目與金額，才視為記帳，category 請從對應清單挑最接近的：
支出分類：${EXPENSE_CATEGORIES.join('、')}
收入分類：${INCOME_CATEGORIES.join('、')}`;

  const prompt = `${DOG_PERSONA}

你的任務：分析使用者傳來的訊息，判斷這是不是一筆記帳（收入或支出），並且用小狗的個性回一句話。

規則：
- amount 一律為正數，用 type 欄位標示 "income"（收入）或 "expense"（支出）。
- 如果無法判斷出明確金額，is_record 設為 false。
- dog_reply 一定要有內容，不管是不是記帳都要用小狗的個性回應這句話。
${forcedInstruction}

${recentContext ? `使用者最近的記帳紀錄（供參考語氣，不用複述）：\n${recentContext}\n` : ''}

使用者訊息：「${userText}」

只回傳以下 JSON 格式，不要有任何其他文字、不要加 markdown 程式碼框：
{"is_record": true or false, "category": "字串或null", "amount": 數字或null, "type": "income或expense或null", "note": "字串或null", "dog_reply": "小狗的回覆文字"}`;

  try {
    const result = await model.generateContent(prompt);
    const rawText = result.response.text().trim();
    return parseJsonSafely(rawText);
  } catch (err) {
    console.error('Gemini API 呼叫失敗:', err.message || err);
    return {
      is_record: false,
      category: null,
      amount: null,
      type: null,
      note: null,
      dog_reply: '汪...我剛剛好像斷線恍神了，可以再跟我說一次嗎？',
    };
  }
}

// ===== 產生每月財務報告文案（結構化：重點摘要 + 建議）=====
async function generateMonthlyReport(summary, monthLabel, goalInfo = null) {
  const { totalIncome, totalExpense, net, byCategory, recordCount } = summary;

  const categoryLines = byCategory
    .map((c) => `${c.category}: ${c.total} 元`)
    .join('\n');

  const goalLine = goalInfo
    ? `\n這個月的存錢目標：${goalInfo.goal} 元，實際結餘 ${net} 元，${
        net >= goalInfo.goal ? '已經達標' : `還差 ${goalInfo.goal - net} 元`
      }。`
    : '';

  const prompt = `${DOG_PERSONA}

你的任務：根據以下的月度記帳統計數據，用小狗的個性寫兩段話：
1. highlight：這個月收支概況的重點摘要（收入、支出、結餘、花最多的分類），大約 2-3 句話，可以帶一點吐槽或稱讚。
2. advice：針對這個月的花錢習慣，給一句具體、實用的建議或鼓勵（不要說教，要像朋友給的小提醒），大約 1-2 句話。如果有設定存錢目標，advice 要提到目標達成狀況。

${monthLabel} 記帳統計：
總收入：${totalIncome} 元
總支出：${totalExpense} 元
結餘：${net} 元
記帳筆數：${recordCount} 筆
各分類支出：
${categoryLines || '（本月無支出紀錄）'}${goalLine}

只回傳以下 JSON 格式，不要有任何其他文字、不要加 markdown 程式碼框：
{"highlight": "字串", "advice": "字串"}`;

  try {
    const result = await model.generateContent(prompt);
    const rawText = result.response.text().trim();
    const parsed = parseReportJsonSafely(rawText, summary);
    return parsed;
  } catch (err) {
    console.error('Gemini API 呼叫失敗（月報）:', err.message || err);
    return {
      highlight: `這個月收入 ${totalIncome} 元、支出 ${totalExpense} 元、結餘 ${net} 元，我剛好斷線恍神了一下，詳細吐槽下次再補給你 🐶`,
      advice: '斷線期間先繼續加油記帳，我等等就恢復了！',
    };
  }
}

function parseReportJsonSafely(text, summary) {
  let cleaned = text.trim();
  cleaned = cleaned.replace(/^```json\s*/i, '').replace(/^```\s*/, '').replace(/```\s*$/, '');
  try {
    const parsed = JSON.parse(cleaned);
    if (!parsed.highlight || !parsed.advice) throw new Error('缺少必要欄位');
    return parsed;
  } catch (err) {
    console.error('月報 JSON parse failed:', text);
    return {
      highlight: `這個月收入 ${summary.totalIncome} 元、支出 ${summary.totalExpense} 元、結餘 ${summary.net} 元。`,
      advice: '記得持續記帳，才能掌握花錢習慣喔！',
    };
  }
}

function parseJsonSafely(text) {
  let cleaned = text.trim();
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

module.exports = {
  processMessage,
  generateMonthlyReport,
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
};
