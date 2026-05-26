/**
 * requirement-extractor — 日本語キーワード辞書ベースの要件抽出.
 * LLM呼び出しなし、ルールベースのみ。
 */

import type { ExtractedRequirements, WorkCategory, WorkScale } from "./types.js";

// ── Work category keywords ─────────────────────────────────────────────────

const WORK_CATEGORY_PATTERNS: Array<{ category: WorkCategory; keywords: string[] }> = [
  {
    category: "kitchen",
    keywords: ["キッチン", "台所", "システムキッチン", "流し台", "調理台"],
  },
  {
    category: "bath",
    keywords: ["お風呂", "浴室", "バス", "ユニットバス", "風呂", "バスルーム", "浴槽"],
  },
  {
    category: "store_fit",
    keywords: ["店舗", "ショップ", "飲食店", "カフェ", "レストラン", "美容室", "サロン", "ネイル", "アパレル", "テナント"],
  },
  {
    category: "office_fit",
    keywords: ["事務所", "オフィス", "コワーキング", "事務室", "会議室", "執務"],
  },
  {
    category: "exterior",
    keywords: ["外壁", "屋根", "外装", "塗装", "雨漏り", "防水"],
  },
  {
    category: "repair",
    keywords: ["補修", "修繕", "修理", "直し", "クロス", "壁紙", "床板", "フローリング補修", "小修繕"],
  },
  {
    category: "full_renovation",
    keywords: ["全面リノベ", "フルリノベ", "全室", "全面改装", "スケルトン", "全面リフォーム", "フルリフォーム"],
  },
  {
    category: "partial_renovation",
    keywords: ["部分リフォーム", "一部リフォーム", "部分改装", "一部改装", "リビング", "ダイニング", "洗面", "子供部屋"],
  },
];

// ── Work scale keywords ────────────────────────────────────────────────────

/** 金額 (万円) を文字列から抽出する正規表現 */
const BUDGET_PATTERN = /(\d+(?:\.\d+)?)\s*万円?/g;

function extractBudgetFromText(text: string): number | null {
  const matches = [...text.matchAll(BUDGET_PATTERN)];
  if (matches.length === 0) return null;
  // 最初の金額を使用
  const val = parseFloat(matches[0][1]);
  return Math.round(val * 10_000);
}

function inferWorkScale(text: string, budgetHint: number | null): WorkScale {
  // 「全面」「フル」 → large 方向
  if (/全面|フルリノベ|フルリフォーム|スケルトン/.test(text)) {
    if (budgetHint !== null) {
      if (budgetHint >= 20_000_000) return "extra_large";
      if (budgetHint >= 5_000_000) return "large";
      if (budgetHint >= 1_000_000) return "medium";
    }
    return "large";
  }
  if (budgetHint !== null) {
    if (budgetHint >= 20_000_000) return "extra_large";
    if (budgetHint >= 5_000_000) return "large";
    if (budgetHint >= 1_000_000) return "medium";
    return "small";
  }
  if (/一部|部分|小規模/.test(text)) return "small";
  return "medium";
}

// ── Location keywords ──────────────────────────────────────────────────────

const LOCATION_PATTERNS: string[] = [
  "千代田区", "中央区", "港区", "新宿区", "文京区", "台東区",
  "墨田区", "江東区", "品川区", "目黒区", "大田区", "世田谷区",
  "渋谷区", "中野区", "杉並区", "豊島区", "北区", "荒川区",
  "板橋区", "練馬区", "足立区", "葛飾区", "江戸川区",
  "立川市", "武蔵野市", "三鷹市", "府中市", "調布市", "町田市",
  "小金井市", "国分寺市", "国立市",
];

function extractLocation(text: string): string | null {
  for (const loc of LOCATION_PATTERNS) {
    if (text.includes(loc)) return loc;
  }
  return null;
}

// ── Desired start month ────────────────────────────────────────────────────

function extractDesiredStartMonth(text: string, today: Date = new Date()): number | null {
  const currentMonth = today.getMonth() + 1; // 1-12
  const currentYear = today.getFullYear();

  // 具体的な月数表現 「来月」「3ヶ月後」「2ヶ月後」
  const nextMonthMatch = /来月/.test(text);
  if (nextMonthMatch) return ((currentMonth % 12) + 1);

  const monthsLaterMatch = text.match(/(\d+)\s*[ヶか]月後/);
  if (monthsLaterMatch) {
    const offset = parseInt(monthsLaterMatch[1], 10);
    return ((currentMonth - 1 + offset) % 12) + 1;
  }

  // 具体的な月表記 「3月」「来年3月」など
  const concreteMonthMatch = text.match(/(\d{1,2})\s*月(?:\s*(?:頃|ごろ|から)?)/);
  if (concreteMonthMatch) {
    const m = parseInt(concreteMonthMatch[1], 10);
    if (m >= 1 && m <= 12) return m;
  }

  // 季節表現
  if (/春/.test(text)) return 4;
  if (/夏/.test(text)) return 7;
  if (/秋/.test(text)) return 10;
  if (/冬/.test(text)) return 1;

  // 年内
  if (/年内/.test(text)) return 12;

  // 年明け・来年
  if (/年明け|来年/.test(text)) {
    // 来年1月
    void currentYear; // suppress unused warning
    return 1;
  }

  return null;
}

// ── Contact preference ─────────────────────────────────────────────────────

function extractContactPreference(
  text: string,
): "email" | "phone" | "line" | "discord" | null {
  if (/メール|mail|Mail/.test(text)) return "email";
  if (/電話|TEL|tel|お電話/.test(text)) return "phone";
  if (/LINE|ライン/.test(text)) return "line";
  if (/Discord|ディスコード/.test(text)) return "discord";
  return null;
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * 日本語テキストから施主要件を抽出する (ルールベース).
 * 抽出できない場合は各フィールドが null / default 値になる。
 */
export function extractRequirements(
  rawText: string,
  today?: Date,
): ExtractedRequirements {
  const budgetHintJpy = extractBudgetFromText(rawText);

  // Work category — 最初にマッチしたカテゴリを使用
  let workCategory: WorkCategory = "other";
  for (const { category, keywords } of WORK_CATEGORY_PATTERNS) {
    if (keywords.some((kw) => rawText.includes(kw))) {
      workCategory = category;
      break;
    }
  }

  // full_renovation を後から上書き (全面キーワードが優先)
  if (/全面リノベ|フルリノベ|全面リフォーム|フルリフォーム|スケルトン|全室リノベ/.test(rawText)) {
    workCategory = "full_renovation";
  }

  const workScale = inferWorkScale(rawText, budgetHintJpy);
  const locationCity = extractLocation(rawText);
  const desiredStartMonth = extractDesiredStartMonth(rawText, today);
  const contactPreference = extractContactPreference(rawText);

  return {
    workCategory,
    workScale,
    locationCity,
    budgetHintJpy,
    desiredStartMonth,
    contactPreference,
  };
}
