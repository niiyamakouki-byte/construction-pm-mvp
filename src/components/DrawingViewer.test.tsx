import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DrawingViewer } from "./DrawingViewer.js";
import { createPin, type DrawingPin } from "../lib/drawing-pins.js";

afterEach(cleanup);

const DRAWING_URL = "https://example.com/drawing.png";

const makePin = (overrides: Partial<Omit<DrawingPin, "id" | "createdAt">> = {}): DrawingPin =>
  createPin({
    x: 0.3,
    y: 0.4,
    comment: "亀裂",
    assignee: "鈴木",
    dueDate: "2025-04-20",
    status: "未着手",
    ...overrides,
  });

describe("DrawingViewer", () => {
  it("renders drawing image with alt text", () => {
    render(<DrawingViewer drawingUrl={DRAWING_URL} />);
    expect(screen.getByAltText("図面")).toBeDefined();
  });

  it("renders add pin button", () => {
    render(<DrawingViewer drawingUrl={DRAWING_URL} />);
    expect(screen.getByText("＋ ピン追加")).toBeDefined();
  });

  it("shows empty state when no pins", () => {
    render(<DrawingViewer drawingUrl={DRAWING_URL} />);
    expect(screen.getByText("ピンがありません")).toBeDefined();
  });

  it("renders initial pins in sidebar", () => {
    const pin = makePin({ comment: "壁剥がれ" });
    render(<DrawingViewer drawingUrl={DRAWING_URL} initialPins={[pin]} />);
    expect(screen.getByText(/壁剥がれ/)).toBeDefined();
  });

  it("renders pin marker buttons", () => {
    const pin = makePin();
    render(<DrawingViewer drawingUrl={DRAWING_URL} initialPins={[pin]} />);
    const pinBtn = screen.getByLabelText(/ピン:/);
    expect(pinBtn).toBeDefined();
  });

  it("toggles add mode on button click", () => {
    render(<DrawingViewer drawingUrl={DRAWING_URL} />);
    const btn = screen.getByText("＋ ピン追加");
    fireEvent.click(btn);
    expect(screen.getByText(/配置モード ON/)).toBeDefined();
  });

  it("exits add mode on second click", () => {
    render(<DrawingViewer drawingUrl={DRAWING_URL} />);
    const btn = screen.getByText("＋ ピン追加");
    fireEvent.click(btn);
    fireEvent.click(screen.getByText(/配置モード ON/));
    expect(screen.getByText("＋ ピン追加")).toBeDefined();
  });

  it("opens popover when sidebar pin clicked", () => {
    const pin = makePin({ comment: "テスト亀裂" });
    render(<DrawingViewer drawingUrl={DRAWING_URL} initialPins={[pin]} />);
    // click the sidebar list item button (not the map pin button)
    const listBtn = screen.getAllByRole("button").find((b) =>
      b.textContent?.includes("テスト亀裂")
    );
    expect(listBtn).toBeDefined();
    fireEvent.click(listBtn!);
    // popover should show detail
    expect(screen.getByText("ピン詳細")).toBeDefined();
  });

  it("shows pin fields in popover", () => {
    const pin = makePin({ comment: "詳細確認", assignee: "田中", dueDate: "2025-05-01" });
    render(<DrawingViewer drawingUrl={DRAWING_URL} initialPins={[pin]} />);
    const listBtn = screen.getAllByRole("button").find((b) =>
      b.textContent?.includes("詳細確認")
    );
    fireEvent.click(listBtn!);
    expect(screen.getByText("田中")).toBeDefined();
    expect(screen.getByText("2025-05-01")).toBeDefined();
  });

  it("deletes pin when delete button clicked", () => {
    const pin = makePin({ comment: "削除対象" });
    const onPinsChange = vi.fn();
    render(
      <DrawingViewer drawingUrl={DRAWING_URL} initialPins={[pin]} onPinsChange={onPinsChange} />
    );
    const listBtn = screen.getAllByRole("button").find((b) =>
      b.textContent?.includes("削除対象")
    );
    fireEvent.click(listBtn!);
    const deleteBtn = screen.getByText("削除");
    fireEvent.click(deleteBtn);
    expect(onPinsChange).toHaveBeenCalledWith([]);
    expect(screen.getByText("ピンがありません")).toBeDefined();
  });

  it("calls onPinsChange when pin deleted", () => {
    const pin = makePin();
    const cb = vi.fn();
    render(<DrawingViewer drawingUrl={DRAWING_URL} initialPins={[pin]} onPinsChange={cb} />);
    const listBtn = screen.getAllByRole("button").find((b) =>
      b.textContent?.includes("亀裂")
    );
    fireEvent.click(listBtn!);
    fireEvent.click(screen.getByText("削除"));
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it("renders status badge for each pin", () => {
    const pin = makePin({ status: "対応中" });
    render(<DrawingViewer drawingUrl={DRAWING_URL} initialPins={[pin]} />);
    expect(screen.getAllByText("対応中").length).toBeGreaterThan(0);
  });

  it("renders multiple pins in sidebar", () => {
    const pins = [
      makePin({ comment: "ピン1" }),
      makePin({ comment: "ピン2" }),
      makePin({ comment: "ピン3" }),
    ];
    render(<DrawingViewer drawingUrl={DRAWING_URL} initialPins={pins} />);
    expect(screen.getByText(/ピン1/)).toBeDefined();
    expect(screen.getByText(/ピン2/)).toBeDefined();
    expect(screen.getByText(/ピン3/)).toBeDefined();
  });
});
