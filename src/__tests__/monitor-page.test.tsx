/**
 * MonitorPage コンポーネントテスト
 * 4分割レンダリング / スナップショット反映 / 空状態 / アラートバッジをカバー
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, act, cleanup } from "@testing-library/react";
import React from "react";

// ── fetch スタブ (pullFromAPI がネットワークに触れないように) ──────────────────
vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 503 }));

// ── MonitorRealtimeStore をモック ─────────────────────────────────────────────
// テストでは subscribe/pullFromAPI/stop を制御する
let capturedCallback: ((s: unknown) => void) | null = null;
let pullCalled = false;
let stopCalled = false;

vi.mock("../lib/monitor-tool/realtime-store.js", () => {
  return {
    MonitorRealtimeStore: vi.fn().mockImplementation(() => ({
      subscribe: vi.fn((cb: (s: unknown) => void) => {
        capturedCallback = cb;
        return () => { capturedCallback = null; };
      }),
      pullFromAPI: vi.fn(() => { pullCalled = true; }),
      stop: vi.fn(() => { stopCalled = true; }),
      getSnapshot: vi.fn(() => null),
    })),
  };
});

import { MonitorPage } from "../components/MonitorPage.js";
import type { MonitorSnapshot } from "../lib/monitor-tool/monitor-aggregator.js";

afterEach(() => {
  cleanup();
  capturedCallback = null;
  pullCalled = false;
  stopCalled = false;
});

// ── フィクスチャ ──────────────────────────────────────────────────────────────

function makeSnapshot(overrides: Partial<MonitorSnapshot> = {}): MonitorSnapshot {
  return {
    today: new Date("2026-05-09T03:00:00.000Z"),
    ganttSummary: { delayed: 0, onTrack: 2, ahead: 0, totalProgress: 60 },
    todayReports: [
      {
        id: "r1",
        projectId: "proj-1",
        reportDate: "2026-05-09",
        weather: "晴れ",
        content: "1階床工事完了",
        photoCount: 3,
        authorId: "user-1",
      },
    ],
    recentChats: [
      {
        id: "c1",
        projectId: "proj-1",
        userId: "user-1",
        userName: "鈴木",
        content: "確認しました",
        timestamp: "2026-05-09T09:00:00.000Z",
      },
    ],
    recentPhotos: [
      {
        id: "p1",
        projectId: "proj-1",
        url: "https://example.com/photo.jpg",
        caption: "床施工",
        takenAt: "2026-05-09T10:00:00.000Z",
      },
    ],
    alerts: [],
    ...overrides,
  };
}

// ── テスト ────────────────────────────────────────────────────────────────────

describe("MonitorPage", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("4つのパネルタイトルが表示される", () => {
    render(<MonitorPage />);
    expect(screen.getByText("進捗サマリ")).toBeDefined();
    expect(screen.getByText("本日の日報")).toBeDefined();
    expect(screen.getByText("チャット")).toBeDefined();
    expect(screen.getByText("現場写真")).toBeDefined();
  });

  it("ヘッダーに「現場モニター」が表示される", () => {
    render(<MonitorPage />);
    expect(screen.getByText("現場モニター")).toBeDefined();
  });

  it("pullFromAPI が useEffect で呼ばれる", () => {
    render(<MonitorPage />);
    expect(pullCalled).toBe(true);
  });

  it("空状態では各パネルに空メッセージが表示される", () => {
    render(<MonitorPage />);
    expect(screen.getByText("本日の進捗データはまだありません")).toBeDefined();
    expect(screen.getByText("本日の日報はまだありません")).toBeDefined();
    expect(screen.getByText("メッセージはまだありません")).toBeDefined();
    expect(screen.getByText("本日の写真はまだありません")).toBeDefined();
  });

  it("スナップショットが来ると日報コンテンツが表示される", async () => {
    render(<MonitorPage />);
    const snap = makeSnapshot();

    await act(async () => {
      capturedCallback?.(snap);
    });

    expect(screen.getByText("1階床工事完了")).toBeDefined();
    expect(screen.getByText("確認しました")).toBeDefined();
  });

  it("スナップショット反映後に進捗率が表示される", async () => {
    render(<MonitorPage />);
    const snap = makeSnapshot();

    await act(async () => {
      capturedCallback?.(snap);
    });

    expect(screen.getByText("60%")).toBeDefined();
  });

  it("アラートがある場合バッジが表示される", async () => {
    render(<MonitorPage />);
    const snap = makeSnapshot({
      alerts: [
        { id: "delayed-tasks", severity: "error", message: "遅延タスクが 1 件あります" },
      ],
    });

    await act(async () => {
      capturedCallback?.(snap);
    });

    expect(screen.getByText(/エラー/)).toBeDefined();
    expect(screen.getByText("遅延タスクが 1 件あります")).toBeDefined();
  });

  it("アラートなし状態では「アラートなし」と表示される", () => {
    render(<MonitorPage />);
    expect(screen.getByText("アラートなし")).toBeDefined();
  });
});
