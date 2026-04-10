import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { GanttTaskLabel } from "./GanttTaskBar.js";
import type { GanttTask } from "./types.js";

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
