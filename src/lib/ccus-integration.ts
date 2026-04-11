/**
 * CCUS（建設キャリアアップシステム）連携モジュール for GenbaHub.
 * 技能者情報の管理、入退場記録、レベル判定、統計、帳票生成を提供する。
 */
import { escapeHtml } from "./utils/escape-html";

// ── Types ──────────────────────────────────────────

export type SkillLevel = 1 | 2 | 3 | 4;

export type CCUSWorker = {
  id: string;
  ccusId: string; // 建設キャリアアップシステム技能者ID（14桁）
  name: string;
  company: string;
  jobType: string;
  skillLevel: SkillLevel;
  certifications: string[];
  registeredAt: string;
};

export type CCUSEntryRecord = {
  id: string;
  workerId: string;
  ccusId: string;
  projectId: string;
  entryTime: string;
  exitTime?: string;
  workedHours?: number;
};

export type CCUSStats = {
  projectId: string;
  totalWorkers: number;
  averageSkillLevel: number;
  certificationRate: number; // 資格保有率（0-1）
  levelBreakdown: Record<SkillLevel, number>;
};

// ── Storage ────────────────────────────────────────

const workers: CCUSWorker[] = [];
const entryRecords: CCUSEntryRecord[] = [];
let workerCounter = 0;
let entryCounter = 0;

// ── Worker CRUD ────────────────────────────────────

/**
 * 技能者を登録する。ccusId の形式チェック（14桁数字）付き。
 */
export function registerWorker(worker: Omit<CCUSWorker, "id">): CCUSWorker {
  if (!/^\d{14}$/.test(worker.ccusId)) {
    throw new Error("ccusId は14桁の数字で入力してください");
  }
  if (!worker.name.trim()) throw new Error("name は必須です");
  if (!worker.company.trim()) throw new Error("company は必須です");

  workerCounter += 1;
  const newWorker: CCUSWorker = {
    ...worker,
    id: `ccus-worker-${workerCounter}`,
    name: worker.name.trim(),
    company: worker.company.trim(),
  };
  workers.push(newWorker);
  return newWorker;
}

/**
 * 技能者情報を更新する。存在しない場合は null を返す。
 */
export function updateWorker(
  id: string,
  updates: Partial<Omit<CCUSWorker, "id" | "ccusId">>,
): CCUSWorker | null {
  const worker = workers.find((w) => w.id === id);
  if (!worker) return null;

  if (updates.name !== undefined) worker.name = updates.name.trim();
  if (updates.company !== undefined) worker.company = updates.company.trim();
  if (updates.jobType !== undefined) worker.jobType = updates.jobType;
  if (updates.skillLevel !== undefined) worker.skillLevel = updates.skillLevel;
  if (updates.certifications !== undefined) worker.certifications = updates.certifications;
  return worker;
}

/**
 * CCUS技能者IDで技能者を検索する。
 */
export function getWorkerByCCUSId(ccusId: string): CCUSWorker | null {
  return workers.find((w) => w.ccusId === ccusId) ?? null;
}

/**
 * 全技能者を返す。
 */
export function getAllWorkers(): CCUSWorker[] {
  return [...workers];
}

// ── Entry / Exit ───────────────────────────────────

/**
 * CCUS技能者の入場を記録する。
 */
export function recordCCUSEntry(ccusId: string, projectId: string): CCUSEntryRecord {
  const worker = getWorkerByCCUSId(ccusId);
  if (!worker) throw new Error(`技能者が見つかりません: ccusId=${ccusId}`);
  if (!projectId) throw new Error("projectId は必須です");

  entryCounter += 1;
  const record: CCUSEntryRecord = {
    id: `ccus-entry-${entryCounter}`,
    workerId: worker.id,
    ccusId,
    projectId,
    entryTime: new Date().toISOString(),
  };
  entryRecords.push(record);
  return record;
}

/**
 * CCUS技能者の退場を記録する。勤務時間（workedHours）を自動計算する。
 */
export function recordCCUSExit(entryRecordId: string): CCUSEntryRecord | null {
  const record = entryRecords.find((r) => r.id === entryRecordId);
  if (!record) return null;

  record.exitTime = new Date().toISOString();
  record.workedHours =
    (new Date(record.exitTime).getTime() - new Date(record.entryTime).getTime()) /
    (1000 * 60 * 60);
  record.workedHours = Math.round(record.workedHours * 100) / 100;
  return record;
}

/**
 * 指定日（YYYY-MM-DD）の入退場記録を返す。
 */
export function getCCUSEntriesByDate(date: string): CCUSEntryRecord[] {
  return entryRecords.filter((r) => r.entryTime.startsWith(date));
}

/**
 * プロジェクトIDで入退場記録を返す。
 */
export function getCCUSEntriesByProject(projectId: string): CCUSEntryRecord[] {
  return entryRecords.filter((r) => r.projectId === projectId);
}

// ── Skill level calculation ────────────────────────

/**
 * 資格リストと経験年数からCCUSレベル（1-4）を判定する。
 *
 * レベル判定基準:
 *   4: 経験10年以上 or 施工管理技士（1級）保有
 *   3: 経験5年以上 or 施工管理技士（2級）保有
 *   2: 経験3年以上 or 技能士系資格保有
 *   1: それ以外（エントリー）
 */
