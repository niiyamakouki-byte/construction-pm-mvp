/**
 * 自然言語パーサー: 日本語の工事記述 → EstimateInput[] に変換
 *
 * 使用例:
 *   parseNaturalLanguage("6畳の壁紙張替え")
 *   → [{ code: "IN-005", quantity: 23 }, { code: "DM-005", quantity: 0 }] 等
 *
 *   parseNaturalLanguage("20㎡のオフィス、タイルカーペット張替え、LED照明10台")
 *   → [{ code: "IN-008", quantity: 20 }, { code: "EL-004", quantity: 10 }]
 */

import type { EstimateInput, MasterItem } from "./types";
import type { CostMaster } from "./types";
import costMasterData from "./cost-master.json";

const master: CostMaster = costMasterData as CostMaster;

// ──────────────────────────────────────────────
// 定数: 畳→㎡変換、部屋寸法推定
// ──────────────────────────────────────────────

/** 1畳 = 1.62㎡ (中京間基準) */
const TATAMI_TO_SQM = 1.62;

/** 標準天井高 (m) */
const DEFAULT_CEILING_HEIGHT = 2.4;

/**
 * 畳数から部屋の概算寸法を返す
 * 壁面積 = 周長 × 天井高、天井/床面積 = 畳数 × 1.62
 */
function roomDimensionsFromTatami(tatami: number): {
  floorArea: number;
  wallArea: number;
  ceilingArea: number;
  perimeter: number;
} {
  const floorArea = tatami * TATAMI_TO_SQM;
  // 正方形に近い部屋を想定して周長を推定
  const side = Math.sqrt(floorArea);
  const perimeter = side * 4;
  const wallArea = Math.round(perimeter * DEFAULT_CEILING_HEIGHT * 10) / 10;
  return {
    floorArea: Math.round(floorArea * 10) / 10,
    wallArea,
    ceilingArea: Math.round(floorArea * 10) / 10,
    perimeter: Math.round(perimeter * 10) / 10,
  };
}

// ──────────────────────────────────────────────
// テキスト正規化・数値抽出
// ──────────────────────────────────────────────

/** 全角数字→半角、漢数字→アラビア数字 */
function normalizeNumbers(text: string): string {
  let s = text;
  // 全角→半角
  s = s.replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0));
  // 漢数字→アラビア数字（複合漢数字対応: 二十五→25, 百二十→120 等）
  s = convertKanjiNumbers(s);
  return s;
}

/**
 * 漢数字をアラビア数字に変換する
 * 「十五」→15, 「二十」→20, 「百二十五」→125, 「三百」→300 等
 * 単独の「六」→6 も対応
 */
function convertKanjiNumbers(text: string): string {
  const kanjiDigits: Record<string, number> = {
    "〇": 0, "零": 0,
    "一": 1, "二": 2, "三": 3, "四": 4, "五": 5,
    "六": 6, "七": 7, "八": 8, "九": 9,
  };

  // 漢数字の連続部分を検出して変換
  // 百、十、一〜九 の組み合わせにマッチ
  const kanjiPattern = /[〇零一二三四五六七八九十百千]+/g;

  return text.replace(kanjiPattern, (match) => {
    // 百・十を含まない単純な1文字の場合
    if (match.length === 1 && kanjiDigits[match] !== undefined) {
      return String(kanjiDigits[match]);
    }

    let result = 0;
    let current = 0;

    for (const ch of match) {
      if (ch === "千") {
        result += (current || 1) * 1000;
        current = 0;
      } else if (ch === "百") {
        result += (current || 1) * 100;
        current = 0;
      } else if (ch === "十") {
        result += (current || 1) * 10;
        current = 0;
      } else if (kanjiDigits[ch] !== undefined) {
        current = kanjiDigits[ch];
      }
    }
    result += current;
    return String(result);
  });
}

