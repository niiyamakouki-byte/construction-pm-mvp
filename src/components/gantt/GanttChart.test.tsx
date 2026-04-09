import { createRef } from "react";
import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { GanttChart } from "./GanttChart.js";
import type { ChartLayout, GanttTask } from "./types.js";

const chartLayout: ChartLayout = {
  chartStart: "2025-01-01",
  chartEnd: "2025-01-03",
  totalDays: 2,
  isCapped: false,
  dates: ["2025-01-01", "2025-01-02", "2025-01-03"],
  dateInfo: [
    { date: "2025-01-01", isToday: false, isWeekend: false, isHoliday: false, holidayName: null },
    { date: "2025-01-02", isToday: false, isWeekend: false, isHoliday: false, holidayName: null },
    { date: "2025-01-03", isToday: true, isWeekend: false, isHoliday: false, holidayName: null },
  ],
  highlightedDates: [{ date: "2025-01-03", isToday: true, isWeekend: false, isHoliday: false, holidayName: null }],
  todayOffset: 2,
  dayWidth: 36,
};

const task: GanttTask = {
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
  progress: 25,
  dependencies: [],
  isDateEstimated: false,
  isMilestone: false,
  projectIncludesWeekends: true,
};

describe("GanttChart", () => {
  it("sizes the timeline for every rendered date column", () => {
    const { container } = render(
      <GanttChart
        ganttTasks={[task]}
        visibleRows={[{ type: "task", task }]}
        chartLayout={chartLayout}
        dragState={null}
        dragRef={{ current: null }}
        connectMode={false}
        connectState={null}
        today="2025-01-03"
        scrollRef={createRef<HTMLDivElement>()}
        onTaskDragStart={vi.fn()}
        onTaskResizeStart={vi.fn()}
        onOpenTaskDetail={vi.fn()}
        onOpenQuickAdd={vi.fn()}
        onTogglePhase={vi.fn()}
        onSetConnectState={vi.fn()}
        onConnectTask={vi.fn()}
      />,
    );

    const timeline = container.querySelector(".mobile-scroll-x > div");
    expect(timeline).not.toBeNull();
    expect((timeline as HTMLDivElement).style.width).toBe("108px");
  });
});
