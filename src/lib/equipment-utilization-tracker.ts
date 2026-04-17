/**
 * Equipment Utilization Tracker (DDC Phase 3-2)
 * 重機・足場・電工道具のレンタル期間×日次レート×超過アラート
 * Pure functions, no storage layer.
 */

export interface EquipmentRental {
  id: string;
  projectId: string;
  equipmentType: 'scaffold' | 'crane' | 'lift' | 'tool' | 'vehicle' | 'other';
  equipmentName: string; // 例: "枠組足場 60㎡", "ユニック車 3t"
  vendor?: string;
  rentalStartDate: string; // YYYY-MM-DD
  rentalEndDate: string; // YYYY-MM-DD（予定）
  actualReturnDate?: string; // YYYY-MM-DD（返却済みなら）
  dailyRate: number; // 円/日
  notes?: string;
  createdAt: Date;
}

export interface UtilizationSummary {
  projectId: string;
  totalRentals: number;
  activeRentals: number; // 今日時点で借りてるもの
  totalRentalDays: number;
  totalRentalCost: number;
  byType: Record<EquipmentRental['equipmentType'], { count: number; cost: number }>;
}

export interface OverdueAlert {
  rentalId: string;
  equipmentName: string;
  plannedEndDate: string;
  daysOverdue: number;
  estimatedExtraCost: number;
}

const EQUIPMENT_TYPES: EquipmentRental['equipmentType'][] = [
  'scaffold',
  'crane',
  'lift',
  'tool',
  'vehicle',
  'other',
];

function zeroTypeMap(): Record<EquipmentRental['equipmentType'], { count: number; cost: number }> {
  return Object.fromEntries(
    EQUIPMENT_TYPES.map((t) => [t, { count: 0, cost: 0 }]),
  ) as Record<EquipmentRental['equipmentType'], { count: number; cost: number }>;
}

/**
 * Record a new equipment rental.
 * Assigns a UUID and createdAt timestamp.
 */
export function recordRental(
  input: Omit<EquipmentRental, 'id' | 'createdAt'>,
): EquipmentRental {
  return {
    ...input,
    id: crypto.randomUUID(),
    createdAt: new Date(),
  };
}

/**
 * Mark equipment as returned.
 * Returns a new rental object with actualReturnDate set.
 */
export function returnEquipment(
  rental: EquipmentRental,
  actualReturnDate: string,
): EquipmentRental {
  return {
    ...rental,
    actualReturnDate,
  };
}

/**
 * Calculate rental days for a single rental as of asOfDate.
 * Uses actualReturnDate if set; otherwise uses asOfDate (for active rentals)
 * or rentalEndDate (if not yet started).
 */
function calcRentalDays(rental: EquipmentRental, asOfDate: string): number {
  const endDate = rental.actualReturnDate ?? asOfDate;
  const start = new Date(`${rental.rentalStartDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  const days = Math.round((end.getTime() - start.getTime()) / 86_400_000);
  return Math.max(0, days);
}

/**
 * Whether a rental is active on asOfDate:
 * started on or before asOfDate and not yet returned (or returned after asOfDate).
 */
function isActiveOnDate(rental: EquipmentRental, asOfDate: string): boolean {
  if (rental.rentalStartDate > asOfDate) return false;
  if (rental.actualReturnDate && rental.actualReturnDate < asOfDate) return false;
  return true;
}

/**
 * Summarize utilization for a set of rentals as of asOfDate.
 */
export function summarizeUtilization(
  rentals: EquipmentRental[],
  asOfDate: string,
): UtilizationSummary {
  const projectId = rentals[0]?.projectId ?? '';
  const byType = zeroTypeMap();

  let totalRentalDays = 0;
  let totalRentalCost = 0;
  let activeRentals = 0;

  for (const rental of rentals) {
    const days = calcRentalDays(rental, asOfDate);
    const cost = days * rental.dailyRate;

    totalRentalDays += days;
    totalRentalCost += cost;

    byType[rental.equipmentType].count += 1;
    byType[rental.equipmentType].cost += cost;

    if (isActiveOnDate(rental, asOfDate)) {
      activeRentals += 1;
    }
  }

  return {
    projectId,
    totalRentals: rentals.length,
    activeRentals,
    totalRentalDays,
    totalRentalCost,
    byType,
  };
}

/**
 * Detect rentals that have passed their planned end date without being returned.
 */
export function detectOverdue(
  rentals: EquipmentRental[],
  asOfDate: string,
): OverdueAlert[] {
  const alerts: OverdueAlert[] = [];

  for (const rental of rentals) {
    // Skip if already returned
    if (rental.actualReturnDate) continue;

    if (rental.rentalEndDate >= asOfDate) continue;

    const end = new Date(`${rental.rentalEndDate}T00:00:00Z`);
    const asOf = new Date(`${asOfDate}T00:00:00Z`);
    const daysOverdue = Math.round((asOf.getTime() - end.getTime()) / 86_400_000);

    alerts.push({
      rentalId: rental.id,
      equipmentName: rental.equipmentName,
      plannedEndDate: rental.rentalEndDate,
      daysOverdue,
      estimatedExtraCost: daysOverdue * rental.dailyRate,
    });
  }

  return alerts;
}
