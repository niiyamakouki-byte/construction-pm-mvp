/**
 * DifferentiationStore — persists DifferentiationPoint[] to localStorage.
 *
 * Key: "laporta.proposal_differentiation"
 * EventTarget singleton — "differentiation-updated" event
 */

import type { DifferentiationPoint } from "./types.js";

const STORAGE_KEY = "laporta.proposal_differentiation";

// ── Seed data (6軸) ────────────────────────────────────────────────────────

function buildSeedDifferentiation(): DifferentiationPoint[] {
  return [
    {
      id: "diff-001",
      axisJa: "価格",
      laportaPositionJa:
        "材料コストDB自動最適化により同品質で業界比8〜15%低価格を実現。透明性の高い明細見積を提示。",
      competitorPositionJa:
        "中間マージンが重なり最終価格が高くなる傾向。見積内訳が不透明なケースも。",
      advantageJa:
        "「安くて品質が心配」ではなく「コスト効率が良い」を証明できる根拠（材料コストDB）を持つ唯一の内装会社。",
    },
    {
      id: "diff-002",
      axisJa: "工期",
      laportaPositionJa:
        "自社職人の多能工化と工程AI管理で工期前倒し実績多数。工期遅延率 業界平均の1/4以下。",
      competitorPositionJa:
        "外注職人の調整で工程遅延が発生しやすく、工期超過が常態化している競合も多い。",
      advantageJa:
        "「いつ終わるかわからない」不安をゼロにする工程保証型の施工体制。",
    },
    {
      id: "diff-003",
      axisJa: "アフター",
      laportaPositionJa:
        "施工完了後10年間の無償補修保証を全案件に標準提供。緊急対応は24時間以内に初動。",
      competitorPositionJa:
        "1〜2年保証が一般的。有償対応になるケースも多く、連絡が取りにくい会社も存在する。",
      advantageJa:
        "業界標準の5倍以上の保証期間。長期所有・長期運用のお客様に特に支持される。",
    },
    {
      id: "diff-004",
      axisJa: "コミュニケーション",
      laportaPositionJa:
        "LINE/Discord/現場カメラで工事進捗を毎日写真付きレポート。施主が現場にいなくても安心。",
      competitorPositionJa:
        "週1〜2回の口頭報告が一般的。写真報告やリアルタイム状況共有は稀。",
      advantageJa:
        "「現場に行かないといけない」という不安を解消。遠方在住・多忙なオーナーに特に選ばれる。",
    },
    {
      id: "diff-005",
      axisJa: "設計AI",
      laportaPositionJa:
        "独自CAD AIで3D完成イメージを即日提示。素材・色・レイアウトをリアルタイムで変更して確認可能。",
      competitorPositionJa:
        "2D図面や手書きスケッチでの提案が主流。3Dパースは有料・時間がかかるケースが多い。",
      advantageJa:
        "「イメージと違った」というミスマッチを着工前にゼロにする業界唯一のAI提案。",
    },
    {
      id: "diff-006",
      axisJa: "地域密着",
      laportaPositionJa:
        "世田谷区を中心に25年の実績。地域の建物特性・職人ネットワーク・行政対応ルートを熟知。",
      competitorPositionJa:
        "大手は全国展開で地域特性への対応が薄い。地元の小規模業者はノウハウ・保証体制が限られる。",
      advantageJa:
        "大手の安心感と地域密着のきめ細かさを両立。エリア内の近隣事例も豊富。",
    },
  ];
}

// ── Store class ────────────────────────────────────────────────────────────

export class DifferentiationStore extends EventTarget {
  private _load(): DifferentiationPoint[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      return JSON.parse(raw) as DifferentiationPoint[];
    } catch {
      return [];
    }
  }

  private _persist(records: DifferentiationPoint[]): void {
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
      this._persist(buildSeedDifferentiation());
    }
  }

  /** Return all differentiation points. */
  getAll(): DifferentiationPoint[] {
    return this._load();
  }

  /** Return differentiation point by ID. */
  byId(id: string): DifferentiationPoint | null {
    return this._load().find((d) => d.id === id) ?? null;
  }

  /** Save a differentiation point (upsert). */
  save(point: DifferentiationPoint): void {
    const existing = this._load();
    const idx = existing.findIndex((d) => d.id === point.id);
    if (idx >= 0) {
      existing[idx] = point;
    } else {
      existing.push(point);
    }
    this._persist(existing);
    this.dispatchEvent(new CustomEvent("differentiation-updated", { detail: existing }));
  }

  /** Subscribe to changes. */
  subscribe(listener: (points: DifferentiationPoint[]) => void): () => void {
    const handler = () => listener(this.getAll());
    this.addEventListener("differentiation-updated", handler);
    return () => this.removeEventListener("differentiation-updated", handler);
  }

  /** Remove all records. */
  clearAll(): void {
    this._persist([]);
    this.dispatchEvent(new CustomEvent("differentiation-updated", { detail: [] }));
  }
}

// ── Singleton ──────────────────────────────────────────────────────────────

let _instance: DifferentiationStore | null = null;

export const differentiationStore: DifferentiationStore = new Proxy({} as DifferentiationStore, {
  get(_target, prop, _receiver) {
    if (!_instance) {
      _instance = new DifferentiationStore();
    }
    const value = Reflect.get(_instance, prop, _instance);
    return typeof value === "function" ? value.bind(_instance) : value;
  },
});

/** Reset singleton — for testing only */
export function _resetDifferentiationStore(): void {
  _instance = null;
}
