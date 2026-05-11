/**
 * phase-template-master.test.ts — Sprint 70
 * applyPhaseTemplate のユニットテスト (空配列/全選択/部分選択)
 */

import { describe, it, expect } from "vitest";
import {
  applyPhaseTemplate,
  getTemplateMajorNames,
  getTemplateIdsByMajor,
} from "./phase-template-master.js";
import { TASK_CATEGORIES } from "./task-categories.js";

const PROJECT_ID = "test-project-id";
const START_DATE = "2026-06-01";

// ─────────────────────────────────────────────────────────────────────────────
// applyPhaseTemplate
// ─────────────────────────────────────────────────────────────────────────────

describe("applyPhaseTemplate", () => {
  it("空配列を渡すと空配列を返す", () => {
    const result = applyPhaseTemplate([], { projectId: PROJECT_ID, startDate: START_DATE });
    expect(result).toHaveLength(0);
  });

  it("存在しないIDだけを渡すと空配列を返す", () => {
    const result = applyPhaseTemplate(["does-not-exist"], { projectId: PROJECT_ID, startDate: START_DATE });
    expect(result).toHaveLength(0);
  });

  it("全選択: 大項目13件が生成される", () => {
    const allIds = TASK_CATEGORIES.map((c) => c.id);
    const result = applyPhaseTemplate(allIds, { projectId: PROJECT_ID, startDate: START_DATE });
    const level1 = result.filter((p) => p.level === 1);
    expect(level1).toHaveLength(13);
  });

  it("全選択: projectId が全フェーズに設定される", () => {
    const allIds = TASK_CATEGORIES.map((c) => c.id);
    const result = applyPhaseTemplate(allIds, { projectId: PROJECT_ID, startDate: START_DATE });
    for (const phase of result) {
      expect(phase.projectId).toBe(PROJECT_ID);
    }
  });

  it("全選択: level 1/2/3 が全て存在する", () => {
    const allIds = TASK_CATEGORIES.map((c) => c.id);
    const result = applyPhaseTemplate(allIds, { projectId: PROJECT_ID, startDate: START_DATE });
    expect(result.some((p) => p.level === 1)).toBe(true);
    expect(result.some((p) => p.level === 2)).toBe(true);
    expect(result.some((p) => p.level === 3)).toBe(true);
  });

  it("全選択: 大項目ノードの parentId は null", () => {
    const allIds = TASK_CATEGORIES.map((c) => c.id);
    const result = applyPhaseTemplate(allIds, { projectId: PROJECT_ID, startDate: START_DATE });
    const level1 = result.filter((p) => p.level === 1);
    for (const phase of level1) {
      expect(phase.parentId).toBeNull();
    }
  });

  it("全選択: 中項目ノードの parentId は大項目ノードの id を指す", () => {
    const allIds = TASK_CATEGORIES.map((c) => c.id);
    const result = applyPhaseTemplate(allIds, { projectId: PROJECT_ID, startDate: START_DATE });
    const ids = new Set(result.map((p) => p.id));
    const level2 = result.filter((p) => p.level === 2);
    for (const phase of level2) {
      expect(phase.parentId).not.toBeNull();
      expect(ids.has(phase.parentId!)).toBe(true);
    }
  });

  it("部分選択: 仮設工事のIDだけ選ぶと仮設工事大項目のみ生成される", () => {
    const tempIds = TASK_CATEGORIES.filter((c) => c.major === "仮設工事").map((c) => c.id);
    const result = applyPhaseTemplate(tempIds, { projectId: PROJECT_ID, startDate: START_DATE });
    const level1 = result.filter((p) => p.level === 1);
    expect(level1).toHaveLength(1);
    expect(level1[0].name).toBe("仮設工事");
  });

  it("部分選択: 仮設工事+解体工事を選ぶと大項目が2件", () => {
    const ids = TASK_CATEGORIES
      .filter((c) => c.major === "仮設工事" || c.major === "解体工事")
      .map((c) => c.id);
    const result = applyPhaseTemplate(ids, { projectId: PROJECT_ID, startDate: START_DATE });
    const level1Names = result.filter((p) => p.level === 1).map((p) => p.name);
    expect(level1Names).toContain("仮設工事");
    expect(level1Names).toContain("解体工事");
    expect(level1Names).toHaveLength(2);
  });

  it("全フェーズの status は 'planned'", () => {
    const allIds = TASK_CATEGORIES.map((c) => c.id);
    const result = applyPhaseTemplate(allIds, { projectId: PROJECT_ID, startDate: START_DATE });
    for (const phase of result) {
      expect(phase.status).toBe("planned");
    }
  });

  it("startDate が全フェーズに設定される", () => {
    const allIds = TASK_CATEGORIES.map((c) => c.id);
    const result = applyPhaseTemplate(allIds, { projectId: PROJECT_ID, startDate: START_DATE });
    for (const phase of result) {
      expect(phase.startDate).toBe(START_DATE);
    }
  });

  it("organizationId を渡すと全フェーズに反映される", () => {
    const ids = TASK_CATEGORIES.filter((c) => c.major === "電気工事").map((c) => c.id);
    const result = applyPhaseTemplate(ids, {
      projectId: PROJECT_ID,
      organizationId: "org-abc",
      startDate: START_DATE,
    });
    for (const phase of result) {
      expect(phase.organizationId).toBe("org-abc");
    }
  });

  it("ID の重複がない", () => {
    const allIds = TASK_CATEGORIES.map((c) => c.id);
    const result = applyPhaseTemplate(allIds, { projectId: PROJECT_ID, startDate: START_DATE });
    const ids = result.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// getTemplateMajorNames
// ─────────────────────────────────────────────────────────────────────────────

describe("getTemplateMajorNames", () => {
  it("13大項目名を返す", () => {
    const names = getTemplateMajorNames();
    expect(names).toHaveLength(13);
  });

  it("重複なし", () => {
    const names = getTemplateMajorNames();
    expect(new Set(names).size).toBe(names.length);
  });

  it("仮設工事・電気工事・検査を含む", () => {
    const names = getTemplateMajorNames();
    expect(names).toContain("仮設工事");
    expect(names).toContain("電気工事");
    expect(names).toContain("検査");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// getTemplateIdsByMajor
// ─────────────────────────────────────────────────────────────────────────────

describe("getTemplateIdsByMajor", () => {
  it("存在しない大項目は空配列", () => {
    expect(getTemplateIdsByMajor("存在しない")).toHaveLength(0);
  });

  it("仮設工事のIDが8件", () => {
    const ids = getTemplateIdsByMajor("仮設工事");
    expect(ids).toHaveLength(8);
  });

  it("返す ID は TASK_CATEGORIES 内に存在する", () => {
    const allCatIds = new Set(TASK_CATEGORIES.map((c) => c.id));
    const ids = getTemplateIdsByMajor("電気工事");
    for (const id of ids) {
      expect(allCatIds.has(id)).toBe(true);
    }
  });
});
