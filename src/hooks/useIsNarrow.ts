import { useEffect, useState } from "react";

// 来歴: laporta-beads-ftaqp (GenbaHub: モバイル工程表を7日縦リスト化) / worker(opus) / 2026-07-20
// 狭幅（既定390px以下=標準的なスマホ縦持ち）を検知する。工程表を横スクロールの
// ガントではなく縦リストに切り替える判定に使う。SSR/テスト(jsdom で matchMedia 未実装)
// では false を返し、既存のデスクトップ描画（GanttChart）を維持する。

export const NARROW_MAX_WIDTH = 390;

function query(maxWidth: number): string {
  return `(max-width: ${maxWidth}px)`;
}

function readMatches(maxWidth: number): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return window.matchMedia(query(maxWidth)).matches;
}

/** 画面幅が maxWidth 以下かをリアクティブに返す。回転やリサイズにも追従する。 */
export function useIsNarrow(maxWidth: number = NARROW_MAX_WIDTH): boolean {
  const [narrow, setNarrow] = useState<boolean>(() => readMatches(maxWidth));

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const mql = window.matchMedia(query(maxWidth));
    const onChange = () => setNarrow(mql.matches);
    onChange();
    // Safari 14 以前は addEventListener 非対応のため addListener にフォールバック
    if (typeof mql.addEventListener === "function") {
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    }
    mql.addListener(onChange);
    return () => mql.removeListener(onChange);
  }, [maxWidth]);

  return narrow;
}
