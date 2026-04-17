import { describe, expect, it } from "vitest";
import {
  type EquipmentRental,
  detectOverdue,
  recordRental,
  returnEquipment,
  summarizeUtilization,
} from "../equipment-utilization-tracker.js";

// ── Helpers ───────────────────────────────────────────────

function makeInput(
  overrides: Partial<Omit<EquipmentRental, "id" | "createdAt">> = {},
): Omit<EquipmentRental, "id" | "createdAt"> {
  return {
    projectId: "proj-1",
    equipmentType: "scaffold",
    equipmentName: "枠組足場 60㎡",
    vendor: "足場レンタル太郎",
    rentalStartDate: "2025-04-01",
    rentalEndDate: "2025-04-30",
    dailyRate: 3_000,
    ...overrides,
  };
}

function makeRental(
  overrides: Partial<Omit<EquipmentRental, "id" | "createdAt">> = {},
): EquipmentRental {
  return recordRental(makeInput(overrides));
}

// ── recordRental ──────────────────────────────────────────

describe("recordRental", () => {
  it("assigns a UUID id", () => {
    const rental = recordRental(makeInput());
    expect(rental.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  });

  it("assigns a createdAt Date", () => {
    const before = new Date();
    const rental = recordRental(makeInput());
    const after = new Date();
    expect(rental.createdAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(rental.createdAt.getTime()).toBeLessThanOrEqual(after.getTime());
  });

  it("preserves all input fields", () => {
    const input = makeInput({
      equipmentType: "crane",
      equipmentName: "ユニック車 3t",
      dailyRate: 25_000,
    });
    const rental = recordRental(input);
    expect(rental.equipmentType).toBe("crane");
    expect(rental.equipmentName).toBe("ユニック車 3t");
    expect(rental.dailyRate).toBe(25_000);
    expect(rental.projectId).toBe("proj-1");
  });

  it("generates unique ids for separate calls", () => {
    const a = recordRental(makeInput());
    const b = recordRental(makeInput());
    expect(a.id).not.toBe(b.id);
  });
});

// ── returnEquipment ───────────────────────────────────────

describe("returnEquipment", () => {
  it("sets actualReturnDate on the returned rental", () => {
    const rental = makeRental();
    const returned = returnEquipment(rental, "2025-04-25");
    expect(returned.actualReturnDate).toBe("2025-04-25");
  });

  it("does not mutate the original rental", () => {
    const rental = makeRental();
    returnEquipment(rental, "2025-04-25");
    expect(rental.actualReturnDate).toBeUndefined();
  });

  it("preserves other fields unchanged", () => {
    const rental = makeRental({ equipmentName: "枠組足場 60㎡", dailyRate: 3_000 });
    const returned = returnEquipment(rental, "2025-04-20");
    expect(returned.equipmentName).toBe("枠組足場 60㎡");
    expect(returned.dailyRate).toBe(3_000);
    expect(returned.id).toBe(rental.id);
  });

  it("can return on the same day as rentalStartDate", () => {
    const rental = makeRental({ rentalStartDate: "2025-04-10" });
    const returned = returnEquipment(rental, "2025-04-10");
    expect(returned.actualReturnDate).toBe("2025-04-10");
  });
});

// ── summarizeUtilization ──────────────────────────────────

describe("summarizeUtilization", () => {
  it("returns zero totals for empty rentals", () => {
    const summary = summarizeUtilization([], "2025-04-15");
    expect(summary.totalRentals).toBe(0);
    expect(summary.activeRentals).toBe(0);
    expect(summary.totalRentalDays).toBe(0);
    expect(summary.totalRentalCost).toBe(0);
  });

  it("counts active rentals correctly as of asOfDate", () => {
    const active = makeRental({
      rentalStartDate: "2025-04-01",
      rentalEndDate: "2025-04-30",
    });
    const notStarted = makeRental({
      rentalStartDate: "2025-05-01",
      rentalEndDate: "2025-05-31",
    });
    const returned = returnEquipment(
      makeRental({ rentalStartDate: "2025-03-01", rentalEndDate: "2025-03-31" }),
      "2025-03-25",
    );

    const summary = summarizeUtilization([active, notStarted, returned], "2025-04-15");
    expect(summary.activeRentals).toBe(1);
    expect(summary.totalRentals).toBe(3);
  });

  it("calculates total cost from rental days × daily rate", () => {
    // 10 days @ 3,000/day = 30,000
    const rental = makeRental({
      rentalStartDate: "2025-04-01",
      rentalEndDate: "2025-04-30",
      dailyRate: 3_000,
    });
    const returned = returnEquipment(rental, "2025-04-11");
    const summary = summarizeUtilization([returned], "2025-04-15");
    expect(summary.totalRentalDays).toBe(10);
    expect(summary.totalRentalCost).toBe(30_000);
  });

  it("aggregates byType with multiple equipment types", () => {
    const scaffold = makeRental({
      equipmentType: "scaffold",
      dailyRate: 3_000,
      rentalStartDate: "2025-04-01",
      rentalEndDate: "2025-04-10",
    });
    const returnedScaffold = returnEquipment(scaffold, "2025-04-06"); // 5 days
    const crane = makeRental({
      equipmentType: "crane",
      dailyRate: 20_000,
      rentalStartDate: "2025-04-01",
      rentalEndDate: "2025-04-10",
    });
    const returnedCrane = returnEquipment(crane, "2025-04-03"); // 2 days

    const summary = summarizeUtilization([returnedScaffold, returnedCrane], "2025-04-15");
    expect(summary.byType.scaffold.count).toBe(1);
    expect(summary.byType.scaffold.cost).toBe(15_000); // 5 * 3,000
    expect(summary.byType.crane.count).toBe(1);
    expect(summary.byType.crane.cost).toBe(40_000); // 2 * 20,000
    expect(summary.byType.lift.count).toBe(0);
    expect(summary.byType.lift.cost).toBe(0);
  });

  it("uses asOfDate as end for active (not-yet-returned) rentals", () => {
    const rental = makeRental({
      rentalStartDate: "2025-04-01",
      rentalEndDate: "2025-04-30",
      dailyRate: 1_000,
    });
    // asOfDate = Apr 11 → 10 days elapsed
    const summary = summarizeUtilization([rental], "2025-04-11");
    expect(summary.totalRentalDays).toBe(10);
    expect(summary.totalRentalCost).toBe(10_000);
  });
});

// ── detectOverdue ─────────────────────────────────────────

describe("detectOverdue", () => {
  it("returns empty array for empty rentals", () => {
    const alerts = detectOverdue([], "2025-04-15");
    expect(alerts).toHaveLength(0);
  });

  it("returns no alerts when all rentals are within planned period", () => {
    const rental = makeRental({
      rentalStartDate: "2025-04-01",
      rentalEndDate: "2025-04-30",
    });
    const alerts = detectOverdue([rental], "2025-04-15");
    expect(alerts).toHaveLength(0);
  });

  it("detects overdue rental and calculates extra cost", () => {
    const rental = makeRental({
      equipmentName: "枠組足場 60㎡",
      rentalStartDate: "2025-04-01",
      rentalEndDate: "2025-04-10",
      dailyRate: 3_000,
    });
    // asOfDate = Apr 15 → 5 days overdue
    const alerts = detectOverdue([rental], "2025-04-15");
    expect(alerts).toHaveLength(1);
    expect(alerts[0].daysOverdue).toBe(5);
    expect(alerts[0].estimatedExtraCost).toBe(15_000);
    expect(alerts[0].equipmentName).toBe("枠組足場 60㎡");
    expect(alerts[0].plannedEndDate).toBe("2025-04-10");
  });

  it("skips rentals that have been returned", () => {
    const rental = makeRental({
      rentalStartDate: "2025-04-01",
      rentalEndDate: "2025-04-10",
    });
    const returned = returnEquipment(rental, "2025-04-12"); // returned late but still returned
    const alerts = detectOverdue([returned], "2025-04-20");
    expect(alerts).toHaveLength(0);
  });

  it("handles long-term overdue correctly", () => {
    const rental = makeRental({
      equipmentName: "ユニック車 3t",
      rentalStartDate: "2025-01-01",
      rentalEndDate: "2025-01-31",
      dailyRate: 25_000,
    });
    // 74 days overdue (Feb + Mar + 15 days Apr = 28+31+15=74)
    const alerts = detectOverdue([rental], "2025-04-15");
    expect(alerts).toHaveLength(1);
    expect(alerts[0].daysOverdue).toBe(74);
    expect(alerts[0].estimatedExtraCost).toBe(74 * 25_000);
  });

  it("detects overdue across multiple types", () => {
    const overdueScaffold = makeRental({
      equipmentType: "scaffold",
      rentalEndDate: "2025-04-05",
    });
    const overdueVehicle = makeRental({
      equipmentType: "vehicle",
      rentalEndDate: "2025-04-08",
    });
    const onTime = makeRental({
      equipmentType: "tool",
      rentalEndDate: "2025-04-30",
    });

    const alerts = detectOverdue([overdueScaffold, overdueVehicle, onTime], "2025-04-15");
    expect(alerts).toHaveLength(2);
    const types = alerts.map((a) => a.rentalId);
    expect(types).toContain(overdueScaffold.id);
    expect(types).toContain(overdueVehicle.id);
  });
});
