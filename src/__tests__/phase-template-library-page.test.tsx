/**
 * Sprint 70: 工程テンプレートライブラリページ テスト
 *
 * 1. 空状態の表示
 * 2. テンプレート一覧表示
 * 3. プレビューモーダル
 * 4. 削除フロー
 * 5. 適用フロー
 */

import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PhaseTemplateLibraryPage } from "../pages/PhaseTemplateLibraryPage.js";
import { savePhaseTemplate, deletePhaseTemplate, listPhaseTemplates } from "../lib/phase-template/storage.js";
import type { PhaseTemplate } from "../lib/phase-template/types.js";

// ─── mocks ───────────────────────────────────────────────────────────────────

const mockProjectRepository = {
  findAll: vi.fn(),
};
const mockTaskRepository = {
  create: vi.fn(),
};

vi.mock("../stores/project-store.js", () => ({
  createProjectRepository: () => mockProjectRepository,
}));

vi.mock("../stores/task-store.js", () => ({
  createTaskRepository: () => mockTaskRepository,
}));

vi.mock("../contexts/OrganizationContext.js", () => ({
  useOrganizationContext: () => ({ organizationId: "test-org" }),
}));

vi.mock("../hooks/useHashRouter.js", () => ({
  navigate: vi.fn(),
}));

// ─── localStorage mock ────────────────────────────────────────────────────────

const mockStorage: Record<string, string> = {};
const localStorageMock = {
  getItem: vi.fn((key: string) => mockStorage[key] ?? null),
  setItem: vi.fn((key: string, val: string) => {
    mockStorage[key] = val;
  }),
  removeItem: vi.fn((key: string) => {
    delete mockStorage[key];
  }),
  get length() {
    return Object.keys(mockStorage).length;
  },
  key: vi.fn((i: number) => Object.keys(mockStorage)[i] ?? null),
};

// ─── helpers ──────────────────────────────────────────────────────────────────

function makeTemplate(overrides: Partial<PhaseTemplate> = {}): PhaseTemplate {
  return {
    id: "tpl-test-001",
    name: "住宅標準工程",
    description: "60m²以下の内装リフォーム向け",
    tags: ["住宅"],
    phases: [
      {
        id: "wbs-cat-解体工事",
        name: "解体工事",
        defaultDays: 5,
        groups: [
          {
            id: "wbs-grp-001",
            categoryId: "wbs-cat-解体工事",
            name: "内装解体",
            defaultDays: 3,
            tasks: [
              {
                id: "wbs-task-001",
                groupId: "wbs-grp-001",
                categoryId: "wbs-cat-解体工事",
                name: "天井解体",
                defaultDays: 1,
              },
            ],
          },
        ],
      },
    ],
    createdAt: "2026-05-01T09:00:00.000Z",
    ...overrides,
  };
}

// ─── setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  Object.keys(mockStorage).forEach((k) => {
    delete mockStorage[k];
  });
  vi.clearAllMocks();
  vi.stubGlobal("localStorage", localStorageMock);
  mockProjectRepository.findAll.mockResolvedValue([]);
  mockTaskRepository.create.mockResolvedValue(undefined);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

// ─── tests ────────────────────────────────────────────────────────────────────

describe("PhaseTemplateLibraryPage — 空状態", () => {
  it("テンプレートなしでは空状態メッセージが表示される", async () => {
    render(<PhaseTemplateLibraryPage />);
    expect(screen.getByText("テンプレートがありません")).toBeDefined();
  });

  it("工程表ページへのリンクボタンが表示される", async () => {
    render(<PhaseTemplateLibraryPage />);
    const buttons = screen.getAllByRole("button");
    const goGanttBtn = buttons.find((b) => b.textContent?.includes("工程表"));
    expect(goGanttBtn).toBeDefined();
  });
});

