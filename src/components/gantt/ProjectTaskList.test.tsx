import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ProjectTaskList } from "./ProjectTaskList.js";
import type { GanttTask } from "./types.js";

afterEach(() => cleanup());

function makeTask(overrides: Partial<GanttTask>): GanttTask {
  return {
    id: "t1",
    createdAt: "2025-01-01T00:00:00.000Z",
    updatedAt: "2025-01-01T00:00:00.000Z",
    projectId: "p1",
    projectName: "Project",
    name: "Task",
    description: "",
    status: "todo",
    startDate: "2025-01-01",
    dueDate: "2025-01-03",
    endDate: "2025-01-03",
    progress: 0,
    dependencies: [],
    isDateEstimated: false,
    isMilestone: false,
    projectIncludesWeekends: true,
    ...overrides,
  };
}

describe("ProjectTaskList", () => {
  it("groups tasks by 工種(majorCategory) and lists them", () => {
    const tasks = [
      makeTask({ id: "a", name: "墨出し", majorCategory: "仮設" }),
      makeTask({ id: "b", name: "配線", majorCategory: "電気" }),
      makeTask({ id: "c", name: "点検", majorCategory: undefined }),
    ];
    render(<ProjectTaskList tasks={tasks} today="2025-01-01" onOpenTaskDetail={() => {}} />);
    expect(screen.getByText("仮設")).toBeTruthy();
    expect(screen.getByText("電気")).toBeTruthy();
    expect(screen.getByText("その他")).toBeTruthy();
    expect(screen.getByText("墨出し")).toBeTruthy();
    expect(screen.getByText("3件の工程")).toBeTruthy();
  });

  it("calls onOpenTaskDetail when a row is tapped", () => {
    const onOpen = vi.fn();
    render(
      <ProjectTaskList
        tasks={[makeTask({ id: "x", name: "内装仕上げ", majorCategory: "内装" })]}
        today="2025-01-01"
        onOpenTaskDetail={onOpen}
      />,
    );
    fireEvent.click(screen.getByText("内装仕上げ"));
    expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ id: "x" }));
  });
});
