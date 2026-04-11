/**
 * 歩掛管理モジュール — ANDPAD蒸留
 * 内装工事の各作業における計画人工・実績人工の管理と差分分析。
 */

// ── 型定義 ────────────────────────────────────────────────────────────────────

export type BugakariCategory = "解体" | "下地" | "仕上" | "建具" | "設備" | "その他";

export const BUGAKARI_CATEGORIES: BugakariCategory[] = [
  "解体",
  "下地",
  "仕上",
  "建具",
  "設備",
  "その他",
];

export type BugakariRecord = {
  id: string;
  projectId: string;
  taskName: string;
  category: BugakariCategory;
  plannedManDays: number;   // 計画人工数
  actualManDays: number | null; // 実績人工数（未確定はnull）
  unitPrice: number;        // 人工単価（円/人工）
  plannedCost: number;      // 計画原価 = plannedManDays * unitPrice
  actualCost: number | null; // 実績原価 = actualManDays * unitPrice（null if actualManDays null）
  workers: string[];        // 作業者名
  startDate: string | null; // YYYY-MM-DD
  endDate: string | null;   // YYYY-MM-DD
  note: string;
};

export type BugakariVariance = {
  manDaysDiff: number;      // 実績 - 計画（正 = 超過, 負 = 短縮）
  costDiff: number;         // 実績原価 - 計画原価
  varianceRate: number;     // manDaysDiff / plannedManDays * 100
};

export type BugakariSummary = {
  projectId: string;
  totalPlannedManDays: number;
  totalActualManDays: number;
  totalPlannedCost: number;
  totalActualCost: number;
  overallVarianceRate: number; // (totalActual - totalPlanned) / totalPlanned * 100
  recordCount: number;
  completedCount: number; // actualManDays が null でないもの
};

// ── 内装特化テンプレート ────────────────────────────────────────────────────────

export type BugakariTemplate = {
  taskName: string;
  category: BugakariCategory;
  standardManDaysPerUnit: number; // 1単位（㎡等）あたりの標準歩掛り
  unit: string;
  description: string;
};

export const INTERIOR_BUGAKARI_TEMPLATES: BugakariTemplate[] = [
  // 解体
  { taskName: "内装解体（壁・天井）", category: "解体", standardManDaysPerUnit: 0.05, unit: "㎡", description: "既存壁・天井ボード撤去" },
  { taskName: "床材撤去", category: "解体", standardManDaysPerUnit: 0.03, unit: "㎡", description: "既存フローリング・カーペット等撤去" },
  { taskName: "間仕切り撤去", category: "解体", standardManDaysPerUnit: 0.08, unit: "m", description: "既存間仕切り壁解体" },
  // 下地
  { taskName: "軽鉄下地（壁）", category: "下地", standardManDaysPerUnit: 0.06, unit: "㎡", description: "LGS間柱・ランナー施工" },
  { taskName: "軽鉄下地（天井）", category: "下地", standardManDaysPerUnit: 0.08, unit: "㎡", description: "LGS野縁・野縁受け施工" },
  { taskName: "石膏ボード貼り（壁）", category: "下地", standardManDaysPerUnit: 0.05, unit: "㎡", description: "PB12.5mm施工" },
  { taskName: "石膏ボード貼り（天井）", category: "下地", standardManDaysPerUnit: 0.07, unit: "㎡", description: "PB9.5mm施工" },
  // 仕上
  { taskName: "クロス貼り（壁）", category: "仕上", standardManDaysPerUnit: 0.04, unit: "㎡", description: "ビニルクロス施工" },
  { taskName: "クロス貼り（天井）", category: "仕上", standardManDaysPerUnit: 0.05, unit: "㎡", description: "天井ビニルクロス施工" },
  { taskName: "塗装（EP）", category: "仕上", standardManDaysPerUnit: 0.03, unit: "㎡", description: "エマルションペイント2回塗り" },
  { taskName: "フローリング施工", category: "仕上", standardManDaysPerUnit: 0.06, unit: "㎡", description: "フローリング接着+釘留め" },
  { taskName: "タイルカーペット施工", category: "仕上", standardManDaysPerUnit: 0.025, unit: "㎡", description: "50角タイルカーペット貼り" },
  { taskName: "フロアタイル施工", category: "仕上", standardManDaysPerUnit: 0.04, unit: "㎡", description: "300角フロアタイル施工" },
  // 建具
  { taskName: "ドア取付", category: "建具", standardManDaysPerUnit: 0.5, unit: "箇所", description: "片開きドア枠・扉・金物取付" },
  { taskName: "引戸取付", category: "建具", standardManDaysPerUnit: 0.8, unit: "箇所", description: "引戸枠・戸・レール取付" },
  // 設備
  { taskName: "照明器具取付", category: "設備", standardManDaysPerUnit: 0.2, unit: "台", description: "ダウンライト等器具取付（電気工事別途）" },
  { taskName: "スイッチ・コンセント取付", category: "設備", standardManDaysPerUnit: 0.15, unit: "箇所", description: "プレート交換含む" },
];