/** テキストから面積(㎡)を抽出。畳表記があれば変換 */
function extractArea(text: string): { sqm: number; source: "tatami" | "sqm" | "tsubo" | "dimensions" } | null {
  const n = normalizeNumbers(text);

  // N畳
  const tatamiMatch = n.match(/(\d+(?:\.\d+)?)\s*畳/);
  if (tatamiMatch) {
    return { sqm: parseFloat(tatamiMatch[1]) * TATAMI_TO_SQM, source: "tatami" };
  }

  // N㎡ or N平米 or Nm2
  const sqmMatch = n.match(/(\d+(?:\.\d+)?)\s*(?:㎡|平米|m2|m²)/);
  if (sqmMatch) {
    return { sqm: parseFloat(sqmMatch[1]), source: "sqm" };
  }

  // N坪
  const tsuboMatch = n.match(/(\d+(?:\.\d+)?)\s*坪/);
  if (tsuboMatch) {
    return { sqm: parseFloat(tsuboMatch[1]) * 3.306, source: "tsubo" };
  }

  // WxH寸法表記: "5m×2.4m", "3m*2m", "5mx2.4m"
  const dimMatch = n.match(/(\d+(?:\.\d+)?)\s*m?\s*[×xX*]\s*(\d+(?:\.\d+)?)\s*m/);
  if (dimMatch) {
    const w = parseFloat(dimMatch[1]);
    const h = parseFloat(dimMatch[2]);
    return { sqm: Math.round(w * h * 100) / 100, source: "dimensions" };
  }

  return null;
}

/** テキストから寸法(W×H)を抽出（間仕切り等の壁面積計算用） */
function extractDimensions(text: string): { width: number; height: number } | null {
  const n = normalizeNumbers(text);
  const dimMatch = n.match(/(\d+(?:\.\d+)?)\s*m?\s*[×xX*]\s*(\d+(?:\.\d+)?)\s*m/);
  if (dimMatch) {
    return { width: parseFloat(dimMatch[1]), height: parseFloat(dimMatch[2]) };
  }
  return null;
}

/** テキストに「両面」が含まれるかチェック */
function hasBothSides(text: string): boolean {
  return /両面/.test(text);
}

/** テキストから畳数だけ取得 (部屋寸法推定用) */
function extractTatami(text: string): number | null {
  const n = normalizeNumbers(text);
  const m = n.match(/(\d+(?:\.\d+)?)\s*畳/);
  return m ? parseFloat(m[1]) : null;
}

/** テキストから個数を抽出: "10台", "3箇所", "5本" 等 */
function extractCount(text: string, keyword: string): number | null {
  const n = normalizeNumbers(text);
  // 数量単位 - 「面」は「三面鏡」等の誤マッチ防止のため除外
  const units = "台|個|箇所|本|枚|セット|回路|式";

  // まず、キーワードを含む句（、。,で区切られた区間）を特定して、その中で数値を探す
  // これにより「LED照明20台、エアコン3台」で「エアコン」→3、「照明」→20 と正しく抽出できる
  const clauses = n.split(/[、。,.]+/);
  for (const clause of clauses) {
    if (!clause.includes(keyword)) continue;
    // この句の中でキーワード近傍の数値を探す（キーワードに近い順で試行）
    const clausePatterns = [
      // キーワード直後の数値+単位: "エアコン3台"
      new RegExp(`${escapeRegex(keyword)}\\s*(\\d+)\\s*(?:${units})`, "i"),
      // 数値+単位+キーワード: "3台エアコン"
      new RegExp(`(\\d+)\\s*(?:${units})\\s*(?:の)?\\s*${escapeRegex(keyword)}`, "i"),
      // キーワード直後の数値（単位なし）: "エアコン3"
      new RegExp(`${escapeRegex(keyword)}\\s*(\\d+)(?!\\d)`),
      // 数値+キーワード: "3エアコン"
      new RegExp(`(\\d+)\\s*${escapeRegex(keyword)}`),
      // フォールバック: 句内の数値+単位（キーワードが同じ句にある場合のみ）
      new RegExp(`(\\d+)\\s*(?:${units})`, "i"),
    ];
    for (const pat of clausePatterns) {
      const m = clause.match(pat);
      if (m) return parseInt(m[1], 10);
    }
  }

  // 句分割でヒットしなかった場合のフォールバック（「と」で繋がった場合など）
  const fallbackPatterns = [
    new RegExp(`${escapeRegex(keyword)}\\s*(\\d+)\\s*(?:${units})`, "i"),
    new RegExp(`(\\d+)\\s*(?:${units})\\s*(?:の)?\\s*${escapeRegex(keyword)}`, "i"),
  ];
  for (const pat of fallbackPatterns) {
    const m = n.match(pat);
    if (m) return parseInt(m[1], 10);
  }
  return null;
}

