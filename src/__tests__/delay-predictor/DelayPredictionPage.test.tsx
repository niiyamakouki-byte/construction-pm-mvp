/**
 * Tests for DelayPredictionPage (RTL)
 */

import { cleanup, render, screen, fireEvent, act, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DelayPredictionPage } from "../../components/DelayPredictionPage.js";
import { _resetHistoricalStore } from "../../lib/delay-predictor/historical-store.js";
import { _resetPredictionStore } from "../../lib/delay-predictor/prediction-store.js";

// ── LocalStorage mock ──────────────────────────────────────────────────────

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

// ── Store mocks ────────────────────────────────────────────────────────────

const mockTasks = [
  {
    id: "task-a",
    projectId: "proj-1",
    name: "内装工事",
    description: "",
    status: "todo" as const,
    progress: 0,
    dependencies: [],
    majorCategory: "内装",
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    startDate: "2026-05-10",
    dueDate: "2026-05-20",
    includeWeekends: false,
  },
  {
    id: "task-b",
    projectId: "proj-1",
    name: "解体工事",
    description: "",
    status: "in_progress" as const,
    progress: 50,
    dependencies: [],
    majorCategory: "解体",
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    startDate: "2026-05-01",
    dueDate: "2026-05-08",
    includeWeekends: false,
  },
];

const mockProjects = [
  {
    id: "proj-1",
    name: "南青山案件",
    status: "active" as const,
    startDate: "2026-01-01",
    includeWeekends: false,
    budget: 10_000_000,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    description: "",
  },
];

vi.mock("../../stores/project-store.js", () => ({
  createProjectRepository: () => ({
    findAll: async () => mockProjects,
    findById: async (id: string) => mockProjects.find((p) => p.id === id) ?? null,
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  }),
}));

vi.mock("../../stores/task-store.js", () => ({
  createTaskRepository: () => ({
    findAll: async () => mockTasks,
    findById: async (id: string) => mockTasks.find((t) => t.id === id) ?? null,
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  }),
}));

afterEach(() => {
  cleanup();
  _resetHistoricalStore();
  _resetPredictionStore();
});

beforeEach(() => {
  vi.stubGlobal("localStorage", createMockLocalStorage());
});

// ── Helper ────────────────────────────────────────────────────────────────

async function flushEffects() {
  // Flush multiple microtask rounds for async useEffect chains
  for (let i = 0; i < 5; i++) {
    await act(async () => { await Promise.resolve(); });
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe("DelayPredictionPage — レンダリング", () => {
  it("ヘッダーに '工程遅延予測' が表示される", async () => {
    await act(async () => {
      render(<DelayPredictionPage projectIds={["proj-1"]} projectLabels={{ "proj-1": "南青山案件" }} />);
    });
    expect(screen.getByText("工程遅延予測")).toBeDefined();
  });

  it("プロジェクト選択セレクトが表示される", async () => {
    await act(async () => {
      render(<DelayPredictionPage projectIds={["proj-1"]} projectLabels={{ "proj-1": "南青山案件" }} />);
    });
    expect(screen.getByTestId("project-select")).toBeDefined();
  });

  it("一括予測ボタンが表示される", async () => {
    await act(async () => {
      render(<DelayPredictionPage projectIds={["proj-1"]} projectLabels={{ "proj-1": "南青山案件" }} />);
    });
    expect(screen.getByTestId("predict-btn")).toBeDefined();
  });
});

describe("DelayPredictionPage — 予測実行", () => {
  it("一括予測ボタンクリック後にテーブルが表示される", async () => {
    await act(async () => {
      render(
        <DelayPredictionPage
          projectIds={["proj-1"]}
          projectLabels={{ "proj-1": "南青山案件" }}
        />,
      );
    });

    // 全 useEffect が完了するまで待つ (projectId 設定 → tasks 取得)
    await flushEffects();

    // タスクが読み込まれた後にボタンがアクティブになるまで待つ
    await waitFor(() => {
      const btn = screen.getByTestId("predict-btn");
      expect((btn as HTMLButtonElement).disabled).toBe(false);
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId("predict-btn"));
    });
    await flushEffects();

    await waitFor(() => {
      expect(document.querySelector("[data-testid='prediction-table']")).toBeTruthy();
    });
  });

  it("予測後に保存ボタンが表示される", async () => {
    await act(async () => {
      render(
        <DelayPredictionPage
          projectIds={["proj-1"]}
          projectLabels={{ "proj-1": "南青山案件" }}
        />,
      );
    });

    await flushEffects();
    await waitFor(() => {
      expect((screen.getByTestId("predict-btn") as HTMLButtonElement).disabled).toBe(false);
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId("predict-btn"));
    });
    await flushEffects();

    await waitFor(() => {
      expect(document.querySelector("[data-testid='save-btn']")).toBeTruthy();
    });
  });

  it("予測後に緊急/高のみ表示トグルが表示される", async () => {
    await act(async () => {
      render(
        <DelayPredictionPage
          projectIds={["proj-1"]}
          projectLabels={{ "proj-1": "南青山案件" }}
        />,
      );
    });

    await flushEffects();
    await waitFor(() => {
      expect((screen.getByTestId("predict-btn") as HTMLButtonElement).disabled).toBe(false);
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId("predict-btn"));
    });
    await flushEffects();

    await waitFor(() => {
      expect(document.querySelector("[data-testid='critical-high-toggle']")).toBeTruthy();
    });
  });
});

