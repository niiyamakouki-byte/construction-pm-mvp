/**
 * Sprint 65 — 写真AI仕分け強化テスト
 * detectScene / assignBodyPart / computePerceptualHash / findDuplicates
 */
import { describe, expect, it } from "vitest";
import {
  detectScene,
  assignBodyPart,
  computePerceptualHash,
  findDuplicates,
  type PhotoMeta,
  type Photo,
} from "../lib/photo-classifier.js";

// ── detectScene ───────────────────────────────────────────────────────────────

describe("detectScene", () => {
  it("キッチン壁タイル → wall", () => {
    const meta: PhotoMeta = { fileName: "キッチン壁タイル施工.jpg" };
    expect(detectScene(meta)).toBe("wall");
  });

  it("浴室床タイル → floor", () => {
    const meta: PhotoMeta = { fileName: "浴室床タイル.jpg" };
    expect(detectScene(meta)).toBe("floor");
  });

  it("天井クロス → ceiling", () => {
    const meta: PhotoMeta = { fileName: "天井クロス張り.jpg" };
    expect(detectScene(meta)).toBe("ceiling");
  });

  it("配管設備 → equipment", () => {
    const meta: PhotoMeta = { fileName: "配管設備工事.jpg" };
    expect(detectScene(meta)).toBe("equipment");
  });

  it("外観全景 → exterior", () => {
    const meta: PhotoMeta = { fileName: "外観全景.jpg" };
    expect(detectScene(meta)).toBe("exterior");
  });

  it("作業中 → working", () => {
    const meta: PhotoMeta = { fileName: "施工中作業員.jpg" };
    expect(detectScene(meta)).toBe("working");
  });

  it("IMG_001 → other", () => {
    const meta: PhotoMeta = { fileName: "IMG_001.jpg" };
    expect(detectScene(meta)).toBe("other");
  });

  it("タグ from tags array も参照する", () => {
    const meta: PhotoMeta = { fileName: "photo.jpg", tags: ["天井", "仕上"] };
    expect(detectScene(meta)).toBe("ceiling");
  });

  it("caption も参照する", () => {
    const meta: PhotoMeta = { fileName: "photo.jpg", caption: "床フローリング施工中" };
    expect(detectScene(meta)).toBe("floor");
  });

  it("外壁 → exterior (wall より exterior が長いマッチ)", () => {
    const meta: PhotoMeta = { fileName: "外壁タイル施工.jpg" };
    // 外壁 matches exterior keyword "外壁"
    expect(detectScene(meta)).toBe("exterior");
  });
});

// ── assignBodyPart ─────────────────────────────────────────────────────────────

describe("assignBodyPart", () => {
  it("浴室 → [bathroom]", () => {
    const meta: PhotoMeta = { fileName: "浴室改修工事.jpg" };
    expect(assignBodyPart(meta)).toContain("bathroom");
  });

  it("キッチン → [kitchen]", () => {
    const meta: PhotoMeta = { fileName: "キッチンシンク交換.jpg" };
    expect(assignBodyPart(meta)).toContain("kitchen");
  });

  it("玄関 → [entrance]", () => {
    const meta: PhotoMeta = { fileName: "玄関タイル貼り.jpg" };
    expect(assignBodyPart(meta)).toContain("entrance");
  });

  it("廊下 → [hallway]", () => {
    const meta: PhotoMeta = { fileName: "廊下クロス.jpg" };
    expect(assignBodyPart(meta)).toContain("hallway");
  });

  it("階段 → [staircase]", () => {
    const meta: PhotoMeta = { fileName: "階段CF張り.jpg" };
    expect(assignBodyPart(meta)).toContain("staircase");
  });

  it("居室 → [living]", () => {
    const meta: PhotoMeta = { fileName: "居室フローリング.jpg" };
    expect(assignBodyPart(meta)).toContain("living");
  });

  it("トイレ → [toilet]", () => {
    const meta: PhotoMeta = { fileName: "トイレ便器交換.jpg" };
    expect(assignBodyPart(meta)).toContain("toilet");
  });

  it("洗面 → [washroom]", () => {
    const meta: PhotoMeta = { fileName: "洗面台設置.jpg" };
    expect(assignBodyPart(meta)).toContain("washroom");
  });

  it("複数部位: 浴室+洗面 → 両方返す", () => {
    const meta: PhotoMeta = { fileName: "浴室洗面工事.jpg" };
    const parts = assignBodyPart(meta);
    expect(parts).toContain("bathroom");
    expect(parts).toContain("washroom");
  });

  it("一致なし → 空配列", () => {
    const meta: PhotoMeta = { fileName: "IMG_999.jpg" };
    expect(assignBodyPart(meta)).toHaveLength(0);
  });

  it("タグ から部位を検出", () => {
    const meta: PhotoMeta = { fileName: "photo.jpg", tags: ["キッチン", "仕上"] };
    expect(assignBodyPart(meta)).toContain("kitchen");
  });

  it("caption から部位を検出", () => {
    const meta: PhotoMeta = { fileName: "photo.jpg", caption: "トイレ内タイル貼り完了" };
    expect(assignBodyPart(meta)).toContain("toilet");
  });
});

