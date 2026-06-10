import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Project, Task } from "../domain/types.js";
import { buildGanttPdfHtml, exportGanttToPdf } from "./gantt-pdf-export.js";

function createProject(overrides: Partial<Project> = {}): Project {
  return {
    id: "p1",
    name: "渋谷オフィス改修",
    description: "",
    status: "active",
    startDate: "2025-01-06",
    includeWeekends: false,
    createdAt: "2025-01-01T00:00:00.000Z",
    updatedAt: "2025-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function createTask(overrides: Partial<Task> = {}): Task {
  return {
    id: "t1",
    projectId: "p1",
    name: "墨出し",
    description: "",
    status: "todo",
    startDate: "2025-01-06",
    dueDate: "2025-01-08",
    progress: 0,
    dependencies: [],
    createdAt: "2025-01-01T00:00:00.000Z",
    updatedAt: "2025-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("gantt pdf export", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("contains the project name in the generated HTML", () => {
    const html = buildGanttPdfHtml(createProject(), [], "2025-01-04", 12);

    expect(html).toContain("渋谷オフィス改修");
  });

  it("contains task names in the generated HTML", () => {
    const html = buildGanttPdfHtml(
      createProject(),
      [
        createTask(),
        createTask({ id: "t2", name: "配線工事", startDate: "2025-01-09", dueDate: "2025-01-12" }),
      ],
      "2025-01-04",
      12,
    );

    expect(html).toContain("墨出し");
    expect(html).toContain("配線工事");
  });

  it("escapes special characters in project and task values", () => {
    const html = buildGanttPdfHtml(
      createProject({ name: `渋谷 & <改修> "A" 'B'` }),
      [
        createTask({
          name: `設備 & <点検> "A" 'B'`,
        }),
      ],
      "2025-01-04",
      12,
    );

    expect(html).toContain("渋谷 &amp; &lt;改修&gt; &quot;A&quot; &#39;B&#39;");
    expect(html).toContain("設備 &amp; &lt;点検&gt; &quot;A&quot; &#39;B&#39;");
    expect(html).not.toContain(`設備 & <点検> "A" 'B'`);
  });

  it("shows dependency labels using task names", () => {
    const html = buildGanttPdfHtml(
      createProject(),
      [
        createTask({ id: "t1", name: "先行工事" }),
        createTask({
          id: "t2",
          name: "後続工事",
          startDate: "2025-01-09",
          dueDate: "2025-01-12",
          dependencies: ["t1"],
        }),
      ],
      "2025-01-04",
      12,
    );

    expect(html).toContain("依存関係");
    expect(html).toContain("先行工事");
  });

  it("renders an empty state when there are no tasks", () => {
    const html = buildGanttPdfHtml(createProject(), [], "2025-01-04", 12);

    expect(html).toContain("出力対象のタスクはありません。");
    expect(html).not.toContain("<table>");
  });

  it("includes the issued date in 発行日: YYYY年M月D日 format", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2025, 0, 15, 10, 30));
    try {
      const html = buildGanttPdfHtml(createProject(), [createTask()], "2025-01-04", 12);
      expect(html).toContain("発行日: 2025年1月15日");
    } finally {
      vi.useRealTimers();
    }
  });

  it("shows project period derived from task min/max dates", () => {
    const html = buildGanttPdfHtml(
      createProject(),
      [
        createTask({ id: "t1", name: "墨出し", startDate: "2025-01-06", dueDate: "2025-01-08" }),
        createTask({ id: "t2", name: "配線", startDate: "2025-01-10", dueDate: "2025-01-20" }),
      ],
      "2025-01-04",
      30,
    );

    expect(html).toContain("案件期間");
    expect(html).toContain("2025/1/6");
    expect(html).toContain("2025/1/20");
  });

  it("omits the auto-print script when autoPrint=false (preview mode)", () => {
    const html = buildGanttPdfHtml(
      createProject(),
      [createTask()],
      "2025-01-04",
      12,
      { autoPrint: false },
    );

    expect(html).not.toContain("window.print()");
  });

  it("includes the auto-print script by default (export mode)", () => {
    const html = buildGanttPdfHtml(createProject(), [createTask()], "2025-01-04", 12);

    expect(html).toContain("window.print()");
  });

  it("shows the project status label when present", () => {
    const html = buildGanttPdfHtml(
      createProject({ status: "active" }),
      [createTask()],
      "2025-01-04",
      12,
    );

    expect(html).toContain("ステータス");
    expect(html).toContain("進行中");
  });

  it("opens a new window and writes the printable HTML", () => {
    const documentOpen = vi.fn();
    const documentWrite = vi.fn();
    const documentClose = vi.fn();
    const focus = vi.fn();
    vi.spyOn(window, "open").mockReturnValue({
      document: {
        open: documentOpen,
        write: documentWrite,
        close: documentClose,
      },
      focus,
    } as unknown as Window);

    exportGanttToPdf(
      createProject(),
      [createTask(), createTask({ id: "t2", name: "配線工事", dependencies: ["t1"] })],
      "2025-01-04",
      12,
    );

    expect(window.open).toHaveBeenCalled();
    expect(documentOpen).toHaveBeenCalled();
    expect(documentWrite).toHaveBeenCalledWith(expect.stringContaining("工程名"));
    expect(documentWrite).toHaveBeenCalledWith(expect.stringContaining("配線工事"));
    expect(documentClose).toHaveBeenCalled();
    expect(focus).toHaveBeenCalled();
  });
});
