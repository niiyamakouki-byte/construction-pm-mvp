import { describe, expect, it } from "vitest";
import {
  createMilestones,
  checkMilestoneStatus,
  generateMilestoneReport,
  type Milestone,
} from "./milestone-tracker.js";
import type { Project, Task } from "../domain/types.js";

function makeProject(overrides?: Partial<Project>): Project {
  return {
    id: "proj-1",
    name: "Test Building",
    description: "A test project",
    status: "active",
    startDate: "2025-07-01",
    endDate: "2025-12-31",
    includeWeekends: false,
    createdAt: "2025-01-01",
    updatedAt: "2025-01-01",
    ...overrides,
  };
}

function makeTask(overrides?: Partial<Task>): Task {
  return {
    id: "task-1",
    projectId: "proj-1",
    name: "Foundation",
    description: "",
    status: "todo",
    startDate: "2025-07-01",
    dueDate: "2025-07-15",
    progress: 0,
    dependencies: [],
    createdAt: "2025-01-01",
    updatedAt: "2025-01-01",
    ...overrides,
  };
}

function makeMilestone(overrides?: Partial<Milestone>): Milestone {
  return {
    id: "ms-proj-1-1",
    projectId: "proj-1",
    name: "Foundation complete",
    targetDate: "2025-07-15",
    status: "on-track",
    ...overrides,
  };
}

