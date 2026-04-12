import { describe, expect, it, beforeEach } from "vitest";
import {
  INTERIOR_INSPECTION_TEMPLATES,
  createInspectionFromTemplate,
  clearInspections,
  type InspectionTemplate,
  type TemplateItem,
} from "./finish-inspection.js";

beforeEach(() => {
  clearInspections();
});

describe("INTERIOR_INSPECTION_TEMPLATES", () => {
  it("3テンプレートが定義されている", () => {
    expect(INTERIOR_INSPECTION_TEMPLATES).toHaveLength(3);
  });

  it("クロス仕上げ検査テンプレートが存在する", () => {
    const tpl = INTERIOR_INSPECTION_TEMPLATES.find((t) => t.name === "クロス仕上げ検査");
    expect(tpl).toBeDefined();
    expect(tpl!.category).toBe("クロス");
  });

  it("塗装仕上げ検査テンプレートが存在する", () => {
    const tpl = INTERIOR_INSPECTION_TEMPLATES.find((t) => t.name === "塗装仕上げ検査");
    expect(tpl).toBeDefined();
    expect(tpl!.category).toBe("塗装");
  });

  it("床仕上げ検査テンプレートが存在する", () => {
    const tpl = INTERIOR_INSPECTION_TEMPLATES.find((t) => t.name === "床仕上げ検査");
    expect(tpl).toBeDefined();
    expect(tpl!.category).toBe("床仕上");
  });

  it("各テンプレートのitemsが1件以上ある", () => {
    for (const tpl of INTERIOR_INSPECTION_TEMPLATES) {
      expect(tpl.items.length).toBeGreaterThan(0);
    }
  });

  it("各TemplateItemにcheckPointsが1件以上ある", () => {
    for (const tpl of INTERIOR_INSPECTION_TEMPLATES) {
      for (const item of tpl.items) {
        expect(item.checkPoints.length).toBeGreaterThan(0);
      }
    }
  });

  it("クロス仕上げ検査に浮き・剥がれ項目が含まれる", () => {
    const tpl = INTERIOR_INSPECTION_TEMPLATES.find((t) => t.name === "クロス仕上げ検査")!;
    const item = tpl.items.find((i) => i.description.includes("浮き"));
    expect(item).toBeDefined();
  });

  it("クロス仕上げ検査にSW廻り項目が含まれる", () => {
    const tpl = INTERIOR_INSPECTION_TEMPLATES.find((t) => t.name === "クロス仕上げ検査")!;
    const item = tpl.items.find((i) => i.description.includes("スイッチ"));
    expect(item).toBeDefined();
  });

  it("塗装仕上げ検査に塗膜厚項目が含まれる", () => {
    const tpl = INTERIOR_INSPECTION_TEMPLATES.find((t) => t.name === "塗装仕上げ検査")!;
    const item = tpl.items.find((i) => i.description.includes("塗膜厚"));
    expect(item).toBeDefined();
  });

  it("床仕上げ検査にタイル目地項目が含まれる", () => {
    const tpl = INTERIOR_INSPECTION_TEMPLATES.find((t) => t.name === "床仕上げ検査")!;
    const item = tpl.items.find((i) => i.description.includes("タイル目地"));
    expect(item).toBeDefined();
  });
});

describe("createInspectionFromTemplate", () => {
  it("クロス仕上げ検査テンプレートから検査を生成できる", () => {
    const inspection = createInspectionFromTemplate("proj-1", "101号室", "クロス仕上げ検査");
    expect(inspection.projectId).toBe("proj-1");
    expect(inspection.roomName).toBe("101号室");
    expect(inspection.items.length).toBeGreaterThan(0);
  });

  it("塗装仕上げ検査テンプレートから検査を生成できる", () => {
    const inspection = createInspectionFromTemplate("proj-2", "応接室", "塗装仕上げ検査");
    expect(inspection.items.length).toBeGreaterThan(0);
  });

  it("床仕上げ検査テンプレートから検査を生成できる", () => {
    const inspection = createInspectionFromTemplate("proj-3", "廊下", "床仕上げ検査");
    expect(inspection.items.length).toBeGreaterThan(0);
  });

  it("生成された検査項目の初期ステータスはna", () => {
    const inspection = createInspectionFromTemplate("proj-1", "101号室", "クロス仕上げ検査");
    for (const item of inspection.items) {
      expect(item.status).toBe("na");
    }
  });

  it("生成された検査項目の説明にチェックポイントが含まれる", () => {
    const tpl = INTERIOR_INSPECTION_TEMPLATES.find((t) => t.name === "クロス仕上げ検査")!;
    const inspection = createInspectionFromTemplate("proj-1", "101号室", "クロス仕上げ検査");
    // テンプレート1件目のチェックポイントが説明に含まれること
    const firstPoint = tpl.items[0].checkPoints[0];
    const match = inspection.items.find((i) => i.description.includes(firstPoint));
    expect(match).toBeDefined();
  });

  it("存在しないテンプレート名を指定するとエラーになる", () => {
    expect(() =>
      createInspectionFromTemplate("proj-1", "101号室", "存在しないテンプレート"),
    ).toThrow('InspectionTemplate "存在しないテンプレート" not found');
  });

  it("テンプレートから生成した検査のステータスはin_progress", () => {
    const inspection = createInspectionFromTemplate("proj-1", "101号室", "クロス仕上げ検査");
    // 項目が追加されるのでin_progressになる
    expect(inspection.status).toBe("in_progress");
  });
});
