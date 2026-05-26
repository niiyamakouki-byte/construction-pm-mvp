/**
 * 現場AIチャットアシスタント — 過去事例ストア (Sprint 12-A)
 *
 * localStorage `genbahub:past-cases` に最大1000件を保持 (FIFO)。
 * EventTarget でストア変更を購読できる。
 * 外部API不使用。純粋なローカルストレージ操作。
 */

import { IssueCategory } from "./types.js";
import type { PastCase } from "./types.js";

// ── 定数 ─────────────────────────────────────────────────────────────────────

export const STORAGE_KEY = "genbahub:past-cases";
const MAX_CASES = 1000;

// ── シードデータ (各カテゴリ 2-3件、計20件) ────────────────────────────────

export function getSeedCases(): PastCase[] {
  return [
    // material_shortage × 3
    {
      id: "seed-ms-1",
      category: IssueCategory.material_shortage,
      problemSummary: "フロア材が20枚不足。納品が3日後になると判明",
      solutionSummary: "代替品を近隣材木店で即日調達し、別工程を先行させて工期を守った",
      projectContext: "マンションリフォーム",
      resolvedAt: "2024-03-10T12:00:00Z",
      satisfaction: 4,
    },
    {
      id: "seed-ms-2",
      category: IssueCategory.material_shortage,
      problemSummary: "クロスの在庫欠品。メーカー廃番品で同柄の入手不可",
      solutionSummary: "施主にカラーサンプルを提示し、代替柄を当日合意。翌日施工再開",
      projectContext: "戸建てリフォーム",
      resolvedAt: "2024-05-22T09:00:00Z",
      satisfaction: 5,
    },
    {
      id: "seed-ms-3",
      category: IssueCategory.material_shortage,
      problemSummary: "タイルが不足、追加発注したが納期2週間",
      solutionSummary: "別の施工エリアを優先着工。タイル到着後、残エリアを一気に完工",
      projectContext: "店舗改装",
      resolvedAt: "2024-07-15T15:00:00Z",
      satisfaction: 3,
    },
    // weather_delay × 3
    {
      id: "seed-wd-1",
      category: IssueCategory.weather_delay,
      problemSummary: "台風接近で外壁塗装が3日間中断",
      solutionSummary: "雨天中は屋内の内装工事を前倒しで実施し、全体工期への影響をゼロにした",
      projectContext: "戸建て新築",
      resolvedAt: "2024-09-05T18:00:00Z",
      satisfaction: 5,
    },
    {
      id: "seed-wd-2",
      category: IssueCategory.weather_delay,
      problemSummary: "連日の雨でコンクリート打設が遅延",
      solutionSummary: "テント養生を設置して打設を強行判断。品質検査合格",
      projectContext: "RC造建築",
      resolvedAt: "2024-11-20T10:00:00Z",
      satisfaction: 4,
    },
    {
      id: "seed-wd-3",
      category: IssueCategory.weather_delay,
      problemSummary: "雪で資材搬入トラックが来られず",
      solutionSummary: "4WD軽トラで小分け搬入。施工順序を変更して対応",
      projectContext: "店舗改装",
      resolvedAt: "2025-01-15T14:00:00Z",
      satisfaction: 3,
    },
    // tool_breakdown × 2
    {
      id: "seed-tb-1",
      category: IssueCategory.tool_breakdown,
      problemSummary: "コンプレッサーが突然停止。エア工具が全滅",
      solutionSummary: "近隣のレンタル業者から代替機を2時間で手配。昼休み中に復旧",
      projectContext: "木造住宅建築",
      resolvedAt: "2024-06-12T13:00:00Z",
      satisfaction: 5,
    },
    {
      id: "seed-tb-2",
      category: IssueCategory.tool_breakdown,
      problemSummary: "レーザー墨出し器のバッテリー劣化で使用不可",
      solutionSummary: "水平器と下げ振りで代替作業。翌日新品を調達",
      projectContext: "オフィスリフォーム",
      resolvedAt: "2024-08-01T17:00:00Z",
      satisfaction: 4,
    },
    // coordination × 2
    {
      id: "seed-co-1",
      category: IssueCategory.coordination,
      problemSummary: "電気工事業者への変更指示が未伝達で配線ルートが間違い",
      solutionSummary: "全業者に現場確認の場を設け、変更図面を配布。手直しコストは元請け負担で合意",
      projectContext: "マンション改装",
      resolvedAt: "2024-04-18T16:00:00Z",
      satisfaction: 3,
    },
    {
      id: "seed-co-2",
      category: IssueCategory.coordination,
      problemSummary: "朝の指示が職人に届かず、別の場所で作業していた",
      solutionSummary: "グループLINEを作成し、作業指示をテキストで毎朝送信するルールを制定",
      projectContext: "戸建てリフォーム",
      resolvedAt: "2024-10-05T11:00:00Z",
      satisfaction: 5,
    },
    // safety_concern × 2
    {
      id: "seed-sc-1",
      category: IssueCategory.safety_concern,
      problemSummary: "足場上での作業中に安全帯未着用の職人を発見",
      solutionSummary: "作業即時停止。全員に安全帯着用を指導し、翌朝KYミーティングで徹底",
      projectContext: "外壁修繕",
      resolvedAt: "2024-05-30T08:00:00Z",
      satisfaction: 5,
    },
    {
      id: "seed-sc-2",
      category: IssueCategory.safety_concern,
      problemSummary: "床開口部の養生板がずれてヒヤリハット",
      solutionSummary: "開口部を金物で固定。ヒヤリハット記録票に記入し展開",
      projectContext: "RC造建築",
      resolvedAt: "2024-07-20T09:30:00Z",
      satisfaction: 4,
    },
    // quality_issue × 3
    {
      id: "seed-qi-1",
      category: IssueCategory.quality_issue,
      problemSummary: "塗装仕上げにムラが発生。施主から指摘",
      solutionSummary: "該当箇所を全面再塗装。施主立会いで仕上がり確認後合意",
      projectContext: "戸建て外壁塗装",
      resolvedAt: "2024-03-25T15:00:00Z",
      satisfaction: 4,
    },
    {
      id: "seed-qi-2",
      category: IssueCategory.quality_issue,
      problemSummary: "フローリングの目地が揃っておらずやり直しが必要",
      solutionSummary: "張り直し前に施工手順書を再確認。新人職人に先輩が並走して品質確保",
      projectContext: "マンションリフォーム",
      resolvedAt: "2024-06-08T16:00:00Z",
      satisfaction: 3,
    },
    {
      id: "seed-qi-3",
      category: IssueCategory.quality_issue,
      problemSummary: "タイル目地に気泡が入り、防水性能に懸念",
      solutionSummary: "専門業者に目地補修を依頼。防水検査をクリアして引渡し",
      projectContext: "浴室改装",
      resolvedAt: "2024-09-12T14:00:00Z",
      satisfaction: 4,
    },
    // client_request × 3
    {
      id: "seed-cr-1",
      category: IssueCategory.client_request,
      problemSummary: "施主から壁の色を変更したいと当日依頼",
      solutionSummary: "変更依頼書に署名をもらい、追加費用3万円で翌日対応。施主満足",
      projectContext: "戸建てリフォーム",
      resolvedAt: "2024-04-02T17:00:00Z",
      satisfaction: 5,
    },
    {
      id: "seed-cr-2",
      category: IssueCategory.client_request,
      problemSummary: "工事中にコンセント追加を要望",
      solutionSummary: "電気工事業者と連携し、追加2口を翌日施工。費用を工事変更書で精算",
      projectContext: "マンションリフォーム",
      resolvedAt: "2024-08-14T13:00:00Z",
      satisfaction: 5,
    },
    {
      id: "seed-cr-3",
      category: IssueCategory.client_request,
      problemSummary: "施主が仕様書と違う扉を希望。発注済み品の変更が必要",
      solutionSummary: "メーカーに未製作を確認。ギリギリ変更可能で追加費用5万円で合意",
      projectContext: "店舗新築",
      resolvedAt: "2024-11-01T11:00:00Z",
      satisfaction: 4,
    },
    // other × 2
    {
      id: "seed-ot-1",
      category: IssueCategory.other,
      problemSummary: "近隣住民から騒音クレームが入った",
      solutionSummary: "作業時間を9-17時に制限し、防音シートを追加設置。クレーム解消",
      projectContext: "戸建て新築",
      resolvedAt: "2024-10-22T18:00:00Z",
      satisfaction: 4,
    },
    {
      id: "seed-ot-2",
      category: IssueCategory.other,
      problemSummary: "解体中に想定外のアスベスト含有材が発見",
      solutionSummary: "作業即時停止。専門業者にアスベスト除去を依頼し、工期を2週間延長して対応",
      projectContext: "マンション改装",
      resolvedAt: "2024-12-10T12:00:00Z",
      satisfaction: 3,
    },
  ];
}

