/**
 * Crew Optimizer — shared types.
 *
 * Sprint 14-B: 職人スケジュール最適化
 */

// ── Enums ──────────────────────────────────────────────────────────────────

export type CraftsmanSkill =
  | "demolition"
  | "drywall"
  | "electrical"
  | "plumbing"
  | "hvac"
  | "interior_finish"
  | "scaffolding"
  | "painting"
  | "fixture_install"
  | "cleanup";

// ── Domain objects ─────────────────────────────────────────────────────────

export type Craftsman = {
  id: string;
  name: string;
  skills: CraftsmanSkill[];
  /** 日当 (JPY) */
  dailyRate: number;
  baseLocationLat: number;
  baseLocationLng: number;
  /** 同時担当可能な最大現場数 */
  maxConcurrentSites: number;
  notes?: string;
};

export type TaskAssignment = {
  id: string;
  projectId: string;
  projectName: string;
  taskName: string;
  requiredSkills: CraftsmanSkill[];
  /** ISO 8601 date (YYYY-MM-DD) */
  startDate: string;
  /** ISO 8601 date (YYYY-MM-DD) */
  endDate: string;
  siteLat: number;
  siteLng: number;
  peopleNeeded: number;
  /** 1 (低) — 5 (最高) */
  priority: number;
};

export type CraftsmanAssignment = {
  taskId: string;
  craftsmanId: string;
  role: "lead" | "sub";
  score: number;
  reasoning_ja: string;
};

export type CrewConflict = {
  kind: "doubleBooking" | "skillMismatch" | "overcapacity" | "travelTooLong";
  craftsmanId: string;
  taskIds: string[];
  severity: "warn" | "critical";
  messageJa: string;
};

export type CrewSchedule = {
  /** YYYY-MM-DD */
  date: string;
  assignments: CraftsmanAssignment[];
  conflicts: CrewConflict[];
  utilizationPct: number;
};

export type CrewOptimizationResult = {
  schedules: CrewSchedule[];
  totalConflicts: number;
  avgUtilizationPct: number;
  unassignedTaskIds: string[];
  /** ISO 8601 */
  generatedAt: string;
};

// ── Config ─────────────────────────────────────────────────────────────────

export type OptimizationConfig = {
  /** スキルマッチへの重み (0–1) */
  weightSkill: number;
  /** 距離最小化への重み (0–1) */
  weightDistance: number;
  /** 稼働率最大化への重み (0–1) */
  weightUtilization: number;
  /** 優先度への重み (0–1) */
  weightPriority: number;
  /** 最大許容移動距離 (km) */
  maxTravelKm: number;
};

export const DEFAULT_OPTIMIZATION_CONFIG: OptimizationConfig = {
  weightSkill: 0.40,
  weightDistance: 0.20,
  weightUtilization: 0.25,
  weightPriority: 0.15,
  maxTravelKm: 50,
};
