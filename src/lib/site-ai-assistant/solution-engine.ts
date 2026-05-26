/**
 * 現場AIチャットアシスタント — ソリューションエンジン (Sprint 12-A)
 *
 * Issue を受け取り、過去事例DB+rule_based fallback から
 * 最大3件の Solution を生成して AssistantResponse として返す。
 * 外部API/LLM不使用。
 */

import { classifyIssue } from "./issue-classifier.js";
import type { PastCaseStore } from "./case-store.js";
import { RULE_BASED_GUIDES } from "./rule-based-fallback.js";
import type { Issue, Solution, AssistantResponse, PastCase } from "./types.js";

// ── メイン関数 ────────────────────────────────────────────────────────────────

export function suggestSolutions(issue: Issue, store: PastCaseStore): AssistantResponse {
  // 1) カテゴリ確定
  const category = classifyIssue(issue.text);

  // 2) カテゴリ + キーワード検索でスコアリング
  const byCategory = store.findByCategory(category);
  const byKeyword = store.searchByKeywords(issue.text, 20);

  // カテゴリ一致 + キーワードスコアを合算してユニークにする
  const scoreMap = new Map<string, { pastCase: PastCase; score: number }>();

  // カテゴリ一致は基礎スコア 1.5
  for (const pc of byCategory) {
    scoreMap.set(pc.id, { pastCase: pc, score: 1.5 });
  }

  // キーワードスコアを加算
  for (const { pastCase, score } of byKeyword) {
    const existing = scoreMap.get(pastCase.id);
    if (existing) {
      existing.score += score;
    } else {
      scoreMap.set(pastCase.id, { pastCase, score });
    }
  }

  // 3) 上位3件を Solution 化
  const ranked = [...scoreMap.values()].sort((a, b) => {
    // スコア降順、同スコアなら satisfaction 降順
    if (b.score !== a.score) return b.score - a.score;
    return b.pastCase.satisfaction - a.pastCase.satisfaction;
  });

  const top3 = ranked.slice(0, 3);

  if (top3.length > 0) {
    const solutions: Solution[] = top3.map(({ pastCase, score }) => ({
      id: `sol-${pastCase.id}-${issue.id}`,
      issueId: issue.id,
      source: "past_case" as const,
      summary: pastCase.solutionSummary,
      steps: buildStepsFromSolution(pastCase.solutionSummary),
      confidence: calcConfidence(score, pastCase.satisfaction, ranked[0].score),
      referencedCaseIds: [pastCase.id],
    }));

    return {
      issueId: issue.id,
      suggestedSolutions: solutions,
      generatedAt: new Date().toISOString(),
    };
  }

  // 4) ヒット0件は rule_based fallback
  const guide = RULE_BASED_GUIDES[category];
  const fallbackSolution: Solution = {
    id: `sol-fallback-${category}-${issue.id}`,
    issueId: issue.id,
    source: "rule_based" as const,
    summary: guide.summary,
    steps: guide.steps,
    confidence: 0.4, // fallback は固定で低め
    referencedCaseIds: [],
  };

  return {
    issueId: issue.id,
    suggestedSolutions: [fallbackSolution],
    generatedAt: new Date().toISOString(),
    fallbackMessage:
      "過去事例が見つかりませんでした。一般的なガイドラインを表示しています。",
  };
}

// ── ヘルパー ─────────────────────────────────────────────────────────────────

/**
 * solutionSummary の文章をシンプルな step 配列に変換する。
 * 「。」で分割し、「N. テキスト」形式に整形する。
 */
function buildStepsFromSolution(solutionSummary: string): string[] {
  const parts = solutionSummary
    .split(/[。\n]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  if (parts.length === 0) return [solutionSummary];
  return parts.map((part, i) => `${i + 1}. ${part}`);
}

/**
 * confidence を 0-1 に正規化する。
 * score: 生スコア (高いほど良い)
 * satisfaction: 1-5
 * maxScore: ランキング最大スコア (正規化基準)
 */
function calcConfidence(score: number, satisfaction: number, maxScore: number): number {
  const normalizedScore = maxScore > 0 ? score / maxScore : 0;
  const normalizedSatisfaction = (satisfaction - 1) / 4; // 1-5 → 0-1
  // スコア70% + 満足度30%
  const raw = normalizedScore * 0.7 + normalizedSatisfaction * 0.3;
  // 0.3 ~ 0.95 の範囲にクリップ
  return Math.min(0.95, Math.max(0.3, Math.round(raw * 100) / 100));
}
