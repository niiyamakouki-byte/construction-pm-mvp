import { describe, expect, it } from "vitest";
import {
  organizeByDate,
  organizeByLocation,
  generatePhotoReport,
  type PhotoMetadata,
} from "./photo-organizer.js";

function makePhoto(overrides: Partial<PhotoMetadata> & Pick<PhotoMetadata, "id">): PhotoMetadata {
  return {
    id: overrides.id,
    url: `https://example.com/${overrides.id}.jpg`,
    capturedAt: "2025-03-10T09:00:00.000Z",
    projectId: "proj-1",
    description: "現場写真",
    tags: [],
    ...overrides,
  };
}

describe("photo-organizer", () => {
  describe("organizeByDate", () => {
    it("groups photos by capture date", () => {
      const photos = [
        makePhoto({ id: "p1", capturedAt: "2025-03-10T09:00:00.000Z" }),
        makePhoto({ id: "p2", capturedAt: "2025-03-10T14:00:00.000Z" }),
        makePhoto({ id: "p3", capturedAt: "2025-03-11T10:00:00.000Z" }),
      ];

      const groups = organizeByDate(photos);

      expect(groups).toHaveLength(2);
      expect(groups[0].key).toBe("2025-03-10");
      expect(groups[0].photos).toHaveLength(2);
      expect(groups[1].key).toBe("2025-03-11");
      expect(groups[1].photos).toHaveLength(1);
    });

    it("sorts groups by date ascending", () => {
      const photos = [
        makePhoto({ id: "p1", capturedAt: "2025-03-12T09:00:00.000Z" }),
        makePhoto({ id: "p2", capturedAt: "2025-03-10T09:00:00.000Z" }),
        makePhoto({ id: "p3", capturedAt: "2025-03-11T09:00:00.000Z" }),
      ];

      const groups = organizeByDate(photos);

      expect(groups.map((g) => g.key)).toEqual([
        "2025-03-10",
        "2025-03-11",
        "2025-03-12",
      ]);
    });

    it("sorts photos within a group by capturedAt", () => {
      const photos = [
        makePhoto({ id: "p2", capturedAt: "2025-03-10T14:00:00.000Z" }),
        makePhoto({ id: "p1", capturedAt: "2025-03-10T09:00:00.000Z" }),
      ];

      const groups = organizeByDate(photos);

      expect(groups[0].photos[0].id).toBe("p1");
      expect(groups[0].photos[1].id).toBe("p2");
    });

    it("returns empty array for no photos", () => {
      expect(organizeByDate([])).toEqual([]);
    });
  });

  describe("organizeByLocation", () => {
    it("groups photos by projectId", () => {
      const photos = [
        makePhoto({ id: "p1", projectId: "proj-1" }),
        makePhoto({ id: "p2", projectId: "proj-2" }),
        makePhoto({ id: "p3", projectId: "proj-1" }),
      ];

      const groups = organizeByLocation(photos);

      expect(groups).toHaveLength(2);
      expect(groups[0].key).toBe("proj-1");
      expect(groups[0].photos).toHaveLength(2);
      expect(groups[1].key).toBe("proj-2");
      expect(groups[1].photos).toHaveLength(1);
    });

    it("sorts groups by projectId", () => {
      const photos = [
        makePhoto({ id: "p1", projectId: "proj-c" }),
        makePhoto({ id: "p2", projectId: "proj-a" }),
        makePhoto({ id: "p3", projectId: "proj-b" }),
      ];

      const groups = organizeByLocation(photos);

      expect(groups.map((g) => g.key)).toEqual(["proj-a", "proj-b", "proj-c"]);
    });

    it("returns empty array for no photos", () => {
      expect(organizeByLocation([])).toEqual([]);
    });
  });

  describe("generatePhotoReport", () => {
    const project = { id: "proj-1", name: "南青山リノベ" };

    it("generates HTML with filtered photos for the date", () => {
      const photos = [
        makePhoto({
          id: "p1",
          projectId: "proj-1",
          capturedAt: "2025-03-10T09:00:00.000Z",
          description: "基礎工事",
          tags: ["基礎", "コンクリート"],
        }),
        makePhoto({
          id: "p2",
          projectId: "proj-1",
          capturedAt: "2025-03-11T09:00:00.000Z",
          description: "別日の写真",
        }),
        makePhoto({
          id: "p3",
          projectId: "proj-2",
          capturedAt: "2025-03-10T09:00:00.000Z",
          description: "別現場の写真",
        }),
      ];

      const html = generatePhotoReport(project, "2025-03-10", photos);

      expect(html).toContain("<!DOCTYPE html>");
      expect(html).toContain("写真報告書");
      expect(html).toContain("南青山リノベ");
      expect(html).toContain("2025-03-10");
      expect(html).toContain("基礎工事");
      expect(html).toContain("基礎, コンクリート");
      expect(html).not.toContain("別日の写真");
      expect(html).not.toContain("別現場の写真");
    });

    it("shows photo count", () => {
      const photos = [
        makePhoto({ id: "p1", capturedAt: "2025-03-10T09:00:00.000Z" }),
        makePhoto({ id: "p2", capturedAt: "2025-03-10T14:00:00.000Z" }),
      ];

      const html = generatePhotoReport(project, "2025-03-10", photos);

      expect(html).toContain("全2枚");
    });

    it("handles no matching photos", () => {
      const html = generatePhotoReport(project, "2025-03-10", []);

      expect(html).toContain("写真なし");
      expect(html).toContain("全0枚");
    });

    it("escapes HTML in descriptions", () => {
      const photos = [
        makePhoto({
          id: "p1",
          capturedAt: "2025-03-10T09:00:00.000Z",
          description: '<script>alert("xss")</script>',
        }),
      ];

      const html = generatePhotoReport(project, "2025-03-10", photos);

      expect(html).not.toContain("<script>");
      expect(html).toContain("&lt;script&gt;");
    });

    it("escapes HTML in project name", () => {
      const xssProject = { id: "proj-1", name: '<img onerror="alert(1)">' };
      const html = generatePhotoReport(xssProject, "2025-03-10", []);

      expect(html).not.toContain('onerror="alert(1)"');
      expect(html).toContain("&lt;img onerror=");
    });

    it("sorts photos by capturedAt within the report", () => {
      const photos = [
        makePhoto({ id: "p2", capturedAt: "2025-03-10T14:00:00.000Z", description: "午後" }),
        makePhoto({ id: "p1", capturedAt: "2025-03-10T09:00:00.000Z", description: "午前" }),
      ];

      const html = generatePhotoReport(project, "2025-03-10", photos);

      const morningIdx = html.indexOf("午前");
      const afternoonIdx = html.indexOf("午後");
      expect(morningIdx).toBeLessThan(afternoonIdx);
    });

    it("omits tags section when tags are empty", () => {
      const photos = [
        makePhoto({ id: "p1", capturedAt: "2025-03-10T09:00:00.000Z", tags: [] }),
      ];

      const html = generatePhotoReport(project, "2025-03-10", photos);

      expect(html).not.toContain('class="tags"');
    });

    it("renders tags when present", () => {
      const photos = [
        makePhoto({
          id: "p1",
          capturedAt: "2025-03-10T09:00:00.000Z",
          tags: ["外壁", "足場"],
        }),
      ];

      const html = generatePhotoReport(project, "2025-03-10", photos);

      expect(html).toContain("外壁, 足場");
      expect(html).toContain('class="tags"');
    });
  });
});
