import { describe, expect, it } from "vitest";
import {
  buildReinspectionList,
  compareInspections,
  createInspectionChecklist,
  evaluateInspection,
  generateInspectionReport,
  getFailureHotspots,
  getInspectionStatsByProject,
  type InspectionCheckItem,
  type InspectionRecord,
  type InspectionReportConfig,
} from "../lib/inspection-pipeline.js";

// ── ヘルパー ──────────────────────────────────────────────────────────────────

function makeItem(overrides?: Partial<InspectionCheckItem>): InspectionCheckItem {
  return {
    id: "item-1",
    category: "壁仕上",
    checkPoint: "クロス浮き",
    standard: "浮きなし",
    result: "pass",
    ...overrides,
  };
}

function makeRecord(overrides?: Partial<InspectionRecord>): InspectionRecord {
  return {
    id: "rec-1",
    projectId: "proj-1",
    inspectionType: "finish",
    location: "1号室",
    inspector: "田中",
    inspectedAt: new Date("2025-06-15"),
    items: [],
    overallResult: "pass",
    ...overrides,
  };
}

const DEFAULT_CONFIG: InspectionReportConfig = {
  title: "仕上検査報告書",
  companyName: "株式会社ラポルタ",
  projectName: "南青山リノベ",
  includeSummary: true,
  includePhotos: false,
  includeStatistics: true,
  signatureFields: ["検査員", "確認者"],
};

// ── createInspectionChecklist ─────────────────────────────────────────────────

describe("createInspectionChecklist", () => {
  it("仕上検査チェックリストは15件以上の項目を持つ", () => {
    const record = createInspectionChecklist("finish", "1F 廊下");
    expect(record.items.length).toBeGreaterThanOrEqual(15);
  });

  it("構造検査チェックリストは10件以上の項目を持つ", () => {
    const record = createInspectionChecklist("structural", "基礎");
    expect(record.items.length).toBeGreaterThanOrEqual(10);
  });

  it("設備検査チェックリストは12件以上の項目を持つ", () => {
    const record = createInspectionChecklist("mep", "機械室");
    expect(record.items.length).toBeGreaterThanOrEqual(12);
  });

  it("防水検査チェックリストは8件以上の項目を持つ", () => {
    const record = createInspectionChecklist("waterproof", "屋上");
    expect(record.items.length).toBeGreaterThanOrEqual(8);
  });

  it("全項目が pending で初期化される", () => {
    const record = createInspectionChecklist("finish", "2F 洋室");
    expect(record.items.every((i) => i.result === "pending")).toBe(true);
  });

  it("場所が record.location に設定される", () => {
    const record = createInspectionChecklist("mep", "地下1F 機械室");
    expect(record.location).toBe("地下1F 機械室");
  });

  it("各項目が category / checkPoint / standard を持つ", () => {
    const record = createInspectionChecklist("finish", "1F");
    for (const item of record.items) {
      expect(item.category).toBeTruthy();
      expect(item.checkPoint).toBeTruthy();
      expect(item.standard).toBeTruthy();
    }
  });

  it("各呼び出しで独立した項目IDが生成される", () => {
    const a = createInspectionChecklist("finish", "A室");
    const b = createInspectionChecklist("finish", "B室");
    const aIds = new Set(a.items.map((i) => i.id));
    const bIds = new Set(b.items.map((i) => i.id));
    for (const id of bIds) {
      expect(aIds.has(id)).toBe(false);
    }
  });
});

// ── evaluateInspection ────────────────────────────────────────────────────────

describe("evaluateInspection", () => {
  it("全項目合格なら overallResult は pass", () => {
    const record = makeRecord({
      items: [
        makeItem({ result: "pass" }),
        makeItem({ result: "pass" }),
        makeItem({ result: "na" }),
      ],
    });
    const result = evaluateInspection(record);
    expect(result.overallResult).toBe("pass");
  });

  it("1件でも fail があれば overallResult は fail", () => {
    const record = makeRecord({
      items: [
        makeItem({ result: "pass" }),
        makeItem({ result: "fail" }),
      ],
    });
    const result = evaluateInspection(record);
    expect(result.overallResult).toBe("fail");
  });

  it("全て na/pending なら overallResult は conditional", () => {
    const record = makeRecord({
      items: [
        makeItem({ result: "na" }),
        makeItem({ result: "pending" }),
      ],
    });
    const result = evaluateInspection(record);
    expect(result.overallResult).toBe("conditional");
  });

  it("空の items は conditional", () => {
    const record = makeRecord({ items: [] });
    const result = evaluateInspection(record);
    expect(result.overallResult).toBe("conditional");
  });

  it("元のレコードを変更しない（immutable）", () => {
    const record = makeRecord({
      items: [makeItem({ result: "fail" })],
      overallResult: "pass",
    });
    evaluateInspection(record);
    expect(record.overallResult).toBe("pass");
  });
});

