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

// ===== 個人化設定：卡費繳款提醒日、月報推送日 =====
async function getUserSettings(userId) {
  const { data, error } = await supabase
    .from('user_settings')
    .select('report_day, card_due_day')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return {
    reportDay: data && data.report_day ? data.report_day : 1,
    cardDueDay: data ? data.card_due_day : null,
  };
}

async function setReportDay(userId, day) {
  const { error } = await supabase
    .from('user_settings')
    .upsert(
      { user_id: userId, report_day: day, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' }
    );
  if (error) throw error;
}

async function setCardDueDay(userId, day) {
  const { error } = await supabase
    .from('user_settings')
    .upsert(
      { user_id: userId, card_due_day: day, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' }
    );
  if (error) throw error;
}

// ===== 信用卡分期 =====
async function insertInstallment({ userId, category, note, totalAmount, monthlyAmount, totalPeriods, remainingPeriods, lastBilledMonth }) {
  const { error } = await supabase.from('installments').insert({
    user_id: userId,
    category,
    note: note || '',
    total_amount: totalAmount,
    monthly_amount: monthlyAmount,
    total_periods: totalPeriods,
    remaining_periods: remainingPeriods,
    last_billed_month: lastBilledMonth,
  });
  if (error) throw error;
}

// 找出「這個月還沒扣款」且「還有剩餘期數」的所有分期（跨所有使用者，供每月自動扣款排程用）
async function getDueInstallments(currentMonthStr) {
  const { data, error } = await supabase
    .from('installments')
    .select('id, user_id, category, monthly_amount, remaining_periods, total_periods')
    .gt('remaining_periods', 0)
    .neq('last_billed_month', currentMonthStr);
  if (error) throw error;
  return data;
}

async function billInstallment(installmentId, currentMonthStr) {
  const { data: current, error: readErr } = await supabase
    .from('installments')
    .select('remaining_periods')
    .eq('id', installmentId)
    .single();
  if (readErr) throw readErr;

  const { error: updateErr } = await supabase
    .from('installments')
    .update({ remaining_periods: current.remaining_periods - 1, last_billed_month: currentMonthStr })
    .eq('id', installmentId);
  if (updateErr) throw updateErr;
}

// ===== 重置：清空一個使用者的所有記帳相關資料（不移除 users 名單本身）=====
async function resetUserData(userId) {
  const tables = ['records', 'installments', 'user_goals', 'user_card_balance', 'user_settings'];
  for (const table of tables) {
    const { error } = await supabase.from(table).delete().eq('user_id', userId);
    if (error) throw error;
  }
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
  getUserSettings,
  setReportDay,
  setCardDueDay,
  insertInstallment,
  getDueInstallments,
  billInstallment,
  resetUserData,
};
