import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useKeyboardShortcuts, SHORTCUT_DEFS } from "../hooks/useKeyboardShortcuts.js";

// Mock navigate
vi.mock("../hooks/useHashRouter.js", () => ({
  navigate: vi.fn(),
}));

import { navigate } from "../hooks/useHashRouter.js";

function fireKey(
  key: string,
  opts: { ctrlKey?: boolean; shiftKey?: boolean; target?: HTMLElement } = {},
) {
  const target = opts.target ?? document.body;
  const event = new KeyboardEvent("keydown", {
    key,
    ctrlKey: opts.ctrlKey ?? false,
    shiftKey: opts.shiftKey ?? false,
    bubbles: true,
  });
  Object.defineProperty(event, "target", { value: target });
  document.dispatchEvent(event);
}

describe("useKeyboardShortcuts", () => {
  let cleanup: (() => void) | undefined;

  beforeEach(() => {
    vi.mocked(navigate).mockClear();
    cleanup = undefined;
  });

  afterEach(() => {
    cleanup?.();
    vi.restoreAllMocks();
  });

  it("calls onNewTask on Ctrl+N", () => {
    const onNewTask = vi.fn();
    const { unmount } = renderHook(() => useKeyboardShortcuts({ onNewTask }));
    cleanup = unmount;
    fireKey("n", { ctrlKey: true });
    expect(onNewTask).toHaveBeenCalledOnce();
  });

  it("navigates to /estimate on Ctrl+E", () => {
    const { unmount } = renderHook(() => useKeyboardShortcuts({}));
    cleanup = unmount;
    fireKey("e", { ctrlKey: true });
    expect(navigate).toHaveBeenCalledWith("/estimate");
  });

  it("navigates to /gantt on Ctrl+G", () => {
    const { unmount } = renderHook(() => useKeyboardShortcuts({}));
    cleanup = unmount;
    fireKey("g", { ctrlKey: true });
    expect(navigate).toHaveBeenCalledWith("/gantt");
  });

  it("navigates to /today on Ctrl+D", () => {
    const { unmount } = renderHook(() => useKeyboardShortcuts({}));
    cleanup = unmount;
    fireKey("d", { ctrlKey: true });
    expect(navigate).toHaveBeenCalledWith("/today");
  });

  it("calls onCloseModal on Escape", () => {
    const onCloseModal = vi.fn();
    const { unmount } = renderHook(() => useKeyboardShortcuts({ onCloseModal }));
    cleanup = unmount;
    fireKey("Escape");
    expect(onCloseModal).toHaveBeenCalledOnce();
  });

  it("calls onShowHelp on ?", () => {
    const onShowHelp = vi.fn();
    const { unmount } = renderHook(() => useKeyboardShortcuts({ onShowHelp }));
    cleanup = unmount;
    fireKey("?");
    expect(onShowHelp).toHaveBeenCalledOnce();
  });

  it("does not fire navigation when disabled", () => {
    const { unmount } = renderHook(() => useKeyboardShortcuts({ disabled: true }));
    cleanup = unmount;
    fireKey("g", { ctrlKey: true });
    expect(navigate).not.toHaveBeenCalled();
  });

  it("skips shortcuts (except Escape) when target is an input", () => {
    const onNewTask = vi.fn();
    const { unmount } = renderHook(() => useKeyboardShortcuts({ onNewTask }));
    cleanup = unmount;
    const input = document.createElement("input");
    document.body.appendChild(input);
    const event = new KeyboardEvent("keydown", {
      key: "n",
      ctrlKey: true,
      bubbles: true,
    });
    Object.defineProperty(event, "target", { value: input });
    document.dispatchEvent(event);
    expect(onNewTask).not.toHaveBeenCalled();
    document.body.removeChild(input);
  });
});

describe("SHORTCUT_DEFS", () => {
  it("has all required actions defined", () => {
    const expected = [
      "new-task",
      "new-estimate",
      "go-gantt",
      "go-dashboard",
      "close-modal",
      "show-help",
    ];
    for (const action of expected) {
      expect(SHORTCUT_DEFS).toHaveProperty(action);
    }
  });

  it("each def has key, label, and description", () => {
    for (const def of Object.values(SHORTCUT_DEFS)) {
      expect(def.key).toBeTruthy();
      expect(def.label).toBeTruthy();
      expect(def.description).toBeTruthy();
    }
  });
});
