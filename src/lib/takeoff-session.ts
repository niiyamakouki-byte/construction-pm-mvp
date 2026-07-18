/**
 * takeoff-session — 連続なぞりセッション管理・数量集計・Undo/Redo・永続化
 *
 * 「図面なぞり拾い出し本格版」Sprint: 1セッションに複数 line/area を連続計測し、
 * カテゴリラベルで集計、cost-master と紐づけて見積行を生成するための純粋ロジック層。
 * No DOM / No React dependencies.
 */

import { suggestEstimateItems } from "./measurement-to-estimate-link.js";
import type { CostMasterEntry, EstimateSuggestion } from "./measurement-to-estimate-link.js";
import type { MeasureKind } from "./photo-pin-measure.js";

// ── Constants ────────────────────────────────────────────────────────────────

export const TAKEOFF_SEGMENT_CATEGORIES = [
  "壁",
  "床",
  "天井",
  "巾木",
  "廻り縁",
  "天井見切",
  "床見切",
  "開口部",
  "その他",
] as const;

export type TakeoffSegmentCategory = (typeof TAKEOFF_SEGMENT_CATEGORIES)[number];

/**
 * Per-category color map for canvas overlay rendering.
 * Used by DrawingViewer to color-code each line type distinctly.
 */
export const TAKEOFF_CATEGORY_COLORS: Record<TakeoffSegmentCategory, string> = {
  壁: "#ef4444",       // red
  床: "#8b5cf6",       // purple
  天井: "#3b82f6",     // blue
  巾木: "#f97316",     // orange
  廻り縁: "#06b6d4",   // cyan
  天井見切: "#587b56", // emerald
  床見切: "#eab308",   // yellow
  開口部: "#ec4899",   // pink
  その他: "#6b7280",   // gray
};

export const MAX_UNDO_STEPS = 20;

const STORAGE_KEY_PREFIX = "takeoff_session_";

// ── Types ────────────────────────────────────────────────────────────────────

export type MeasureResult =
  | { kind: "distance"; valueM: number }
  | { kind: "area"; valueSqm: number };

export type TakeoffSegment = {
  id: string;
  /** Timestamp for ordering */
  createdAt: number;
  category: TakeoffSegmentCategory;
  /** "distance" → m, "area" → ㎡ */
  measureKind: MeasureKind;
  /** Measured value (m or ㎡ depending on measureKind) */
  value: number;
  /** Optional free-text label (e.g. "北面壁") */
  label?: string;
  /** cost-master code linked by user (null = unlinked) */
  linkedCostCode?: string;
  linkedCostName?: string;
};

export type TakeoffSessionState = {
  id: string;
  drawingId: string;
  projectId?: string;
  segments: TakeoffSegment[];
  createdAt: number;
  updatedAt: number;
};

export type CategorySummaryRow = {
  category: TakeoffSegmentCategory;
  measureKind: MeasureKind;
  totalValue: number;
  unit: string;
  segmentCount: number;
};

// ── ID generation ─────────────────────────────────────────────────────────────

let _seq = 0;

function genId(prefix = "seg"): string {
  return `${prefix}-${Date.now()}-${++_seq}`;
}

// ── Session CRUD ──────────────────────────────────────────────────────────────

/**
 * Create a new empty session for a given drawing.
 */
