/**
 * Tests for distance-calculator.
 */

import { describe, expect, it } from "vitest";
import { haversineKm, tripDuration_minutes } from "../distance-calculator.js";

describe("haversineKm", () => {
  it("returns 0 for identical coordinates", () => {
    expect(haversineKm(35.68, 139.69, 35.68, 139.69)).toBe(0);
  });

  it("Tokyo to Osaka is approximately 400 km", () => {
    // Tokyo (35.6762, 139.6503) → Osaka (34.6937, 135.5022)
    const dist = haversineKm(35.6762, 139.6503, 34.6937, 135.5022);
    expect(dist).toBeGreaterThan(390);
    expect(dist).toBeLessThan(420);
  });

  it("short distance: Shibuya to Shinjuku ~3km", () => {
    const dist = haversineKm(35.658, 139.701, 35.690, 139.700);
    expect(dist).toBeGreaterThan(2);
    expect(dist).toBeLessThan(5);
  });

  it("is symmetric: dist(A,B) === dist(B,A)", () => {
    const d1 = haversineKm(35.68, 139.69, 35.71, 139.72);
    const d2 = haversineKm(35.71, 139.72, 35.68, 139.69);
    expect(d1).toBeCloseTo(d2, 10);
  });

  it("returns a positive number for different points", () => {
    expect(haversineKm(35.68, 139.69, 35.70, 139.71)).toBeGreaterThan(0);
  });

  it("North-South distance only", () => {
    // 1 degree latitude ≈ 111 km
    const dist = haversineKm(35.0, 139.0, 36.0, 139.0);
    expect(dist).toBeGreaterThan(100);
    expect(dist).toBeLessThan(120);
  });

  it("East-West distance only", () => {
    const dist = haversineKm(35.0, 139.0, 35.0, 140.0);
    expect(dist).toBeGreaterThan(80);
    expect(dist).toBeLessThan(100);
  });

  it("very small distance (100m scale)", () => {
    const dist = haversineKm(35.68, 139.69, 35.681, 139.691);
    expect(dist).toBeGreaterThan(0);
    expect(dist).toBeLessThan(0.2);
  });
});

describe("tripDuration_minutes", () => {
  it("30km at 30km/h → 60 minutes", () => {
    expect(tripDuration_minutes(30, 30)).toBeCloseTo(60, 5);
  });

  it("0km → 0 minutes", () => {
    expect(tripDuration_minutes(0)).toBe(0);
  });

  it("60km at default 30km/h → 120 minutes", () => {
    expect(tripDuration_minutes(60)).toBeCloseTo(120, 5);
  });

  it("uses default speed of 30 km/h", () => {
    expect(tripDuration_minutes(15)).toBeCloseTo(30, 5);
  });

  it("returns Infinity for speed 0", () => {
    expect(tripDuration_minutes(10, 0)).toBe(Infinity);
  });
});
