import { describe, it, expect, beforeEach } from "vitest";

import {
  linkPhotoToPin,
  getPhotosForPin,
  getPinsWithPhotos,
  getPinsWithoutPhotos,
  getPhotoCompletionRate,
  unlinkPhoto,
  buildPhotoLinkReportHtml,
  _resetForTest,
  type DrawingPhotoLink,
} from "./drawing-photo-link.js";

const DRAWING_ID = "drawing-001";

beforeEach(() => {
  _resetForTest();
});

// ── linkPhotoToPin ────────────────────────────────────────────────────────────

describe("linkPhotoToPin", () => {
  it("creates a link with unique id", () => {
    const a = linkPhotoToPin("pin-1", "photo-1", DRAWING_ID);
    const b = linkPhotoToPin("pin-1", "photo-2", DRAWING_ID);
    expect(a.id).not.toBe(b.id);
  });

  it("stores pinId, photoId, drawingId correctly", () => {
    const link = linkPhotoToPin("pin-1", "photo-1", DRAWING_ID);
    expect(link.pinId).toBe("pin-1");
    expect(link.photoId).toBe("photo-1");
    expect(link.drawingId).toBe(DRAWING_ID);
  });

  it("stores note when provided", () => {
    const link = linkPhotoToPin("pin-1", "photo-1", DRAWING_ID, "外壁クラック");
    expect(link.note).toBe("外壁クラック");
  });

  it("defaults note to empty string", () => {
    const link = linkPhotoToPin("pin-1", "photo-1", DRAWING_ID);
    expect(link.note).toBe("");
  });

  it("sets capturedAt as valid ISO string", () => {
    const link = linkPhotoToPin("pin-1", "photo-1", DRAWING_ID);
    expect(() => new Date(link.capturedAt)).not.toThrow();
    expect(new Date(link.capturedAt).getTime()).toBeGreaterThan(0);
  });
});

// ── getPhotosForPin ───────────────────────────────────────────────────────────

describe("getPhotosForPin", () => {
  it("returns empty array when no links exist", () => {
    expect(getPhotosForPin("pin-1", DRAWING_ID)).toEqual([]);
  });

  it("returns only links for the specified pin", () => {
    linkPhotoToPin("pin-1", "photo-1", DRAWING_ID);
    linkPhotoToPin("pin-2", "photo-2", DRAWING_ID);
    const result = getPhotosForPin("pin-1", DRAWING_ID);
    expect(result).toHaveLength(1);
    expect(result[0]?.photoId).toBe("photo-1");
  });

  it("returns multiple photos for the same pin", () => {
    linkPhotoToPin("pin-1", "photo-A", DRAWING_ID);
    linkPhotoToPin("pin-1", "photo-B", DRAWING_ID);
    expect(getPhotosForPin("pin-1", DRAWING_ID)).toHaveLength(2);
  });
});

// ── getPinsWithPhotos ─────────────────────────────────────────────────────────

describe("getPinsWithPhotos", () => {
  it("returns empty array when no links exist", () => {
    expect(getPinsWithPhotos(DRAWING_ID)).toEqual([]);
  });

  it("returns unique pinIds that have photos", () => {
    linkPhotoToPin("pin-1", "photo-1", DRAWING_ID);
    linkPhotoToPin("pin-1", "photo-2", DRAWING_ID);
    linkPhotoToPin("pin-2", "photo-3", DRAWING_ID);
    const result = getPinsWithPhotos(DRAWING_ID);
    expect(result).toHaveLength(2);
    expect(result).toContain("pin-1");
    expect(result).toContain("pin-2");
  });
});

// ── getPinsWithoutPhotos ──────────────────────────────────────────────────────

