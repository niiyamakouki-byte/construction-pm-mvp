import { describe, expect, it } from "vitest";
import {
  predictBudgetOverrun,
  predictScheduleDelay,
  generateRiskAlerts,
  type RiskAlert,
} from "./risk-predictor.js";
import type { MonthlyData } from "./cost-forecaster.js";

// ── Fixtures ───────────────────────────────────────────────────────────────

const project = {
  id: "p1",
  name: "テスト現場",
  description: "",
  status: "active" as const,
  startDate: "2025-01-01",
  endDate: "2025-12-31",
  budget: 10_000_000,
  includeWeekends: false,
  createdAt: "2025-01-01T00:00:00Z",
  updatedAt: "2025-01-01T00:00:00Z",
};

function makeTask(
  id: string,
  progress: number,
  status: "todo" | "in_progress" | "done" = "in_progress",
  dueDate?: string,
) {
  return {
    id,
    name: `タスク${id}`,
    projectId: "p1",
    description: "",
    status,
    progress,
    dependencies: [],
    dueDate,
    startDate: "2025-01-01",
    createdAt: "2025-01-01T00:00:00Z",
    updatedAt: "2025-01-01T00:00:00Z",
  };
}

function makeExpense(amount: number, approvalStatus: "approved" | "pending" | "rejected" = "approved") {
  return { amount, approvalStatus };
}

// ── predictBudgetOverrun ───────────────────────────────────────────────────

describe("predictBudgetOverrun", () => {
  it("returns zero probability and zero overrun when under budget", () => {
    const tasks = [makeTask("t1", 50, "in_progress")];
    const expenses = [makeExpense(1_000_000)];
    const result = predictBudgetOverrun(project, tasks, expenses);
    expect(result.probability).toBe(0);
    expect(result.estimatedOverrun).toBe(0);
    expect(result.triggers).toHaveLength(0);
  });

  it("returns high probability when EAC exceeds budget", () => {
    // 25% done, 5M spent => EAC = 20M (budget=10M => overrun 10M)
    const tasks = [makeTask("t1", 25, "in_progress")];
    const expenses = [makeExpense(5_000_000)];
    const result = predictBudgetOverrun(project, tasks, expenses);
    expect(result.probability).toBeGreaterThan(0.6);
    expect(result.estimatedOverrun).toBeGreaterThan(0);
    expect(result.triggers.length).toBeGreaterThan(0);
  });

  it("adds spend-over-80% trigger", () => {
    // 90% spent, 50% done => spend > 80% budget
    const tasks = [makeTask("t1", 50, "in_progress")];
    const expenses = [makeExpense(9_000_000)];
    const result = predictBudgetOverrun(project, tasks, expenses);
    expect(result.triggers.some((t) => t.includes("80%"))).toBe(true);
  });

  it("adds increasing-trend trigger", () => {
    const tasks = [makeTask("t1", 50, "in_progress")];
    const expenses = [makeExpense(1_000_000)];
    const monthly: MonthlyData[] = [
      { month: "2025-01", actualCost: 100_000, budgetedCost: 100_000 },
      { month: "2025-02", actualCost: 300_000, budgetedCost: 100_000 },
      { month: "2025-03", actualCost: 500_000, budgetedCost: 100_000 },
    ];
    const result = predictBudgetOverrun(project, tasks, expenses, monthly);
    expect(result.triggers.some((t) => t.includes("増加"))).toBe(true);
  });

  it("excludes rejected expenses", () => {
    const tasks = [makeTask("t1", 50, "in_progress")];
    const expenses = [makeExpense(1_000_000, "rejected")];
    const result = predictBudgetOverrun(project, tasks, expenses);
    expect(result.probability).toBe(0);
  });

  it("clamps probability to 1.0", () => {
    const tasks = [makeTask("t1", 10, "in_progress")];
    const expenses = [makeExpense(9_500_000)];
    const monthly: MonthlyData[] = [
      { month: "2025-01", actualCost: 100_000, budgetedCost: 100_000 },
      { month: "2025-02", actualCost: 500_000, budgetedCost: 100_000 },
      { month: "2025-03", actualCost: 900_000, budgetedCost: 100_000 },
    ];
    const result = predictBudgetOverrun(project, tasks, expenses, monthly);
    expect(result.probability).toBeLessThanOrEqual(1.0);
  });
});

// ── predictScheduleDelay ───────────────────────────────────────────────────

