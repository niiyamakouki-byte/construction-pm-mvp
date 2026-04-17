/** 認証監査ログ（最小実装）
 * localStorage に JSON 配列として追記。
 * 将来 Supabase audit_log テーブルへ送る前段として使用。
 */

export type AuditEventType = "login" | "logout" | "timeout";

export type AuditEntry = {
  type: AuditEventType;
  userId: string;
  email?: string;
  ts: string; // ISO 8601
};

const STORAGE_KEY = "genbahub_audit_log";
const MAX_ENTRIES = 200;

export function appendAuditLog(entry: AuditEntry): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const list: AuditEntry[] = raw ? (JSON.parse(raw) as AuditEntry[]) : [];
    list.push(entry);
    // 上限を超えたら古いものを削る
    const trimmed = list.length > MAX_ENTRIES ? list.slice(list.length - MAX_ENTRIES) : list;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    // localStorage が使えない環境（SSR / プライベートモード）では無視
  }
}

export function readAuditLog(): AuditEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as AuditEntry[]) : [];
  } catch {
    return [];
  }
}
