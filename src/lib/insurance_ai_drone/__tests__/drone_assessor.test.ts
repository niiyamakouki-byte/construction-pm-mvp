import { describe, expect, it } from "vitest";
import { assessDroneImages, type DronePhotoMeta } from "../drone_assessor.js";

function makePhoto(overrides: Partial<DronePhotoMeta> = {}): DronePhotoMeta {
  return {
    url: "https://drone.example.com/shot.jpg",
    flightAltitudeM: 30,
    gsdCmPerPixel: 0.75,
    gps: { lat: 35.676, lng: 139.65, altitudeM: 30 },
    ...overrides,
  };
}

describe("assessDroneImages", () => {
  it("returns zeros when no photos provided", () => {
    const result = assessDroneImages([]);
    expect(result.estimatedDamageJpy).toBe(0);
    expect(result.confidenceScore).toBe(0);
    expect(result.pointCloudSummary.estimatedPointCount).toBe(0);
    expect(result.damageMask.regions).toHaveLength(0);
  });

  it("returns positive damage estimate with photos", () => {
    const photos = [makePhoto(), makePhoto(), makePhoto()];
    const result = assessDroneImages(photos);
    expect(result.estimatedDamageJpy).toBeGreaterThan(0);
    expect(result.confidenceScore).toBeGreaterThan(0);
  });

  it("more photos increases damage region count", () => {
    const fewPhotos = [makePhoto(), makePhoto()];
    const manyPhotos = Array.from({ length: 10 }, () => makePhoto());
    const few = assessDroneImages(fewPhotos);
    const many = assessDroneImages(manyPhotos);
    expect(many.damageMask.regions.length).toBeGreaterThanOrEqual(few.damageMask.regions.length);
  });

  it("uses custom unit cost", () => {
    const photos = [makePhoto(), makePhoto(), makePhoto(), makePhoto()];
    const result1 = assessDroneImages(photos, 50_000);
    const result2 = assessDroneImages(photos, 100_000);
    expect(result2.estimatedDamageJpy).toBe(result1.estimatedDamageJpy * 2);
  });

  it("GPS presence increases confidence score", () => {
    const withGps = [
      makePhoto({ gps: { lat: 35.676, lng: 139.65, altitudeM: 30 } }),
      makePhoto({ gps: { lat: 35.677, lng: 139.651, altitudeM: 30 } }),
    ];
    const withoutGps = [
      makePhoto({ gps: undefined }),
      makePhoto({ gps: undefined }),
    ];
    const gpsResult = assessDroneImages(withGps);
    const noGpsResult = assessDroneImages(withoutGps);
    expect(gpsResult.confidenceScore).toBeGreaterThan(noGpsResult.confidenceScore);
  });

  it("point cloud summary has positive area and volume", () => {
    const photos = Array.from({ length: 5 }, () => makePhoto());
    const result = assessDroneImages(photos);
    expect(result.pointCloudSummary.estimatedAreaM2).toBeGreaterThan(0);
    expect(result.pointCloudSummary.estimatedVolumeM3).toBeGreaterThan(0);
    expect(result.pointCloudSummary.estimatedPointCount).toBeGreaterThan(0);
  });

  it("damage mask overall ratio is between 0 and 1", () => {
    const photos = Array.from({ length: 6 }, () => makePhoto());
    const result = assessDroneImages(photos);
    expect(result.damageMask.overallDamageRatio).toBeGreaterThan(0);
    expect(result.damageMask.overallDamageRatio).toBeLessThanOrEqual(1);
  });

  it("includes processing notes", () => {
    const photos = [makePhoto()];
    const result = assessDroneImages(photos);
    expect(result.processingNotes.length).toBeGreaterThan(0);
  });

  it("works without GPS metadata", () => {
    const photos = [
      makePhoto({ gps: undefined, flightAltitudeM: 50 }),
      makePhoto({ gps: undefined, flightAltitudeM: 50 }),
    ];
    const result = assessDroneImages(photos);
    expect(result.estimatedDamageJpy).toBeGreaterThan(0);
  });
});
