import { createRef } from "react";
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GanttChart } from "./GanttChart.js";
import type { ChartLayout, GanttTask } from "./types.js";
import type { Milestone } from "../../lib/milestone-tracker.js";

afterEach(() => cleanup());

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
  it("COMPASS型の固定3列ヘッダーとチャート内ズーム操作を表示する", () => {
    const onZoomIn = vi.fn();
    const onZoomOut = vi.fn();
    const { getByText, getByLabelText } = render(
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
        onConnectTasks={vi.fn()}
        onZoomIn={onZoomIn}
        onZoomOut={onZoomOut}
      />,
    );
    expect(getByText("タスク名")).toBeTruthy();
    expect(getByText("担当")).toBeTruthy();
    expect(getByText("進捗")).toBeTruthy();
    getByLabelText("拡大").click();
    getByLabelText("縮小").click();
    expect(onZoomIn).toHaveBeenCalledOnce();
    expect(onZoomOut).toHaveBeenCalledOnce();
  });

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
        onConnectTasks={vi.fn()}
      />,
    );

    const timeline = container.querySelector(".mobile-scroll-x > div");
    expect(timeline).not.toBeNull();
    expect((timeline as HTMLDivElement).style.width).toBe("108px");
  });

  it("renders holidays with a light red header background", () => {
    const holidayLayout: ChartLayout = {
      ...chartLayout,
      dateInfo: [
        {
          date: "2025-01-01",
          isToday: false,
          isWeekend: false,
          isHoliday: true,
          holidayName: "元日",
        },
        ...chartLayout.dateInfo.slice(1),
      ],
    };

    const { container } = render(
      <GanttChart
        ganttTasks={[task]}
        visibleRows={[{ type: "task", task }]}
        chartLayout={holidayLayout}
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
        onConnectTasks={vi.fn()}
      />,
    );

    const holidayCell = container.querySelector('[title="元日"]');
    expect(holidayCell).not.toBeNull();
    expect(holidayCell?.className).toContain("bg-rose-50");
  });

  // P2: マイルストーン ◆ マーカー描画
  it("マイルストーンが◆(rotate-45)で描画される", () => {
    const milestones: Milestone[] = [
      {
        id: "ms1",
        projectId: "p1",
        name: "内装検査",
        targetDate: "2025-01-02",
        status: "on-track",
      },
    ];

    const { getByTestId } = render(
      <GanttChart
        ganttTasks={[task]}
        visibleRows={[{ type: "task", task }]}
        chartLayout={chartLayout}
        dragState={null}
        dragRef={{ current: null }}
        connectMode={false}
        connectState={null}
        milestones={milestones}
        showMilestones={true}
        today="2025-01-03"
        scrollRef={createRef<HTMLDivElement>()}
        onTaskDragStart={vi.fn()}
        onTaskResizeStart={vi.fn()}
        onOpenTaskDetail={vi.fn()}
        onOpenQuickAdd={vi.fn()}
        onTogglePhase={vi.fn()}
        onSetConnectState={vi.fn()}
        onConnectTask={vi.fn()}
        onConnectTasks={vi.fn()}
      />,
    );

    const marker = getByTestId("milestone-marker") as HTMLElement;
    expect(marker.dataset.milestoneStatus).toBe("on-track");
    // ◆形状（rotate-45 の正方形）を確認
    const diamond = marker.querySelector("span[aria-label^='マイルストーン']");
    expect(diamond).toBeTruthy();
    expect(diamond?.className).toContain("rotate-45");
  });

  it("マイルストーンラベルを◆の横に固定してタスクバッジ帯から分離する", () => {
    const milestones: Milestone[] = [
      {
        id: "ms-overdue",
        projectId: "p1",
        name: "クロス貼り検証タスク完了",
        targetDate: "2025-01-03",
        status: "missed",
      },
    ];

    const { getByTestId } = render(
      <GanttChart
        ganttTasks={[task]}
        visibleRows={[{ type: "task", task }]}
        chartLayout={chartLayout}
        dragState={null}
        dragRef={{ current: null }}
        connectMode={false}
        connectState={null}
        milestones={milestones}
        showMilestones={true}
        today="2025-01-04"
        scrollRef={createRef<HTMLDivElement>()}
        onTaskDragStart={vi.fn()}
        onTaskResizeStart={vi.fn()}
        onOpenTaskDetail={vi.fn()}
        onOpenQuickAdd={vi.fn()}
        onTogglePhase={vi.fn()}
        onSetConnectState={vi.fn()}
        onConnectTask={vi.fn()}
        onConnectTasks={vi.fn()}
      />,
    );

    const label = getByTestId("milestone-label");
    expect(label.className).toContain("absolute");
    expect(label.className).toContain("left-full");
    expect(label.className).toContain("-translate-y-1/2");
    expect(label.className).toContain("whitespace-nowrap");
  });

  it("showMilestones=false のときはマイルストーンが非表示", () => {
    const milestones: Milestone[] = [
      {
        id: "ms1",
        projectId: "p1",
        name: "内装検査",
        targetDate: "2025-01-02",
        status: "on-track",
      },
    ];

    const { queryByTestId } = render(
      <GanttChart
        ganttTasks={[task]}
        visibleRows={[{ type: "task", task }]}
        chartLayout={chartLayout}
        dragState={null}
        dragRef={{ current: null }}
        connectMode={false}
        connectState={null}
        milestones={milestones}
        showMilestones={false}
        today="2025-01-03"
        scrollRef={createRef<HTMLDivElement>()}
        onTaskDragStart={vi.fn()}
        onTaskResizeStart={vi.fn()}
        onOpenTaskDetail={vi.fn()}
        onOpenQuickAdd={vi.fn()}
        onTogglePhase={vi.fn()}
        onSetConnectState={vi.fn()}
        onConnectTask={vi.fn()}
        onConnectTasks={vi.fn()}
      />,
    );

    expect(queryByTestId("milestone-marker")).toBeNull();
  });

  // 票g0zed: taskId紐づけ済み発注の納期マーカー（紐づけロジック: 行ごとの絞り込み）
  it("orderMarkersはtaskIdが一致する行にだけ描画される（別タスクの行には出ない）", () => {
    const otherTask: GanttTask = { ...task, id: "t2", name: "Other" };
    const { getAllByTestId } = render(
      <GanttChart
        ganttTasks={[task, otherTask]}
        visibleRows={[
          { type: "task", task },
          { type: "task", task: otherTask },
        ]}
        chartLayout={chartLayout}
        dragState={null}
        dragRef={{ current: null }}
        connectMode={false}
        connectState={null}
        orderMarkers={[
          { orderId: "po-1", taskId: task.id, contractorName: "山田内装工業", deliveryDate: "2025-01-02" },
        ]}
        today="2025-01-03"
        scrollRef={createRef<HTMLDivElement>()}
        onTaskDragStart={vi.fn()}
        onTaskResizeStart={vi.fn()}
        onOpenTaskDetail={vi.fn()}
        onOpenQuickAdd={vi.fn()}
        onTogglePhase={vi.fn()}
        onSetConnectState={vi.fn()}
        onConnectTask={vi.fn()}
        onConnectTasks={vi.fn()}
      />,
    );

    // 2タスク中1つだけ紐づいているので、マーカーは1つだけ描画される
    expect(getAllByTestId("order-delivery-marker")).toHaveLength(1);
  });
});
