import { jsPDF } from "jspdf";
import type { Estimate } from "./types.js";

/** 金額を日本円フォーマット */
function yen(n: number): string {
  return `\xA5${n.toLocaleString("ja-JP")}`;
}

/**
 * ArrayBuffer を base64 文字列に変換
 */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Noto Sans JP (subset) を Google Fonts CDN から取得して jsPDF に登録する。
 * 一度取得したらモジュールスコープでキャッシュする。
 */
let cachedFontBase64: string | null = null;

async function loadJapaneseFontBase64(): Promise<string | null> {
  if (cachedFontBase64 !== null) return cachedFontBase64;

  // Google Fonts API で Noto Sans JP Regular の TTF を取得
  // ※ CORS: fonts.gstatic.com は cross-origin リクエストを許可している
  const FONT_URL =
    "https://fonts.gstatic.com/s/notosansjp/v53/-F6jfjtqLzI2JPCgQBnw7HFyzSD-AsregP8VFBEj75s5bDakDfgyUU4u1E8K4vlh4A.ttf";

  try {
    const response = await fetch(FONT_URL);
    if (!response.ok) throw new Error(`Font fetch failed: ${response.status}`);
    const buffer = await response.arrayBuffer();
    cachedFontBase64 = arrayBufferToBase64(buffer);
    return cachedFontBase64;
  } catch {
    // フォント取得失敗時は null を返す（Latin フォールバックを使用）
    return null;
  }
}

/**
 * jsPDF インスタンスに日本語フォントを設定する。
 * フォント取得に失敗した場合は Helvetica にフォールバックする。
 */
async function setupJapaneseFont(doc: jsPDF): Promise<void> {
  const fontBase64 = await loadJapaneseFontBase64();
  if (fontBase64) {
    doc.addFileToVFS("NotoSansJP-Regular.ttf", fontBase64);
    doc.addFont("NotoSansJP-Regular.ttf", "NotoSansJP", "normal");
    doc.setFont("NotoSansJP");
  } else {
    doc.setFont("helvetica");
  }
}

/**
 * 見積書の PDF を生成して Blob で返す。
 * @react-pdf/renderer なしで jsPDF だけで完結するため、
 * バンドルサイズへの影響が最小限。
 */
