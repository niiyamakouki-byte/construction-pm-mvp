import { describe, expect, it } from "vitest";
import {
  createDefaultChecklist,
  evaluateChecklist,
  generateInspectionReport,
  type InspectionChecklist,
  type ChecklistItem,
} from "./safety-inspection.js";

function makeChecklist(overrides?: Partial<InspectionChecklist>): InspectionChecklist {
  return {
    id: "insp-1",
    projectId: "proj-1",
    items: [],
    inspectedBy: "Tanaka",
    date: "2025-06-15",
    result: "pending",
    ...overrides,
  };
}

function makeItem(overrides?: Partial<ChecklistItem>): ChecklistItem {
  return {
    category: "ppe",
    description: "Hard hats worn",
    status: "pass",
    notes: "",
    ...overrides,
  };
}

describe("safety-inspection", () => {
  describe("createDefaultChecklist", () => {
    it("creates a general checklist with items", () => {
      const checklist = createDefaultChecklist("general");
      expect(checklist.items.length).toBeGreaterThan(0);
      expect(checklist.result).toBe("pending");
    });

    it("creates a renovation checklist with hazmat items", () => {
      const checklist = createDefaultChecklist("renovation");
      const hazmat = checklist.items.filter((i) => i.category === "hazmat");
      expect(hazmat.length).toBeGreaterThan(0);
    });

    it("creates a demolition checklist with excavation items", () => {
      const checklist = createDefaultChecklist("demolition");
      const excavation = checklist.items.filter((i) => i.category === "excavation");
      expect(excavation.length).toBeGreaterThan(0);
    });

    it("creates a high-rise checklist with scaffolding and crane items", () => {
      const checklist = createDefaultChecklist("high-rise");
      const scaffolding = checklist.items.filter((i) => i.category === "scaffolding");
      const crane = checklist.items.filter((i) => i.category === "crane-operations");
      expect(scaffolding.length).toBeGreaterThan(0);
      expect(crane.length).toBeGreaterThan(0);
    });

    it("defaults to general when no type specified", () => {
      const checklist = createDefaultChecklist();
      const general = createDefaultChecklist("general");
      expect(checklist.items.length).toBe(general.items.length);
    });

    it("items are independent copies (not shared references)", () => {
      const a = createDefaultChecklist("general");
      const b = createDefaultChecklist("general");
      a.items[0].notes = "modified";
      expect(b.items[0].notes).toBe("");
    });
  });

  describe("evaluateChecklist", () => {
    it("computes pass rate correctly", () => {
      const checklist = makeChecklist({
        items: [
          makeItem({ status: "pass" }),
          makeItem({ status: "pass" }),
          makeItem({ status: "fail" }),
          makeItem({ status: "pass" }),
        ],
      });
      const result = evaluateChecklist(checklist);
      expect(result.totalItems).toBe(4);
      expect(result.passCount).toBe(3);
      expect(result.failCount).toBe(1);
      expect(result.passRate).toBeCloseTo(0.75);
    });

    it("excludes N/A items from pass rate calculation", () => {
      const checklist = makeChecklist({
        items: [
          makeItem({ status: "pass" }),
          makeItem({ status: "na" }),
          makeItem({ status: "na" }),
        ],
      });
      const result = evaluateChecklist(checklist);
      expect(result.naCount).toBe(2);
      // 1 pass out of 1 graded item = 100%
      expect(result.passRate).toBeCloseTo(1.0);
    });

    it("identifies critical failures in safety-critical categories", () => {
      const checklist = makeChecklist({
        items: [
          makeItem({ category: "fall-protection", status: "fail", description: "No guardrails" }),
          makeItem({ category: "electrical", status: "fail", description: "No GFCI" }),
          makeItem({ category: "housekeeping", status: "fail", description: "Messy area" }),
        ],
      });
      const result = evaluateChecklist(checklist);
      expect(result.criticalFailures).toHaveLength(2);
      expect(result.criticalFailures.map((f) => f.category)).toContain("fall-protection");
      expect(result.criticalFailures.map((f) => f.category)).toContain("electrical");
    });

    it("returns empty critical failures when all pass", () => {
      const checklist = makeChecklist({
        items: [
          makeItem({ category: "fall-protection", status: "pass" }),
          makeItem({ category: "electrical", status: "pass" }),
        ],
      });
      const result = evaluateChecklist(checklist);
      expect(result.criticalFailures).toHaveLength(0);
    });

    it("handles empty checklist", () => {
      const checklist = makeChecklist({ items: [] });
      const result = evaluateChecklist(checklist);
      expect(result.totalItems).toBe(0);
      expect(result.passRate).toBe(1);
      expect(result.criticalFailures).toHaveLength(0);
    });

    it("handles all-NA checklist", () => {
      const checklist = makeChecklist({
        items: [makeItem({ status: "na" }), makeItem({ status: "na" })],
      });
      const result = evaluateChecklist(checklist);
      expect(result.passRate).toBe(1);
    });
  });

  describe("generateInspectionReport", () => {
    it("returns valid HTML with doctype", () => {
      const checklist = makeChecklist({
        items: [makeItem({ status: "pass" })],
      });
      const html = generateInspectionReport(checklist);
      expect(html).toContain("<!DOCTYPE html>");
      expect(html).toContain("</html>");
    });

    it("includes project and inspector info", () => {
      const checklist = makeChecklist({
        projectId: "proj-42",
        inspectedBy: "Suzuki",
        date: "2025-07-01",
        items: [makeItem()],
      });
      const html = generateInspectionReport(checklist);
      expect(html).toContain("proj-42");
      expect(html).toContain("Suzuki");
      expect(html).toContain("2025-07-01");
    });

    it("shows PASS result when all items pass", () => {
      const checklist = makeChecklist({
        items: [makeItem({ status: "pass" }), makeItem({ status: "pass" })],
      });
      const html = generateInspectionReport(checklist);
      expect(html).toContain("PASS");
      expect(html).toContain("#22c55e");
    });

    it("shows FAIL result when any item fails", () => {
      const checklist = makeChecklist({
        items: [makeItem({ status: "pass" }), makeItem({ status: "fail" })],
      });
      const html = generateInspectionReport(checklist);
      expect(html).toContain("FAIL");
      expect(html).toContain("#ef4444");
    });

    it("includes critical failures section when present", () => {
      const checklist = makeChecklist({
        items: [
          makeItem({ category: "fall-protection", status: "fail", description: "Missing guardrail" }),
        ],
      });
      const html = generateInspectionReport(checklist);
      expect(html).toContain("Critical Failures");
      expect(html).toContain("Missing guardrail");
    });

    it("escapes HTML in user-provided content", () => {
      const checklist = makeChecklist({
        inspectedBy: '<script>alert("xss")</script>',
        items: [makeItem({ notes: "Test <b>bold</b>" })],
      });
      const html = generateInspectionReport(checklist);
      expect(html).not.toContain("<script>");
      expect(html).toContain("&lt;script&gt;");
    });

    it("includes GenbaHub footer", () => {
      const checklist = makeChecklist({ items: [makeItem()] });
      const html = generateInspectionReport(checklist);
      expect(html).toContain("GenbaHub Safety Inspection Module");
    });
  });
});
