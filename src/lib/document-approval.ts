/**
 * 資料承認ワークフロー — ANDPAD蒸留
 * 見積書・図面・仕様書等の資料を提出→審査→承認/却下/差戻しの6ステータスで管理する。
 */

export type ApprovalStatus =
  | "draft"
  | "submitted"
  | "reviewing"
  | "approved"
  | "rejected"
  | "revised";

export type ApprovalCategory =
  | "見積書"
  | "図面"
  | "仕様書"
  | "報告書"
  | "請求書"
  | "契約書"
  | "その他";

export type ApprovalComment = {
  id: string;
  userId: string;
  text: string;
  action: "submit" | "approve" | "reject" | "comment" | "revise";
  createdAt: string; // ISO datetime
};

export type ApprovalDocument = {
  id: string;
  projectId: string;
  title: string;
  category: ApprovalCategory;
  submittedBy: string;
  reviewers: string[];
  status: ApprovalStatus;
  version: number;
  comments: ApprovalComment[];
  createdAt: string; // ISO datetime
  updatedAt: string; // ISO datetime
};

export type ApprovalStats = {
  pending: number;   // submitted + reviewing
  approved: number;
  rejected: number;
  revised: number;
  total: number;
};

// ── In-memory store ──────────────────────────────────────────────────────────

const documents = new Map<string, ApprovalDocument>();

// ── Helpers ──────────────────────────────────────────────────────────────────

function now(): string {
  return new Date().toISOString();
}

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ── ステータス遷移定義 ────────────────────────────────────────────────────────

const VALID_TRANSITIONS: Record<ApprovalStatus, ApprovalStatus[]> = {
  draft: ["submitted"],
  submitted: ["reviewing", "rejected"],
  reviewing: ["approved", "rejected", "revised"],
  approved: [],
  rejected: [],
  revised: ["submitted"],
};

function assertValidTransition(current: ApprovalStatus, next: ApprovalStatus): void {
  if (!VALID_TRANSITIONS[current].includes(next)) {
    throw new Error(`ステータス遷移不可: ${current} → ${next}`);
  }
}

function findOrThrow(id: string): ApprovalDocument {
  const doc = documents.get(id);
  if (!doc) throw new Error(`ApprovalDocument ${id} not found`);
  return doc;
}

function addComment(
  doc: ApprovalDocument,
  userId: string,
  text: string,
  action: ApprovalComment["action"],
): ApprovalDocument {
  const comment: ApprovalComment = {
    id: crypto.randomUUID(),
    userId,
    text,
    action,
    createdAt: now(),
  };
  return { ...doc, comments: [...doc.comments, comment] };
}

// ── CRUD ─────────────────────────────────────────────────────────────────────

/**
 * 新規資料を登録する。初期ステータスは "draft"、version は 1。
 */
export function createDocument(
  params: Omit<ApprovalDocument, "id" | "status" | "version" | "comments" | "createdAt" | "updatedAt">,
): ApprovalDocument {
  const id = crypto.randomUUID();
  const doc: ApprovalDocument = {
    ...params,
    id,
    status: "draft",
    version: 1,
    createdAt: now(),
    updatedAt: now(),
    comments: [],
  };
  documents.set(id, { ...doc });
  return doc;
}

/**
 * テスト用: 全データをリセットする。
 */
export function clearDocuments(): void {
  documents.clear();
}

// ── 状態遷移関数 ─────────────────────────────────────────────────────────────

/**
 * 審査に提出する（draft | revised → submitted）。
 */
export function submitForApproval(id: string, userId: string, text = ""): ApprovalDocument {
  const doc = findOrThrow(id);
  assertValidTransition(doc.status, "submitted");
  let next = { ...doc, status: "submitted" as ApprovalStatus, updatedAt: now() };
  next = addComment(next, userId, text, "submit");
  documents.set(id, next);
  return { ...next };
}

/**
 * 審査を開始する（submitted → reviewing）。
 */
export function startReview(id: string, userId: string, text = ""): ApprovalDocument {
  const doc = findOrThrow(id);
  assertValidTransition(doc.status, "reviewing");
  let next = { ...doc, status: "reviewing" as ApprovalStatus, updatedAt: now() };
  next = addComment(next, userId, text, "comment");
  documents.set(id, next);
  return { ...next };
}

/**
 * 資料を承認する（reviewing → approved）。
 */
export function approve(id: string, userId: string, text = ""): ApprovalDocument {
  const doc = findOrThrow(id);
  assertValidTransition(doc.status, "approved");
  let next = { ...doc, status: "approved" as ApprovalStatus, updatedAt: now() };
  next = addComment(next, userId, text, "approve");
  documents.set(id, next);
  return { ...next };
}

/**
 * 資料を却下する（submitted | reviewing → rejected）。
 */
