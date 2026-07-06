/**
 * Site Entry QR Code module for GenbaHub.
 * Generates QR codes for site entry pages and A4 print-ready HTML layouts.
 */

import QRCode from "qrcode";

// The app uses a hash-based router (see src/hooks/useHashRouter.ts), so entry
// links must live after the "#" to be routable, e.g. "<origin>/#/entry/<id>".
const ENTRY_PATH = "/#/entry";

/** Pixel size used for the embedded QR SVG/PNG so it never renders at 0x0. */
const QR_PIXEL_SIZE = 320;

/**
 * Generate the site entry URL for a project.
 * Pass the real origin (e.g. `window.location.origin`) as baseUrl — this
 * module does not hardcode a production domain.
 */
export function generateSiteEntryUrl(projectId: string, baseUrl = ""): string {
  if (!projectId) throw new Error("projectId is required");
  return `${baseUrl}${ENTRY_PATH}/${encodeURIComponent(projectId)}`;
}

/**
 * Generate a QR code SVG string for site entry.
 * Returns a raw SVG string (not a data URL) for embedding in print layouts.
 */
export async function generateSiteEntryQR(
  projectId: string,
  projectName: string,
  baseUrl = "",
): Promise<string> {
  if (!projectId) throw new Error("projectId is required");

  const url = generateSiteEntryUrl(projectId, baseUrl);
  // width/height must be set explicitly — without them the <svg> only has a
  // viewBox and renders at 0x0 (blank) once dropped into the print layout.
  const rawSvg = await QRCode.toString(url, { type: "svg", width: QR_PIXEL_SIZE });

  // Inject title and metadata for print layout identification
  const svg = rawSvg
    .replace("</svg>", `<title>${projectName} 入退場QR</title><metadata>${url}</metadata></svg>`);

  return svg;
}

/**
 * Generate an A4-layout HTML string for printing site entry QR codes.
 * Open this in a new browser tab and use browser print (Ctrl+P / Cmd+P).
 */
export async function generateSiteEntryPrintHtml(
  projectId: string,
  projectName: string,
  baseUrl = "",
): Promise<string> {
  if (!projectId) throw new Error("projectId is required");

  const url = generateSiteEntryUrl(projectId, baseUrl);
  const qrSvg = await generateSiteEntryQR(projectId, projectName, baseUrl);

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${projectName} 入退場QRコード</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: "Hiragino Kaku Gothic ProN", "Noto Sans JP", sans-serif;
      background: #fff;
      color: #111;
    }
    @page { size: A4 portrait; margin: 20mm; }
    .page {
      width: 170mm;
      min-height: 257mm;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 24px;
      padding: 16mm 0;
    }
    .site-badge {
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: #64748b;
      border: 1px solid #e2e8f0;
      border-radius: 999px;
      padding: 4px 12px;
    }
    .project-name {
      font-size: 28px;
      font-weight: 800;
      text-align: center;
      line-height: 1.3;
      color: #0f172a;
    }
    .qr-wrapper {
      border: 3px solid #0f172a;
      border-radius: 16px;
      padding: 16px;
      background: #fff;
    }
    .qr-wrapper svg { display: block; }
    .instruction {
      font-size: 20px;
      font-weight: 700;
      text-align: center;
      color: #1d4ed8;
    }
    .sub-instruction {
      font-size: 13px;
      text-align: center;
      color: #475569;
      line-height: 1.7;
    }
    .url-hint {
      font-size: 10px;
      color: #94a3b8;
      word-break: break-all;
      text-align: center;
      max-width: 160mm;
    }
    .footer {
      font-size: 10px;
      color: #cbd5e1;
      margin-top: 8px;
    }
    hr {
      width: 100%;
      border: none;
      border-top: 1px dashed #e2e8f0;
    }
  </style>
