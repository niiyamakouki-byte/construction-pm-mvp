/**
 * Cost-loss detector — rule functions.
 *
 * Each function is pure: takes domain records, returns LossSignal[].
 * No external API calls, no side effects.
 */

import type { LossSignal, OrderRecord, LaborRecord, Severity } from "./types.js";
import { LossKind } from "./types.js";

// ── Helpers ────────────────────────────────────────────────────────────────

let _signalCounter = 0;

function newId(): string {
  return `loss-${Date.now()}-${++_signalCounter}`;
}

function daysBetween(a: string, b: string): number {
  const msA = new Date(a).getTime();
  const msB = new Date(b).getTime();
  return Math.abs(msB - msA) / (1000 * 60 * 60 * 24);
}

// ── Rule 1: material_surplus ───────────────────────────────────────────────

/**
 * Detects when ordered quantity significantly exceeds planned quantity.
 * ratio > 1.3 → critical, > 1.1 → warning
 */
export function detectMaterialSurplus(orders: OrderRecord[]): LossSignal[] {
  const signals: LossSignal[] = [];

  for (const order of orders) {
    if (order.plannedQty === undefined || order.plannedQty <= 0) continue;

    const ratio = order.qty / order.plannedQty;
    if (ratio <= 1.1) continue;

    const severity: Severity = ratio > 1.3 ? "critical" : "warning";
    const excessQty = order.qty - order.plannedQty;
    const lossYen = Math.round(excessQty * order.unitPriceYen);

    signals.push({
      id: newId(),
      projectId: order.projectId,
      kind: LossKind.material_surplus,
      severity,
      detectedAt: new Date().toISOString(),
      evidenceRefs: [order.id],
      lossYen,
      message: `品目 ${order.itemCode}: 発注数 ${order.qty}${order.unit} が計画数 ${order.plannedQty}${order.unit} を ${Math.round((ratio - 1) * 100)}% 超過`,
      suggestedAction: "余剰分を次工事に流用するか、仕入先に返品交渉してください",
    });
  }

  return signals;
}

// ── Rule 2: material_shortage_emergency ───────────────────────────────────

/**
 * Detects emergency re-orders: same itemCode + projectId ordered 2+ times within 30 days.
 */
export function detectShortageEmergency(orders: OrderRecord[]): LossSignal[] {
  const signals: LossSignal[] = [];

  // Group by projectId + itemCode
  const grouped = new Map<string, OrderRecord[]>();
  for (const order of orders) {
    const key = `${order.projectId}::${order.itemCode}`;
    const arr = grouped.get(key) ?? [];
    arr.push(order);
    grouped.set(key, arr);
  }

  for (const [, group] of grouped) {
    if (group.length < 2) continue;

    // Sort by orderedAt
    const sorted = [...group].sort((a, b) =>
      new Date(a.orderedAt).getTime() - new Date(b.orderedAt).getTime(),
    );

    // Find any pair within 30 days
    const pairs: OrderRecord[][] = [];
    for (let i = 0; i < sorted.length - 1; i++) {
      for (let j = i + 1; j < sorted.length; j++) {
        if (daysBetween(sorted[i].orderedAt, sorted[j].orderedAt) <= 30) {
          pairs.push([sorted[i], sorted[j]]);
        }
      }
    }

    if (pairs.length === 0) continue;

    const allInGroup = sorted;
    const totalQty = allInGroup.reduce((s, o) => s + o.qty, 0);
    const avgUnitPrice = allInGroup.reduce((s, o) => s + o.unitPriceYen, 0) / allInGroup.length;
    // Estimate loss as the extra order cost (assume first order was planned, rest are emergency)
    const extraOrders = allInGroup.slice(1);
    const lossYen = Math.round(
      extraOrders.reduce((s, o) => s + o.qty * o.unitPriceYen, 0) * 0.1, // 10% premium estimate
    );

    signals.push({
      id: newId(),
      projectId: allInGroup[0].projectId,
      kind: LossKind.material_shortage_emergency,
      severity: "warning",
      detectedAt: new Date().toISOString(),
      evidenceRefs: allInGroup.map((o) => o.id),
      lossYen,
      message: `品目 ${allInGroup[0].itemCode}: 30日以内に ${allInGroup.length} 回発注 (合計 ${totalQty}${allInGroup[0].unit}) — 緊急再発注の疑い`,
      suggestedAction: "発注計画を見直し、適正在庫量を設定してください",
    });
  }

  return signals;
}

// ── Rule 3: labor_overrun ──────────────────────────────────────────────────

/**
 * Detects labor overruns.
 * ratio > 1.5 → critical, > 1.2 → warning
 * lossYen = (hoursActual - hoursPlanned) × ¥3,500/h
 */
export const LABOR_HOURLY_RATE_YEN = 3_500;

export function detectLaborOverrun(labor: LaborRecord[]): LossSignal[] {
  const signals: LossSignal[] = [];

  for (const record of labor) {
    if (record.hoursPlanned <= 0) continue;

    const ratio = record.hoursActual / record.hoursPlanned;
    if (ratio <= 1.2) continue;

    const severity: Severity = ratio > 1.5 ? "critical" : "warning";
    const overrunHours = record.hoursActual - record.hoursPlanned;
    const lossYen = Math.round(overrunHours * LABOR_HOURLY_RATE_YEN);

    signals.push({
      id: newId(),
      projectId: record.projectId,
      kind: LossKind.labor_overrun,
      severity,
      detectedAt: new Date().toISOString(),
      evidenceRefs: [record.id],
      lossYen,
      message: `タスク ${record.taskId}: 実績 ${record.hoursActual}h が計画 ${record.hoursPlanned}h を ${Math.round((ratio - 1) * 100)}% 超過 (超過 ${overrunHours.toFixed(1)}h)`,
      suggestedAction: "工程見直しと作業員の技能訓練を検討してください",
    });
  }

  return signals;
}

