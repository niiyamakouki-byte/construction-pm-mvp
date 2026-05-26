/**
 * keyword-recommender.test.ts — Sprint 19-B
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  recommendKeywords,
  pickTop5,
  _resetKeywordCounter,
} from "../keyword-recommender.js";

beforeEach(() => {
  _resetKeywordCounter();
});

describe("recommendKeywords", () => {
  it("デフォルトで 12 件以内を返す", () => {
    const kws = recommendKeywords({ region: "city_setagaya" });
    expect(kws.length).toBeLessThanOrEqual(12);
    expect(kws.length).toBeGreaterThanOrEqual(8);
  });

  it("intent フィルタで local_purchase のみ返す", () => {
    const kws = recommendKeywords({ region: "city_setagaya", intent: "local_purchase" });
    for (const kw of kws) {
      expect(kw.intent).toBe("local_purchase");
    }
  });

  it("townName 指定で追加クエリが含まれる", () => {
    const kws = recommendKeywords({ region: "city_setagaya", townName: "松原", maxKeywords: 15 });
    const hasTownKw = kws.some((k) => k.keyword.includes("松原"));
    expect(hasTownKw).toBe(true);
  });

  it("月間検索ボリュームが 50-2000 の範囲", () => {
    const kws = recommendKeywords({ region: "city_setagaya" });
    for (const kw of kws) {
      expect(kw.monthlySearchVolume).toBeGreaterThanOrEqual(50);
      expect(kw.monthlySearchVolume).toBeLessThanOrEqual(2000);
    }
  });

  it("競合度スコアが 0-100 の範囲", () => {
    const kws = recommendKeywords({ region: "city_setagaya" });
    for (const kw of kws) {
      expect(kw.competitionScore).toBeGreaterThanOrEqual(0);
      expect(kw.competitionScore).toBeLessThanOrEqual(100);
    }
  });

  it("全キーワードに地域名が含まれる", () => {
    const kws = recommendKeywords({ region: "city_setagaya" });
    for (const kw of kws) {
      expect(kw.keyword).toContain("世田谷区");
    }
  });

  it("city_shibuya では '渋谷区' が含まれる", () => {
    const kws = recommendKeywords({ region: "city_shibuya" });
    for (const kw of kws) {
      expect(kw.keyword).toContain("渋谷区");
    }
  });

  it("priority フィールドが 1 から始まる", () => {
    const kws = recommendKeywords({ region: "city_setagaya" });
    expect(kws[0].priority).toBe(1);
  });
});

describe("pickTop5", () => {
  it("5件以下を返す", () => {
    const kws = recommendKeywords({ region: "city_setagaya" });
    const top5 = pickTop5(kws);
    expect(top5).toHaveLength(5);
  });

  it("priorityが1から5に再設定される", () => {
    const kws = recommendKeywords({ region: "city_setagaya" });
    const top5 = pickTop5(kws);
    expect(top5[0].priority).toBe(1);
    expect(top5[4].priority).toBe(5);
  });

  it("スコアが高い順 (volume/(competition+1)) でソートされている", () => {
    const kws = recommendKeywords({ region: "city_setagaya" });
    const top5 = pickTop5(kws);
    for (let i = 0; i < top5.length - 1; i++) {
      const scoreA = top5[i].monthlySearchVolume / (top5[i].competitionScore + 1);
      const scoreB = top5[i + 1].monthlySearchVolume / (top5[i + 1].competitionScore + 1);
      expect(scoreA).toBeGreaterThanOrEqual(scoreB);
    }
  });

  it("local_purchase intent の KW が TOP5 に含まれる (世田谷区は競合低め)", () => {
    const kws = recommendKeywords({ region: "city_setagaya", intent: "local_purchase" });
    const top5 = pickTop5(kws);
    expect(top5.length).toBeGreaterThan(0);
  });

  it("空配列の場合は空配列を返す", () => {
    expect(pickTop5([])).toHaveLength(0);
  });
});
