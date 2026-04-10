import { describe, expect, it } from "vitest";
import {
  classifyPhoto,
  classifyPhotoBatch,
  type ClassificationResult,
} from "./photo-classifier.js";

describe("classifyPhoto", () => {
  describe("category detection", () => {
    it("detects 外観 from filename", () => {
      const result = classifyPhoto("外観_01.jpg");
      expect(result.category).toBe("外観");
    });

    it("detects 内装 from filename", () => {
      const result = classifyPhoto("室内_floor.jpg");
      expect(result.category).toBe("内装");
    });

    it("detects 設備 from filename", () => {
      const result = classifyPhoto("電気配線_設備.jpg");
      expect(result.category).toBe("設備");
    });

    it("detects 構造 from filename", () => {
      const result = classifyPhoto("基礎工事_001.jpg");
      expect(result.category).toBe("構造");
    });

    it("detects 仕上げ from filename", () => {
      const result = classifyPhoto("塗装仕上_完成.jpg");
      expect(result.category).toBe("仕上げ");
    });

    it("detects 安全 from filename", () => {
      const result = classifyPhoto("安全確認_ヘルメット.jpg");
      expect(result.category).toBe("安全");
    });

    it("detects 搬入 from filename", () => {
      const result = classifyPhoto("資材搬入_2025.jpg");
      expect(result.category).toBe("搬入");
    });

    it("falls back to その他 for unrecognized names", () => {
      const result = classifyPhoto("IMG_20250101_001.jpg");
      expect(result.category).toBe("その他");
    });

    it("is case-insensitive for english keywords", () => {
      const result = classifyPhoto("Exterior_Front.jpg");
      expect(result.category).toBe("外観");
    });
  });

  describe("before/after detection", () => {
    it("detects before from english keyword", () => {
      const result = classifyPhoto("before_renovation.jpg");
      expect(result.beforeAfter).toBe("before");
    });

    it("detects after from english keyword", () => {
      const result = classifyPhoto("after_renovation.jpg");
      expect(result.beforeAfter).toBe("after");
    });

    it("detects 施工前 (before) from japanese keyword", () => {
      const result = classifyPhoto("施工前_外観.jpg");
      expect(result.beforeAfter).toBe("before");
    });

    it("detects 施工後 (after) from japanese keyword", () => {
      const result = classifyPhoto("施工後_内装.jpg");
      expect(result.beforeAfter).toBe("after");
    });

    it("returns null when no before/after keyword found", () => {
      const result = classifyPhoto("IMG_001.jpg");
      expect(result.beforeAfter).toBeNull();
    });

    it("prefers after over before when after keyword appears", () => {
      const result = classifyPhoto("before_after_compare.jpg");
      expect(result.beforeAfter).toBe("after");
    });
  });

  describe("metadata input", () => {
    it("accepts optional metadata without error", () => {
      const result = classifyPhoto("外壁.jpg", {
        capturedAt: "2025-03-10T09:00:00.000Z",
        exifData: { make: "Canon" },
      });
      expect(result.category).toBe("外観");
    });
  });
});

describe("classifyPhotoBatch", () => {
  it("classifies multiple files at once", () => {
    const files = [
      { fileName: "外観_before.jpg" },
      { fileName: "室内_after.jpg" },
      { fileName: "IMG_001.jpg" },
    ];
    const results = classifyPhotoBatch(files);
    expect(results).toHaveLength(3);
    expect(results[0].category).toBe("外観");
    expect(results[0].beforeAfter).toBe("before");
    expect(results[1].category).toBe("内装");
    expect(results[1].beforeAfter).toBe("after");
    expect(results[2].category).toBe("その他");
    expect(results[2].beforeAfter).toBeNull();
  });

  it("preserves original input fields", () => {
    const files = [{ fileName: "test.jpg", capturedAt: "2025-01-01T00:00:00.000Z" }];
    const results = classifyPhotoBatch(files);
    expect(results[0].fileName).toBe("test.jpg");
    expect(results[0].capturedAt).toBe("2025-01-01T00:00:00.000Z");
  });
});