/** 正規表現のメタ文字をエスケープ */
function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ──────────────────────────────────────────────
// キーワード→品目マッピング
// ──────────────────────────────────────────────

type AreaType = "floor" | "wall" | "ceiling" | "perimeter" | "count" | "fixed";

type KeywordRule = {
  keywords: string[];
  code: string;
  areaType: AreaType;
  defaultCount?: number;
  /** このルールがマッチした場合、指定コードのマッチをブロックする */
  excludes?: string[];
};

/**
 * キーワードルール定義
 * keywords: テキスト内にこれらが含まれたらマッチ
 * code: cost-masterの品目コード
 * areaType: 数量の算出方法
 *   - floor: 床面積(㎡)
 *   - wall: 壁面積(㎡)
 *   - ceiling: 天井面積(㎡)
 *   - perimeter: 周長(m) — 巾木など
 *   - count: テキストから個数抽出
 *   - fixed: 一式 (quantity=1)
 */
const KEYWORD_RULES: KeywordRule[] = [
  // --- 解体・撤去 ---
  { keywords: ["内装解体", "スケルトン"], code: "DM-001", areaType: "floor" },
  { keywords: ["間仕切り撤去", "パーティション撤去"], code: "DM-003", areaType: "wall" },
  { keywords: ["カーペット撤去", "タイルカーペット撤去"], code: "DM-005", areaType: "floor" },
  { keywords: ["フローリング撤去", "床撤去"], code: "DM-006", areaType: "floor" },
  { keywords: ["天井撤去"], code: "DM-007", areaType: "ceiling" },
  { keywords: ["産廃", "廃棄物処分"], code: "DM-008", areaType: "fixed" },
  { keywords: ["養生"], code: "DM-009", areaType: "fixed" },

  // --- 内装・仕上げ ---
  { keywords: ["間仕切り", "パーティション新設"], code: "IN-002", areaType: "wall" },
  { keywords: ["クロス", "壁紙", "壁紙張替"], code: "IN-005", areaType: "wall" },
  { keywords: ["1000番", "高級クロス", "アクセントクロス"], code: "IN-006", areaType: "wall" },
  { keywords: ["塗装", "ペンキ", "EP塗装"], code: "IN-007", areaType: "wall" },
  { keywords: ["タイルカーペット"], code: "IN-008", areaType: "floor" },
  { keywords: ["フローリング", "床張替", "床張り替え"], code: "IN-009", areaType: "floor" },
  { keywords: ["長尺シート", "長尺"], code: "IN-010", areaType: "floor" },
  { keywords: ["フロアタイル"], code: "IN-011", areaType: "floor" },
  { keywords: ["巾木"], code: "IN-012", areaType: "perimeter" },
  { keywords: ["岩綿吸音板", "ロックウール吸音板", "システム天井"], code: "IN-014", areaType: "ceiling" },
  { keywords: ["天井張替", "天井仕上げ", "天井"], code: "IN-015", areaType: "ceiling" },

  // --- 電気 ---
  { keywords: ["コンセント新設", "コンセント追加"], code: "EL-001", areaType: "count", defaultCount: 2 },
  { keywords: ["コンセント増設"], code: "EL-002", areaType: "count", defaultCount: 2 },
  { keywords: ["専用回路", "専用電源"], code: "EL-003", areaType: "count", defaultCount: 1 },
  { keywords: ["LED直管", "蛍光灯", "直管照明"], code: "EL-004", areaType: "count", defaultCount: 4 },
  { keywords: ["ダウンライト"], code: "EL-005", areaType: "count", defaultCount: 4 },
  { keywords: ["シーリングライト"], code: "EL-006", areaType: "count", defaultCount: 1 },
  { keywords: ["照明"], code: "EL-004", areaType: "count", defaultCount: 4 },
  { keywords: ["スイッチ"], code: "EL-007", areaType: "count", defaultCount: 2 },
  { keywords: ["LAN", "LAN配線"], code: "EL-009", areaType: "count", defaultCount: 2 },
  { keywords: ["インターホン"], code: "EL-011", areaType: "fixed" },
  { keywords: ["火災報知器", "火報"], code: "EL-012", areaType: "count", defaultCount: 1 },

  // --- 給排水 ---
  // タンクレスを先に判定（「タンクレストイレ」が「トイレ」にも引っかかるのを防ぐ）
  { keywords: ["タンクレス", "高級トイレ"], code: "PL-004", areaType: "count", defaultCount: 1, excludes: ["PL-003"] },
  { keywords: ["トイレ", "便器"], code: "PL-003", areaType: "count", defaultCount: 1 },
  { keywords: ["洗面台", "洗面化粧台", "洗面"], code: "PL-005", areaType: "count", defaultCount: 1 },
  { keywords: ["ユニットバス", "浴室", "お風呂"], code: "PL-007", areaType: "fixed" },
  { keywords: ["キッチン", "台所"], code: "PL-009", areaType: "fixed" },
  { keywords: ["給湯器", "ボイラー"], code: "PL-011", areaType: "count", defaultCount: 1 },
  { keywords: ["手洗い"], code: "PL-012", areaType: "count", defaultCount: 1 },

  // --- 空調 ---
  // 業務用エアコン/天カセを先に判定（「業務用エアコン」が汎用「エアコン」に引っかかるのを防ぐ）
  { keywords: ["天井カセット", "業務用エアコン", "天カセ"], code: "HV-003", areaType: "count", defaultCount: 1, excludes: ["HV-001"] },
  { keywords: ["エアコン"], code: "HV-001", areaType: "count", defaultCount: 1 },
  { keywords: ["換気扇"], code: "HV-005", areaType: "count", defaultCount: 1 },
  { keywords: ["全熱交換", "ロスナイ"], code: "HV-007", areaType: "count", defaultCount: 1 },
  { keywords: ["レンジフード"], code: "HV-008", areaType: "count", defaultCount: 1 },

  // --- 建具 ---
  { keywords: ["ドア", "建具", "フラッシュ戸"], code: "FX-001", areaType: "count", defaultCount: 1 },
  { keywords: ["引戸", "引き戸"], code: "FX-002", areaType: "count", defaultCount: 1 },
  { keywords: ["ガラスパーティション", "ガラス間仕切り"], code: "FX-006", areaType: "wall" },
  { keywords: ["カウンター", "造作カウンター"], code: "FX-007", areaType: "count", defaultCount: 1 },
  { keywords: ["棚", "可動棚"], code: "FX-008", areaType: "count", defaultCount: 1 },
  { keywords: ["クローゼット", "収納"], code: "FX-009", areaType: "fixed" },
  { keywords: ["下駄箱", "靴箱"], code: "FX-010", areaType: "fixed" },

  // --- 足場・仮設 ---
  { keywords: ["枠組足場", "外壁足場"], code: "SC-001", areaType: "wall" },
  { keywords: ["単管足場"], code: "SC-002", areaType: "wall" },
  { keywords: ["ローリングタワー", "室内足場"], code: "SC-003", areaType: "count", defaultCount: 1 },
  { keywords: ["脚立足場", "脚立"], code: "SC-004", areaType: "count", defaultCount: 1 },
  { keywords: ["養生シート", "飛散防止シート"], code: "SC-005", areaType: "wall" },
  { keywords: ["足場組立", "足場解体"], code: "SC-006", areaType: "fixed" },
  { keywords: ["足場運搬"], code: "SC-007", areaType: "fixed" },
  { keywords: ["安全ネット"], code: "SC-008", areaType: "wall" },
  { keywords: ["足場"], code: "SC-006", areaType: "fixed" },

  // --- 左官・モルタル造形 ---
  { keywords: ["モルタル塗り壁", "壁モルタル"], code: "PL2-001", areaType: "wall" },
  { keywords: ["モルタル塗り床", "床モルタル"], code: "PL2-002", areaType: "floor" },
  { keywords: ["モルタル造形木目", "木目調造形"], code: "PL2-009", areaType: "wall" },
  { keywords: ["モルタル造形石目", "石目調造形", "石壁造形"], code: "PL2-010", areaType: "wall" },
  { keywords: ["モルタル造形レンガ", "レンガ調造形", "レンガ造形"], code: "PL2-011", areaType: "wall" },
  { keywords: ["モルタル造形"], code: "PL2-009", areaType: "wall" },
  { keywords: ["エイジング塗装", "エイジング"], code: "PL2-012", areaType: "wall" },
  { keywords: ["タイル下地", "下地モルタル"], code: "PL2-005", areaType: "wall" },
  { keywords: ["セルフレベリング", "レベリング"], code: "PL2-008", areaType: "floor" },
  { keywords: ["左官", "モルタル塗り"], code: "PL2-001", areaType: "wall" },
  { keywords: ["コーナー補修"], code: "PL2-007", areaType: "count", defaultCount: 1 },
  { keywords: ["巾木モルタル"], code: "PL2-006", areaType: "perimeter" },

  // --- 諸経費 ---
  { keywords: ["クリーニング", "清掃", "美装"], code: "OH-006", areaType: "floor" },
];

