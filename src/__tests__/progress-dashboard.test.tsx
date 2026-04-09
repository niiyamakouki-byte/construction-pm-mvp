import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import type { Project } from "../domain/types.js";
import type { ProgressTask } from "../lib/progress-tracker.js";
import { ProgressDashboard } from "../components/ProgressDashboard.js";

function makeTask(overrides: Partial<ProgressTask> & { id: string; name: string }): ProgressTask {
  return {
    projectId: "p1",
    description: "",
    status: "todo",
    progress: 0,
    dependencies: [],
    createdAt: "2025-01-01T00:00:00.000Z",
    updatedAt: "2025-01-01T00:00:00.000Z",
    ...overrides,
  };
}

const baseProject: Project = {
  id: "p1",
  name: "Dashboard Test Project",
  description: "",
  status: "active",
  startDate: "2025-01-01",
  includeWeekends: false,
  budget: 100000,
  createdAt: "2025-01-01T00:00:00.000Z",
  updatedAt: "2025-01-01T00:00:00.000Z",
};

describe("ProgressDashboard", () => {
  it("renders the project name", () => {
    const tasks = [
      makeTask({ id: "a", name: "Foundation", startDate: "2025-01-01", dueDate: "2025-01-10", progress: 50, status: "in_progress" }),
    ];
    render(<ProgressDashboard project={baseProject} tasks={tasks} asOfDate="2025-01-05" />);
    expect(screen.getByText("Dashboard Test Project")).toBeTruthy();
  });

  it("shows the progress bar", () => {
    const tasks = [
      makeTask({ id: "a", name: "A", startDate: "2025-01-01", dueDate: "2025-01-10", progress: 60, status: "in_progress" }),
    ];
    render(<ProgressDashboard project={baseProject} tasks={tasks} asOfDate="2025-01-05" />);
    const progressBars = screen.getAllByRole("progressbar");
    expect(progressBars.length).toBeGreaterThan(0);
    expect(progressBars[0].getAttribute("aria-valuenow")).toBeDefined();
  });

  it("displays SPI, CPI, EAC labels", () => {
    const tasks = [
      makeTask({ id: "a", name: "A", startDate: "2025-01-01", dueDate: "2025-01-10", progress: 50, status: "in_progress" }),
    ];
    render(<ProgressDashboard project={baseProject} tasks={tasks} asOfDate="2025-01-05" />);
    expect(screen.getAllByText("SPI").length).toBeGreaterThan(0);
    expect(screen.getAllByText("CPI").length).toBeGreaterThan(0);
    expect(screen.getAllByText("EAC").length).toBeGreaterThan(0);
  });

  it("shows schedule health indicator", () => {
    const tasks = [
      makeTask({ id: "a", name: "A", startDate: "2025-01-01", dueDate: "2025-01-10", progress: 100, status: "done" }),
    ];
    render(<ProgressDashboard project={baseProject} tasks={tasks} asOfDate="2025-01-05" />);
    // ahead of schedule since 100% at midpoint
    expect(screen.getAllByText(/Schedule health:/).length).toBeGreaterThan(0);
  });

  it("displays critical path tasks", () => {
    const tasks = [
      makeTask({ id: "a", name: "Foundation", startDate: "2025-01-01", dueDate: "2025-01-05", progress: 100, status: "done" }),
      makeTask({ id: "b", name: "Framing", startDate: "2025-01-06", dueDate: "2025-01-10", progress: 50, status: "in_progress", dependencies: ["a"] }),
    ];
    render(<ProgressDashboard project={baseProject} tasks={tasks} asOfDate="2025-01-08" />);
    expect(screen.getAllByText("Foundation").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Framing").length).toBeGreaterThan(0);
  });

  it("renders with empty tasks", () => {
    render(<ProgressDashboard project={baseProject} tasks={[]} asOfDate="2025-01-05" />);
    expect(screen.getAllByText("Dashboard Test Project").length).toBeGreaterThan(0);
  });

  it("shows behind schedule health when SPI < 0.95", () => {
    const tasks = [
      makeTask({ id: "a", name: "A", startDate: "2025-01-01", dueDate: "2025-01-20", progress: 10, status: "in_progress" }),
    ];
    render(<ProgressDashboard project={baseProject} tasks={tasks} asOfDate="2025-01-15" />);
    expect(screen.getAllByText(/behind/).length).toBeGreaterThan(0);
  });
});
