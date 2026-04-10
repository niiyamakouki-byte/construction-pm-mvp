import { describe, expect, it } from "vitest";
import {
  ProjectStage,
  STAGE_ORDER,
  getStageLabel,
  getStageDescription,
  getDefaultChecklist,
  getStageIndex,
  calculateStageCompletion,
  canAdvanceStage,
  calculateOverallProgress,
  createInitialStageProgresses,
} from "./project-flow.js";

describe("project-flow", () => {
  describe("STAGE_ORDER", () => {
    it("has 9 stages", () => {
      expect(STAGE_ORDER).toHaveLength(9);
    });

    it("starts with inquiry and ends with completed", () => {
      expect(STAGE_ORDER[0]).toBe(ProjectStage.inquiry);
      expect(STAGE_ORDER[8]).toBe(ProjectStage.completed);
    });

    it("contains all 9 expected stages in order", () => {
      const expected = [
        "inquiry", "siteVisit", "specification", "productSelect",
        "drawing", "pricing", "contract", "construction", "completed",
      ];
      expect(STAGE_ORDER).toEqual(expected);
    });
  });

  describe("getStageLabel", () => {
    it("returns Japanese labels", () => {
      expect(getStageLabel(ProjectStage.inquiry)).toBe("依頼");
      expect(getStageLabel(ProjectStage.siteVisit)).toBe("現調");
      expect(getStageLabel(ProjectStage.specification)).toBe("仕様確認");
      expect(getStageLabel(ProjectStage.productSelect)).toBe("品番選定");
      expect(getStageLabel(ProjectStage.drawing)).toBe("図面作成");
      expect(getStageLabel(ProjectStage.pricing)).toBe("金額確定");
      expect(getStageLabel(ProjectStage.contract)).toBe("契約");
      expect(getStageLabel(ProjectStage.construction)).toBe("着工");
      expect(getStageLabel(ProjectStage.completed)).toBe("完工");
    });
  });

  describe("getStageDescription", () => {
    it("returns non-empty description for each stage", () => {
      for (const stage of STAGE_ORDER) {
        expect(getStageDescription(stage).length).toBeGreaterThan(0);
      }
    });
  });

  describe("getDefaultChecklist", () => {
    it("returns checklist items for each stage", () => {
      for (const stage of STAGE_ORDER) {
        const checklist = getDefaultChecklist(stage);
        expect(checklist.length).toBeGreaterThan(0);
      }
    });

    it("all items start as not completed", () => {
      for (const stage of STAGE_ORDER) {
        const checklist = getDefaultChecklist(stage);
        expect(checklist.every((item) => !item.completed)).toBe(true);
      }
    });

    it("inquiry has required items", () => {
      const checklist = getDefaultChecklist(ProjectStage.inquiry);
      expect(checklist.some((item) => item.required)).toBe(true);
    });

    it("returns independent copies (no shared reference)", () => {
      const a = getDefaultChecklist(ProjectStage.inquiry);
      const b = getDefaultChecklist(ProjectStage.inquiry);
      a[0].completed = true;
      expect(b[0].completed).toBe(false);
    });
  });

  describe("getStageIndex", () => {
    it("returns correct index for each stage", () => {
      expect(getStageIndex(ProjectStage.inquiry)).toBe(0);
      expect(getStageIndex(ProjectStage.completed)).toBe(8);
      expect(getStageIndex(ProjectStage.contract)).toBe(6);
    });
  });

  describe("calculateStageCompletion", () => {
    it("returns 0 for all incomplete items", () => {
      const checklist = getDefaultChecklist(ProjectStage.inquiry);
      expect(calculateStageCompletion(checklist)).toBe(0);
    });

    it("returns 1 for all completed items", () => {
      const checklist = getDefaultChecklist(ProjectStage.inquiry).map((item) => ({
        ...item,
        completed: true,
      }));
      expect(calculateStageCompletion(checklist)).toBe(1);
    });

    it("calculates partial completion correctly", () => {
      const checklist = [
        { id: "a", label: "A", required: true, completed: true },
        { id: "b", label: "B", required: true, completed: false },
        { id: "c", label: "C", required: false, completed: false },
        { id: "d", label: "D", required: false, completed: false },
      ];
      expect(calculateStageCompletion(checklist)).toBe(0.25);
    });

    it("returns 0 for empty checklist", () => {
      expect(calculateStageCompletion([])).toBe(0);
    });
  });

  describe("canAdvanceStage", () => {
    it("returns false when required items are incomplete", () => {
      const checklist = getDefaultChecklist(ProjectStage.inquiry);
      expect(canAdvanceStage(checklist)).toBe(false);
    });

    it("returns true when all required items are completed", () => {
      const checklist = getDefaultChecklist(ProjectStage.inquiry).map((item) => ({
        ...item,
        completed: item.required ? true : item.completed,
      }));
      expect(canAdvanceStage(checklist)).toBe(true);
    });

    it("returns true when there are no required items", () => {
      const checklist = [
        { id: "a", label: "A", required: false, completed: false },
      ];
      expect(canAdvanceStage(checklist)).toBe(true);
    });
  });

  describe("calculateOverallProgress", () => {
    it("returns 0 when no stages are completed", () => {
      const progresses = createInitialStageProgresses();
      expect(calculateOverallProgress(progresses)).toBe(0);
    });

    it("returns 1/9 when first stage is completed", () => {
      const progresses = createInitialStageProgresses();
      progresses[0].status = "completed";
      expect(calculateOverallProgress(progresses)).toBeCloseTo(1 / 9);
    });

    it("returns 1 when all stages are completed", () => {
      const progresses = createInitialStageProgresses().map((p) => ({
        ...p,
        status: "completed" as const,
      }));
      expect(calculateOverallProgress(progresses)).toBe(1);
    });
  });

  describe("createInitialStageProgresses", () => {
    it("returns 9 stage progresses", () => {
      const progresses = createInitialStageProgresses();
      expect(progresses).toHaveLength(9);
    });

    it("first stage is inProgress", () => {
      const progresses = createInitialStageProgresses();
      expect(progresses[0].status).toBe("inProgress");
    });

    it("all other stages are notStarted", () => {
      const progresses = createInitialStageProgresses();
      for (const p of progresses.slice(1)) {
        expect(p.status).toBe("notStarted");
      }
    });

    it("each stage has its default checklist", () => {
      const progresses = createInitialStageProgresses();
      for (const p of progresses) {
        expect(p.checklist.length).toBeGreaterThan(0);
      }
    });
  });
});
