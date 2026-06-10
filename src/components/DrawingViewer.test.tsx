import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DrawingViewer } from "./DrawingViewer.js";
import { createPin, type DrawingPin } from "../lib/drawing-pins.js";

// Mock htmlToBlob to avoid jsPDF in tests
vi.mock("../lib/report-generator.js", () => ({
  htmlToBlob: vi.fn().mockResolvedValue(new Blob(["pdf"], { type: "application/pdf" })),
}));

afterEach(cleanup);

const DRAWING_URL = "https://example.com/drawing.png";

function patchElementSize(width = 800, height = 600) {
  const proto = HTMLElement.prototype as HTMLElement & {
    getBoundingClientRect: () => DOMRect;
  };
  const orig = proto.getBoundingClientRect;
  proto.getBoundingClientRect = function (): DOMRect {
    return {
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      right: width,
      bottom: height,
      width,
      height,
      toJSON: () => ({}),
    } as DOMRect;
  };
  return () => {
    proto.getBoundingClientRect = orig;
  };
}

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

  it("renders mode selector buttons", () => {
    render(<DrawingViewer drawingUrl={DRAWING_URL} />);
    expect(screen.getByText("ピン")).toBeDefined();
    expect(screen.getByText("縮尺設定")).toBeDefined();
    expect(screen.getByText("距離計測")).toBeDefined();
    expect(screen.getByText("面積計測")).toBeDefined();
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

  it("switches to calibrate mode on button click", () => {
    render(<DrawingViewer drawingUrl={DRAWING_URL} />);
    const btn = screen.getByText("縮尺設定");
    fireEvent.click(btn);
    expect(screen.getByText(/1点目をタップ/)).toBeDefined();
  });

  it("switches back to pin mode", () => {
    render(<DrawingViewer drawingUrl={DRAWING_URL} />);
    fireEvent.click(screen.getByText("縮尺設定"));
    fireEvent.click(screen.getByText("ピン"));
    expect(screen.getByText("ピンがありません")).toBeDefined();
  });

  it("allows adjusting the first measurement point after distance is created", () => {
    const restore = patchElementSize();
    try {
      const { container } = render(
        <DrawingViewer
          drawingUrl={DRAWING_URL}
          drawingId="measure-adjust"
          detectedScaleMmPerPt={1}
          renderPxPerPt={1}
        />,
      );
      fireEvent.click(screen.getByText("距離計測"));
      const canvas = container.querySelector("canvas");
      expect(canvas).not.toBeNull();
      fireEvent.click(canvas!, { clientX: 100, clientY: 100 });
      fireEvent.click(canvas!, { clientX: 200, clientY: 106 });
      expect(screen.getByText("100 mm")).toBeDefined();

      fireEvent.click(screen.getByText("始点調整"));
      expect(screen.getByText("始点の新しい位置をタップ")).toBeDefined();
      fireEvent.click(canvas!, { clientX: 50, clientY: 94 });

      expect(screen.getByText("150 mm")).toBeDefined();
    } finally {
      restore();
    }
  });

  it("snaps the second measurement point to the first point axis", () => {
    const restore = patchElementSize();
    try {
      const { container } = render(
        <DrawingViewer
          drawingUrl={DRAWING_URL}
          drawingId="measure-snap-axis"
          detectedScaleMmPerPt={1}
          renderPxPerPt={1}
        />,
      );
      fireEvent.click(screen.getByText("距離計測"));
      const canvas = container.querySelector("canvas");
      expect(canvas).not.toBeNull();

      fireEvent.click(canvas!, { clientX: 100, clientY: 100 });
      fireEvent.click(canvas!, { clientX: 197, clientY: 108 });

      expect(screen.getByText("97 mm")).toBeDefined();
    } finally {
      restore();
    }
  });

  it("shows snapped measurement preview before the second point is confirmed", () => {
    const restore = patchElementSize();
    try {
      const { container } = render(
        <DrawingViewer
          drawingUrl={DRAWING_URL}
          drawingId="measure-preview"
          detectedScaleMmPerPt={1}
          renderPxPerPt={1}
        />,
      );
      fireEvent.click(screen.getByText("距離計測"));
      const canvas = container.querySelector("canvas");
      expect(canvas).not.toBeNull();

      fireEvent.click(canvas!, { clientX: 100, clientY: 100 });
      fireEvent.pointerMove(canvas!, { clientX: 197, clientY: 108 });

      expect(screen.getByText("プレビュー: 97 mm")).toBeDefined();
    } finally {
      restore();
    }
  });

  it("updates the snapped preview while adjusting an existing measurement point", () => {
    const restore = patchElementSize();
    try {
      const { container } = render(
        <DrawingViewer
          drawingUrl={DRAWING_URL}
          drawingId="measure-adjust-preview"
          detectedScaleMmPerPt={1}
          renderPxPerPt={1}
        />,
      );
      fireEvent.click(screen.getByText("距離計測"));
      const canvas = container.querySelector("canvas");
      expect(canvas).not.toBeNull();

      fireEvent.click(canvas!, { clientX: 100, clientY: 100 });
      fireEvent.click(canvas!, { clientX: 200, clientY: 100 });
      fireEvent.click(screen.getByText("始点調整"));
      fireEvent.pointerMove(canvas!, { clientX: 50, clientY: 94 });

      expect(screen.getByText("プレビュー: 150 mm")).toBeDefined();
    } finally {
      restore();
    }
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

  it("renders 指摘一覧PDF button", () => {
    render(<DrawingViewer drawingUrl={DRAWING_URL} />);
    expect(screen.getByLabelText("指摘一覧PDF")).toBeDefined();
  });

  it("shows incomplete count badge when there are open pins", () => {
    const pins = [
      makePin({ status: "未着手" }),
      makePin({ status: "対応中" }),
      makePin({ status: "完了" }),
    ];
    render(<DrawingViewer drawingUrl={DRAWING_URL} initialPins={pins} />);
    // Two incomplete pins → badge shows "2"
    expect(screen.getByText("2")).toBeDefined();
  });

  it("hides badge when all pins are complete", () => {
    const pins = [makePin({ status: "完了" }), makePin({ status: "完了" })];
    render(<DrawingViewer drawingUrl={DRAWING_URL} initialPins={pins} />);
    // Badge should not render
    expect(screen.queryByText("2")).toBeNull();
  });

  describe("pickup mode pen input", () => {
    function firePenEvent(target: Element, type: string, clientX: number, clientY: number) {
      const ev = new (window as typeof window & { PointerEvent: typeof PointerEvent }).PointerEvent(
        type,
        {
          bubbles: true,
          cancelable: true,
          clientX,
          clientY,
          pointerType: "pen",
          pressure: 0.5,
        },
      );
      target.dispatchEvent(ev);
    }

    function switchToPickup() {
      // 「拾い出し」ボタンクリックでモード切替
      fireEvent.click(screen.getByText("拾い出し"));
    }

    it("renders pickup mode without crashing", () => {
      render(<DrawingViewer drawingUrl={DRAWING_URL} drawingId="pen-test-1" />);
      switchToPickup();
      // スケール未設定時は警告が出る
      expect(screen.getByText(/まず縮尺を設定してください/)).toBeDefined();
    });

    it("ignores pen events when no scale is set (no crash)", () => {
      const restore = patchElementSize();
      try {
        const { container } = render(
          <DrawingViewer drawingUrl={DRAWING_URL} drawingId="pen-test-2" />,
        );
        switchToPickup();
        const canvas = container.querySelector("canvas");
        expect(canvas).not.toBeNull();
        // ペン入力してもスケール未設定なら何も起きない
        firePenEvent(canvas!, "pointerdown", 100, 100);
        firePenEvent(canvas!, "pointermove", 200, 100);
        firePenEvent(canvas!, "pointerup", 200, 100);
        // クラッシュしないことを確認
        expect(canvas).not.toBeNull();
      } finally {
        restore();
      }
    });

    it("applies touchAction:none to overlay canvas in pickup mode", () => {
      const { container } = render(
        <DrawingViewer drawingUrl={DRAWING_URL} drawingId="pen-test-3" />,
      );
      switchToPickup();
      const canvas = container.querySelector("canvas") as HTMLCanvasElement | null;
      expect(canvas).not.toBeNull();
      expect(canvas!.style.touchAction).toBe("none");
    });
  });
});