// ──────────────────────────────────────────────
// パース結果
// ──────────────────────────────────────────────

export type ParsedEstimateItem = EstimateInput & {
  /** マッチしたルールの説明 */
  matchedKeyword: string;
  /** 品目名 */
  itemName: string;
  /** 数量の算出根拠 */
  quantityBasis: string;
};

export type ParseResult = {
  /** パース成功した品目 */
  items: ParsedEstimateItem[];
  /** 入力から検出した面積情報 */
  detectedArea: { sqm: number; source: string } | null;
  /** 入力から検出した畳数 */
  detectedTatami: number | null;
  /** マッチしなかったフレーズ (警告用) */
  unmatched: string[];
  /** 元の入力テキスト */
  originalText: string;
};

// ──────────────────────────────────────────────
// メインパーサー
// ──────────────────────────────────────────────

/**
 * 自然言語テキストを解析し、見積品目リストに変換する
 *
 * @param text - "6畳の壁紙張替え", "20㎡のオフィス改装、タイルカーペットとクロス張替え" 等
 * @param options - オプション設定
 * @returns ParseResult
 */
export function parseNaturalLanguage(
  text: string,
  options: {
    /** 面積が検出できない場合のデフォルト㎡ (default: 10) */
    defaultAreaSqm?: number;
    /** 天井高 (default: 2.4m) */
    ceilingHeight?: number;
    /** 自動で養生費を追加 (default: false) */
    includeProtection?: boolean;
    /** 自動でクリーニングを追加 (default: false) */
    includeCleaning?: boolean;
    /** 材料ロス率 (default: 0.05 = 5%)。面積ベースの品目に適用 */
    materialLossRate?: number;
  } = {},
): ParseResult {
  const {
    defaultAreaSqm = 10,
    ceilingHeight = DEFAULT_CEILING_HEIGHT,
    includeProtection = false,
    includeCleaning = false,
    materialLossRate = 0,
  } = options;

  const normalized = normalizeNumbers(text);
  const area = extractArea(text);
  const tatami = extractTatami(text);
  const dimensions = extractDimensions(text);
  const bothSides = hasBothSides(text);

  // 部屋寸法の推定
  let floorArea: number;
  let wallArea: number;
  let ceilingArea: number;
  let perimeter: number;

  // 寸法表記 (W×H) がある場合は壁面積として直接使用（間仕切り等向け）
  let dimensionWallArea: number | null = null;
  if (dimensions) {
    dimensionWallArea = Math.round(dimensions.width * dimensions.height * 10) / 10;
  }

  if (tatami) {
    const dims = roomDimensionsFromTatami(tatami);
    floorArea = dims.floorArea;
    wallArea = Math.round(dims.perimeter * ceilingHeight * 10) / 10;
    ceilingArea = dims.ceilingArea;
    perimeter = dims.perimeter;
  } else if (area && area.source === "dimensions") {
    // 寸法表記の場合は壁面積として扱う（部屋ではなくパーツ）
    floorArea = area.sqm;
    wallArea = area.sqm;
    ceilingArea = area.sqm;
    const side = Math.sqrt(area.sqm);
    perimeter = Math.round(side * 4 * 10) / 10;
  } else if (area) {
    floorArea = Math.round(area.sqm * 10) / 10;
    const side = Math.sqrt(area.sqm);
    perimeter = Math.round(side * 4 * 10) / 10;
    wallArea = Math.round(perimeter * ceilingHeight * 10) / 10;
    ceilingArea = floorArea;
  } else {
    floorArea = defaultAreaSqm;
    const side = Math.sqrt(defaultAreaSqm);
    perimeter = Math.round(side * 4 * 10) / 10;
    wallArea = Math.round(perimeter * ceilingHeight * 10) / 10;
    ceilingArea = defaultAreaSqm;
  }

  const items: ParsedEstimateItem[] = [];
  const matchedKeywords = new Set<string>();
  /** excludesによってブロックされたコード */
  const excludedCodes = new Set<string>();

  // 間仕切りコード一覧（壁面クロス等の両面計算で参照）
  const partitionCodes = new Set(["IN-001", "IN-002"]);

  // 天井系品目のコード一覧（具体的な天井材が先にマッチしたら汎用天井をスキップ）
  const ceilingCodes = new Set(["IN-014", "IN-015"]);

  // 各ルールをテスト（先にマッチしたものが優先）
  for (const rule of KEYWORD_RULES) {
    const matchedKw = rule.keywords.find((kw) => normalized.includes(kw));
    if (!matchedKw) continue;

    // excludesでブロックされたコードはスキップ
    if (excludedCodes.has(rule.code)) continue;

    // 同じコードが既にマッチ済みならスキップ（より具体的なルールが先にマッチ済み）
    if (items.some((i) => i.code === rule.code)) continue;

    // 天井系: 具体的な天井材(IN-014等)が既にマッチ済みなら汎用天井(IN-015)はスキップ
    if (ceilingCodes.has(rule.code) && items.some((i) => ceilingCodes.has(i.code))) continue;

    let quantity: number;
    let basis: string;

    // ロス率の適用判定（面積/周長ベースの仕上げ材に適用、解体・一式・個数には不要）
    const applyLoss = materialLossRate > 0 &&
      (rule.areaType === "floor" || rule.areaType === "wall" ||
       rule.areaType === "ceiling" || rule.areaType === "perimeter");

    switch (rule.areaType) {
      case "floor": {
        const raw = floorArea;
        quantity = Math.ceil(applyLoss ? raw * (1 + materialLossRate) : raw);
        basis = `床面積 ${floorArea}㎡` + (applyLoss ? ` (ロス${(materialLossRate * 100).toFixed(0)}%込)` : "");
        break;
      }
      case "wall": {
        // 間仕切り系の品目で寸法表記がある場合、寸法から直接面積を算出
        const useDirectWall = partitionCodes.has(rule.code) && dimensionWallArea != null;
        const effectiveWallArea = useDirectWall ? dimensionWallArea! : wallArea;
        quantity = Math.ceil(applyLoss ? effectiveWallArea * (1 + materialLossRate) : effectiveWallArea);
        basis = useDirectWall
          ? `壁面積 ${dimensionWallArea}㎡ (${dimensions!.width}m × ${dimensions!.height}m)`
          : `壁面積 ${wallArea}㎡ (周長${perimeter}m × 天井高${ceilingHeight}m)`;

        // 壁仕上げ（クロス・塗装等）で間仕切りとセットかつ両面の場合、面積を2倍
        if (!partitionCodes.has(rule.code) && bothSides && dimensionWallArea != null) {
          const doubled = dimensionWallArea * 2;
          quantity = Math.ceil(applyLoss ? doubled * (1 + materialLossRate) : doubled);
          basis = `壁面積 ${doubled}㎡ (${dimensionWallArea}㎡ × 両面)`;
        }
        if (applyLoss) basis += ` (ロス${(materialLossRate * 100).toFixed(0)}%込)`;
        break;
      }
      case "ceiling": {
        const raw = ceilingArea;
        quantity = Math.ceil(applyLoss ? raw * (1 + materialLossRate) : raw);
        basis = `天井面積 ${ceilingArea}㎡` + (applyLoss ? ` (ロス${(materialLossRate * 100).toFixed(0)}%込)` : "");
        break;
      }
      case "perimeter": {
        const raw = perimeter;
        quantity = Math.ceil(applyLoss ? raw * (1 + materialLossRate) : raw);
        basis = `周長 ${perimeter}m` + (applyLoss ? ` (ロス${(materialLossRate * 100).toFixed(0)}%込)` : "");
        break;
      }
      case "count": {
        const extracted = extractCount(normalized, matchedKw);
        quantity = extracted ?? rule.defaultCount ?? 1;
        basis = extracted ? `テキストから抽出: ${quantity}` : `デフォルト数量: ${quantity}`;
        break;
      }
      case "fixed":
        quantity = 1;
        basis = "一式";
        break;
      default:
        quantity = 1;
        basis = "不明";
    }

    // 数量が0以下の場合は警告付きでスキップせず、最低1にする
    if (quantity <= 0) {
      quantity = 1;
      basis += " (数量0→最低1に補正)";
    }

    // マスターから品目名を取得
    const masterItem = findMasterItemByCode(rule.code);
    if (!masterItem) continue;

    items.push({
      code: rule.code,
      quantity,
      matchedKeyword: matchedKw,
      itemName: masterItem.name,
      quantityBasis: basis,
    });

    matchedKeywords.add(matchedKw);

    // excludes: このルールがマッチしたら、指定コードをブロック
    if (rule.excludes) {
      for (const ex of rule.excludes) {
        excludedCodes.add(ex);
      }
    }
  }

  // オプション: 養生費自動追加
  if (includeProtection && !items.some((i) => i.code === "DM-009")) {
    const mi = findMasterItemByCode("DM-009");
    if (mi) {
      items.push({
        code: "DM-009",
        quantity: 1,
        matchedKeyword: "(自動追加)",
        itemName: mi.name,
        quantityBasis: "一式 (自動追加)",
      });
    }
  }

  // オプション: クリーニング自動追加
  if (includeCleaning && !items.some((i) => i.code === "OH-006")) {
    const mi = findMasterItemByCode("OH-006");
    if (mi) {
      items.push({
        code: "OH-006",
        quantity: Math.ceil(floorArea),
        matchedKeyword: "(自動追加)",
        itemName: mi.name,
        quantityBasis: `床面積 ${floorArea}㎡ (自動追加)`,
      });
    }
  }

  // マッチしなかったフレーズの抽出（簡易: 句読点・読点で分割して未マッチを検出）
  const phrases = normalized.split(/[、。,.\s]+/).filter((p) => p.length > 0);

  // 面積+場所の複合フレーズを無視するパターン
  // "20坪のオフィスのリノベーション" → 面積情報が含まれている記述は場所+総称として無視
  const areaLocationPattern = /\d+(?:畳|㎡|平米|坪|m2|m²).*(?:の|リノベ|リフォーム|改装|改修|工事)/;
  // 「壁は」「床は」「天井は」のような助詞付き対象指定
  const surfaceRefPattern = /^(?:壁|床|天井)(?:は|の|を|も)/;

  const unmatched = phrases.filter((phrase) => {
    // 数値や面積の記述だけのフレーズは無視
    if (/^\d+(?:畳|㎡|平米|坪|台|箇所|本)$/.test(phrase)) return false;
    // 寸法表記 (5m×2.4m 等) を無視
    if (/^\d+(?:\.\d+)?\s*m?\s*[×xX*]\s*\d+(?:\.\d+)?\s*m$/.test(phrase)) return false;
    // "両面PB" 等の修飾フレーズを無視
    if (/^両面/.test(phrase)) return false;
    // 純粋な数字フレーズを無視
    if (/^\d+(?:\.\d+)?m?$/.test(phrase)) return false;
    // 面積+場所の複合フレーズ（"20坪のオフィスのリノベーション"等）は無視
    if (areaLocationPattern.test(phrase)) return false;
    // 「壁はクロス」等の対象指定は品目がマッチ済みなら無視
    if (surfaceRefPattern.test(phrase) && items.length > 0) return false;
    // 面積情報なしの純粋な場所名フレーズ（"6畳の洋室"等）は数値+場所のパターンで無視
    if (/^\d+(?:畳|㎡|坪)の(?:洋室|和室|リビング|ダイニング|玄関|廊下|寝室|子供部屋|書斎|オフィス|事務所|店舗|会議室|応接室|受付|ホール)/.test(phrase)) return false;
    // いずれかのキーワードにマッチしていればOK
    return !KEYWORD_RULES.some((rule) => rule.keywords.some((kw) => phrase.includes(kw)));
  });

  return {
    items,
    detectedArea: area,
    detectedTatami: tatami,
    unmatched,
    originalText: text,
  };
}