export function createSession(
  drawingId: string,
  projectId?: string,
): TakeoffSessionState {
  const now = Date.now();
  return {
    id: genId("sess"),
    drawingId,
    projectId,
    segments: [],
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Add a segment to a session (immutable — returns new state).
 */
export function addSegment(
  session: TakeoffSessionState,
  params: {
    category: TakeoffSegmentCategory;
    measureKind: MeasureKind;
    value: number;
    label?: string;
  },
): TakeoffSessionState {
  const segment: TakeoffSegment = {
    id: genId("seg"),
    createdAt: Date.now(),
    category: params.category,
    measureKind: params.measureKind,
    value: params.value,
    label: params.label,
  };
  return {
    ...session,
    segments: [...session.segments, segment],
    updatedAt: Date.now(),
  };
}

/**
 * Remove a segment by id (immutable).
 */
export function removeSegment(
  session: TakeoffSessionState,
  segmentId: string,
): TakeoffSessionState {
  return {
    ...session,
    segments: session.segments.filter((s) => s.id !== segmentId),
    updatedAt: Date.now(),
  };
}

/**
 * Update a segment's category or label (immutable).
 */
export function updateSegment(
  session: TakeoffSessionState,
  segmentId: string,
  updates: Partial<Pick<TakeoffSegment, "category" | "label" | "linkedCostCode" | "linkedCostName">>,
): TakeoffSessionState {
  return {
    ...session,
    segments: session.segments.map((s) =>
      s.id === segmentId ? { ...s, ...updates } : s,
    ),
    updatedAt: Date.now(),
  };
}

// ── Aggregation ───────────────────────────────────────────────────────────────

/**
 * Summarise a session: group by (category × measureKind) and sum values.
 * Returns rows sorted by category order then by measureKind.
 */
export function summariseSession(
  session: TakeoffSessionState,
): CategorySummaryRow[] {
  const map = new Map<string, CategorySummaryRow>();

  for (const seg of session.segments) {
    const key = `${seg.category}|${seg.measureKind}`;
    const existing = map.get(key);
    if (existing) {
      existing.totalValue += seg.value;
      existing.segmentCount += 1;
    } else {
      map.set(key, {
        category: seg.category,
        measureKind: seg.measureKind,
        totalValue: seg.value,
        unit: seg.measureKind === "area" ? "㎡" : "m",
        segmentCount: 1,
      });
    }
  }

  // Sort by TAKEOFF_SEGMENT_CATEGORIES order then measureKind
  const categoryOrder = Object.fromEntries(
    TAKEOFF_SEGMENT_CATEGORIES.map((c, i) => [c, i]),
  );

  return [...map.values()].sort((a, b) => {
    const co = (categoryOrder[a.category] ?? 99) - (categoryOrder[b.category] ?? 99);
    if (co !== 0) return co;
    return a.measureKind.localeCompare(b.measureKind);
  });
}

// ── Cost-master matching ──────────────────────────────────────────────────────

/**
 * Suggest cost-master items for a single summary row.
 * Uses the category label as the keyword hint.
 */
export function suggestForRow(
  row: CategorySummaryRow,
  costMaster: CostMasterEntry[],
  maxResults = 5,
): EstimateSuggestion[] {
  return suggestEstimateItems(
    row.measureKind,
    row.totalValue,
    costMaster,
    row.category,
    maxResults,
  );
}

/**
 * Auto-match all summary rows against the cost master.
 * Returns top suggestion per row (null if no match).
 */
export function autoMatchSession(
  session: TakeoffSessionState,
  costMaster: CostMasterEntry[],
): Array<{ row: CategorySummaryRow; top: EstimateSuggestion | null }> {
  const rows = summariseSession(session);
  return rows.map((row) => {
    const suggestions = suggestForRow(row, costMaster, 1);
    return { row, top: suggestions[0] ?? null };
  });
}

// ── CSV / JSON export ─────────────────────────────────────────────────────────

function csvEscape(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Export session summary as CSV.
 * Columns: カテゴリ,計測種別,合計,単位,セグメント数
 */
export function exportSessionCSV(session: TakeoffSessionState): string {
  const header = "カテゴリ,計測種別,合計,単位,セグメント数";
  const rows = summariseSession(session).map((r) =>
    [
      csvEscape(r.category),
      csvEscape(r.measureKind === "area" ? "面積" : "距離"),
      r.totalValue.toFixed(3),
      csvEscape(r.unit),
      String(r.segmentCount),
    ].join(","),
  );
  return [header, ...rows].join("\n");
}

/**
 * Export full session as JSON (for backup / handoff).
 */
export function exportSessionJSON(session: TakeoffSessionState): string {
  return JSON.stringify(session, null, 2);
}

// ── localStorage persistence ──────────────────────────────────────────────────

function storageKey(sessionId: string): string {
  return STORAGE_KEY_PREFIX + sessionId;
}

/**
 * Save session to localStorage under its id.
 */
export function saveSession(session: TakeoffSessionState): void {
  try {
    localStorage.setItem(storageKey(session.id), JSON.stringify(session));
  } catch {
    // quota exceeded or unavailable — ignore
  }
}

/**
 * Load a session by its id. Returns null if not found or corrupt.
 */
export function loadSession(sessionId: string): TakeoffSessionState | null {
  try {
    const raw = localStorage.getItem(storageKey(sessionId));
    if (!raw) return null;
    return JSON.parse(raw) as TakeoffSessionState;
  } catch {
    return null;
  }
}

/**
 * List all session ids persisted for a given drawingId.
 * Scans localStorage keys with the prefix.
 */
export function listSessionIds(drawingId: string): string[] {
  const ids: string[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key?.startsWith(STORAGE_KEY_PREFIX)) continue;
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      try {
        const s = JSON.parse(raw) as TakeoffSessionState;
        if (s.drawingId === drawingId) {
          ids.push(s.id);
        }
      } catch {
        // corrupt — skip
      }
    }
  } catch {
    // localStorage unavailable
  }
  return ids;
}

/**
 * Delete a session from localStorage.
 */
export function deleteSession(sessionId: string): void {
  try {
    localStorage.removeItem(storageKey(sessionId));
  } catch {
    // ignore
  }
}

// ── Undo/Redo stack ───────────────────────────────────────────────────────────

export type TakeoffUndoStack = {
  /** Apply the next operation and push the old state */
  push(before: TakeoffSessionState): void;
  /** Undo: return the previous state (or null if empty) */
  undo(): TakeoffSessionState | null;
  /** Redo: return the next state (or null if none) */
  redo(): TakeoffSessionState | null;
  canUndo(): boolean;
  canRedo(): boolean;
  clear(): void;
};

/**
 * Create an Undo/Redo stack for takeoff sessions.
 * Stores up to maxSteps snapshots.
 */
export function createTakeoffUndoStack(
  maxSteps = MAX_UNDO_STEPS,
): TakeoffUndoStack {
  const undoStack: TakeoffSessionState[] = [];
  const redoStack: TakeoffSessionState[] = [];

  return {
    push(before: TakeoffSessionState) {
      undoStack.push(before);
      if (undoStack.length > maxSteps) {
        undoStack.splice(0, undoStack.length - maxSteps);
      }
      // Any new action clears redo stack
      redoStack.length = 0;
    },
    undo() {
      const state = undoStack.pop();
      if (!state) return null;
      return state;
    },
    redo() {
      return redoStack.pop() ?? null;
    },
    canUndo() {
      return undoStack.length > 0;
    },
    canRedo() {
      return redoStack.length > 0;
    },
    clear() {
      undoStack.length = 0;
      redoStack.length = 0;
    },
  };
}

// ── Convenience: mutate with undo support ─────────────────────────────────────

/**
 * Apply an operation to a session with undo support.
 * Pushes the before-state onto the undo stack, then returns the new session.
 *
 * Usage:
 *   const next = withUndo(stack, current, (s) => addSegment(s, params));
 */
export function withUndo(
  stack: TakeoffUndoStack,
  current: TakeoffSessionState,
  op: (s: TakeoffSessionState) => TakeoffSessionState,
): TakeoffSessionState {
  stack.push(current);
  return op(current);
}

// ── Polyline geometry helpers ─────────────────────────────────────────────────

export type TracePoint = { x: number; y: number };

/**
 * Sum the total length of a polyline (pixel space).
 * Replaces the previous first→last straight-line distance.
 */
export function polylineLengthPx(points: TracePoint[]): number {
  if (points.length < 2) return 0;
  let total = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i]!;
    const b = points[i + 1]!;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    total += Math.sqrt(dx * dx + dy * dy);
  }
  return total;
}

