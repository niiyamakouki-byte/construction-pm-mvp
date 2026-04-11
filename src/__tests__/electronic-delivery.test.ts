import { describe, it, expect } from "vitest";
import {
  createDeliveryPackage,
  generateDeliveryFileList,
  validatePackage,
  buildDeliveryIndexHtml,
  CALS_FOLDER_STRUCTURE,
  type DeliveryPackage,
} from "../lib/electronic-delivery.js";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const baseOptions = {
  projectName: "南青山テストビル 内装改修工事",
  photos: [
    { originalName: "施工前.jpg", category: "着手前写真", metadata: { shootDate: "2024-04-01" } },
    { originalName: "施工中.jpg", category: "施工状況写真" },
  ],
  drawings: [
    { originalName: "平面図.dwg", category: "建築図" },
  ],
  createdAt: "2024-07-01T09:00:00.000Z",
};

function makePkg(overrides: Partial<typeof baseOptions> = {}): DeliveryPackage {
  return createDeliveryPackage("PRJ-001", { ...baseOptions, ...overrides });
}

// ── パッケージ生成 ────────────────────────────────────────────────────────────

describe("createDeliveryPackage — パッケージ生成", () => {
  it("standardVersionがCALS/EC v4.0である", () => {
    const pkg = makePkg();
    expect(pkg.standardVersion).toBe("CALS/EC v4.0");
  });

  it("projectIdとprojectNameが正しく設定される", () => {
    const pkg = makePkg();
    expect(pkg.projectId).toBe("PRJ-001");
    expect(pkg.projectName).toBe("南青山テストビル 内装改修工事");
  });

  it("idが生成される", () => {
    const pkg = makePkg();
    expect(pkg.id).toBeTruthy();
    expect(typeof pkg.id).toBe("string");
  });

  it("createdAtが指定値で設定される", () => {
    const pkg = makePkg();
    expect(pkg.createdAt).toBe("2024-07-01T09:00:00.000Z");
  });

  it("createdAt省略時は現在時刻のISOが設定される", () => {
    const pkg = createDeliveryPackage("PRJ-002", { projectName: "テスト工事" });
    expect(pkg.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("ファイルを渡さないフォルダは生成されない", () => {
    const pkg = createDeliveryPackage("PRJ-003", {
      projectName: "テスト工事",
      photos: [{ originalName: "test.jpg", category: "写真" }],
    });
    const folderNames = pkg.folders.map((f) => f.name);
    expect(folderNames).toContain("PHOTO");
    expect(folderNames).not.toContain("DRAWING");
    expect(folderNames).not.toContain("BORING");
  });
});

// ── ファイル名規格準拠 ────────────────────────────────────────────────────────

describe("納品ファイル名 — 規格準拠", () => {
  it("写真フォルダのdeliveryNameはPH+6桁+拡張子", () => {
    const pkg = makePkg();
    const photoFolder = pkg.folders.find((f) => f.name === "PHOTO")!;
    expect(photoFolder.files[0].deliveryName).toMatch(/^PH\d{6}\.\w+$/);
    expect(photoFolder.files[0].deliveryName).toBe("PH000001.JPG");
  });

  it("図面フォルダのdeliveryNameはDR+6桁+拡張子", () => {
    const pkg = makePkg();
    const drawingFolder = pkg.folders.find((f) => f.name === "DRAWING")!;
    expect(drawingFolder.files[0].deliveryName).toBe("DR000001.DWG");
  });

  it("複数ファイルの連番が正しい", () => {
    const pkg = makePkg();
    const photoFolder = pkg.folders.find((f) => f.name === "PHOTO")!;
    expect(photoFolder.files[0].deliveryName).toBe("PH000001.JPG");
    expect(photoFolder.files[1].deliveryName).toBe("PH000002.JPG");
  });

  it("originalNameとcategoryが保持される", () => {
    const pkg = makePkg();
    const photoFolder = pkg.folders.find((f) => f.name === "PHOTO")!;
    expect(photoFolder.files[0].originalName).toBe("施工前.jpg");
    expect(photoFolder.files[0].category).toBe("着手前写真");
  });

  it("metadataが保持される", () => {
    const pkg = makePkg();
    const photoFolder = pkg.folders.find((f) => f.name === "PHOTO")!;
    expect(photoFolder.files[0].metadata).toEqual({ shootDate: "2024-04-01" });
  });

  it("metadata省略時は空オブジェクト", () => {
    const pkg = makePkg();
    const photoFolder = pkg.folders.find((f) => f.name === "PHOTO")!;
    expect(photoFolder.files[1].metadata).toEqual({});
  });
});

// ── バリデーション ────────────────────────────────────────────────────────────

describe("validatePackage — バリデーション", () => {
  it("正常なパッケージはvalid=trueでエラーなし", () => {
    const pkg = makePkg();
    const result = validatePackage(pkg);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("projectIdが空だとエラー", () => {
    const pkg = makePkg();
    const invalidPkg = { ...pkg, projectId: "" };
    const result = validatePackage(invalidPkg);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("projectId"))).toBe(true);
  });

  it("projectNameが空だとエラー", () => {
    const pkg = makePkg();
    const invalidPkg = { ...pkg, projectName: "" };
    const result = validatePackage(invalidPkg);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("projectName"))).toBe(true);
  });

  it("standardVersionが不正だとエラー", () => {
    const pkg = makePkg();
    const invalidPkg = { ...pkg, standardVersion: "CALS/EC v3.0" as "CALS/EC v4.0" };
    const result = validatePackage(invalidPkg);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("standardVersion"))).toBe(true);
  });

  it("createdAtが不正な形式だとエラー", () => {
    const pkg = makePkg();
    const invalidPkg = { ...pkg, createdAt: "2024/07/01" };
    const result = validatePackage(invalidPkg);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("createdAt"))).toBe(true);
  });

  it("フォルダが空だとwarningが出る", () => {
    const pkg = createDeliveryPackage("PRJ-004", {
      projectName: "テスト工事",
      createdAt: "2024-07-01T00:00:00.000Z",
    });
    const result = validatePackage(pkg);
    expect(result.valid).toBe(true);
    expect(result.warnings.some((w) => w.includes("空"))).toBe(true);
  });

  it("フォルダ名が重複するとエラー", () => {
    const pkg = makePkg();
    const dupPkg: DeliveryPackage = {
      ...pkg,
      folders: [
        { name: "PHOTO", files: [] },
        { name: "PHOTO", files: [] },
      ],
    };
    const result = validatePackage(dupPkg);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("重複"))).toBe(true);
  });
});

