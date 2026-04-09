/**
 * Equipment rental tracking, return alerts, daily cost, and utilization.
 */

export type EquipmentRentalStatus = "active" | "returned" | "overdue";

export type EquipmentRental = {
  id: string;
  projectId: string;
  itemName: string;
  quantity: number;
  dailyRate: number;
  rentalStartDate: string;
  expectedReturnDate: string;
  actualReturnDate?: string;
  vendor?: string;
  status: EquipmentRentalStatus;
};

export type EquipmentUsageLog = {
  id: string;
  rentalId: string;
  projectId: string;
  usageDate: string;
  hoursUsed: number;
  availableHours: number;
};

export type EquipmentReturnAlert = {
  rentalId: string;
  itemName: string;
  expectedReturnDate: string;
  daysUntilReturn: number;
  status: "upcoming" | "due_today" | "overdue";
};

export type EquipmentUtilizationReport = {
  rentalId: string;
  itemName: string;
  totalUsageHours: number;
  totalAvailableHours: number;
  utilizationRate: number;
  daysTracked: number;
};

const rentals: EquipmentRental[] = [];
const usageLogs: EquipmentUsageLog[] = [];

export function trackEquipmentRental(
  rental: EquipmentRental,
): EquipmentRental {
  rentals.push({ ...rental });
  return rental;
}

export function recordEquipmentUsage(
  usage: EquipmentUsageLog,
): EquipmentUsageLog | null {
  const rental = rentals.find((entry) => entry.id === usage.rentalId);
  if (!rental) return null;

  usageLogs.push({ ...usage });
  return usage;
}

export function returnEquipment(
  rentalId: string,
  actualReturnDate: string,
): EquipmentRental | null {
  const rental = rentals.find((entry) => entry.id === rentalId);
  if (!rental) return null;

  rental.actualReturnDate = actualReturnDate;
  rental.status = "returned";
  return rental;
}

export function getEquipmentRentals(projectId: string): EquipmentRental[] {
  return rentals.filter((rental) => rental.projectId === projectId);
}

export function calculateDailyEquipmentCost(
  projectId: string,
  date: string,
): number {
  return roundCurrency(
    getEquipmentRentals(projectId)
      .filter((rental) => isRentalActiveOnDate(rental, date))
      .reduce(
        (sum, rental) => sum + rental.dailyRate * rental.quantity,
        0,
      ),
  );
}

export function getUpcomingReturnDates(
  projectId: string,
  referenceDate: string,
  daysAhead = 7,
): EquipmentReturnAlert[] {
  return getEquipmentRentals(projectId)
    .filter((rental) => rental.status !== "returned")
    .map((rental) => {
      const daysUntilReturn = getDayDifference(
        referenceDate,
        rental.expectedReturnDate,
      );
      if (daysUntilReturn < 0) {
        rental.status = "overdue";
      }

      return {
        rentalId: rental.id,
        itemName: rental.itemName,
        expectedReturnDate: rental.expectedReturnDate,
        daysUntilReturn,
        status: getReturnAlertStatus(daysUntilReturn),
      };
    })
    .filter((alert) => alert.daysUntilReturn <= daysAhead)
    .sort((left, right) => left.daysUntilReturn - right.daysUntilReturn);
}

export function generateUtilizationReport(
  projectId: string,
): EquipmentUtilizationReport[] {
  return getEquipmentRentals(projectId).map((rental) => {
    const logs = usageLogs.filter((log) => log.rentalId === rental.id);
    const totalUsageHours = logs.reduce((sum, log) => sum + log.hoursUsed, 0);
    const totalAvailableHours = logs.reduce(
      (sum, log) => sum + log.availableHours,
      0,
    );

    return {
      rentalId: rental.id,
      itemName: rental.itemName,
      totalUsageHours: roundHours(totalUsageHours),
      totalAvailableHours: roundHours(totalAvailableHours),
      utilizationRate:
        totalAvailableHours > 0
          ? roundHours((totalUsageHours / totalAvailableHours) * 100)
          : 0,
      daysTracked: new Set(logs.map((log) => log.usageDate)).size,
    };
  });
}

function isRentalActiveOnDate(rental: EquipmentRental, date: string): boolean {
  if (date < rental.rentalStartDate) return false;

  if (rental.actualReturnDate) {
    return date <= rental.actualReturnDate;
  }

  return true;
}

function getReturnAlertStatus(
  daysUntilReturn: number,
): EquipmentReturnAlert["status"] {
  if (daysUntilReturn < 0) return "overdue";
  if (daysUntilReturn === 0) return "due_today";
  return "upcoming";
}

function getDayDifference(fromDate: string, toDate: string): number {
  const from = new Date(`${fromDate}T00:00:00.000Z`);
  const to = new Date(`${toDate}T00:00:00.000Z`);
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.round((to.getTime() - from.getTime()) / msPerDay);
}

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}

function roundHours(value: number): number {
  return Math.round(value * 100) / 100;
}

export function _resetEquipmentStore(): void {
  rentals.length = 0;
  usageLogs.length = 0;
}
