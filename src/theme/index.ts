// AppTheme — 全コンポーネントで共通使用するデザイントークン
// v2-cozy: ベージュ+セージグリーン+和文フォント
// 現場UI最適化: タップ領域48px以上、フォント16px以上、高コントラスト

export const colors = {
  primary: "#6B8E5A",       // sage green
  primaryHover: "#557048",  // sage green dark
  primaryLight: "#A8C49A",  // sage green light
  accent: "#C97B5A",        // terracotta
  success: "#6B8E5A",       // sage green
  warning: "#D4A35C",       // ochre
  danger: "#B5573D",        // iron rust
  background: "#F8F4ED",    // beige
  surface: "#FFFFFF",       // white
  surfaceSubtle: "#F0EBE0", // warm off-white
  text: "#3A3026",          // warm near-black
  textMuted: "#7A6D5A",     // warm gray
  border: "#E5DDD0",        // warm border
} as const;

export const statusColors = {
  todo: "#7A6D5A",
  in_progress: "#6B8E5A",
  done: "#557048",
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

export const fontSize = {
  sm: 12,
  md: 14,
  lg: 16,
  xl: 20,
  xxl: 24,
} as const;

export const breakpoints = {
  mobile: 640,
  tablet: 960,
  desktop: 1280,
} as const;

// 現場UI: タップ領域最小サイズ（軍手対応）
export const tapTarget = {
  min: 48,        // 全ボタン最低48px
  primary: 60,    // 主要アクション（追加・保存）60px
} as const;

// ガントチャート固有
export const gantt = {
  dayWidth: 28,
  rowHeight: 48,
  phaseRowHeight: 36,
  headerHeight: 64,
  labelWidth: 160,
} as const;
