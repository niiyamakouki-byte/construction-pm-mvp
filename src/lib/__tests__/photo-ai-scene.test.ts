import { describe, expect, it } from "vitest";
import {
  inferScene,
  inferPart,
  computeAverageHash,
  hammingDistance,
  groupDuplicatesByHash,
  buildHashEntries,
  type SceneTag,
  type PartTag,
} from "../photo-ai-scene.js";

// ── inferScene ────────────────────────────────────────────────────────────────

describe("inferScene", () => {
  describe("外観 detection", () => {
    it("外観 keyword → 外観 scene", () => {
      const r = inferScene("外観_南面_001.jpg");
      expect(r.scene).toBe("外観");
      expect(r.confidence).toBeGreaterThan(0);
    });

    it("外壁 keyword → 外観 scene", () => {
      const r = inferScene("外壁タイル施工.jpg");
      expect(r.scene).toBe("外観");
    });

    it("ドローン keyword → 外観 scene", () => {
      const r = inferScene("ドローン空撮_全景.jpg");
      expect(r.scene).toBe("外観");
    });
  });

  describe("内装 detection", () => {
    it("内装 keyword → 内装 scene", () => {
      const r = inferScene("内装仕上_001.jpg");
      expect(r.scene).toBe("内装");
    });

    it("クロス keyword → 内装 scene", () => {
      const r = inferScene("壁クロス張り.jpg");
      expect(r.scene).toBe("内装");
    });

    it("フローリング keyword → 内装 scene", () => {
      const r = inferScene("フローリング施工_3F.jpg");
      expect(r.scene).toBe("内装");
    });

    it("LGS keyword → 内装 scene", () => {
      const r = inferScene("LGS下地_2F.jpg");
      expect(r.scene).toBe("内装");
    });
  });

  describe("設備 detection", () => {
    it("設備 keyword → 設備 scene", () => {
      const r = inferScene("設備配管工事.jpg");
      expect(r.scene).toBe("設備");
    });

    it("空調 keyword → 設備 scene", () => {
      const r = inferScene("空調ダクト設置.jpg");
      expect(r.scene).toBe("設備");
    });

    it("照明 keyword → 設備 scene", () => {
      const r = inferScene("照明器具取付_1F.jpg");
      expect(r.scene).toBe("設備");
    });
  });

  describe("資材 detection", () => {
    it("搬入 keyword → 資材 scene", () => {
      const r = inferScene("資材搬入_鉄骨.jpg");
      expect(r.scene).toBe("資材");
    });

    it("荷受 keyword → 資材 scene", () => {
      const r = inferScene("荷受検査_木材.jpg");
      expect(r.scene).toBe("資材");
    });
  });

  describe("完了写真 detection", () => {
    it("完成 keyword → 完了写真 scene", () => {
      const r = inferScene("完成写真_全室.jpg");
      expect(r.scene).toBe("完了写真");
    });

    it("竣工 keyword → 完了写真 scene", () => {
      const r = inferScene("竣工引渡前_確認.jpg");
      expect(r.scene).toBe("完了写真");
    });

    it("after keyword → 完了写真 scene", () => {
      const r = inferScene("施工後_内装.jpg");
      expect(r.scene).toBe("完了写真");
    });
  });

  describe("安全 detection", () => {
    it("安全 keyword → 安全 scene", () => {
      const r = inferScene("安全確認_朝礼.jpg");
      expect(r.scene).toBe("安全");
    });

    it("KY keyword → 安全 scene", () => {
      const r = inferScene("KY活動_2025.jpg");
      expect(r.scene).toBe("安全");
    });
  });

  describe("tags input", () => {
    it("uses tags alongside filename", () => {
      const r = inferScene("IMG_001.jpg", ["外観", "正面"]);
      expect(r.scene).toBe("外観");
    });

    it("tags alone can determine scene", () => {
      const r = inferScene("DSC_0001.jpg", ["竣工"]);
      expect(r.scene).toBe("完了写真");
    });
  });

  describe("unrecognized → その他", () => {
    it("generic filename → その他", () => {
      const r = inferScene("IMG_20250101_001.jpg");
      expect(r.scene).toBe("その他");
      expect(r.confidence).toBe(0);
    });
  });

  describe("confidence bounds", () => {
    it("confidence is between 0 and 1 inclusive", () => {
      const filenames = [
        "外観_001.jpg",
        "内装仕上.jpg",
        "IMG_999.jpg",
        "竣工写真_完成.jpg",
      ];
      for (const fn of filenames) {
        const r = inferScene(fn);
        expect(r.confidence).toBeGreaterThanOrEqual(0);
        expect(r.confidence).toBeLessThanOrEqual(1);
      }
    });
  });

  describe("all scene tags are reachable", () => {
    const cases: Array<[string, SceneTag]> = [
      ["外観_南面.jpg", "外観"],
      ["内装仕上_001.jpg", "内装"],
      ["設備配管.jpg", "設備"],
      ["資材搬入.jpg", "資材"],
      ["職人作業_大工.jpg", "職人作業"],
      ["完成写真.jpg", "完了写真"],
      ["安全確認.jpg", "安全"],
      ["施工進捗_全体.jpg", "進捗"],
      ["IMG_999.jpg", "その他"],
    ];
    it.each(cases)("%s → %s", (fn, expected) => {
      const r = inferScene(fn);
      expect(r.scene).toBe(expected);
    });
  });
});

