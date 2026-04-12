/**
 * 是正指示ワークフロー — ANDPAD/SPIDERPLUS蒸留
 * 図面ピン指摘から是正→承認の4ステップワークフローを管理する。
 */
import { escapeHtml } from "./utils/escape-html";

export type CorrectionStatus =
  | "open"
  | "notified"
  | "in_progress"
  | "corrected"
  | "approved"
  | "rejected";

export type CorrectionComment = {
  id: string;
  author: string;
  body: string;
  createdAt: string;
};

export type CorrectionPhotos = {
  before?: string[];
  after?: string[];
};

export type CorrectionItem = {
  id: string;
  projectId: string;
  pinId?: string; // DrawingPin との連携
  title: string;
  description: string;
  assignee: string;
  reporter: string;
  status: CorrectionStatus;
  photos: CorrectionPhotos;
  dueDate: string; // YYYY-MM-DD or ""
  createdAt: string; // ISO datetime
  updatedAt: string; // ISO datetime
  comments: CorrectionComment[];
};

export type CorrectionStats = {
  open: number;
  in_progress: number;
  completed: number;
  rejected: number;
  total: number;
};

// ── In-memory store ──────────────────────────────────────────────────────────

const corrections = new Map<string, CorrectionItem>();

// ── Helpers ──────────────────────────────────────────────────────────────────

function now(): string {
  return new Date().toISOString();
}


// ── ステータス遷移定義 ────────────────────────────────────────────────────────

const VALID_TRANSITIONS: Record<CorrectionStatus, CorrectionStatus[]> = {
  open: ["notified", "rejected"],
  notified: ["in_progress", "rejected"],
  in_progress: ["corrected", "rejected"],
  corrected: ["approved", "rejected"],
  approved: [],
  rejected: [],
};

function assertValidTransition(current: CorrectionStatus, next: CorrectionStatus): void {
  if (!VALID_TRANSITIONS[current].includes(next)) {
    throw new Error(`ステータス遷移不可: ${current} → ${next}`);
  }
}

function findOrThrow(id: string): CorrectionItem {
  const item = corrections.get(id);
  if (!item) throw new Error(`CorrectionItem ${id} not found`);
  return item;
}

// ── CRUD ─────────────────────────────────────────────────────────────────────

/**
 * 新規是正指示を登録する。初期ステータスは "open"。
 */
export function createCorrection(
  params: Omit<CorrectionItem, "id" | "status" | "createdAt" | "updatedAt" | "comments">,
): CorrectionItem {
  const id = crypto.randomUUID();
  const item: CorrectionItem = {
    ...params,
    id,
    status: "open",
    createdAt: now(),
    updatedAt: now(),
    comments: [],
  };
  corrections.set(id, { ...item });
  return item;
}

/**
 * テスト用: 全データをリセットする。
 */
export function clearCorrections(): void {
  corrections.clear();
}

// ── 状態遷移関数 ─────────────────────────────────────────────────────────────

/**
 * 担当者へ通知する（open → notified）。
 */
export function notifyAssignee(id: string): CorrectionItem {
  const item = findOrThrow(id);
  assertValidTransition(item.status, "notified");
  const next = { ...item, status: "notified" as CorrectionStatus, updatedAt: now() };
  corrections.set(id, next);
  return { ...next };
}

/**
 * 是正作業を開始する（notified → in_progress）。
 */
export function startCorrection(id: string): CorrectionItem {
  const item = findOrThrow(id);
  assertValidTransition(item.status, "in_progress");
  const next = { ...item, status: "in_progress" as CorrectionStatus, updatedAt: now() };
  corrections.set(id, next);
  return { ...next };
}

/**
 * 是正完了を提出する（in_progress → corrected）。
 * 完了写真を添付できる。
 */
export function submitCorrection(id: string, afterPhotos?: string[]): CorrectionItem {
  const item = findOrThrow(id);
  assertValidTransition(item.status, "corrected");
  const photos: CorrectionPhotos = {
    ...item.photos,
    ...(afterPhotos ? { after: afterPhotos } : {}),
  };
  const next = { ...item, status: "corrected" as CorrectionStatus, photos, updatedAt: now() };
  corrections.set(id, next);
  return { ...next };
}

/**
 * 是正を承認する（corrected → approved）。
 */
export function approveCorrection(id: string): CorrectionItem {
  const item = findOrThrow(id);
  assertValidTransition(item.status, "approved");
  const next = { ...item, status: "approved" as CorrectionStatus, updatedAt: now() };
  corrections.set(id, next);
  return { ...next };
}

/**
 * 是正を却下する（open|notified|in_progress|corrected → rejected）。
 */