// ── In-memory store ──────────────────────────────────────────────────────────

const records = new Map<string, BugakariRecord>();

// ── Helpers ──────────────────────────────────────────────────────────────────

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function calcCosts(plannedManDays: number, actualManDays: number | null, unitPrice: number): {
  plannedCost: number;
  actualCost: number | null;
} {
  return {
    plannedCost: plannedManDays * unitPrice,
    actualCost: actualManDays !== null ? actualManDays * unitPrice : null,
  };
}

// ── CRUD ──────────────────────────────────────────────────────────────────────

/**
 * 歩掛レコードを新規作成する。plannedCost/actualCostは自動計算。
 */
export function createRecord(
  data: Omit<BugakariRecord, "plannedCost" | "actualCost">,
): BugakariRecord {
  const { plannedCost, actualCost } = calcCosts(
    data.plannedManDays,
    data.actualManDays,
    data.unitPrice,
  );
  const record: BugakariRecord = { ...data, plannedCost, actualCost };
  records.set(record.id, record);
  return { ...record };
}

/**
 * 歩掛レコードを更新する。plannedCost/actualCostは自動再計算。
 */
export function updateRecord(
  id: string,
  updates: Partial<Omit<BugakariRecord, "id" | "projectId" | "plannedCost" | "actualCost">>,
): BugakariRecord {
  const existing = records.get(id);
  if (!existing) throw new Error(`BugakariRecord ${id} not found`);
  const merged = { ...existing, ...updates };
  const { plannedCost, actualCost } = calcCosts(
    merged.plannedManDays,
    merged.actualManDays,
    merged.unitPrice,
  );
  const updated: BugakariRecord = { ...merged, plannedCost, actualCost };
  records.set(id, updated);
  return { ...updated };
}

/**
 * プロジェクト内の全レコードを返す。
 */
export function getRecordsByProject(projectId: string): BugakariRecord[] {
  return [...records.values()].filter((r) => r.projectId === projectId);
}

/**
 * プロジェクト内の指定カテゴリのレコードを返す。
 */
export function getRecordsByCategory(
  projectId: string,
  category: BugakariCategory,
): BugakariRecord[] {
  return getRecordsByProject(projectId).filter((r) => r.category === category);
}

/**
 * テスト用ストアクリア。
 */
export function clearRecords(): void {
  records.clear();
}

// ── 差分分析 ──────────────────────────────────────────────────────────────────

/**
 * 1レコードの計画vs実績の差分を返す。
 * actualManDaysがnullの場合はnullを返す。
 */
export function getVariance(record: BugakariRecord): BugakariVariance | null {
  if (record.actualManDays === null) return null;
  const manDaysDiff = record.actualManDays - record.plannedManDays;
  const costDiff = (record.actualCost ?? 0) - record.plannedCost;
  const varianceRate =
    record.plannedManDays > 0 ? (manDaysDiff / record.plannedManDays) * 100 : 0;
  return {
    manDaysDiff,
    costDiff,
    varianceRate: Math.round(varianceRate * 100) / 100,
  };
}

// ── 集計 ─────────────────────────────────────────────────────────────────────

/**
 * プロジェクトの歩掛サマリーを返す。
 * actualManDaysがnullのレコードは実績集計から除外。
 */
export function getProjectBugakariSummary(projectId: string): BugakariSummary {
  const projectRecords = getRecordsByProject(projectId);
  const completed = projectRecords.filter((r) => r.actualManDays !== null);

  const totalPlannedManDays = projectRecords.reduce((s, r) => s + r.plannedManDays, 0);
  const totalActualManDays = completed.reduce((s, r) => s + (r.actualManDays ?? 0), 0);
  const totalPlannedCost = projectRecords.reduce((s, r) => s + r.plannedCost, 0);
  const totalActualCost = completed.reduce((s, r) => s + (r.actualCost ?? 0), 0);

  const plannedForCompleted = completed.reduce((s, r) => s + r.plannedManDays, 0);
  const overallVarianceRate =
    plannedForCompleted > 0
      ? ((totalActualManDays - plannedForCompleted) / plannedForCompleted) * 100
      : 0;

  return {
    projectId,
    totalPlannedManDays,
    totalActualManDays,
    totalPlannedCost,
    totalActualCost,
    overallVarianceRate: Math.round(overallVarianceRate * 100) / 100,
    recordCount: projectRecords.length,
    completedCount: completed.length,
  };
}

// ── 帳票 ─────────────────────────────────────────────────────────────────────

const CATEGORY_ORDER: BugakariCategory[] = ["解体", "下地", "仕上", "建具", "設備", "その他"];

/**
 * 内装歩掛管理帳票のHTMLを生成する。
 */
