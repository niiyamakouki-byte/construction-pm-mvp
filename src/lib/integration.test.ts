/**
 * R9-R10 Integration tests: full workflows, edge cases, export pipeline.
 */
import { describe, expect, it } from "vitest";
import type { Project, Task, Contractor } from "../domain/types.js";
import type { ProgressTask } from "./earned-value.js";
import type { GanttTask } from "../components/gantt/types.js";
import {
  calculateEarnedValue,
  schedulePerformanceIndex,
  costPerformanceIndex,
  generateEVReport,
} from "./earned-value.js";
import {
  validateSchedule,
  detectGaps,
  detectCircularDependencies,
  criticalPath,
} from "./schedule-validator.js";
import { cascadeSchedule } from "./cascade-scheduler.js";
import { exportToICS } from "./calendar-export.js";
import { generateDailyReport, gatherReportData, type DailyReportInput } from "./daily-report-generator.js";
import { assessProjectHealth, generateHealthReport } from "./project-health.js";

// ── Helpers ──────────────────────────────────────────

const NOW = "2025-01-01T00:00:00.000Z";

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: "proj-1",
    name: "Integration Test Project",
    description: "Full workflow test",
    status: "active",
    startDate: "2025-01-01",
    includeWeekends: true,
    budget: 50000,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function makeTask(overrides: Partial<Task> & Pick<Task, "id" | "name">): Task {
  return {
    projectId: "proj-1",
    description: overrides.description ?? "",
    status: "todo",
    progress: 0,
    dependencies: [],
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

function makeProgressTask(overrides: Partial<ProgressTask> & Pick<ProgressTask, "id" | "name">): ProgressTask {
  return {
    ...makeTask(overrides),
    plannedCost: overrides.plannedCost,
    actualCost: overrides.actualCost,
    ...overrides,
  };
}

function toGanttTask(task: Task, project: Project): GanttTask {
  return {
    ...task,
    projectName: project.name,
    startDate: task.startDate ?? "2025-01-01",
    endDate: task.dueDate ?? task.startDate ?? "2025-01-01",
    isDateEstimated: !task.startDate,
    isMilestone: false,
    projectIncludesWeekends: project.includeWeekends,
  };
}

// ── Full Workflow ────────────────────────────────────

describe("Integration: full workflow", () => {
  it("create project -> add tasks -> set deps -> cascade -> validate -> EVM", () => {
    // Step 1: Create project
    const project = makeProject();
    expect(project.id).toBe("proj-1");

    // Step 2: Add tasks
    const tasks: Task[] = [
      makeTask({
        id: "t1",
        name: "Site preparation",
        status: "done",
        progress: 100,
        startDate: "2025-01-01",
        dueDate: "2025-01-10",
      }),
      makeTask({
        id: "t2",
        name: "Foundation",
        status: "in_progress",
        progress: 60,
        startDate: "2025-01-11",
        dueDate: "2025-01-20",
      }),
      makeTask({
        id: "t3",
        name: "Framing",
        status: "todo",
        progress: 0,
        startDate: "2025-01-21",
        dueDate: "2025-01-31",
      }),
      makeTask({
        id: "t4",
        name: "Electrical",
        status: "todo",
        progress: 0,
        startDate: "2025-02-01",
        dueDate: "2025-02-10",
      }),
    ];
    expect(tasks).toHaveLength(4);

    // Step 3: Set dependencies
    tasks[1].dependencies = ["t1"];
    tasks[2].dependencies = ["t2"];
    tasks[3].dependencies = ["t3"];

    // Step 4: Validate schedule (should be clean)
    const validation = validateSchedule(tasks);
    expect(validation.isValid).toBe(true);
    expect(validation.cycles).toHaveLength(0);
    expect(validation.order).toHaveLength(4);

    // Step 5: Cascade - push t1 end date forward by 3 days
    const ganttTasks = tasks.map((t) => toGanttTask(t, project));
    const updates = cascadeSchedule(ganttTasks, "t1", "2025-01-01", "2025-01-13");

    // Downstream tasks should shift
    expect(updates.size).toBeGreaterThan(0);
    expect(updates.has("t2")).toBe(true);

    // Step 6: Run EVM
    const progressTasks: ProgressTask[] = tasks.map((t) => ({
      ...t,
      plannedCost: 12500,
      actualCost: t.status === "done" ? 13000 : undefined,
    }));

    const ev = calculateEarnedValue(progressTasks, 50000, "2025-01-15");
    expect(ev.bac).toBe(50000);
    expect(ev.ev).toBeGreaterThan(0);
    expect(ev.pv).toBeGreaterThan(0);

    const spi = schedulePerformanceIndex(progressTasks, 50000, "2025-01-15");
    expect(spi).toBeGreaterThan(0);

    // Step 7: Health check
    const health = assessProjectHealth({
      project,
      tasks: progressTasks,
      asOfDate: "2025-01-15",
    });
    expect(health.overall).toBeGreaterThanOrEqual(0);
    expect(health.overall).toBeLessThanOrEqual(100);
    expect(health.categories).toHaveLength(4);
  });

  it("tracks budget vs actual throughout lifecycle", () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const project = makeProject({ budget: 20000 });
    const tasks: ProgressTask[] = [
      makeProgressTask({
        id: "t1",
        name: "Phase 1",
        status: "done",
        progress: 100,
        startDate: "2025-01-01",
        dueDate: "2025-01-15",
        plannedCost: 10000,
        actualCost: 9500,
      }),
      makeProgressTask({
        id: "t2",
        name: "Phase 2",
        status: "done",
        progress: 100,
        startDate: "2025-01-16",
        dueDate: "2025-01-31",
        plannedCost: 10000,
        actualCost: 11000,
        dependencies: ["t1"],
      }),
    ];

    const ev = calculateEarnedValue(tasks, 20000, "2025-02-01");
    expect(ev.percentComplete).toBe(100);
    expect(ev.ac).toBe(20500);

    const cpi = costPerformanceIndex(tasks, undefined, 20000, "2025-02-01");
    // Under budget on t1, over on t2, overall slightly over
    expect(cpi).toBeLessThan(1);
    expect(cpi).toBeGreaterThan(0.9);
  });
});

// ── Edge Cases ──────────────────────────────────────

describe("Integration: edge cases", () => {
  it("empty project: all modules handle gracefully", () => {
    const project = makeProject();
    const tasks: ProgressTask[] = [];

    const validation = validateSchedule(tasks);
    expect(validation.isValid).toBe(true);
    expect(validation.order).toHaveLength(0);

    const ev = calculateEarnedValue(tasks, 0, "2025-01-15");
    expect(ev.ev).toBe(0);
    expect(ev.pv).toBe(0);

    const gaps = detectGaps(tasks);
    expect(gaps).toHaveLength(0);

    const cp = criticalPath(tasks);
    expect(cp.taskIds).toHaveLength(0);

    const health = assessProjectHealth({ project, tasks, asOfDate: "2025-01-15" });
    expect(health.overall).toBeGreaterThanOrEqual(80);

    const ics = exportToICS(project, tasks, "2025-01-15");
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("END:VCALENDAR");
    expect(ics).not.toContain("BEGIN:VEVENT");
  });

  it("single task: all modules handle gracefully", () => {
    const project = makeProject();
    const task = makeProgressTask({
      id: "solo",
      name: "Only task",
      status: "in_progress",
      progress: 50,
      startDate: "2025-01-01",
      dueDate: "2025-01-10",
      plannedCost: 5000,
    });
    const tasks = [task];

    const validation = validateSchedule(tasks);
    expect(validation.isValid).toBe(true);
    expect(validation.order).toEqual(["solo"]);

    const ev = calculateEarnedValue(tasks, 5000, "2025-01-05");
    expect(ev.percentComplete).toBe(50);

    const cp = criticalPath(tasks);
    expect(cp.taskIds).toEqual(["solo"]);

    const health = assessProjectHealth({ project, tasks, asOfDate: "2025-01-05" });
    expect(health.overall).toBeGreaterThanOrEqual(0);
    expect(health.categories).toHaveLength(4);
  });

  it("circular deps: detection and health penalty", () => {
    const project = makeProject();
    const tasks: ProgressTask[] = [
      makeProgressTask({
        id: "a",
        name: "Task A",
        startDate: "2025-01-01",
        dueDate: "2025-01-05",
        dependencies: ["c"],
      }),
      makeProgressTask({
        id: "b",
        name: "Task B",
        startDate: "2025-01-06",
        dueDate: "2025-01-10",
        dependencies: ["a"],
      }),
      makeProgressTask({
        id: "c",
        name: "Task C",
        startDate: "2025-01-11",
        dueDate: "2025-01-15",
        dependencies: ["b"],
      }),
    ];

    // Detection
    const cycles = detectCircularDependencies(tasks);
    expect(cycles.length).toBeGreaterThan(0);

    const validation = validateSchedule(tasks);
    expect(validation.isValid).toBe(false);

    // Critical path should report issues
    const cp = criticalPath(tasks);
    expect(cp.issues.length).toBeGreaterThan(0);

    // Health should penalize
    const health = assessProjectHealth({ project, tasks, asOfDate: "2025-01-05" });
    const riskCat = health.categories.find((c) => c.category === "risk");
    expect(riskCat!.score).toBeLessThan(100);
  });

  it("tasks with no dates are handled gracefully", () => {
    const project = makeProject();
    const tasks: ProgressTask[] = [
      makeProgressTask({ id: "nd1", name: "No dates task" }),
      makeProgressTask({ id: "nd2", name: "Also no dates", dependencies: ["nd1"] }),
    ];

    const validation = validateSchedule(tasks);
    expect(validation.isValid).toBe(true);

    const ev = calculateEarnedValue(tasks, 1000, "2025-01-15");
    expect(ev.bac).toBe(1000);

    const health = assessProjectHealth({ project, tasks, asOfDate: "2025-01-15" });
    expect(health.overall).toBeGreaterThanOrEqual(0);
  });

  it("large dependency chain cascades correctly", () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const project = makeProject();
    const chainLength = 5;
    const tasks: Task[] = [];
    for (let i = 0; i < chainLength; i++) {
      tasks.push(
        makeTask({
          id: `chain-${i}`,
          name: `Chain ${i}`,
          startDate: `2025-01-${String(i * 5 + 1).padStart(2, "0")}`,
          dueDate: `2025-01-${String(i * 5 + 5).padStart(2, "0")}`,
          dependencies: i > 0 ? [`chain-${i - 1}`] : [],
        }),
      );
    }

    const validation = validateSchedule(tasks);
    expect(validation.isValid).toBe(true);
    expect(validation.order).toHaveLength(chainLength);

    const cp = criticalPath(tasks);
    // All tasks in a linear chain should be on the critical path
    expect(cp.taskIds).toHaveLength(chainLength);
    expect(cp.taskIds[0]).toBe("chain-0");
    expect(cp.taskIds[chainLength - 1]).toBe(`chain-${chainLength - 1}`);
    expect(cp.totalDuration).toBeGreaterThan(0);
  });
});

