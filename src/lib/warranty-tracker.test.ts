import { beforeEach, describe, expect, it } from "vitest";
import {
  addWarrantyClaim,
  clearWarrantyItems,
  generateWarrantyReport,
  getExpiryAlerts,
  getWarrantyItems,
  registerWarrantyItem,
} from "./warranty-tracker.js";

describe("warranty-tracker", () => {
  beforeEach(() => {
    clearWarrantyItems();
  });

  it("registers warranty items with generated ids", () => {
    const item = registerWarrantyItem({
      projectId: "proj-1",
      assetName: "Roof membrane",
      category: "envelope",
      vendorName: "Waterproof Co",
      startDate: "2025-01-01",
      expiryDate: "2027-01-01",
    });

    expect(item.id).toBe("warranty-1");
    expect(item.claimHistory).toEqual([]);
  });

  it("records claim history against registered items", () => {
    const item = registerWarrantyItem({
      projectId: "proj-1",
      assetName: "VRF condenser",
      category: "mechanical",
      vendorName: "HVAC Systems",
      startDate: "2025-02-01",
      expiryDate: "2028-02-01",
    });

    const updated = addWarrantyClaim(item.id, {
      claimDate: "2025-05-01",
      issue: "Compressor trips on startup",
      status: "submitted",
      resolutionNotes: "Awaiting vendor inspection",
    });

    expect(updated.claimHistory).toHaveLength(1);
    expect(updated.claimHistory[0].id).toBe("warranty-claim-1");
    expect(updated.claimHistory[0].issue).toContain("Compressor");
  });

  it("returns expiry alerts and filters by project", () => {
    registerWarrantyItem({
      projectId: "proj-1",
      assetName: "Sealant joints",
      category: "facade",
      vendorName: "Envelope Co",
      startDate: "2024-05-01",
      expiryDate: "2025-05-20",
    });
    registerWarrantyItem({
      projectId: "proj-2",
      assetName: "Generator",
      category: "electrical",
      vendorName: "Power Co",
      startDate: "2024-01-01",
      expiryDate: "2025-12-31",
    });

    const alerts = getExpiryAlerts("2025-05-01", 30, "proj-1");

    expect(alerts).toHaveLength(1);
    expect(alerts[0].assetName).toBe("Sealant joints");
    expect(alerts[0].status).toBe("expiring");
  });

  it("generates a warranty report and exposes stored items", () => {
    const item = registerWarrantyItem({
      projectId: "proj-1",
      assetName: "Elevator controller <A>",
      category: "vertical transportation",
      vendorName: "Lift Co",
      startDate: "2025-03-01",
      expiryDate: "2026-03-01",
    });

    addWarrantyClaim(item.id, {
      claimDate: "2025-04-15",
      issue: "Panel alarm reset issue",
      status: "resolved",
      resolutionNotes: "Firmware updated",
    });

    const report = generateWarrantyReport("proj-1", "2025-02-20");

    expect(getWarrantyItems("proj-1")).toHaveLength(1);
    expect(report).toContain("Warranty Report");
    expect(report).toContain("&lt;A&gt;");
    expect(report).toContain("Lift Co");
    expect(report).toContain("Claims");
  });

  it("throws on unknown warranty item ids", () => {
    expect(() =>
      addWarrantyClaim("missing", {
        claimDate: "2025-01-01",
        issue: "Unknown",
        status: "submitted",
      }),
    ).toThrow("Warranty item not found: missing");
  });
});