export function reject(id: string, userId: string, text = ""): ApprovalDocument {
  const doc = findOrThrow(id);
  assertValidTransition(doc.status, "rejected");
  let next = { ...doc, status: "rejected" as ApprovalStatus, updatedAt: now() };
  next = addComment(next, userId, text, "reject");
  documents.set(id, next);
  return { ...next };
}

/**
 * 差戻しする（reviewing → revised）。バージョンをインクリメントする。
 */
export function revise(id: string, userId: string, text = ""): ApprovalDocument {
  const doc = findOrThrow(id);
  assertValidTransition(doc.status, "revised");
  let next = {
    ...doc,
    status: "revised" as ApprovalStatus,
    version: doc.version + 1,
    updatedAt: now(),
  };
  next = addComment(next, userId, text, "revise");
  documents.set(id, next);
  return { ...next };
}

/**
 * コメントを追加する（ステータス変更なし）。
 */
export function addDocumentComment(id: string, userId: string, text: string): ApprovalDocument {
  const doc = findOrThrow(id);
  const next = { ...addComment(doc, userId, text, "comment"), updatedAt: now() };
  documents.set(id, next);
  return { ...next };
}

// ── 一覧取得 ─────────────────────────────────────────────────────────────────

/**
 * プロジェクトの資料一覧を取得する。
 */
export function getDocumentsByProject(projectId: string): ApprovalDocument[] {
  return [...documents.values()].filter((d) => d.projectId === projectId);
}

/**
 * ステータスで資料一覧をフィルタリングする。
 */
export function getDocumentsByStatus(
  projectId: string,
  status: ApprovalStatus,
): ApprovalDocument[] {
  return getDocumentsByProject(projectId).filter((d) => d.status === status);
}

/**
 * 指定ユーザーの承認待ち資料を取得する（自分がレビュアーに含まれる submitted/reviewing）。
 */
export function getPendingApprovals(userId: string): ApprovalDocument[] {
  const pendingStatuses: ApprovalStatus[] = ["submitted", "reviewing"];
  return [...documents.values()].filter(
    (d) => pendingStatuses.includes(d.status) && d.reviewers.includes(userId),
  );
}

// ── 統計 ─────────────────────────────────────────────────────────────────────

/**
 * 資料承認統計を取得する（承認待ち/承認済/却下/差戻しの件数）。
 */
export function getApprovalStats(projectId: string): ApprovalStats {
  const items = getDocumentsByProject(projectId);
  const pendingStatuses: ApprovalStatus[] = ["submitted", "reviewing"];

  return {
    pending: items.filter((d) => pendingStatuses.includes(d.status)).length,
    approved: items.filter((d) => d.status === "approved").length,
    rejected: items.filter((d) => d.status === "rejected").length,
    revised: items.filter((d) => d.status === "revised").length,
    total: items.length,
  };
}

// ── 帳票 ─────────────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<ApprovalStatus, string> = {
  draft: "下書き",
  submitted: "提出済",
  reviewing: "審査中",
  approved: "承認済",
  rejected: "却下",
  revised: "差戻し",
};

const STATUS_COLORS: Record<ApprovalStatus, string> = {
  draft: "#94a3b8",
  submitted: "#f97316",
  reviewing: "#3b82f6",
  approved: "#22c55e",
  rejected: "#ef4444",
  revised: "#f59e0b",
};

/**
 * 承認履歴のHTML帳票を生成する。
 */
export function buildApprovalLogHtml(projectId: string, projectName: string): string {
  const items = getDocumentsByProject(projectId);

  const generatedAt = new Date().toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const rowsHtml =
    items.length > 0
      ? items
          .map(
            (doc, idx) =>
              `<tr>
                <td style="text-align:center">${idx + 1}</td>
                <td>${escapeHtml(doc.title)}</td>
                <td>${escapeHtml(doc.category)}</td>
                <td>${escapeHtml(doc.submittedBy)}</td>
                <td style="text-align:center">${doc.version}</td>
                <td><span style="font-weight:700;color:${STATUS_COLORS[doc.status]}">${STATUS_LABELS[doc.status]}</span></td>
                <td style="text-align:center">${doc.comments.length}</td>
              </tr>`,
          )
          .join("\n")
      : `<tr><td colspan="7" style="text-align:center;color:#94a3b8">資料なし</td></tr>`;

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8" />
  <title>資料承認履歴 - ${escapeHtml(projectName)}</title>
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
  <h1>資料承認履歴</h1>
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
        <th style="width:70px">区分</th>
        <th style="width:80px">提出者</th>
        <th style="width:50px">版</th>
        <th style="width:70px">ステータス</th>
        <th style="width:60px">コメント数</th>
      </tr>
    </thead>
    <tbody>
      ${rowsHtml}
    </tbody>
  </table>
</body>
</html>`;
}
