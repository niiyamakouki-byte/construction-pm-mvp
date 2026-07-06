/**
 * ドキュメントタブ GoodNotes級インポート/エクスポート 実機検証 (2026-07-07)
 * - D&D一括インポート + 即プレビュー + 共有/エクスポートの動作確認
 * - 体感パフォーマンス実測: PDF初回表示までの秒数、大容量PDFでのページ送りレスポンス
 *
 * 実行: pnpm exec vite --port 5183 &  (別途 dev server 起動)
 *      node tasks/doc-import-export-verify-20260707.mjs
 */
import { chromium } from "@playwright/test";
import path from "path";
import fs from "fs";
import url from "url";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, "doc-import-export-verify-20260707");
fs.mkdirSync(OUT_DIR, { recursive: true });

const BASE_URL = process.env.VERIFY_BASE_URL ?? "http://localhost:5183";
const PID = "33333333-3333-3333-3333-333333333333";

const SEED_PROJECTS = [
  {
    id: PID,
    name: "D&Dインポート検証案件",
    description: "",
    status: "active",
    mode: "normal",
    startDate: "2026-07-01",
    endDate: "2026-09-30",
    includeWeekends: false,
    budget: 1000000,
    createdAt: "2026-07-01T00:00:00Z",
    updatedAt: "2026-07-01T00:00:00Z",
  },
];

async function seed(page) {
  await page.addInitScript(
    ({ projects, pid }) => {
      window.__E2E_BYPASS_AUTH__ = true;
      localStorage.setItem("genbahub:projects", JSON.stringify(projects));
      localStorage.setItem("genbahub:documents", JSON.stringify([]));
      localStorage.setItem("genbahub:document_versions", JSON.stringify([]));
      localStorage.setItem("genbahub:last-project-id", pid);
    },
    { projects: SEED_PROJECTS, pid: PID },
  );
}

