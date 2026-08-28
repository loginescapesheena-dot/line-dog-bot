// flexMessages.js
// 記帳確認卡片（Flex Message），支出/收入風格一致但顏色區分

function buildRecordConfirmCard({ type, category, amount, note, dogReply, monthNet }) {
  const isIncome = type === 'income';
  const headerColor = isIncome ? '#66BB6A' : '#FF8A65';
  const headerText = isIncome ? '💰 收入記錄' : '🧾 支出記錄';
  const amountText = `${isIncome ? '+' : '-'}${amount} 元`;

  return {
    type: 'flex',
    altText: `${headerText}：${category} ${amount} 元`,
    contents: {
      type: 'bubble',
      header: {
        type: 'box',
        layout: 'vertical',
        backgroundColor: headerColor,
        paddingAll: 'lg',
        contents: [
          {
            type: 'text',
            text: headerText,
            color: '#FFFFFF',
            weight: 'bold',
            size: 'lg',
          },
        ],
      },
      body: {
        type: 'box',
        layout: 'vertical',
        spacing: 'md',
        paddingAll: 'lg',
        contents: [
          {
            type: 'box',
            layout: 'baseline',
            contents: [
              { type: 'text', text: '分類', size: 'sm', color: '#999999', flex: 2 },
              { type: 'text', text: category, size: 'md', flex: 5, wrap: true },
            ],
          },
          {
            type: 'box',
            layout: 'baseline',
            contents: [
              { type: 'text', text: '金額', size: 'sm', color: '#999999', flex: 2 },
              {
                type: 'text',
                text: amountText,
                size: 'xl',
                weight: 'bold',
                flex: 5,
                color: isIncome ? '#2E7D32' : '#D84315',
              },
            ],
          },
          ...(note
            ? [
                {
                  type: 'box',
                  layout: 'baseline',
                  contents: [
                    { type: 'text', text: '備註', size: 'sm', color: '#999999', flex: 2 },
                    { type: 'text', text: note, size: 'sm', flex: 5, wrap: true, color: '#666666' },
                  ],
                },
              ]
            : []),
          { type: 'separator', margin: 'md' },
          {
            type: 'text',
            text: `🐶 ${dogReply}`,
            size: 'sm',
            wrap: true,
            margin: 'md',
            color: '#555555',
          },
          ...(monthNet !== undefined && monthNet !== null
            ? [
                {
                  type: 'text',
                  text: `本月結餘：${monthNet >= 0 ? '+' : ''}${monthNet} 元`,
                  size: 'xs',
                  color: '#999999',
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
