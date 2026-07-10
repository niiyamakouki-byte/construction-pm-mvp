import { describe, it, expect } from "vitest";
import { generateEstimatePdf } from "./pdf-estimate.js";
import { NOTO_SANS_JP_REGULAR_BASE64 } from "./noto-sans-jp-font.js";
import type { Estimate } from "./types.js";

/**
 * TTF cmap (format 4, BMP) の最小パーサ。
 * ponytail: 文字化け総点検(2026-07-10)で「㎡」「①」等がグリフ欠落により
 * 無音で消える不具合が見つかった際、PDF生成が例外を投げない/サイズ>0という
 * チェックだけでは同種の回帰を検知できない（元の不具合も無例外だった）。
 * embedフォントのcmapを直接読み、対象コードポイントの実グリフ有無を検証する。
 * fonttools等の外部依存を増やさず、format 4のみ対応（対象は全てBMP内）。
 */
function hasGlyph(fontBase64: string, codePoint: number): boolean {
  const buf = Buffer.from(fontBase64, "base64");
  const numTables = buf.readUInt16BE(4);
  let cmapOffset = -1;
  for (let i = 0; i < numTables; i++) {
    const rec = 12 + i * 16;
    const tag = buf.toString("ascii", rec, rec + 4);
    if (tag === "cmap") {
      cmapOffset = buf.readUInt32BE(rec + 8);
      break;
    }
  }
  if (cmapOffset < 0) throw new Error("cmap table not found");

  const cmapTableCount = buf.readUInt16BE(cmapOffset + 2);
  let subtableOffset = -1;
  for (let i = 0; i < cmapTableCount; i++) {
    const rec = cmapOffset + 4 + i * 8;
    const platformID = buf.readUInt16BE(rec);
    const encodingID = buf.readUInt16BE(rec + 2);
    const offset = buf.readUInt32BE(rec + 4);
    // Windows BMP (3,1) か Unicode (0,x) の format 4 を優先して探す
    if ((platformID === 3 && encodingID === 1) || platformID === 0) {
      const candidate = cmapOffset + offset;
      if (buf.readUInt16BE(candidate) === 4) {
        subtableOffset = candidate;
        break;
      }
    }
  }
  if (subtableOffset < 0) throw new Error("format 4 cmap subtable not found");

  const segCountX2 = buf.readUInt16BE(subtableOffset + 6);
  const segCount = segCountX2 / 2;
  const endCodeStart = subtableOffset + 14;
  const startCodeStart = endCodeStart + segCountX2 + 2; // +2 for reservedPad
  const idDeltaStart = startCodeStart + segCountX2;
  const idRangeOffsetStart = idDeltaStart + segCountX2;

  for (let seg = 0; seg < segCount; seg++) {
    const endCode = buf.readUInt16BE(endCodeStart + seg * 2);
    const startCode = buf.readUInt16BE(startCodeStart + seg * 2);
    if (codePoint < startCode || codePoint > endCode) continue;
    const idDelta = buf.readInt16BE(idDeltaStart + seg * 2);
    const idRangeOffset = buf.readUInt16BE(idRangeOffsetStart + seg * 2);
    let glyphId: number;
    if (idRangeOffset === 0) {
      glyphId = (codePoint + idDelta) & 0xffff;
    } else {
      const glyphIndexAddr =
        idRangeOffsetStart + seg * 2 + idRangeOffset + (codePoint - startCode) * 2;
      const rawGlyphId = buf.readUInt16BE(glyphIndexAddr);
      glyphId = rawGlyphId === 0 ? 0 : (rawGlyphId + idDelta) & 0xffff;
    }
    return glyphId !== 0;
  }
  return false;
}

describe("NotoSansJP subset font - glyph coverage", () => {
  it.each([
    ["㎡", "U+33A1 平方メートル"],
    ["㎥", "U+33A5 立方メートル"],
    ["㎏", "U+338F キログラム"],
    ["㎜", "U+339C ミリメートル"],
    ["㎝", "U+339D センチメートル"],
    ["①", "U+2460 丸数字1"],
    ["②", "U+2461 丸数字2"],
    ["③", "U+2462 丸数字3"],
    ["℃", "U+2103 摂氏"],
    ["φ", "U+03C6 ファイ"],
    ["渋", "U+6E0B 常用漢字(地名等)"],
  ])("has a real glyph for %s (%s)", (char) => {
    const codePoint = char.codePointAt(0)!;
    expect(hasGlyph(NOTO_SANS_JP_REGULAR_BASE64, codePoint)).toBe(true);
  });
});

describe("generateEstimatePdf", () => {
  it("生成した見積書PDFに単位記号・丸数字を含めても例外を投げない", async () => {
    const estimate: Estimate = {
      id: "EST-TEST-001",
      propertyName: "サンプル邸 リビング20㎡改修",
      clientName: "テスト工務店",
      createdAt: "2026-07-10",
      validUntil: "2026-08-10",
      sections: [
        {
          categoryId: "c1",
          categoryName: "①内装工事",
          lines: [
            {
              code: "I-001",
              name: "フローリング張替 φ100 換気口周り〜壁際",
              unit: "㎡",
              quantity: 20,
              unitPrice: 8000,
              amount: 160000,
              note: "20㎡分",
            },
          ],
          subtotal: 160000,
        },
      ],
      directCost: 160000,
      managementFee: 16000,
      managementFeeRate: 0.1,
      generalExpense: 8000,
      generalExpenseRate: 0.05,
      subtotal: 184000,
      tax: 18400,
      taxRate: 0.1,
      total: 202400,
      notes: ["①〜③は同時着工予定"],
    };

    const blob = await generateEstimatePdf(estimate);
    expect(blob.size).toBeGreaterThan(0);
  });
});
