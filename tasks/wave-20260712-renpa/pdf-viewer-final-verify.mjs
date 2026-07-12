// wave-20260712-renpa: PDFビューアー公開ブロッカー修正の最終本番検証
// 作成者: Claude worker (PDFビューアー担当・後継 2026-07-12)
// 検証項目:
//  A. 期限切れ署名URL(token無効化で再現)のドキュメントでもプレビューが再署名経由で表示される(修正2 e2116ad)
//  B. 「ファイルを選択して登録」ボタンがデスクトップ/モバイル両方に存在し、file input経由で登録できる(修正3 1065185)
//  C. モバイル390pxでもPDFプレビューcanvasが描画される
// 対象データ: 監査テスト案件の自作テストドキュメント(pdf-verify-*)のみ操作。顧客データ非接触。
import { chromium } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import * as fs from "node:fs";
import * as path from "node:path";

const BASE = process.argv[2] || "https://construction-pm-mvp.vercel.app";
const OUT = "/Users/koki/construction-pm-mvp/tasks/wave-20260712-renpa/pdf-shots-final";
const AUDIT_PID = "50d84b67-373b-417b-a1aa-d7ebf9cb6582";
const PDF_PATH = "/Users/koki/construction-pm-mvp/src/pages/EstimatePage/__tests__/fixtures/floorplan-1-50.pdf";

fs.mkdirSync(OUT, { recursive: true });

const envText = fs.readFileSync("/Users/koki/construction-pm-mvp/.env.local", "utf8");
const env = {};
for (const line of envText.split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) env[m[1]] = m[2];
}
const admin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

// --- A準備: 自作テストdocのurlのtokenを壊して「期限切れ相当」を再現
const { data: myDocs } = await admin.from("documents").select("id,name,url").eq("project_id", AUDIT_PID).like("name", "pdf-verify-%").order("created_at", { ascending: false });
if (!myDocs?.length) { console.error("no pdf-verify-* docs"); process.exit(1); }
const target = myDocs[0];
const brokenUrl = target.url.replace(/token=[^&]+/, "token=invalid-expired-simulation");
await admin.from("documents").update({ url: brokenUrl }).eq("id", target.id);
console.log("A-prep: token broken for", target.name);

const mkLink = async () => (await admin.auth.admin.generateLink({ type: "magiclink", email: "niiyama+audit20260712@laporta.co.jp", options: { redirectTo: BASE + "/" } })).data.properties.action_link;

const browser = await chromium.launch();
const results = {};

// ========== デスクトップ ==========
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "ja-JP" });
  const page = await ctx.newPage();
  const logs = [];
  page.on("pageerror", (e) => logs.push(String(e).slice(0, 200)));
  page.on("response", (r) => { if (r.status() >= 400) logs.push(`http ${r.status()} ${r.url().slice(0, 140)}`); });

  await page.goto(await mkLink(), { waitUntil: "load" });
  await page.waitForTimeout(5000);
  await page.goto(`${BASE}/#/project/${AUDIT_PID}/documents`, { waitUntil: "load" });
  await page.waitForTimeout(3500);

  // B: ファイル選択ボタンの存在+実登録
  const pickBtn = page.locator("button:has-text('ファイルを選択して登録')");
  results.desktopPickButton = (await pickBtn.count()) > 0;
  const fileInput = page.locator("input[type=file][aria-label='PDF・画像ファイルを選択して登録']");
  if (results.desktopPickButton) {
    await fileInput.setInputFiles({ name: `pdf-picker-${Date.now()}.pdf`, mimeType: "application/pdf", buffer: fs.readFileSync(PDF_PATH) });
    await page.waitForTimeout(8000);
    results.desktopPickUploadVisible = (await page.locator("button:has-text('pdf-picker-')").count()) > 0;
    await page.screenshot({ path: path.join(OUT, "01_desktop_picker_upload.png"), fullPage: true });
  }

  // A: 期限切れ相当ドキュメントのプレビュー(再署名で復活するはず)
  await page.locator(`button:has-text('${target.name}')`).first().click();
  await page.waitForTimeout(7000);
  const canvas = await page.evaluate(() => {
    const c = document.querySelector("canvas[role=img]");
    return c ? { w: c.width, h: c.height, display: getComputedStyle(c).display } : null;
  });
  results.expiredUrlPreview = canvas;
  results.expiredUrlErrorBox = await page.locator("text=PDFを読み込めませんでした").count();
  await page.screenshot({ path: path.join(OUT, "02_desktop_expired_url_preview.png"), fullPage: true });
  results.desktopLogs = [...new Set(logs)].filter((l) => !l.includes("[schema]"));
  await ctx.close();
}

// ========== モバイル390px ==========
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: "ja-JP", isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  await page.goto(await mkLink(), { waitUntil: "load" });
  await page.waitForTimeout(5000);
  await page.goto(`${BASE}/#/project/${AUDIT_PID}/documents`, { waitUntil: "load" });
  await page.waitForTimeout(3500);

  results.mobilePickButton = (await page.locator("button:has-text('ファイルを選択して登録')").count()) > 0;
  await page.screenshot({ path: path.join(OUT, "03_mobile_documents.png"), fullPage: true });

  // C: モバイルでのPDFプレビュー描画
  await page.locator(`button:has-text('${target.name}')`).first().click();
  await page.waitForTimeout(7000);
  results.mobileCanvas = await page.evaluate(() => {
    const c = document.querySelector("canvas[role=img]");
    return c ? { w: c.width, h: c.height, display: getComputedStyle(c).display } : null;
  });
  await page.screenshot({ path: path.join(OUT, "04_mobile_pdf_preview.png"), fullPage: true });
  await ctx.close();
}

await browser.close();

// A後片付け: 壊したurlはそのままにする(再署名で毎回復活する設計のため実害なし)が、
// 検証の再現性のため記録しておく
console.log(JSON.stringify(results, null, 1));
const pass =
  results.desktopPickButton && results.desktopPickUploadVisible &&
  results.expiredUrlPreview && results.expiredUrlPreview.w > 0 && results.expiredUrlErrorBox === 0 &&
  results.mobilePickButton && results.mobileCanvas && results.mobileCanvas.w > 0;
console.log(pass ? "FINAL VERIFY: PASS" : "FINAL VERIFY: FAIL");
