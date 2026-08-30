// flexMessages.js
// 記帳確認卡片（Flex Message）— 黑白灰棕質感風格
// 支出/收入用同一套棕色調，靠正負號跟細節區分，不用對比色分開

const COLOR_BG = '#F5F0EA';
const COLOR_BROWN = '#6B4A34';
const COLOR_BROWN_SOFT = '#8B6B54';
const COLOR_CHARCOAL = '#3A322C';
const COLOR_LINE = '#DCD2C6';

function buildRecordConfirmCard({ type, category, amount, note, dogReply, monthNet }) {
  const isIncome = type === 'income';
  const headerText = isIncome ? '收入記錄' : '支出記錄';
  const headerSub = isIncome ? 'INCOME' : 'EXPENSE';
  const amountText = `${isIncome ? '+' : '－'} ${amount}`;

  return {
    type: 'flex',
    altText: `${headerText}：${category} ${amount} 元`,
    contents: {
      type: 'bubble',
      styles: {
        body: { backgroundColor: COLOR_BG },
      },
      header: {
        type: 'box',
        layout: 'vertical',
        backgroundColor: COLOR_BG,
        paddingAll: 'lg',
        paddingBottom: 'none',
        contents: [
          {
            type: 'text',
            text: headerSub,
            size: 'xs',
            color: COLOR_BROWN_SOFT,
          },
          {
            type: 'text',
            text: headerText,
            color: COLOR_CHARCOAL,
            weight: 'bold',
            size: 'xl',
            margin: 'xs',
          },
        ],
      },
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'md',
        paddingAll: 'lg',
        backgroundColor: COLOR_BG,
        contents: [
          {
            type: 'text',
            text: amountText,
            size: '3xl',
            weight: 'bold',
            color: COLOR_BROWN,
          },
          { type: 'separator', margin: 'md', color: COLOR_LINE },
          {
            type: 'box',
            layout: 'baseline',
            margin: 'md',
            contents: [
              { type: 'text', text: '分類', size: 'sm', color: COLOR_BROWN_SOFT, flex: 2 },
              { type: 'text', text: category, size: 'md', flex: 5, wrap: true, color: COLOR_CHARCOAL },
            ],
          },
          ...(note
            ? [
                {
                  type: 'box',
                  layout: 'baseline',
                  contents: [
                    { type: 'text', text: '備註', size: 'sm', color: COLOR_BROWN_SOFT, flex: 2 },
                    { type: 'text', text: note, size: 'sm', flex: 5, wrap: true, color: COLOR_CHARCOAL },
                  ],
                },
              ]
            : []),
          { type: 'separator', margin: 'md', color: COLOR_LINE },
          {
            type: 'text',
            text: dogReply,
            size: 'sm',
            wrap: true,
            margin: 'md',
            color: COLOR_CHARCOAL,
          },
          ...(monthNet !== undefined && monthNet !== null
            ? [
                {
                  type: 'text',
                  text: `本月結餘　${monthNet >= 0 ? '+' : '－'} ${Math.abs(monthNet)}`,
                  size: 'xs',
                  color: COLOR_BROWN_SOFT,
                  margin: 'sm',
                },
              ]
            : []),
        ],
      },
    },
  };
}

module.exports = { buildRecordConfirmCard };