export function calculateSkillLevel(
  certifications: string[],
  experienceYears: number,
): SkillLevel {
  const certs = certifications.map((c) => c.toLowerCase());

  const hasLevel4Cert = certs.some(
    (c) =>
      c.includes("1級施工管理技士") ||
      c.includes("一級施工管理技士") ||
      c.includes("一級建築士") ||
      c.includes("1級建築士"),
  );
  if (hasLevel4Cert || experienceYears >= 10) return 4;

  const hasLevel3Cert = certs.some(
    (c) =>
      c.includes("2級施工管理技士") ||
      c.includes("二級施工管理技士") ||
      c.includes("二級建築士") ||
      c.includes("2級建築士"),
  );
  if (hasLevel3Cert || experienceYears >= 5) return 3;

  const hasLevel2Cert = certs.some(
    (c) =>
      c.includes("技能士") ||
      c.includes("職業訓練指導員") ||
      c.includes("技能検定"),
  );
  if (hasLevel2Cert || experienceYears >= 3) return 2;

  return 1;
}

// ── Statistics ─────────────────────────────────────

/**
 * プロジェクトのCCUS統計を返す。
 * 対象: そのプロジェクトに入場記録のある技能者。
 */
export function getCCUSStats(projectId: string): CCUSStats {
  const projectEntries = getCCUSEntriesByProject(projectId);
  const uniqueCcusIds = [...new Set(projectEntries.map((r) => r.ccusId))];
  const projectWorkers = uniqueCcusIds
    .map((id) => getWorkerByCCUSId(id))
    .filter((w): w is CCUSWorker => w !== null);

  const totalWorkers = projectWorkers.length;

  const averageSkillLevel =
    totalWorkers > 0
      ? Math.round(
          (projectWorkers.reduce((sum, w) => sum + w.skillLevel, 0) / totalWorkers) * 100,
        ) / 100
      : 0;

  const certificationRate =
    totalWorkers > 0
      ? Math.round(
          (projectWorkers.filter((w) => w.certifications.length > 0).length / totalWorkers) * 100,
        ) / 100
      : 0;

  const levelBreakdown: Record<SkillLevel, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
  for (const w of projectWorkers) {
    levelBreakdown[w.skillLevel] += 1;
  }

  return {
    projectId,
    totalWorkers,
    averageSkillLevel,
    certificationRate,
    levelBreakdown,
  };
}

// ── HTML Report ────────────────────────────────────


const LEVEL_LABELS: Record<SkillLevel, string> = {
  1: "レベル1（初級）",
  2: "レベル2（中級）",
  3: "レベル3（上級）",
  4: "レベル4（マスター）",
};

const LEVEL_COLORS: Record<SkillLevel, string> = {
  1: "#64748b",
  2: "#2563eb",
  3: "#16a34a",
  4: "#b45309",
};

/**
 * CCUS実績報告書のHTMLを生成する。
 */
export function buildCCUSReportHtml(projectId: string, projectName: string): string {
  const stats = getCCUSStats(projectId);
  const entries = getCCUSEntriesByProject(projectId);

  const generatedAt = new Date().toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const workerRows =
    stats.totalWorkers > 0
      ? [...new Set(entries.map((e) => e.ccusId))]
          .map((ccusId) => {
            const worker = getWorkerByCCUSId(ccusId);
            if (!worker) return "";
            const workerEntries = entries.filter((e) => e.ccusId === ccusId);
            const totalHours = workerEntries
              .filter((e) => e.workedHours !== undefined)
              .reduce((sum, e) => sum + (e.workedHours ?? 0), 0);
            return `<tr>
  <td>${escapeHtml(worker.ccusId)}</td>
  <td>${escapeHtml(worker.name)}</td>
  <td>${escapeHtml(worker.company)}</td>
  <td>${escapeHtml(worker.jobType)}</td>
  <td style="text-align:center;font-weight:700;color:${LEVEL_COLORS[worker.skillLevel]}">${LEVEL_LABELS[worker.skillLevel]}</td>
  <td>${escapeHtml(worker.certifications.join("、") || "—")}</td>
  <td style="text-align:right">${workerEntries.length}回</td>
  <td style="text-align:right">${totalHours > 0 ? totalHours.toFixed(1) + "h" : "—"}</td>
</tr>`;
          })
          .filter(Boolean)
          .join("\n")
      : `<tr><td colspan="8" style="text-align:center;color:#94a3b8">技能者データなし</td></tr>`;

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8" />
  <title>CCUS実績報告書 - ${escapeHtml(projectName)}</title>
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
  <h1>CCUS実績報告書</h1>
  <div class="meta">
    <div class="meta-item"><span class="label">現場名: </span><span class="value">${escapeHtml(projectName)}</span></div>
    <div class="meta-item"><span class="label">技能者数: </span><span class="value">${stats.totalWorkers}名</span></div>
    <div class="meta-item"><span class="label">平均レベル: </span><span class="value">${stats.averageSkillLevel.toFixed(2)}</span></div>
    <div class="meta-item"><span class="label">資格保有率: </span><span class="value">${Math.round(stats.certificationRate * 100)}%</span></div>
    <div class="meta-item"><span class="label">出力日: </span><span class="value">${generatedAt}</span></div>
  </div>
  <table>
    <thead>
      <tr>
        <th>CCUS技能者ID</th>
        <th>氏名</th>
        <th>所属会社</th>
        <th>職種</th>
        <th>レベル</th>
        <th>保有資格</th>
        <th style="text-align:center">入場回数</th>
        <th style="text-align:center">累積時間</th>
      </tr>
    </thead>
    <tbody>
      ${workerRows}
    </tbody>
  </table>
</body>
</html>`;
}

// ── Reset (for testing) ────────────────────────────

export function _resetCCUSStore(): void {
  workers.length = 0;
  entryRecords.length = 0;
  workerCounter = 0;
  entryCounter = 0;
}
