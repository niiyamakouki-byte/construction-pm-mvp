/**
 * suggestion-pdf-builder — OwnerSuggestion を Markdown/HTML/PDF形式で出力する。
 *
 * Sprint 18-A: 施主提案AI
 * v2-cozy カラー (#6B8E5A) を HTML に反映。
 */

import type { OwnerSuggestion, SuggestionPlan } from "./types.js";
import { PLAN_KIND_LABELS, LIFESTYLE_TAG_LABELS, PRIORITY_RANKING_LABELS } from "./types.js";
import { matchCaseStudies } from "./case-study-matcher.js";

export type SuggestionRenderTarget = "markdown" | "html" | "pdf_data";

// ── Formatters ─────────────────────────────────────────────────────────────

function formatDateJa(iso: string): string {
  const dt = new Date(iso);
  return `${dt.getFullYear()}年${dt.getMonth() + 1}月${dt.getDate()}日`;
}

function formatJpy(amount: number): string {
  return `${(amount / 10000).toFixed(0)}万円`;
}

// ── Markdown renderer ──────────────────────────────────────────────────────

export function renderSuggestionMarkdown(suggestion: OwnerSuggestion): string {
  const lines: string[] = [];
  const { ownerProfile: profile, plans } = suggestion;

  // Cover
  lines.push("# 施主提案書");
  lines.push("");
  lines.push(`**施主名**: ${profile.ownerName} 様`);
  lines.push(`**作成日**: ${formatDateJa(suggestion.generatedAt)}`);
  lines.push(`**案件ID**: ${suggestion.projectId}`);
  if (suggestion.presentedAt) {
    lines.push(`**提示日**: ${formatDateJa(suggestion.presentedAt)}`);
  }
  lines.push("");

  // Profile summary
  lines.push("## プロフィール概要");
  lines.push("");
  lines.push(`| 項目 | 内容 |`);
  lines.push(`|------|------|`);
  lines.push(`| 予算 | ${formatJpy(profile.budget)} |`);
  lines.push(`| 家族人数 | ${profile.familySize}名 |`);
  lines.push(`| 年齢帯 | ${profile.ageRange} |`);
  lines.push(`| ライフスタイル | ${profile.lifestyle.map((t) => LIFESTYLE_TAG_LABELS[t]).join("・")} |`);
  lines.push(`| 優先軸 | ${PRIORITY_RANKING_LABELS[profile.priorityRanking]} |`);
  lines.push("");

  // 3-plan comparison table
  lines.push("## 3案比較");
  lines.push("");
  lines.push(`| 項目 | ${plans[0].titleJa} | ${plans[1].titleJa} | ${plans[2].titleJa} |`);
  lines.push(`|------|------|------|------|`);
  lines.push(`| プラン種別 | ${PLAN_KIND_LABELS[plans[0].kind]} | ${PLAN_KIND_LABELS[plans[1].kind]} | ${PLAN_KIND_LABELS[plans[2].kind]} |`);
  lines.push(`| 概算費用 | ${formatJpy(plans[0].estimatedCost)} | ${formatJpy(plans[1].estimatedCost)} | ${formatJpy(plans[2].estimatedCost)} |`);
  lines.push(`| 概算工期 | ${plans[0].estimatedDays}日 | ${plans[1].estimatedDays}日 | ${plans[2].estimatedDays}日 |`);
  lines.push("");

  // Plan details
  lines.push("## 各プラン詳細");
  lines.push("");
  for (const plan of plans) {
    lines.push(`### ${plan.titleJa}（${PLAN_KIND_LABELS[plan.kind]}）`);
    lines.push("");
    lines.push(`**コンセプト**: ${plan.conceptJa}`);
    lines.push(`**費用**: ${formatJpy(plan.estimatedCost)}　**工期**: ${plan.estimatedDays}日`);
    lines.push("");
    lines.push("#### 選定根拠");
    lines.push(plan.rationaleJa);
    lines.push("");
    lines.push("#### 材料ハイライト");
    lines.push("");
    lines.push("| 箇所 | 材料 | 特徴 |");
    lines.push("|------|------|------|");
    for (const mh of plan.materialHighlights) {
      lines.push(`| ${mh.location} | ${mh.materialName} | ${mh.featureJa} |`);
    }
    lines.push("");
    lines.push("#### メンテナンス計画");
    lines.push("");
    lines.push("| 時期 | 内容 |");
    lines.push("|------|------|");
    for (const mf of plan.maintenanceForecast) {
      lines.push(`| ${mf.intervalMonths}ヶ月後 | ${mf.descriptionJa} |`);
    }
    lines.push("");
    if (plan.riskNotes.length > 0) {
      lines.push("#### リスク注記");
      for (const note of plan.riskNotes) {
        lines.push(`- ${note}`);
      }
      lines.push("");
    }

    // Similar case studies
    const cases = matchCaseStudies(profile, plan.kind);
    if (cases.length > 0) {
      lines.push("#### 類似施工事例");
      lines.push("");
      for (const c of cases) {
        lines.push(`- **${c.titleJa}** (類似度: ${Math.round(c.similarity * 100)}%)`);
        lines.push(`  ${c.summaryJa}`);
      }
      lines.push("");
    }
  }

  return lines.join("\n");
}

