import { describe, it, expect } from "vitest";

// Polyfill ImageData synchronously before importing comparePDFs so both
// the lib and the test helper can construct ImageData instances.
// Supports both new ImageData(data, w, h) and new ImageData(w, h) forms.
if (typeof (globalThis as Record<string, unknown>).ImageData === "undefined") {
  class ImageDataPolyfill {
    data: Uint8ClampedArray;
    width: number;
    height: number;
    constructor(
      dataOrWidth: Uint8ClampedArray | number,
      widthOrHeight: number,
      height?: number
    ) {
      if (typeof dataOrWidth === "number") {
        // new ImageData(width, height)
        this.width = dataOrWidth;
        this.height = widthOrHeight;
        this.data = new Uint8ClampedArray(dataOrWidth * widthOrHeight * 4);
      } else {
        // new ImageData(data, width, height?)
        this.data = dataOrWidth;
        this.width = widthOrHeight;
        this.height = height ?? dataOrWidth.length / (widthOrHeight * 4);
      }
    }
  }
  (globalThis as Record<string, unknown>).ImageData = ImageDataPolyfill;
}

import { comparePDFs } from "./blueprint-diff.js";

/** Create a solid-color ImageData */
function makeImageData(
  width: number,
  height: number,
  r: number,
  g: number,
  b: number
): ImageData {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    data[i * 4] = r;
    data[i * 4 + 1] = g;
    data[i * 4 + 2] = b;
    data[i * 4 + 3] = 255;
  }
  return new ImageData(data, width, height);
}

describe("comparePDFs", () => {
  it("returns zero diffRatio for identical images", () => {
    const img = makeImageData(10, 10, 255, 255, 255);
    const result = comparePDFs(img, img);
    expect(result.diffRatio).toBe(0);
  });

  it("returns non-zero diffRatio for different images", () => {
    const old_ = makeImageData(10, 10, 255, 255, 255); // white
    const new_ = makeImageData(10, 10, 0, 0, 0);       // black
    const result = comparePDFs(old_, new_);
    expect(result.diffRatio).toBeGreaterThan(0);
  });

  it("overlayData has correct dimensions", () => {
    const old_ = makeImageData(8, 6, 255, 255, 255);
    const new_ = makeImageData(8, 6, 0, 0, 0);
    const result = comparePDFs(old_, new_);
    expect(result.overlayData.width).toBe(8);
    expect(result.overlayData.height).toBe(6);
  });

  it("unchanged pixels are transparent in overlay", () => {
    const old_ = makeImageData(4, 4, 200, 200, 200);
    const new_ = makeImageData(4, 4, 200, 200, 200);
    const result = comparePDFs(old_, new_);
    // All pixels transparent (alpha=0)
    for (let i = 0; i < 4 * 4; i++) {
      expect(result.overlayData.data[i * 4 + 3]).toBe(0);
    }
  });

  it("classifies ink-in-new as added (blue)", () => {
    // old=white (blank), new=black (ink) => added
    const old_ = makeImageData(4, 4, 255, 255, 255);
    const new_ = makeImageData(4, 4, 0, 0, 0);
    const result = comparePDFs(old_, new_, 10);
    // Find a non-transparent pixel and check it is blue-ish
    let foundBlue = false;
    for (let i = 0; i < 4 * 4; i++) {
      const alpha = result.overlayData.data[i * 4 + 3];
      if (alpha && alpha > 0) {
        const r = result.overlayData.data[i * 4]!;
        const b = result.overlayData.data[i * 4 + 2]!;
        if (b > r) { foundBlue = true; break; }
      }
    }
    expect(foundBlue).toBe(true);
  });

  it("classifies ink-in-old as removed (red)", () => {
    // old=black (ink), new=white (blank) => removed
    const old_ = makeImageData(4, 4, 0, 0, 0);
    const new_ = makeImageData(4, 4, 255, 255, 255);
    const result = comparePDFs(old_, new_, 10);
    let foundRed = false;
    for (let i = 0; i < 4 * 4; i++) {
      const alpha = result.overlayData.data[i * 4 + 3];
      if (alpha && alpha > 0) {
        const r = result.overlayData.data[i * 4]!;
        const b = result.overlayData.data[i * 4 + 2]!;
        if (r > b) { foundRed = true; break; }
      }
    }
    expect(foundRed).toBe(true);
  });

  it("handles different sized images (old gets resized to new)", () => {
    const old_ = makeImageData(4, 4, 255, 255, 255);
    const new_ = makeImageData(8, 8, 0, 0, 0);
    const result = comparePDFs(old_, new_);
    expect(result.overlayData.width).toBe(8);
    expect(result.overlayData.height).toBe(8);
  });

  it("returns regions array", () => {
    const old_ = makeImageData(20, 20, 255, 255, 255);
    const new_ = makeImageData(20, 20, 0, 0, 0);
    const result = comparePDFs(old_, new_);
    expect(Array.isArray(result.regions)).toBe(true);
  });

  it("regions have valid bounding boxes within image bounds", () => {
    const old_ = makeImageData(20, 20, 255, 255, 255);
    const new_ = makeImageData(20, 20, 0, 0, 0);
    const result = comparePDFs(old_, new_);
    for (const region of result.regions) {
      expect(region.box.x).toBeGreaterThanOrEqual(0);
      expect(region.box.y).toBeGreaterThanOrEqual(0);
      expect(region.box.x + region.box.width).toBeLessThanOrEqual(20);
      expect(region.box.y + region.box.height).toBeLessThanOrEqual(20);
    }
  });

  it("region type is one of added/removed/changed", () => {
    const old_ = makeImageData(20, 20, 255, 255, 255);
    const new_ = makeImageData(20, 20, 0, 0, 0);
    const result = comparePDFs(old_, new_);
    for (const region of result.regions) {
      expect(["added", "removed", "changed"]).toContain(region.type);
    }
  });
});
