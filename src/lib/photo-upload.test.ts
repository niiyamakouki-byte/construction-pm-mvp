import { describe, expect, it } from "vitest";
import {
  PhotoCategory,
  getCategoryLabel,
  validatePhoto,
  generateThumbnailUrl,
  groupPhotosByCategory,
  type PhotoWithCategory,
} from "./photo-upload.js";

function makePhoto(overrides: Partial<PhotoWithCategory> & Pick<PhotoWithCategory, "id">): PhotoWithCategory {
  return {
    url: `https://cdn.example.com/photos/${overrides.id}.jpg`,
    category: PhotoCategory.other,
    capturedAt: "2025-06-01T09:00:00.000Z",
    description: "現場写真",
    ...overrides,
  };
}

describe("photo-upload", () => {
  describe("PhotoCategory", () => {
    it("has 12 categories", () => {
      expect(Object.keys(PhotoCategory)).toHaveLength(12);
    });

    it("includes all expected categories", () => {
      const expected = [
        "foundation", "framing", "electrical", "plumbing", "hvac",
        "interior", "exterior", "roofing", "finishing", "inspection",
        "safety", "other",
      ];
      for (const cat of expected) {
        expect(PhotoCategory).toHaveProperty(cat);
      }
    });
  });

  describe("getCategoryLabel", () => {
    it("returns Japanese label for each category", () => {
      expect(getCategoryLabel(PhotoCategory.foundation)).toBe("基礎工事");
      expect(getCategoryLabel(PhotoCategory.framing)).toBe("躯体工事");
      expect(getCategoryLabel(PhotoCategory.electrical)).toBe("電気工事");
      expect(getCategoryLabel(PhotoCategory.plumbing)).toBe("配管工事");
      expect(getCategoryLabel(PhotoCategory.hvac)).toBe("空調設備");
      expect(getCategoryLabel(PhotoCategory.interior)).toBe("内装工事");
      expect(getCategoryLabel(PhotoCategory.exterior)).toBe("外装工事");
      expect(getCategoryLabel(PhotoCategory.roofing)).toBe("屋根工事");
      expect(getCategoryLabel(PhotoCategory.finishing)).toBe("仕上げ工事");
      expect(getCategoryLabel(PhotoCategory.inspection)).toBe("検査");
      expect(getCategoryLabel(PhotoCategory.safety)).toBe("安全管理");
      expect(getCategoryLabel(PhotoCategory.other)).toBe("その他");
    });
  });

  describe("validatePhoto", () => {
    it("accepts valid JPEG file", () => {
      const result = validatePhoto({ type: "image/jpeg", size: 1024 * 1024, name: "photo.jpg" });
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("accepts valid PNG file", () => {
      const result = validatePhoto({ type: "image/png", size: 5 * 1024 * 1024, name: "photo.png" });
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("accepts valid HEIC file", () => {
      const result = validatePhoto({ type: "image/heic", size: 3 * 1024 * 1024, name: "photo.heic" });
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("accepts HEIF file", () => {
      const result = validatePhoto({ type: "image/heif", size: 2 * 1024 * 1024, name: "photo.heif" });
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("rejects unsupported file type", () => {
      const result = validatePhoto({ type: "image/gif", size: 1024, name: "photo.gif" });
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain("非対応");
    });

    it("rejects file exceeding 10MB", () => {
      const result = validatePhoto({ type: "image/jpeg", size: 11 * 1024 * 1024, name: "big.jpg" });
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain("上限");
    });

    it("rejects empty file", () => {
      const result = validatePhoto({ type: "image/jpeg", size: 0, name: "empty.jpg" });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("空"))).toBe(true);
    });

    it("collects multiple errors", () => {
      const result = validatePhoto({ type: "application/pdf", size: 15 * 1024 * 1024, name: "doc.pdf" });
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThanOrEqual(2);
    });

    it("accepts file exactly at 10MB", () => {
      const result = validatePhoto({ type: "image/jpeg", size: 10 * 1024 * 1024, name: "exact.jpg" });
      expect(result.valid).toBe(true);
    });
  });

  describe("generateThumbnailUrl", () => {
    it("appends width and quality params", () => {
      const url = generateThumbnailUrl("https://cdn.example.com/photo.jpg", 300);
      expect(url).toContain("w=300");
      expect(url).toContain("q=80");
    });

    it("defaults to width 200", () => {
      const url = generateThumbnailUrl("https://cdn.example.com/photo.jpg");
      expect(url).toContain("w=200");
    });

    it("preserves existing query params", () => {
      const url = generateThumbnailUrl("https://cdn.example.com/photo.jpg?token=abc", 150);
      expect(url).toContain("token=abc");
      expect(url).toContain("w=150");
    });
  });

  describe("groupPhotosByCategory", () => {
    it("groups photos by category", () => {
      const photos = [
        makePhoto({ id: "p1", category: PhotoCategory.foundation }),
        makePhoto({ id: "p2", category: PhotoCategory.foundation }),
        makePhoto({ id: "p3", category: PhotoCategory.electrical }),
      ];

      const groups = groupPhotosByCategory(photos);
      expect(groups).toHaveLength(2);
      expect(groups[0].category).toBe(PhotoCategory.foundation);
      expect(groups[0].photos).toHaveLength(2);
      expect(groups[1].category).toBe(PhotoCategory.electrical);
      expect(groups[1].photos).toHaveLength(1);
    });

    it("sorts groups by category enum order", () => {
      const photos = [
        makePhoto({ id: "p1", category: PhotoCategory.safety }),
        makePhoto({ id: "p2", category: PhotoCategory.foundation }),
        makePhoto({ id: "p3", category: PhotoCategory.roofing }),
      ];

      const groups = groupPhotosByCategory(photos);
      expect(groups.map((g) => g.category)).toEqual([
        PhotoCategory.foundation,
        PhotoCategory.roofing,
        PhotoCategory.safety,
      ]);
    });

    it("sorts photos within group by capturedAt ascending", () => {
      const photos = [
        makePhoto({ id: "p1", category: PhotoCategory.interior, capturedAt: "2025-06-01T15:00:00.000Z" }),
        makePhoto({ id: "p2", category: PhotoCategory.interior, capturedAt: "2025-06-01T09:00:00.000Z" }),
        makePhoto({ id: "p3", category: PhotoCategory.interior, capturedAt: "2025-06-01T12:00:00.000Z" }),
      ];

      const groups = groupPhotosByCategory(photos);
      expect(groups[0].photos.map((p) => p.id)).toEqual(["p2", "p3", "p1"]);
    });

    it("includes Japanese labels in groups", () => {
      const photos = [makePhoto({ id: "p1", category: PhotoCategory.plumbing })];
      const groups = groupPhotosByCategory(photos);
      expect(groups[0].label).toBe("配管工事");
    });

    it("returns empty array for empty input", () => {
      expect(groupPhotosByCategory([])).toEqual([]);
    });

    it("omits categories with no photos", () => {
      const photos = [makePhoto({ id: "p1", category: PhotoCategory.hvac })];
      const groups = groupPhotosByCategory(photos);
      expect(groups).toHaveLength(1);
      expect(groups[0].category).toBe(PhotoCategory.hvac);
    });
  });
});