describe("milestone-tracker", () => {
  describe("createMilestones", () => {
    it("creates milestones from tasks with dependencies", () => {
      const tasks = [
        makeTask({ id: "t1", name: "Foundation", dueDate: "2025-07-15", dependencies: [] }),
        makeTask({ id: "t2", name: "Framing", dueDate: "2025-08-15", dependencies: ["t1"] }),
        makeTask({ id: "t3", name: "Roofing", dueDate: "2025-09-15", dependencies: ["t2"] }),
      ];
      const milestones = createMilestones(makeProject(), tasks);
      expect(milestones.length).toBeGreaterThanOrEqual(2);
      const names = milestones.map((m) => m.name);
      // t1 is depended upon, t2 has deps and is depended upon, t3 has deps
      expect(names).toContain("Foundation complete");
      expect(names).toContain("Framing complete");
      expect(names).toContain("Roofing complete");
    });

    it("includes the last task as project completion milestone", () => {
      const tasks = [
        makeTask({ id: "t1", name: "Early Task", dueDate: "2025-07-15", dependencies: [] }),
        makeTask({ id: "t2", name: "Final Inspection", dueDate: "2025-12-31", dependencies: [] }),
      ];
      const milestones = createMilestones(makeProject(), tasks);
      const names = milestones.map((m) => m.name);
      expect(names).toContain("Final Inspection complete");
    });

    it("returns empty array when no tasks", () => {
      const milestones = createMilestones(makeProject(), []);
      expect(milestones).toEqual([]);
    });

    it("uses startDate when dueDate is missing", () => {
      const tasks = [
        makeTask({ id: "t1", name: "Setup", startDate: "2025-07-01", dueDate: undefined, dependencies: ["t0"] }),
      ];
      const milestones = createMilestones(makeProject(), tasks);
      expect(milestones.length).toBe(1);
      expect(milestones[0].targetDate).toBe("2025-07-01");
    });

    it("sets actualDate for completed tasks", () => {
      const tasks = [
        makeTask({ id: "t1", name: "Done Task", status: "done", dueDate: "2025-07-15", dependencies: ["t0"] }),
      ];
      const milestones = createMilestones(makeProject(), tasks);
      expect(milestones[0].actualDate).toBe("2025-07-15");
    });

    it("does not set actualDate for incomplete tasks", () => {
      const tasks = [
        makeTask({ id: "t1", name: "In Progress", status: "in_progress", dependencies: ["t0"] }),
      ];
      const milestones = createMilestones(makeProject(), tasks);
      expect(milestones[0].actualDate).toBeUndefined();
    });

    it("generates correct milestone IDs", () => {
      const tasks = [
        makeTask({ id: "t1", name: "A", dependencies: ["t0"] }),
        makeTask({ id: "t2", name: "B", dependencies: ["t1"] }),
      ];
      const milestones = createMilestones(makeProject({ id: "proj-x" }), tasks);
      expect(milestones[0].id).toMatch(/^ms-proj-x-/);
      expect(milestones[1].id).toMatch(/^ms-proj-x-/);
    });
  });

  describe("checkMilestoneStatus", () => {
    it("marks completed milestones", () => {
      const milestones = [makeMilestone({ actualDate: "2025-07-14" })];
      const result = checkMilestoneStatus(milestones, "2025-07-20");
      expect(result[0].status).toBe("completed");
    });

    it("marks missed milestones (past target, no actual)", () => {
      const milestones = [makeMilestone({ targetDate: "2025-07-15" })];
      const result = checkMilestoneStatus(milestones, "2025-07-20");
      expect(result[0].status).toBe("missed");
    });

    it("marks at-risk milestones (within 7 days)", () => {
      const milestones = [makeMilestone({ targetDate: "2025-07-20" })];
      const result = checkMilestoneStatus(milestones, "2025-07-15");
      expect(result[0].status).toBe("at-risk");
    });

    it("marks on-track milestones (more than 7 days away)", () => {
      const milestones = [makeMilestone({ targetDate: "2025-08-15" })];
      const result = checkMilestoneStatus(milestones, "2025-07-01");
      expect(result[0].status).toBe("on-track");
    });

    it("at-risk boundary: exactly 7 days remaining", () => {
      const milestones = [makeMilestone({ targetDate: "2025-07-22" })];
      const result = checkMilestoneStatus(milestones, "2025-07-15");
      expect(result[0].status).toBe("at-risk");
    });

    it("on-track boundary: 8 days remaining", () => {
      const milestones = [makeMilestone({ targetDate: "2025-07-23" })];
      const result = checkMilestoneStatus(milestones, "2025-07-15");
      expect(result[0].status).toBe("on-track");
    });

    it("handles mixed statuses", () => {
      const milestones = [
        makeMilestone({ id: "ms-1", targetDate: "2025-07-01", actualDate: "2025-06-30" }),
        makeMilestone({ id: "ms-2", targetDate: "2025-07-10" }),
        makeMilestone({ id: "ms-3", targetDate: "2025-07-20" }),
        makeMilestone({ id: "ms-4", targetDate: "2025-08-30" }),
      ];
      const result = checkMilestoneStatus(milestones, "2025-07-15");
      expect(result[0].status).toBe("completed");
      expect(result[1].status).toBe("missed");
      expect(result[2].status).toBe("at-risk");
      expect(result[3].status).toBe("on-track");
    });

    it("does not mutate original milestones", () => {
      const original = [makeMilestone({ targetDate: "2025-07-15" })];
      checkMilestoneStatus(original, "2025-07-20");
      expect(original[0].status).toBe("on-track");
    });
  });

  describe("generateMilestoneReport", () => {
    it("returns no-milestones message for empty array", () => {
      const report = generateMilestoneReport([]);
      expect(report).toBe("No milestones defined.");
    });

    it("includes report header", () => {
      const report = generateMilestoneReport([makeMilestone()]);
      expect(report).toContain("=== Milestone Report ===");
    });

    it("includes milestone names and dates", () => {
      const ms = makeMilestone({ name: "Foundation complete", targetDate: "2025-07-15" });
      const report = generateMilestoneReport([ms]);
      expect(report).toContain("Foundation complete");
      expect(report).toContain("2025-07-15");
    });

    it("shows status labels", () => {
      const milestones = [
        makeMilestone({ status: "on-track" }),
        makeMilestone({ id: "ms-2", status: "at-risk", name: "Framing" }),
        makeMilestone({ id: "ms-3", status: "missed", name: "Roofing" }),
        makeMilestone({ id: "ms-4", status: "completed", name: "Plumbing", actualDate: "2025-07-10" }),
      ];
      const report = generateMilestoneReport(milestones);
      expect(report).toContain("[ON TRACK]");
      expect(report).toContain("[AT RISK]");
      expect(report).toContain("[MISSED]");
      expect(report).toContain("[COMPLETED]");
    });

    it("shows actual date for completed milestones", () => {
      const ms = makeMilestone({ status: "completed", actualDate: "2025-07-10" });
      const report = generateMilestoneReport([ms]);
      expect(report).toContain("(actual: 2025-07-10)");
    });

    it("includes summary counts", () => {
      const milestones = [
        makeMilestone({ id: "ms-1", status: "completed", targetDate: "2025-07-01" }),
        makeMilestone({ id: "ms-2", status: "on-track", targetDate: "2025-08-01" }),
        makeMilestone({ id: "ms-3", status: "at-risk", targetDate: "2025-09-01" }),
      ];
      const report = generateMilestoneReport(milestones);
      expect(report).toContain("Total: 3");
      expect(report).toContain("Completed: 1");
      expect(report).toContain("On Track: 1");
      expect(report).toContain("At Risk: 1");
    });

    it("sorts milestones by target date", () => {
      const milestones = [
        makeMilestone({ id: "ms-1", name: "Late", targetDate: "2025-12-01" }),
        makeMilestone({ id: "ms-2", name: "Early", targetDate: "2025-07-01" }),
        makeMilestone({ id: "ms-3", name: "Mid", targetDate: "2025-09-01" }),
      ];
      const report = generateMilestoneReport(milestones);
      const earlyIdx = report.indexOf("Early");
      const midIdx = report.indexOf("Mid");
      const lateIdx = report.indexOf("Late");
      expect(earlyIdx).toBeLessThan(midIdx);
      expect(midIdx).toBeLessThan(lateIdx);
    });

    it("does not show zero-count categories in summary", () => {
      const milestones = [
        makeMilestone({ id: "ms-1", status: "on-track", targetDate: "2025-08-01" }),
      ];
      const report = generateMilestoneReport(milestones);
      expect(report).toContain("On Track: 1");
      expect(report).not.toContain("Completed:");
      expect(report).not.toContain("At Risk:");
      expect(report).not.toContain("Missed:");
    });

    it("handles single milestone report", () => {
      const report = generateMilestoneReport([
        makeMilestone({ name: "Solo Milestone", status: "completed", actualDate: "2025-07-10" }),
      ]);
      expect(report).toContain("Total: 1");
      expect(report).toContain("Completed: 1");
      expect(report).toContain("Solo Milestone");
    });
  });

  describe("createMilestones edge cases", () => {
    it("skips tasks without both startDate and dueDate", () => {
      const tasks = [
        makeTask({ id: "t1", name: "No dates", startDate: undefined, dueDate: undefined, dependencies: ["t0"] }),
      ];
      const milestones = createMilestones(makeProject(), tasks);
      expect(milestones).toHaveLength(0);
    });

    it("handles single independent task as project completion milestone", () => {
      const tasks = [
        makeTask({ id: "t1", name: "Only Task", dueDate: "2025-09-01", dependencies: [] }),
      ];
      const milestones = createMilestones(makeProject(), tasks);
      expect(milestones.length).toBe(1);
      expect(milestones[0].name).toBe("Only Task complete");
    });

    it("does not duplicate task that is both critical and latest", () => {
      const tasks = [
        makeTask({ id: "t1", name: "First", dueDate: "2025-07-15", dependencies: [] }),
        makeTask({ id: "t2", name: "Last", dueDate: "2025-12-31", dependencies: ["t1"] }),
      ];
      const milestones = createMilestones(makeProject(), tasks);
      const lastCount = milestones.filter((m) => m.name === "Last complete").length;
      expect(lastCount).toBe(1);
    });

    it("all milestones have correct projectId", () => {
      const tasks = [
        makeTask({ id: "t1", name: "A", dependencies: ["t0"] }),
        makeTask({ id: "t2", name: "B", dependencies: ["t1"] }),
      ];
      const milestones = createMilestones(makeProject({ id: "proj-abc" }), tasks);
      for (const ms of milestones) {
        expect(ms.projectId).toBe("proj-abc");
      }
    });
  });

  describe("checkMilestoneStatus edge cases", () => {
    it("completed takes priority even if past target date", () => {
      const milestones = [
        makeMilestone({ targetDate: "2025-06-01", actualDate: "2025-06-15" }),
      ];
      const result = checkMilestoneStatus(milestones, "2025-07-01");
      expect(result[0].status).toBe("completed");
    });

    it("handles empty milestones array", () => {
      const result = checkMilestoneStatus([], "2025-07-01");
      expect(result).toEqual([]);
    });

    it("target date equals today is at-risk (0 days remaining)", () => {
      const milestones = [makeMilestone({ targetDate: "2025-07-15" })];
      const result = checkMilestoneStatus(milestones, "2025-07-15");
      expect(result[0].status).toBe("at-risk");
    });
  });
});
