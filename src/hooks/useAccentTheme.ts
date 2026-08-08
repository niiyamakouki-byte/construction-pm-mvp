import { useEffect, useState } from "react";
import {
  ACCENT_STORAGE_KEY,
  applyAccent,
  readStoredAccent,
  type AccentTheme,
} from "../theme/accents.js";

/**
 * テーマカラー（アクセント）の選択状態フック。
 * useTheme（ライト/ダーク）と同型: localStorage 永続 + <html data-accent> 反映。
 * 起動時の適用は main.tsx の initAccentTheme() が担うため、
 * このフックは設定画面など「選ぶ側」のUIから使う。
 */
export function useAccentTheme() {
  const [accent, setAccent] = useState<AccentTheme>(() => readStoredAccent());

  useEffect(() => {
    applyAccent(accent);
    try {
      window.localStorage.setItem(ACCENT_STORAGE_KEY, accent);
    } catch {
      // localStorage書き込み失敗時はメモリ上の選択だけ維持する
    }
  }, [accent]);

  return { accent, setAccent };
}