export function rejectCorrection(id: string): CorrectionItem {
  const item = findOrThrow(id);
  assertValidTransition(item.status, "rejected");
  const next = { ...item, status: "rejected" as CorrectionStatus, updatedAt: now() };
  corrections.set(id, next);
  return { ...next };
}

// ── 一覧取得 ─────────────────────────────────────────────────────────────────

/**
 * プロジェクトの是正一覧を取得する。
 */
export function getCorrectionsByProject(projectId: string): CorrectionItem[] {
  return [...corrections.values()].filter((c) => c.projectId === projectId);
}

/**
 * ステータスで是正一覧をフィルタリングする。
 */
export function getCorrectionsByStatus(
  projectId: string,
  status: CorrectionStatus,
): CorrectionItem[] {
  return getCorrectionsByProject(projectId).filter((c) => c.status === status);
}

/**
 * 期限超過の是正を取得する（approved/rejected は除く）。
 */
export function getOverdueCorrections(projectId: string, today: string): CorrectionItem[] {
  const activeStatuses: CorrectionStatus[] = ["open", "notified", "in_progress", "corrected"];
  return getCorrectionsByProject(projectId).filter(
    (c) => activeStatuses.includes(c.status) && c.dueDate !== "" && c.dueDate < today,
  );
}

// ── 統計 ─────────────────────────────────────────────────────────────────────

/**
 * 是正統計を取得する（未対応/対応中/完了/却下の件数）。
 */
export function getCorrectionStats(projectId: string): CorrectionStats {
  const items = getCorrectionsByProject(projectId);
  const openStatuses: CorrectionStatus[] = ["open", "notified"];
  const inProgressStatuses: CorrectionStatus[] = ["in_progress", "corrected"];

  return {
    open: items.filter((c) => openStatuses.includes(c.status)).length,
    in_progress: items.filter((c) => inProgressStatuses.includes(c.status)).length,
    completed: items.filter((c) => c.status === "approved").length,
    rejected: items.filter((c) => c.status === "rejected").length,
    total: items.length,
  };
}

// ── 業者別グループ化 ──────────────────────────────────────────────────────────

/**
 * プロジェクトの是正一覧を担当業者別にグループ化して返す。
 * 戻り値は { [assignee]: CorrectionItem[] } の形式。
 */
export function getCorrectionsByAssignee(
  projectId: string,
): Record<string, CorrectionItem[]> {
  const items = getCorrectionsByProject(projectId);
  const result: Record<string, CorrectionItem[]> = {};
  for (const item of items) {
    if (!result[item.assignee]) result[item.assignee] = [];
    result[item.assignee]!.push(item);
  }
  return result;
}

// ── 帳票 ─────────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<CorrectionStatus, string> = {
  open: "未対応",
  notified: "通知済",
  in_progress: "対応中",
  corrected: "是正済",
  approved: "承認済",
  rejected: "却下",
};

const STATUS_COLORS: Record<CorrectionStatus, string> = {
  open: "#ef4444",
  notified: "#f97316",
  in_progress: "#f59e0b",
  corrected: "#3b82f6",
  approved: "#22c55e",
  rejected: "#6b7280",
};

/**
 * 特定業者向けのダメ帳HTMLを生成する（SPIDERPLUS蒸留P1機能）。
 * ヘッダーに工事名・業者名・発行日・是正期限（最も早い未対応の期限）を表示。
 * 一覧に No/指摘内容/場所/ステータス/写真有無/コメント数を表示。
 * フッターに未対応/対応中/完了の件数サマリを表示。
 */
