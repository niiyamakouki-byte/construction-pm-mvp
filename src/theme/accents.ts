/**
 * テーマカラー（アクセント）定義 — 2026-08-08 光輝さん指示「テーマカラーは選択式でもいいよね」
 *
 * 既定=セージ（ブランド案1: 和モダン 生成り×セージ×深緑）。
 * 全テーマとも和モダン系・単色アクセント（genbahub-ui憲法）を維持し、
 * アクセント色とその淡色面の差し替え（CSS変数 --color-brand-* の上書き）だけで成立させる。
 * 実際の色定義は src/index.css の `:root[data-accent="..."]` ブロック側にある。
 */

export type AccentTheme = "sage" | "ai" | "sumi" | "terracotta";

export const ACCENT_STORAGE_KEY = "genbahub-accent";
export const DEFAULT_ACCENT: AccentTheme = "sage";

export interface AccentThemeMeta {
  id: AccentTheme;
  /** 設定画面に出す名前 */
  label: string;
  /** 一言説明 */
  description: string;
  /** セレクタのスウォッチ表示用（= 各テーマの brand-700） */
  swatch: string;
}

export const ACCENT_THEMES: readonly AccentThemeMeta[] = [
  { id: "sage", label: "セージ", description: "生成り×セージ×深緑（標準）", swatch: "#346538" },
  { id: "ai", label: "深藍", description: "紺×生成り", swatch: "#2f4d6e" },
  { id: "sumi", label: "墨", description: "炭黒×白", swatch: "#3c3c37" },
  { id: "terracotta", label: "テラコッタ", description: "赤土×生成り", swatch: "#7d4423" },
] as const;

const VALID_ACCENTS: readonly string[] = ACCENT_THEMES.map((t) => t.id);

export function isAccentTheme(value: string | null): value is AccentTheme {
  return value !== null && VALID_ACCENTS.includes(value);
}

export function readStoredAccent(): AccentTheme {
  if (typeof window === "undefined") return DEFAULT_ACCENT;
  try {
    const stored = window.localStorage.getItem(ACCENT_STORAGE_KEY);
    return isAccentTheme(stored) ? stored : DEFAULT_ACCENT;
  } catch {
    return DEFAULT_ACCENT;
  }
}

export function applyAccent(accent: AccentTheme): void {
  const root = document.documentElement;
  if (accent === DEFAULT_ACCENT) {
    // 既定テーマは data-accent 無し = index.css のベーストークンそのまま
    // （sage-guard テストが検証する既定値を素の :root に保つ）
    delete root.dataset.accent;
  } else {
    root.dataset.accent = accent;
  }
}

/** アプリ起動時に保存済みテーマを適用する（main.tsx から1回呼ぶ） */
export function initAccentTheme(): void {
  if (typeof document === "undefined") return;
  applyAccent(readStoredAccent());
}
