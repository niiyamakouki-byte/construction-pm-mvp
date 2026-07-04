import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GanttTaskBar, GanttTaskLabel } from "./GanttTaskBar.js";
import type { ChartDateInfo, GanttTask } from "./types.js";

afterEach(() => cleanup());

const baseTask: GanttTask = {
  id: "t1",
  createdAt: "2025-01-01T00:00:00.000Z",
  updatedAt: "2025-01-01T00:00:00.000Z",
  projectId: "p1",
  projectName: "Project",
  name: "荒配線",
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
};

describe("GanttTaskLabel - 大項目バッジ", () => {
  it("majorCategoryが設定されていればバッジが表示される", () => {
    const { container } = render(
      <GanttTaskLabel
        task={{ ...baseTask, majorCategory: "電気工事" }}
        today="2025-01-02"
        connectMode={false}
        onOpenTaskDetail={vi.fn()}
      />,
    );
    const badge = container.querySelector("span.rounded-full");
    expect(badge).toBeTruthy();
    expect(badge?.textContent).toBe("電気工事");
  });

  it("majorCategoryがなければバッジは表示されない", () => {
    const { container } = render(
      <GanttTaskLabel
        task={baseTask}
        today="2025-01-02"
        connectMode={false}
        onOpenTaskDetail={vi.fn()}
      />,
    );
    const badge = container.querySelector("span.rounded-full");
    expect(badge).toBeNull();
  });

  it("バッジに正しいbgColorが適用される", () => {
    const { container } = render(
      <GanttTaskLabel
        task={{ ...baseTask, majorCategory: "仮設工事" }}
        today="2025-01-02"
        connectMode={false}
        onOpenTaskDetail={vi.fn()}
      />,
    );
    const badge = container.querySelector("span.rounded-full") as HTMLElement;
    expect(badge).toBeTruthy();
    expect(badge.style.backgroundColor).toBe("rgb(148, 163, 184)"); // #94a3b8
  });
});

// ────────────────────────────────────────────────────────────────
// P2: タスク行の情報量（バー内の進捗塗り分け・担当者名・完了グレー）
// ────────────────────────────────────────────────────────────────

function renderBar(task: GanttTask, overrides: Partial<Parameters<typeof GanttTaskBar>[0]> = {}) {
  const dragRef = { current: null };
  const highlightedDates: ChartDateInfo[] = [];
  return render(
    <GanttTaskBar
      task={task}
      dragState={null}
      dragRef={dragRef}
      connectMode={false}
      connectState={null}
      chartStart="2025-01-01"
      highlightedDates={highlightedDates}
      today="2025-01-02"
      dayWidth={40}
      onTaskDragStart={vi.fn()}
      onTaskResizeStart={vi.fn()}
      onOpenTaskDetail={vi.fn()}
      onSetConnectState={vi.fn()}
      onConnectTask={vi.fn()}
      onConnectDragStart={vi.fn()}
      {...overrides}
    />,
  );
}

describe("GanttTaskBar - P2 進捗塗り分け", () => {
  it("progress=60 のとき進捗フィルの width が 60% になる", () => {
    const { getByTestId } = renderBar({ ...baseTask, progress: 60 });
    const fill = getByTestId("progress-fill") as HTMLElement;
    expect(fill.style.width).toBe("60%");
  });

  it("progress=0 のとき進捗フィルは 0% になる（見えない）", () => {
    const { getByTestId } = renderBar({ ...baseTask, progress: 0 });
    const fill = getByTestId("progress-fill") as HTMLElement;
    expect(fill.style.width).toBe("0%");
  });

  it("progress=100 のとき進捗フィルはバー全域を覆う", () => {
    const { getByTestId } = renderBar({ ...baseTask, progress: 100 });
    const fill = getByTestId("progress-fill") as HTMLElement;
    expect(fill.style.width).toBe("100%");
  });

  it("progress>100 でも 100% にクランプされる", () => {
    const { getByTestId } = renderBar({ ...baseTask, progress: 150 });
    const fill = getByTestId("progress-fill") as HTMLElement;
    expect(fill.style.width).toBe("100%");
  });

  it("status=done なのに progress=0(未同期)でも進捗フィルは100%表示になり、期限切バッジも出ない (regression construction_pm_mvp-7ry)", () => {
    const { getByTestId, queryByText } = renderBar(
      { ...baseTask, status: "done", progress: 0, dueDate: "2025-01-03", endDate: "2025-01-03" },
      { today: "2025-06-01" },
    );
    const fill = getByTestId("progress-fill") as HTMLElement;
    expect(fill.style.width).toBe("100%");
    expect(queryByText("期限切")).toBeNull();
  });
});

describe("GanttTaskBar - P2 完了タスクのグレー化", () => {
  it("status=done なら進捗フィル色はグレー(#94a3b8)", () => {
    const { getByTestId } = renderBar({ ...baseTask, status: "done", progress: 100 });
    const fill = getByTestId("progress-fill") as HTMLElement;
    // rgb(148,163,184) === #94a3b8
    expect(fill.style.backgroundColor).toBe("rgb(148, 163, 184)");
  });

  it("status=in_progress ならグレーではない", () => {
    const { getByTestId } = renderBar({ ...baseTask, status: "in_progress", progress: 40 });
    const fill = getByTestId("progress-fill") as HTMLElement;
    expect(fill.style.backgroundColor).not.toBe("rgb(148, 163, 184)");
  });
});

describe("GanttTaskBar - P2 担当者名表示", () => {
  it("バーが十分広ければ協力会社名が描画される", () => {
    // dayWidth=40 * duration=2 = barWidth 80... 幅を稼ぐため dayWidth=80 に上げる
    const { getByText } = renderBar(
      { ...baseTask, contractorName: "山田工務店" },
      { dayWidth: 80 },
    );
    expect(getByText("山田工務店")).toBeTruthy();
  });

  it("contractorName が無いときは代わりに日付レンジが表示される（barWidth>=144）", () => {
    const { container } = renderBar(baseTask, { dayWidth: 100 });
    // 「山田工務店」のような担当者名は出ないはず
    expect(container.querySelector("p.text-white\\/85")).toBeNull();
  });
});

describe("GanttTaskBar - P2.5 依存ハンドル", () => {
  it("依存関係ハンドルが aria-label 付きで存在する", () => {
    const { getByLabelText } = renderBar({ ...baseTask, name: "内装工事" });
    expect(getByLabelText("依存関係を接続: 内装工事")).toBeTruthy();
  });
});