/**
 * Convert pixel length to metres using scale (px/mm).
 */
export function pxLengthToMetres(pixelLength: number, scalePxPerMm: number): number {
  if (scalePxPerMm <= 0) return 0;
  return pixelLength / scalePxPerMm / 1000;
}

// ── Snap / autocomplete (pure math, no external API) ──────────────────────────

/**
 * Predict the next point by extending the last segment of a polyline by
 * `extensionPx` pixels. Uses vector extrapolation.
 *
 * Returns null if fewer than 2 points are provided.
 */
export function predictNextPoint(
  points: TracePoint[],
  extensionPx: number,
): TracePoint | null {
  if (points.length < 2) return null;
  const a = points[points.length - 2]!;
  const b = points[points.length - 1]!;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len === 0) return null;
  const nx = dx / len;
  const ny = dy / len;
  return { x: b.x + nx * extensionPx, y: b.y + ny * extensionPx };
}

/**
 * Snap a candidate point to the nearest endpoint in an existing segment list,
 * if it is within `snapRadiusPx` pixels. Returns the snapped point or the
 * original candidate if no snap target is close enough.
 */
export function snapToNearestEndpoint(
  candidate: TracePoint,
  existingPoints: TracePoint[],
  snapRadiusPx: number,
): { point: TracePoint; snapped: boolean } {
  let bestDist = Infinity;
  let bestPoint: TracePoint | null = null;

  for (const p of existingPoints) {
    const dx = candidate.x - p.x;
    const dy = candidate.y - p.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < bestDist) {
      bestDist = dist;
      bestPoint = p;
    }
  }

  if (bestPoint && bestDist <= snapRadiusPx) {
    return { point: bestPoint, snapped: true };
  }
  return { point: candidate, snapped: false };
}