// ── Rule 4: out_of_scope_order ─────────────────────────────────────────────

/**
 * Detects out-of-scope orders where the total extra amount exceeds 5% of
 * the total in-scope order value per project.
 */
export function detectOutOfScopeOrder(orders: OrderRecord[]): LossSignal[] {
  const signals: LossSignal[] = [];

  // Group by projectId
  const byProject = new Map<string, OrderRecord[]>();
  for (const order of orders) {
    const arr = byProject.get(order.projectId) ?? [];
    arr.push(order);
    byProject.set(order.projectId, arr);
  }

  for (const [projectId, projectOrders] of byProject) {
    const inScopeTotal = projectOrders
      .filter((o) => o.scope === "in_scope")
      .reduce((s, o) => s + o.qty * o.unitPriceYen, 0);

    const extraOrders = projectOrders.filter((o) => o.scope === "extra");
    const extraTotal = extraOrders.reduce((s, o) => s + o.qty * o.unitPriceYen, 0);

    if (extraTotal <= 0) continue;

    const base = inScopeTotal > 0 ? inScopeTotal : extraTotal;
    const ratio = extraTotal / base;

    if (ratio <= 0.05) continue;

    signals.push({
      id: newId(),
      projectId,
      kind: LossKind.out_of_scope_order,
      severity: "warning",
      detectedAt: new Date().toISOString(),
      evidenceRefs: extraOrders.map((o) => o.id),
      lossYen: Math.round(extraTotal),
      message: `見積外発注 合計 ¥${extraTotal.toLocaleString("ja-JP")} (見積内の ${Math.round(ratio * 100)}%)`,
      suggestedAction: "見積外工事は変更指示書を発行し、追加請求または原価低減を検討してください",
    });
  }

  return signals;
}

// ── Rule 5: price_creep ────────────────────────────────────────────────────

/**
 * Detects unit price increases vs. planned unit price.
 * unitPriceYen / plannedUnitPriceYen > 1.05 → signal
 */
export function detectPriceCreep(orders: OrderRecord[]): LossSignal[] {
  const signals: LossSignal[] = [];

  for (const order of orders) {
    if (order.plannedUnitPriceYen === undefined || order.plannedUnitPriceYen <= 0) continue;

    const ratio = order.unitPriceYen / order.plannedUnitPriceYen;
    if (ratio <= 1.05) continue;

    const severity: Severity = ratio > 1.2 ? "critical" : "warning";
    const lossYen = Math.round((order.unitPriceYen - order.plannedUnitPriceYen) * order.qty);

    signals.push({
      id: newId(),
      projectId: order.projectId,
      kind: LossKind.price_creep,
      severity,
      detectedAt: new Date().toISOString(),
      evidenceRefs: [order.id],
      lossYen,
      message: `品目 ${order.itemCode}: 発注単価 ¥${order.unitPriceYen.toLocaleString("ja-JP")} が見積単価 ¥${order.plannedUnitPriceYen.toLocaleString("ja-JP")} を ${Math.round((ratio - 1) * 100)}% 超過`,
      suggestedAction: "仕入先と単価交渉するか、代替品を検討してください",
    });
  }

  return signals;
}

// ── Rule 6: wastage_high ───────────────────────────────────────────────────

/**
 * Detects high wastage (低歩留り).
 * Requires usedQty recorded on order. Minimum 3 orders with usedQty.
 * yield = usedQty / qty < 0.85 → signal per item.
 */
export function detectWastageHigh(orders: OrderRecord[]): LossSignal[] {
  const signals: LossSignal[] = [];

  // Only consider orders that have usedQty recorded
  const withUsage = orders.filter(
    (o) => o.usedQty !== undefined && o.qty > 0,
  );

  // Group by projectId + itemCode
  const grouped = new Map<string, OrderRecord[]>();
  for (const order of withUsage) {
    const key = `${order.projectId}::${order.itemCode}`;
    const arr = grouped.get(key) ?? [];
    arr.push(order);
    grouped.set(key, arr);
  }

  for (const [, group] of grouped) {
    if (group.length < 3) continue;

    const totalOrdered = group.reduce((s, o) => s + o.qty, 0);
    const totalUsed = group.reduce((s, o) => s + (o.usedQty ?? 0), 0);

    if (totalOrdered <= 0) continue;

    const yieldRate = totalUsed / totalOrdered;
    if (yieldRate >= 0.85) continue;

    const wastedQty = totalOrdered - totalUsed;
    const avgUnitPrice = group.reduce((s, o) => s + o.unitPriceYen, 0) / group.length;
    const lossYen = Math.round(wastedQty * avgUnitPrice);

    const severity: Severity = yieldRate < 0.70 ? "critical" : "warning";

    signals.push({
      id: newId(),
      projectId: group[0].projectId,
      kind: LossKind.wastage_high,
      severity,
      detectedAt: new Date().toISOString(),
      evidenceRefs: group.map((o) => o.id),
      lossYen,
      message: `品目 ${group[0].itemCode}: 歩留り ${Math.round(yieldRate * 100)}% (目標 85%以上) — 廃材 ${wastedQty.toFixed(2)}${group[0].unit}`,
      suggestedAction: "施工手順を見直し、カット精度向上と廃材リサイクルを検討してください",
    });
  }

  return signals;
}
