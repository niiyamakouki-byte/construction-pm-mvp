/**
 * portfolio-local-seo-metrics.test.ts — Sprint 19-B
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

// ── localStorage mock ──────────────────────────────────────────────────────

const _ls: Record<string, string> = {};
vi.stubGlobal("localStorage", {
  getItem: (k: string) => _ls[k] ?? null,
  setItem: (k: string, v: string) => { _ls[k] = v; },
  removeItem: (k: string) => { delete _ls[k]; },
  clear: () => { for (const k of Object.keys(_ls)) delete _ls[k]; },
});

import {
  publishedArticleCount,
  top10KeywordCount,
  estimatedMonthlySearchImpressions,
  gbpActionCount,
} from "../portfolio-local-seo-metrics.js";
import { runFullWorkflow } from "../local-seo-facade.js";
import { _resetLocalSeoFacade } from "../local-seo-facade.js";
import { _resetLocalSeoStore } from "../local-seo-store.js";
import { _resetKeywordCounter } from "../keyword-recommender.js";
import { _resetSnapshotCounter } from "../serp-tracker.js";
import { _resetArticleCounter } from "../article-generator.js";
import { _resetGbpActionCount } from "../gbp-syncer.js";
import type { CompletionProjectMeta } from "../types.js";

const SAMPLE_META: CompletionProjectMeta = {
  siteName: "世田谷区松原3丁目マンション",
  workPart: "内装リノベーション",
  areaSqm: 75,
  durationDays: 45,
  beforePhotoCount: 8,
  afterPhotoCount: 7,
  completedAt: "2026-04-01T00:00:00.000Z",
};

const NOW = new Date("2026-05-09T10:00:00.000Z");

beforeEach(() => {
  _resetLocalSeoFacade();
  _resetLocalSeoStore();
  _resetKeywordCounter();
  _resetSnapshotCounter();
  _resetArticleCounter();
  _resetGbpActionCount();
  localStorage.clear();
});

describe("publishedArticleCount", () => {
  it("初期値は 0", () => {
    expect(publishedArticleCount()).toBe(0);
  });

  it("runFullWorkflow 後は 1 以上", () => {
    runFullWorkflow("proj-001", SAMPLE_META, "city_setagaya", "local_purchase", 30, NOW, true);
    expect(publishedArticleCount()).toBeGreaterThanOrEqual(1);
  });
});

describe("top10KeywordCount", () => {
  it("初期値は 0", () => {
    expect(top10KeywordCount()).toBe(0);
  });

  it("runFullWorkflow 30日後は 1 以上", () => {
    runFullWorkflow("proj-001", SAMPLE_META, "city_setagaya", "local_purchase", 30, NOW, true);
    expect(top10KeywordCount()).toBeGreaterThanOrEqual(1);
  });
});

describe("estimatedMonthlySearchImpressions", () => {
  it("初期値は 0", () => {
    expect(estimatedMonthlySearchImpressions()).toBe(0);
  });

  it("TOP10 KW がある場合は正の数", () => {
    runFullWorkflow("proj-001", SAMPLE_META, "city_setagaya", "local_purchase", 30, NOW, true);
    const impressions = estimatedMonthlySearchImpressions();
    // TOP10 KW が 1 件以上あれば impressions > 0
    if (top10KeywordCount() > 0) {
      expect(impressions).toBeGreaterThan(0);
    } else {
      expect(impressions).toBe(0);
    }
  });
});

describe("gbpActionCount", () => {
  it("初期値は 0", () => {
    expect(gbpActionCount()).toBe(0);
  });

  it("runFullWorkflow 後は 0 より大きい", () => {
    runFullWorkflow("proj-001", SAMPLE_META, "city_setagaya", "local_purchase", 30, NOW, true);
    expect(gbpActionCount()).toBeGreaterThan(0);
  });
});
