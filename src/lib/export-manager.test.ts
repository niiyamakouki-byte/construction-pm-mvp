import { describe, expect, it } from "vitest";
import {
  exportProjectBundle,
  importProjectBundle,
  generateProjectSummary,
} from "./export-manager.js";

// ── exportProjectBundle ───────────────────────────────

describe("exportProjectBundle", () => {
  it("creates a valid bundle", () => {
    const bundle = exportProjectBundle("Test PJ", { tasks: [1, 2, 3] });
    expect(bundle.version).toBe("1.0.0");
    expect(bundle.projectName).toBe("Test PJ");
    expect(bundle.data).toEqual({ tasks: [1, 2, 3] });
    expect(bundle.checksum).toBeTruthy();
  });

  it("includes attachments", () => {
    const bundle = exportProjectBundle("Test", { a: 1 }, [
      { name: "photo.jpg", type: "image/jpeg", size: 1024, content: "base64data" },
    ]);
    expect(bundle.attachments).toHaveLength(1);
    expect(bundle.attachments[0].name).toBe("photo.jpg");
  });

  it("sets exportedAt timestamp", () => {
    const bundle = exportProjectBundle("Test", {});
    expect(bundle.exportedAt).toBeTruthy();
  });
});

// ── importProjectBundle ───────────────────────────────

describe("importProjectBundle", () => {
  it("imports valid bundle", () => {
    const bundle = exportProjectBundle("My Project", {
      tasks: [],
      members: [],
      budget: 10000,
    });
    const json = JSON.stringify(bundle);
    const result = importProjectBundle(json);
    expect(result.success).toBe(true);
    expect(result.projectName).toBe("My Project");
    expect(result.itemsImported).toBe(3);
  });

  it("fails on invalid JSON", () => {
    const result = importProjectBundle("not json{{{");
    expect(result.success).toBe(false);
    expect(result.errors).toContain("Invalid JSON format");
  });

  it("fails on missing projectName", () => {
    const result = importProjectBundle(
      JSON.stringify({ version: "1.0.0", data: {} }),
    );
    expect(result.success).toBe(false);
    expect(result.errors.some((e) => e.includes("projectName"))).toBe(true);
  });

  it("warns on checksum mismatch", () => {
    const bundle = exportProjectBundle("Test", { a: 1 });
    bundle.data = { b: 2 }; // tamper with data
    const result = importProjectBundle(JSON.stringify(bundle));
    expect(result.warnings.some((w) => w.includes("Checksum"))).toBe(true);
  });

  it("warns on missing version", () => {
    const bundle = { projectName: "Test", data: { x: 1 }, checksum: "abc" };
    const result = importProjectBundle(JSON.stringify(bundle));
    expect(result.warnings.some((w) => w.includes("version"))).toBe(true);
  });
});

// ── generateProjectSummary ────────────────────────────

describe("generateProjectSummary", () => {
  it("generates summary with progress", () => {
    const summary = generateProjectSummary({
      projectName: "KDX南青山",
      status: "active",
      startDate: "2025-01-01",
      endDate: "2025-06-30",
      totalTasks: 20,
      completedTasks: 15,
      totalBudget: 47_500_000,
      spentBudget: 30_000_000,
      teamSize: 8,
    });
    expect(summary.progressPct).toBe(75);
    expect(summary.projectName).toBe("KDX南青山");
    expect(summary.teamSize).toBe(8);
  });

  it("handles zero tasks", () => {
    const summary = generateProjectSummary({
      projectName: "Empty",
      status: "planning",
      startDate: "2025-01-01",
      endDate: "2025-03-01",
      totalTasks: 0,
      completedTasks: 0,
      totalBudget: 0,
      spentBudget: 0,
      teamSize: 0,
    });
    expect(summary.progressPct).toBe(0);
  });
});
