/**
 * StrengthStore — persists LaportaStrength[] to localStorage.
 *
 * Key: "laporta.proposal_strengths"
 * EventTarget singleton — "strengths-updated" event
 */

import type { LaportaStrength } from "./types.js";

const STORAGE_KEY = "laporta.proposal_strengths";

// ── Seed data (8件) ────────────────────────────────────────────────────────

function buildSeedStrengths(): LaportaStrength[] {
  return [
    {
      id: "str-001",
      titleJa: "世田谷区密着25年",
      bodyJa:
        "1999年の創業以来、世田谷区を中心に東京南西エリアで施工実績を積み重ねてきました。地域の建物特性・業者ネットワーク・行政対応のノウハウは、他社が簡単には再現できない強みです。",
      evidence: "施工実績 500件超 / 世田谷区内リピート率 68%",
      weight: 0.8,
    },
    {
      id: "str-002",
      titleJa: "内装専門特化",
      bodyJa:
        "住宅・店舗・オフィスを問わず「内装」に特化した専門施工会社です。ゼネコン下請けではなく施主直結の専門性により、中間マージンを排除しながら高品質な仕上がりを実現します。",
      evidence: "内装専門歴 25年 / 対応工種 30種以上",
      weight: 0.9,
    },
    {
      id: "str-003",
      titleJa: "自社職人多数在籍",
      bodyJa:
        "大工・左官・タイル・塗装など主要工種を自社職人で対応。外注依存を最小化することで工程管理・品質コントロール・コストダウンを同時に実現します。",
      evidence: "自社職人 12名在籍 / 主要工種の外注比率 20%以下",
      weight: 0.85,
    },
    {
      id: "str-004",
      titleJa: "アフター10年保証",
      bodyJa:
        "施工完了後10年間の無償補修保証を標準提供。保証書発行・定期点検・24時間緊急連絡対応により、長期的な安心感を提供します。",
      evidence: "アフター対応件数 年間 80件 / 保証クレーム率 1.2%",
      weight: 0.75,
    },
    {
      id: "str-005",
      titleJa: "設計AI標準装備",
      bodyJa:
        "独自の設計AI「GenbaHub CAD」により、ヒアリング内容から3D完成イメージを即日提示。お客様が着工前に仕上がりをリアルに体験できる唯一の内装会社です。",
      evidence: "AI提案導入後 受注率 +23%向上 / 変更追加工事 -35%削減",
      weight: 0.9,
    },
    {
      id: "str-006",
      titleJa: "施主LINE/Discord連携",
      bodyJa:
        "工事中の進捗をLINEまたはDiscordでリアルタイム共有。写真・動画付きの日報を毎日送信し、遠方の施主様やご多忙なオーナー様にも安心をお届けします。",
      evidence: "施主満足度調査 97点/100点 / 「連絡が丁寧」評価率 94%",
      weight: 0.7,
    },
    {
      id: "str-007",
      titleJa: "材料コストデータ自動最適化",
      bodyJa:
        "独自の材料コストデータベースで仕入先・相場を自動比較し、常に最適な材料を最適価格で調達。同品質なら他社より平均8〜15%コストダウンを実現します。",
      evidence: "材料品目 947種 管理 / 直近1年の材料コスト削減実績 平均11%",
      weight: 0.8,
    },
    {
      id: "str-008",
      titleJa: "3D完成イメージ事前共有",
      bodyJa:
        "着工前に全室の3Dパースを無料作成・共有。素材・色・レイアウトを変更しながら理想の空間を一緒に作り上げるため、「イメージと違った」というミスマッチがゼロになります。",
      evidence: "3Dパース提案 全案件標準提供 / 着工後変更工事 業界平均の1/3以下",
      weight: 0.85,
    },
  ];
}

// ── Store class ────────────────────────────────────────────────────────────

export class StrengthStore extends EventTarget {
  private _load(): LaportaStrength[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      return JSON.parse(raw) as LaportaStrength[];
    } catch {
      return [];
    }
  }

  private _persist(records: LaportaStrength[]): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
    } catch {
      // Silently ignore quota errors
    }
  }

  /** Ensure seed data exists (idempotent). */
  ensureSeed(): void {
    const existing = this._load();
    if (existing.length === 0) {
      this._persist(buildSeedStrengths());
    }
  }

  /** Return all strengths. */
  getAll(): LaportaStrength[] {
    return this._load();
  }

  /** Return strength by ID. */
  byId(id: string): LaportaStrength | null {
    return this._load().find((s) => s.id === id) ?? null;
  }

  /** Save a strength (upsert). */
  save(strength: LaportaStrength): void {
    const existing = this._load();
    const idx = existing.findIndex((s) => s.id === strength.id);
    if (idx >= 0) {
      existing[idx] = strength;
    } else {
      existing.push(strength);
    }
    this._persist(existing);
    this.dispatchEvent(new CustomEvent("strengths-updated", { detail: existing }));
  }

  /** Subscribe to changes. */
  subscribe(listener: (strengths: LaportaStrength[]) => void): () => void {
    const handler = () => listener(this.getAll());
    this.addEventListener("strengths-updated", handler);
    return () => this.removeEventListener("strengths-updated", handler);
  }

  /** Remove all records. */
  clearAll(): void {
    this._persist([]);
    this.dispatchEvent(new CustomEvent("strengths-updated", { detail: [] }));
  }
}

// ── Singleton ──────────────────────────────────────────────────────────────

let _instance: StrengthStore | null = null;

export const strengthStore: StrengthStore = new Proxy({} as StrengthStore, {
  get(_target, prop, _receiver) {
    if (!_instance) {
      _instance = new StrengthStore();
    }
    const value = Reflect.get(_instance, prop, _instance);
    return typeof value === "function" ? value.bind(_instance) : value;
  },
});

/** Reset singleton — for testing only */
export function _resetStrengthStore(): void {
  _instance = null;
}