// ── inferPart ─────────────────────────────────────────────────────────────────

describe("inferPart", () => {
  describe("天井 detection", () => {
    it("天井 keyword → 天井 part", () => {
      const r = inferPart("天井クロス_2F.jpg");
      expect(r.part).toBe("天井");
      expect(r.confidence).toBeGreaterThan(0);
    });

    it("ceiling keyword → 天井 part", () => {
      const r = inferPart("ceiling_finish_01.jpg");
      expect(r.part).toBe("天井");
    });
  });

  describe("壁 detection", () => {
    it("壁 keyword → 壁 part", () => {
      const r = inferPart("壁クロス_施工.jpg");
      expect(r.part).toBe("壁");
    });

    it("LGS keyword → 壁 part", () => {
      const r = inferPart("LGS下地_間仕切.jpg");
      expect(r.part).toBe("壁");
    });
  });

  describe("床 detection", () => {
    it("床 keyword → 床 part", () => {
      const r = inferPart("フローリング床_施工.jpg");
      expect(r.part).toBe("床");
    });

    it("CF keyword → 床 part", () => {
      const r = inferPart("CFシート貼り.jpg");
      expect(r.part).toBe("床");
    });
  });

  describe("建具 detection", () => {
    it("ドア keyword → 建具 part", () => {
      const r = inferPart("木製ドア取付.jpg");
      expect(r.part).toBe("建具");
    });

    it("サッシ keyword → 建具 part", () => {
      const r = inferPart("サッシ建具_設置.jpg");
      expect(r.part).toBe("建具");
    });
  });

  describe("設備機器 detection", () => {
    it("エアコン keyword → 設備機器 part", () => {
      const r = inferPart("エアコン空調機_設置.jpg");
      expect(r.part).toBe("設備機器");
    });

    it("ダウンライト keyword → 設備機器 part", () => {
      const r = inferPart("ダウンライト照明器具_取付.jpg");
      expect(r.part).toBe("設備機器");
    });
  });

  describe("基礎構造 detection", () => {
    it("基礎 keyword → 基礎構造 part", () => {
      const r = inferPart("基礎コンクリート打設.jpg");
      expect(r.part).toBe("基礎構造");
    });

    it("鉄筋 keyword → 基礎構造 part", () => {
      const r = inferPart("鉄筋配筋_検査.jpg");
      expect(r.part).toBe("基礎構造");
    });
  });

  describe("外壁 detection", () => {
    it("外壁 keyword → 外壁 part", () => {
      const r = inferPart("外壁タイル仕上.jpg");
      expect(r.part).toBe("外壁");
    });
  });

  describe("屋根 detection", () => {
    it("屋根 keyword → 屋根 part", () => {
      const r = inferPart("屋根防水_工事.jpg");
      expect(r.part).toBe("屋根");
    });

    it("屋上 keyword → 屋根 part", () => {
      const r = inferPart("屋上防水_FRP.jpg");
      expect(r.part).toBe("屋根");
    });
  });

  describe("tags input", () => {
    it("uses tags to refine part detection", () => {
      const r = inferPart("IMG_001.jpg", ["天井", "システム天井"]);
      expect(r.part).toBe("天井");
    });
  });

  describe("unrecognized → その他", () => {
    it("generic filename → その他", () => {
      const r = inferPart("IMG_20250101.jpg");
      expect(r.part).toBe("その他");
      expect(r.confidence).toBe(0);
    });
  });

  describe("confidence bounds", () => {
    it("confidence is between 0 and 1 inclusive", () => {
      const filenames = ["天井_001.jpg", "壁面仕上.jpg", "IMG_999.jpg"];
      for (const fn of filenames) {
        const r = inferPart(fn);
        expect(r.confidence).toBeGreaterThanOrEqual(0);
        expect(r.confidence).toBeLessThanOrEqual(1);
      }
    });
  });

  describe("all part tags are reachable", () => {
    const cases: Array<[string, PartTag]> = [
      ["天井クロス.jpg", "天井"],
      ["壁クロス施工.jpg", "壁"],
      ["フローリング床.jpg", "床"],
      ["木製ドア建具.jpg", "建具"],
      ["エアコン空調機器.jpg", "設備機器"],
      ["基礎コンクリート.jpg", "基礎構造"],
      ["外壁仕上げ.jpg", "外壁"],
      ["屋根防水.jpg", "屋根"],
      ["IMG_999.jpg", "その他"],
    ];
    it.each(cases)("%s → %s", (fn, expected) => {
      const r = inferPart(fn);
      expect(r.part).toBe(expected);
    });
  });
});