</head>
<body>
  <div class="page">
    <span class="site-badge">GenbaHub 現場入退場</span>
    <h1 class="project-name">${projectName}</h1>
    <hr />
    <div class="qr-wrapper">
      ${qrSvg}
    </div>
    <p class="instruction">スマホでQRコードを読み取る</p>
    <p class="sub-instruction">
      入場・退場の記録が自動的に保存されます。<br />
      名前と会社名を入力してください。
    </p>
    <p class="url-hint">${url}</p>
    <p class="footer">Powered by GenbaHub</p>
  </div>
</body>
</html>`;
}

// Sage-green accent used across GenbaHub UI (see genbahub-ui skill guidance):
// one accent color, no gradients/heavy shadows/decorative emoji.
const SAGE: [number, number, number] = [0x5f, 0x77, 0x66];
const SAGE_LIGHT: [number, number, number] = [0xe9, 0xef, 0xeb];
const SAGE_TINT: [number, number, number] = [0xf3, 0xf6, 0xf4];
const INK: [number, number, number] = [0x1a, 0x1f, 0x1c];
const MUTED: [number, number, number] = [0x6b, 0x74, 0x6e];

/**
 * Default site-rules text shown on the poster when a project has not set
 * its own custom notes yet (see Project.siteEntryNotes).
 */
export const DEFAULT_SITE_ENTRY_NOTES =
  "・ヘルメット・保護具を着用してください\n" +
  "・喫煙は指定場所のみでお願いします\n" +
  "・駐車は指定位置にお願いします\n" +
  "・緊急連絡先: 株式会社ラポルタ 03-6876-7749";

/**
 * Generate an A4 poster PDF (portrait) for site entry QR codes, ready to
 * print and post at the site entrance as the company's public face. Uses a
 * PNG-embedded QR (not SVG) so the same size-0 rendering bug from
 * generateSiteEntryPrintHtml can't recur inside a PDF canvas, and the
 * bundled Noto Sans JP subset for Japanese text.
 */
export async function generateSiteEntryPosterPdf(
  projectId: string,
  projectName: string,
  baseUrl = "",
  siteRules: string = DEFAULT_SITE_ENTRY_NOTES,
): Promise<Blob> {
  if (!projectId) throw new Error("projectId is required");

  const [{ jsPDF }, { NOTO_SANS_JP_REGULAR_BASE64 }] = await Promise.all([
    import("jspdf"),
    import("../estimate/noto-sans-jp-font.js"),
  ]);

  const url = generateSiteEntryUrl(projectId, baseUrl);
  const qrDataUrl = await QRCode.toDataURL(url, {
    errorCorrectionLevel: "H",
    margin: 1,
    width: 600,
  });

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  doc.addFileToVFS("NotoSansJP-Regular.ttf", NOTO_SANS_JP_REGULAR_BASE64);
  doc.addFont("NotoSansJP-Regular.ttf", "NotoSansJP", "normal");
  doc.setFont("NotoSansJP");

  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;
  const centerX = pageWidth / 2;

  // ── Eyebrow + rule ──────────────────────────────────────────────────────
  doc.setFontSize(9.5);
  doc.setTextColor(...MUTED);
  doc.text("G E N B A H U B　現場入場のご案内", centerX, 22, { align: "center" });

  doc.setDrawColor(...SAGE_LIGHT);
  doc.setLineWidth(0.3);
  doc.line(margin, 27, pageWidth - margin, 27);

  // ── Project name + subtitle ──────────────────────────────────────────────
  doc.setFontSize(22);
  doc.setTextColor(...INK);
  const nameLines = doc.splitTextToSize(projectName, contentWidth);
  let y = 43;
  for (const line of nameLines) {
    doc.text(line, centerX, y, { align: "center" });
    y += 9;
  }
  y += 1;

  doc.setFontSize(12);
  doc.setTextColor(...SAGE);
  doc.text("現場入場QR — スキャンして入退場を記録", centerX, y, { align: "center" });
  y += 13;

  // ── QR block: square card, centered, with quiet-zone padding ────────────
  const qrSize = 88;
  const pad = 8;
  const cardTop = y;
  const cardSize = qrSize + pad * 2;
  const cardX = centerX - cardSize / 2;
  doc.setFillColor(...SAGE_LIGHT);
  doc.roundedRect(cardX, cardTop, cardSize, cardSize, 5, 5, "F");
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(cardX + 2.5, cardTop + 2.5, cardSize - 5, cardSize - 5, 3.5, 3.5, "F");
  doc.addImage(qrDataUrl, "PNG", centerX - qrSize / 2, cardTop + pad, qrSize, qrSize);
  y = cardTop + cardSize;

  // ── 3-step instructions row ──────────────────────────────────────────────
  y += 13;
  doc.setFontSize(13.5);
  doc.setTextColor(...INK);
  doc.text("かんたん3ステップ", centerX, y, { align: "center" });

  const steps: Array<[string, string, string]> = [
    ["①", "スマホのカメラで", "QRを読む"],
    ["②", "お名前を", "選ぶ"],
    ["③", "入場ボタンを", "タップ"],
  ];
  const circleY = y + 10;
  const line1Y = circleY + 9;
  const line2Y = circleY + 14;
  const colWidth = contentWidth / 3;

  steps.forEach(([num, line1, line2], i) => {
    const cx = margin + colWidth * i + colWidth / 2;
    doc.setFillColor(...SAGE);
    doc.circle(cx, circleY, 6, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(11);
    doc.text(num, cx, circleY + 2.3, { align: "center" });

    doc.setTextColor(...INK);
    doc.setFontSize(10);
    doc.text(line1, cx, line1Y, { align: "center" });
    doc.text(line2, cx, line2Y, { align: "center" });
  });
  y = line2Y;

  // ── Site rules / notices ─────────────────────────────────────────────────
  y += 11;
  doc.setFontSize(11.5);
  doc.setTextColor(...INK);
  doc.text("現場ルール・注意事項", margin, y);
  y += 5;

  const rulesLines = siteRules
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  const boxPadX = 7;
  const boxPadY = 5.5;
  const ruleLineHeight = 5;
  doc.setFontSize(9.5);
  const wrappedRuleLines = rulesLines.flatMap((line) =>
    doc.splitTextToSize(line, contentWidth - boxPadX * 2) as string[],
  );
  const boxHeight = boxPadY * 2 + Math.max(wrappedRuleLines.length, 1) * ruleLineHeight;
  const boxTop = y;

  doc.setFillColor(...SAGE_TINT);
  doc.roundedRect(margin, boxTop, contentWidth, boxHeight, 3, 3, "F");
  doc.setFillColor(...SAGE);
  doc.rect(margin, boxTop, 1.4, boxHeight, "F");

  doc.setTextColor(...INK);
  let ruleY = boxTop + boxPadY + 3;
  for (const line of wrappedRuleLines) {
    doc.text(line, margin + boxPadX, ruleY);
    ruleY += ruleLineHeight;
  }
  y = boxTop + boxHeight;

  // ── Footer ────────────────────────────────────────────────────────────
  // Anchored strictly below the rules box (never clamped upward — clamping
  // here previously caused the footer to overlap the box on longer notes).
  const footerRuleY = y + 9;
  doc.setDrawColor(...SAGE_LIGHT);
  doc.line(margin, footerRuleY, pageWidth - margin, footerRuleY);

  doc.setFontSize(10.5);
  doc.setTextColor(...INK);
  doc.text("株式会社ラポルタ", centerX, footerRuleY + 7, { align: "center" });

  doc.setFontSize(7.5);
  doc.setTextColor(...MUTED);
  doc.text(url, centerX, footerRuleY + 12, { align: "center", maxWidth: contentWidth });
  doc.text("Powered by GenbaHub", centerX, footerRuleY + 16, {
    align: "center",
  });

  return doc.output("blob");
}