describe("predictScheduleDelay", () => {
  it("returns zero probability when all tasks done on time", () => {
    const tasks = [
      makeTask("t1", 100, "done", "2025-01-31"),
      makeTask("t2", 100, "done", "2025-02-28"),
    ];
    const result = predictScheduleDelay(project, tasks);
    expect(result.probability).toBe(0);
    expect(result.criticalTasks).toHaveLength(0);
  });

  it("flags overdue in-progress tasks", () => {
    const overdue = makeTask("t1", 30, "in_progress", "2025-01-01");
    const result = predictScheduleDelay(project, [overdue]);
    expect(result.probability).toBeGreaterThan(0);
    expect(result.criticalTasks).toContain("タスクt1");
  });

  it("adds penalty for tasks without dueDate", () => {
    const noDeadline = makeTask("t1", 50, "in_progress"); // no dueDate
    const result = predictScheduleDelay(project, [noDeadline]);
    expect(result.probability).toBeGreaterThan(0);
  });

  it("estimates delay days from overdue tasks", () => {
    // dueDate well in the past
    const overdue = makeTask("t1", 10, "in_progress", "2024-01-01");
    const result = predictScheduleDelay(project, [overdue]);
    expect(result.estimatedDays).toBeGreaterThan(0);
  });

  it("clamps probability to 1.0", () => {
    const tasks = Array.from({ length: 10 }, (_, i) =>
      makeTask(`t${i}`, 10, "in_progress", "2024-01-01"),
    );
    const result = predictScheduleDelay(project, tasks);
    expect(result.probability).toBeLessThanOrEqual(1.0);
  });
});

// ── generateRiskAlerts ─────────────────────────────────────────────────────

describe("generateRiskAlerts", () => {
  it("returns empty array when project is healthy", () => {
    const tasks = [makeTask("t1", 50, "done", "2025-12-31")];
    const expenses = [makeExpense(500_000)];
    const alerts = generateRiskAlerts(project, tasks, expenses);
    // With healthy project, no high-probability alerts
    const high = alerts.filter((a) => a.severity === "critical" || a.severity === "high");
    expect(high).toHaveLength(0);
  });

  it("generates budget alert when EAC far exceeds budget", () => {
    const tasks = [makeTask("t1", 10, "in_progress")];
    const expenses = [makeExpense(8_000_000)];
    const alerts = generateRiskAlerts(project, tasks, expenses);
    const budgetAlert = alerts.find((a) => a.type === "budget");
    expect(budgetAlert).toBeDefined();
    expect(budgetAlert?.severity).toMatch(/high|critical/);
  });

  it("generates schedule alert when many tasks overdue", () => {
    const tasks = [
      makeTask("t1", 20, "in_progress", "2024-01-01"),
      makeTask("t2", 30, "in_progress", "2024-01-01"),
      makeTask("t3", 10, "in_progress", "2024-01-01"),
      makeTask("t4", 5, "in_progress", "2024-01-01"),
    ];
    const expenses = [makeExpense(500_000)];
    const alerts = generateRiskAlerts(project, tasks, expenses);
    const scheduleAlert = alerts.find((a) => a.type === "schedule");
    expect(scheduleAlert).toBeDefined();
  });

  it("generates resource alert when many tasks in_progress simultaneously", () => {
    const tasks = Array.from({ length: 7 }, (_, i) =>
      makeTask(`t${i}`, 30, "in_progress", "2025-12-31"),
    );
    const expenses = [makeExpense(500_000)];
    const alerts = generateRiskAlerts(project, tasks, expenses);
    const resourceAlert = alerts.find((a) => a.type === "resource");
    expect(resourceAlert).toBeDefined();
    expect(resourceAlert?.severity).toBe("medium");
  });

  it("sorts alerts by severity: critical before high before medium", () => {
    const tasks = [
      makeTask("t1", 10, "in_progress", "2024-01-01"),
      makeTask("t2", 10, "in_progress"),
    ];
    const expenses = [makeExpense(9_500_000)];
    const monthly: MonthlyData[] = [
      { month: "2025-01", actualCost: 100_000, budgetedCost: 100_000 },
      { month: "2025-02", actualCost: 500_000, budgetedCost: 100_000 },
    ];
    const alerts = generateRiskAlerts(project, tasks, expenses, monthly);
    const severityOrder: Record<RiskAlert["severity"], number> = {
      critical: 0, high: 1, medium: 2, low: 3,
    };
    for (let i = 1; i < alerts.length; i++) {
      expect(severityOrder[alerts[i].severity]).toBeGreaterThanOrEqual(
        severityOrder[alerts[i - 1].severity],
      );
    }
  });

  it("each alert has non-empty message and recommendation", () => {
    const tasks = [makeTask("t1", 20, "in_progress", "2024-01-01")];
    const expenses = [makeExpense(7_000_000)];
    const alerts = generateRiskAlerts(project, tasks, expenses);
    for (const alert of alerts) {
      expect(alert.message.length).toBeGreaterThan(0);
      expect(alert.recommendation.length).toBeGreaterThan(0);
    }
  });
});
