import { describe, it, expect } from "vitest";
import {
  createInvoiceTemplate,
  createProgressReport,
  createChangeOrder,
  createDailyLog,
} from "./document-templates.js";

describe("document-templates", () => {
  describe("createInvoiceTemplate", () => {
    it("generates invoice HTML with items", () => {
      const html = createInvoiceTemplate("proj-1", "Vendor A", [
        { description: "Wood panels", quantity: 10, unitPrice: 5000 },
        { description: "Screws", quantity: 100, unitPrice: 50 },
      ]);
      expect(html).toContain("請求書");
      expect(html).toContain("Vendor A");
      expect(html).toContain("Wood panels");
      expect(html).toContain("<table>");
    });

    it("handles empty items", () => {
      const html = createInvoiceTemplate("p", "v", []);
      expect(html).toContain("請求書");
    });
  });

  describe("createProgressReport", () => {
    it("generates progress report with milestones", () => {
      const html = createProgressReport("proj-1", [
        { name: "Foundation", completed: true, date: "2026-01-15" },
        { name: "Framing", completed: false },
      ]);
      expect(html).toContain("Progress Report");
      expect(html).toContain("50%");
      expect(html).toContain("Foundation");
    });

    it("handles 100% completion", () => {
      const html = createProgressReport("p", [
        { name: "Done", completed: true },
      ]);
      expect(html).toContain("100%");
    });
  });

  describe("createChangeOrder", () => {
    it("generates change order HTML", () => {
      const html = createChangeOrder(
        "proj-1",
        [{ description: "Extra wiring", cost: 150000 }],
        150000,
      );
      expect(html).toContain("変更指示書");
      expect(html).toContain("Extra wiring");
    });
  });

  describe("createDailyLog", () => {
    it("generates daily log HTML", () => {
      const html = createDailyLog("proj-1", "2026-04-09", [
        { time: "08:00", description: "Site setup", worker: "Tanaka" },
        { time: "10:00", description: "Foundation pour" },
      ]);
      expect(html).toContain("日報");
      expect(html).toContain("2026-04-09");
      expect(html).toContain("Site setup");
      expect(html).toContain("Tanaka");
    });
  });
});
