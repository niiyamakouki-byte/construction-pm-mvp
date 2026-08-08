/**
 * テーマカラー選択（2026-08-08 光輝さん「テーマカラーは選択式でもいいよね」）のテスト。
 * - 既定=セージ（data-accent無し）で sage-guard の既定トークンを壊さないこと
 * - 選択が localStorage に永続化され <html data-accent> に反映されること
 * - index.css に各テーマの上書きブロックが存在すること
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ACCENT_STORAGE_KEY,
  ACCENT_THEMES,
  DEFAULT_ACCENT,
  applyAccent,
  isAccentTheme,
  readStoredAccent,
} from "../theme/accents.js";
import { useAccentTheme } from "../hooks/useAccentTheme.js";

const repoRoot = resolve(import.meta.dirname, "../..");

function createMockLocalStorage(): Storage {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => { store.set(key, value); },
    removeItem: (key: string) => { store.delete(key); },
    clear: () => { store.clear(); },
    get length() { return store.size; },
    key: (index: number) => [...store.keys()][index] ?? null,
  };
}

describe("accent theme (テーマカラー選択)", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", createMockLocalStorage());
    delete document.documentElement.dataset.accent;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete document.documentElement.dataset.accent;
  });

  it("既定はセージ（保存なし・不正値はフォールバック）", () => {
    expect(readStoredAccent()).toBe("sage");
    window.localStorage.setItem(ACCENT_STORAGE_KEY, "neon-pink");
    expect(readStoredAccent()).toBe("sage");
    expect(isAccentTheme("terracotta")).toBe(true);
    expect(isAccentTheme("blue")).toBe(false);
  });

  it("既定セージは data-accent を残さない（sage-guard の素の:rootを保つ）", () => {
    applyAccent("ai");
    expect(document.documentElement.dataset.accent).toBe("ai");
    applyAccent(DEFAULT_ACCENT);
    expect(document.documentElement.dataset.accent).toBeUndefined();
  });

  it("useAccentTheme: 選択が localStorage と <html data-accent> に反映される", () => {
    const { result } = renderHook(() => useAccentTheme());
    expect(result.current.accent).toBe("sage");

    act(() => { result.current.setAccent("terracotta"); });
    expect(result.current.accent).toBe("terracotta");
    expect(document.documentElement.dataset.accent).toBe("terracotta");
    expect(window.localStorage.getItem(ACCENT_STORAGE_KEY)).toBe("terracotta");
  });

  it("useAccentTheme: 保存済みテーマを初期値として読む", () => {
    window.localStorage.setItem(ACCENT_STORAGE_KEY, "sumi");
    const { result } = renderHook(() => useAccentTheme());
    expect(result.current.accent).toBe("sumi");
  });

  it("index.css に非既定3テーマの上書きブロックがある（アクセント色はテーマごとに一意）", () => {
    const css = readFileSync(resolve(repoRoot, "src/index.css"), "utf8");

    expect(css).toContain(':root[data-accent="ai"]');
    expect(css).toContain("--color-brand-700: #2f4d6e;");
    expect(css).toContain(':root[data-accent="sumi"]');
    expect(css).toContain("--color-brand-700: #3c3c37;");
    expect(css).toContain(':root[data-accent="terracotta"]');
    expect(css).toContain("--color-brand-700: #7d4423;");

    // 既定セージは data-accent ブロックを持たない（素の :root がセージ）
    expect(css).not.toContain(':root[data-accent="sage"]');

    // セレクタUIのスウォッチ（= 各テーマの brand-700）とCSS定義が一致していること
    for (const theme of ACCENT_THEMES) {
      if (theme.id === "sage") {
        expect(css).toContain(`--color-brand-700: ${theme.swatch};`);
      } else {
        expect(css).toContain(`--color-brand-700: ${theme.swatch.toLowerCase()};`);
      }
    }
  });
});