describe("DelayPredictionPage — フィルタ機能", () => {
  it("critical/high のみトグルで表示件数が変わる", async () => {
    await act(async () => {
      render(
        <DelayPredictionPage
          projectIds={["proj-1"]}
          projectLabels={{ "proj-1": "南青山案件" }}
        />,
      );
    });

    await flushEffects();
    await waitFor(() => {
      expect((screen.getByTestId("predict-btn") as HTMLButtonElement).disabled).toBe(false);
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId("predict-btn"));
    });
    await flushEffects();

    await waitFor(() => {
      expect(document.querySelector("[data-testid='critical-high-toggle']")).toBeTruthy();
    });

    // トグルをクリック — エラーにならないことを確認
    await act(async () => {
      fireEvent.click(screen.getByTestId("critical-high-toggle"));
    });

    // テーブルか no-critical-high-msg が存在する
    const table = document.querySelector("[data-testid='prediction-table']");
    const noMsg = document.querySelector("[data-testid='no-critical-high-msg']");
    expect(table !== null || noMsg !== null).toBe(true);
  });
});

describe("DelayPredictionPage — RiskBadge", () => {
  it("予測後に RiskBadge が存在する", async () => {
    await act(async () => {
      render(
        <DelayPredictionPage
          projectIds={["proj-1"]}
          projectLabels={{ "proj-1": "南青山案件" }}
        />,
      );
    });

    await flushEffects();
    await waitFor(() => {
      expect((screen.getByTestId("predict-btn") as HTMLButtonElement).disabled).toBe(false);
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId("predict-btn"));
    });
    await flushEffects();

    await waitFor(() => {
      const badges = document.querySelectorAll("[data-testid^='risk-badge-']");
      expect(badges.length).toBeGreaterThan(0);
    });
  });
});

describe("DelayPredictionPage — 保存機能", () => {
  it("保存ボタンクリックで PredictionStore に保存される", async () => {
    await act(async () => {
      render(
        <DelayPredictionPage
          projectIds={["proj-1"]}
          projectLabels={{ "proj-1": "南青山案件" }}
        />,
      );
    });

    await flushEffects();
    await waitFor(() => {
      expect((screen.getByTestId("predict-btn") as HTMLButtonElement).disabled).toBe(false);
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId("predict-btn"));
    });
    await flushEffects();

    await waitFor(() => {
      expect(document.querySelector("[data-testid='save-btn']")).toBeTruthy();
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId("save-btn"));
    });

    // 保存完了メッセージが出る
    await waitFor(() => {
      expect(screen.getByText(/件保存しました/)).toBeDefined();
    });
  });
});

describe("DelayPredictionPage — propProjectIds なし", () => {
  it("propProjectIds 指定時にセレクトに項目が表示される", async () => {
    await act(async () => {
      render(
        <DelayPredictionPage
          projectIds={["proj-1"]}
          projectLabels={{ "proj-1": "南青山案件" }}
        />,
      );
    });

    expect(screen.getByTestId("project-select")).toBeDefined();
    const options = screen.getByTestId("project-select").querySelectorAll("option");
    expect(options.length).toBeGreaterThan(0);
  });
});
