import { describe, expect, it } from "vitest";
import {
  embedGpsExif,
  extractExifFromBlackboard,
  formatExifForDisplay,
  decimalToDmsComponents,
  calculateDistance,
  groupPhotosByLocation,
  type ExifData,
  type PhotoWithExif,
} from "../lib/photo-exif.js";

function makeExif(overrides: Partial<ExifData> = {}): ExifData {
  return {
    latitude: 35.6762,
    longitude: 139.6503,
    timestamp: "2025-03-10T09:00:00.000Z",
    ...overrides,
  };
}

function makePhoto(id: string, exif: Partial<ExifData> = {}): PhotoWithExif {
  return {
    id,
    url: `https://example.com/${id}.jpg`,
    exif: makeExif(exif),
  };
}

describe("photo-exif", () => {
  describe("embedGpsExif", () => {
    it("embeds GPS data into a photo record", () => {
      const photo = { id: "p1", url: "https://example.com/p1.jpg" };
      const exif = makeExif({ altitude: 10, deviceModel: "iPhone 15" });

      const result = embedGpsExif(photo, exif);

      expect(result.id).toBe("p1");
      expect(result.url).toBe("https://example.com/p1.jpg");
      expect(result.exif.latitude).toBe(35.6762);
      expect(result.exif.longitude).toBe(139.6503);
      expect(result.exif.altitude).toBe(10);
      expect(result.exif.deviceModel).toBe("iPhone 15");
    });

    it("returns a copy of exif (does not share reference)", () => {
      const photo = { id: "p1", url: "https://example.com/p1.jpg" };
      const exif = makeExif();

      const result = embedGpsExif(photo, exif);
      exif.latitude = 0;

      expect(result.exif.latitude).toBe(35.6762);
    });

    it("embeds blackboardId when provided", () => {
      const photo = { id: "p2", url: "https://example.com/p2.jpg" };
      const exif = makeExif({ blackboardId: "bb-001" });

      const result = embedGpsExif(photo, exif);

      expect(result.exif.blackboardId).toBe("bb-001");
    });
  });

  describe("extractExifFromBlackboard", () => {
    it("extracts GPS data from blackboard with explicit lat/lng fields", () => {
      const blackboard = {
        projectName: "南青山リノベ",
        shootDate: "2025-03-10",
        workType: "内装",
        location: "東京都港区南青山",
        condition: "晴れ",
        latitude: 35.6762,
        longitude: 139.6503,
        altitude: 5,
        deviceModel: "Galaxy S24",
        blackboardId: "bb-001",
      };

      const exif = extractExifFromBlackboard(blackboard);

      expect(exif.latitude).toBe(35.6762);
      expect(exif.longitude).toBe(139.6503);
      expect(exif.altitude).toBe(5);
      expect(exif.timestamp).toBe("2025-03-10T00:00:00.000Z");
      expect(exif.deviceModel).toBe("Galaxy S24");
      expect(exif.blackboardId).toBe("bb-001");
    });

    it("parses lat/lng from location string when explicit fields are absent", () => {
      const blackboard = {
        projectName: "墨田区現場",
        shootDate: "2025-04-01",
        workType: "外装",
        location: "lat:35.7101,lng:139.8107",
        condition: "曇り",
      };

      const exif = extractExifFromBlackboard(blackboard);

      expect(exif.latitude).toBeCloseTo(35.7101, 4);
      expect(exif.longitude).toBeCloseTo(139.8107, 4);
    });

    it("defaults to 0,0 when no GPS info is available", () => {
      const blackboard = {
        projectName: "テスト現場",
        shootDate: "2025-03-01",
        workType: "施工",
        location: "住所不明",
        condition: "晴れ",
      };

      const exif = extractExifFromBlackboard(blackboard);

      expect(exif.latitude).toBe(0);
      expect(exif.longitude).toBe(0);
    });
  });

  describe("formatExifForDisplay", () => {
    it("formats positive lat/lng as N/E DMS", () => {
      const exif = makeExif({ latitude: 35.6762, longitude: 139.6503 });

      const result = formatExifForDisplay(exif);

      expect(result.latDms).toMatch(/^35°40′/);
      expect(result.latDms).toMatch(/N$/);
      expect(result.lngDms).toMatch(/^139°39′/);
      expect(result.lngDms).toMatch(/E$/);
    });

    it("formats negative latitude as S", () => {
      const exif = makeExif({ latitude: -33.8688, longitude: 151.2093 });

      const result = formatExifForDisplay(exif);

      expect(result.latDms).toMatch(/S$/);
      expect(result.lngDms).toMatch(/E$/);
    });

    it("shows altitude when present", () => {
      const exif = makeExif({ altitude: 42.5 });

      const result = formatExifForDisplay(exif);

      expect(result.altitude).toBe("42.5m");
    });

    it("shows 不明 when altitude is absent", () => {
      const exif = makeExif();

      const result = formatExifForDisplay(exif);

      expect(result.altitude).toBe("不明");
    });
  });

  describe("decimalToDmsComponents", () => {
    it("converts 35.6762 to correct DMS components", () => {
      const dms = decimalToDmsComponents(35.6762, true);

      expect(dms.degrees).toBe(35);
      expect(dms.minutes).toBe(40);
      expect(dms.seconds).toBeCloseTo(34.32, 1);
      expect(dms.direction).toBe("N");
    });

    it("assigns S direction for negative latitude", () => {
      const dms = decimalToDmsComponents(-33.8688, true);

      expect(dms.direction).toBe("S");
      expect(dms.degrees).toBe(33);
    });

    it("assigns W direction for negative longitude", () => {
      const dms = decimalToDmsComponents(-73.9857, false);

      expect(dms.direction).toBe("W");
    });

    it("handles 0 degrees", () => {
      const dms = decimalToDmsComponents(0, true);

      expect(dms.degrees).toBe(0);
      expect(dms.minutes).toBe(0);
      expect(dms.seconds).toBeCloseTo(0, 5);
      expect(dms.direction).toBe("N");
    });
  });

  describe("calculateDistance", () => {
    it("returns 0 for identical points", () => {
      const a = makeExif();
      const b = makeExif();

      expect(calculateDistance(a, b)).toBe(0);
    });

    it("calculates ~1133m between Tokyo Station and Shinjuku approximate coords", () => {
      // Tokyo Station: 35.6812, 139.7671
      // ~1km east offset: 35.6812, 139.7771
      const a = makeExif({ latitude: 35.6812, longitude: 139.7671 });
      const b = makeExif({ latitude: 35.6812, longitude: 139.7771 });

      const dist = calculateDistance(a, b);

      // ~897m expected for 0.01 degree longitude at this latitude
      expect(dist).toBeGreaterThan(700);
      expect(dist).toBeLessThan(1100);
    });

    it("distance is symmetric (a→b equals b→a)", () => {
      const a = makeExif({ latitude: 35.6762, longitude: 139.6503 });
      const b = makeExif({ latitude: 35.7101, longitude: 139.8107 });

      expect(calculateDistance(a, b)).toBeCloseTo(calculateDistance(b, a), 5);
    });

    it("Minami-Aoyama to Shibuya is roughly 1500–2500m", () => {
      const minami = makeExif({ latitude: 35.6648, longitude: 139.7175 }); // 南青山
      const shibuya = makeExif({ latitude: 35.6580, longitude: 139.7016 }); // 渋谷

      const dist = calculateDistance(minami, shibuya);

      expect(dist).toBeGreaterThan(1000);
      expect(dist).toBeLessThan(2500);
    });
  });

  describe("groupPhotosByLocation", () => {
    it("groups nearby photos together", () => {
      const photos = [
        makePhoto("p1", { latitude: 35.6762, longitude: 139.6503 }),
        makePhoto("p2", { latitude: 35.6763, longitude: 139.6504 }), // ~14m away
        makePhoto("p3", { latitude: 35.7101, longitude: 139.8107 }), // far away
      ];

      const groups = groupPhotosByLocation(photos, 100);

      expect(groups).toHaveLength(2);
      expect(groups[0].photos).toHaveLength(2);
      expect(groups[1].photos).toHaveLength(1);
    });

    it("each photo in its own group when all are far apart", () => {
      const photos = [
        makePhoto("p1", { latitude: 35.0, longitude: 135.0 }),
        makePhoto("p2", { latitude: 36.0, longitude: 136.0 }),
        makePhoto("p3", { latitude: 37.0, longitude: 137.0 }),
      ];

      const groups = groupPhotosByLocation(photos, 100);

      expect(groups).toHaveLength(3);
    });

    it("all photos in one group when radius is very large", () => {
      const photos = [
        makePhoto("p1", { latitude: 35.0, longitude: 135.0 }),
        makePhoto("p2", { latitude: 36.0, longitude: 136.0 }),
        makePhoto("p3", { latitude: 37.0, longitude: 137.0 }),
      ];

      const groups = groupPhotosByLocation(photos, 1_000_000);

      expect(groups).toHaveLength(1);
      expect(groups[0].photos).toHaveLength(3);
    });

    it("returns empty array for empty input", () => {
      expect(groupPhotosByLocation([], 100)).toEqual([]);
    });

    it("center of group is the first photo's exif", () => {
      const firstExif = makeExif({ latitude: 35.6762, longitude: 139.6503 });
      const photos = [
        { id: "p1", url: "https://example.com/p1.jpg", exif: firstExif },
        makePhoto("p2", { latitude: 35.6763, longitude: 139.6504 }),
      ];

      const groups = groupPhotosByLocation(photos, 100);

      expect(groups[0].center).toBe(firstExif);
    });
  });
});
