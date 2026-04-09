import { describe, it, expect, beforeEach } from "vitest";
import {
  createBudgetAlert,
  createDeadlineAlert,
  createSafetyAlert,
  evaluateAlerts,
  resetAlertIds,
  type ProjectData,
} from "./alert-rules.js";

describe("alert-rules", () => {
  beforeEach(() => resetAlertIds());

  it("creates budget alert", () => {
    const rule = createBudgetAlert("p1", 80);
    expect(rule.type).toBe("budget");
    expect(rule.threshold).toBe(80);
  });

  it("creates deadline alert", () => {
    const rule = createDeadlineAlert("p1", 7);
    expect(rule.type).toBe("deadline");
    expect(rule.threshold).toBe(7);
  });

  it("creates safety alert", () => {
    const rule = createSafetyAlert("s1", "fire risk");
    expect(rule.type).toBe("safety");
    expect(rule.condition).toContain("fire risk");
  });

  describe("evaluateAlerts", () => {
    it("triggers budget alert when overspent", () => {
      const rule = createBudgetAlert("p1", 80);
      const data: ProjectData = { projectId: "p1", budget: 1000000, spent: 900000 };
      const triggered = evaluateAlerts([rule], data);
      expect(triggered).toHaveLength(1);
      expect(triggered[0].message).toContain("90.0%");
    });

    it("does not trigger when under budget", () => {
      const rule = createBudgetAlert("p1", 80);
      const data: ProjectData = { projectId: "p1", budget: 1000000, spent: 500000 };
      expect(evaluateAlerts([rule], data)).toHaveLength(0);
    });

    it("triggers deadline alert", () => {
      const rule = createDeadlineAlert("p1", 30);
      const soon = new Date();
      soon.setDate(soon.getDate() + 5);
      const data: ProjectData = { projectId: "p1", endDate: soon.toISOString().slice(0, 10) };
      const triggered = evaluateAlerts([rule], data);
      expect(triggered).toHaveLength(1);
      expect(triggered[0].message).toContain("days remaining");
    });

    it("triggers safety alert", () => {
      const rule = createSafetyAlert("p1", "hazard");
      const data: ProjectData = { projectId: "p1", safetyIncidents: 2 };
      const triggered = evaluateAlerts([rule], data);
      expect(triggered).toHaveLength(1);
    });

    it("skips rules for other projects", () => {
      const rule = createBudgetAlert("p2", 50);
      const data: ProjectData = { projectId: "p1", budget: 100, spent: 100 };
      expect(evaluateAlerts([rule], data)).toHaveLength(0);
    });
  });
});
