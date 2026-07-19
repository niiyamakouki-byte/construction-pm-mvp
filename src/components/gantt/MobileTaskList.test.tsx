import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MobileTaskList } from "./MobileTaskList.js";
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
    status: "in_progress",
    startDate: "2025-01-01",
    dueDate: "2025-01-03",
    endDate: "2025-01-03",
    progress: 40,
    dependencies: [],
    isDateEstimated: false,
    isMilestone: false,
    projectIncludesWeekends: true,
    ...overrides,
  };
}

const today = "2025-01-01";

describe("MobileTaskList", () => {
  it("renders 7 day sections and shows tasks overlapping the window", () => {
    const task = makeTask({ name: "内装工事", startDate: "2025-01-01", endDate: "2025-01-02" });
    render(
      <MobileTaskList tasks={[task]} today={today} onOpenTaskDetail={() => {}} onShowTimeline={() => {}} />,
    );
    // 7 day headers: 1/1..1/7
    expect(screen.getByText("1/1")).toBeTruthy();
    expect(screen.getByText("1/7")).toBeTruthy();
    expect(screen.getByText("今日")).toBeTruthy();
    expect(screen.getByText("明日")).toBeTruthy();
    // Task appears (on 1/1 it starts, on 1/2 it ends) → name shown at least once
    expect(screen.getAllByText("内装工事").length).toBeGreaterThan(0);
    // count summary
    expect(screen.getByText("1件の工程")).toBeTruthy();
  });

  it("calls onOpenTaskDetail when a task row is tapped", () => {
    const onOpen = vi.fn();
    const task = makeTask({ name: "電気配線", startDate: "2025-01-01", endDate: "2025-01-01" });
    render(<MobileTaskList tasks={[task]} today={today} onOpenTaskDetail={onOpen} onShowTimeline={() => {}} />);
    fireEvent.click(screen.getByText("電気配線"));
    expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ id: "t1", name: "電気配線" }));
  });

  it("shows a 開始 badge on the start day and 本日期限 for a task due today", () => {
    const startsToday = makeTask({ id: "t1", name: "新規着工", status: "in_progress", startDate: "2025-01-01", endDate: "2025-01-04" });
    const dueToday = makeTask({ id: "t2", name: "本日締め", status: "in_progress", startDate: "2024-12-30", endDate: "2025-01-01" });
    render(
      <MobileTaskList tasks={[startsToday, dueToday]} today={today} onOpenTaskDetail={() => {}} onShowTimeline={() => {}} />,
    );
    expect(screen.getAllByText("開始").length).toBeGreaterThan(0);
    expect(screen.getAllByText("本日期限").length).toBeGreaterThan(0);
  });

  it("renders empty state and fires onShowTimeline when no tasks in window", () => {
    const onShow = vi.fn();
    const farTask = makeTask({ startDate: "2025-03-01", endDate: "2025-03-05" });
    render(<MobileTaskList tasks={[farTask]} today={today} onOpenTaskDetail={() => {}} onShowTimeline={onShow} />);
    expect(screen.getByText("今日から7日間の工程はありません")).toBeTruthy();
    // empty-state CTA + top toolbar toggle both read "ガントを見る"
    fireEvent.click(screen.getAllByText("ガントを見る")[1]);
    expect(onShow).toHaveBeenCalled();
  });

  it("the ガントを見る toggle button fires onShowTimeline", () => {
    const onShow = vi.fn();
    const task = makeTask({ startDate: "2025-01-01", endDate: "2025-01-02" });
    render(<MobileTaskList tasks={[task]} today={today} onOpenTaskDetail={() => {}} onShowTimeline={onShow} />);
    const btn = screen.getByTestId("gantt-show-timeline");
    fireEvent.click(btn);
    expect(onShow).toHaveBeenCalled();
    // sanity: within header region the button label present
    expect(within(btn).getByText("ガントを見る")).toBeTruthy();
  });
});