export async function generateEstimatePdf(estimate: Estimate): Promise<Blob> {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  await setupJapaneseFont(doc);

  const pageWidth = 210;
  const marginL = 18;
  const marginR = 18;
  const contentWidth = pageWidth - marginL - marginR;
  let y = 20;

  // ---- ヘッダー ----
  doc.setFontSize(22);
  doc.text("見 積 書", pageWidth / 2, y, { align: "center" });
  y += 10;

  doc.setFontSize(9);
  doc.text(`見積番号: ${estimate.id}`, marginL, y);
  doc.text(`作成日: ${estimate.createdAt}`, pageWidth - marginR, y, { align: "right" });
  y += 5;
  doc.text(`有効期限: ${estimate.validUntil}`, pageWidth - marginR, y, { align: "right" });
  y += 8;

  // ---- 区切り線 ----
  doc.setDrawColor(180, 180, 180);
  doc.line(marginL, y, pageWidth - marginR, y);
  y += 6;

  // ---- 宛先 ----
  doc.setFontSize(11);
  doc.text(`${estimate.clientName} 御中`, marginL, y);
  y += 6;
  doc.setFontSize(9);
  doc.text(`物件名: ${estimate.propertyName}`, marginL, y);
  y += 10;

  // ---- 合計金額ボックス ----
  doc.setFontSize(10);
  doc.setDrawColor(60, 60, 60);
  doc.rect(marginL, y - 4, contentWidth, 10);
  doc.setFontSize(10);
  doc.text("合計金額（税込）", marginL + 3, y + 2);
  doc.setFontSize(14);
  doc.text(yen(estimate.total), pageWidth - marginR - 3, y + 3, { align: "right" });
  y += 14;

  // ---- 明細テーブル ----
  const colX = {
    name: marginL,
    qty: marginL + 75,
    unit: marginL + 92,
    unitPrice: marginL + 110,
    amount: marginL + 140,
  };
  const colW = {
    name: 75,
    qty: 17,
    unit: 18,
    unitPrice: 30,
    amount: contentWidth - 140,
  };

  const drawTableHeader = () => {
    doc.setFontSize(8);
    doc.setFillColor(240, 240, 240);
    doc.rect(marginL, y, contentWidth, 6, "F");
    doc.setDrawColor(180, 180, 180);
    doc.rect(marginL, y, contentWidth, 6);
    const headerY = y + 4.2;
    doc.text("品名", colX.name + 2, headerY);
    doc.text("数量", colX.qty + colW.qty / 2, headerY, { align: "center" });
    doc.text("単位", colX.unit + colW.unit / 2, headerY, { align: "center" });
    doc.text("単価", colX.unitPrice + colW.unitPrice, headerY, { align: "right" });
    doc.text("金額", colX.amount + colW.amount, headerY, { align: "right" });
    y += 6;
  };

  for (const section of estimate.sections) {
    // セクションタイトル
    if (y > 250) {
      doc.addPage();
      y = 20;
    }
    doc.setFontSize(9);
    doc.setFillColor(220, 235, 250);
    doc.rect(marginL, y, contentWidth, 6, "F");
    doc.text(section.categoryName, marginL + 2, y + 4.2);
    y += 6;

    drawTableHeader();

    for (const line of section.lines) {
      if (y > 260) {
        doc.addPage();
        y = 20;
        drawTableHeader();
      }
      const rowH = 5.5;
      doc.setFontSize(8);
      doc.setDrawColor(220, 220, 220);
      doc.line(marginL, y + rowH, pageWidth - marginR, y + rowH);

      // 品名は長い場合に切り詰め
      const nameStr = line.name.length > 28 ? line.name.slice(0, 27) + "…" : line.name;
      doc.text(nameStr, colX.name + 2, y + 3.8);
      doc.text(String(line.quantity), colX.qty + colW.qty / 2, y + 3.8, { align: "center" });
      doc.text(line.unit, colX.unit + colW.unit / 2, y + 3.8, { align: "center" });
      doc.text(yen(line.unitPrice), colX.unitPrice + colW.unitPrice, y + 3.8, { align: "right" });
      doc.text(yen(line.amount), colX.amount + colW.amount, y + 3.8, { align: "right" });
      y += rowH;
    }

    // セクション小計行
    doc.setFontSize(8);
    doc.setFillColor(248, 248, 248);
    doc.rect(marginL, y, contentWidth, 5.5, "F");
    doc.text("小計", colX.unitPrice + colW.unitPrice, y + 3.8, { align: "right" });
    doc.text(yen(section.subtotal), colX.amount + colW.amount, y + 3.8, { align: "right" });
    y += 7;
  }

  // ---- 合計明細 ----
  if (y > 240) {
    doc.addPage();
    y = 20;
  }
  y += 2;
  doc.setDrawColor(180, 180, 180);
  doc.line(marginL, y, pageWidth - marginR, y);
  y += 5;

  const summaryRows: [string, number][] = [
    ["直接工事費", estimate.directCost],
    [`現場管理費 (${(estimate.managementFeeRate * 100).toFixed(0)}%)`, estimate.managementFee],
    [`一般管理費 (${(estimate.generalExpenseRate * 100).toFixed(0)}%)`, estimate.generalExpense],
    ["税抜合計", estimate.subtotal],
    [`消費税 (${(estimate.taxRate * 100).toFixed(0)}%)`, estimate.tax],
  ];

  for (const [label, amount] of summaryRows) {
    doc.setFontSize(9);
    doc.text(label, pageWidth - marginR - 60, y);
    doc.text(yen(amount), pageWidth - marginR, y, { align: "right" });
    y += 5.5;
  }

  // 税込合計
  y += 1;
  doc.setDrawColor(60, 60, 60);
  doc.line(pageWidth - marginR - 65, y, pageWidth - marginR, y);
  y += 4;
  doc.setFontSize(12);
  doc.text("税込合計", pageWidth - marginR - 60, y);
  doc.text(yen(estimate.total), pageWidth - marginR, y, { align: "right" });
  y += 8;

  // 備考
  if (estimate.notes.length > 0) {
    doc.setFontSize(9);
    doc.text("【備考】", marginL, y);
    y += 5;
    for (const note of estimate.notes) {
      doc.text(`・${note}`, marginL + 3, y);
      y += 4.5;
    }
    y += 3;
  }

  // ---- フッター（会社情報 + 角印エリア） ----
  const footerY = 270;
  doc.setDrawColor(180, 180, 180);
  doc.line(marginL, footerY - 2, pageWidth - marginR, footerY - 2);

  doc.setFontSize(9);
  doc.text("株式会社ラポルタ", marginL, footerY + 4);
  doc.text("〒107-0062 東京都港区南青山3丁目", marginL, footerY + 9);
  doc.text("担当: ", marginL, footerY + 14);

  // 角印エリア（右下）
  const stampX = pageWidth - marginR - 25;
  const stampY = footerY - 1;
  doc.setDrawColor(180, 80, 80);
  doc.rect(stampX, stampY, 22, 22);
  doc.setFontSize(7);
  doc.setTextColor(180, 80, 80);
  doc.text("株式会社", stampX + 11, stampY + 7, { align: "center" });
  doc.text("ラポルタ", stampX + 11, stampY + 12, { align: "center" });
  doc.text("（角印）", stampX + 11, stampY + 17, { align: "center" });
  doc.setTextColor(0, 0, 0);

  return doc.output("blob");
}