// ── HTML renderer ──────────────────────────────────────────────────────────

export function renderSuggestionHtml(suggestion: OwnerSuggestion): string {
  const md = renderSuggestionMarkdown(suggestion);

  const body = md
    .split("\n")
    .map((line) => {
      if (line.startsWith("# ")) return `<h1>${line.slice(2)}</h1>`;
      if (line.startsWith("## ")) return `<h2>${line.slice(3)}</h2>`;
      if (line.startsWith("### ")) return `<h3>${line.slice(4)}</h3>`;
      if (line.startsWith("#### ")) return `<h4>${line.slice(5)}</h4>`;
      if (line.startsWith("- ")) return `<li>${line.slice(2)}</li>`;
      if (line.match(/^\d+\. /)) return `<li>${line.replace(/^\d+\. /, "")}</li>`;
      if (line.startsWith("|")) {
        if (line.includes("---")) return "";
        const cells = line.split("|").filter((c) => c.trim());
        return `<tr>${cells.map((c) => `<td>${c.trim()}</td>`).join("")}</tr>`;
      }
      if (line.trim() === "") return "<br>";
      return `<p>${line}</p>`;
    })
    .join("\n");

  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="utf-8">
<title>施主提案書 — ${suggestion.ownerProfile.ownerName} 様</title>
<style>
  body { font-family: "Hiragino Sans", "Yu Gothic", sans-serif; max-width: 900px; margin: 40px auto; color: #1e293b; line-height: 1.7; }
  h1 { color: #6B8E5A; border-bottom: 3px solid #6B8E5A; padding-bottom: 10px; font-size: 1.9rem; }
  h2 { color: #374151; margin-top: 36px; border-left: 4px solid #6B8E5A; padding-left: 12px; }
  h3 { color: #4b5563; margin-top: 24px; background: #f0f4ee; padding: 8px 12px; border-radius: 4px; }
  h4 { color: #6B8E5A; margin-top: 16px; font-size: 0.95rem; }
  table { border-collapse: collapse; width: 100%; margin: 12px 0; }
  td, th { border: 1px solid #e2e8f0; padding: 8px 12px; text-align: left; }
  tr:nth-child(even) { background: #f8fafc; }
  tr:first-child { background: #e8f0e4; font-weight: bold; }
  li { margin: 4px 0; }
  p { margin: 4px 0; }
  .cover { background: #f0f4ee; border-radius: 10px; padding: 24px; margin-bottom: 28px; border-left: 6px solid #6B8E5A; }
</style>
</head>
<body>
<div class="cover">
${body}
</div>
</body>
</html>`;
}

// ── PDF data renderer ──────────────────────────────────────────────────────

export function renderSuggestionPdfData(suggestion: OwnerSuggestion): string {
  return renderSuggestionMarkdown(suggestion);
}

// ── Dispatch ──────────────────────────────────────────────────────────────

export function renderSuggestion(
  suggestion: OwnerSuggestion,
  target: SuggestionRenderTarget,
): string {
  switch (target) {
    case "markdown":
      return renderSuggestionMarkdown(suggestion);
    case "html":
      return renderSuggestionHtml(suggestion);
    case "pdf_data":
      return renderSuggestionPdfData(suggestion);
  }
}

// ── Plan comparison helper ─────────────────────────────────────────────────

export type PlanComparisonRow = {
  plan: SuggestionPlan;
  budgetGap: number;
  caseStudies: ReturnType<typeof matchCaseStudies>;
};

/**
 * 各プランに施工事例を付けた比較データを返す。
 */
export function buildPlanComparison(suggestion: OwnerSuggestion): PlanComparisonRow[] {
  return suggestion.plans.map((plan) => ({
    plan,
    budgetGap: plan.estimatedCost - suggestion.ownerProfile.budget,
    caseStudies: matchCaseStudies(suggestion.ownerProfile, plan.kind),
  }));
}
