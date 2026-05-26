/**
 * 工程テンプレートライブラリ — storage CRUD テスト
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  listPhaseTemplates,
  getPhaseTemplate,
  savePhaseTemplate,
  deletePhaseTemplate,
} from "./storage.js";
import type { PhaseTemplate } from "./types.js";

const STORAGE_KEY = "genbahub:phase-templates";

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

function makeTemplate(overrides: Partial<PhaseTemplate> = {}): PhaseTemplate {
  return {
    id: "tpl-001",
    name: "標準住宅テンプレート",
    description: "一般的な住宅リフォーム工程",
    tags: ["住宅"],
    phases: [
      {
        id: "wbs-cat-解体工事",
        name: "解体工事",
        defaultDays: 5,
        groups: [
          {
            id: "wbs-grp-解体工事-01",
            categoryId: "wbs-cat-解体工事",
            name: "内装解体",
            defaultDays: 3,
            tasks: [
              {
                id: "wbs-task-解体工事-01-01",
                groupId: "wbs-grp-解体工事-01",
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

beforeEach(() => {
  Object.keys(mockStorage).forEach((k) => {
    delete mockStorage[k];
  });
  vi.clearAllMocks();
  vi.stubGlobal("localStorage", localStorageMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("listPhaseTemplates", () => {
  it("初期状態では空配列を返す", () => {
    expect(listPhaseTemplates()).toHaveLength(0);
  });

  it("保存済みテンプレートを返す", () => {
    savePhaseTemplate(makeTemplate());
    expect(listPhaseTemplates()).toHaveLength(1);
  });

  it("createdAt 降順でソートされる", () => {
    savePhaseTemplate(makeTemplate({ id: "a", createdAt: "2026-05-01T00:00:00.000Z" }));
    savePhaseTemplate(makeTemplate({ id: "b", createdAt: "2026-05-03T00:00:00.000Z" }));
    savePhaseTemplate(makeTemplate({ id: "c", createdAt: "2026-05-02T00:00:00.000Z" }));
    const list = listPhaseTemplates();
    expect(list[0].id).toBe("b");
    expect(list[1].id).toBe("c");
    expect(list[2].id).toBe("a");
  });

  it("壊れた JSON でも空配列を返す", () => {
    localStorage.setItem(STORAGE_KEY, "INVALID{{");
    expect(listPhaseTemplates()).toHaveLength(0);
  });
});

describe("getPhaseTemplate", () => {
  it("存在するIDで取得できる", () => {
    savePhaseTemplate(makeTemplate({ id: "find-me" }));
    const result = getPhaseTemplate("find-me");
    expect(result).toBeDefined();
    expect(result?.id).toBe("find-me");
  });

  it("存在しないIDで undefined を返す", () => {
    expect(getPhaseTemplate("not-exist")).toBeUndefined();
  });
});

describe("savePhaseTemplate", () => {
  it("新規テンプレートを保存できる", () => {
    savePhaseTemplate(makeTemplate({ id: "new-tpl" }));
    expect(listPhaseTemplates()).toHaveLength(1);
    expect(listPhaseTemplates()[0].id).toBe("new-tpl");
  });

  it("同じIDで上書き保存できる", () => {
    savePhaseTemplate(makeTemplate({ id: "tpl-x", name: "旧名" }));
    savePhaseTemplate(makeTemplate({ id: "tpl-x", name: "新名" }));
    expect(listPhaseTemplates()).toHaveLength(1);
    expect(listPhaseTemplates()[0].name).toBe("新名");
  });

  it("複数テンプレートを保存できる", () => {
    savePhaseTemplate(makeTemplate({ id: "t1", name: "テンプレ1" }));
    savePhaseTemplate(makeTemplate({ id: "t2", name: "テンプレ2" }));
    expect(listPhaseTemplates()).toHaveLength(2);
  });

  it("localStorage に正しいキーで保存される", () => {
    savePhaseTemplate(makeTemplate({ id: "key-check" }));
    const raw = localStorage.getItem(STORAGE_KEY);
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw!) as PhaseTemplate[];
    expect(parsed[0].id).toBe("key-check");
  });
});

describe("deletePhaseTemplate", () => {
  it("指定IDを削除できる", () => {
    savePhaseTemplate(makeTemplate({ id: "del-me" }));
    deletePhaseTemplate("del-me");
    expect(listPhaseTemplates()).toHaveLength(0);
  });

  it("他のテンプレートには影響しない", () => {
    savePhaseTemplate(makeTemplate({ id: "keep" }));
    savePhaseTemplate(makeTemplate({ id: "del" }));
    deletePhaseTemplate("del");
    const remaining = listPhaseTemplates();
    expect(remaining).toHaveLength(1);
    expect(remaining[0].id).toBe("keep");
  });

  it("存在しないIDの削除はエラーにならない", () => {
    expect(() => deletePhaseTemplate("ghost")).not.toThrow();
  });
});
