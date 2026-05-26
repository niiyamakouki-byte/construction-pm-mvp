import {
  generateAndSaveArticle,
  getStrategy,
  registerCompletion,
  reportToGbp as syncReportToGbp,
  trackSerp as trackProjectSerp,
} from "../lib/local-seo/local-seo-facade.js";
import type { CompletionProjectMeta, RegionScope } from "../lib/local-seo/types.js";

const DEFAULT_REGION: RegionScope = "city_setagaya";

function defaultMeta(projectId: string): CompletionProjectMeta {
  return {
    siteName: projectId,
    workPart: "interior renovation",
    areaSqm: 50,
    durationDays: 30,
    beforePhotoCount: 0,
    afterPhotoCount: 0,
    completedAt: new Date().toISOString(),
  };
}

function ensureStrategy(projectId: string) {
  return getStrategy(projectId) ?? registerCompletion(projectId, defaultMeta(projectId), DEFAULT_REGION).strategy;
}

export async function recommendKeywords(projectId: string) {
  const existing = getStrategy(projectId);
  const result = existing
    ? { strategy: existing, allKeywords: existing.recommendedKeywords, top5: existing.recommendedKeywords }
    : registerCompletion(projectId, defaultMeta(projectId), DEFAULT_REGION);
  return result.top5;
}

export async function generateArticle(input: { project_id: string; primary_keyword: string }) {
  const strategy = ensureStrategy(input.project_id);
  const secondaryKeywords = strategy.recommendedKeywords
    .map((keyword) => keyword.keyword)
    .filter((keyword) => keyword !== input.primary_keyword)
    .slice(0, 3);
  return generateAndSaveArticle(input.project_id, input.primary_keyword, secondaryKeywords);
}

export async function trackSerp(projectId: string) {
  ensureStrategy(projectId);
  return trackProjectSerp(projectId);
}

export async function reportToGbp(projectId: string) {
  ensureStrategy(projectId);
  return syncReportToGbp(projectId);
}
