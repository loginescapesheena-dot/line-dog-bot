// richmenu.js
// Rich Menu 的版面定義：2500x1686，四宮格
// 座標系統：LINE 的 area 是以圖片左上角為原點 (0,0)

const RICH_MENU_WIDTH = 2500;
const RICH_MENU_HEIGHT = 1686;
const HALF_W = RICH_MENU_WIDTH / 2;
const HALF_H = RICH_MENU_HEIGHT / 2;

const richMenuObject = {
  size: { width: RICH_MENU_WIDTH, height: RICH_MENU_HEIGHT },
  selected: true,
  name: '記帳小狗主選單',
  chatBarText: '選單',
  areas: [
    {
      // 左上：支出
      bounds: { x: 0, y: 0, width: HALF_W, height: HALF_H },
      action: { type: 'postback', data: 'action=start_expense', displayText: '支出' },
    },
    {
      // 右上：收入
      bounds: { x: HALF_W, y: 0, width: HALF_W, height: HALF_H },
      action: { type: 'postback', data: 'action=start_income', displayText: '收入' },
    },
    {
      // 左下：查詢
      bounds: { x: 0, y: HALF_H, width: HALF_W, height: HALF_H },
      action: { type: 'postback', data: 'action=query_month', displayText: '查詢本月收支' },
    },
    {
      // 右下：設定
      bounds: { x: HALF_W, y: HALF_H, width: HALF_W, height: HALF_H },
      action: { type: 'postback', data: 'action=settings', displayText: '設定' },
    },
  ],
};

module.exports = { richMenuObject };
