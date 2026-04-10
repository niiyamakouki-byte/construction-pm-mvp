import { describe, it, expect, beforeEach } from "vitest";
import {
  clearSelectionStore,
  createSelectionItem,
  getSelectionItem,
  getSelectionItemsByProject,
  updateSelectionItem,
  deleteSelectionItem,
  setStatus,
  selectOption,
  approveSelection,
  selectionToEstimateItems,
} from "./selection-board.js";

const SAMPLE_OPTIONS = [
  { id: "opt-1", name: "オーク床材", description: "突板15mm", unitPrice: 12000 },
  { id: "opt-2", name: "タイル", description: "磁器質600角", unitPrice: 18000 },
];

beforeEach(() => {
  clearSelectionStore();
});

describe("createSelectionItem", () => {
  it("creates item with default status '選定中' and no selection", () => {
    const item = createSelectionItem({
      projectId: "proj-1",
      category: "床材",
      name: "リビング床",
      options: SAMPLE_OPTIONS,
    });
    expect(item.status).toBe("選定中");
    expect(item.selectedOptionId).toBeNull();
    expect(item.clientNote).toBe("");
    expect(item.projectId).toBe("proj-1");
  });
});

describe("getSelectionItemsByProject", () => {
  it("returns only items belonging to the project", () => {
    createSelectionItem({ projectId: "proj-1", category: "床材", name: "A", options: [] });
    createSelectionItem({ projectId: "proj-2", category: "壁材", name: "B", options: [] });
    createSelectionItem({ projectId: "proj-1", category: "壁材", name: "C", options: [] });
    const items = getSelectionItemsByProject("proj-1");
    expect(items).toHaveLength(2);
    expect(items.every((i) => i.projectId === "proj-1")).toBe(true);
  });
});

describe("updateSelectionItem", () => {
  it("patches fields on existing item", () => {
    const item = createSelectionItem({ projectId: "p", category: "照明", name: "X", options: [] });
    const updated = updateSelectionItem(item.id, { clientNote: "サンプル見せてください" });
    expect(updated.clientNote).toBe("サンプル見せてください");
  });

  it("throws when item not found", () => {
    expect(() => updateSelectionItem("nonexistent", { clientNote: "x" })).toThrow();
  });
});

describe("deleteSelectionItem", () => {
  it("removes item from store", () => {
    const item = createSelectionItem({ projectId: "p", category: "建具", name: "ドア", options: [] });
    deleteSelectionItem(item.id);
    expect(getSelectionItem(item.id)).toBeUndefined();
  });
});

describe("selectOption", () => {
  it("sets selectedOptionId and changes status to '施主確認待ち'", () => {
    const item = createSelectionItem({ projectId: "p", category: "床材", name: "床", options: SAMPLE_OPTIONS });
    const updated = selectOption(item.id, "opt-1");
    expect(updated.selectedOptionId).toBe("opt-1");
    expect(updated.status).toBe("施主確認待ち");
  });

  it("throws when option id is not in item's options", () => {
    const item = createSelectionItem({ projectId: "p", category: "床材", name: "床", options: SAMPLE_OPTIONS });
    expect(() => selectOption(item.id, "opt-nonexistent")).toThrow();
  });
});

describe("approveSelection", () => {
  it("sets status to '承認済'", () => {
    const item = createSelectionItem({ projectId: "p", category: "壁材", name: "壁", options: SAMPLE_OPTIONS });
    selectOption(item.id, "opt-1");
    const approved = approveSelection(item.id);
    expect(approved.status).toBe("承認済");
  });
});

describe("setStatus", () => {
  it("updates status to '変更依頼'", () => {
    const item = createSelectionItem({ projectId: "p", category: "天井材", name: "天井", options: [] });
    const updated = setStatus(item.id, "変更依頼");
    expect(updated.status).toBe("変更依頼");
  });
});

describe("selectionToEstimateItems", () => {
  it("converts approved items to EstimateItem[]", () => {
    const item = createSelectionItem({ projectId: "proj-est", category: "床材", name: "リビング床", options: SAMPLE_OPTIONS });
    selectOption(item.id, "opt-2");
    approveSelection(item.id);

    const estimates = selectionToEstimateItems("proj-est");
    expect(estimates).toHaveLength(1);
    expect(estimates[0].unitPrice).toBe(18000);
    expect(estimates[0].amount).toBe(18000);
    expect(estimates[0].name).toContain("床材");
  });

  it("excludes non-approved items", () => {
    const item = createSelectionItem({ projectId: "proj-x", category: "照明", name: "照明", options: SAMPLE_OPTIONS });
    selectOption(item.id, "opt-1");
    // status is '施主確認待ち', not approved
    const estimates = selectionToEstimateItems("proj-x");
    expect(estimates).toHaveLength(0);
  });

  it("returns empty array when project has no items", () => {
    expect(selectionToEstimateItems("nonexistent-project")).toHaveLength(0);
  });
});
