import { describe, it, expect, beforeEach } from "vitest";
import {
  addVendor,
  rateVendor,
  getVendor,
  getVendorHistory,
  calculateVendorReliability,
  findBestVendor,
  clearVendors,
  type Vendor,
} from "./vendor-management.js";

function makeVendor(overrides: Partial<Vendor> = {}): Vendor {
  return {
    id: "v1",
    name: "Test Vendor",
    skills: ["plumbing"],
    ratings: [],
    projects: ["p1", "p2"],
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("vendor-management", () => {
  beforeEach(() => clearVendors());

  it("adds and retrieves a vendor", () => {
    const v = makeVendor();
    addVendor(v);
    expect(getVendor("v1")).toEqual(v);
  });

  it("returns undefined for unknown vendor", () => {
    expect(getVendor("unknown")).toBeUndefined();
  });

  it("rates a vendor", () => {
    addVendor(makeVendor());
    const rating = rateVendor("v1", 4, "Good work");
    expect(rating).not.toBeNull();
    expect(rating!.score).toBe(4);
    expect(getVendor("v1")!.ratings).toHaveLength(1);
  });

  it("clamps rating score to 1-5", () => {
    addVendor(makeVendor());
    expect(rateVendor("v1", 10, "")!.score).toBe(5);
    expect(rateVendor("v1", -1, "")!.score).toBe(1);
  });

  it("returns null rating for unknown vendor", () => {
    expect(rateVendor("nope", 3, "")).toBeNull();
  });

  it("gets vendor history", () => {
    addVendor(makeVendor({ projects: ["p1", "p2", "p3"] }));
    expect(getVendorHistory("v1")).toEqual(["p1", "p2", "p3"]);
  });

  it("returns empty history for unknown vendor", () => {
    expect(getVendorHistory("nope")).toEqual([]);
  });

  it("calculates vendor reliability", () => {
    const v = makeVendor({ projects: ["p1", "p2", "p3", "p4", "p5"] });
    v.ratings = [
      { score: 5, review: "", ratedAt: "" },
      { score: 4, review: "", ratedAt: "" },
    ];
    const result = calculateVendorReliability(v);
    expect(result.averageRating).toBe(4.5);
    expect(result.totalProjects).toBe(5);
    expect(result.reliability).toBeGreaterThan(0);
    expect(result.reliability).toBeLessThanOrEqual(100);
  });

  it("finds best vendor by skill", () => {
    addVendor(makeVendor({ id: "v1", skills: ["plumbing"], ratings: [{ score: 3, review: "", ratedAt: "" }] }));
    addVendor(makeVendor({ id: "v2", skills: ["plumbing"], ratings: [{ score: 5, review: "", ratedAt: "" }] }));
    addVendor(makeVendor({ id: "v3", skills: ["electrical"] }));
    const ranked = findBestVendor("plumbing");
    expect(ranked).toHaveLength(2);
    expect(ranked[0].id).toBe("v2");
  });

  it("findBestVendor is case insensitive", () => {
    addVendor(makeVendor({ skills: ["Plumbing"] }));
    expect(findBestVendor("plumbing")).toHaveLength(1);
  });
});
