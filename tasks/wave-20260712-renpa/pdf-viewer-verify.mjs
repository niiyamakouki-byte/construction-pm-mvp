// wave-20260712-renpa: PDFビューアー公開ブロッカー実URL検証
// 作成者: Claude worker (PDFビューアー担当・後継 2026-07-12)
// usage: node tasks/wave-20260712-renpa/pdf-viewer-verify.mjs [baseURL]
// 流れ: magiclinkログイン → 監査案件documents → PDFをD&Dアップロード → プレビュー描画確認
//       → リロード後再選択 → モバイルビューポート確認。読み取り+監査案件へのテスト文書追加のみ。
import { chromium } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import * as fs from "node:fs";
import * as path from "node:path";

const BASE = process.argv[2] || "https://construction-pm-mvp.vercel.app";
const OUT = "/Users/koki/construction-pm-mvp/tasks/wave-20260712-renpa/pdf-shots";
const AUDIT_PID = "50d84b67-373b-417b-a1aa-d7ebf9cb6582"; // 監査テスト案件 20260703
const PDF_PATH = "/Users/koki/construction-pm-mvp/src/pages/EstimatePage/__tests__/fixtures/floorplan-1-50.pdf";

fs.mkdirSync(OUT, { recursive: true });

const envText = fs.readFileSync("/Users/koki/construction-pm-mvp/.env.local", "utf8");
const env = {};
for (const line of envText.split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) env[m[1]] = m[2];
}
const admin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
  type: "magiclink",
  email: "niiyama+audit20260712@laporta.co.jp",
  options: { redirectTo: BASE + "/" },
});
if (linkErr) { console.error("magiclink FAIL:", linkErr.message); process.exit(1); }

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "ja-JP" });
const page = await ctx.newPage();
const logs = [];
page.on("console", (msg) => {
  if (msg.type() === "error" || msg.type() === "warning") logs.push(`[${msg.type()}] ${msg.text().slice(0, 300)}`);
});
page.on("pageerror", (err) => logs.push(`[pageerror] ${String(err).slice(0, 300)}`));
page.on("response", (res) => { if (res.status() >= 400) logs.push(`[http ${res.status()}] ${res.url().slice(0, 180)}`); });

await page.goto(linkData.properties.action_link, { waitUntil: "load" });
await page.waitForTimeout(5000);
console.log("login →", page.url());

const docsUrl = `${BASE}/#/project/${AUDIT_PID}/documents`;
await page.goto(docsUrl, { waitUntil: "load" });
await page.waitForTimeout(3500);
await page.screenshot({ path: path.join(OUT, "01_documents_initial.png"), fullPage: true });

// --- D&DでPDFアップロード(実フロー再現: DataTransferにFileを詰めてdropイベント発火)
const pdfBuf = fs.readFileSync(PDF_PATH);
const dropped = await page.evaluate(async ({ bytes, name }) => {
  const arr = new Uint8Array(bytes);
  const file = new File([arr], name, { type: "application/pdf" });
  const dt = new DataTransfer();
  dt.items.add(file);
  // ドロップハンドラはページコンテナdiv(onDrop)にあるため、その内部要素に発火してバブリングさせる
  const heading = Array.from(document.querySelectorAll("h1,h2,h3")).find((e) => /ドキュメント/.test(e.textContent || ""));
  const target = heading || document.body;
  for (const type of ["dragenter", "dragover", "drop"]) {
    const ev = new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer: dt });
    target.dispatchEvent(ev);
  }
  return true;
}, { bytes: Array.from(pdfBuf), name: `pdf-verify-${Date.now()}.pdf` });
console.log("drop dispatched:", dropped);
await page.waitForTimeout(8000);
await page.screenshot({ path: path.join(OUT, "02_after_drop.png"), fullPage: true });

// --- 一覧の先頭ドキュメントを選択してプレビュー確認
const docButtons = page.locator("button:has-text('pdf-verify-')");
const count = await docButtons.count();
console.log("uploaded doc visible in list:", count);
if (count > 0) await docButtons.first().click();
await page.waitForTimeout(6000);
await page.screenshot({ path: path.join(OUT, "03_preview_selected.png"), fullPage: true });

// canvas描画状態の検査
const canvasState = await page.evaluate(() => {
  const canvases = Array.from(document.querySelectorAll("canvas[role=img]"));
  return canvases.map((c) => ({
    w: c.width, h: c.height, display: getComputedStyle(c).display,
    label: c.getAttribute("aria-label"),
  }));
});
console.log("canvas state:", JSON.stringify(canvasState));
const errBox = await page.locator("text=PDFを読み込めませんでした").count();
console.log("viewer error box:", errBox);

// --- リロード後にDBに保存されたURLで再表示できるか(署名URL経由)
await page.reload({ waitUntil: "load" });
await page.waitForTimeout(4000);
const btn2 = page.locator("button:has-text('pdf-verify-')");
if ((await btn2.count()) > 0) await btn2.first().click();
await page.waitForTimeout(6000);
await page.screenshot({ path: path.join(OUT, "04_preview_after_reload.png"), fullPage: true });
const canvasState2 = await page.evaluate(() => {
  const c = document.querySelector("canvas[role=img]");
  return c ? { w: c.width, h: c.height, display: getComputedStyle(c).display } : null;
});
console.log("canvas after reload:", JSON.stringify(canvasState2));
console.log("error box after reload:", await page.locator("text=PDFを読み込めませんでした").count());

// DBに何が保存されたか
const { data: docs } = await admin.from("documents").select("id,name,url,created_at").eq("project_id", AUDIT_PID).order("created_at", { ascending: false }).limit(3);
for (const d of docs || []) console.log("DB doc:", d.name, "| url head:", (d.url || "").slice(0, 110));

console.log("--- console/network logs (uniq):");
for (const l of [...new Set(logs)].filter((l) => !l.includes("[schema]"))) console.log(" ", l);

await browser.close();
console.log("DONE");