// ── フォルダ構成 ──────────────────────────────────────────────────────────────

describe("CALS_FOLDER_STRUCTURE — 標準フォルダ構成", () => {
  it("6つの標準フォルダが定義されている", () => {
    const keys = Object.keys(CALS_FOLDER_STRUCTURE);
    expect(keys).toHaveLength(6);
    expect(keys).toContain("PHOTO");
    expect(keys).toContain("DRAWING");
    expect(keys).toContain("BORING");
    expect(keys).toContain("MEET");
    expect(keys).toContain("PLAN");
    expect(keys).toContain("OTHRS");
  });

  it("各フォルダに日本語ラベルが設定されている", () => {
    expect(CALS_FOLDER_STRUCTURE.PHOTO).toBe("写真フォルダ");
    expect(CALS_FOLDER_STRUCTURE.DRAWING).toBe("図面フォルダ");
    expect(CALS_FOLDER_STRUCTURE.BORING).toBe("地盤調査・試験フォルダ");
  });
});

// ── INDEX_D.XML 生成 ──────────────────────────────────────────────────────────

describe("generateDeliveryFileList — INDEX_D.XML", () => {
  it("XMLヘッダーが含まれる", () => {
    const pkg = makePkg();
    const xml = generateDeliveryFileList(pkg);
    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
  });

  it("INDEX_Dルート要素とversion属性が含まれる", () => {
    const pkg = makePkg();
    const xml = generateDeliveryFileList(pkg);
    expect(xml).toContain('<INDEX_D version="4.0">');
    expect(xml).toContain("</INDEX_D>");
  });

  it("プロジェクト情報が含まれる", () => {
    const pkg = makePkg();
    const xml = generateDeliveryFileList(pkg);
    expect(xml).toContain("<PROJECT_ID>PRJ-001</PROJECT_ID>");
    expect(xml).toContain("<PROJECT_NAME>南青山テストビル 内装改修工事</PROJECT_NAME>");
    expect(xml).toContain("<STANDARD_VERSION>CALS/EC v4.0</STANDARD_VERSION>");
  });

  it("FOLDER要素にname属性とlabel属性が含まれる", () => {
    const pkg = makePkg();
    const xml = generateDeliveryFileList(pkg);
    expect(xml).toContain('name="PHOTO"');
    expect(xml).toContain('label="写真フォルダ"');
  });

  it("FILE要素にORIGINAL_NAMEとDELIVERY_NAMEが含まれる", () => {
    const pkg = makePkg();
    const xml = generateDeliveryFileList(pkg);
    expect(xml).toContain("<ORIGINAL_NAME>施工前.jpg</ORIGINAL_NAME>");
    expect(xml).toContain("<DELIVERY_NAME>PH000001.JPG</DELIVERY_NAME>");
  });

  it("metadataの内容がXML要素として出力される", () => {
    const pkg = makePkg();
    const xml = generateDeliveryFileList(pkg);
    expect(xml).toContain('<META key="shootDate" value="2024-04-01"/>');

  });

  it("特殊文字がXMLエスケープされる", () => {
    const pkg = createDeliveryPackage("PRJ&XSS", {
      projectName: '<script>alert("xss")</script>',
      photos: [{ originalName: "test.jpg", category: "写真" }],
      createdAt: "2024-07-01T00:00:00.000Z",
    });
    const xml = generateDeliveryFileList(pkg);
    expect(xml).not.toContain("<script>");
    expect(xml).toContain("&lt;script&gt;");
    expect(xml).toContain("&amp;XSS");
  });
});

