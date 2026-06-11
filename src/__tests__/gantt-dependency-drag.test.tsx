import { createRef } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GanttChart } from "../components/gantt/GanttChart.js";
import { resolveDependencyDrop } from "../components/gantt/utils.js";
import type { ChartLayout, GanttTask } from "../components/gantt/types.js";

// ── 純粋関数: ドラッグ接続の確定判定 ─────────────────────────────────

describe("resolveDependencyDrop", () => {
  const tasks = [
    { id: "a", dependencies: [] as string[] },
    { id: "b", dependencies: [] as string[] },
    { id: "c", dependencies: ["b"] },
  ];

  it("別バーへドロップすると先行→後続の依存が確定する", () => {
    const result = resolveDependencyDrop(tasks, "a", "b");
    expect(result).toEqual({ ok: true, fromTaskId: "a", toTaskId: "b" });
  });

  it("自分自身へのドロップは無効", () => {
    expect(resolveDependencyDrop(tasks, "a", "a")).toEqual({ ok: false, reason: "self" });
  });

  it("バー外（接続先なし）でドロップするとキャンセル扱いになる", () => {
    expect(resolveDependencyDrop(tasks, "a", null)).toEqual({ ok: false, reason: "no-target" });
  });

  it("既に張られている依存は重複として無効", () => {
    expect(resolveDependencyDrop(tasks, "b", "c")).toEqual({ ok: false, reason: "duplicate" });
  });

  it("循環する向き（c→b）は無効", () => {
    // c は既に b に依存しているため、b→c の逆向き接続は循環になる
    expect(resolveDependencyDrop(tasks, "c", "b")).toEqual({ ok: false, reason: "cycle" });
  });
});

// ── コンポーネント: バードラッグで依存を張る ────────────────────────

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
  highlightedDates: [],
  todayOffset: 2,
  dayWidth: 36,
};

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
    progress: 25,
    dependencies: [],
    isDateEstimated: false,
    isMilestone: false,
    projectIncludesWeekends: true,
    ...overrides,
  };
}

function renderChart(onConnectTasks: ReturnType<typeof vi.fn>) {
  const t1 = makeTask({ id: "t1", name: "工程A" });
  const t2 = makeTask({ id: "t2", name: "工程B" });
  return render(
    <GanttChart
      ganttTasks={[t1, t2]}
      visibleRows={[
        { type: "task", task: t1 },
        { type: "task", task: t2 },
      ]}
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
      onConnectTasks={onConnectTasks}
    />,
  );
}

const originalElementFromPoint = document.elementFromPoint;

afterEach(() => {
  document.elementFromPoint = originalElementFromPoint;
  cleanup();
});

describe("GanttChart バードラッグ接続", () => {
  it("ハンドルから別バーへドラッグすると onConnectTasks(先行, 後続) が呼ばれる", () => {
    const onConnectTasks = vi.fn();
    const { container } = renderChart(onConnectTasks);

    const handle = screen.getByRole("button", { name: "依存関係を接続: 工程A" });
    fireEvent.pointerDown(handle, { clientX: 100, clientY: 20 });

    // ドラッグ中はプレビュー線が描画される
    expect(screen.getByTestId("connect-drag-preview")).toBeTruthy();

    const targetBar = container.querySelector('[data-task-id="t2"]') as HTMLElement;
    document.elementFromPoint = vi.fn().mockReturnValue(targetBar);

    fireEvent.pointerMove(window, { clientX: 200, clientY: 70 });
    fireEvent.pointerUp(window, { clientX: 200, clientY: 70 });

    expect(onConnectTasks).toHaveBeenCalledWith("t1", "t2");
    // 接続後はプレビュー状態が残らない
    expect(screen.queryByTestId("connect-drag-preview")).toBeNull();
  });

  it("自分自身のバー上でドロップしても接続されない", () => {
    const onConnectTasks = vi.fn();
    const { container } = renderChart(onConnectTasks);

    const handle = screen.getByRole("button", { name: "依存関係を接続: 工程A" });
    fireEvent.pointerDown(handle, { clientX: 100, clientY: 20 });

    const selfBar = container.querySelector('[data-task-id="t1"]') as HTMLElement;
    document.elementFromPoint = vi.fn().mockReturnValue(selfBar);

    fireEvent.pointerUp(window, { clientX: 100, clientY: 20 });

    expect(onConnectTasks).not.toHaveBeenCalled();
    expect(screen.queryByTestId("connect-drag-preview")).toBeNull();
  });

  it("バー外でドロップするとキャンセルされ、接続もプレビュー状態も残らない", () => {
    const onConnectTasks = vi.fn();
    renderChart(onConnectTasks);

    const handle = screen.getByRole("button", { name: "依存関係を接続: 工程A" });
    fireEvent.pointerDown(handle, { clientX: 100, clientY: 20 });
    expect(screen.getByTestId("connect-drag-preview")).toBeTruthy();

    // バー以外（data-task-id を持たない要素）の上で離す
    document.elementFromPoint = vi.fn().mockReturnValue(document.body);

    fireEvent.pointerUp(window, { clientX: 5, clientY: 5 });

    expect(onConnectTasks).not.toHaveBeenCalled();
    expect(screen.queryByTestId("connect-drag-preview")).toBeNull();
  });
});
