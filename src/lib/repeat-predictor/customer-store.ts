/**
 * CustomerStore — persists CustomerJobHistory[] to localStorage.
 *
 * Key: "laporta.genbahub.customer_history"
 * Capacity: 1000顧客
 * Extends EventTarget so consumers can addEventListener('customer-updated', handler).
 */

import type { CustomerJobHistory, CustomerJob } from "./types.js";

const STORAGE_KEY = "laporta.genbahub.customer_history";
const MAX_CUSTOMERS = 1000;

// ── Seed data ──────────────────────────────────────────────────────────────

function makeJob(
  id: string,
  completedAt: string,
  revenueYen: number,
  marginPct: number,
  satisfactionScore: number | null,
  hasComplaint: boolean,
  isReferral: boolean,
): CustomerJob {
  return { jobId: id, completedAt, revenueYen, marginPct, satisfactionScore, hasComplaint, isReferral };
}

function buildSeedCustomers(): CustomerJobHistory[] {
  return [
    {
      customerId: "cust-001",
      customerName: "田中建設株式会社",
      jobs: [
        makeJob("j001", "2023-01-15", 3200000, 28, 5, false, false),
        makeJob("j002", "2023-07-20", 2800000, 30, 5, false, true),
        makeJob("j003", "2024-02-10", 4100000, 32, 4, false, true),
        makeJob("j004", "2024-08-05", 3600000, 29, 5, false, false),
        makeJob("j005", "2025-01-20", 3900000, 31, 5, false, true),
      ],
      totalLifetimeValue: 17600000,
    },
    {
      customerId: "cust-002",
      customerName: "佐藤工務店",
      jobs: [
        makeJob("j006", "2022-06-01", 1500000, 25, 4, false, false),
        makeJob("j007", "2023-01-15", 1800000, 27, 4, false, false),
        makeJob("j008", "2023-09-10", 2100000, 26, 4, false, true),
        makeJob("j009", "2024-05-20", 1900000, 28, 5, false, false),
      ],
      totalLifetimeValue: 7300000,
    },
    {
      customerId: "cust-003",
      customerName: "鈴木インテリア",
      jobs: [
        makeJob("j010", "2021-03-01", 800000, 20, 3, true, false),
        makeJob("j011", "2022-05-15", 950000, 22, 3, false, false),
        makeJob("j012", "2023-08-20", 1100000, 24, 4, false, false),
        makeJob("j013", "2024-11-01", 1200000, 25, 4, false, false),
      ],
      totalLifetimeValue: 4050000,
    },
    {
      customerId: "cust-004",
      customerName: "高橋設計事務所",
      jobs: [
        makeJob("j014", "2020-04-01", 5000000, 35, 5, false, true),
        makeJob("j015", "2021-02-15", 6200000, 37, 5, false, true),
        makeJob("j016", "2022-01-10", 5800000, 36, 5, false, true),
        makeJob("j017", "2022-11-05", 6500000, 38, 5, false, true),
        makeJob("j018", "2023-09-20", 7100000, 36, 5, false, true),
        makeJob("j019", "2024-07-15", 6800000, 37, 5, false, true),
      ],
      totalLifetimeValue: 37400000,
    },
    {
      customerId: "cust-005",
      customerName: "伊藤リフォーム",
      jobs: [
        makeJob("j020", "2023-03-10", 650000, 18, 2, true, false),
        makeJob("j021", "2024-01-20", 700000, 20, 3, true, false),
      ],
      totalLifetimeValue: 1350000,
    },
    {
      customerId: "cust-006",
      customerName: "渡辺建築設計",
      jobs: [
        makeJob("j022", "2021-08-01", 4200000, 30, 5, false, true),
        makeJob("j023", "2022-06-15", 3900000, 31, 4, false, false),
        makeJob("j024", "2023-04-20", 4600000, 32, 5, false, true),
        makeJob("j025", "2024-02-10", 4300000, 30, 5, false, true),
        makeJob("j026", "2024-12-05", 4800000, 33, 5, false, true),
      ],
      totalLifetimeValue: 21800000,
    },
    {
      customerId: "cust-007",
      customerName: "中村商事",
      jobs: [
        makeJob("j027", "2022-11-01", 2300000, 26, 4, false, false),
        makeJob("j028", "2023-10-15", 2500000, 27, 4, false, false),
        makeJob("j029", "2024-09-20", 2700000, 28, 4, false, false),
      ],
      totalLifetimeValue: 7500000,
    },
    {
      customerId: "cust-008",
      customerName: "小林物産",
      jobs: [
        makeJob("j030", "2020-01-15", 1200000, 22, 3, false, false),
      ],
      totalLifetimeValue: 1200000,
    },
    {
      customerId: "cust-009",
      customerName: "加藤インテリアデザイン",
      jobs: [
        makeJob("j031", "2023-06-01", 3100000, 29, 5, false, true),
        makeJob("j032", "2024-03-15", 3400000, 31, 5, false, true),
        makeJob("j033", "2024-10-20", 3200000, 30, 5, false, false),
      ],
      totalLifetimeValue: 9700000,
    },
    {
      customerId: "cust-010",
      customerName: "吉田工業",
      jobs: [
        makeJob("j034", "2022-02-01", 900000, 19, 2, true, false),
        makeJob("j035", "2023-01-10", 850000, 18, 2, true, false),
      ],
      totalLifetimeValue: 1750000,
    },
    {
      customerId: "cust-011",
      customerName: "山田設計",
      jobs: [
        makeJob("j036", "2024-06-01", 1800000, 27, 4, false, false),
        makeJob("j037", "2025-01-15", 2000000, 28, 4, false, false),
      ],
      totalLifetimeValue: 3800000,
    },
    {
      customerId: "cust-012",
      customerName: "松本建設",
      jobs: [
        makeJob("j038", "2021-05-01", 3500000, 28, 4, false, true),
        makeJob("j039", "2022-04-15", 3800000, 29, 4, false, false),
        makeJob("j040", "2023-03-20", 4000000, 30, 5, false, true),
        makeJob("j041", "2024-01-10", 4200000, 31, 5, false, true),
        makeJob("j042", "2024-11-05", 4500000, 32, 5, false, true),
      ],
      totalLifetimeValue: 20000000,
    },
    {
      customerId: "cust-013",
      customerName: "井上不動産",
      jobs: [
        makeJob("j043", "2023-09-01", 2200000, 25, 4, false, false),
      ],
      totalLifetimeValue: 2200000,
    },
    {
      customerId: "cust-014",
      customerName: "木村内装",
      jobs: [
        makeJob("j044", "2022-07-01", 1600000, 24, 3, false, false),
        makeJob("j045", "2023-05-15", 1700000, 25, 3, false, false),
        makeJob("j046", "2024-04-20", 1900000, 26, 4, false, false),
      ],
      totalLifetimeValue: 5200000,
    },
    {
      customerId: "cust-015",
      customerName: "林建築事務所",
      jobs: [
        makeJob("j047", "2020-03-01", 2800000, 27, 4, false, true),
        makeJob("j048", "2021-01-15", 3000000, 28, 4, false, false),
        makeJob("j049", "2021-11-20", 3200000, 29, 5, false, true),
        makeJob("j050", "2022-10-05", 3400000, 30, 5, false, true),
        makeJob("j051", "2023-08-20", 3600000, 31, 5, false, true),
        makeJob("j052", "2024-07-10", 3800000, 32, 5, false, true),
      ],
      totalLifetimeValue: 19800000,
    },
    {
      customerId: "cust-016",
      customerName: "清水商店",
      jobs: [
        makeJob("j053", "2021-10-01", 500000, 15, 2, true, false),
        makeJob("j054", "2022-08-15", 550000, 16, 1, true, false),
        makeJob("j055", "2023-07-20", 600000, 17, 2, true, false),
      ],
      totalLifetimeValue: 1650000,
    },
    {
      customerId: "cust-017",
      customerName: "山口建材",
      jobs: [
        makeJob("j056", "2024-09-01", 2400000, 28, 4, false, false),
        makeJob("j057", "2025-02-15", 2600000, 29, 5, false, true),
      ],
      totalLifetimeValue: 5000000,
    },
    {
      customerId: "cust-018",
      customerName: "斉藤インテリア",
      jobs: [
        makeJob("j058", "2019-06-01", 700000, 20, 3, false, false),
      ],
      totalLifetimeValue: 700000,
    },
    {
      customerId: "cust-019",
      customerName: "松田工務店",
      jobs: [
        makeJob("j059", "2022-12-01", 3700000, 30, 5, false, true),
        makeJob("j060", "2023-11-15", 4000000, 31, 5, false, true),
        makeJob("j061", "2024-10-20", 4300000, 32, 5, false, true),
      ],
      totalLifetimeValue: 12000000,
    },
    {
      customerId: "cust-020",
      customerName: "岡田設計",
      jobs: [
        makeJob("j062", "2023-04-01", 1300000, 23, 3, true, false),
        makeJob("j063", "2024-02-15", 1400000, 24, 3, true, false),
      ],
      totalLifetimeValue: 2700000,
    },
    {
      customerId: "cust-021",
      customerName: "橋本建設",
      jobs: [
        makeJob("j064", "2021-02-01", 5500000, 34, 5, false, true),
        makeJob("j065", "2022-01-15", 5800000, 35, 5, false, true),
        makeJob("j066", "2022-12-20", 6100000, 36, 5, false, true),
        makeJob("j067", "2023-11-05", 6400000, 37, 5, false, true),
        makeJob("j068", "2024-09-20", 6700000, 38, 5, false, true),
      ],
      totalLifetimeValue: 30500000,
    },
    {
      customerId: "cust-022",
      customerName: "西村リフォーム",
      jobs: [
        makeJob("j069", "2023-07-01", 1100000, 23, 4, false, false),
        makeJob("j070", "2024-06-15", 1200000, 24, 4, false, false),
      ],
      totalLifetimeValue: 2300000,
    },
    {
      customerId: "cust-023",
      customerName: "石川建築",
      jobs: [
        makeJob("j071", "2020-08-01", 4800000, 33, 5, false, true),
        makeJob("j072", "2021-07-15", 5000000, 34, 5, false, true),
        makeJob("j073", "2022-06-20", 5200000, 35, 5, false, true),
        makeJob("j074", "2023-05-05", 5400000, 36, 5, false, true),
        makeJob("j075", "2024-04-20", 5600000, 37, 5, false, true),
        makeJob("j076", "2025-01-10", 5800000, 38, 5, false, true),
      ],
      totalLifetimeValue: 31800000,
    },
    {
      customerId: "cust-024",
      customerName: "宮崎商事",
      jobs: [
        makeJob("j077", "2022-03-01", 2000000, 26, 4, false, false),
      ],
      totalLifetimeValue: 2000000,
    },
    {
      customerId: "cust-025",
      customerName: "大野内装",
      jobs: [
        makeJob("j078", "2024-01-01", 1600000, 25, 4, false, false),
        makeJob("j079", "2024-11-15", 1800000, 26, 4, false, false),
      ],
      totalLifetimeValue: 3400000,
    },
    {
      customerId: "cust-026",
      customerName: "藤田工業",
      jobs: [
        makeJob("j080", "2021-09-01", 2600000, 27, 3, true, false),
        makeJob("j081", "2022-07-15", 2700000, 26, 3, true, false),
        makeJob("j082", "2023-06-20", 2800000, 28, 4, false, false),
      ],
      totalLifetimeValue: 8100000,
    },
    {
      customerId: "cust-027",
      customerName: "後藤設計事務所",
      jobs: [
        makeJob("j083", "2023-02-01", 3300000, 30, 5, false, true),
        makeJob("j084", "2023-12-15", 3500000, 31, 5, false, true),
        makeJob("j085", "2024-10-20", 3700000, 32, 5, false, true),
      ],
      totalLifetimeValue: 10500000,
    },
    {
      customerId: "cust-028",
      customerName: "近藤建設",
      jobs: [
        makeJob("j086", "2019-01-01", 1000000, 21, 3, false, false),
      ],
      totalLifetimeValue: 1000000,
    },
    {
      customerId: "cust-029",
      customerName: "村田インテリア",
      jobs: [
        makeJob("j087", "2024-05-01", 2900000, 29, 5, false, true),
        makeJob("j088", "2025-01-20", 3100000, 30, 5, false, true),
      ],
      totalLifetimeValue: 6000000,
    },
    {
      customerId: "cust-030",
      customerName: "福田工務店",
      jobs: [
        makeJob("j089", "2022-10-01", 1400000, 23, 2, true, false),
        makeJob("j090", "2023-08-15", 1500000, 24, 2, true, false),
        makeJob("j091", "2024-07-20", 1600000, 25, 3, false, false),
      ],
      totalLifetimeValue: 4500000,
    },
  ];
}

