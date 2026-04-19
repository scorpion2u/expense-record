// ==================== 常量定义 ====================
export const CONSTANTS = {
  STORAGE_KEYS: {
    ENTRIES: 'book_v1_main',
    EXPENSE_CATS: 'book_expense_cats_v1',
    INCOME_CATS: 'book_income_cats_v1',
    PAYMENT_TYPES: 'book_payment_types_v1',
    SETTINGS: 'book_ui_settings_v1'
  },
  DEFAULT_CATS: {
    EXPENSE: ['早餐', '午餐', '晚餐', '打油', '购物', '娱乐', '居家', '其他'],
    INCOME: ['薪水', '奖金', '红包', '投资', '报销', '其他']
  },
  DEFAULT_PAYMENT_TYPES: ['现金', '电子钱包', '信用卡', '借记卡'],
  DELETE_CONFIRM_WORD: 'DELETE',
  MAX_ENTRIES: 5000,
  SWIPE_THRESHOLD: 50,
  MAX_AMOUNT: 1000000,
  MAX_NOTE_LENGTH: 100
};

// 默认 UI 设置
export const DEFAULT_UI_SETTINGS = {
  cardRadius: 24,
  cardPadding: 16,
  statPadding: 8,
  inputPadding: 12,
  fontSize: 18,
  expenseColor: '#c2413a',
  incomeColor: '#2dd4bf',
  spacingGap: 6,
  bgColor: '#f1f5f9',
  cardBg: '#ffffff',
  darkMode: false
};