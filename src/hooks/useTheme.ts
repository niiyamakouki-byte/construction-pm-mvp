import { useEffect, useState } from "react";

export const THEME_STORAGE_KEY = "genbahub-theme";

export type ThemePreference = "light" | "evening" | "system";
export type ResolvedTheme = "light" | "evening";

const VALID_THEMES: ThemePreference[] = ["light", "evening", "system"];

function isThemePreference(value: string | null): value is ThemePreference {
  return value !== null && VALID_THEMES.includes(value as ThemePreference);
}

function getSystemTheme(): ResolvedTheme {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return "light";
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "evening" : "light";
}

function readStoredTheme(): ThemePreference {
  if (typeof window === "undefined") {
    return "system";
  }

  try {
    const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isThemePreference(storedTheme) ? storedTheme : "system";
  } catch {
    return "system";
  }
}

function applyTheme(theme: ThemePreference, resolvedTheme: ResolvedTheme): void {
  const root = document.documentElement;
  root.dataset.theme = theme;
  // evening = warm dark; map to dark color-scheme for browser UI
  root.style.colorScheme = resolvedTheme === "evening" ? "dark" : "light";
}

function getNextTheme(theme: ThemePreference): ThemePreference {
  if (theme === "light") return "evening";
  if (theme === "evening") return "system";
  return "light";
}

export function useTheme() {
  const [theme, setTheme] = useState<ThemePreference>(() => readStoredTheme());
  const [systemTheme, setSystemTheme] = useState<ResolvedTheme>(() => getSystemTheme());

  const resolvedTheme: ResolvedTheme = theme === "system" ? systemTheme : (theme as ResolvedTheme);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return;
    }

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = (event: MediaQueryListEvent) => {
      setSystemTheme(event.matches ? "evening" : "light");
    };

    // eslint-disable-next-line react-hooks/set-state-in-effect -- マウント時にシステムテーマを初期設定する初期化パターン
    setSystemTheme(mediaQuery.matches ? "evening" : "light");
    mediaQuery.addEventListener("change", handleChange);

    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  useEffect(() => {
    applyTheme(theme, resolvedTheme);

    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // Ignore localStorage write failures and keep the in-memory preference.
    }
  }, [resolvedTheme, theme]);

  return {
    theme,
    resolvedTheme,
    setTheme,
    cycleTheme: () => setTheme((currentTheme) => getNextTheme(currentTheme)),
  };
}