async function dropFiles(page, selector, filePaths) {
  const filesData = filePaths.map((p) => ({
    name: path.basename(p),
    base64: fs.readFileSync(p).toString("base64"),
    type: p.endsWith(".pdf") ? "application/pdf" : "image/png",
  }));

  const handle = await page.evaluateHandle((files) => {
    const dt = new DataTransfer();
    for (const f of files) {
      const binary = atob(f.base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const file = new File([bytes], f.name, { type: f.type });
      dt.items.add(file);
    }
    return dt;
  }, filesData);

  await page.dispatchEvent(selector, "dragenter", { dataTransfer: handle });
  await page.waitForTimeout(150);
  await page.screenshot({ path: path.join(OUT_DIR, "02_drag_overlay.png") });
  await page.dispatchEvent(selector, "drop", { dataTransfer: handle });
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const results = { steps: [] };

  // ── デスクトップ 1440px ─────────────────────────────────────────────
  {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    page.on("pageerror", (err) => results.steps.push({ error: `pageerror: ${err.message}` }));
    page.on("console", (msg) => {
      if (msg.type() === "error") results.steps.push({ consoleError: msg.text() });
    });

    await seed(page);
    await page.goto(`${BASE_URL}/#/project/${PID}/documents`, { waitUntil: "networkidle" });
    await page.waitForSelector("text=ドキュメント検索", { timeout: 15000 });
    await page.screenshot({ path: path.join(OUT_DIR, "01_empty_before_desktop_1440.png") });

    // ── D&D 一括インポート (小PDF + 画像) ──
    const rootSelector = "div.relative.mx-auto";
    await dropFiles(page, rootSelector, ["/tmp/small-test.pdf"]);

    await page.waitForSelector("text=small-test.pdf", { timeout: 15000 });
    await page.screenshot({ path: path.join(OUT_DIR, "03_after_single_drop_desktop_1440.png") });
    results.steps.push({ singleDropRegistered: true });

    // 即プレビュー計測: 選択直後からcanvasが可視になるまでの時間
    const t0 = Date.now();
    await page.click("text=small-test.pdf");
    await page.waitForFunction(() => {
      const canvas = document.querySelector('canvas[role="img"]');
      return canvas && canvas.style.display === "block";
    }, { timeout: 15000 });
    const previewMs = Date.now() - t0;
    results.steps.push({ smallPdfFirstRenderMs: previewMs });
    await page.screenshot({ path: path.join(OUT_DIR, "04_preview_small_pdf_desktop_1440.png") });

    // ── 複数ファイル一括ドロップ ──
    await dropFiles(page, rootSelector, ["/tmp/small-test.pdf", "/tmp/large-test.pdf"]);
    await page.waitForFunction(
      () => document.body.innerText.includes("登録済みドキュメント") && !document.body.innerText.includes("アップロード中..."),
      { timeout: 30000 },
    );
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(OUT_DIR, "05_after_batch_drop_desktop_1440.png") });

    const docCountText = await page.locator("text=登録済みドキュメント").locator("xpath=following-sibling::p").first().innerText().catch(() => "?");
    results.steps.push({ registeredDocCountAfterBatch: docCountText });

    // ── 大容量PDF(120ページ)の初回表示 + ページ送りレスポンス ──
    // D&D直後の自動選択(即プレビュー)で既にlarge-test.pdfが表示済みのため、
    // 一度別ドキュメントに切り替えてから改めて選択し直し、実際のsrc切替コストを計測する。
    await page.locator("text=small-test.pdf").first().click();
    await page.waitForTimeout(300);
    const t1 = Date.now();
    await page.locator("text=large-test.pdf").first().click();
    await page.waitForFunction(() => document.body.innerText.includes("/ 120"), { timeout: 20000 });
    const largePdfFirstRenderMs = Date.now() - t1;
    results.steps.push({ largePdfFirstRenderMs, largePdfPages: 120, largePdfSizeBytes: fs.statSync("/tmp/large-test.pdf").size });
    await page.screenshot({ path: path.join(OUT_DIR, "06_preview_large_pdf_desktop_1440.png") });

    const t2 = Date.now();
    await page.click('button[aria-label="次のページ"]');
    await page.waitForTimeout(50);
    await page.waitForFunction(() => document.body.innerText.includes("2 / 120"), { timeout: 5000 });
    const pageTurnMs = Date.now() - t2;
    results.steps.push({ largePdfPageTurnMs: pageTurnMs });

    const t3 = Date.now();
    await page.click('button[aria-label="拡大"]');
    await page.click('button[aria-label="拡大"]');
    await page.waitForTimeout(100);
    const zoomMs = Date.now() - t3;
    results.steps.push({ largePdfZoomTwoClicksMs: zoomMs });
    await page.screenshot({ path: path.join(OUT_DIR, "07_large_pdf_page2_zoomed_desktop_1440.png") });

    // ── エクスポート/共有 タップ数計測 ──
    await page.evaluate(() => {
      window.__shareCalls = [];
      navigator.share = (data) => {
        window.__shareCalls.push(data?.files?.[0]?.name ?? "unknown");
        return Promise.resolve();
      };
      navigator.canShare = () => true;
    });
    await page.click('button:has-text("共有 / ダウンロード")');
    await page.waitForTimeout(300);
    const shareCalls = await page.evaluate(() => window.__shareCalls);
    results.steps.push({ shareButtonTapCount: 1, shareCalls });
    await page.screenshot({ path: path.join(OUT_DIR, "08_after_share_tap_desktop_1440.png") });

    await context.close();
  }

  // ── モバイル 390px ─────────────────────────────────────────────
  {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    await seed(page);
    await page.goto(`${BASE_URL}/#/project/${PID}/documents`, { waitUntil: "networkidle" });
    await page.waitForSelector("text=ドキュメント検索", { timeout: 15000 });
    await page.screenshot({ path: path.join(OUT_DIR, "09_empty_before_mobile_390.png") });

    const rootSelector = "div.relative.mx-auto";
    await dropFiles(page, rootSelector, ["/tmp/small-test.pdf"]);
    await page.waitForSelector("text=small-test.pdf", { timeout: 15000 });
    await page.screenshot({ path: path.join(OUT_DIR, "10_after_drop_mobile_390.png") });

    await page.click("text=small-test.pdf");
    await page.waitForFunction(() => {
      const canvas = document.querySelector('canvas[role="img"]');
      return canvas && canvas.style.display === "block";
    }, { timeout: 15000 });
    await page.locator("text=プレビュー").first().scrollIntoViewIfNeeded();
    await page.waitForTimeout(150);
    await page.screenshot({ path: path.join(OUT_DIR, "11_preview_mobile_390.png") });

    // モバイルでの共有/エクスポート導線(1タップ)も確認
    await page.evaluate(() => {
      window.__shareCallsMobile = [];
      navigator.share = (data) => {
        window.__shareCallsMobile.push(data?.files?.[0]?.name ?? "unknown");
        return Promise.resolve();
      };
      navigator.canShare = () => true;
    });
    await page.click('button:has-text("共有 / ダウンロード")');
    await page.waitForTimeout(200);
    await page.screenshot({ path: path.join(OUT_DIR, "12_after_share_tap_mobile_390.png") });

    await context.close();
  }

  await browser.close();
  fs.writeFileSync(path.join(OUT_DIR, "results.json"), JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results, null, 2));
  console.log("\nScreenshots + results in:", OUT_DIR);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
