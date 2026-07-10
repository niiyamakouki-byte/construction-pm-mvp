import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CardBoardChart } from "./CardBoardChart.js";
import type { Task } from "../../domain/types.js";

afterEach(() => cleanup());

function makeTask(overrides: Partial<Task> & Pick<Task, "id">): Task {
  return {
    createdAt: "2025-01-01T00:00:00.000Z",
    updatedAt: "2025-01-01T00:00:00.000Z",
    projectId: "p1",
    name: overrides.id,
    description: "",
    status: "todo",
    startDate: null,
    dueDate: null,
    progress: 0,
    dependencies: [],
    ...overrides,
  };
}

describe("CardBoardChart", () => {
  it("renders one card per task with its name", () => {
    const tasks = [makeTask({ id: "a", name: "墨出し" }), makeTask({ id: "b", name: "解体" })];
    render(<CardBoardChart tasks={tasks} onMove={vi.fn()} onConnect={vi.fn()} onDisconnect={vi.fn()} />);

    expect(screen.getByTestId("card-a")).toBeTruthy();
    expect(screen.getByTestId("card-b")).toBeTruthy();
    expect(screen.getByText("墨出し")).toBeTruthy();
  });

  it("commits the new position on drag release", () => {
    const onMove = vi.fn();
    const tasks = [makeTask({ id: "a", canvasX: 100, canvasY: 50 })];
    render(<CardBoardChart tasks={tasks} onMove={onMove} onConnect={vi.fn()} onDisconnect={vi.fn()} />);

    const card = screen.getByTestId("card-a").querySelector("rect")!;
    const svg = screen.getByTestId("card-board-canvas").querySelector("svg")!;

    // pan defaults to (80,80), zoom 1: clientX/Y - 80 = canvas coords.
    fireEvent.mouseDown(card, { clientX: 180, clientY: 130 }); // canvas (100,50) == card pos → zero drag offset
    fireEvent.mouseMove(svg, { clientX: 200, clientY: 160 }); // canvas (120,80)
    fireEvent.mouseUp(svg);

    expect(onMove).toHaveBeenCalledWith("a", 120, 80);
  });

  it("creates a dependency when a card is dropped on another card's port", () => {
    const onConnect = vi.fn();
    const tasks = [makeTask({ id: "a" }), makeTask({ id: "b" })];
    render(<CardBoardChart tasks={tasks} onMove={vi.fn()} onConnect={onConnect} onDisconnect={vi.fn()} />);

    fireEvent.mouseDown(screen.getByTestId("port-out-a"));
    fireEvent.mouseUp(screen.getByTestId("port-in-b"));

    expect(onConnect).toHaveBeenCalledWith("a", "b");
  });

  it("does not create a self-dependency when dropped on its own port", () => {
    const onConnect = vi.fn();
    const tasks = [makeTask({ id: "a" })];
    render(<CardBoardChart tasks={tasks} onMove={vi.fn()} onConnect={onConnect} onDisconnect={vi.fn()} />);

    fireEvent.mouseDown(screen.getByTestId("port-out-a"));
    fireEvent.mouseUp(screen.getByTestId("port-in-a"));

    expect(onConnect).not.toHaveBeenCalled();
  });

  it("removes a dependency when its line is clicked and confirmed", () => {
    const onDisconnect = vi.fn();
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    const tasks = [makeTask({ id: "a" }), makeTask({ id: "b", dependencies: ["a"] })];
    render(<CardBoardChart tasks={tasks} onMove={vi.fn()} onConnect={vi.fn()} onDisconnect={onDisconnect} />);

    fireEvent.click(screen.getByTestId("dep-line-hit-a-b"));

    expect(confirmSpy).toHaveBeenCalled();
    expect(onDisconnect).toHaveBeenCalledWith("a", "b");
    confirmSpy.mockRestore();
  });

  it("keeps the dependency when the confirm dialog is dismissed", () => {
    const onDisconnect = vi.fn();
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
    const tasks = [makeTask({ id: "a" }), makeTask({ id: "b", dependencies: ["a"] })];
    render(<CardBoardChart tasks={tasks} onMove={vi.fn()} onConnect={vi.fn()} onDisconnect={onDisconnect} />);

    fireEvent.click(screen.getByTestId("dep-line-hit-a-b"));

    expect(onDisconnect).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });

  // 文字ズレ総点検(2026-07-10): 長い description が overflow:hidden 無しで
  // 全文表示され、下の「未着手」ステータス行と重なる不具合があった。
  // ellipsis 表示にはフレックス子要素の min-width:0 が必須（無いと text-overflow が効かない）。
  it("truncates a long description with ellipsis instead of overflowing onto the status line", () => {
    const longDesc = "天井軽鉄下地組みと壁下地の耐火間仕切り施工、防音対策のロックウール充填を含む長文の作業内容説明テキストです";
    const tasks = [makeTask({ id: "a", description: longDesc })];
    render(<CardBoardChart tasks={tasks} onMove={vi.fn()} onConnect={vi.fn()} onDisconnect={vi.fn()} />);

    const descSpan = screen.getByText(longDesc);
    expect(descSpan.style.overflow).toBe("hidden");
    expect(descSpan.style.textOverflow).toBe("ellipsis");
    expect(descSpan.style.whiteSpace).toBe("nowrap");
    expect(descSpan.style.minWidth).toBe("0px");
  });
});
