import { describe, it, expect, beforeEach } from "vitest";
import {
  createPhotoPinMeasure,
  getMeasuresForPin,
  getMeasuresForDrawing,
  updatePhotoPinMeasure,
  deletePhotoPinMeasure,
  _resetForTest,
} from "./photo-pin-measure.js";

const DID = "drawing-001";
const PIN = "pin-001";
const PHOTO = "photo-001";

beforeEach(() => {
  _resetForTest();
});

// ── createPhotoPinMeasure ──────────────────────────────────────────────────────

describe("createPhotoPinMeasure", () => {
  it("returns a record with a unique id", () => {
    const a = createPhotoPinMeasure(PIN, PHOTO, DID, "area", 10);
    const b = createPhotoPinMeasure(PIN, PHOTO, DID, "area", 20);
    expect(a.id).not.toBe(b.id);
  });

  it("sets kind, value and unit correctly for area", () => {
    const m = createPhotoPinMeasure(PIN, PHOTO, DID, "area", 12.5);
    expect(m.kind).toBe("area");
    expect(m.value).toBe(12.5);
    expect(m.unit).toBe("㎡");
  });

  it("sets kind, value and unit correctly for distance", () => {
    const m = createPhotoPinMeasure(PIN, PHOTO, DID, "distance", 3.2);
    expect(m.kind).toBe("distance");
    expect(m.value).toBe(3.2);
    expect(m.unit).toBe("m");
  });

  it("stores pinId, photoId, drawingId", () => {
    const m = createPhotoPinMeasure(PIN, PHOTO, DID, "area", 5);
    expect(m.pinId).toBe(PIN);
    expect(m.photoId).toBe(PHOTO);
    expect(m.drawingId).toBe(DID);
  });

  it("sets createdAt as a valid ISO datetime", () => {
    const m = createPhotoPinMeasure(PIN, PHOTO, DID, "area", 5);
    expect(() => new Date(m.createdAt)).not.toThrow();
    expect(new Date(m.createdAt).getTime()).toBeGreaterThan(0);
  });

  it("defaults scalePxPerMm to 0 when not provided", () => {
    const m = createPhotoPinMeasure(PIN, PHOTO, DID, "area", 5);
    expect(m.scalePxPerMm).toBe(0);
  });

  it("accepts custom scalePxPerMm and note", () => {
    const m = createPhotoPinMeasure(PIN, PHOTO, DID, "distance", 2, 0.5, "廊下");
    expect(m.scalePxPerMm).toBe(0.5);
    expect(m.note).toBe("廊下");
  });
});

// ── getMeasuresForPin ─────────────────────────────────────────────────────────

describe("getMeasuresForPin", () => {
  it("returns empty array when no measurements exist", () => {
    expect(getMeasuresForPin(PIN, DID)).toEqual([]);
  });

  it("returns only measures for the requested pin", () => {
    createPhotoPinMeasure(PIN, PHOTO, DID, "area", 10);
    createPhotoPinMeasure("pin-002", PHOTO, DID, "area", 5);
    const result = getMeasuresForPin(PIN, DID);
    expect(result).toHaveLength(1);
    expect(result[0]!.pinId).toBe(PIN);
  });

  it("returns all measures for the pin when multiple exist", () => {
    createPhotoPinMeasure(PIN, "photo-A", DID, "area", 10);
    createPhotoPinMeasure(PIN, "photo-B", DID, "distance", 3);
    expect(getMeasuresForPin(PIN, DID)).toHaveLength(2);
  });
});

// ── getMeasuresForDrawing ─────────────────────────────────────────────────────

describe("getMeasuresForDrawing", () => {
  it("returns all measures across all pins for the drawing", () => {
    createPhotoPinMeasure("pin-A", PHOTO, DID, "area", 10);
    createPhotoPinMeasure("pin-B", PHOTO, DID, "distance", 5);
    expect(getMeasuresForDrawing(DID)).toHaveLength(2);
  });

  it("is isolated from other drawings", () => {
    createPhotoPinMeasure(PIN, PHOTO, DID, "area", 10);
    createPhotoPinMeasure(PIN, PHOTO, "drawing-002", "area", 20);
    expect(getMeasuresForDrawing(DID)).toHaveLength(1);
    expect(getMeasuresForDrawing("drawing-002")).toHaveLength(1);
  });
});

// ── updatePhotoPinMeasure ─────────────────────────────────────────────────────

describe("updatePhotoPinMeasure", () => {
  it("returns null for unknown id", () => {
    expect(updatePhotoPinMeasure(DID, "nonexistent", { value: 5 })).toBeNull();
  });

  it("updates value correctly", () => {
    const m = createPhotoPinMeasure(PIN, PHOTO, DID, "area", 10);
    const updated = updatePhotoPinMeasure(DID, m.id, { value: 15 });
    expect(updated!.value).toBe(15);
  });

  it("updates note correctly", () => {
    const m = createPhotoPinMeasure(PIN, PHOTO, DID, "area", 10, 0, "before");
    const updated = updatePhotoPinMeasure(DID, m.id, { note: "after" });
    expect(updated!.note).toBe("after");
  });

  it("persists the update across subsequent reads", () => {
    const m = createPhotoPinMeasure(PIN, PHOTO, DID, "area", 10);
    updatePhotoPinMeasure(DID, m.id, { value: 99 });
    const reads = getMeasuresForDrawing(DID);
    expect(reads[0]!.value).toBe(99);
  });
});

// ── deletePhotoPinMeasure ─────────────────────────────────────────────────────

describe("deletePhotoPinMeasure", () => {
  it("returns false for unknown id", () => {
    expect(deletePhotoPinMeasure(DID, "nonexistent")).toBe(false);
  });

  it("removes the measure and returns true", () => {
    const m = createPhotoPinMeasure(PIN, PHOTO, DID, "area", 10);
    expect(deletePhotoPinMeasure(DID, m.id)).toBe(true);
    expect(getMeasuresForDrawing(DID)).toHaveLength(0);
  });

  it("does not remove other measures in the same drawing", () => {
    const a = createPhotoPinMeasure(PIN, PHOTO, DID, "area", 10);
    const b = createPhotoPinMeasure(PIN, PHOTO, DID, "distance", 5);
    deletePhotoPinMeasure(DID, a.id);
    const remaining = getMeasuresForDrawing(DID);
    expect(remaining).toHaveLength(1);
    expect(remaining[0]!.id).toBe(b.id);
  });
});
