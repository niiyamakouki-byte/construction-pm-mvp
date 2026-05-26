/**
 * DealStore — persists Deal[] to localStorage.
 *
 * Key: "laporta.genbahub.deals"
 * Capacity: 1000件 FIFO
 * Extends EventTarget — "deal-added" / "deal-updated" events
 */

import type { Deal, DealStage } from "./types.js";

const STORAGE_KEY = "laporta.genbahub.deals";
const MAX_RECORDS = 1000;

// ── Seed data ──────────────────────────────────────────────────────────────

function buildSeedDeals(): Deal[] {
  const base = new Date("2026-03-01T09:00:00+09:00");

  function makeDate(offsetDays: number): string {
    const dt = new Date(base);
    dt.setDate(dt.getDate() + offsetDays);
    return dt.toISOString();
  }

  function makeCloseDate(offsetDays: number): string {
    const dt = new Date(base);
    dt.setDate(dt.getDate() + offsetDays);
    return dt.toISOString().split("T")[0];
  }

  function makeDeal(
    id: string,
    customerName: string,
    stage: DealStage,
    amountJpy: number,
    probabilityPct: number,
    offsetDays: number,
    closeDateOffset: number,
    ownerName: string,
    extra?: Partial<Deal>,
  ): Deal {
    const now = makeDate(offsetDays);
    return {
      id,
      customerName,
      currentStage: stage,
      expectedAmountJpy: amountJpy,
      probabilityPct,
      expectedCloseDate: makeCloseDate(closeDateOffset),
      ownerName,
      stageHistory: [],
      createdAt: now,
      updatedAt: now,
      ...extra,
    };
  }

  return [
    makeDeal("deal-001", "田中商事", "inquiry", 500_000, 5, 0, 60, "新山光輝"),
    makeDeal("deal-002", "佐藤設計事務所", "first_reply", 1_200_000, 15, 2, 55, "新山光輝"),
    makeDeal("deal-003", "鈴木リフォーム株式会社", "site_survey", 2_500_000, 30, 5, 50, "新山光輝"),
    makeDeal("deal-004", "高橋工業", "proposal", 3_800_000, 50, 8, 45, "新山光輝"),
    makeDeal("deal-005", "渡辺インテリア", "contract", 6_000_000, 80, 10, 30, "新山光輝"),
    makeDeal("deal-006", "伊藤建設", "kickoff", 4_500_000, 95, 12, 20, "新山光輝"),
    makeDeal("deal-007", "中村リノベーション", "won", 8_000_000, 100, 15, -10, "新山光輝", {
      wonAt: makeDate(50),
    }),
    makeDeal("deal-008", "小林設計", "lost", 3_200_000, 0, 3, 40, "新山光輝", {
      lossReason: "price",
      lostAt: makeDate(35),
    }),
    makeDeal("deal-009", "加藤デザイン", "inquiry", 700_000, 5, 1, 65, "新山光輝"),
    makeDeal("deal-010", "吉田工務店", "first_reply", 1_800_000, 15, 4, 58, "新山光輝"),
    makeDeal("deal-011", "山田リフォーム", "site_survey", 5_000_000, 30, 6, 48, "新山光輝"),
    makeDeal("deal-012", "松本建設", "proposal", 12_000_000, 50, 9, 42, "新山光輝"),
    makeDeal("deal-013", "井上インテリア", "contract", 9_500_000, 80, 11, 25, "新山光輝"),
    makeDeal("deal-014", "木村工業", "inquiry", 900_000, 5, 0, 70, "新山光輝"),
    makeDeal("deal-015", "林建築", "first_reply", 2_200_000, 15, 3, 55, "新山光輝"),
    makeDeal("deal-016", "清水デザイン事務所", "proposal", 7_500_000, 50, 7, 40, "新山光輝"),
    makeDeal("deal-017", "山口リノベ", "won", 15_000_000, 100, 20, -5, "新山光輝", {
      wonAt: makeDate(55),
    }),
    makeDeal("deal-018", "斉藤工務店", "lost", 5_500_000, 0, 5, 35, "新山光輝", {
      lossReason: "competitor",
      lostAt: makeDate(40),
    }),
    makeDeal("deal-019", "近藤設計", "site_survey", 3_300_000, 30, 8, 44, "新山光輝"),
    makeDeal("deal-020", "村田リフォーム", "inquiry", 600_000, 5, 2, 68, "新山光輝"),
    makeDeal("deal-021", "福田建設", "proposal", 20_000_000, 50, 10, 38, "新山光輝"),
    makeDeal("deal-022", "西村インテリア", "contract", 11_000_000, 80, 13, 22, "新山光輝"),
    makeDeal("deal-023", "石川工業", "first_reply", 4_000_000, 15, 5, 53, "新山光輝"),
    makeDeal("deal-024", "宮崎設計", "kickoff", 6_800_000, 95, 14, 15, "新山光輝"),
    makeDeal("deal-025", "大野リノベーション", "won", 25_000_000, 100, 25, -15, "新山光輝", {
      wonAt: makeDate(60),
    }),
    makeDeal("deal-026", "藤田工務店", "lost", 8_000_000, 0, 7, 30, "新山光輝", {
      lossReason: "schedule",
      lostAt: makeDate(45),
    }),
    makeDeal("deal-027", "後藤デザイン", "inquiry", 1_100_000, 5, 1, 72, "新山光輝"),
    makeDeal("deal-028", "近藤建設", "site_survey", 18_000_000, 30, 9, 46, "新山光輝"),
    makeDeal("deal-029", "村山リフォーム", "proposal", 4_200_000, 50, 6, 36, "新山光輝"),
    makeDeal("deal-030", "福島工業", "first_reply", 30_000_000, 15, 3, 62, "新山光輝"),
  ];
}

