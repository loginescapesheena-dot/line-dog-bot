// db.js
// Supabase（PostgreSQL）版本：記帳紀錄 + 使用者清單（用於每月推播）
// 需要環境變數: SUPABASE_URL, SUPABASE_SERVICE_KEY

const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

async function upsertUser(userId, displayName) {
  const { error } = await supabase
    .from('users')
    .upsert({ user_id: userId, display_name: displayName || '' }, { onConflict: 'user_id' });
  if (error) throw error;
}

async function insertRecord({ userId, category, amount, type, note }) {
  const { data, error } = await supabase
    .from('records')
    .insert({ user_id: userId, category, amount, type, note: note || '' })
    .select('id')
    .single();
  if (error) throw error;
  return data.id;
}

async function getRecentRecords(userId, limit = 5) {
  const { data, error } = await supabase
    .from('records')
    .select('category, amount, type, note')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data;
}

async function getAllUserIds() {
  const { data, error } = await supabase.from('users').select('user_id');
  if (error) throw error;
  return data.map((r) => r.user_id);
}

// 撈取某使用者「上個月」的統計資料
async function getMonthlySummary(userId) {
  const now = new Date();
  // 上個月的第一天
  const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  // 這個月的第一天（當作上個月的結束邊界，不含）
  const end = new Date(now.getFullYear(), now.getMonth(), 1);

  const { data, error } = await supabase
    .from('records')
    .select('category, amount, type')
    .eq('user_id', userId)
    .gte('created_at', start.toISOString())
    .lt('created_at', end.toISOString());
  if (error) throw error;

  let totalIncome = 0;
  let totalExpense = 0;
  let recordCount = data.length;
  const categoryTotals = {};

  data.forEach((r) => {
    if (r.type === 'income') {
      totalIncome += Number(r.amount);
    } else {
      totalExpense += Number(r.amount);
      categoryTotals[r.category] = (categoryTotals[r.category] || 0) + Number(r.amount);
    }
  });

  const byCategory = Object.entries(categoryTotals)
    .map(([category, total]) => ({ category, total }))
    .sort((a, b) => b.total - a.total);

  return { totalIncome, totalExpense, byCategory, recordCount };
}

module.exports = {
  upsertUser,
  insertRecord,
  getRecentRecords,
  getAllUserIds,
  getMonthlySummary,
};
