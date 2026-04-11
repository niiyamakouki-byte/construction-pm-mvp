/**
 * 出来形管理モジュール — 蔵衛門蒸留
 * 国土交通省出来形管理基準に準拠した計測値管理・合否判定・帳票生成。
 */
import { escapeHtml } from "./utils/escape-html";

// ── 型定義 ────────────────────────────────────────────────────────────────────

export type DekigataCategory = "基礎" | "躯体" | "仕上" | "設備" | "外構";

export const DEKIGATA_CATEGORIES: DekigataCategory[] = [
  "基礎",
  "躯体",
  "仕上",
  "設備",
  "外構",
];

export type DekigataUnit = "mm" | "m" | "度" | "%";

export type DekigataStatus = "pass" | "fail" | "pending";

export type DekigataRecord = {
  id: string;
  projectId: string;
  category: DekigataCategory;
  itemName: string;
  designValue: number;    // 設計値
  actualValue: number | null; // 実測値（未計測はnull）
  tolerance: number;      // 許容差（±）
  unit: DekigataUnit;
  measuredAt: string | null; // YYYY-MM-DD
  measuredBy: string | null;
  status: DekigataStatus;
  photoIds: string[];
};

export type DekigataStats = {
  projectId: string;
  total: number;
  pass: number;
  fail: number;
  pending: number;
  passRate: number; // pass / (pass + fail) * 100
};

// ── 国交省標準計測項目テンプレート ─────────────────────────────────────────────

export type DekigataTemplate = {
  category: DekigataCategory;
  itemName: string;
  defaultTolerance: number;
  unit: DekigataUnit;
};

export const MLIT_TEMPLATES: DekigataTemplate[] = [
  // 基礎
  { category: "基礎", itemName: "根入れ深さ", defaultTolerance: 50, unit: "mm" },
  { category: "基礎", itemName: "基礎幅", defaultTolerance: 20, unit: "mm" },
  { category: "基礎", itemName: "基礎高さ", defaultTolerance: 30, unit: "mm" },
  { category: "基礎", itemName: "かぶり厚さ", defaultTolerance: 10, unit: "mm" },
  // 躯体
  { category: "躯体", itemName: "柱位置", defaultTolerance: 10, unit: "mm" },
  { category: "躯体", itemName: "柱の鉛直度", defaultTolerance: 5, unit: "mm" },
  { category: "躯体", itemName: "梁の高さ", defaultTolerance: 10, unit: "mm" },
  { category: "躯体", itemName: "壁厚", defaultTolerance: 10, unit: "mm" },
  { category: "躯体", itemName: "床スラブ厚", defaultTolerance: 10, unit: "mm" },
  // 仕上
  { category: "仕上", itemName: "床仕上げ高さ", defaultTolerance: 5, unit: "mm" },
  { category: "仕上", itemName: "壁仕上げ面の平坦度", defaultTolerance: 3, unit: "mm" },
  { category: "仕上", itemName: "天井仕上げ高さ", defaultTolerance: 10, unit: "mm" },
];

// ── In-memory store ──────────────────────────────────────────────────────────

const records = new Map<string, DekigataRecord>();

// ── Helpers ──────────────────────────────────────────────────────────────────

function now(): string {
  return new Date().toISOString();
}


/**
 * 許容差判定: actualValue が designValue ± tolerance 内なら pass、外なら fail。
 * actualValue が null の場合は pending。
 */
export function checkTolerance(record: DekigataRecord): DekigataStatus {
  if (record.actualValue === null) return "pending";
  const diff = Math.abs(record.actualValue - record.designValue);
  return diff <= record.tolerance ? "pass" : "fail";
}

// ── CRUD ──────────────────────────────────────────────────────────────────────

/**
 * 出来形レコードを新規作成する。statusは自動判定。
 */
export function createRecord(
  data: Omit<DekigataRecord, "status">,
): DekigataRecord {
  const status = checkTolerance({ ...data, status: "pending" });
  const record: DekigataRecord = { ...data, status };
  records.set(record.id, record);
  return { ...record };
}

/**
 * 出来形レコードを更新する。statusは自動再判定。
 */
export function updateRecord(
  id: string,
  updates: Partial<Omit<DekigataRecord, "id" | "projectId" | "status">>,
): DekigataRecord {
  const existing = records.get(id);
  if (!existing) throw new Error(`DekigataRecord ${id} not found`);
  const merged = { ...existing, ...updates };
  merged.status = checkTolerance(merged);
  records.set(id, merged);
  return { ...merged };
}

/**
 * 出来形レコードを削除する。
 */
export function deleteRecord(id: string): void {
  if (!records.has(id)) throw new Error(`DekigataRecord ${id} not found`);
  records.delete(id);
}

/**
 * プロジェクト内の全レコードを返す。
 */
