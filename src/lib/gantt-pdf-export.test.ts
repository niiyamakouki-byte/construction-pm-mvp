import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Project, Task } from "../domain/types.js";
import {
  buildGanttPdfHtml,
  computePrintScale,
  exportGanttToPdf,
  measureLabelWidth,
  truncateLabel,
} from "./gantt-pdf-export.js";

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

describe("measureLabelWidth", () => {
  it("counts full-width Japanese characters as 2 columns and ASCII as 1", () => {
    expect(measureLabelWidth("内装")).toBe(4); // 全角2文字
    expect(measureLabelWidth("AB12")).toBe(4); // 半角4文字
    expect(measureLabelWidth("床A")).toBe(3); // 全角1 + 半角1
    expect(measureLabelWidth("")).toBe(0);
  });
});

describe("truncateLabel", () => {
  it("leaves a short Japanese name untouched", () => {
    expect(truncateLabel("墨出し", 28)).toBe("墨出し");
  });

  it("truncates a long Japanese name with an ellipsis without exceeding the budget", () => {
    const longName = "システムキッチン解体撤去および給排水配管位置変更に伴う下地補修工事一式";
    const result = truncateLabel(longName, 28);

    expect(result).not.toBe(longName);
    expect(result.endsWith("…")).toBe(true);
    // 省略後（…込み）の表示幅が予算を超えないこと＝印刷で溢れない一貫ルール
    expect(measureLabelWidth(result)).toBeLessThanOrEqual(28);
  });

  it("returns an empty string for a non-positive budget", () => {
    expect(truncateLabel("内装工事", 0)).toBe("");
  });
});

describe("computePrintScale", () => {
  it("shrinks content that is wider than the printable page so it fits on one page", () => {
    // 90日チャート(180ラベル+1800)はA4横の印刷可能幅を超えるため縮小される
    const scale = computePrintScale(1980, 1040);
    expect(scale).toBeLessThan(1);
    expect(1980 * scale).toBeCloseTo(1040, 5);
  });

  it("does not enlarge content that already fits (typical 30-day project)", () => {
    expect(computePrintScale(780, 1040)).toBe(1);
  });

  it("returns 1 for invalid dimensions", () => {
    expect(computePrintScale(0, 1040)).toBe(1);
    expect(computePrintScale(1980, 0)).toBe(1);
  });
});

describe("gantt pdf print layout", () => {
  it("declares A4 landscape and scales the chart to fit the page width", () => {
    const tasks = Array.from({ length: 6 }, (_, i) =>
      createTask({
        id: `t${i}`,
        name: `工程${i}`,
        startDate: "2026-04-01",
        dueDate: "2026-09-15",
      }),
    );
    const html = buildGanttPdfHtml(createProject(), tasks, "2026-04-01", 180);

    expect(html).toContain("@page { size: A4 landscape;");
    expect(html).toContain("gantt-scale");
    expect(html).toMatch(/transform: scale\(0\.\d+\)/); // 90日上限で1ページ幅を超え縮小
  });

  it("truncates a long task name in the printed label with an ellipsis", () => {
    const longName = "システムキッチン解体撤去および給排水配管位置変更に伴う下地補修工事一式";
    const html = buildGanttPdfHtml(
      createProject(),
      [createTask({ name: longName })],
      "2026-04-01",
      30,
    );

    expect(html).toContain("…</span>");
    expect(html).not.toContain(`${longName}</span>`);
    // フルネームは title 属性に保持される
    expect(html).toContain(`title="${longName}"`);
  });
});
