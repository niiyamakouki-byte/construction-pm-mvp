import { describe, expect, it } from "vitest";
import {
  classifyInteriorPhoto,
  suggestCategory,
  getCategoryHierarchy,
  INTERIOR_CATEGORIES,
  type InteriorCategory,
  type InteriorParentCategory,
} from "./interior-photo-classifier.js";

describe("classifyInteriorPhoto", () => {
  describe("filename-based classification", () => {
    it("classifies 軽鉄下地 from filename", () => {
      const result = classifyInteriorPhoto("軽鉄下地_001.jpg");
      expect(result.category).toBe("軽鉄下地");
      expect(result.confidence).toBeGreaterThan(0);
    });

    it("classifies 壁クロス from filename", () => {
      const result = classifyInteriorPhoto("壁クロス施工_完了.jpg");
      expect(result.category).toBe("壁クロス");
    });

    it("classifies フローリング from filename", () => {
      const result = classifyInteriorPhoto("flooring_01.jpg");
      expect(result.category).toBe("フローリング");
    });

    it("classifies 廃材搬出 from filename", () => {
      const result = classifyInteriorPhoto("廃材搬出_20250401.jpg");
      expect(result.category).toBe("廃材搬出");
    });

    it("classifies 完成写真 from filename", () => {
      const result = classifyInteriorPhoto("竣工_全景.jpg");
      expect(result.category).toBe("完成写真");
    });

    it("classifies 空調 from filename", () => {
      const result = classifyInteriorPhoto("エアコン取付_空調.jpg");
      expect(result.category).toBe("空調");
    });

    it("classifies 照明 from filename", () => {
      const result = classifyInteriorPhoto("ダウンライト照明_施工.jpg");
      expect(result.category).toBe("照明");
    });

    it("classifies 天井クロス from filename", () => {
      const result = classifyInteriorPhoto("天井クロス貼_B工区.jpg");
      expect(result.category).toBe("天井クロス");
    });
  });

  describe("blackboard text classification", () => {
    it("uses blackboard text when filename is generic", () => {
      const result = classifyInteriorPhoto("IMG_1234.jpg", {
        blackboardText: "石膏ボード貼り 2F会議室",
      });
      expect(result.category).toBe("ボード貼り");
    });

    it("blackboard text overrides weak filename signal", () => {
      const result = classifyInteriorPhoto("work_001.jpg", {
        blackboardText: "タイルカーペット敷き込み",
      });
      expect(result.category).toBe("タイルカーペット");
    });

    it("classifies 養生 from blackboard text", () => {
      const result = classifyInteriorPhoto("DSC_0042.jpg", {
        blackboardText: "養生シート敷き",
      });
      expect(result.category).toBe("養生");
    });
  });

  describe("confidence score", () => {
    it("returns confidence > 0 when category matched", () => {
      const result = classifyInteriorPhoto("軽天_スタッド.jpg");
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.confidence).toBeLessThanOrEqual(1.0);
    });

    it("returns confidence 0 when no match found", () => {
      const result = classifyInteriorPhoto("IMG_999999.jpg");
      expect(result.confidence).toBe(0);
    });
  });
});

describe("suggestCategory", () => {
  it("returns candidates sorted by confidence descending", () => {
    const suggestions = suggestCategory("クロス貼り 壁クロス施工");
    expect(suggestions.length).toBeGreaterThan(0);
    for (let i = 1; i < suggestions.length; i++) {
      expect(suggestions[i - 1].confidence).toBeGreaterThanOrEqual(suggestions[i].confidence);
    }
  });

  it("top suggestion for エコカラット text", () => {
    const suggestions = suggestCategory("エコカラット施工");
    expect(suggestions[0].category).toBe("エコカラット");
    expect(suggestions[0].confidence).toBe(1.0);
  });

  it("returns empty array for unrecognized text", () => {
    const suggestions = suggestCategory("zzz_unknown_text");
    expect(suggestions).toHaveLength(0);
  });

  it("returns multiple candidates when text matches several categories", () => {
    // 「配管 電気」は給排水と電気の両方にマッチする
    const suggestions = suggestCategory("配管 電気工事");
    expect(suggestions.length).toBeGreaterThanOrEqual(2);
  });
});

describe("getCategoryHierarchy", () => {
  it("returns all 9 parent categories", () => {
    const hierarchy = getCategoryHierarchy();
    const parents = Object.keys(hierarchy) as InteriorParentCategory[];
    expect(parents).toHaveLength(9);
    expect(parents).toContain("解体");
    expect(parents).toContain("下地");
    expect(parents).toContain("天井仕上");
    expect(parents).toContain("壁仕上");
    expect(parents).toContain("床仕上");
    expect(parents).toContain("建具");
    expect(parents).toContain("設備");
    expect(parents).toContain("家具");
    expect(parents).toContain("その他");
  });

  it("解体 has 6 children", () => {
    const hierarchy = getCategoryHierarchy();
    expect(hierarchy["解体"]).toHaveLength(6);
  });

  it("下地 has 7 children", () => {
    const hierarchy = getCategoryHierarchy();
    expect(hierarchy["下地"]).toHaveLength(7);
  });

  it("設備 has 6 children", () => {
    const hierarchy = getCategoryHierarchy();
    expect(hierarchy["設備"]).toHaveLength(6);
  });
});

describe("INTERIOR_CATEGORIES constant", () => {
  it("has exactly 50 categories", () => {
    expect(INTERIOR_CATEGORIES).toHaveLength(50);
  });

  it("each category has name, parent, keywords, and icon", () => {
    for (const def of INTERIOR_CATEGORIES) {
      expect(def.name).toBeTruthy();
      expect(def.parent).toBeTruthy();
      expect(def.keywords.length).toBeGreaterThan(0);
      expect(def.icon).toBeTruthy();
    }
  });

  it("all category names are unique", () => {
    const names = INTERIOR_CATEGORIES.map((d) => d.name);
    const unique = new Set(names);
    expect(unique.size).toBe(names.length);
  });
});
