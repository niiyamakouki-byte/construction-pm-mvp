import { useEffect, useRef, useState } from "react";

export const SIDEBAR_COLLAPSED_STORAGE_KEY = "genbahub-sidebar-collapsed";

/** 工程表はタブレット幅以下だと左サイドバーが作業の邪魔になるため、この幅以下ではデフォルト折りたたみにする。 */
const TABLET_MAX_WIDTH_QUERY = "(max-width: 1024px)";

function readStoredCollapsed(): boolean | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = window.localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY);
    return stored === null ? null : stored === "1";
  } catch {
    return null;
  }
}

/**
 * サイドバー折りたたみ状態。ユーザーが一度でもトグルしたらその選択を記憶し、以後はそれを優先する。
 * 未設定（初回）の場合のみ、/gantt をタブレット幅以下で開いたときにデフォルト折りたたみにする。
 */
export function useSidebarCollapsed(route: string) {
  const hasManualPreference = useRef(readStoredCollapsed() !== null);
  const [collapsed, setCollapsedState] = useState<boolean>(() => readStoredCollapsed() ?? false);

  useEffect(() => {
    if (hasManualPreference.current) return;
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const isGanttRoute = route.startsWith("/gantt");
    const isTabletWidth = window.matchMedia(TABLET_MAX_WIDTH_QUERY).matches;
    setCollapsedState(isGanttRoute && isTabletWidth);
  }, [route]);

  const toggle = () => {
    setCollapsedState((current) => {
      const next = !current;
      hasManualPreference.current = true;
      try {
        window.localStorage.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, next ? "1" : "0");
      } catch {
        // localStorage不可時はメモリ上の状態のみで継続する
      }
      return next;
    });
  };

  return { collapsed, toggle };
}
