import { describe, expect, it, vi } from "vitest";
import { drawPenPreview, PEN_PREVIEW_HEIGHT, PEN_PREVIEW_WIDTH } from "./pen-preview.js";

function makeFakeCanvas(ctx: Partial<CanvasRenderingContext2D> | null) {
  return { getContext: () => ctx } as unknown as HTMLCanvasElement;
}

describe("drawPenPreview", () => {
  it("clears the canvas and fills a stroke outline for the given color/pen kind", () => {
    const ctx: Partial<CanvasRenderingContext2D> = {
      clearRect: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      closePath: vi.fn(),
      fill: vi.fn(),
    };

    drawPenPreview(makeFakeCanvas(ctx), "#D64545", "ballpoint");

    expect(ctx.clearRect).toHaveBeenCalledWith(0, 0, PEN_PREVIEW_WIDTH, PEN_PREVIEW_HEIGHT);
    expect(ctx.beginPath).toHaveBeenCalled();
    expect(ctx.fill).toHaveBeenCalled();
    expect(ctx.fillStyle).toBe("#D64545");
  });

  it("skips drawing when getContext returns a stub without canvas drawing APIs (test-env guard)", () => {
    const stub = {} as CanvasRenderingContext2D;
    expect(() => drawPenPreview(makeFakeCanvas(stub), "#346538", "pencil")).not.toThrow();
  });

  it("skips drawing when there is no canvas", () => {
    expect(() => drawPenPreview(null, "#346538", "marker")).not.toThrow();
  });
});