// ── Store class ────────────────────────────────────────────────────────────

export class CustomerStore extends EventTarget {
  private _load(): CustomerJobHistory[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      return JSON.parse(raw) as CustomerJobHistory[];
    } catch {
      return [];
    }
  }

  private _save(histories: CustomerJobHistory[]): void {
    try {
      const trimmed =
        histories.length > MAX_CUSTOMERS
          ? histories.slice(histories.length - MAX_CUSTOMERS)
          : histories;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
    } catch {
      // Silently ignore quota errors
    }
  }

  /** Ensure seed data exists (idempotent). */
  ensureSeed(): void {
    const existing = this._load();
    if (existing.length === 0) {
      this._save(buildSeedCustomers());
    }
  }

  /** Return all customer histories. */
  all(): CustomerJobHistory[] {
    return this._load();
  }

  /** Return customer history by ID. */
  byId(customerId: string): CustomerJobHistory | null {
    return this._load().find((c) => c.customerId === customerId) ?? null;
  }

  /** Add or replace a customer history, persist, and emit 'customer-updated'. */
  upsert(history: CustomerJobHistory): void {
    const existing = this._load();
    const index = existing.findIndex((c) => c.customerId === history.customerId);
    if (index >= 0) {
      existing[index] = history;
    } else {
      existing.push(history);
    }
    this._save(existing);
    this.dispatchEvent(new CustomEvent("customer-updated", { detail: history }));
  }

  /** Remove all customer histories. */
  clear(): void {
    this._save([]);
  }
}

// ── Singleton ──────────────────────────────────────────────────────────────

let _instance: CustomerStore | null = null;

export const customerStore: CustomerStore = new Proxy({} as CustomerStore, {
  get(_target, prop, _receiver) {
    if (!_instance) {
      _instance = new CustomerStore();
    }
    const value = Reflect.get(_instance, prop, _instance);
    return typeof value === "function" ? value.bind(_instance) : value;
  },
});

/** Reset singleton — for testing only */
export function _resetCustomerStore(): void {
  _instance = null;
}
