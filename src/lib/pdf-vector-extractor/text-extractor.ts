/**
 * テキスト抽出
 *
 * PDFPageProxy.getTextContent() の各 item を、PDF 座標系（左下原点・pt）の
 * 位置と font_size を持つ TextItem へ変換する。
 * 寸法値判定（is_dimension_value / parsed_mm）はここでは行わず null/false 固定。
 * 必要なら scale-detector / 後段が処理する。
 */

import type { PDFPageProxy } from "pdfjs-dist";
import type { TextItem } from "../pdf-to-estimate/types.js";

type PdfTextItem = {
  str: string;
  // [a, b, c, d, e, f] — e,f が位置（PDF 座標、左下原点）
  transform: number[];
  height?: number;
};

/**
 * ページからテキスト項目を抽出する。空文字（改行マーカ等）は除外。
 */
export async function extractTextItems(page: PDFPageProxy): Promise<TextItem[]> {
  const content = await page.getTextContent();
  const items: TextItem[] = [];
  for (const raw of content.items as unknown as PdfTextItem[]) {
    if (typeof raw.str !== "string" || raw.str.trim() === "") continue;
    const transform = raw.transform;
    const x = transform[4];
    const y = transform[5];
    // font_size: transform の縦スケール（d 成分）が概ねフォントサイズ
    const fontSize = Math.hypot(transform[2], transform[3]) || raw.height || 0;
    items.push({
      text: raw.str,
      position: { x, y },
      font_size: fontSize,
      is_dimension_value: false,
      parsed_mm: null,
    });
  }
  return items;
}