// ── 納品物一覧HTML ────────────────────────────────────────────────────────────

describe("buildDeliveryIndexHtml — 納品物一覧HTML", () => {
  it("DOCTYPE宣言と日本語lang属性を含む", () => {
    const pkg = makePkg();
    const html = buildDeliveryIndexHtml(pkg);
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain('lang="ja"');
  });

  it("工事名がtitleとh1に含まれる", () => {
    const pkg = makePkg();
    const html = buildDeliveryIndexHtml(pkg);
    expect(html).toContain("南青山テストビル 内装改修工事 — 電子納品 納品物一覧");
    expect(html).toContain("<h1>");
  });

  it("規格情報が含まれる", () => {
    const pkg = makePkg();
    const html = buildDeliveryIndexHtml(pkg);
    expect(html).toContain("CALS/EC v4.0");
  });

  it("納品ファイル名と原ファイル名がテーブルに含まれる", () => {
    const pkg = makePkg();
    const html = buildDeliveryIndexHtml(pkg);
    expect(html).toContain("PH000001.JPG");
    expect(html).toContain("施工前.jpg");
  });

  it("フォルダ名列ヘッダーが含まれる", () => {
    const pkg = makePkg();
    const html = buildDeliveryIndexHtml(pkg);
    expect(html).toContain("フォルダ");
    expect(html).toContain("納品ファイル名");
    expect(html).toContain("原ファイル名");
  });

  it("HTMLインジェクション文字がエスケープされる", () => {
    const pkg = createDeliveryPackage("PRJ-XSS", {
      projectName: "<script>xss</script>",
      photos: [{ originalName: "test.jpg", category: "写真" }],
      createdAt: "2024-07-01T00:00:00.000Z",
    });
    const html = buildDeliveryIndexHtml(pkg);
    expect(html).not.toContain("<script>xss</script>");
    expect(html).toContain("&lt;script&gt;");
  });
});
