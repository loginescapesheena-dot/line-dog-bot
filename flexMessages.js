// flexMessages.js
// 記帳確認卡片（Flex Message）— 黑白灰棕質感風格
// 支出/收入用同一套棕色調，靠正負號跟細節區分，不用對比色分開

const COLOR_BG = '#F5F0EA';
const COLOR_BROWN = '#6B4A34';
const COLOR_BROWN_SOFT = '#8B6B54';
const COLOR_CHARCOAL = '#3A322C';
const COLOR_LINE = '#DCD2C6';

function buildRecordConfirmCard({ type, category, amount, note, dogReply, monthNet, cardBalance }) {
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
          ...(cardBalance !== undefined && cardBalance !== null && cardBalance > 0
            ? [
                {
                  type: 'text',
                  text: `💳 信用卡待繳　${cardBalance} 元`,
                  size: 'xs',
                  color: COLOR_BROWN_SOFT,
                  margin: 'xs',
                },
              ]
            : []),
        ],
      },
    },
  };
}

// ===== 信用卡消費卡片（未計入當月一般支出，先記到卡費待繳）=====
function buildCardChargeCard({ category, amount, note, dogReply, cardBalance }) {
  return {
    type: 'flex',
    altText: `信用卡消費：${category} ${amount} 元，目前卡費待繳 ${cardBalance} 元`,
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
          { type: 'text', text: 'CREDIT CARD', size: 'xs', color: COLOR_BROWN_SOFT },
          {
            type: 'text',
            text: '💳 信用卡消費',
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
          { type: 'text', text: `－ ${amount}`, size: '3xl', weight: 'bold', color: COLOR_BROWN },
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
          { type: 'text', text: dogReply, size: 'sm', wrap: true, margin: 'md', color: COLOR_CHARCOAL },
          {
            type: 'box',
            layout: 'vertical',
            margin: 'md',
            backgroundColor: '#EDE4D8',
            cornerRadius: 'md',
            paddingAll: 'md',
            contents: [
              { type: 'text', text: '這筆先不算進本月一般支出，等你繳卡費時才會入帳', size: 'xxs', color: COLOR_BROWN_SOFT, wrap: true },
              {
                type: 'text',
                text: `目前信用卡待繳：${cardBalance} 元`,
                size: 'sm',
                weight: 'bold',
                color: COLOR_BROWN,
                margin: 'xs',
              },
            ],
          },
        ],
      },
    },
  };
}

// ===== 信用卡分期卡片（設定一次，之後每月自動扣款）=====
function buildInstallmentCard({ category, totalAmount, monthlyAmount, totalPeriods, note, dogReply, cardBalance }) {
  return {
    type: 'flex',
    altText: `分期消費：${category} 共 ${totalAmount} 元，分 ${totalPeriods} 期，每期 ${monthlyAmount} 元`,
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
          { type: 'text', text: 'INSTALLMENT', size: 'xs', color: COLOR_BROWN_SOFT },
          {
            type: 'text',
            text: '📅 分期消費',
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
          { type: 'text', text: `總額 ${totalAmount}`, size: '3xl', weight: 'bold', color: COLOR_BROWN },
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
          {
            type: 'box',
            layout: 'baseline',
            contents: [
              { type: 'text', text: '分期', size: 'sm', color: COLOR_BROWN_SOFT, flex: 2 },
              { type: 'text', text: `共 ${totalPeriods} 期，每期 ${monthlyAmount} 元`, size: 'sm', flex: 5, wrap: true, color: COLOR_CHARCOAL },
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
          { type: 'text', text: dogReply, size: 'sm', wrap: true, margin: 'md', color: COLOR_CHARCOAL },
          {
            type: 'box',
            layout: 'vertical',
            margin: 'md',
            backgroundColor: '#EDE4D8',
            cornerRadius: 'md',
            paddingAll: 'md',
            contents: [
              {
                type: 'text',
                text: `之後每個月 1 號會自動幫你加 ${monthlyAmount} 元到卡費，共 ${totalPeriods} 期，不用再手動輸入`,
                size: 'xxs',
                color: COLOR_BROWN_SOFT,
                wrap: true,
              },
              {
                type: 'text',
                text: `目前信用卡待繳：${cardBalance} 元`,
                size: 'sm',
                weight: 'bold',
                color: COLOR_BROWN,
                margin: 'xs',
              },
            ],
          },
        ],
      },
    },
  };
}

