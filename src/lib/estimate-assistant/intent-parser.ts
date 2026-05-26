/**
 * AI見積アシスタント — 自然言語インテントパーサー
 *
 * LLM不使用。ルールベース(regex+辞書)のみ。外部API課金ゼロ。
 */

// ── 型定義 ──────────────────────────────────────────────────────────────────

export type RoomType =
  | "LDK"
  | "和室"
  | "寝室"
  | "水回り"
  | "外壁"
  | "屋根"
  | "玄関"
  | "洗面"
  | "トイレ"
  | "浴室"
  | "廊下";

export type AreaUnit = "畳" | "㎡" | "坪";

export type Grade = "high" | "mid" | "low";

export type EstimateIntent = {
  roomType?: RoomType;
  area?: { value: number; unit: AreaUnit };
  grade?: Grade;
  tasks: string[];
  rawText: string;
};

// ── 辞書定義 ────────────────────────────────────────────────────────────────

const ROOM_TYPE_MAP: Array<{ patterns: RegExp; type: RoomType }> = [
  { patterns: /LDK|リビング|ダイニング|居間/, type: "LDK" },
  { patterns: /和室|畳部屋|和風/, type: "和室" },
  { patterns: /寝室|ベッドルーム|主寝室/, type: "寝室" },
  { patterns: /水回り|水廻り|キッチン|台所|お風呂|浴槽|洗面所|洗面台/, type: "水回り" },
  { patterns: /外壁|外装|外観/, type: "外壁" },
  { patterns: /屋根|屋上|ルーフ/, type: "屋根" },
  { patterns: /玄関|エントランス/, type: "玄関" },
  { patterns: /洗面/, type: "洗面" },
  { patterns: /トイレ|便所|WC/, type: "トイレ" },
  { patterns: /浴室|風呂/, type: "浴室" },
  { patterns: /廊下|ホール/, type: "廊下" },
];

// グレード語彙→Grade
const GRADE_HIGH_PATTERNS =
  /松|ハイ|ハイグレード|高級|プレミアム|最高|上質|上グレード|高め|いいもの|こだわり|贅沢/;
const GRADE_LOW_PATTERNS =
  /梅|エコノミー|節約|安め|コスパ|格安|安く|低価格|お手頃|できるだけ安|最低限/;
const GRADE_MID_PATTERNS =
  /竹|標準|スタンダード|普通|一般|中間|バランス|お任せ|おまかせ|ふつう/;

// 工種キーワード
const TASK_PATTERNS: Array<{ pattern: RegExp; task: string }> = [
  { pattern: /塗装|塗り替え|ペンキ/, task: "塗装" },
  { pattern: /張替|張り替え|貼り替え|クロス/, task: "クロス張替" },
  { pattern: /解体|撤去|壊す|取り壊し/, task: "解体" },
  { pattern: /設備|エアコン|給湯器|換気/, task: "設備工事" },
  { pattern: /床材|フローリング|床/, task: "床工事" },
  { pattern: /壁紙|クロス/, task: "壁紙" },
  { pattern: /タイル|石材/, task: "タイル工事" },
  { pattern: /水道|給排水/, task: "給排水工事" },
  { pattern: /電気|配線|コンセント/, task: "電気工事" },
  { pattern: /防水/, task: "防水工事" },
  { pattern: /左官|モルタル/, task: "左官工事" },
  { pattern: /リノベーション|リフォーム|改装|改修/, task: "リノベーション" },
];

// 面積単位パターン
const AREA_PATTERNS: Array<{ pattern: RegExp; unit: AreaUnit }> = [
  { pattern: /(\d+(?:\.\d+)?)\s*畳/, unit: "畳" },
  { pattern: /(\d+(?:\.\d+)?)\s*㎡/, unit: "㎡" },
  { pattern: /(\d+(?:\.\d+)?)\s*平米/, unit: "㎡" },
  { pattern: /(\d+(?:\.\d+)?)\s*坪/, unit: "坪" },
];

// ── パーサー実装 ─────────────────────────────────────────────────────────────

/**
 * 自然言語メッセージから EstimateIntent を抽出する。
 * LLM不使用、ルールベースのみ。
 */
export function parseIntent(message: string): EstimateIntent {
  const text = message.trim();

  const roomType = extractRoomType(text);
  const area = extractArea(text);
  const grade = extractGrade(text);
  const tasks = extractTasks(text);

  return {
    ...(roomType !== undefined && { roomType }),
    ...(area !== undefined && { area }),
    ...(grade !== undefined && { grade }),
    tasks,
    rawText: text,
  };
}

function extractRoomType(text: string): RoomType | undefined {
  for (const { patterns, type } of ROOM_TYPE_MAP) {
    if (patterns.test(text)) return type;
  }
  return undefined;
}

function extractArea(text: string): { value: number; unit: AreaUnit } | undefined {
  for (const { pattern, unit } of AREA_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      const value = parseFloat(match[1]);
      if (!isNaN(value) && value > 0) {
        return { value, unit };
      }
    }
  }
  return undefined;
}

function extractGrade(text: string): Grade | undefined {
  // 高グレード判定を先に行う（「高めの標準」等の曖昧表現に対応）
  if (GRADE_HIGH_PATTERNS.test(text)) return "high";
  if (GRADE_LOW_PATTERNS.test(text)) return "low";
  if (GRADE_MID_PATTERNS.test(text)) return "mid";
  return undefined;
}

function extractTasks(text: string): string[] {
  const found = new Set<string>();
  for (const { pattern, task } of TASK_PATTERNS) {
    if (pattern.test(text)) found.add(task);
  }
  return Array.from(found);
}

// ── 面積換算ユーティリティ ───────────────────────────────────────────────────

/** 任意単位を ㎡ に換算する */
export function convertToSqM(value: number, unit: AreaUnit): number {
  switch (unit) {
    case "㎡":
      return value;
    case "畳":
      return Math.round(value * 1.62 * 100) / 100; // 1畳 = 1.62㎡
    case "坪":
      return Math.round(value * 3.305785 * 100) / 100; // 1坪 = 3.30578㎡
  }
}