/**
 * 自然言語 → EstimateInput[] のシンプルなラッパー
 * generateEstimate() に直接渡せる形式を返す
 */
export function nlToEstimateInputs(text: string): EstimateInput[] {
  const result = parseNaturalLanguage(text);
  return result.items.map(({ code, quantity }) => ({ code, quantity }));
}

/**
 * パース結果を人間が読める形式で表示
 */
export function formatParseResult(result: ParseResult): string {
  const lines: string[] = [];

  lines.push(`入力: "${result.originalText}"`);

  if (result.detectedTatami) {
    lines.push(`検出: ${result.detectedTatami}畳 (${(result.detectedTatami * TATAMI_TO_SQM).toFixed(1)}㎡)`);
  } else if (result.detectedArea) {
    lines.push(`検出: ${result.detectedArea.sqm.toFixed(1)}㎡ (${result.detectedArea.source})`);
  }

  lines.push("");

  if (result.items.length === 0) {
    lines.push("マッチした品目がありません。");
  } else {
    lines.push("マッチした品目:");
    for (const item of result.items) {
      const mi = findMasterItemByCode(item.code);
      const unitPrice = mi?.unitPrice ?? 0;
      const amount = unitPrice * item.quantity;
      lines.push(
        `  ${item.code} ${item.itemName}  ${item.quantity}${mi?.unit ?? ""}  @${unitPrice.toLocaleString()}  = ${amount.toLocaleString()}円`,
      );
      lines.push(`         根拠: ${item.quantityBasis} [キーワード: "${item.matchedKeyword}"]`);
    }
  }

  if (result.unmatched.length > 0) {
    lines.push("");
    lines.push("未マッチ:");
    for (const u of result.unmatched) {
      lines.push(`  - "${u}"`);
    }
  }

  return lines.join("\n");
}

// ──────────────────────────────────────────────
// ヘルパー
// ──────────────────────────────────────────────

function findMasterItemByCode(code: string): (MasterItem & { categoryId: string; categoryName: string }) | undefined {
  for (const cat of master.categories) {
    const item = cat.items.find((i) => i.code === code);
    if (item) return { ...item, categoryId: cat.id, categoryName: cat.name };
  }
  return undefined;
}
