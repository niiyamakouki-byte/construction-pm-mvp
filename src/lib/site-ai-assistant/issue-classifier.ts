/**
 * 現場AIチャットアシスタント — 課題分類器 (Sprint 12-A)
 *
 * 純Regexベースのカテゴリ分類。LLM/外部API不使用。
 */

import { IssueCategory } from "./types.js";

// ── キーワード辞書 ───────────────────────────────────────────────────────────

const CATEGORY_KEYWORDS: Array<{ category: IssueCategory; keywords: string[] }> = [
  {
    category: IssueCategory.material_shortage,
    keywords: ["足りない", "欠品", "在庫", "不足", "材料がない", "品切れ", "調達"],
  },
  {
    category: IssueCategory.weather_delay,
    keywords: ["雨", "雪", "台風", "天候", "風", "嵐", "悪天候", "天気"],
  },
  {
    category: IssueCategory.tool_breakdown,
    keywords: ["壊れた", "故障", "使えない", "動かない", "修理", "破損", "不動"],
  },
  {
    category: IssueCategory.coordination,
    keywords: ["連絡", "調整", "伝わってない", "指示", "情報共有", "連携", "打ち合わせ", "確認"],
  },
  {
    category: IssueCategory.safety_concern,
    keywords: ["危険", "ヒヤリ", "事故", "ケガ", "けが", "安全", "リスク", "ハット"],
  },
  {
    category: IssueCategory.quality_issue,
    keywords: ["不具合", "やり直し", "汚れ", "傷", "品質", "欠陥", "ミス", "失敗"],
  },
  {
    category: IssueCategory.client_request,
    keywords: ["施主", "お客様", "要望", "変更", "クレーム", "依頼", "追加工事", "仕様変更"],
  },
];

// ── 分類関数 ─────────────────────────────────────────────────────────────────

/**
 * テキストからIssueCategory を判定する。
 * 最初にマッチしたカテゴリを返す。マッチなしは `other`。
 */
export function classifyIssue(text: string): IssueCategory {
  for (const entry of CATEGORY_KEYWORDS) {
    for (const keyword of entry.keywords) {
      if (text.includes(keyword)) {
        return entry.category;
      }
    }
  }
  return IssueCategory.other;
}
