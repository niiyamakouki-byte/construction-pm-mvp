/**
 * local-seo-facade.test.ts — Sprint 19-B
 * サンプルデータ: 世田谷区松原3丁目マンション内装リノベ (75㎡/45日/写真15枚)
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

const publishHpPostMock = vi.hoisted(() => vi.fn());

vi.mock("../hp-publisher.js", () => ({
  publishHpPost: publishHpPostMock,
  isSlugCollisionError: (error: unknown) =>
    error instanceof Error && error.message.includes("Slug already exists"),
}));

// ── localStorage mock ──────────────────────────────────────────────────────

const _ls: Record<string, string> = {};
vi.stubGlobal("localStorage", {
  getItem: (k: string) => _ls[k] ?? null,
  setItem: (k: string, v: string) => { _ls[k] = v; },
  removeItem: (k: string) => { delete _ls[k]; },
  clear: () => { for (const k of Object.keys(_ls)) delete _ls[k]; },
});

import {
  registerCompletion,
  generateAndSaveArticle,
  publishToHp,
  trackSerp,
  reportToGbp,
  runFullWorkflow,
  recordBacklink,
  listArticles,
  listKeywords,
  listSnapshots,
  listBacklinks,
  getStrategy,
  _resetLocalSeoFacade,
} from "../local-seo-facade.js";
import { makeSeoArticleId } from "../types.js";
import { _resetLocalSeoStore } from "../local-seo-store.js";
import { _resetKeywordCounter } from "../keyword-recommender.js";
import { _resetSnapshotCounter } from "../serp-tracker.js";
import { _resetArticleCounter } from "../article-generator.js";
import { _resetGbpActionCount } from "../gbp-syncer.js";
import { gbpActionCount } from "../portfolio-local-seo-metrics.js";
import type { CompletionProjectMeta } from "../types.js";

const SAMPLE_META: CompletionProjectMeta = {
  siteName: "世田谷区松原3丁目マンション",
  workPart: "内装リノベーション",
  areaSqm: 75,
  durationDays: 45,
  beforePhotoCount: 8,
  afterPhotoCount: 7,
  completedAt: "2026-04-01T00:00:00.000Z",
  ownerComment: "ラポルタさんに頼んで大変満足しています",
};

const NOW = new Date("2026-05-09T10:00:00.000Z");

beforeEach(() => {
  _resetLocalSeoFacade();
  _resetLocalSeoStore();
  _resetKeywordCounter();
  _resetSnapshotCounter();
  _resetArticleCounter();
  _resetGbpActionCount();
  publishHpPostMock.mockReset();
  localStorage.clear();
});

describe("registerCompletion", () => {
  it("キーワード一覧を生成して返す", () => {
    const { allKeywords } = registerCompletion("proj-001", SAMPLE_META, "city_setagaya", "local_purchase", NOW);
    expect(allKeywords.length).toBeGreaterThanOrEqual(4);
  });

  it("TOP5 を返す", () => {
    const { top5 } = registerCompletion("proj-001", SAMPLE_META, "city_setagaya", undefined, NOW);
    expect(top5).toHaveLength(5);
  });

  it("キーワードが localStorage に保存される", () => {
    registerCompletion("proj-001", SAMPLE_META, "city_setagaya", undefined, NOW);
    expect(listKeywords().length).toBeGreaterThan(0);
  });

  it("strategy が _strategies に登録される", () => {
    registerCompletion("proj-001", SAMPLE_META, "city_setagaya", undefined, NOW);
    expect(getStrategy("proj-001")).not.toBeNull();
  });

  it("TOP5 KW に '世田谷区 マンション リフォーム' が含まれる", () => {
    const { top5 } = registerCompletion("proj-001", SAMPLE_META, "city_setagaya", "local_purchase", NOW);
    const kwTexts = top5.map((k) => k.keyword);
    expect(kwTexts.some((k) => k.includes("マンション") || k.includes("リフォーム"))).toBe(true);
  });
});

describe("generateAndSaveArticle", () => {
  it("記事を生成して保存する", () => {
    registerCompletion("proj-001", SAMPLE_META, "city_setagaya", undefined, NOW);
    const article = generateAndSaveArticle("proj-001", "世田谷区 マンション リフォーム", [], NOW);
    expect(article).not.toBeNull();
    expect(listArticles()).toHaveLength(1);
  });

  it("strategy なしの場合は null を返す", () => {
    const result = generateAndSaveArticle("no-such-proj", "KW");
    expect(result).toBeNull();
  });

  it("記事タイトルが世田谷区松原に言及する", () => {
    registerCompletion("proj-001", SAMPLE_META, "city_setagaya", undefined, NOW);
    const article = generateAndSaveArticle("proj-001", "世田谷区 マンション リフォーム", [], NOW);
    expect(article?.title).toContain("世田谷区");
    expect(article?.title).toContain("内装リノベーション");
  });
});

describe("publishToHp", () => {
  it("記事ステータスを published に変更する", () => {
    registerCompletion("proj-001", SAMPLE_META, "city_setagaya", undefined, NOW);
    const article = generateAndSaveArticle("proj-001", "世田谷区 マンション リフォーム", [], NOW);
    expect(article).not.toBeNull();
    const published = publishToHp(article!.id, undefined, NOW, true);
    expect(published?.status).toBe("published");
    expect(published?.publishedUrl).toContain("laporta.co.jp");
    expect(published?.publishedAt).toBeTruthy();
  });

  it("dryRun=false の場合は laporta-hp-blog-mcp createPost に記事を渡す", () => {
    publishHpPostMock.mockReturnValue({ slug: "art-001", sha: "abc1234" });
    registerCompletion("proj-001", SAMPLE_META, "city_setagaya", undefined, NOW);
    const article = generateAndSaveArticle("proj-001", "世田谷区 マンション リフォーム", ["内装リノベーション"], NOW);

    const published = publishToHp(article!.id, undefined, NOW);

    expect(publishHpPostMock).toHaveBeenCalledWith(
      expect.objectContaining({
        slug: article!.id,
        title: article!.title,
        keywords: ["世田谷区 マンション リフォーム", "内装リノベーション"],
        category: "interior-seo",
      }),
    );
    const params = publishHpPostMock.mock.calls[0][0] as { body: string };
    expect(params.body).toContain(`# ${article!.title}`);
    expect(published?.publishedUrl).toBe("https://laporta.co.jp/case/art-001");
  });

  it("slug 衝突時は articleId 末尾に timestamp を付与してリトライする", () => {
    publishHpPostMock
      .mockImplementationOnce(() => {
        throw new Error("Slug already exists: art-001");
      })
      .mockReturnValueOnce({ slug: "art-001-20260509100000", sha: "def5678" });
    registerCompletion("proj-001", SAMPLE_META, "city_setagaya", undefined, NOW);
    const article = generateAndSaveArticle("proj-001", "世田谷区 マンション リフォーム", [], NOW);

    const published = publishToHp(article!.id, undefined, NOW);

    expect(publishHpPostMock).toHaveBeenCalledTimes(2);
    expect(publishHpPostMock.mock.calls[1][0]).toEqual(
      expect.objectContaining({ slug: `${article!.id}-20260509100000` }),
    );
    expect(published?.publishedUrl).toBe("https://laporta.co.jp/case/art-001-20260509100000");
  });

  it("存在しない ID は null を返す", () => {
    const result = publishToHp(makeSeoArticleId("no-such-art"));
    expect(result).toBeNull();
  });
});

describe("trackSerp", () => {
  it("スナップショット一覧を返す", () => {
    registerCompletion("proj-001", SAMPLE_META, "city_setagaya", undefined, NOW);
    const snaps = trackSerp("proj-001", 30, NOW);
    expect(snaps.length).toBeGreaterThan(0);
  });

  it("strategy なしの場合は空配列", () => {
    expect(trackSerp("no-such")).toHaveLength(0);
  });

  it("スナップショットが localStorage に保存される", () => {
    registerCompletion("proj-001", SAMPLE_META, "city_setagaya", undefined, NOW);
    trackSerp("proj-001", 30, NOW);
    expect(listSnapshots().length).toBeGreaterThan(0);
  });
});

describe("reportToGbp", () => {
  it("GBP 同期結果を返す", () => {
    registerCompletion("proj-001", SAMPLE_META, "city_setagaya", undefined, NOW);
    const result = reportToGbp("proj-001", NOW);
    expect(result).not.toBeNull();
    expect(result?.postsGenerated).toHaveLength(4);
  });

  it("strategy なしの場合は null", () => {
    expect(reportToGbp("no-such")).toBeNull();
  });
});

describe("recordBacklink", () => {
  it("バックリンクを記録する", () => {
    registerCompletion("proj-001", SAMPLE_META, "city_setagaya", undefined, NOW);
    const article = generateAndSaveArticle("proj-001", "KW", [], NOW);
    const bl = recordBacklink(article!.id, "https://ref.example.com", "世田谷区 リフォーム", 50, NOW);
    expect(bl.sourceUrl).toBe("https://ref.example.com");
    expect(listBacklinks()).toHaveLength(1);
  });
});

describe("runFullWorkflow — 世田谷区松原サンプル", () => {
  it("フルワークフローが全ステップを完走する", () => {
    const result = runFullWorkflow(
      "proj-setagaya-matsubara",
      SAMPLE_META,
      "city_setagaya",
      "local_purchase",
      30,
      NOW,
      true,
    );

    expect(result.top5).toHaveLength(5);
    expect(result.article).not.toBeNull();
    expect(result.article?.status).toBe("published");
    expect(result.serpSnapshots.length).toBeGreaterThan(0);
    expect(result.gbpResult?.postsGenerated).toHaveLength(4);
  });

  it("公開記事の URL が laporta.co.jp を含む", () => {
    const result = runFullWorkflow(
      "proj-setagaya-matsubara",
      SAMPLE_META,
      "city_setagaya",
      "local_purchase",
      30,
      NOW,
      true,
    );
    expect(result.article?.publishedUrl).toContain("laporta.co.jp");
  });

  it("30日後の SERP スナップショットで TOP10 達成 KW が存在する", () => {
    const result = runFullWorkflow(
      "proj-setagaya-matsubara",
      SAMPLE_META,
      "city_setagaya",
      "local_purchase",
      30,
      NOW,
      true,
    );
    const top10 = result.serpSnapshots.filter(
      (s) => s.bucket === "top3" || s.bucket === "top10",
    );
    expect(top10.length).toBeGreaterThanOrEqual(1);
    // 証跡ログ
    for (const s of top10) {
      expect(s.keyword).toBeTruthy();
      expect(s.rank).toBeLessThanOrEqual(10);
    }
  });

  it("GBP アクション数が 0 より大きい", () => {
    runFullWorkflow(
      "proj-setagaya-matsubara",
      SAMPLE_META,
      "city_setagaya",
      "local_purchase",
      30,
      NOW,
      true,
    );
    expect(gbpActionCount()).toBeGreaterThan(0);
  });
});