// ===== 用 QuickChart（免費圖表服務）產生圓餅圖圖片網址 =====
const PIE_COLORS = ['#6B4A34', '#A98F76', '#3A322C', '#C9BBAF', '#8B6B54', '#D9CBB8', '#4A3728'];

function buildCategoryPieChartUrl(byCategory, maxItems = 6) {
  if (!byCategory || byCategory.length === 0) return null;

  const items = byCategory.slice(0, maxItems);
  const chartConfig = {
    type: 'pie',
    data: {
      labels: items.map((c) => `${c.category}　${c.total}元`),
      datasets: [
        {
          data: items.map((c) => c.total),
          backgroundColor: items.map((_, i) => PIE_COLORS[i % PIE_COLORS.length]),
          borderColor: COLOR_BG,
          borderWidth: 3,
        },
      ],
    },
    options: {
      plugins: {
        legend: {
          position: 'right',
          labels: { color: COLOR_CHARCOAL, font: { size: 13 } },
        },
      },
    },
  };

  const encoded = encodeURIComponent(JSON.stringify(chartConfig));
  return `https://quickchart.io/chart?c=${encoded}&backgroundColor=${encodeURIComponent(COLOR_BG)}&width=600&height=340&version=3`;
}

// ===== 存錢目標進度條 =====
function buildGoalProgress(goal, net) {
  if (!goal || goal <= 0) return [];

  const ratio = Math.max(0, Math.min(1, net / goal));
  const BAR_UNIT = 20;
  const filledFlex = Math.max(net > 0 ? 1 : 0, Math.round(ratio * BAR_UNIT));
  const emptyFlex = BAR_UNIT - filledFlex;
  const achieved = net >= goal;

  return [
    { type: 'separator', margin: 'lg', color: COLOR_LINE },
    {
      type: 'box',
      layout: 'vertical',
      margin: 'lg',
      spacing: 'xs',
      contents: [
        {
          type: 'box',
          layout: 'horizontal',
          contents: [
            { type: 'text', text: '存錢目標', size: 'sm', color: COLOR_BROWN_SOFT, flex: 3 },
            {
              type: 'text',
              text: achieved ? '已達成 🎉' : `${Math.round(ratio * 100)}%`,
              size: 'sm',
              color: COLOR_BROWN,
              weight: 'bold',
              align: 'end',
              flex: 2,
            },
          ],
        },
        {
          type: 'box',
          layout: 'horizontal',
          height: '10px',
          margin: 'sm',
          contents: [
            { type: 'box', layout: 'vertical', backgroundColor: COLOR_BROWN, flex: filledFlex, contents: [] },
            ...(emptyFlex > 0
              ? [{ type: 'box', layout: 'vertical', backgroundColor: COLOR_LINE, flex: emptyFlex, contents: [] }]
              : []),
          ],
        },
        {
          type: 'text',
          text: `目標 ${goal} 元　結餘 ${net} 元`,
          size: 'xxs',
          color: COLOR_BROWN_SOFT,
          margin: 'xs',
        },
      ],
    },
  ];
}