describe("PhaseTemplateLibraryPage — 一覧表示", () => {
  it("保存済みテンプレートがカード表示される", async () => {
    savePhaseTemplate(makeTemplate({ name: "南青山リフォーム工程" }));
    render(<PhaseTemplateLibraryPage />);
    expect(screen.getByText("南青山リフォーム工程")).toBeDefined();
  });

  it("タグが表示される", async () => {
    savePhaseTemplate(makeTemplate({ tags: ["住宅", "店舗"] }));
    render(<PhaseTemplateLibraryPage />);
    expect(screen.getByText("住宅")).toBeDefined();
    expect(screen.getByText("店舗")).toBeDefined();
  });

  it("説明が表示される", async () => {
    savePhaseTemplate(makeTemplate({ description: "60m²以下の内装リフォーム向け" }));
    render(<PhaseTemplateLibraryPage />);
    expect(screen.getByText("60m²以下の内装リフォーム向け")).toBeDefined();
  });

  it("複数テンプレートが全て表示される", async () => {
    savePhaseTemplate(makeTemplate({ id: "t1", name: "テンプレA" }));
    savePhaseTemplate(makeTemplate({ id: "t2", name: "テンプレB" }));
    render(<PhaseTemplateLibraryPage />);
    expect(screen.getByText("テンプレA")).toBeDefined();
    expect(screen.getByText("テンプレB")).toBeDefined();
  });
});

describe("PhaseTemplateLibraryPage — プレビュー", () => {
  it("プレビューボタンを押すとモーダルが開く", async () => {
    const user = userEvent.setup();
    savePhaseTemplate(makeTemplate({ name: "住宅標準工程" }));
    render(<PhaseTemplateLibraryPage />);

    const previewBtn = screen.getByRole("button", { name: "プレビュー" });
    await user.click(previewBtn);

    expect(screen.getByRole("dialog")).toBeDefined();
    expect(screen.getByText("解体工事")).toBeDefined();
  });

  it("プレビューモーダルを閉じることができる", async () => {
    const user = userEvent.setup();
    savePhaseTemplate(makeTemplate());
    render(<PhaseTemplateLibraryPage />);

    await user.click(screen.getByRole("button", { name: "プレビュー" }));
    expect(screen.getByRole("dialog")).toBeDefined();

    await user.click(screen.getByRole("button", { name: "閉じる" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

describe("PhaseTemplateLibraryPage — 削除", () => {
  it("削除ボタンを押すとテンプレートが消える", async () => {
    const user = userEvent.setup();
    savePhaseTemplate(makeTemplate({ id: "del-tpl", name: "削除対象テンプレ" }));
    render(<PhaseTemplateLibraryPage />);

    expect(screen.getByText("削除対象テンプレ")).toBeDefined();

    const deleteBtn = screen.getByRole("button", { name: "削除対象テンプレを削除" });
    await user.click(deleteBtn);

    expect(screen.queryByText("削除対象テンプレ")).toBeNull();
    expect(listPhaseTemplates()).toHaveLength(0);
  });
});

describe("PhaseTemplateLibraryPage — 適用フロー", () => {
  it("適用ボタンを押すと案件選択モーダルが開く", async () => {
    const user = userEvent.setup();
    mockProjectRepository.findAll.mockResolvedValue([
      { id: "p1", name: "南青山案件", startDate: "2026-05-01" },
    ]);
    savePhaseTemplate(makeTemplate({ name: "適用テンプレ" }));
    render(<PhaseTemplateLibraryPage />);

    await user.click(screen.getByRole("button", { name: "適用" }));

    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeDefined();
    });
    const dialog = screen.getByRole("dialog");
    expect(dialog.textContent).toContain("適用テンプレ");
  });

  it("案件なしの場合は案件がない旨のメッセージが表示される", async () => {
    const user = userEvent.setup();
    mockProjectRepository.findAll.mockResolvedValue([]);
    savePhaseTemplate(makeTemplate());
    render(<PhaseTemplateLibraryPage />);

    await user.click(screen.getByRole("button", { name: "適用" }));

    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeDefined();
    });
    expect(screen.getByText(/案件がありません/)).toBeDefined();
  });

  it("適用モーダルはキャンセルで閉じる", async () => {
    const user = userEvent.setup();
    mockProjectRepository.findAll.mockResolvedValue([
      { id: "p1", name: "テスト案件", startDate: "2026-05-01" },
    ]);
    savePhaseTemplate(makeTemplate());
    render(<PhaseTemplateLibraryPage />);

    await user.click(screen.getByRole("button", { name: "適用" }));
    await waitFor(() => expect(screen.getByRole("dialog")).toBeDefined());

    await user.click(screen.getByRole("button", { name: "キャンセル" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
