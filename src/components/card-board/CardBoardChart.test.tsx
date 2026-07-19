import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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

// mouse は常に pointerType: "mouse"（即ドラッグ、旧 mousedown/move/up 相当）。
function pointer(
  type: "pointerDown" | "pointerMove" | "pointerUp",
  element: Element,
  opts: { clientX?: number; clientY?: number; pointerId?: number; pointerType?: string } = {},
) {
  fireEvent[type](element, {
    pointerId: opts.pointerId ?? 1,
    clientX: opts.clientX ?? 0,
    clientY: opts.clientY ?? 0,
    pointerType: opts.pointerType ?? "mouse",
    button: 0,
  });
}

describe("CardBoardChart", () => {
  it("renders one card per task with its name", () => {
    const tasks = [makeTask({ id: "a", name: "墨出し" }), makeTask({ id: "b", name: "解体" })];
    render(<CardBoardChart tasks={tasks} onMove={vi.fn()} onConnect={vi.fn()} onDisconnect={vi.fn()} />);

    expect(screen.getByTestId("card-a")).toBeTruthy();
    expect(screen.getByTestId("card-b")).toBeTruthy();
    expect(screen.getByText("墨出し")).toBeTruthy();
  });

  it("commits the new position on drag release (mouse: immediate drag)", () => {
    const onMove = vi.fn();
    const tasks = [makeTask({ id: "a", canvasX: 100, canvasY: 50 })];
    render(<CardBoardChart tasks={tasks} onMove={onMove} onConnect={vi.fn()} onDisconnect={vi.fn()} />);

    const card = screen.getByTestId("card-a").querySelector("rect")!;
    const svg = screen.getByTestId("card-board-canvas").querySelector("svg")!;

    // pan defaults to (80,80), zoom 1: clientX/Y - 80 = canvas coords.
    pointer("pointerDown", card, { clientX: 180, clientY: 130 }); // canvas (100,50) == card pos → zero drag offset
    pointer("pointerMove", svg, { clientX: 200, clientY: 160 }); // canvas (120,80)
    pointer("pointerUp", svg, { clientX: 200, clientY: 160 });

    expect(onMove).toHaveBeenCalledWith("a", 120, 80);
  });

  it("creates a dependency when a card is dropped on another card's port (mouse)", () => {
    const onConnect = vi.fn();
    const tasks = [makeTask({ id: "a" }), makeTask({ id: "b" })];
    render(<CardBoardChart tasks={tasks} onMove={vi.fn()} onConnect={onConnect} onDisconnect={vi.fn()} />);

    pointer("pointerDown", screen.getByTestId("port-out-a"));
    pointer("pointerUp", screen.getByTestId("port-in-b"));

    expect(onConnect).toHaveBeenCalledWith("a", "b");
  });

  it("does not create a self-dependency when dropped on its own port", () => {
    const onConnect = vi.fn();
    const tasks = [makeTask({ id: "a" })];
    render(<CardBoardChart tasks={tasks} onMove={vi.fn()} onConnect={onConnect} onDisconnect={vi.fn()} />);

    pointer("pointerDown", screen.getByTestId("port-out-a"));
    pointer("pointerUp", screen.getByTestId("port-in-a"));

    expect(onConnect).not.toHaveBeenCalled();
  });

  it("ignores touch pointerdown on a port (mobile connect is menu-only)", () => {
    const onConnect = vi.fn();
    const tasks = [makeTask({ id: "a" }), makeTask({ id: "b" })];
    render(<CardBoardChart tasks={tasks} onMove={vi.fn()} onConnect={onConnect} onDisconnect={vi.fn()} />);

    pointer("pointerDown", screen.getByTestId("port-out-a"), { pointerType: "touch" });
    pointer("pointerUp", screen.getByTestId("port-in-b"), { pointerType: "touch" });

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

  describe("laporta-beads-8i1wq: Pointer Events化（タップ=詳細 / 長押し=移動 / メニュー接続）", () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it("opens the detail sheet on a quick touch tap (no drag)", () => {
      const tasks = [makeTask({ id: "a", name: "墨出し" })];
      render(<CardBoardChart tasks={tasks} onMove={vi.fn()} onConnect={vi.fn()} onDisconnect={vi.fn()} />);

      const card = screen.getByTestId("card-a").querySelector("rect")!;
      const svg = screen.getByTestId("card-board-canvas").querySelector("svg")!;

      act(() => {
        pointer("pointerDown", card, { clientX: 100, clientY: 100, pointerType: "touch" });
      });
      act(() => {
        pointer("pointerUp", svg, { clientX: 100, clientY: 100, pointerType: "touch" });
      });

      expect(screen.getByTestId("card-detail-sheet")).toBeTruthy();
      expect(screen.getAllByText("墨出し").length).toBeGreaterThan(0);
    });

    it("does not move the card on a quick tap release (onMove not called)", () => {
      const onMove = vi.fn();
      const tasks = [makeTask({ id: "a", canvasX: 100, canvasY: 50 })];
      render(<CardBoardChart tasks={tasks} onMove={onMove} onConnect={vi.fn()} onDisconnect={vi.fn()} />);

      const card = screen.getByTestId("card-a").querySelector("rect")!;
      const svg = screen.getByTestId("card-board-canvas").querySelector("svg")!;

      act(() => {
        pointer("pointerDown", card, { clientX: 180, clientY: 130, pointerType: "touch" });
      });
      act(() => {
        pointer("pointerUp", svg, { clientX: 180, clientY: 130, pointerType: "touch" });
      });

      expect(onMove).not.toHaveBeenCalled();
    });

    it("moves the card only after a long-press, then drag, on touch", () => {
      const onMove = vi.fn();
      const tasks = [makeTask({ id: "a", canvasX: 100, canvasY: 50 })];
      render(<CardBoardChart tasks={tasks} onMove={onMove} onConnect={vi.fn()} onDisconnect={vi.fn()} />);

      const card = screen.getByTestId("card-a").querySelector("rect")!;
      const svg = screen.getByTestId("card-board-canvas").querySelector("svg")!;

      act(() => {
        pointer("pointerDown", card, { clientX: 180, clientY: 130, pointerType: "touch" });
      });
      act(() => {
        vi.advanceTimersByTime(500); // long-press threshold (450ms) 超過 → ドラッグ可能状態へ
      });
      act(() => {
        pointer("pointerMove", svg, { clientX: 200, clientY: 160, pointerType: "touch" });
      });
      act(() => {
        pointer("pointerUp", svg, { clientX: 200, clientY: 160, pointerType: "touch" });
      });

      expect(onMove).toHaveBeenCalledWith("a", 120, 80);
    });

    it("cancels the pending tap/long-press if the finger moves past the threshold early", () => {
      const onMove = vi.fn();
      const tasks = [makeTask({ id: "a", canvasX: 100, canvasY: 50 })];
      render(<CardBoardChart tasks={tasks} onMove={onMove} onConnect={vi.fn()} onDisconnect={vi.fn()} />);

      const card = screen.getByTestId("card-a").querySelector("rect")!;
      const svg = screen.getByTestId("card-board-canvas").querySelector("svg")!;

      act(() => {
        pointer("pointerDown", card, { clientX: 180, clientY: 130, pointerType: "touch" });
      });
      act(() => {
        // 閾値(8px)を大きく超えて動く → 長押しタイマーはキャンセルされる
        pointer("pointerMove", svg, { clientX: 220, clientY: 170, pointerType: "touch" });
      });
      act(() => {
        vi.advanceTimersByTime(500);
      });
      act(() => {
        pointer("pointerUp", svg, { clientX: 220, clientY: 170, pointerType: "touch" });
      });

      expect(onMove).not.toHaveBeenCalled();
      expect(screen.queryByTestId("card-detail-sheet")).toBeNull();
    });
  });

  describe("laporta-beads-8i1wq: メニューからの接続（『この工程の後に追加』）", () => {
    it("connects the opened card as predecessor of the chosen successor via the menu", () => {
      const onConnect = vi.fn();
      const tasks = [
        makeTask({ id: "a", name: "墨出し" }),
        makeTask({ id: "b", name: "解体" }),
      ];
      render(<CardBoardChart tasks={tasks} onMove={vi.fn()} onConnect={onConnect} onDisconnect={vi.fn()} />);

      fireEvent.click(screen.getByTestId("card-menu-a"));
      fireEvent.click(screen.getByTestId("connect-after-open"));
      fireEvent.click(screen.getByTestId("connect-after-target-b"));

      expect(onConnect).toHaveBeenCalledWith("a", "b");
    });

    it("removes a dependency from the detail sheet", () => {
      const onDisconnect = vi.fn();
      const tasks = [makeTask({ id: "a" }), makeTask({ id: "b", dependencies: ["a"] })];
      render(<CardBoardChart tasks={tasks} onMove={vi.fn()} onConnect={vi.fn()} onDisconnect={onDisconnect} />);

      fireEvent.click(screen.getByTestId("card-menu-b"));
      fireEvent.click(screen.getByTestId("remove-dependency-a"));

      expect(onDisconnect).toHaveBeenCalledWith("a", "b");
    });
  });

  describe("laporta-beads-8i1wq: ツールバー（全体を表示・ズーム・取り消し）", () => {
    it("resets zoom to 100% via the zoom-reset button", () => {
      const tasks = [makeTask({ id: "a" })];
      render(<CardBoardChart tasks={tasks} onMove={vi.fn()} onConnect={vi.fn()} onDisconnect={vi.fn()} />);

      fireEvent.click(screen.getByTestId("card-board-zoom-in"));
      expect(screen.getByTestId("card-board-zoom-reset").textContent).not.toBe("100%");

      fireEvent.click(screen.getByTestId("card-board-zoom-reset"));
      expect(screen.getByTestId("card-board-zoom-reset").textContent).toBe("100%");
    });

    it("undo button is disabled until an action happens, then reverts the last move", () => {
      const onMove = vi.fn();
      const tasks = [makeTask({ id: "a", canvasX: 100, canvasY: 50 })];
      render(<CardBoardChart tasks={tasks} onMove={onMove} onConnect={vi.fn()} onDisconnect={vi.fn()} />);

      expect((screen.getByTestId("card-board-undo") as HTMLButtonElement).disabled).toBe(true);

      const card = screen.getByTestId("card-a").querySelector("rect")!;
      const svg = screen.getByTestId("card-board-canvas").querySelector("svg")!;
      pointer("pointerDown", card, { clientX: 180, clientY: 130 });
      pointer("pointerMove", svg, { clientX: 200, clientY: 160 });
      pointer("pointerUp", svg, { clientX: 200, clientY: 160 });

      expect(onMove).toHaveBeenCalledWith("a", 120, 80);
      expect((screen.getByTestId("card-board-undo") as HTMLButtonElement).disabled).toBe(false);

      fireEvent.click(screen.getByTestId("card-board-undo"));
      // 移動前の位置（100,50）に戻す onMove 呼び出しが追加される
      expect(onMove).toHaveBeenLastCalledWith("a", 100, 50);
      expect((screen.getByTestId("card-board-undo") as HTMLButtonElement).disabled).toBe(true);
    });

    it("undoes a connect by disconnecting", () => {
      const onConnect = vi.fn();
      const onDisconnect = vi.fn();
      const tasks = [makeTask({ id: "a" }), makeTask({ id: "b" })];
      render(<CardBoardChart tasks={tasks} onMove={vi.fn()} onConnect={onConnect} onDisconnect={onDisconnect} />);

      pointer("pointerDown", screen.getByTestId("port-out-a"));
      pointer("pointerUp", screen.getByTestId("port-in-b"));
      expect(onConnect).toHaveBeenCalledWith("a", "b");

      fireEvent.click(screen.getByTestId("card-board-undo"));
      expect(onDisconnect).toHaveBeenCalledWith("a", "b");
    });
  });
});