// ── generateInspectionReport ──────────────────────────────────────────────────

describe("generateInspectionReport", () => {
  it("DOCTYPE html を含む", () => {
    const record = makeRecord({ items: [makeItem()] });
    const html = generateInspectionReport(record, DEFAULT_CONFIG);
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("</html>");
  });

  it("ヘッダーに会社名・現場名・検査員・日付を含む", () => {
    const record = makeRecord({
      inspector: "鈴木一郎",
      inspectedAt: new Date("2025-07-01"),
      items: [makeItem()],
    });
    const html = generateInspectionReport(record, DEFAULT_CONFIG);
    expect(html).toContain("株式会社ラポルタ");
    expect(html).toContain("南青山リノベ");
    expect(html).toContain("鈴木一郎");
    expect(html).toContain("2025");
  });

  it("includeSummary=true のとき合格/不合格件数を含む", () => {
    const record = makeRecord({
      items: [
        makeItem({ result: "pass" }),
        makeItem({ result: "fail" }),
      ],
    });
    const html = generateInspectionReport(record, { ...DEFAULT_CONFIG, includeSummary: true });
    expect(html).toContain("合格:");
    expect(html).toContain("不合格:");
  });

  it("includeSummary=false のとき合格/不合格カウントを含まない", () => {
    const record = makeRecord({ items: [makeItem()] });
    const html = generateInspectionReport(record, { ...DEFAULT_CONFIG, includeSummary: false });
    expect(html).not.toContain("合格:&lt;");
    // summary-bar div 要素が存在しないことを確認（CSS定義は除く）
    expect(html.indexOf('<div class="summary-bar">')).toBe(-1);
  });

  it("includeStatistics=true のとき合格率を含む", () => {
    const record = makeRecord({
      items: [makeItem({ result: "pass" }), makeItem({ result: "fail" })],
    });
    const html = generateInspectionReport(record, { ...DEFAULT_CONFIG, includeStatistics: true });
    expect(html).toContain("合格率");
    expect(html).toContain("%");
  });

  it("includePhotos=true のとき写真列を含む", () => {
    const record = makeRecord({
      items: [makeItem({ photoIds: ["photo-1"] })],
    });
    const html = generateInspectionReport(record, { ...DEFAULT_CONFIG, includePhotos: true });
    expect(html).toContain("写真");
  });

  it("signatureFields を含む", () => {
    const record = makeRecord({ items: [makeItem()] });
    const html = generateInspectionReport(record, DEFAULT_CONFIG);
    expect(html).toContain("検査員");
    expect(html).toContain("確認者");
  });

  it("signatureFields が空のとき署名欄を含まない", () => {
    const record = makeRecord({ items: [makeItem()] });
    const html = generateInspectionReport(record, { ...DEFAULT_CONFIG, signatureFields: [] });
    expect(html.indexOf('<div class="sig-field">')).toBe(-1);
  });

  it("floor と room が場所情報に含まれる", () => {
    const record = makeRecord({ floor: 3, room: "301号室", items: [makeItem()] });
    const html = generateInspectionReport(record, DEFAULT_CONFIG);
    expect(html).toContain("3F");
    expect(html).toContain("301号室");
  });

  it("ユーザー入力のHTMLをエスケープする", () => {
    const record = makeRecord({
      inspector: '<script>alert("xss")</script>',
      items: [makeItem({ note: "<b>bold</b>" })],
    });
    const html = generateInspectionReport(record, DEFAULT_CONFIG);
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("A4印刷用CSS @page を含む", () => {
    const record = makeRecord({ items: [makeItem()] });
    const html = generateInspectionReport(record, DEFAULT_CONFIG);
    expect(html).toContain("@page");
    expect(html).toContain("A4");
  });

  it("fail 行は背景色が強調される", () => {
    const record = makeRecord({
      items: [makeItem({ result: "fail" })],
    });
    const html = generateInspectionReport(record, DEFAULT_CONFIG);
    expect(html).toContain("fef2f2");
  });
});

// ── getInspectionStatsByProject ───────────────────────────────────────────────

describe("getInspectionStatsByProject", () => {
  it("検査総数を正しく集計する", () => {
    const records = [
      makeRecord({ inspectionType: "finish" }),
      makeRecord({ inspectionType: "mep" }),
      makeRecord({ inspectionType: "structural" }),
    ];
    const stats = getInspectionStatsByProject(records);
    expect(stats.totalInspections).toBe(3);
  });

  it("種別ごとの合格率を計算する", () => {
    const records = [
      makeRecord({ inspectionType: "finish", overallResult: "pass" }),
      makeRecord({ inspectionType: "finish", overallResult: "fail" }),
      makeRecord({ inspectionType: "mep", overallResult: "pass" }),
    ];
    const stats = getInspectionStatsByProject(records);
    expect(stats.passRateByType.finish).toBeCloseTo(0.5);
    expect(stats.passRateByType.mep).toBeCloseTo(1.0);
  });

  it("データなし種別の合格率は 1", () => {
    const stats = getInspectionStatsByProject([]);
    expect(stats.passRateByType.waterproof).toBe(1);
  });

  it("よくある不合格チェックポイントを多い順に返す", () => {
    const records = [
      makeRecord({
        items: [
          makeItem({ checkPoint: "クロス浮き", result: "fail" }),
          makeItem({ checkPoint: "配管勾配", result: "fail" }),
        ],
      }),
      makeRecord({
        items: [makeItem({ checkPoint: "クロス浮き", result: "fail" })],
      }),
    ];
    const stats = getInspectionStatsByProject(records);
    expect(stats.commonFailurePoints[0].checkPoint).toBe("クロス浮き");
    expect(stats.commonFailurePoints[0].failCount).toBe(2);
  });

  it("空の records で空の commonFailurePoints を返す", () => {
    const stats = getInspectionStatsByProject([]);
    expect(stats.commonFailurePoints).toHaveLength(0);
  });
});

// ── getFailureHotspots ────────────────────────────────────────────────────────

describe("getFailureHotspots", () => {
  it("失敗回数の多い順に返す", () => {
    const records = [
      makeRecord({
        location: "1F",
        items: [makeItem({ checkPoint: "クロス浮き", result: "fail" })],
      }),
      makeRecord({
        location: "2F",
        items: [makeItem({ checkPoint: "クロス浮き", result: "fail" })],
      }),
      makeRecord({
        location: "3F",
        items: [makeItem({ checkPoint: "配管勾配", result: "fail" })],
      }),
    ];
    const hotspots = getFailureHotspots(records);
    expect(hotspots[0].checkPoint).toBe("クロス浮き");
    expect(hotspots[0].failCount).toBe(2);
  });

  it("ホットスポットに複数の場所を集約する", () => {
    const records = [
      makeRecord({
        location: "A棟",
        items: [makeItem({ checkPoint: "クロス浮き", result: "fail" })],
      }),
      makeRecord({
        location: "B棟",
        items: [makeItem({ checkPoint: "クロス浮き", result: "fail" })],
      }),
    ];
    const hotspots = getFailureHotspots(records);
    expect(hotspots[0].locations).toContain("A棟");
    expect(hotspots[0].locations).toContain("B棟");
  });

  it("floor 情報を集約する", () => {
    const records = [
      makeRecord({
        floor: 2,
        items: [makeItem({ checkPoint: "配管勾配", result: "fail" })],
      }),
      makeRecord({
        floor: 4,
        items: [makeItem({ checkPoint: "配管勾配", result: "fail" })],
      }),
    ];
    const hotspots = getFailureHotspots(records);
    expect(hotspots[0].floors).toContain(2);
    expect(hotspots[0].floors).toContain(4);
  });

  it("pass/na/pending 項目を無視する", () => {
    const records = [
      makeRecord({
        items: [
          makeItem({ checkPoint: "クロス浮き", result: "pass" }),
          makeItem({ checkPoint: "配管勾配", result: "na" }),
        ],
      }),
    ];
    const hotspots = getFailureHotspots(records);
    expect(hotspots).toHaveLength(0);
  });

  it("空の records で空の配列を返す", () => {
    expect(getFailureHotspots([])).toHaveLength(0);
  });
});

// ── buildReinspectionList ─────────────────────────────────────────────────────

describe("buildReinspectionList", () => {
  it("fail 項目のみを抽出する", () => {
    const record = makeRecord({
      items: [
        makeItem({ result: "pass" }),
        makeItem({ result: "fail", checkPoint: "クロス浮き" }),
        makeItem({ result: "na" }),
      ],
    });
    const reInspection = buildReinspectionList(record);
    expect(reInspection.items).toHaveLength(1);
    expect(reInspection.items[0].checkPoint).toBe("クロス浮き");
  });

  it("再検査リストの全項目は pending", () => {
    const record = makeRecord({
      items: [makeItem({ result: "fail" }), makeItem({ result: "fail" })],
    });
    const reInspection = buildReinspectionList(record);
    expect(reInspection.items.every((i) => i.result === "pending")).toBe(true);
  });

  it("既存の備考に [再検査] プレフィクスを付加する", () => {
    const record = makeRecord({
      items: [makeItem({ result: "fail", note: "ひび割れあり" })],
    });
    const reInspection = buildReinspectionList(record);
    expect(reInspection.items[0].note).toContain("[再検査]");
    expect(reInspection.items[0].note).toContain("ひび割れあり");
  });

  it("note が空の場合も [再検査] を付加する", () => {
    const record = makeRecord({
      items: [makeItem({ result: "fail", note: undefined })],
    });
    const reInspection = buildReinspectionList(record);
    expect(reInspection.items[0].note).toContain("[再検査]");
  });

  it("fail 項目がなければ空の items を返す", () => {
    const record = makeRecord({
      items: [makeItem({ result: "pass" }), makeItem({ result: "na" })],
    });
    const reInspection = buildReinspectionList(record);
    expect(reInspection.items).toHaveLength(0);
  });

  it("元のレコードの inspectionType と location を引き継ぐ", () => {
    const record = makeRecord({
      inspectionType: "mep",
      location: "機械室",
      items: [makeItem({ result: "fail" })],
    });
    const reInspection = buildReinspectionList(record);
    expect(reInspection.inspectionType).toBe("mep");
    expect(reInspection.location).toBe("機械室");
  });

  it("新しい ID が生成される", () => {
    const record = makeRecord({ items: [makeItem({ result: "fail" })] });
    const reInspection = buildReinspectionList(record);
    expect(reInspection.id).not.toBe(record.id);
    expect(reInspection.items[0].id).not.toBe(record.items[0].id);
  });
});

// ── compareInspections ────────────────────────────────────────────────────────

describe("compareInspections", () => {
  it("fail→pass を improved として検出する", () => {
    const before = makeRecord({
      items: [makeItem({ checkPoint: "クロス浮き", result: "fail" })],
    });
    const after = makeRecord({
      items: [makeItem({ checkPoint: "クロス浮き", result: "pass" })],
    });
    const comparisons = compareInspections(before, after);
    expect(comparisons[0].improved).toBe(true);
    expect(comparisons[0].regressed).toBe(false);
  });

  it("pass→fail を regressed として検出する", () => {
    const before = makeRecord({
      items: [makeItem({ checkPoint: "クロス浮き", result: "pass" })],
    });
    const after = makeRecord({
      items: [makeItem({ checkPoint: "クロス浮き", result: "fail" })],
    });
    const comparisons = compareInspections(before, after);
    expect(comparisons[0].regressed).toBe(true);
    expect(comparisons[0].improved).toBe(false);
  });

  it("after に存在しない項目は removed", () => {
    const before = makeRecord({
      items: [makeItem({ checkPoint: "削除項目", result: "fail" })],
    });
    const after = makeRecord({ items: [] });
    const comparisons = compareInspections(before, after);
    expect(comparisons[0].afterResult).toBe("removed");
  });

  it("変化なしの項目は improved も regressed も false", () => {
    const before = makeRecord({
      items: [makeItem({ checkPoint: "クロス浮き", result: "pass" })],
    });
    const after = makeRecord({
      items: [makeItem({ checkPoint: "クロス浮き", result: "pass" })],
    });
    const comparisons = compareInspections(before, after);
    expect(comparisons[0].improved).toBe(false);
    expect(comparisons[0].regressed).toBe(false);
  });

  it("before の全項目に対して比較結果を返す", () => {
    const before = makeRecord({
      items: [
        makeItem({ id: "1", checkPoint: "A項目", result: "fail" }),
        makeItem({ id: "2", checkPoint: "B項目", result: "pass" }),
        makeItem({ id: "3", checkPoint: "C項目", result: "na" }),
      ],
    });
    const after = makeRecord({
      items: [
        makeItem({ checkPoint: "A項目", result: "pass" }),
        makeItem({ checkPoint: "B項目", result: "fail" }),
      ],
    });
    const comparisons = compareInspections(before, after);
    expect(comparisons).toHaveLength(3);
    expect(comparisons.find((c) => c.checkPoint === "C項目")?.afterResult).toBe("removed");
  });

  it("空の before は空の比較結果を返す", () => {
    const before = makeRecord({ items: [] });
    const after = makeRecord({ items: [makeItem()] });
    const comparisons = compareInspections(before, after);
    expect(comparisons).toHaveLength(0);
  });
});
