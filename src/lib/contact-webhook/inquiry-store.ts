/**
 * inquiry-store — 受信済み問い合わせ履歴を localStorage に永続化する
 *
 * CRUD + localStorage round-trip。React 依存なし。
 */

import type { ContactSubmission } from "./contact-webhook-receiver.js";
import type { EstimateRange } from "../estimate-assistant/cost-lookup.js";
import type { ReplyDraft } from "./reply-draft-generator.js";

// ── 型定義 ───────────────────────────────────────────────────────────────────

export type InquiryStatus = "new" | "reviewing" | "sent" | "archived";

export type InquiryRecord = {
  id: string;
  submission: ContactSubmission;
  estimate: EstimateRange;
  draft: ReplyDraft;
  status: InquiryStatus;
  createdAt: string;
  updatedAt: string;
};

// ── 定数 ────────────────────────────────────────────────────────────────────

const STORAGE_KEY = "genbahub_inquiry_store_v1";

// ── 内部ストア (メモリ) ───────────────────────────────────────────────────────

let _records: InquiryRecord[] = [];
let _loaded = false;

// ── 永続化ヘルパー ────────────────────────────────────────────────────────────

function loadFromStorage(): InquiryRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as InquiryRecord[];
  } catch {
    return [];
  }
}

function saveToStorage(records: InquiryRecord[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  } catch {
    // localStorage unavailable (テスト環境等)
  }
}

function ensureLoaded(): void {
  if (!_loaded) {
    _records = loadFromStorage();
    _loaded = true;
  }
}

// ── CRUD API ─────────────────────────────────────────────────────────────────

/**
 * 新規問い合わせを追加して InquiryRecord を返す。
 */
export function addInquiry(
  submission: ContactSubmission,
  estimate: EstimateRange,
  draft: ReplyDraft,
): InquiryRecord {
  ensureLoaded();
  const now = new Date().toISOString();
  const record: InquiryRecord = {
    id: submission.id,
    submission,
    estimate,
    draft,
    status: "new",
    createdAt: now,
    updatedAt: now,
  };
  _records = [record, ..._records];
  saveToStorage(_records);
  return record;
}

/**
 * 全問い合わせ一覧を返す (新しい順)。
 */
export function listInquiries(): InquiryRecord[] {
  ensureLoaded();
  return [..._records];
}

/**
 * ID で一件取得。見つからなければ undefined。
 */
export function getInquiry(id: string): InquiryRecord | undefined {
  ensureLoaded();
  return _records.find((r) => r.id === id);
}

/**
 * ステータスを更新する。
 */
export function updateInquiryStatus(id: string, status: InquiryStatus): InquiryRecord | undefined {
  ensureLoaded();
  const idx = _records.findIndex((r) => r.id === id);
  if (idx === -1) return undefined;
  const updated: InquiryRecord = {
    ..._records[idx],
    status,
    updatedAt: new Date().toISOString(),
  };
  _records = _records.map((r, i) => (i === idx ? updated : r));
  saveToStorage(_records);
  return updated;
}

/**
 * 下書きを更新する。
 */
export function updateInquiryDraft(id: string, draft: ReplyDraft): InquiryRecord | undefined {
  ensureLoaded();
  const idx = _records.findIndex((r) => r.id === id);
  if (idx === -1) return undefined;
  const updated: InquiryRecord = {
    ..._records[idx],
    draft,
    updatedAt: new Date().toISOString(),
  };
  _records = _records.map((r, i) => (i === idx ? updated : r));
  saveToStorage(_records);
  return updated;
}

/**
 * 問い合わせを削除する。
 */
export function deleteInquiry(id: string): boolean {
  ensureLoaded();
  const before = _records.length;
  _records = _records.filter((r) => r.id !== id);
  if (_records.length !== before) {
    saveToStorage(_records);
    return true;
  }
  return false;
}

/**
 * ステータスでフィルタして返す。
 */
export function listInquiriesByStatus(status: InquiryStatus): InquiryRecord[] {
  ensureLoaded();
  return _records.filter((r) => r.status === status);
}

/** テスト用リセット */
export function _resetInquiryStore(): void {
  _records = [];
  _loaded = false;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