// ── computeAverageHash ────────────────────────────────────────────────────────

describe("computeAverageHash", () => {
  it("returns a 16-character hex string", () => {
    const h = computeAverageHash("基礎工事_001.jpg");
    expect(h).toHaveLength(16);
    expect(/^[0-9a-f]{16}$/.test(h)).toBe(true);
  });

  it("is deterministic — same input → same hash", () => {
    const fn = "クロス張り_2F.jpg";
    expect(computeAverageHash(fn)).toBe(computeAverageHash(fn));
  });

  it("different filenames produce different hashes (Hamming distance > 0)", () => {
    const h1 = computeAverageHash("abc_001.jpg");
    const h2 = computeAverageHash("xyz_999.jpg");
    expect(hammingDistance(h1, h2)).toBeGreaterThan(0);
  });

  it("identical filenames (different extension) produce same base hash", () => {
    // Extension is stripped before hashing
    const h1 = computeAverageHash("photo_001.jpg");
    const h2 = computeAverageHash("photo_001.png");
    expect(h1).toBe(h2);
  });

  it("handles empty string gracefully", () => {
    const h = computeAverageHash("");
    expect(h).toHaveLength(16);
  });
});

// ── hammingDistance ───────────────────────────────────────────────────────────

describe("hammingDistance", () => {
  it("identical hashes → distance 0", () => {
    const h = computeAverageHash("test.jpg");
    expect(hammingDistance(h, h)).toBe(0);
  });

  it("fully inverted hashes → distance 64", () => {
    // All-ones and all-zeros
    const all1 = "ffffffffffffffff";
    const all0 = "0000000000000000";
    expect(hammingDistance(all1, all0)).toBe(64);
  });

  it("distance is symmetric", () => {
    const h1 = computeAverageHash("abc.jpg");
    const h2 = computeAverageHash("xyz.jpg");
    expect(hammingDistance(h1, h2)).toBe(hammingDistance(h2, h1));
  });

  it("distance is non-negative", () => {
    const h1 = computeAverageHash("file_a.jpg");
    const h2 = computeAverageHash("file_b.jpg");
    expect(hammingDistance(h1, h2)).toBeGreaterThanOrEqual(0);
  });

  it("distance is at most 64", () => {
    const h1 = computeAverageHash("totally_different_name_1.jpg");
    const h2 = computeAverageHash("totally_different_name_2.jpg");
    expect(hammingDistance(h1, h2)).toBeLessThanOrEqual(64);
  });
});

// ── groupDuplicatesByHash ─────────────────────────────────────────────────────

