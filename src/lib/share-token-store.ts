/**
 * share-token-store.ts — 共有トークンの状態管理と監査ログ
 *
 * In-memory を一次ストアとし、localStorage へのオプション永続化を行う。
 * （site-entry-log.ts / labor-tracker.ts と同パターン。Supabase 未統合の現状。）
 */

const REVOKED_STORAGE_KEY = "genbahub_share_revoked";
const REDEEMED_STORAGE_KEY = "genbahub_share_redeemed";
const AUDIT_STORAGE_KEY = "genbahub_share_audit";
const MAX_AUDIT_ENTRIES = 500;

export type ShareAuditEventType = "issued" | "used" | "failed" | "revoked";

export type ShareAuditEntry = {
  event: ShareAuditEventType;
  tokenId: string;
  projectId: string;
  ts: string; // ISO 8601
  reason?: string;
};

// ── In-memory primary stores ───────────────────────────────────────────────

export const revokedTokens: Set<string> = new Set();
export const redeemedTokens: Set<string> = new Set();
const auditLog: ShareAuditEntry[] = [];

// ── localStorage helpers (optional persistence, best-effort) ──────────────

function tryPersistSet(key: string, set: Set<string>): void {
  try {
    localStorage.setItem(key, JSON.stringify([...set]));
  } catch {
    // localStorage が使えない環境では無視
  }
}

function tryPersistAudit(): void {
  try {
    localStorage.setItem(AUDIT_STORAGE_KEY, JSON.stringify(auditLog));
  } catch {
    // 無視
  }
}

// ── Revoke / redeem ────────────────────────────────────────────────────────

/**
 * トークンを失効させる。
 * @param tokenId 失効させるトークン ID
 * @param reason 失効理由（施主向け portal 管理画面から呼ばれる）
 */
export function revoke(tokenId: string, reason: string): void {
  revokedTokens.add(tokenId);
  tryPersistSet(REVOKED_STORAGE_KEY, revokedTokens);
  appendShareAuditLog({
    event: "revoked",
    tokenId,
    projectId: "unknown",
    ts: new Date().toISOString(),
    reason,
  });
}

/**
 * 1回限りトークンを使用済みとしてマークする。
 * @param tokenId 使用済みにするトークン ID
 */
export function markRedeemed(tokenId: string): void {
  redeemedTokens.add(tokenId);
  tryPersistSet(REDEEMED_STORAGE_KEY, redeemedTokens);
}

// ── Audit log ─────────────────────────────────────────────────────────────

/**
 * 監査ログに1エントリ追記する（in-memory + localStorage）。
 */
export function appendShareAuditLog(entry: ShareAuditEntry): void {
  auditLog.push(entry);
  // 上限超過時は古いものを削る
  if (auditLog.length > MAX_AUDIT_ENTRIES) {
    auditLog.splice(0, auditLog.length - MAX_AUDIT_ENTRIES);
  }
  tryPersistAudit();
}

/**
 * 指定プロジェクトの監査ログを返す（in-memory から取得）。
 * projectId が空文字の場合は全エントリを返す。
 */
export function getAuditLog(projectId: string): ShareAuditEntry[] {
  if (!projectId) return [...auditLog];
  return auditLog.filter((e) => e.projectId === projectId);
}

/**
 * テスト用: メモリ上の全ストアをリセットする。
 */
export function _resetForTest(): void {
  revokedTokens.clear();
  redeemedTokens.clear();
  auditLog.splice(0, auditLog.length);
  try {
    localStorage.removeItem(REVOKED_STORAGE_KEY);
    localStorage.removeItem(REDEEMED_STORAGE_KEY);
    localStorage.removeItem(AUDIT_STORAGE_KEY);
  } catch {
    // 無視
  }
}