describe("getPinsWithoutPhotos", () => {
  it("returns all pins when no photos linked", () => {
    const result = getPinsWithoutPhotos(DRAWING_ID, ["pin-1", "pin-2", "pin-3"]);
    expect(result).toEqual(["pin-1", "pin-2", "pin-3"]);
  });

  it("excludes pins that have at least one photo", () => {
    linkPhotoToPin("pin-1", "photo-1", DRAWING_ID);
    const result = getPinsWithoutPhotos(DRAWING_ID, ["pin-1", "pin-2"]);
    expect(result).toEqual(["pin-2"]);
  });

  it("returns empty array when all pins have photos", () => {
    linkPhotoToPin("pin-1", "photo-1", DRAWING_ID);
    linkPhotoToPin("pin-2", "photo-2", DRAWING_ID);
    expect(getPinsWithoutPhotos(DRAWING_ID, ["pin-1", "pin-2"])).toEqual([]);
  });
});

// ── getPhotoCompletionRate ────────────────────────────────────────────────────

describe("getPhotoCompletionRate", () => {
  it("returns 0 when allPinIds is empty", () => {
    expect(getPhotoCompletionRate(DRAWING_ID, [])).toBe(0);
  });

  it("returns 0 when no photos linked", () => {
    expect(getPhotoCompletionRate(DRAWING_ID, ["pin-1", "pin-2"])).toBe(0);
  });

  it("returns 1 when all pins have photos", () => {
    linkPhotoToPin("pin-1", "photo-1", DRAWING_ID);
    linkPhotoToPin("pin-2", "photo-2", DRAWING_ID);
    expect(getPhotoCompletionRate(DRAWING_ID, ["pin-1", "pin-2"])).toBe(1);
  });

  it("returns fractional rate for partial coverage", () => {
    linkPhotoToPin("pin-1", "photo-1", DRAWING_ID);
    const rate = getPhotoCompletionRate(DRAWING_ID, ["pin-1", "pin-2", "pin-3", "pin-4"]);
    expect(rate).toBeCloseTo(0.25);
  });
});

// ── unlinkPhoto ───────────────────────────────────────────────────────────────

describe("unlinkPhoto", () => {
  it("removes the link and returns true", () => {
    const link = linkPhotoToPin("pin-1", "photo-1", DRAWING_ID);
    const result = unlinkPhoto(DRAWING_ID, link.id);
    expect(result).toBe(true);
    expect(getPhotosForPin("pin-1", DRAWING_ID)).toHaveLength(0);
  });

  it("returns false when linkId does not exist", () => {
    expect(unlinkPhoto(DRAWING_ID, "nonexistent-id")).toBe(false);
  });

  it("only removes the targeted link, leaving others intact", () => {
    const a = linkPhotoToPin("pin-1", "photo-1", DRAWING_ID);
    linkPhotoToPin("pin-1", "photo-2", DRAWING_ID);
    unlinkPhoto(DRAWING_ID, a.id);
    expect(getPhotosForPin("pin-1", DRAWING_ID)).toHaveLength(1);
  });
});

// ── buildPhotoLinkReportHtml ──────────────────────────────────────────────────

describe("buildPhotoLinkReportHtml", () => {
  it("returns an HTML string containing the drawing name", () => {
    const html = buildPhotoLinkReportHtml(DRAWING_ID, "1F平面図", []);
    expect(html).toContain("1F平面図");
  });

  it("shows 撮影済 for pins with photos", () => {
    linkPhotoToPin("pin-1", "photo-1", DRAWING_ID);
    const html = buildPhotoLinkReportHtml(DRAWING_ID, "2F平面図", ["pin-1"]);
    expect(html).toContain("撮影済");
  });

  it("shows 未撮影 for pins without photos", () => {
    const html = buildPhotoLinkReportHtml(DRAWING_ID, "2F平面図", ["pin-1"]);
    expect(html).toContain("未撮影");
  });

  it("shows correct completion rate percentage", () => {
    linkPhotoToPin("pin-1", "photo-1", DRAWING_ID);
    const html = buildPhotoLinkReportHtml(DRAWING_ID, "図面", ["pin-1", "pin-2"]);
    expect(html).toContain("50%");
  });

  it("shows ピンなし when allPinIds is empty", () => {
    const html = buildPhotoLinkReportHtml(DRAWING_ID, "図面", []);
    expect(html).toContain("ピンなし");
  });

  it("escapes HTML special characters in drawingName", () => {
    const html = buildPhotoLinkReportHtml(DRAWING_ID, '<script>alert("xss")</script>', []);
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });
});
