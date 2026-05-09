/**
 * InquiryStore — persists InquiryRecord[] to localStorage.
 *
 * Key: "laporta.genbahub.inquiries"
 * Capacity: 1000件 FIFO
 * Extends EventTarget — "inquiry-added" / "inquiry-updated" events
 */

import type { InquiryRecord, InquiryStatus, InquiryChannel, WorkCategory } from "./types.js";

const STORAGE_KEY = "laporta.genbahub.inquiries";
const MAX_RECORDS = 1000;

// ── Seed data ──────────────────────────────────────────────────────────────

function buildSeedInquiries(): InquiryRecord[] {
  const base = "2026-04-01T09:00:00+09:00";

  function makeRecord(
    id: string,
    channel: InquiryChannel,
    workCategory: WorkCategory,
    rawText: string,
    customerName: string,
    status: InquiryStatus,
    offsetDays: number,
  ): InquiryRecord {
    const dt = new Date(base);
    dt.setDate(dt.getDate() + offsetDays);
    const iso = dt.toISOString();
    return {
      id,
      channel,
      receivedAt: iso,
      rawText,
      customerName,
      customerContact: null,
      extractedRequirements: {
        workCategory,
        workScale: "medium",
        locationCity: "世田谷区",
        budgetHintJpy: null,
        desiredStartMonth: null,
        contactPreference: null,
      },
      estimatedRangeJpy: {
        lowerJpy: 1_000_000,
        upperJpy: 3_000_000,
        confidence: "low",
        basisNotes_ja: "シードデータ",
      },
      proposedSlots: [],
      draftReplyJa: "",
      status,
      priority: "normal",
      createdAt: iso,
      updatedAt: iso,
    };
  }

  return [
    makeRecord("seed-001", "hp_form", "kitchen", "キッチンのリフォームを検討しています。", "田中花子", "new", 0),
    makeRecord("seed-002", "line", "bath", "お風呂を全面的に新しくしたいです。", "佐藤一郎", "replied", 1),
    makeRecord("seed-003", "email", "full_renovation", "自宅の全面リノベーションをお願いしたいです。予算は約500万円を想定しています。", "鈴木美咲", "scheduled", 2),
    makeRecord("seed-004", "discord", "store_fit", "新しく開く飲食店の内装工事を依頼したいと思います。", "高橋剛", "triaged", 3),
    makeRecord("seed-005", "phone_memo", "office_fit", "事務所のリフォームについてご相談したいです。至急連絡ください。", "渡辺洋子", "new", 4),
    makeRecord("seed-006", "hp_form", "exterior", "外壁の修繕工事について相談したいです。", "伊藤健一", "new", 5),
    makeRecord("seed-007", "email", "repair", "クロスの貼り替えと床の補修をお願いしたいです。予算は50万円以内で。", "中村ゆみ", "replied", 6),
    makeRecord("seed-008", "line", "partial_renovation", "リビングとダイニングだけリフォームしたいです。", "小林正男", "new", 7),
    makeRecord("seed-009", "hp_form", "kitchen", "システムキッチンの交換を考えています。渋谷区在住です。", "加藤由美子", "triaged", 8),
    makeRecord("seed-010", "email", "full_renovation", "中古マンションを購入しました。全室リノベーションで1500万円程度を考えています。", "吉田大輔", "new", 9),
    makeRecord("seed-011", "discord", "store_fit", "カフェの改装工事をお願いしたいです。", "山田さくら", "closed_won", 10),
    makeRecord("seed-012", "phone_memo", "repair", "雨漏りの修理を急いでお願いしたいです。", "松本浩二", "replied", 11),
    makeRecord("seed-013", "hp_form", "bath", "ユニットバスの交換工事をお願いしたいです。目黒区です。", "井上恵子", "new", 12),
    makeRecord("seed-014", "line", "full_renovation", "戸建て住宅のフルリノベーションを計画中です。2000万円前後を想定しています。", "木村隆", "triaged", 13),
    makeRecord("seed-015", "email", "office_fit", "オフィスの内装工事を検討しています。新宿区です。", "林美枝", "new", 14),
    makeRecord("seed-016", "hp_form", "exterior", "外壁塗装と屋根の補修をセットでお願いしたいです。", "清水拓也", "closed_lost", 15),
    makeRecord("seed-017", "discord", "partial_renovation", "洗面台と洗面所全体をリフォームしたいです。", "山口ひとみ", "replied", 16),
    makeRecord("seed-018", "phone_memo", "kitchen", "キッチンとダイニングをまとめてリフォームしたい。急いでいます。", "斉藤哲夫", "new", 17),
    makeRecord("seed-019", "hp_form", "store_fit", "アパレルショップの改装工事について相談したいです。", "近藤彩花", "new", 18),
    makeRecord("seed-020", "email", "full_renovation", "実家のリフォームを考えています。世田谷区の一戸建てです。", "村田康夫", "triaged", 19),
    makeRecord("seed-021", "line", "bath", "お風呂のリフォームについて見積もりをお願いします。", "福田裕子", "replied", 20),
    makeRecord("seed-022", "hp_form", "repair", "フローリングの修繕と壁紙の張り替えをお願いしたいです。", "西村勇", "new", 21),
    makeRecord("seed-023", "discord", "kitchen", "キッチンの全面改装を検討しています。予算は150万円です。", "石川奈々", "new", 22),
    makeRecord("seed-024", "email", "office_fit", "コワーキングスペースの内装工事を依頼したいです。渋谷区です。", "宮崎健太郎", "scheduled", 23),
    makeRecord("seed-025", "phone_memo", "full_renovation", "築30年の自宅を全面リノベしたいです。至急見積お願いします。", "大野桂子", "new", 24),
    makeRecord("seed-026", "hp_form", "partial_renovation", "子供部屋のリフォームを考えています。", "藤田誠一", "new", 25),
    makeRecord("seed-027", "line", "exterior", "外壁の全面塗装をお願いしたいです。", "後藤理恵", "replied", 26),
    makeRecord("seed-028", "email", "store_fit", "ネイルサロンの新規内装工事をお願いしたいです。", "近藤美咲", "new", 27),
    makeRecord("seed-029", "hp_form", "bath", "浴室リフォームとトイレ改修をセットでお願いしたいです。", "村山智子", "triaged", 28),
    makeRecord("seed-030", "discord", "full_renovation", "マンションの全室リノベーションを検討しています。3000万円以上を想定。", "福島浩一", "new", 29),
  ];
}

