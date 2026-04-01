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
  // 漢数字（単純なもの）
  const kanjiMap: Record<string, string> = {
    "一": "1", "二": "2", "三": "3", "四": "4", "五": "5",
    "六": "6", "七": "7", "八": "8", "九": "9", "十": "10",
    "百": "100",
  };
  for (const [k, v] of Object.entries(kanjiMap)) {
    s = s.replaceAll(k, v);
  }
  return s;
}

/** テキストから面積(㎡)を抽出。畳表記があれば変換 */
function extractArea(text: string): { sqm: number; source: "tatami" | "sqm" | "tsubo" } | null {
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

  return null;
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
  // キーワード前後の数字を探す
  const patterns = [
    new RegExp(`(\\d+)\\s*(?:台|個|箇所|本|枚|セット|面|回路|式).*${keyword}`, "i"),
    new RegExp(`${keyword}.*?(\\d+)\\s*(?:台|個|箇所|本|枚|セット|面|回路|式)`, "i"),
    new RegExp(`(\\d+)\\s*${keyword}`),
    new RegExp(`${keyword}\\s*(\\d+)`),
  ];
  for (const pat of patterns) {
    const m = n.match(pat);
    if (m) return parseInt(m[1], 10);
  }
  return null;
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
  { keywords: ["天井張替", "天井", "天井仕上げ"], code: "IN-015", areaType: "ceiling" },

  // --- 電気 ---
  { keywords: ["コンセント新設", "コンセント追加"], code: "EL-001", areaType: "count", defaultCount: 2 },
  { keywords: ["コンセント増設"], code: "EL-002", areaType: "count", defaultCount: 2 },
  { keywords: ["専用回路", "専用電源"], code: "EL-003", areaType: "count", defaultCount: 1 },
  { keywords: ["LED直管", "蛍光灯", "直管照明"], code: "EL-004", areaType: "count", defaultCount: 4 },
  { keywords: ["ダウンライト"], code: "EL-005", areaType: "count", defaultCount: 4 },
  { keywords: ["シーリング", "シーリングライト"], code: "EL-006", areaType: "count", defaultCount: 1 },
  { keywords: ["照明"], code: "EL-004", areaType: "count", defaultCount: 4 },
  { keywords: ["スイッチ"], code: "EL-007", areaType: "count", defaultCount: 2 },
  { keywords: ["LAN", "LAN配線"], code: "EL-009", areaType: "count", defaultCount: 2 },
  { keywords: ["インターホン"], code: "EL-011", areaType: "fixed" },
  { keywords: ["火災報知器", "火報"], code: "EL-012", areaType: "count", defaultCount: 1 },

  // --- 給排水 ---
  { keywords: ["トイレ", "便器"], code: "PL-003", areaType: "count", defaultCount: 1 },
  { keywords: ["タンクレス", "高級トイレ"], code: "PL-004", areaType: "count", defaultCount: 1 },
  { keywords: ["洗面台", "洗面化粧台", "洗面"], code: "PL-005", areaType: "count", defaultCount: 1 },
  { keywords: ["ユニットバス", "浴室", "お風呂"], code: "PL-007", areaType: "fixed" },
  { keywords: ["キッチン", "台所"], code: "PL-009", areaType: "fixed" },
  { keywords: ["給湯器", "ボイラー"], code: "PL-011", areaType: "count", defaultCount: 1 },
  { keywords: ["手洗い"], code: "PL-012", areaType: "count", defaultCount: 1 },

  // --- 空調 ---
  { keywords: ["エアコン"], code: "HV-001", areaType: "count", defaultCount: 1 },
  { keywords: ["天井カセット", "業務用エアコン", "天カセ"], code: "HV-003", areaType: "count", defaultCount: 1 },
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
  } = {},
): ParseResult {
  const {
    defaultAreaSqm = 10,
    ceilingHeight = DEFAULT_CEILING_HEIGHT,
    includeProtection = false,
    includeCleaning = false,
  } = options;

  const normalized = normalizeNumbers(text);
  const area = extractArea(text);
  const tatami = extractTatami(text);

  // 部屋寸法の推定
  let floorArea: number;
  let wallArea: number;
  let ceilingArea: number;
  let perimeter: number;

  if (tatami) {
    const dims = roomDimensionsFromTatami(tatami);
    floorArea = dims.floorArea;
    wallArea = Math.round(dims.perimeter * ceilingHeight * 10) / 10;
    ceilingArea = dims.ceilingArea;
    perimeter = dims.perimeter;
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

  // 各ルールをテスト（先にマッチしたものが優先）
  for (const rule of KEYWORD_RULES) {
    const matchedKw = rule.keywords.find((kw) => normalized.includes(kw));
    if (!matchedKw) continue;

    // 同じコードが既にマッチ済みならスキップ（より具体的なルールが先にマッチ済み）
    if (items.some((i) => i.code === rule.code)) continue;

    let quantity: number;
    let basis: string;

    switch (rule.areaType) {
      case "floor":
        quantity = Math.ceil(floorArea);
        basis = `床面積 ${floorArea}㎡`;
        break;
      case "wall":
        quantity = Math.ceil(wallArea);
        basis = `壁面積 ${wallArea}㎡ (周長${perimeter}m × 天井高${ceilingHeight}m)`;
        break;
      case "ceiling":
        quantity = Math.ceil(ceilingArea);
        basis = `天井面積 ${ceilingArea}㎡`;
        break;
      case "perimeter":
        quantity = Math.ceil(perimeter);
        basis = `周長 ${perimeter}m`;
        break;
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
  const unmatched = phrases.filter((phrase) => {
    // 数値や面積の記述だけのフレーズは無視
    if (/^\d+(?:畳|㎡|平米|坪|台|箇所|本)$/.test(phrase)) return false;
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