// ── computePerceptualHash ─────────────────────────────────────────────────────

function makeImageData(width: number, height: number, fillValue: number): ImageData {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = fillValue;     // R
    data[i + 1] = fillValue; // G
    data[i + 2] = fillValue; // B
    data[i + 3] = 255;       // A
  }
  return { data, width, height } as ImageData;
}

function makeImageDataGradient(width: number, height: number): ImageData {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const v = Math.round((x / width) * 255);
      data[idx] = v;
      data[idx + 1] = v;
      data[idx + 2] = v;
      data[idx + 3] = 255;
    }
  }
  return { data, width, height } as ImageData;
}

describe("computePerceptualHash", () => {
  it("同一画像は同じハッシュを返す", () => {
    const img = makeImageData(64, 64, 128);
    const h1 = computePerceptualHash(img);
    const h2 = computePerceptualHash(img);
    expect(h1).toBe(h2);
  });

  it("16文字の16進数文字列を返す", () => {
    const img = makeImageData(32, 32, 200);
    const hash = computePerceptualHash(img);
    expect(hash).toHaveLength(16);
    expect(/^[0-9a-f]{16}$/.test(hash)).toBe(true);
  });

  it("グラジェント画像と真っ黒画像は異なるハッシュ", () => {
    const grad = makeImageDataGradient(64, 64);
    const black = makeImageData(64, 64, 0);
    // 均一画像同士は同一ハッシュになるが、グラジェントは異なる
    expect(computePerceptualHash(grad)).not.toBe(computePerceptualHash(black));
  });

  it("グラジェント画像のハッシュは全ビット同一にならない", () => {
    const grad = makeImageDataGradient(64, 64);
    const hash = computePerceptualHash(grad);
    expect(hash).not.toBe("0000000000000000");
    expect(hash).not.toBe("ffffffffffffffff");
  });

  it("1x1 画像でもクラッシュしない", () => {
    const img = makeImageData(1, 1, 100);
    expect(() => computePerceptualHash(img)).not.toThrow();
  });
});

// ── findDuplicates ─────────────────────────────────────────────────────────────

describe("findDuplicates", () => {
  it("同一 pHash は重複グループに入る", () => {
    const photos: Photo[] = [
      { id: "a", pHash: "aaaaaaaaaaaaaaaa" },
      { id: "b", pHash: "aaaaaaaaaaaaaaaa" },
      { id: "c", pHash: "0000000000000000" },
    ];
    const groups = findDuplicates(photos, 5);
    expect(groups).toHaveLength(1);
    expect(groups[0].photos.map((p) => p.id)).toContain("a");
    expect(groups[0].photos.map((p) => p.id)).toContain("b");
  });

  it("ハミング距離 > threshold は別グループ", () => {
    // aaaa... vs 0000... → 距離 64
    const photos: Photo[] = [
      { id: "x", pHash: "aaaaaaaaaaaaaaaa" },
      { id: "y", pHash: "0000000000000000" },
    ];
    expect(findDuplicates(photos, 5)).toHaveLength(0);
  });

  it("threshold=0 は完全一致のみグループ化", () => {
    const photos: Photo[] = [
      { id: "p1", pHash: "1111111111111111" },
      { id: "p2", pHash: "1111111111111111" },
      { id: "p3", pHash: "1111111111111110" }, // 1ビット差
    ];
    const groups = findDuplicates(photos, 0);
    expect(groups).toHaveLength(1);
    expect(groups[0].photos).toHaveLength(2);
  });

  it("pHash なし写真はスキップ", () => {
    const photos: Photo[] = [
      { id: "n1" },
      { id: "n2" },
    ];
    expect(findDuplicates(photos, 5)).toHaveLength(0);
  });

  it("空配列 → 空配列", () => {
    expect(findDuplicates([], 5)).toHaveLength(0);
  });

  it("minDistance が正しく計算される", () => {
    const photos: Photo[] = [
      { id: "m1", pHash: "aaaaaaaaaaaaaaaa" },
      { id: "m2", pHash: "aaaaaaaaaaaaaaaa" }, // 距離 0
    ];
    const groups = findDuplicates(photos, 5);
    expect(groups[0].minDistance).toBe(0);
  });

  it("threshold 変化でグループ数が変わる", () => {
    // 2ビット差のペア
    const photos: Photo[] = [
      { id: "t1", pHash: "aaaaaaaaaaaaaaaa" },
      { id: "t2", pHash: "aaaaaaaaaaaaaa99" }, // 小さい差
    ];
    const strict = findDuplicates(photos, 0);
    const loose = findDuplicates(photos, 10);
    // loose は距離<=10 なら含める
    expect(loose.length).toBeGreaterThanOrEqual(strict.length);
  });
});