describe("groupDuplicatesByHash", () => {
  it("identical filenames → grouped as duplicates", () => {
    const photos = [
      { id: "p1", filename: "外観_001.jpg", hash: computeAverageHash("外観_001.jpg") },
      { id: "p2", filename: "外観_001.jpg", hash: computeAverageHash("外観_001.jpg") },
      { id: "p3", filename: "内装_001.jpg", hash: computeAverageHash("内装_001.jpg") },
    ];
    const groups = groupDuplicatesByHash(photos);
    expect(groups).toHaveLength(1);
    expect(groups[0].photos).toHaveLength(2);
    expect(groups[0].maxDistance).toBe(0);
  });

  it("completely different filenames → no duplicates", () => {
    // Force low similarity by using very different names and tight threshold
    const photos = [
      { id: "a1", filename: "aaaa_bbbbbb_cccc_exterior.jpg", hash: computeAverageHash("aaaa_bbbbbb_cccc_exterior.jpg") },
      { id: "a2", filename: "zzzzz_yyyy_interior_999.jpg", hash: computeAverageHash("zzzzz_yyyy_interior_999.jpg") },
    ];
    // With threshold 0, only exact matches count
    const groups = groupDuplicatesByHash(photos, 0);
    expect(groups).toHaveLength(0);
  });

  it("three identical photos → single group of 3", () => {
    const hash = computeAverageHash("burst_001.jpg");
    const photos = [
      { id: "b1", filename: "burst_001.jpg", hash },
      { id: "b2", filename: "burst_001.jpg", hash },
      { id: "b3", filename: "burst_001.jpg", hash },
    ];
    const groups = groupDuplicatesByHash(photos);
    expect(groups).toHaveLength(1);
    expect(groups[0].photos).toHaveLength(3);
  });

  it("returns empty array for empty input", () => {
    const groups = groupDuplicatesByHash([]);
    expect(groups).toHaveLength(0);
  });

  it("returns empty array for single photo", () => {
    const photos = [{ id: "s1", filename: "only.jpg", hash: computeAverageHash("only.jpg") }];
    const groups = groupDuplicatesByHash(photos);
    expect(groups).toHaveLength(0);
  });

  it("maxDistance is correct", () => {
    const h1 = "0000000000000001";
    const h2 = "0000000000000003"; // differs by 1 bit
    const photos = [
      { id: "q1", filename: "a.jpg", hash: h1 },
      { id: "q2", filename: "b.jpg", hash: h2 },
    ];
    const groups = groupDuplicatesByHash(photos, 10);
    expect(groups).toHaveLength(1);
    expect(groups[0].maxDistance).toBe(hammingDistance(h1, h2));
  });

  it("custom threshold works — tighter threshold excludes borderline pairs", () => {
    // Two hashes that differ by exactly 5 bits
    const base = "ff00ff00ff00ff00";
    // Flip exactly 5 bits of base
    const modified = "ff00ff00ff00ff1f"; // last byte: 00 → 1f = 5 bits differ
    const dist = hammingDistance(base, modified);

    const photos = [
      { id: "t1", filename: "x.jpg", hash: base },
      { id: "t2", filename: "y.jpg", hash: modified },
    ];

    // With threshold >= dist: grouped
    const grouped = groupDuplicatesByHash(photos, dist);
    expect(grouped).toHaveLength(1);

    // With threshold < dist: not grouped
    const notGrouped = groupDuplicatesByHash(photos, dist - 1);
    expect(notGrouped).toHaveLength(0);
  });
});

// ── buildHashEntries ──────────────────────────────────────────────────────────

describe("buildHashEntries", () => {
  it("returns one entry per photo", () => {
    const photos = [
      { id: "e1", filename: "外観_001.jpg" },
      { id: "e2", filename: "内装_001.jpg" },
    ];
    const entries = buildHashEntries(photos);
    expect(entries).toHaveLength(2);
  });

  it("each entry has id, filename, and 16-char hex hash", () => {
    const photos = [{ id: "e1", filename: "test.jpg" }];
    const [entry] = buildHashEntries(photos);
    expect(entry.id).toBe("e1");
    expect(entry.filename).toBe("test.jpg");
    expect(entry.hash).toHaveLength(16);
    expect(/^[0-9a-f]{16}$/.test(entry.hash)).toBe(true);
  });

  it("preserves takenAt when provided", () => {
    const date = new Date("2025-05-01T10:00:00Z");
    const photos = [{ id: "e1", filename: "test.jpg", takenAt: date }];
    const [entry] = buildHashEntries(photos);
    expect(entry.takenAt).toBe(date);
  });

  it("handles empty array", () => {
    expect(buildHashEntries([])).toHaveLength(0);
  });

  it("hashes are consistent with computeAverageHash", () => {
    const photos = [{ id: "e1", filename: "consistent.jpg" }];
    const [entry] = buildHashEntries(photos);
    expect(entry.hash).toBe(computeAverageHash("consistent.jpg"));
  });

  it("combined with groupDuplicatesByHash detects identical filenames", () => {
    const photos = [
      { id: "g1", filename: "same.jpg" },
      { id: "g2", filename: "same.jpg" },
      { id: "g3", filename: "different.jpg" },
    ];
    const entries = buildHashEntries(photos);
    const groups = groupDuplicatesByHash(entries);
    expect(groups).toHaveLength(1);
    expect(groups[0].photos.map((p) => p.id)).toEqual(expect.arrayContaining(["g1", "g2"]));
  });
});
