import { beforeEach, describe, expect, it } from "vitest";
import {
  CloseoutItemCategory,
  _resetCloseoutStore,
  completeCloseoutItem,
  createCloseoutChecklist,
  getCloseoutChecklist,
  getCloseoutProgress,
  getOutstandingCloseoutItems,
  isProjectCloseoutComplete,
} from "./closeout-checklist.js";

beforeEach(() => {
  _resetCloseoutStore();
});

describe("closeout-checklist", () => {
  it("creates a default closeout checklist", () => {
    const checklist = createCloseoutChecklist("proj-1", "2025-04-01T00:00:00.000Z");

    expect(checklist.items).toHaveLength(4);
    expect(checklist.items.map((item) => item.category)).toEqual([
      CloseoutItemCategory.finalInspection,
      CloseoutItemCategory.asBuiltDocs,
      CloseoutItemCategory.warrantyHandover,
      CloseoutItemCategory.clientSignOff,
    ]);
  });

  it("returns an existing checklist when created twice", () => {
    const first = createCloseoutChecklist("proj-1");
    const second = createCloseoutChecklist("proj-1");

    expect(second.id).toBe(first.id);
  });

  it("completes individual checklist items", () => {
    createCloseoutChecklist("proj-1");

    const item = completeCloseoutItem(
      "proj-1",
      CloseoutItemCategory.asBuiltDocs,
      "Architect",
      "2025-04-15",
      "Issued final PDF set.",
    );

    expect(item?.completed).toBe(true);
    expect(item?.completedBy).toBe("Architect");
    expect(getCloseoutChecklist("proj-1")?.items.find((entry) => entry.category === CloseoutItemCategory.asBuiltDocs)?.completed).toBe(true);
  });

  it("returns outstanding items", () => {
    createCloseoutChecklist("proj-1");
    completeCloseoutItem(
      "proj-1",
      CloseoutItemCategory.finalInspection,
      "Inspector",
      "2025-04-18",
    );

    expect(getOutstandingCloseoutItems("proj-1")).toHaveLength(3);
  });

  it("tracks closeout progress and missing required gates", () => {
    createCloseoutChecklist("proj-1");
    completeCloseoutItem(
      "proj-1",
      CloseoutItemCategory.finalInspection,
      "Inspector",
      "2025-04-18",
    );
    completeCloseoutItem(
      "proj-1",
      CloseoutItemCategory.asBuiltDocs,
      "Architect",
      "2025-04-19",
    );

    const progress = getCloseoutProgress("proj-1");

    expect(progress?.completedItems).toBe(2);
    expect(progress?.percentage).toBe(50);
    expect(progress?.readyForCloseout).toBe(false);
    expect(progress?.missingRequiredItems.map((item) => item.category)).toEqual([
      CloseoutItemCategory.warrantyHandover,
      CloseoutItemCategory.clientSignOff,
    ]);
  });

  it("marks project closeout complete only after all required items finish", () => {
    createCloseoutChecklist("proj-1");

    for (const category of Object.values(CloseoutItemCategory)) {
      completeCloseoutItem("proj-1", category, "PM", "2025-04-20");
    }

    expect(isProjectCloseoutComplete("proj-1")).toBe(true);
    expect(getCloseoutProgress("proj-1")?.percentage).toBe(100);
  });

  it("returns null progress for unknown projects", () => {
    expect(getCloseoutProgress("missing")).toBeNull();
    expect(isProjectCloseoutComplete("missing")).toBe(false);
  });
});
