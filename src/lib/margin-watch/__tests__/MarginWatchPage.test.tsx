/**
 * Tests for MarginWatchPage.
 */

import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { MarginWatchPage } from "../../../components/MarginWatchPage.js";
import { MarginAlertStore, _resetMarginAlertStore } from "../margin-alert-store.js";
import type { MarginAlert } from "../types.js";

// ── Fixtures ───────────────────────────────────────────────────────────────

let _counter = 0;

function makeAlert(overrides: Partial<MarginAlert> = {}): MarginAlert {
  return {
    id: `ma-test-${++_counter}`,
    projectId: "p1",
    projectName: "テスト案件A",
    level: "warning",
    marginRatioPct: 22,
    forecastMarginRatioPct: 20,
    deltaFromTargetPct: -5,
    causeTag: ["原価増"],
    suggestedAction_ja: "週次レビュー対象。粗利改善案を3つ用意",
    raisedAt: new Date().toISOString(),
    ...overrides,
  };
}

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

beforeEach(() => {
  vi.stubGlobal("localStorage", createMockLocalStorage());
  _resetMarginAlertStore();
  _counter = 0;
});

afterEach(() => {
  cleanup();
});

// ── テスト ─────────────────────────────────────────────────────────────────

describe("MarginWatchPage", () => {
  it("空状態 — 粗利アラートなしメッセージ表示", () => {
    render(<MarginWatchPage />);
    expect(screen.getByText(/粗利アラートはありません/)).toBeTruthy();
  });

  it("ページタイトルが表示される", () => {
    render(<MarginWatchPage />);
    expect(screen.getByText(/粗利ウォッチ/)).toBeTruthy();
  });

  it("アラートあり — テーブルに案件名が表示される", () => {
    // Add alert directly to store before rendering
    const storeInstance = new MarginAlertStore();
    storeInstance.add(makeAlert({ id: "display-1", projectName: "表示テスト案件" }));

    // Use the singleton store via mock localStorage
    render(<MarginWatchPage />);
    // MarginWatchPage reads from marginAlertStore singleton which uses same localStorage
    expect(screen.getByText("表示テスト案件")).toBeTruthy();
  });

  it("dismiss ボタンをクリックするとアラートが削除される", () => {
    const storeInstance = new MarginAlertStore();
    storeInstance.add(makeAlert({ id: "dismiss-target", projectName: "削除対象案件" }));

    render(<MarginWatchPage />);

    expect(screen.getByText("削除対象案件")).toBeTruthy();

    const dismissButton = screen.getAllByRole("button", { name: "閉じる" })[0];
    fireEvent.click(dismissButton);

    // After dismiss the row should disappear
    expect(screen.queryByText("削除対象案件")).toBeNull();
  });

  it("KPI: 重大件数が表示される", () => {
    const storeInstance = new MarginAlertStore();
    storeInstance.add(makeAlert({ id: "crit-1", level: "critical" }));
    storeInstance.add(makeAlert({ id: "warn-1", level: "warning" }));

    render(<MarginWatchPage />);
    expect(screen.getByText("重大件数")).toBeTruthy();
  });

  it("ヒントパネルの4カードが表示される", () => {
    render(<MarginWatchPage />);
    expect(screen.getByText("原価精査")).toBeTruthy();
    expect(screen.getByText("追加見積")).toBeTruthy();
    expect(screen.getByText("単価交渉")).toBeTruthy();
    expect(screen.getByText("工程短縮")).toBeTruthy();
  });
});
