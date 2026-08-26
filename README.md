# 記帳小狗 🐶（全免費版）

用 Google Gemini 免費額度驅動的 LINE 記帳機器人：使用者自然對話記帳，小狗會判斷內容、記下資料、並用可愛吐槽回應，每月 1 號自動推播月報。**開發與使用完全 $0 成本**（在正常個人使用量下）。

## 免費架構說明

| 項目 | 服務 | 免費額度 |
|---|---|---|
| 對話介面 | LINE Messaging API（輕用量方案） | $0/月；使用者傳訊息、小狗立即回覆（Reply Message）**完全免費、無上限**；只有「主動推播」（例如每月報告）算在 200-500 則/月的免費額度內，個人用遠遠用不完 |
| AI 大腦 | Google Gemini API（`gemini-2.5-flash`） | 永久免費層，個人記帳一天頂多幾則訊息，遠低於免費限制 |
| 主機 | Render.com Free Web Service | $0/月；閒置一段時間會休眠，有新請求進來時會自動喚醒（第一次喚醒約需 30 秒到 1 分鐘） |
| 每月報告排程 | cron-job.org（免費外部排程服務） | 定時打一支 API 觸發月報邏輯，不依賴伺服器內部常駐排程（因為免費主機會休眠，內部排程可能睡著沒觸發） |
| 資料庫 | SQLite（存在專案資料夾內） | $0；缺點是 Render 免費方案重新部署時檔案系統會重置，資料可能遺失（下面有說明解法） |

## 檔案說明
- `index.js` — 主程式：LINE Webhook 事件處理、每月報告的觸發端點
- `persona.js` — 小狗個性設定 + 呼叫 Gemini API 的邏輯（判斷記帳 / 生成回覆 / 生成月報）
- `db.js` — SQLite 資料庫存取
- `.env.example` — 環境變數範例

---

## 步驟 1：申請三把免費金鑰

1. **LINE Messaging API**：[LINE Developers Console](https://developers.line.biz/console/) 建立 Provider → 建立 Messaging API Channel，取得 `CHANNEL_ACCESS_TOKEN`、`CHANNEL_SECRET`。保持「輕用量」方案（預設就是免費方案）。
2. **Gemini API Key**：到 [Google AI Studio](https://aistudio.google.com/apikey) 用 Google 帳號登入，點「Create API Key」，選一個**沒有綁定付款方式的新專案**（這樣才會走免費額度，不會不小心變成付費）。
3. **CRON_SECRET**：自己隨便打一串英數字當密碼即可，不需要跟任何服務申請。

## 步驟 2：本機測試

```bash
npm install
cp .env.example .env   # 填入上面三把金鑰
npm start
```

用 ngrok 開公開網址：
```bash
ngrok http 3000
```
到 LINE Developers Console 把 Webhook URL 設成 `https://你的ngrok網址/webhook`，開啟「Use webhook」，並把 LINE 內建的自動回覆、歡迎訊息都關掉。加好友後傳「晚餐 300」測試看看小狗會不會正確記帳、吐槽。

## 步驟 3：部署到 Render（免費）

1. 把整個資料夾 push 到一個 GitHub repo（GitHub 帳號、repo 都免費）。
2. 到 [render.com](https://render.com) 用 GitHub 帳號登入，選 **New → Web Service**，連接你的 repo。
3. Instance Type 選 **Free**。
4. Build Command：`npm install`；Start Command：`npm start`。
5. 在 Environment 頁籤加入四個環境變數：`CHANNEL_ACCESS_TOKEN`、`CHANNEL_SECRET`、`GEMINI_API_KEY`、`CRON_SECRET`。
6. 部署完成後會拿到一個 `https://你的專案.onrender.com` 網址，回到 LINE Console 把 Webhook URL 換成 `https://你的專案.onrender.com/webhook`。

## 步驟 4：設定免費的每月報告排程

因為 Render 免費方案閒置約 15 分鐘會休眠，內部排程可能在該觸發時沒醒著，所以改用外部免費排程服務來「叫醒 + 觸發」：

1. 到 [cron-job.org](https://cron-job.org) 免費註冊。
2. 建立一個新的 Cron Job：
   - URL：`https://你的專案.onrender.com/trigger-monthly-report?secret=你的CRON_SECRET`
   - 排程：每月 1 號的某個時間（例如早上 9:00，記得選台北時區）
3. 存檔即可。之後每個月 1 號，cron-job.org 會自動呼叫這支 API，喚醒你的 Render 服務並發送月報給所有使用者。

（小技巧：也可以另外設一個 cron job 每 10 分鐘打一次 `/health`，讓伺服器盡量保持醒著、減少使用者傳訊息時的冷啟動等待，但這樣可能會用掉比較多 Render 免費工時，非必要不用開。）

## 關於資料保存

Render 免費方案在你重新部署（例如改程式碼再推送）時，檔案系統會重置，SQLite 的資料檔可能會消失。如果你只是偶爾改程式碼、資料不常變動，風險不高；但如果想要更保險，可以之後把 `db.js` 換成免費的雲端資料庫，例如：
- **Supabase**（PostgreSQL，永久免費層，500MB）
- **Turso**（SQLite 相容的雲端資料庫，有免費層）

這兩個都能無痛接你現有的 SQL 邏輯，之後有需要我可以幫你改。

## 費用總結

只要維持個人使用的量（一天幾筆記帳、一個月一次月報），這整套系統可以完全維持 **$0/月**：
- LINE：Reply 免費無限，Push 一個月頂多用到個位數（月報），遠低於免費額度
- Gemini：一天幾次呼叫，遠低於免費層的每日/每分鐘限制
- Render：免費方案工時對單一個人 Bot 綽綽有餘

如果之後想分享給朋友一起用、使用量變大，才需要考慮升級付費方案。
