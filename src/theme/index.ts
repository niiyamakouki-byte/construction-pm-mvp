// AppTheme — 全コンポーネントで共通使用するデザイントークン
// 現場UI最適化: タップ領域48px以上、フォント16px以上、高コントラスト

export const colors = {
  primary: "#0f172a",       // navy
  accent: "#2563eb",        // blue
  success: "#10b981",       // green
  warning: "#f59e0b",       // amber
  danger: "#ef4444",        // red
  background: "#f8fafc",    // very light gray
  surface: "#ffffff",       // white
  text: "#0f172a",          // near-black
  textMuted: "#64748b",     // slate-500
  border: "#e2e8f0",        // slate-200
  borderLight: "#f1f5f9",   // slate-100
} as const;

export const statusColors = {
  todo: "#94a3b8",
  in_progress: "#2563eb",
  done: "#10b981",
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
  dayWidth: 36,
  rowHeight: 44,
  phaseRowHeight: 36,
  headerHeight: 56,
  labelWidth: 240,
} as const;