// ── Store class ────────────────────────────────────────────────────────────

export class DealStore extends EventTarget {
  private _load(): Deal[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      return JSON.parse(raw) as Deal[];
    } catch {
      return [];
    }
  }

  private _save(records: Deal[]): void {
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
      this._save(buildSeedDeals());
    }
  }

  /** Return all deals. */
  getAll(): Deal[] {
    return this._load();
  }

  /** Return deal by ID. */
  byId(id: string): Deal | null {
    return this._load().find((d) => d.id === id) ?? null;
  }

  /** Return deals by stage. */
  byStage(stage: DealStage): Deal[] {
    return this._load().filter((d) => d.currentStage === stage);
  }

  /** Subscribe to changes. */
  subscribe(listener: (deals: Deal[]) => void): () => void {
    const handler = () => listener(this.getAll());
    this.addEventListener("deal-added", handler);
    this.addEventListener("deal-updated", handler);
    return () => {
      this.removeEventListener("deal-added", handler);
      this.removeEventListener("deal-updated", handler);
    };
  }

  /** Save a deal (add if new, update if exists). */
  save(deal: Deal): void {
    const existing = this._load();
    const idx = existing.findIndex((d) => d.id === deal.id);
    if (idx >= 0) {
      existing[idx] = deal;
      this._save(existing);
      this.dispatchEvent(new CustomEvent("deal-updated", { detail: deal }));
    } else {
      this._save([...existing, deal]);
      this.dispatchEvent(new CustomEvent("deal-added", { detail: deal }));
    }
  }

  /** Remove all records. */
  clearAll(): void {
    this._save([]);
  }
}

// ── Singleton ──────────────────────────────────────────────────────────────

let _instance: DealStore | null = null;

export const dealStore: DealStore = new Proxy({} as DealStore, {
  get(_target, prop, _receiver) {
    if (!_instance) {
      _instance = new DealStore();
    }
    const value = Reflect.get(_instance, prop, _instance);
    return typeof value === "function" ? value.bind(_instance) : value;
  },
});

/** Reset singleton — for testing only */
export function _resetDealStore(): void {
  _instance = null;
}