// ── Export Pipeline ──────────────────────────────────

describe("Integration: export pipeline", () => {
  const project = makeProject();
  const contractors: Contractor[] = [
    {
      id: "c1",
      name: "ABC Construction",
      createdAt: NOW,
      updatedAt: NOW,
    },
  ];

  const tasks: Task[] = [
    makeTask({
      id: "t1",
      name: "Demolition",
      status: "done",
      progress: 100,
      startDate: "2025-01-01",
      dueDate: "2025-01-05",
      contractorId: "c1",
    }),
    makeTask({
      id: "t2",
      name: "Framing",
      status: "in_progress",
      progress: 40,
      startDate: "2025-01-06",
      dueDate: "2025-01-15",
      contractorId: "c1",
      dependencies: ["t1"],
      materials: ["2x4 lumber", "nails"],
    }),
    makeTask({
      id: "t3",
      name: "Painting",
      status: "todo",
      progress: 0,
      startDate: "2025-01-16",
      dueDate: "2025-01-20",
      dependencies: ["t2"],
    }),
  ];

  it("project -> ICS export", () => {
    const ics = exportToICS(project, tasks, "2025-01-05");
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("END:VCALENDAR");
    // 3 tasks with dates = 3 events
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(3);
    expect(ics).toContain("Demolition");
    expect(ics).toContain("Framing");
    expect(ics).toContain("Painting");
    // task starting within 3 days should have alarm
    expect(ics).toContain("BEGIN:VALARM");
  });

  it("project -> daily report", () => {
    const input: DailyReportInput = {
      project,
      date: "2025-01-10",
      weather: "Sunny",
      tasks,
      contractors,
      issues: ["Slight delay on framing"],
    };

    const reportData = gatherReportData(input);
    expect(reportData.projectName).toBe("Integration Test Project");
    expect(reportData.weather).toBe("Sunny");
    expect(reportData.workCompleted.length).toBeGreaterThan(0);
    expect(reportData.workersPresent).toContain("ABC Construction");

    const html = generateDailyReport(input);
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("作業日報");
    expect(html).toContain("Integration Test Project");
    expect(html).toContain("Sunny");
    expect(html).toContain("Slight delay on framing");
  });

  it("project -> EV report text", () => {
    const progressTasks: ProgressTask[] = tasks.map((t) => ({
      ...t,
      plannedCost: 5000,
    }));

    const report = generateEVReport(project, progressTasks, undefined, "2025-01-10");
    expect(report).toContain("Integration Test Project");
    expect(report).toContain("SPI:");
    expect(report).toContain("CPI:");
    expect(report).toContain("Progress:");
  });

  it("project -> health report HTML", () => {
    const progressTasks: ProgressTask[] = tasks.map((t) => ({
      ...t,
      plannedCost: 5000,
    }));

    const html = generateHealthReport({
      project,
      tasks: progressTasks,
      inspectionPassRate: 0.92,
      asOfDate: "2025-01-10",
    });

    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("Project Health Report");
    expect(html).toContain("Integration Test Project");
    expect(html).toContain("Grade:");
    expect(html).toContain("SCHEDULE");
    expect(html).toContain("COST");
    expect(html).toContain("QUALITY");
    expect(html).toContain("RISK");
    expect(html).toContain("Recommendations");
  });

  it("full export pipeline produces consistent data", () => {
    const progressTasks: ProgressTask[] = tasks.map((t) => ({
      ...t,
      plannedCost: 5000,
      actualCost: t.status === "done" ? 5200 : undefined,
    }));

    // All exports should succeed without errors
    const ics = exportToICS(project, tasks, "2025-01-10");
    const dailyHtml = generateDailyReport({
      project,
      date: "2025-01-10",
      tasks,
      contractors,
    });
    const evReport = generateEVReport(project, progressTasks, undefined, "2025-01-10");
    const healthHtml = generateHealthReport({
      project,
      tasks: progressTasks,
      asOfDate: "2025-01-10",
    });

    // All outputs are non-empty strings
    expect(ics.length).toBeGreaterThan(100);
    expect(dailyHtml.length).toBeGreaterThan(100);
    expect(evReport.length).toBeGreaterThan(50);
    expect(healthHtml.length).toBeGreaterThan(100);

    // Project name appears in all reports
    expect(ics).toContain("Integration Test Project");
    expect(dailyHtml).toContain("Integration Test Project");
    expect(evReport).toContain("Integration Test Project");
    expect(healthHtml).toContain("Integration Test Project");
  });
});
