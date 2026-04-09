import { describe, expect, it } from "vitest";
import type { Project } from "../domain/types.js";
import type { ProgressTask } from "./earned-value.js";
import { assessProjectHealth, generateHealthReport, type HealthAssessmentInput } from "./project-health.js";

function makeTask(overrides: Partial<ProgressTask> & Pick<ProgressTask, "id" | "name">): ProgressTask {
  return {
    id: overrides.id,
    projectId: "proj-1",
    name: overrides.name,
    description: "",
    status: "todo",
    progress: 0,
    dependencies: [],
    createdAt: "2025-01-01T00:00:00.000Z",
    updatedAt: "2025-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: "proj-1",
    name: "Test Project",
    description: "",
    status: "active",
    startDate: "2025-01-01",
    includeWeekends: true,
    budget: 10000,
    createdAt: "2025-01-01T00:00:00.000Z",
    updatedAt: "2025-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("project-health", () => {
  describe("assessProjectHealth", () => {
    it("returns high score for healthy project", () => {
      const project = makeProject();
      const tasks: ProgressTask[] = [
        makeTask({
          id: "t1",
          name: "Foundation",
          status: "done",
          progress: 100,
          startDate: "2025-01-01",
          dueDate: "2025-01-10",
          plannedCost: 5000,
          actualCost: 4800,
        }),
        makeTask({
          id: "t2",
          name: "Framing",
          status: "in_progress",
          progress: 50,
          startDate: "2025-01-11",
          dueDate: "2025-01-20",
          plannedCost: 5000,
          actualCost: 2500,
          dependencies: ["t1"],
        }),
      ];

      const result = assessProjectHealth({
        project,
        tasks,
        asOfDate: "2025-01-15",
      });

      expect(result.overall).toBeGreaterThanOrEqual(60);
      expect(result.grade).toMatch(/^[A-C]$/);
      expect(result.categories).toHaveLength(4);
      expect(result.categories.map((c) => c.category)).toEqual(["schedule", "cost", "quality", "risk"]);
    });

    it("returns low score for troubled project", () => {
      const project = makeProject({ budget: 5000 });
      const tasks: ProgressTask[] = [
        makeTask({
          id: "t1",
          name: "Late task",
          status: "todo",
          progress: 0,
          startDate: "2025-01-01",
          dueDate: "2025-01-05",
          plannedCost: 3000,
          actualCost: 5000,
        }),
        makeTask({
          id: "t2",
          name: "Another late task",
          status: "todo",
          progress: 0,
          startDate: "2025-01-06",
          dueDate: "2025-01-10",
          plannedCost: 2000,
          actualCost: 4000,
          dependencies: ["t1"],
        }),
      ];

      const result = assessProjectHealth({
        project,
        tasks,
        inspectionPassRate: 0.4,
        asOfDate: "2025-02-01",
      });

      expect(result.overall).toBeLessThan(60);
      expect(result.grade).toMatch(/^[D-F]$/);
      expect(result.recommendations.length).toBeGreaterThan(1);
    });

    it("handles empty project", () => {
      const result = assessProjectHealth({
        project: makeProject(),
        tasks: [],
        asOfDate: "2025-01-15",
      });

      expect(result.overall).toBeGreaterThanOrEqual(80);
      expect(result.grade).toMatch(/^[AB]$/);
      expect(result.categories).toHaveLength(4);
    });

    it("handles single task", () => {
      const result = assessProjectHealth({
        project: makeProject(),
        tasks: [
          makeTask({
            id: "t1",
            name: "Solo task",
            status: "in_progress",
            progress: 50,
            startDate: "2025-01-01",
            dueDate: "2025-01-10",
            plannedCost: 10000,
          }),
        ],
        asOfDate: "2025-01-05",
      });

      expect(result.overall).toBeGreaterThanOrEqual(0);
      expect(result.overall).toBeLessThanOrEqual(100);
      expect(result.categories).toHaveLength(4);
    });

    it("penalizes overdue tasks in risk score", () => {
      const tasks: ProgressTask[] = [
        makeTask({
          id: "t1",
          name: "Overdue 1",
          status: "in_progress",
          progress: 30,
          startDate: "2025-01-01",
          dueDate: "2025-01-05",
        }),
        makeTask({
          id: "t2",
          name: "Overdue 2",
          status: "todo",
          progress: 0,
          startDate: "2025-01-03",
          dueDate: "2025-01-08",
        }),
      ];

      const result = assessProjectHealth({
        project: makeProject(),
        tasks,
        asOfDate: "2025-01-20",
      });

      const riskCategory = result.categories.find((c) => c.category === "risk");
      expect(riskCategory).toBeDefined();
      expect(riskCategory!.score).toBeLessThan(100);
      expect(riskCategory!.detail).toContain("overdue");
    });

    it("penalizes circular dependencies", () => {
      const tasks: ProgressTask[] = [
        makeTask({
          id: "t1",
          name: "Task A",
          status: "todo",
          startDate: "2025-01-01",
          dueDate: "2025-01-05",
          dependencies: ["t2"],
        }),
        makeTask({
          id: "t2",
          name: "Task B",
          status: "todo",
          startDate: "2025-01-06",
          dueDate: "2025-01-10",
          dependencies: ["t1"],
        }),
      ];

      const result = assessProjectHealth({
        project: makeProject(),
        tasks,
        asOfDate: "2025-01-03",
      });

      const riskCategory = result.categories.find((c) => c.category === "risk");
      expect(riskCategory!.detail).toContain("cycle");
    });

    it("uses inspection pass rate for quality", () => {
      const result = assessProjectHealth({
        project: makeProject(),
        tasks: [makeTask({ id: "t1", name: "Task", status: "done", progress: 100, startDate: "2025-01-01", dueDate: "2025-01-05" })],
        inspectionPassRate: 0.95,
        asOfDate: "2025-01-10",
      });

      const qualityCat = result.categories.find((c) => c.category === "quality");
      expect(qualityCat!.score).toBe(95);
    });

    it("provides recommendations for each troubled category", () => {
      const tasks: ProgressTask[] = [
        makeTask({
          id: "t1",
          name: "Bad task",
          status: "todo",
          progress: 0,
          startDate: "2025-01-01",
          dueDate: "2025-01-05",
          plannedCost: 5000,
          actualCost: 15000,
        }),
      ];

      const result = assessProjectHealth({
        project: makeProject({ budget: 5000 }),
        tasks,
        inspectionPassRate: 0.3,
        asOfDate: "2025-02-01",
      });

      // Should have multiple recommendations
      expect(result.recommendations.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe("generateHealthReport", () => {
    it("returns valid HTML", () => {
      const input: HealthAssessmentInput = {
        project: makeProject(),
        tasks: [
          makeTask({
            id: "t1",
            name: "Foundation",
            status: "done",
            progress: 100,
            startDate: "2025-01-01",
            dueDate: "2025-01-10",
          }),
        ],
        asOfDate: "2025-01-15",
      };

      const html = generateHealthReport(input);
      expect(html).toContain("<!DOCTYPE html>");
      expect(html).toContain("Project Health Report");
      expect(html).toContain("Test Project");
      expect(html).toContain("Grade:");
      expect(html).toContain("SCHEDULE");
      expect(html).toContain("COST");
      expect(html).toContain("QUALITY");
      expect(html).toContain("RISK");
      expect(html).toContain("Recommendations");
    });

    it("includes score and grade", () => {
      const html = generateHealthReport({
        project: makeProject(),
        tasks: [],
        asOfDate: "2025-01-15",
      });

      expect(html).toMatch(/\d+\/100/);
      expect(html).toMatch(/Grade: [A-F]/);
    });
  });
});
