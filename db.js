// db.js
// SQLite 資料庫模組：記帳紀錄 + 使用者清單（用於每月推播）

const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./bookkeeping.db');

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    category TEXT,
    amount REAL,
    type TEXT, -- 'income' or 'expense'
    note TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS users (
    user_id TEXT PRIMARY KEY,
    display_name TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
});

function upsertUser(userId, displayName) {
  return new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO users (user_id, display_name) VALUES (?, ?)
       ON CONFLICT(user_id) DO UPDATE SET display_name = excluded.display_name`,
      [userId, displayName || ''],
      (err) => (err ? reject(err) : resolve())
    );
  });
}

function insertRecord({ userId, category, amount, type, note }) {
  return new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO records (user_id, category, amount, type, note) VALUES (?, ?, ?, ?, ?)`,
      [userId, category, amount, type, note || ''],
      function (err) {
        if (err) return reject(err);
        resolve(this.lastID);
      }
    );
  });
}

function getRecentRecords(userId, limit = 5) {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT category, amount, type, note FROM records
       WHERE user_id = ? ORDER BY created_at DESC LIMIT ?`,
      [userId, limit],
      (err, rows) => (err ? reject(err) : resolve(rows))
    );
  });
}

function getAllUserIds() {
  return new Promise((resolve, reject) => {
    db.all(`SELECT user_id FROM users`, [], (err, rows) => {
      if (err) return reject(err);
      resolve(rows.map((r) => r.user_id));
    });
  });
}

// 撈取某使用者「上個月」的統計資料
function getMonthlySummary(userId) {
  return new Promise((resolve, reject) => {
    db.all(
      `SELECT category, type, SUM(amount) as total, COUNT(*) as cnt
       FROM records
       WHERE user_id = ?
         AND strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now', '-1 month')
       GROUP BY category, type`,
      [userId],
      (err, rows) => {
        if (err) return reject(err);

        let totalIncome = 0;
        let totalExpense = 0;
        let recordCount = 0;
        const byCategory = [];

        rows.forEach((r) => {
          recordCount += r.cnt;
          if (r.type === 'income') {
            totalIncome += r.total;
          } else {
            totalExpense += r.total;
            byCategory.push({ category: r.category, total: r.total });
          }
        });

        byCategory.sort((a, b) => b.total - a.total);

        resolve({ totalIncome, totalExpense, byCategory, recordCount });
      }
    );
  });
}

module.exports = {
  upsertUser,
  insertRecord,
  getRecentRecords,
  getAllUserIds,
  getMonthlySummary,
};
