import { beforeEach, describe, expect, it } from "vitest";
import {
  type EquipmentRental,
  type EquipmentUsageLog,
  _resetEquipmentStore,
  calculateDailyEquipmentCost,
  generateUtilizationReport,
  getEquipmentRentals,
  getUpcomingReturnDates,
  recordEquipmentUsage,
  returnEquipment,
  trackEquipmentRental,
} from "./equipment-tracker.js";

beforeEach(() => {
  _resetEquipmentStore();
});

function makeRental(
  overrides: Partial<EquipmentRental> = {},
): EquipmentRental {
  return {
    id: "rental-1",
    projectId: "proj-1",
    itemName: "Mini Excavator",
    quantity: 1,
    dailyRate: 18000,
    rentalStartDate: "2025-04-01",
    expectedReturnDate: "2025-04-10",
    status: "active",
    ...overrides,
  };
}

function makeUsage(
  overrides: Partial<EquipmentUsageLog> = {},
): EquipmentUsageLog {
  return {
    id: "usage-1",
    rentalId: "rental-1",
    projectId: "proj-1",
    usageDate: "2025-04-02",
    hoursUsed: 6,
    availableHours: 8,
    ...overrides,
  };
}

describe("equipment-tracker", () => {
  it("stores equipment rentals", () => {
    const rental = trackEquipmentRental(makeRental());

    expect(rental.itemName).toBe("Mini Excavator");
    expect(getEquipmentRentals("proj-1")).toHaveLength(1);
  });

  it("records utilization logs for existing rentals", () => {
    trackEquipmentRental(makeRental());

    const usage = recordEquipmentUsage(makeUsage());

    expect(usage?.id).toBe("usage-1");
    expect(generateUtilizationReport("proj-1")[0].totalUsageHours).toBe(6);
  });

  it("rejects utilization logs for unknown rentals", () => {
    expect(recordEquipmentUsage(makeUsage())).toBeNull();
  });

  it("calculates daily equipment cost from active rentals", () => {
    trackEquipmentRental(makeRental({ quantity: 2, dailyRate: 12000 }));
    trackEquipmentRental(
      makeRental({
        id: "rental-2",
        itemName: "Scissor Lift",
        dailyRate: 9000,
        expectedReturnDate: "2025-04-05",
      }),
    );

    expect(calculateDailyEquipmentCost("proj-1", "2025-04-03")).toBe(33000);
  });

  it("stops charging a rental after it is returned", () => {
    trackEquipmentRental(makeRental());
    returnEquipment("rental-1", "2025-04-04");

    expect(calculateDailyEquipmentCost("proj-1", "2025-04-05")).toBe(0);
  });

  it("returns upcoming and overdue return alerts", () => {
    trackEquipmentRental(makeRental({ id: "soon", expectedReturnDate: "2025-04-03" }));
    trackEquipmentRental(makeRental({ id: "late", expectedReturnDate: "2025-03-30" }));

    const alerts = getUpcomingReturnDates("proj-1", "2025-04-01");

    expect(alerts).toHaveLength(2);
    expect(alerts[0].rentalId).toBe("late");
    expect(alerts[0].status).toBe("overdue");
    expect(getEquipmentRentals("proj-1").find((item) => item.id === "late")?.status).toBe(
      "overdue",
    );
  });

  it("generates utilization percentages per rental", () => {
    trackEquipmentRental(makeRental());
    recordEquipmentUsage(makeUsage({ hoursUsed: 6, availableHours: 8 }));
    recordEquipmentUsage(
      makeUsage({
        id: "usage-2",
        usageDate: "2025-04-03",
        hoursUsed: 4,
        availableHours: 8,
      }),
    );

    const [report] = generateUtilizationReport("proj-1");

    expect(report.daysTracked).toBe(2);
    expect(report.totalUsageHours).toBe(10);
    expect(report.utilizationRate).toBe(62.5);
  });
});
