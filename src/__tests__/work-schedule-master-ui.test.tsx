/**
 * Sprint 8-A: 工程表3階層マスター → GanttPage UI 接続テスト
 *
 * テスト分類:
 * 1. マスタAPI (getMasterCategories / getMasterEntries)
 * 2. プリセット選択履歴永続化 (gantt-master-preset)
 * 3. 既存 buildWBSTree / expandWBSToPhases 回帰テスト
 */

import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { getMasterCategories, getMasterEntries } from "../lib/work-schedule-master.js";
import { readMasterPresetHistory, writeMasterPresetHistory } from "../lib/gantt-master-preset.js";
import { buildWBSTree, expandWBSToPhases } from "../lib/work-breakdown/expansion.js";

const TEST_PROJECT_ID = "00000000-0000-0000-0000-000000000099";
const START_DATE = "2026-04-07"; // 月曜

// ─────────────────────────────────────────────────────────────────────────────
// 1. getMasterCategories
// ─────────────────────────────────────────────────────────────────────────────

describe("getMasterCategories", () => {
  it("13大項目を返す", () => {
    const cats = getMasterCategories();
    expect(cats).toHaveLength(13);
  });

  it("各大項目に id / name / groups が存在する", () => {
    for (const cat of getMasterCategories()) {
      expect(cat.id).toBeTruthy();
      expect(cat.name).toBeTruthy();
      expect(Array.isArray(cat.groups)).toBe(true);
      expect(cat.groups.length).toBeGreaterThan(0);
    }
  });

  it("大項目 ID が重複しない", () => {
    const ids = getMasterCategories().map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("期待する大項目名が含まれる", () => {
    const names = getMasterCategories().map((c) => c.name);
    expect(names).toContain("仮設工事");
    expect(names).toContain("電気工事");
    expect(names).toContain("検査");
    expect(names).toContain("クリーニング");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. getMasterEntries
// ─────────────────────────────────────────────────────────────────────────────

describe("getMasterEntries", () => {
  it("存在しない categoryId では空配列を返す", () => {
    expect(getMasterEntries("non-existent-id")).toHaveLength(0);
  });

  it("電気工事のエントリが1件以上返る", () => {
    const cats = getMasterCategories();
    const elec = cats.find((c) => c.name === "電気工事");
    expect(elec).toBeDefined();
    const entries = getMasterEntries(elec!.id);
    expect(entries.length).toBeGreaterThan(0);
  });

  it("各エントリに id / name / defaultDays が存在する", () => {
    const cats = getMasterCategories();
    for (const cat of cats) {
      const entries = getMasterEntries(cat.id);
      for (const entry of entries) {
        expect(entry.id).toBeTruthy();
        expect(entry.name).toBeTruthy();
        expect(entry.defaultDays).toBeGreaterThan(0);
      }
    }
  });

  it("小項目がない大項目は中項目がエントリになる (仮設工事)", () => {
    const cats = getMasterCategories();
    const kari = cats.find((c) => c.name === "仮設工事");
    expect(kari).toBeDefined();
    const entries = getMasterEntries(kari!.id);
    // 仮設工事の中項目: 仮囲い, 足場, 養生, 仮設電気, 仮設水道, 仮設トイレ
    // 小項目があるもの(足場, 養生)は小項目がエントリになる
    expect(entries.length).toBeGreaterThan(0);
  });

  it("全大項目のエントリ合計が103件以上", () => {
    const cats = getMasterCategories();
    const total = cats.reduce((sum, cat) => sum + getMasterEntries(cat.id).length, 0);
    expect(total).toBeGreaterThanOrEqual(103);
  });

  it("エントリ ID が各大項目内で重複しない", () => {
    for (const cat of getMasterCategories()) {
      const ids = getMasterEntries(cat.id).map((e) => e.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. gantt-master-preset localStorage 永続化
// ─────────────────────────────────────────────────────────────────────────────

describe("gantt-master-preset", () => {
  const STORAGE_KEY = "genbahub:gantt-master-preset";

  const mockStorage: Record<string, string> = {};
  const localStorageMock = {
    getItem: vi.fn((key: string) => mockStorage[key] ?? null),
    setItem: vi.fn((key: string, val: string) => { mockStorage[key] = val; }),
    removeItem: vi.fn((key: string) => { delete mockStorage[key]; }),
    get length() { return Object.keys(mockStorage).length; },
    key: vi.fn((i: number) => Object.keys(mockStorage)[i] ?? null),
  };

  beforeEach(() => {
    Object.keys(mockStorage).forEach((k) => { delete mockStorage[k]; });
    vi.clearAllMocks();
    vi.stubGlobal("localStorage", localStorageMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("初期状態では lastCategoryId が null", () => {
    const history = readMasterPresetHistory();
    expect(history.lastCategoryId).toBeNull();
  });

  it("writeMasterPresetHistory → readMasterPresetHistory でラウンドトリップする", () => {
    writeMasterPresetHistory({ lastCategoryId: "wbs-cat-電気工事" });
    const history = readMasterPresetHistory();
    expect(history.lastCategoryId).toBe("wbs-cat-電気工事");
  });

  it("localStorage に正しいキーで保存される", () => {
    writeMasterPresetHistory({ lastCategoryId: "wbs-cat-検査" });
    const raw = localStorage.getItem(STORAGE_KEY);
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw!) as { lastCategoryId: string };
    expect(parsed.lastCategoryId).toBe("wbs-cat-検査");
  });

  it("壊れた JSON でも readMasterPresetHistory がデフォルト値を返す", () => {
    localStorage.setItem(STORAGE_KEY, "INVALID_JSON{{{");
    const history = readMasterPresetHistory();
    expect(history.lastCategoryId).toBeNull();
  });

  it("null を上書きして履歴をクリアできる", () => {
    writeMasterPresetHistory({ lastCategoryId: "wbs-cat-解体工事" });
    writeMasterPresetHistory({ lastCategoryId: null });
    const history = readMasterPresetHistory();
    expect(history.lastCategoryId).toBeNull();
  });

  it("上書きで最新のカテゴリIDが保持される", () => {
    writeMasterPresetHistory({ lastCategoryId: "wbs-cat-仮設工事" });
    writeMasterPresetHistory({ lastCategoryId: "wbs-cat-塗装工事" });
    const history = readMasterPresetHistory();
    expect(history.lastCategoryId).toBe("wbs-cat-塗装工事");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. 既存 buildWBSTree / expandWBSToPhases 回帰テスト
// ─────────────────────────────────────────────────────────────────────────────

describe("回帰: buildWBSTree", () => {
  it("13大項目が維持されている", () => {
    expect(buildWBSTree()).toHaveLength(13);
  });

  it("大項目IDが重複しない (既存挙動維持)", () => {
    const ids = buildWBSTree().map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("回帰: expandWBSToPhases", () => {
  it("全大項目展開で50件以上のタスクが生成される", () => {
    const tasks = expandWBSToPhases({
      projectId: TEST_PROJECT_ID,
      projectStartDate: START_DATE,
    });
    expect(tasks.length).toBeGreaterThan(50);
  });

  it("selectedMajors で電気工事のみ絞り込んでも majorCategory が電気工事", () => {
    const tasks = expandWBSToPhases({
      projectId: TEST_PROJECT_ID,
      projectStartDate: START_DATE,
      selectedMajors: new Set(["電気工事"]),
    });
    for (const task of tasks) {
      expect(task.majorCategory).toBe("電気工事");
    }
  });

  it("タスク日付順序が維持されている (前タスクdueDate <= 次タスクstartDate)", () => {
    const tasks = expandWBSToPhases({
      projectId: TEST_PROJECT_ID,
      projectStartDate: START_DATE,
      selectedMajors: new Set(["解体工事"]),
    });
    for (let i = 1; i < tasks.length; i++) {
      expect(tasks[i - 1].dueDate! <= tasks[i].startDate!).toBe(true);
    }
  });

  it("全タスクに projectId が付与される (既存挙動維持)", () => {
    const tasks = expandWBSToPhases({
      projectId: TEST_PROJECT_ID,
      projectStartDate: START_DATE,
      selectedMajors: new Set(["クリーニング"]),
    });
    for (const task of tasks) {
      expect(task.projectId).toBe(TEST_PROJECT_ID);
    }
  });

  it("includeWeekends=false でも正常に展開される", () => {
    const tasks = expandWBSToPhases({
      projectId: TEST_PROJECT_ID,
      projectStartDate: START_DATE,
      selectedMajors: new Set(["給排水工事"]),
      includeWeekends: false,
    });
    expect(tasks.length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. getMasterCategories と getMasterEntries の一貫性
// ─────────────────────────────────────────────────────────────────────────────

describe("getMasterCategories と getMasterEntries の一貫性", () => {
  it("getMasterCategories の各 id で getMasterEntries を呼べる", () => {
    for (const cat of getMasterCategories()) {
      const entries = getMasterEntries(cat.id);
      expect(Array.isArray(entries)).toBe(true);
    }
  });

  it("getMasterEntries の categoryId が対応する大項目 id と一致する", () => {
    for (const cat of getMasterCategories()) {
      const entries = getMasterEntries(cat.id);
      for (const entry of entries) {
        expect(entry.categoryId).toBe(cat.id);
      }
    }
  });

  it("全エントリの defaultDays が正の整数", () => {
    for (const cat of getMasterCategories()) {
      for (const entry of getMasterEntries(cat.id)) {
        expect(Number.isInteger(entry.defaultDays)).toBe(true);
        expect(entry.defaultDays).toBeGreaterThan(0);
      }
    }
  });

  it("検査の entries に竣工引渡しが含まれる", () => {
    const cats = getMasterCategories();
    const insp = cats.find((c) => c.name === "検査");
    expect(insp).toBeDefined();
    const entries = getMasterEntries(insp!.id);
    const names = entries.map((e) => e.name);
    // 竣工引渡し = 小項目: 書類一式作成, 鍵引渡し
    const hasHandover = names.some((n) => n.includes("引渡") || n.includes("書類"));
    expect(hasHandover).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. getMasterEntries と expandWBSToPhases の整合性
// ─────────────────────────────────────────────────────────────────────────────

describe("getMasterEntries と expandWBSToPhases の整合性", () => {
  it("電気工事のエントリ名が expandWBSToPhases で生成されるタスク名と重複を含む", () => {
    const cats = getMasterCategories();
    const elec = cats.find((c) => c.name === "電気工事")!;
    const entryNames = getMasterEntries(elec.id).map((e) => e.name);

    const expandedTasks = expandWBSToPhases({
      projectId: TEST_PROJECT_ID,
      projectStartDate: START_DATE,
      selectedMajors: new Set(["電気工事"]),
    });
    const taskNames = expandedTasks.map((t) => t.name);

    // 少なくとも1件はマスタエントリと展開タスクで名前が共通
    const overlap = entryNames.filter((n) => taskNames.includes(n));
    expect(overlap.length).toBeGreaterThan(0);
  });
});
