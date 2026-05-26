/**
 * article-generator.test.ts — Sprint 19-B
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  generateTitleCandidates,
  generateHeadings,
  generateArticle,
  articleBodyText,
  articleCharCount,
  _resetArticleCounter,
} from "../article-generator.js";
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

beforeEach(() => {
  _resetArticleCounter();
});

describe("generateTitleCandidates", () => {
  it("4本のタイトル候補を生成する", () => {
    const titles = generateTitleCandidates(SAMPLE_META, "city_setagaya");
    expect(titles).toHaveLength(4);
  });

  it("全タイトルに地域名が含まれる", () => {
    const titles = generateTitleCandidates(SAMPLE_META, "city_setagaya");
    for (const t of titles) {
      expect(t).toContain("世田谷区");
    }
  });

  it("最初のタイトルに面積と工期が含まれる", () => {
    const titles = generateTitleCandidates(SAMPLE_META, "city_setagaya");
    expect(titles[0]).toContain("75㎡");
    expect(titles[0]).toContain("45日");
  });
});

describe("generateHeadings", () => {
  it("5本の見出しを生成する", () => {
    const headings = generateHeadings(SAMPLE_META, "city_setagaya");
    expect(headings).toHaveLength(5);
  });

  it("Before/After 見出しに写真枚数が含まれる", () => {
    const headings = generateHeadings(SAMPLE_META, "city_setagaya");
    expect(headings[2]).toContain("15"); // 8 + 7 = 15
  });
});

describe("generateArticle", () => {
  it("SEO記事を生成できる", () => {
    const article = generateArticle(
      "proj-setagaya-001",
      SAMPLE_META,
      "city_setagaya",
      "世田谷区 マンション リフォーム",
      ["世田谷区 内装業者", "松原 リフォーム"],
    );
    expect(article.projectId).toBe("proj-setagaya-001");
    expect(article.region).toBe("city_setagaya");
    expect(article.status).toBe("draft");
    expect(article.primaryKeyword).toBe("世田谷区 マンション リフォーム");
  });

  it("titleCandidates が 4本", () => {
    const article = generateArticle("proj-001", SAMPLE_META, "city_setagaya", "KW");
    expect(article.titleCandidates).toHaveLength(4);
  });

  it("headings が 5本", () => {
    const article = generateArticle("proj-001", SAMPLE_META, "city_setagaya", "KW");
    expect(article.headings).toHaveLength(5);
  });

  it("bodySections が 5 セクション", () => {
    const article = generateArticle("proj-001", SAMPLE_META, "city_setagaya", "KW");
    expect(article.bodySections).toHaveLength(5);
  });

  it("本文が 1200 字以上", () => {
    const article = generateArticle("proj-001", SAMPLE_META, "city_setagaya", "KW");
    const chars = articleCharCount(article);
    expect(chars).toBeGreaterThanOrEqual(1200);
  });

  it("タイトルに '世田谷区松原' が含まれる", () => {
    const article = generateArticle("proj-001", SAMPLE_META, "city_setagaya", "KW");
    expect(article.title).toContain("世田谷区");
    expect(article.title).toContain("内装リノベーション");
  });

  it("タイトルに 75㎡/45日 が含まれる", () => {
    const article = generateArticle("proj-001", SAMPLE_META, "city_setagaya", "KW");
    expect(article.title).toContain("75㎡");
    expect(article.title).toContain("45日");
  });
});

describe("articleBodyText / articleCharCount", () => {
  it("articleBodyText が空でない", () => {
    const article = generateArticle("proj-001", SAMPLE_META, "city_setagaya", "KW");
    expect(articleBodyText(article).length).toBeGreaterThan(0);
  });

  it("articleCharCount が正の整数", () => {
    const article = generateArticle("proj-001", SAMPLE_META, "city_setagaya", "KW");
    expect(articleCharCount(article)).toBeGreaterThan(0);
  });
});
