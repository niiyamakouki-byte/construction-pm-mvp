/**
 * Material delivery tracking, usage monitoring, and waste calculation.
 */

export type MaterialUnit = "m3" | "m2" | "m" | "kg" | "個" | "枚" | "本" | "t" | "袋";

export type MaterialDelivery = {
  id: string;
  projectId: string;
  materialName: string;
  quantity: number;
  unit: MaterialUnit;
  deliveryDate: string;
  supplier?: string;
  unitCost?: number;
  inspectionPassed: boolean;
  notes?: string;
};

export type MaterialUsage = {
  id: string;
  projectId: string;
  materialName: string;
  quantityUsed: number;
  unit: MaterialUnit;
  usageDate: string;
  taskId?: string;
};

export type MaterialWaste = {
  materialName: string;
  totalDelivered: number;
  totalUsed: number;
  wasteQuantity: number;
  wastePercentage: number;
  unit: MaterialUnit;
};

export type MaterialForecast = {
  materialName: string;
  currentStock: number;
  dailyUsageRate: number;
  daysRemaining: number;
  reorderDate: string;
  forecastedNeed: number;
  unit: MaterialUnit;
};

// ── Record deliveries ──────────────────────────────

const deliveries: MaterialDelivery[] = [];
const usages: MaterialUsage[] = [];

export function recordDelivery(delivery: MaterialDelivery): MaterialDelivery {
  deliveries.push(delivery);
  return delivery;
}

export function recordUsage(usage: MaterialUsage): MaterialUsage {
  usages.push(usage);
  return usage;
}

export function getDeliveries(projectId: string): MaterialDelivery[] {
  return deliveries.filter((d) => d.projectId === projectId);
}

export function getUsages(projectId: string): MaterialUsage[] {
  return usages.filter((u) => u.projectId === projectId);
}

// ── Waste calculation ──────────────────────────────

export function calculateWaste(
  projectId: string,
  materialName?: string,
): MaterialWaste[] {
  const projDeliveries = getDeliveries(projectId);
  const projUsages = getUsages(projectId);

  const materialNames = materialName
    ? [materialName]
    : [...new Set(projDeliveries.map((d) => d.materialName))];

  return materialNames.map((name) => {
    const dels = projDeliveries.filter((d) => d.materialName === name);
    const uses = projUsages.filter((u) => u.materialName === name);
    const totalDelivered = dels.reduce((s, d) => s + d.quantity, 0);
    const totalUsed = uses.reduce((s, u) => s + u.quantityUsed, 0);
    const waste = Math.max(0, totalDelivered - totalUsed);
    const unit = dels[0]?.unit ?? ("個" as MaterialUnit);

    return {
      materialName: name,
      totalDelivered,
      totalUsed,
      wasteQuantity: waste,
      wastePercentage: totalDelivered > 0 ? (waste / totalDelivered) * 100 : 0,
      unit,
    };
  });
}

// ── Forecast ───────────────────────────────────────

export function forecastNeeded(
  projectId: string,
  remainingDays: number,
  materialName?: string,
): MaterialForecast[] {
  const projDeliveries = getDeliveries(projectId);
  const projUsages = getUsages(projectId);

  const materialNames = materialName
    ? [materialName]
    : [...new Set(projDeliveries.map((d) => d.materialName))];

  const today = new Date();

  return materialNames.map((name) => {
    const dels = projDeliveries.filter((d) => d.materialName === name);
    const uses = projUsages.filter((u) => u.materialName === name);
    const totalDelivered = dels.reduce((s, d) => s + d.quantity, 0);
    const totalUsed = uses.reduce((s, u) => s + u.quantityUsed, 0);
    const currentStock = totalDelivered - totalUsed;

    // Calculate daily usage rate
    const usageDates = uses.map((u) => new Date(u.usageDate).getTime());
    let dailyRate = 0;
    if (usageDates.length >= 2) {
      const minDate = Math.min(...usageDates);
      const maxDate = Math.max(...usageDates);
      const daySpan = (maxDate - minDate) / (1000 * 60 * 60 * 24);
      dailyRate = daySpan > 0 ? totalUsed / daySpan : totalUsed;
    } else if (uses.length === 1) {
      dailyRate = totalUsed;
    }

    const daysRemaining = dailyRate > 0 ? currentStock / dailyRate : Infinity;
    const forecastedNeed = Math.max(0, dailyRate * remainingDays - currentStock);

    const reorderDate = new Date(today);
    if (Number.isFinite(daysRemaining)) {
      reorderDate.setDate(
        reorderDate.getDate() + Math.max(0, Math.floor(daysRemaining) - 3),
      );
    }

    const unit = dels[0]?.unit ?? ("個" as MaterialUnit);

    return {
      materialName: name,
      currentStock: Math.max(0, currentStock),
      dailyUsageRate: Math.round(dailyRate * 100) / 100,
      daysRemaining: dailyRate > 0 ? Math.round(daysRemaining * 10) / 10 : Infinity,
      reorderDate: reorderDate.toISOString().split("T")[0],
      forecastedNeed: Math.round(forecastedNeed * 100) / 100,
      unit,
    };
  });
}

// ── Reset (for testing) ────────────────────────────

export function _resetStore(): void {
  deliveries.length = 0;
  usages.length = 0;
}
