import { describe, expect, it } from "vitest";
import {
  TASK_CATEGORIES,
  getCategories,
  getSubCategories,
  searchCategories,
  type TaskCategory,
} from "./task-categories";

describe("TASK_CATEGORIES", () => {
  it("全カテゴリにid/major/middleが存在する", () => {
    for (const cat of TASK_CATEGORIES) {
      expect(cat.id).toBeTruthy();
      expect(cat.major).toBeTruthy();
      expect(cat.middle).toBeTruthy();
    }
  });

  it("全13大項目が含まれる", () => {
    const majors = [...new Set(TASK_CATEGORIES.map((c) => c.major))];
    expect(majors).toContain("仮設工事");
    expect(majors).toContain("解体工事");
    expect(majors).toContain("躯体・下地");
    expect(majors).toContain("床工事");
    expect(majors).toContain("壁・天井仕上げ");
    expect(majors).toContain("建具工事");
    expect(majors).toContain("電気工事");
    expect(majors).toContain("給排水工事");
    expect(majors).toContain("空調・換気");
    expect(majors).toContain("造作家具");
    expect(majors).toContain("塗装工事");
    expect(majors).toContain("クリーニング");
    expect(majors).toContain("検査");
    expect(majors).toHaveLength(13);
  });

  it("idが重複しない", () => {
    const ids = TASK_CATEGORIES.map((c) => c.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });
});

describe("getCategories", () => {
  it("引数なしで大項目リストを返す", () => {
    const majors = getCategories();
    expect(majors).toContain("電気工事");
    expect(majors).toContain("床工事");
    expect(majors.length).toBe(13);
  });

  it("大項目指定で中項目リストを返す", () => {
    const middles = getCategories("電気工事");
    expect(middles).toContain("荒配線");
    expect(middles).toContain("器具付");
    expect(middles).toContain("分電盤設置");
    expect(middles).toContain("試運転");
  });

  it("存在しない大項目は空配列を返す", () => {
    expect(getCategories("存在しない工事")).toHaveLength(0);
  });

  it("中項目リストに重複がない", () => {
    const middles = getCategories("給排水工事");
    const unique = new Set(middles);
    expect(unique.size).toBe(middles.length);
  });
});

describe("getSubCategories", () => {
  it("大項目と中項目で小項目リストを返す", () => {
    const minors = getSubCategories("電気工事", "荒配線");
    expect(minors).toContain("天井内配線");
    expect(minors).toContain("壁内配線");
    expect(minors).toContain("床下配線");
  });

  it("小項目のない中項目は空配列を返す", () => {
    const minors = getSubCategories("電気工事", "試運転");
    expect(minors).toHaveLength(0);
  });

  it("大項目のみ指定で全小項目を返す", () => {
    const minors = getSubCategories("床工事");
    expect(minors.length).toBeGreaterThan(0);
    expect(minors).toContain("フローリング張り");
  });

  it("存在しない組み合わせは空配列を返す", () => {
    expect(getSubCategories("電気工事", "存在しない")).toHaveLength(0);
  });
});

describe("searchCategories", () => {
  it("大項目で検索できる", () => {
    const results = searchCategories("電気工事");
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((r) => r.major === "電気工事")).toBe(true);
  });

  it("中項目で検索できる", () => {
    const results = searchCategories("荒配線");
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((r) => r.middle === "荒配線")).toBe(true);
  });

  it("小項目で検索できる", () => {
    const results = searchCategories("天井内配線");
    expect(results.length).toBeGreaterThan(0);
    expect(results.some((r) => r.minor === "天井内配線")).toBe(true);
  });

  it("部分一致で検索できる", () => {
    const results = searchCategories("クリーニング");
    expect(results.length).toBeGreaterThan(0);
  });

  it("空文字列は空配列を返す", () => {
    expect(searchCategories("")).toHaveLength(0);
    expect(searchCategories("   ")).toHaveLength(0);
  });

  it("マッチしない検索は空配列を返す", () => {
    expect(searchCategories("存在しないキーワードXYZ")).toHaveLength(0);
  });

  it("返り値はTaskCategory型の配列", () => {
    const results = searchCategories("解体");
    for (const r of results) {
      expect(r).toHaveProperty("id");
      expect(r).toHaveProperty("major");
      expect(r).toHaveProperty("middle");
    }
  });
});
