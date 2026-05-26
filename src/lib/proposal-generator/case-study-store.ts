/**
 * CaseStudyStore — persists CaseStudy[] to localStorage.
 *
 * Key: "laporta.proposal_cases"
 * EventTarget singleton — "cases-updated" event
 */

import type { CaseStudy, WorkCategory, WorkScale } from "./types.js";

const STORAGE_KEY = "laporta.proposal_cases";

// ── Seed data (12件) ───────────────────────────────────────────────────────

function buildSeedCases(): CaseStudy[] {
  return [
    // full_renovation
    {
      id: "case-001",
      projectName: "世田谷区戸建てフルリノベ",
      workCategory: "full_renovation",
      workScale: "large",
      scaleJa: "大規模",
      completedYearMonth: "2025-08",
      anonymizedClient: "世田谷区K様邸",
      summaryJa:
        "築35年の木造戸建てを全面リノベーション。耐震補強・断熱改修・全室内装刷新を一括施工。",
      achievementJa: "予算内+工期前倒し7日達成、施主満足度100点",
      customerVoiceJa:
        "「3Dイメージ通りの仕上がりで感動しました。職人さんの対応も丁寧で安心して任せられました。」",
    },
    {
      id: "case-002",
      projectName: "目黒区マンションフルリノベ",
      workCategory: "full_renovation",
      workScale: "medium",
      scaleJa: "中規模",
      completedYearMonth: "2025-11",
      anonymizedClient: "目黒区M様邸",
      summaryJa:
        "築20年の3LDKマンションを全室リノベ。スケルトン解体から仕上げまで自社職人で一貫施工。",
      achievementJa: "工期30日・予算5%アンダーで完工、追加工事ゼロ",
      customerVoiceJa:
        "「毎日の進捗報告が写真付きで届き、遠方からでも安心して確認できました。」",
    },
    {
      id: "case-003",
      projectName: "世田谷区中古物件フルリノベ",
      workCategory: "full_renovation",
      workScale: "small",
      scaleJa: "小規模",
      completedYearMonth: "2024-06",
      anonymizedClient: "世田谷区T様邸",
      summaryJa:
        "中古マンション購入後のコンパクトリノベ。水回り刷新＋内装全面刷新を短工期で完了。",
      achievementJa: "14日間の短工期・コスト最適化で予算10%削減",
    },
    // partial_renovation
    {
      id: "case-004",
      projectName: "渋谷区リビングダイニング改装",
      workCategory: "partial_renovation",
      workScale: "small",
      scaleJa: "小規模",
      completedYearMonth: "2025-03",
      anonymizedClient: "渋谷区S様邸",
      summaryJa:
        "リビング・ダイニングのフローリング張替え＋クロス全面刷新＋照明計画。週末施工で生活への影響を最小化。",
      achievementJa: "週末2回+平日1日の合計3日施工で完了",
      customerVoiceJa: "「短期間で別の部屋みたいになりました！」",
    },
    {
      id: "case-005",
      projectName: "港区子供部屋リフォーム",
      workCategory: "partial_renovation",
      workScale: "small",
      scaleJa: "小規模",
      completedYearMonth: "2026-01",
      anonymizedClient: "港区H様邸",
      summaryJa:
        "子供部屋2室のリフォーム。収納造作・クロス・床材の全面刷新。お子様のご希望を3Dで確認しながら設計。",
      achievementJa: "子供本人が満足した唯一の提案として採用、工期5日",
    },
    // store_fit
    {
      id: "case-006",
      projectName: "恵比寿カフェ新装工事",
      workCategory: "store_fit",
      workScale: "medium",
      scaleJa: "中規模",
      completedYearMonth: "2025-05",
      anonymizedClient: "恵比寿C社",
      summaryJa:
        "路面店カフェの全面内装工事。カウンター造作・キッチン設備・照明・床材・サイン計画まで一括請負。",
      achievementJa: "オープン前倒し3日達成・内装コスト競合比15%削減",
      customerVoiceJa: "「AIのパース通りの完成度で、お客様から毎日褒めていただいています。」",
    },
    {
      id: "case-007",
      projectName: "南青山アパレルショップ改装",
      workCategory: "store_fit",
      workScale: "large",
      scaleJa: "大規模",
      completedYearMonth: "2024-09",
      anonymizedClient: "南青山A社",
      summaryJa:
        "ハイエンドアパレルのブランドイメージに合わせた全面改装。什器造作・照明・床・什器塗装まで内装全般。",
      achievementJa: "ブランドコンセプト100%再現・開店後売上前月比+42%",
    },
    {
      id: "case-008",
      projectName: "三軒茶屋飲食店内装",
      workCategory: "store_fit",
      workScale: "small",
      scaleJa: "小規模",
      completedYearMonth: "2026-02",
      anonymizedClient: "三軒茶屋R社",
      summaryJa:
        "小規模居酒屋の新規内装。カウンター・壁面仕上げ・厨房廻り内装を短工期でスピード施工。",
      achievementJa: "7日間施工でオープン日に間に合わせ達成",
    },
    // exterior
    {
      id: "case-009",
      projectName: "世田谷区戸建て外壁塗装",
      workCategory: "exterior",
      workScale: "medium",
      scaleJa: "中規模",
      completedYearMonth: "2025-10",
      anonymizedClient: "世田谷区Y様邸",
      summaryJa:
        "築18年戸建ての外壁・屋根・付帯部塗装一式。足場仮設から養生・塗装・撤去まで自社一貫施工。",
      achievementJa: "材料コスト最適化で見積比8%削減・10年保証付き",
    },
    {
      id: "case-010",
      projectName: "大田区アパート外装改修",
      workCategory: "exterior",
      workScale: "large",
      scaleJa: "大規模",
      completedYearMonth: "2024-11",
      anonymizedClient: "大田区L社",
      summaryJa:
        "3棟アパートの外壁改修・防水工事・鉄部塗装。長期修繕計画に基づく優先順位付けで効率施工。",
      achievementJa: "3棟同時施工で工期40%短縮・入居者クレームゼロ",
    },
    // repair
    {
      id: "case-011",
      projectName: "品川区マンション補修",
      workCategory: "repair",
      workScale: "small",
      scaleJa: "小規模",
      completedYearMonth: "2025-12",
      anonymizedClient: "品川区B社",
      summaryJa:
        "クロス剥がれ・フローリング傷・建具調整・水回りパッキン交換を一括対応。退去立会後の迅速修繕。",
      achievementJa: "連絡から3日以内着工、1日施工で完了",
    },
    // kitchen
    {
      id: "case-012",
      projectName: "世田谷区キッチン全面改装",
      workCategory: "kitchen",
      workScale: "medium",
      scaleJa: "中規模",
      completedYearMonth: "2026-03",
      anonymizedClient: "世田谷区O様邸",
      summaryJa:
        "対面式システムキッチン入替え＋床・壁・天井の全面刷新。カップボード造作・食洗機・IHクッキングヒーター新設。",
      achievementJa: "工期10日・設備費含むトータルコスト競合比12%削減",
      customerVoiceJa: "「毎日料理が楽しくなりました。造作カップボードが特に気に入っています。」",
    },
  ];
}