export function buildDamageReportHtml(
  projectId: string,
  projectName: string,
  assignee: string,
  dueDate?: string, // 是正期限（YYYY-MM-DD）。省略時は業者の最も早い期限を使用
): string {
  const items = (getCorrectionsByAssignee(projectId)[assignee] ?? []);

  const openStatuses: CorrectionStatus[] = ["open", "notified"];
  const inProgressStatuses: CorrectionStatus[] = ["in_progress", "corrected"];

  const openCount = items.filter((c) => openStatuses.includes(c.status)).length;
  const inProgressCount = items.filter((c) => inProgressStatuses.includes(c.status)).length;
  const completedCount = items.filter((c) => c.status === "approved").length;

  // 是正期限: 引数指定 > 業者の未対応アイテム中の最も早い期限
  const resolvedDueDate =
    dueDate ??
    items
      .filter((c) => c.dueDate !== "" && !["approved", "rejected"].includes(c.status))
      .map((c) => c.dueDate)
      .sort()[0] ??
    "";

  const generatedAt = new Date().toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const rowsHtml =
    items.length > 0
      ? items
          .map(
            (item, idx) =>
              `<tr>
                <td style="text-align:center">${idx + 1}</td>
                <td>${escapeHtml(item.title)}</td>
                <td>${escapeHtml(item.description)}</td>
                <td><span style="font-weight:700;color:${STATUS_COLORS[item.status]}">${STATUS_LABELS[item.status]}</span></td>
                <td style="text-align:center">${item.photos.before?.length || item.photos.after?.length ? "あり" : "なし"}</td>
                <td style="text-align:center">${item.comments.length}</td>
              </tr>`,
          )
          .join("\n")
      : `<tr><td colspan="6" style="text-align:center;color:#94a3b8">是正指示なし</td></tr>`;

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8" />
  <title>ダメ帳 - ${escapeHtml(assignee)}</title>
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
    .summary { display: flex; gap: 2em; margin-top: 16px; padding: 10px 14px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 4px; font-size: 0.9em; }
    .summary-item .label { color: #64748b; }
    .summary-item .value { font-weight: 700; margin-left: 4px; }
    .summary-item.open .value { color: #ef4444; }
    .summary-item.in-progress .value { color: #f59e0b; }
    .summary-item.completed .value { color: #22c55e; }
    @media print { body { margin: 0; } }
  </style>
</head>
<body>
  <h1>ダメ帳</h1>
  <div class="meta">
    <div class="meta-item"><span class="label">工事名: </span><span class="value">${escapeHtml(projectName)}</span></div>
    <div class="meta-item"><span class="label">業者名: </span><span class="value">${escapeHtml(assignee)}</span></div>
    <div class="meta-item"><span class="label">発行日: </span><span class="value">${generatedAt}</span></div>
    <div class="meta-item"><span class="label">是正期限: </span><span class="value">${escapeHtml(resolvedDueDate || "—")}</span></div>
  </div>
  <table>
    <thead>
      <tr>
        <th style="width:40px">No.</th>
        <th>指摘内容</th>
        <th>場所</th>
        <th style="width:70px">ステータス</th>
        <th style="width:70px">写真</th>
        <th style="width:70px">コメント</th>
      </tr>
    </thead>
    <tbody>
      ${rowsHtml}
    </tbody>
  </table>
  <div class="summary">
    <div class="summary-item open"><span class="label">未対応:</span><span class="value">${openCount}件</span></div>
    <div class="summary-item in-progress"><span class="label">対応中:</span><span class="value">${inProgressCount}件</span></div>
    <div class="summary-item completed"><span class="label">完了:</span><span class="value">${completedCount}件</span></div>
  </div>
</body>
</html>`;
}

/**
 * 是正一覧のHTML帳票を生成する。
 * drawing-pins.ts の generatePinReport と同スタイル。
 */
export function buildCorrectionReportHtml(
  projectId: string,
  projectName: string,
): string {
  const items = getCorrectionsByProject(projectId);

  const generatedAt = new Date().toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const rowsHtml =
    items.length > 0
      ? items
          .map(
            (item, idx) =>
              `<tr>
                <td style="text-align:center">${idx + 1}</td>
                <td>${escapeHtml(item.title)}</td>
                <td>${escapeHtml(item.reporter)}</td>
                <td>${escapeHtml(item.assignee)}</td>
                <td>${escapeHtml(item.dueDate || "—")}</td>
                <td><span style="font-weight:700;color:${STATUS_COLORS[item.status]}">${STATUS_LABELS[item.status]}</span></td>
              </tr>`,
          )
          .join("\n")
      : `<tr><td colspan="6" style="text-align:center;color:#94a3b8">是正指示なし</td></tr>`;

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8" />
  <title>是正指示一覧 - ${escapeHtml(projectName)}</title>
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
  <h1>是正指示一覧</h1>
  <div class="meta">
    <div class="meta-item"><span class="label">現場名: </span><span class="value">${escapeHtml(projectName)}</span></div>
    <div class="meta-item"><span class="label">件数: </span><span class="value">${items.length}件</span></div>
    <div class="meta-item"><span class="label">出力日: </span><span class="value">${generatedAt}</span></div>
  </div>
  <table>
    <thead>
      <tr>
        <th style="width:40px">No.</th>
        <th>タイトル</th>
        <th style="width:80px">報告者</th>
        <th style="width:80px">担当者</th>
        <th style="width:90px">期日</th>
        <th style="width:70px">ステータス</th>
      </tr>
    </thead>
    <tbody>
      ${rowsHtml}
    </tbody>
  </table>
</body>
</html>`;
}