// ===== 每月財報卡片 =====
function buildMonthlyReportCard({ monthLabel, totalIncome, totalExpense, net, byCategory, goal, highlight, advice, cardBalance }) {
  const chartUrl = buildCategoryPieChartUrl(byCategory);

  return {
    type: 'flex',
    altText: `${monthLabel} 財務報告：收入 ${totalIncome} / 支出 ${totalExpense} / 結餘 ${net}`,
    contents: {
      type: 'bubble',
      size: 'giga',
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
          { type: 'text', text: 'MONTHLY REPORT', size: 'xs', color: COLOR_BROWN_SOFT },
          {
            type: 'text',
            text: `${monthLabel} 財務報告`,
            color: COLOR_CHARCOAL,
            weight: 'bold',
            size: 'xl',
            margin: 'xs',
          },
        ],
      },
      ...(chartUrl
        ? {
            hero: {
              type: 'image',
              url: chartUrl,
              size: 'full',
              aspectRatio: '20:11',
              aspectMode: 'fit',
              backgroundColor: COLOR_BG,
            },
          }
        : {}),
      body: {
        type: 'box',
        layout: 'vertical',
        paddingAll: 'lg',
        backgroundColor: COLOR_BG,
        contents: [
          // 收入/支出/結餘 三欄
          {
            type: 'box',
            layout: 'horizontal',
            contents: [
              {
                type: 'box',
                layout: 'vertical',
                contents: [
                  { type: 'text', text: '收入', size: 'xxs', color: COLOR_BROWN_SOFT },
                  { type: 'text', text: `${totalIncome}`, size: 'lg', weight: 'bold', color: COLOR_CHARCOAL },
                ],
              },
              {
                type: 'box',
                layout: 'vertical',
                contents: [
                  { type: 'text', text: '支出', size: 'xxs', color: COLOR_BROWN_SOFT },
                  { type: 'text', text: `${totalExpense}`, size: 'lg', weight: 'bold', color: COLOR_CHARCOAL },
                ],
              },
              {
                type: 'box',
                layout: 'vertical',
                contents: [
                  { type: 'text', text: '結餘', size: 'xxs', color: COLOR_BROWN_SOFT },
                  {
                    type: 'text',
                    text: `${net >= 0 ? '+' : ''}${net}`,
                    size: 'lg',
                    weight: 'bold',
                    color: COLOR_BROWN,
                  },
                ],
              },
            ],
          },
          { type: 'separator', margin: 'lg', color: COLOR_LINE },
          {
            type: 'text',
            text: '支出分類佔比',
            size: 'sm',
            color: COLOR_BROWN_SOFT,
            margin: 'lg',
          },
          ...buildGoalProgress(goal, net),
          ...(cardBalance && cardBalance > 0
            ? [
                { type: 'separator', margin: 'lg', color: COLOR_LINE },
                {
                  type: 'box',
                  layout: 'horizontal',
                  margin: 'lg',
                  contents: [
                    { type: 'text', text: '💳 信用卡待繳', size: 'sm', color: COLOR_BROWN_SOFT, flex: 3 },
                    {
                      type: 'text',
                      text: `${cardBalance} 元`,
                      size: 'sm',
                      weight: 'bold',
                      color: COLOR_BROWN,
                      align: 'end',
                      flex: 2,
                    },
                  ],
                },
              ]
            : []),
          { type: 'separator', margin: 'lg', color: COLOR_LINE },
          {
            type: 'text',
            text: highlight,
            size: 'sm',
            wrap: true,
            margin: 'lg',
            color: COLOR_CHARCOAL,
          },
          {
            type: 'box',
            layout: 'vertical',
            margin: 'md',
            backgroundColor: '#EDE4D8',
            cornerRadius: 'md',
            paddingAll: 'md',
            contents: [
              { type: 'text', text: '🐶 小狗建議', size: 'xxs', color: COLOR_BROWN_SOFT, weight: 'bold' },
              { type: 'text', text: advice, size: 'sm', wrap: true, color: COLOR_CHARCOAL, margin: 'xs' },
            ],
          },
        ],
      },
    },
  };
}

module.exports = { buildRecordConfirmCard, buildCardChargeCard, buildInstallmentCard, buildMonthlyReportCard };