// ── Store class ────────────────────────────────────────────────────────────

export class CaseStudyStore extends EventTarget {
  private _load(): CaseStudy[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      return JSON.parse(raw) as CaseStudy[];
    } catch {
      return [];
    }
  }

  private _persist(records: CaseStudy[]): void {
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
      this._persist(buildSeedCases());
    }
  }

  /** Return all cases. */
  getAll(): CaseStudy[] {
    return this._load();
  }

  /** Return case by ID. */
  byId(id: string): CaseStudy | null {
    return this._load().find((c) => c.id === id) ?? null;
  }

  /** Return cases by work category. */
  byCategory(category: WorkCategory): CaseStudy[] {
    return this._load().filter((c) => c.workCategory === category);
  }

  /** Return cases by work scale. */
  byScale(scale: WorkScale): CaseStudy[] {
    return this._load().filter((c) => c.workScale === scale);
  }

  /** Save a case (upsert). */
  save(caseStudy: CaseStudy): void {
    const existing = this._load();
    const idx = existing.findIndex((c) => c.id === caseStudy.id);
    if (idx >= 0) {
      existing[idx] = caseStudy;
    } else {
      existing.push(caseStudy);
    }
    this._persist(existing);
    this.dispatchEvent(new CustomEvent("cases-updated", { detail: existing }));
  }

  /** Subscribe to changes. */
  subscribe(listener: (cases: CaseStudy[]) => void): () => void {
    const handler = () => listener(this.getAll());
    this.addEventListener("cases-updated", handler);
    return () => this.removeEventListener("cases-updated", handler);
  }

  /** Remove all records. */
  clearAll(): void {
    this._persist([]);
    this.dispatchEvent(new CustomEvent("cases-updated", { detail: [] }));
  }
}

// ── Singleton ──────────────────────────────────────────────────────────────

let _instance: CaseStudyStore | null = null;

export const caseStudyStore: CaseStudyStore = new Proxy({} as CaseStudyStore, {
  get(_target, prop, _receiver) {
    if (!_instance) {
      _instance = new CaseStudyStore();
    }
    const value = Reflect.get(_instance, prop, _instance);
    return typeof value === "function" ? value.bind(_instance) : value;
  },
});

/** Reset singleton — for testing only */
export function _resetCaseStudyStore(): void {
  _instance = null;
}