// ── Store class ────────────────────────────────────────────────────────────

export class InquiryStore extends EventTarget {
  private _load(): InquiryRecord[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      return JSON.parse(raw) as InquiryRecord[];
    } catch {
      return [];
    }
  }

  private _save(records: InquiryRecord[]): void {
    try {
      const trimmed =
        records.length > MAX_RECORDS
          ? records.slice(records.length - MAX_RECORDS)
          : records;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
    } catch {
      // Silently ignore quota errors
    }
  }

  /** Ensure seed data exists (idempotent). */
  ensureSeed(): void {
    const existing = this._load();
    if (existing.length === 0) {
      this._save(buildSeedInquiries());
    }
  }

  /** Return all records. */
  all(): InquiryRecord[] {
    return this._load();
  }

  /** Return record by ID. */
  byId(id: string): InquiryRecord | null {
    return this._load().find((r) => r.id === id) ?? null;
  }

  /** Return records by status. */
  byStatus(status: InquiryStatus): InquiryRecord[] {
    return this._load().filter((r) => r.status === status);
  }

  /** Add a new record. */
  add(record: InquiryRecord): void {
    const existing = this._load();
    this._save([...existing, record]);
    this.dispatchEvent(new CustomEvent("inquiry-added", { detail: record }));
  }

  /** Update an existing record (upsert). */
  update(record: InquiryRecord): void {
    const existing = this._load();
    const idx = existing.findIndex((r) => r.id === record.id);
    if (idx >= 0) {
      existing[idx] = record;
    } else {
      existing.push(record);
    }
    this._save(existing);
    this.dispatchEvent(new CustomEvent("inquiry-updated", { detail: record }));
  }

  /** Remove all records. */
  clear(): void {
    this._save([]);
  }
}

// ── Singleton ──────────────────────────────────────────────────────────────

let _instance: InquiryStore | null = null;

export const inquiryStore: InquiryStore = new Proxy({} as InquiryStore, {
  get(_target, prop, _receiver) {
    if (!_instance) {
      _instance = new InquiryStore();
    }
    const value = Reflect.get(_instance, prop, _instance);
    return typeof value === "function" ? value.bind(_instance) : value;
  },
});

/** Reset singleton — for testing only */
export function _resetInquiryStore(): void {
  _instance = null;
}