export function buildBugakariReportHtml(
  projectId: string,
  projectName: string = projectId,
): string {
  const projectRecords = getRecordsByProject(projectId);
  const summary = getProjectBugakariSummary(projectId);

  const generatedAt = new Date().toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const categorySections = CATEGORY_ORDER.map((category) => {
    const catRecords = projectRecords.filter((r) => r.category === category);
    if (catRecords.length === 0) return "";

    const rows = catRecords
      .map((r, idx) => {
        const variance = getVariance(r);
        const isOver = variance !== null && variance.manDaysDiff > 0;
        const rowStyle = isOver ? ' style="background:#fef2f2;"' : "";
        const varCell =
          variance !== null
            ? `${variance.manDaysDiff >= 0 ? "+" : ""}${variance.manDaysDiff.toFixed(1)} (${variance.varianceRate >= 0 ? "+" : ""}${variance.varianceRate}%)`
            : "—";
        const varColor = variance === null ? "#94a3b8" : isOver ? "#ef4444" : "#22c55e";
        return `<tr${rowStyle}>
          <td style="text-align:center">${idx + 1}</td>
          <td>${escapeHtml(r.taskName)}</td>
          <td style="text-align:right">${r.plannedManDays.toFixed(1)}</td>
          <td style="text-align:right">${r.actualManDays !== null ? r.actualManDays.toFixed(1) : "—"}</td>
          <td style="text-align:right;font-weight:700;color:${varColor}">${varCell}</td>
          <td style="text-align:right">¥${r.unitPrice.toLocaleString()}</td>
          <td style="text-align:right">¥${r.plannedCost.toLocaleString()}</td>
          <td style="text-align:right">${r.actualCost !== null ? "¥" + r.actualCost.toLocaleString() : "—"}</td>
          <td>${escapeHtml(r.workers.join(", "))}</td>
        </tr>`;
      })
      .join("\n");

    return `<section style="margin-bottom:28px;">
  <h2 style="font-size:1.1em;border-bottom:1px solid #cbd5e1;padding-bottom:4px;margin-bottom:8px;">${escapeHtml(category)}</h2>
  <table>
    <thead>
      <tr>
        <th style="width:40px">No.</th>
        <th>作業名</th>
        <th style="width:70px">計画人工</th>
        <th style="width:70px">実績人工</th>
        <th style="width:110px">差異</th>
        <th style="width:90px">単価</th>
        <th style="width:90px">計画原価</th>
        <th style="width:90px">実績原価</th>
        <th style="width:120px">作業者</th>
      </tr>
    </thead>
    <tbody>
      ${rows}
    </tbody>
  </table>
</section>`;
  }).filter(Boolean).join("\n");

  const bodySections = categorySections || `<p style="color:#94a3b8">データなし</p>`;

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8" />
  <title>歩掛管理表 - ${escapeHtml(projectName)}</title>
  <style>
    body { font-family: "Hiragino Sans", "Yu Gothic", sans-serif; margin: 20px; color: #333; font-size: 13px; }
    h1 { font-size: 1.4em; border-bottom: 2px solid #1e293b; padding-bottom: 6px; margin-bottom: 12px; }
    .meta { display: flex; flex-wrap: wrap; gap: 1.5em; margin: 8px 0 14px; font-size: 0.9em; }
    .meta-item .label { color: #64748b; }
    .meta-item .value { font-weight: 600; }
    table { border-collapse: collapse; width: 100%; margin-top: 8px; }
    th, td { border: 1px solid #cbd5e1; padding: 5px 10px; text-align: left; vertical-align: top; }
    th { background: #f1f5f9; font-weight: 600; }
    tr:nth-child(even) { background: #f8fafc; }
    @media print { body { margin: 0; } }
  </style>
</head>
<body>
  <h1>歩掛管理表</h1>
  <div class="meta">
    <div class="meta-item"><span class="label">現場名: </span><span class="value">${escapeHtml(projectName)}</span></div>
    <div class="meta-item"><span class="label">計画人工合計: </span><span class="value">${summary.totalPlannedManDays.toFixed(1)}人工</span></div>
    <div class="meta-item"><span class="label">実績人工合計: </span><span class="value">${summary.totalActualManDays.toFixed(1)}人工</span></div>
    <div class="meta-item"><span class="label">計画原価合計: </span><span class="value">¥${summary.totalPlannedCost.toLocaleString()}</span></div>
    <div class="meta-item"><span class="label">実績原価合計: </span><span class="value">¥${summary.totalActualCost.toLocaleString()}</span></div>
    <div class="meta-item"><span class="label">差異率: </span><span class="value">${summary.overallVarianceRate >= 0 ? "+" : ""}${summary.overallVarianceRate}%</span></div>
    <div class="meta-item"><span class="label">出力日: </span><span class="value">${generatedAt}</span></div>
  </div>
  ${bodySections}
</body>
</html>`;
}
