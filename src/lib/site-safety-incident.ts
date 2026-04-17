/**
 * Site Safety Incident (DDC Phase 3-2)
 * ヒヤリハット記録 + 安全週報自動生成 + トレンド判定
 * Procore Safety Incident Tracking モジュールから蒸留。
 * Pure functions, no storage layer.
 */

export interface SafetyIncident {
  id: string;
  projectId: string;
  date: string;           // YYYY-MM-DD
  reportedBy: string;     // 報告者名/ID
  category: 'near-miss' | 'first-aid' | 'medical' | 'lost-time' | 'fatality';
  location: string;       // 現場内の場所
  description: string;
  cause: string;          // 推定原因
  correctiveAction: string; // 是正処置
  severity: 1 | 2 | 3 | 4 | 5; // 1=軽微 〜 5=重大
  resolved: boolean;
  createdAt: Date;
}

export interface WeeklySafetyReport {
  projectId: string;
  weekStart: string;      // YYYY-MM-DD (月曜)
  totalIncidents: number;
  byCategory: Record<SafetyIncident['category'], number>;
  bySeverity: Record<1 | 2 | 3 | 4 | 5, number>;
  unresolvedCount: number;
  topCauses: Array<{ cause: string; count: number }>;  // 出現上位3つ
  riskScore: number;      // 0-100、severity × frequency 合成スコア
}

export interface SafetyTrend {
  projectId: string;
  weekStarts: string[];         // 直近4週分
  incidentCounts: number[];     // 同 4要素
  riskScores: number[];         // 同 4要素
  trend: 'improving' | 'stable' | 'worsening';
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const CATEGORIES: SafetyIncident['category'][] = [
  'near-miss',
  'first-aid',
  'medical',
  'lost-time',
  'fatality',
];

const SEVERITIES: Array<1 | 2 | 3 | 4 | 5> = [1, 2, 3, 4, 5];

function zeroCategoryMap(): Record<SafetyIncident['category'], number> {
  return Object.fromEntries(CATEGORIES.map((c) => [c, 0])) as Record<
    SafetyIncident['category'],
    number
  >;
}

function zeroSeverityMap(): Record<1 | 2 | 3 | 4 | 5, number> {
  return Object.fromEntries(SEVERITIES.map((s) => [s, 0])) as Record<
    1 | 2 | 3 | 4 | 5,
    number
  >;
}

/**
 * Returns ISO date string (YYYY-MM-DD) for the Monday of the week
 * that contains the given date string.
 */
function getMondayOf(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  const day = d.getUTCDay(); // 0=Sun, 1=Mon, ...
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
}

/**
 * Add N weeks (as days) to a YYYY-MM-DD date string.
 */
function addWeeks(dateStr: string, n: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n * 7);
  return d.toISOString().slice(0, 10);
}

/**
 * Compute riskScore for a set of incidents.
 * Formula: sum(severity_i) × log(1 + count), clipped to 0-100.
 */
function computeRiskScore(incidents: SafetyIncident[]): number {
  if (incidents.length === 0) return 0;
  const severitySum = incidents.reduce((sum, i) => sum + i.severity, 0);
  const raw = severitySum * Math.log(1 + incidents.length);
  return Math.min(100, Math.max(0, raw));
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Record a new safety incident.
 * Assigns a UUID id and initialises resolved=false.
 */
export function recordIncident(
  input: Omit<SafetyIncident, 'id' | 'createdAt' | 'resolved'>,
): SafetyIncident {
  return {
    ...input,
    id: crypto.randomUUID(),
    resolved: false,
    createdAt: new Date(),
  };
}

/**
 * Summarize incidents for the calendar week starting on weekStart (Monday).
 * Incidents outside that Mon–Sun window are excluded.
 */
export function summarizeWeek(
  incidents: SafetyIncident[],
  weekStart: string,
): WeeklySafetyReport {
  const projectId = incidents[0]?.projectId ?? '';

  const weekIncidents = incidents.filter(
    (i) => getMondayOf(i.date) === weekStart,
  );

  const byCategory = zeroCategoryMap();
  const bySeverity = zeroSeverityMap();
  const causeCounts: Map<string, number> = new Map();

  for (const i of weekIncidents) {
    byCategory[i.category] += 1;
    bySeverity[i.severity] += 1;
    causeCounts.set(i.cause, (causeCounts.get(i.cause) ?? 0) + 1);
  }

  const unresolvedCount = weekIncidents.filter((i) => !i.resolved).length;

  // Top 3 causes by frequency
  const topCauses = Array.from(causeCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([cause, count]) => ({ cause, count }));

  const riskScore = computeRiskScore(weekIncidents);

  return {
    projectId,
    weekStart,
    totalIncidents: weekIncidents.length,
    byCategory,
    bySeverity,
    unresolvedCount,
    topCauses,
    riskScore,
  };
}

/**
 * Compute safety trend over the 4 weeks ending with (and including) the week
 * that contains referenceDate.
 *
 * trend判定: 最後3週の傾き
 *   - improving: 単調減少（各週 < 前週）
 *   - worsening: 単調増加（各週 > 前週）
 *   - stable: それ以外
 */
export function computeTrend(
  incidents: SafetyIncident[],
  referenceDate: string,
): SafetyTrend {
  const projectId = incidents[0]?.projectId ?? '';

  // Build the 4 Monday date strings (oldest first)
  const refMonday = getMondayOf(referenceDate);
  const weekStarts = [
    addWeeks(refMonday, -3),
    addWeeks(refMonday, -2),
    addWeeks(refMonday, -1),
    refMonday,
  ];

  const incidentCounts = weekStarts.map(
    (ws) => incidents.filter((i) => getMondayOf(i.date) === ws).length,
  );

  const riskScores = weekStarts.map((ws) => {
    const weekIncidents = incidents.filter((i) => getMondayOf(i.date) === ws);
    return computeRiskScore(weekIncidents);
  });

  // Trend judgment: look at the last 3 weeks (indices 1, 2, 3)
  const last3 = incidentCounts.slice(1); // [w2, w3, w4]
  const improving =
    last3[1] < last3[0] && last3[2] < last3[1];
  const worsening =
    last3[1] > last3[0] && last3[2] > last3[1];

  const trend: SafetyTrend['trend'] = improving
    ? 'improving'
    : worsening
      ? 'worsening'
      : 'stable';

  return {
    projectId,
    weekStarts,
    incidentCounts,
    riskScores,
    trend,
  };
}