export function getRecordsByProject(projectId: string): DekigataRecord[] {
  return [...records.values()].filter((r) => r.projectId === projectId);
}

/**
 * プロジェクト内の指定カテゴリのレコードを返す。
 */
export function getRecordsByCategory(
  projectId: string,
  category: DekigataCategory,
): DekigataRecord[] {
  return getRecordsByProject(projectId).filter((r) => r.category === category);
}

/**
 * テスト用ストアクリア。
 */
export function clearRecords(): void {
  records.clear();
}

// ── 統計 ──────────────────────────────────────────────────────────────────────

/**
 * プロジェクトの出来形統計を返す。
 * passRate = pass / (pass + fail) * 100。未計測(pending)は除外。
 */
export function getDekigataStats(projectId: string): DekigataStats {
  const projectRecords = getRecordsByProject(projectId);
  const pass = projectRecords.filter((r) => r.status === "pass").length;
  const fail = projectRecords.filter((r) => r.status === "fail").length;
  const pending = projectRecords.filter((r) => r.status === "pending").length;
  const measured = pass + fail;
  const passRate = measured > 0 ? (pass / measured) * 100 : 0;

  return {
    projectId,
    total: projectRecords.length,
    pass,
    fail,
    pending,
    passRate,
  };
}

// ── 帳票 ─────────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<DekigataStatus, string> = {
  pass: "合格",
  fail: "不合格",
  pending: "未計測",
};

const STATUS_COLORS: Record<DekigataStatus, string> = {
  pass: "#22c55e",
  fail: "#ef4444",
  pending: "#94a3b8",
};

const CATEGORY_ORDER: DekigataCategory[] = ["基礎", "躯体", "仕上", "設備", "外構"];

/**
 * 国土交通省出来形管理図表形式のHTML帳票を生成する。
 */
export function buildDekigataReportHtml(
  projectId: string,
  projectName: string = projectId,
): string {
  const projectRecords = getRecordsByProject(projectId);
  const stats = getDekigataStats(projectId);

  const generatedAt = new Date().toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const categorySections = CATEGORY_ORDER.map((category) => {
    const catRecords = projectRecords.filter((r) => r.category === category);
    if (catRecords.length === 0) return "";

    const rows = catRecords
      .map(
        (r, idx) =>
          `<tr${r.status === "fail" ? ' style="background:#fef2f2;"' : ""}>
            <td style="text-align:center">${idx + 1}</td>
            <td>${escapeHtml(r.itemName)}</td>
            <td style="text-align:right">${r.designValue}</td>
            <td style="text-align:right">${r.actualValue !== null ? r.actualValue : "—"}</td>
            <td style="text-align:right">±${r.tolerance}</td>
            <td style="text-align:center">${escapeHtml(r.unit)}</td>
            <td style="text-align:center;font-weight:700;color:${STATUS_COLORS[r.status]}">${STATUS_LABELS[r.status]}</td>
            <td>${escapeHtml(r.measuredAt ?? "—")}</td>
            <td>${escapeHtml(r.measuredBy ?? "—")}</td>
          </tr>`,
      )
      .join("\n");

    return `<section style="margin-bottom:28px;">
  <h2 style="font-size:1.1em;border-bottom:1px solid #cbd5e1;padding-bottom:4px;margin-bottom:8px;">${escapeHtml(category)}</h2>
  <table>
    <thead>
      <tr>
        <th style="width:40px">No.</th>
        <th>計測項目</th>
        <th style="width:70px">設計値</th>
        <th style="width:70px">実測値</th>
        <th style="width:70px">許容差</th>
        <th style="width:50px">単位</th>
        <th style="width:70px">判定</th>
        <th style="width:90px">計測日</th>
        <th style="width:80px">計測者</th>
      </tr>
    </thead>
    <tbody>
      ${rows}
    </tbody>
  </table>
</section>`;
  }).filter(Boolean).join("\n");

  const bodySections = categorySections || `<p style="color:#94a3b8">計測データなし</p>`;

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8" />
  <title>出来形管理表 - ${escapeHtml(projectName)}</title>
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
  <h1>出来形管理表</h1>
  <div class="meta">
    <div class="meta-item"><span class="label">現場名: </span><span class="value">${escapeHtml(projectName)}</span></div>
    <div class="meta-item"><span class="label">計測件数: </span><span class="value">${stats.total}件</span></div>
    <div class="meta-item"><span class="label">合格: </span><span class="value">${stats.pass}件</span></div>
    <div class="meta-item"><span class="label">不合格: </span><span class="value">${stats.fail}件</span></div>
    <div class="meta-item"><span class="label">合格率: </span><span class="value">${stats.passRate.toFixed(1)}%</span></div>
    <div class="meta-item"><span class="label">出力日: </span><span class="value">${generatedAt}</span></div>
  </div>
  ${bodySections}
</body>
</html>`;
}