// ── PastCaseStore ────────────────────────────────────────────────────────────

export class PastCaseStore extends EventTarget {
  private cases: PastCase[] = [];

  constructor() {
    super();
    this.load();
  }

  // ── 永続化 ────────────────────────────────────────────────────────────────

  private load(): void {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        this.cases = [];
        return;
      }
      this.cases = JSON.parse(raw) as PastCase[];
    } catch {
      this.cases = [];
    }
  }

  private save(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.cases));
      this.dispatchEvent(new Event("change"));
    } catch {
      // localStorage が使えない環境 (テスト) では無視
    }
  }

  // ── CRUD ──────────────────────────────────────────────────────────────────

  addCase(pastCase: PastCase): void {
    this.cases.push(pastCase);
    // FIFO: 1000件超えたら古いものから削除
    if (this.cases.length > MAX_CASES) {
      this.cases = this.cases.slice(this.cases.length - MAX_CASES);
    }
    this.save();
  }

  removeCase(id: string): void {
    this.cases = this.cases.filter((c) => c.id !== id);
    this.save();
  }

  getAll(): PastCase[] {
    return [...this.cases];
  }

  // ── 検索 ─────────────────────────────────────────────────────────────────

  findByCategory(category: IssueCategory): PastCase[] {
    return this.cases.filter((c) => c.category === category);
  }

  /**
   * テキストに含まれるキーワードでスコアリングして降順で返す。
   * スコア = problemSummary + solutionSummary に含まれる文字数のヒット数。
   */
  searchByKeywords(text: string, topN = 10): Array<{ pastCase: PastCase; score: number }> {
    // 2文字以上の部分文字列を抽出 (bigram的な簡易手法)
    const tokens = extractTokens(text);
    if (tokens.length === 0) return [];

    const scored = this.cases.map((c) => {
      const haystack = `${c.problemSummary} ${c.solutionSummary} ${c.projectContext ?? ""}`;
      let score = 0;
      for (const token of tokens) {
        if (haystack.includes(token)) score++;
      }
      return { pastCase: c, score };
    });

    return scored
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, topN);
  }

  // ── シード ────────────────────────────────────────────────────────────────

  seed(): void {
    const seeds = getSeedCases();
    for (const s of seeds) {
      if (!this.cases.find((c) => c.id === s.id)) {
        this.addCase(s);
      }
    }
  }

  clear(): void {
    this.cases = [];
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
    this.dispatchEvent(new Event("change"));
  }
}

// ── シングルトン ──────────────────────────────────────────────────────────────

let _instance: PastCaseStore | null = null;

export function getPastCaseStore(): PastCaseStore {
  if (!_instance) {
    _instance = new PastCaseStore();
  }
  return _instance;
}

/** テスト用にシングルトンをリセット */
export function resetPastCaseStore(): void {
  _instance = null;
}

// ── ユーティリティ ────────────────────────────────────────────────────────────

/**
 * テキストからトークン(2文字以上のサブストリング)を抽出する。
 * 単純にスペース・句読点で分割し、2文字以上のものを返す。
 */
function extractTokens(text: string): string[] {
  // 改行・スペース・句読点で分割
  const parts = text.split(/[\s、。，．・「」【】\[\]（）()]/);
  const tokens: string[] = [];
  for (const part of parts) {
    const trimmed = part.trim();
    if (trimmed.length >= 2) {
      tokens.push(trimmed);
    }
  }
  // 重複排除
  return [...new Set(tokens)];
}