/**
 * Project a point onto the nearest axis-aligned direction from the last
 * polyline point (horizontal or vertical snap at 0°/90°/180°/270°).
 * Enables ortho-lock when the user is drawing near-straight lines.
 *
 * Returns the orthogonally-snapped point, or null if fewer than 1 point.
 */
export function orthoSnap(
  points: TracePoint[],
  candidate: TracePoint,
): TracePoint | null {
  if (points.length === 0) return null;
  const last = points[points.length - 1]!;
  const dx = candidate.x - last.x;
  const dy = candidate.y - last.y;
  // If more horizontal than vertical, lock to horizontal
  if (Math.abs(dx) >= Math.abs(dy)) {
    return { x: candidate.x, y: last.y };
  }
  return { x: last.x, y: candidate.y };
}

// ── Cost-per-category summary ─────────────────────────────────────────────────

export type CategoryCostRow = CategorySummaryRow & {
  unitPrice: number;
  totalCost: number;
  linkedCostCode?: string;
  linkedCostName?: string;
};

/**
 * Build a cost-enriched summary: for each category row, find the linked cost
 * code from the first linked segment in that row, then compute unit price ×
 * total quantity.
 *
 * @param session    Current session state
 * @param costMaster Flat cost-master list
 */
export function summariseWithCost(
  session: TakeoffSessionState,
  costMaster: CostMasterEntry[],
): CategoryCostRow[] {
  const summaryRows = summariseSession(session);
  const byCode = new Map(costMaster.map((e) => [e.code, e]));

  return summaryRows.map((row) => {
    // Find first linked segment for this row
    const linkedSeg = session.segments.find(
      (s) =>
        s.category === row.category &&
        s.measureKind === row.measureKind &&
        s.linkedCostCode,
    );
    const entry = linkedSeg?.linkedCostCode
      ? byCode.get(linkedSeg.linkedCostCode)
      : undefined;
    const unitPrice = entry?.unitPrice ?? 0;
    return {
      ...row,
      unitPrice,
      totalCost: Math.round(row.totalValue * unitPrice),
      linkedCostCode: linkedSeg?.linkedCostCode,
      linkedCostName: linkedSeg?.linkedCostName,
    };
  });
}

/**
 * Compute the grand-total estimated cost across all linked rows.
 */
export function sessionTotalCost(
  session: TakeoffSessionState,
  costMaster: CostMasterEntry[],
): number {
  return summariseWithCost(session, costMaster).reduce(
    (sum, r) => sum + r.totalCost,
    0,
  );
}
