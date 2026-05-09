/**
 * local-seo-store.test.ts — Sprint 19-B
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { LocalSeoStore, _resetLocalSeoStore } from "../local-seo-store.js";

// ── localStorage mock ──────────────────────────────────────────────────────

const _ls: Record<string, string> = {};
vi.stubGlobal("localStorage", {
  getItem: (k: string) => _ls[k] ?? null,
  setItem: (k: string, v: string) => { _ls[k] = v; },
  removeItem: (k: string) => { delete _ls[k]; },
  clear: () => { for (const k of Object.keys(_ls)) delete _ls[k]; },
});
import {
  makeSeoArticleId,
  makeKeywordTargetId,
  makeBackLinkId,
  makeSeoMetricsId,
} from "../types.js";
import type { SeoArticle, KeywordTarget, BackLinkRecord, SerpSnapshot } from "../types.js";

beforeEach(() => {
  _resetLocalSeoStore();
  localStorage.clear();
});

function makeSampleArticle(overrides?: Partial<SeoArticle>): SeoArticle {
  return {
    id: makeSeoArticleId("art-001"),
    projectId: "proj-001",
    region: "city_setagaya",
    status: "draft",
    title: "世田谷区のリフォーム事例",
    titleCandidates: ["世田谷区のリフォーム事例"],
    headings: ["背景", "施工", "Before/After", "お声", "料金"],
    bodySections: [{ heading: "背景", content: "テスト本文" }],
    primaryKeyword: "世田谷区 マンション リフォーム",
    secondaryKeywords: [],
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

function makeSampleKeyword(overrides?: Partial<KeywordTarget>): KeywordTarget {
  return {
    id: makeKeywordTargetId("kw-001"),
    keyword: "世田谷区 マンション リフォーム",
    region: "city_setagaya",
    intent: "local_purchase",
    monthlySearchVolume: 2000,
    competitionScore: 70,
    priority: 1,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

function makeSampleSnapshot(overrides?: Partial<SerpSnapshot>): SerpSnapshot {
  return {
    id: makeSeoMetricsId("snap-001"),
    keywordTargetId: makeKeywordTargetId("kw-001"),
    keyword: "世田谷区 マンション リフォーム",
    rank: 8,
    bucket: "top10",
    snapshotAt: new Date().toISOString(),
    rankHistory: [20, 15, 12, 10, 8],
    ...overrides,
  };
}

describe("LocalSeoStore — articles", () => {
  it("addArticle / getArticles", () => {
    const store = new LocalSeoStore();
    const article = makeSampleArticle();
    store.addArticle(article);
    const all = store.getArticles();
    expect(all).toHaveLength(1);
    expect(all[0].title).toBe("世田谷区のリフォーム事例");
  });

  it("getArticle by ID", () => {
    const store = new LocalSeoStore();
    const article = makeSampleArticle();
    store.addArticle(article);
    expect(store.getArticle(makeSeoArticleId("art-001"))).not.toBeNull();
    expect(store.getArticle(makeSeoArticleId("art-999"))).toBeNull();
  });

  it("updateArticle changes status", () => {
    const store = new LocalSeoStore();
    const article = makeSampleArticle();
    store.addArticle(article);
    const updated = store.updateArticle(makeSeoArticleId("art-001"), { status: "published" });
    expect(updated?.status).toBe("published");
    expect(store.getArticle(makeSeoArticleId("art-001"))?.status).toBe("published");
  });

  it("updateArticle returns null for unknown ID", () => {
    const store = new LocalSeoStore();
    expect(store.updateArticle(makeSeoArticleId("no-such"), { status: "published" })).toBeNull();
  });

  it("seo-article-added event fires on addArticle", () => {
    const store = new LocalSeoStore();
    const spy = vi.fn();
    store.addEventListener("seo-article-added", spy);
    store.addArticle(makeSampleArticle());
    expect(spy).toHaveBeenCalledOnce();
  });

  it("seo-article-updated event fires on updateArticle", () => {
    const store = new LocalSeoStore();
    const article = makeSampleArticle();
    store.addArticle(article);
    const spy = vi.fn();
    store.addEventListener("seo-article-updated", spy);
    store.updateArticle(makeSeoArticleId("art-001"), { status: "scheduled" });
    expect(spy).toHaveBeenCalledOnce();
  });
});

describe("LocalSeoStore — keywords", () => {
  it("addKeyword / getKeywords", () => {
    const store = new LocalSeoStore();
    store.addKeyword(makeSampleKeyword());
    expect(store.getKeywords()).toHaveLength(1);
  });

  it("getKeyword by ID", () => {
    const store = new LocalSeoStore();
    store.addKeyword(makeSampleKeyword());
    expect(store.getKeyword(makeKeywordTargetId("kw-001"))).not.toBeNull();
    expect(store.getKeyword(makeKeywordTargetId("kw-999"))).toBeNull();
  });

  it("seo-keyword-added event fires", () => {
    const store = new LocalSeoStore();
    const spy = vi.fn();
    store.addEventListener("seo-keyword-added", spy);
    store.addKeyword(makeSampleKeyword());
    expect(spy).toHaveBeenCalledOnce();
  });
});

describe("LocalSeoStore — backlinks", () => {
  it("addBacklink / getBacklinks", () => {
    const store = new LocalSeoStore();
    const bl: BackLinkRecord = {
      id: makeBackLinkId("bl-001"),
      articleId: makeSeoArticleId("art-001"),
      sourceUrl: "https://example.com/links",
      anchorText: "世田谷区 リフォーム",
      domainAuthority: 45,
      acquiredAt: new Date().toISOString(),
    };
    store.addBacklink(bl);
    expect(store.getBacklinks()).toHaveLength(1);
    expect(store.getBacklink(makeBackLinkId("bl-001"))).not.toBeNull();
  });
});

describe("LocalSeoStore — snapshots", () => {
  it("addSnapshot / getSnapshots", () => {
    const store = new LocalSeoStore();
    store.addSnapshot(makeSampleSnapshot());
    expect(store.getSnapshots()).toHaveLength(1);
  });

  it("getSnapshotsByKeyword filters correctly", () => {
    const store = new LocalSeoStore();
    store.addSnapshot(makeSampleSnapshot({ id: makeSeoMetricsId("snap-001"), keywordTargetId: makeKeywordTargetId("kw-001") }));
    store.addSnapshot(makeSampleSnapshot({ id: makeSeoMetricsId("snap-002"), keywordTargetId: makeKeywordTargetId("kw-002") }));
    expect(store.getSnapshotsByKeyword(makeKeywordTargetId("kw-001"))).toHaveLength(1);
    expect(store.getSnapshotsByKeyword(makeKeywordTargetId("kw-002"))).toHaveLength(1);
    expect(store.getSnapshotsByKeyword(makeKeywordTargetId("kw-999"))).toHaveLength(0);
  });
});

describe("LocalSeoStore — subscribe", () => {
  it("subscribe listener fires on article add", () => {
    const store = new LocalSeoStore();
    const spy = vi.fn();
    const unsubscribe = store.subscribe(spy);
    store.addArticle(makeSampleArticle());
    expect(spy).toHaveBeenCalledOnce();
    unsubscribe();
    store.addKeyword(makeSampleKeyword());
    expect(spy).toHaveBeenCalledOnce(); // no more calls after unsubscribe
  });
});

describe("LocalSeoStore — FIFO 1000件", () => {
  it("1000件超で古いものが削除される", () => {
    const store = new LocalSeoStore();
    for (let i = 0; i < 1005; i++) {
      store.addArticle(makeSampleArticle({ id: makeSeoArticleId(`art-${i}`), title: `記事${i}` }));
    }
    const all = store.getArticles(2000);
    expect(all.length).toBeLessThanOrEqual(1000);
  });
});

describe("LocalSeoStore — clear", () => {
  it("clear で全データが消える", () => {
    const store = new LocalSeoStore();
    store.addArticle(makeSampleArticle());
    store.addKeyword(makeSampleKeyword());
    store.clear();
    expect(store.getArticles()).toHaveLength(0);
    expect(store.getKeywords()).toHaveLength(0);
  });
});
