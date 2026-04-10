/**
 * Site Entry QR Code module for GenbaHub.
 * Generates QR codes for site entry pages and A4 print-ready HTML layouts.
 */

const ENTRY_PATH = "/entry";

/**
 * Generate the site entry URL for a project.
 */
export function generateSiteEntryUrl(projectId: string, baseUrl = ""): string {
  if (!projectId) throw new Error("projectId is required");
  return `${baseUrl}${ENTRY_PATH}/${encodeURIComponent(projectId)}`;
}

/**
 * Generate a QR code SVG string for site entry.
 * Returns a raw SVG string (not a data URL) for embedding in print layouts.
 */
export function generateSiteEntryQR(
  projectId: string,
  projectName: string,
  baseUrl = "https://app.genbahub.com",
): string {
  if (!projectId) throw new Error("projectId is required");

  const url = generateSiteEntryUrl(projectId, baseUrl);
  const encoded = encodeURIComponent(url);

  // SVG-based QR placeholder (same pattern as qr-code.ts)
  const svg = [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200">',
    '<rect width="200" height="200" fill="white"/>',
    // top-left finder pattern
    '<rect x="10" y="10" width="60" height="60" fill="black"/>',
    '<rect x="20" y="20" width="40" height="40" fill="white"/>',
    '<rect x="30" y="30" width="20" height="20" fill="black"/>',
    // top-right finder pattern
    '<rect x="130" y="10" width="60" height="60" fill="black"/>',
    '<rect x="140" y="20" width="40" height="40" fill="white"/>',
    '<rect x="150" y="30" width="20" height="20" fill="black"/>',
    // bottom-left finder pattern
    '<rect x="10" y="130" width="60" height="60" fill="black"/>',
    '<rect x="20" y="140" width="40" height="40" fill="white"/>',
    '<rect x="30" y="150" width="20" height="20" fill="black"/>',
    // data modules (simplified pattern)
    '<rect x="80" y="80" width="10" height="10" fill="black"/>',
    '<rect x="100" y="80" width="10" height="10" fill="black"/>',
    '<rect x="120" y="80" width="10" height="10" fill="black"/>',
    '<rect x="80" y="100" width="10" height="10" fill="black"/>',
    '<rect x="120" y="100" width="10" height="10" fill="black"/>',
    '<rect x="80" y="120" width="10" height="10" fill="black"/>',
    '<rect x="100" y="120" width="10" height="10" fill="black"/>',
    `<text x="100" y="115" text-anchor="middle" font-size="7" fill="black">${encoded.slice(0, 30)}</text>`,
    `<metadata>${url}</metadata>`,
    `<title>${projectName} 入退場QR</title>`,
    "</svg>",
  ].join("");

  return svg;
}

/**
 * Generate an A4-layout HTML string for printing site entry QR codes.
 * Open this in a new browser tab and use browser print (Ctrl+P / Cmd+P).
 */
export function generateSiteEntryPrintHtml(
  projectId: string,
  projectName: string,
  baseUrl = "https://app.genbahub.com",
): string {
  if (!projectId) throw new Error("projectId is required");

  const url = generateSiteEntryUrl(projectId, baseUrl);
  const qrSvg = generateSiteEntryQR(projectId, projectName, baseUrl);

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
