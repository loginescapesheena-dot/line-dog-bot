// db.js
// Supabase（PostgreSQL）版本：記帳紀錄 + 使用者清單 + 使用者輸入狀態機
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

async function insertRecord({ userId, category, amount, type, note, paymentMethod }) {
  const { data, error } = await supabase
    .from('records')
    .insert({
      user_id: userId,
      category,
      amount,
      type,
      note: note || '',
      payment_method: paymentMethod || 'cash',
    })
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

// 撈取某使用者某個月的統計資料
// monthOffset: 0 = 這個月, -1 = 上個月
async function getMonthSummary(userId, monthOffset = 0) {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
  const end = new Date(now.getFullYear(), now.getMonth() + monthOffset + 1, 1);

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

  return {
    totalIncome,
    totalExpense,
    net: totalIncome - totalExpense,
    byCategory,
    recordCount,
  };
}

// ===== 使用者輸入狀態機（Rich Menu 導引流程用）=====
async function setUserState(userId, state) {
  const { error } = await supabase
    .from('user_state')
    .upsert({ user_id: userId, state, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
  if (error) throw error;
}

async function getUserState(userId) {
  const { data, error } = await supabase
    .from('user_state')
    .select('state')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data ? data.state : null;
}

async function clearUserState(userId) {
  const { error } = await supabase
    .from('user_state')
    .upsert({ user_id: userId, state: null, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
  if (error) throw error;
}

// ===== 存錢目標 =====
async function setUserGoal(userId, monthlyGoal) {
  const { error } = await supabase
    .from('user_goals')
    .upsert(
      { user_id: userId, monthly_goal: monthlyGoal, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' }
    );
  if (error) throw error;
}

async function getUserGoal(userId) {
  const { data, error } = await supabase
    .from('user_goals')
    .select('monthly_goal')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data ? Number(data.monthly_goal) : null;
}

// ===== 信用卡待繳金額 =====
async function getCardBalance(userId) {
  const { data, error } = await supabase
    .from('user_card_balance')
    .select('balance')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data ? Number(data.balance) : 0;
}

// delta 為正數表示新增待繳（刷卡消費），負數表示還款扣減；結果不會低於 0
async function adjustCardBalance(userId, delta) {
  const current = await getCardBalance(userId);
  const next = Math.max(0, current + delta);
  const { error } = await supabase
    .from('user_card_balance')
    .upsert(
      { user_id: userId, balance: next, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' }
    );
  if (error) throw error;
  return next;
}

module.exports = {
  upsertUser,
  insertRecord,
  getRecentRecords,
  getAllUserIds,
  getMonthSummary,
  setUserState,
  getUserState,
  clearUserState,
  setUserGoal,
  getUserGoal,
  getCardBalance,
  adjustCardBalance,
};
