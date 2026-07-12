// wave-20260712-renpa: 本番公開準備スイープ（実ログイン+全主要ルート+コンソールエラー収集）
// 作成者: Claude worker (genbahub wave 2026-07-12)
// usage: node tasks/wave-20260712-renpa/sweep.mjs
import { chromium } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import * as fs from "node:fs";
import * as path from "node:path";

const BASE = "https://construction-pm-mvp.vercel.app";
const OUT = "/Users/koki/construction-pm-mvp/tasks/wave-20260712-renpa/shots";
const AUDIT_PID = "50d84b67-373b-417b-a1aa-d7ebf9cb6582"; // 監査テスト案件 20260703
const REAL_PID = "6676c2c6-2bea-4535-b723-4e371ae5802f"; // 渋谷ワインバー

fs.mkdirSync(OUT, { recursive: true });

// --- magiclink 発行
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

const ROUTES = [
  ["today", "/today"],
  ["projects", "/app"],
  ["gantt", `/gantt/${REAL_PID}`],
  ["tasks", "/tasks"],
  ["notifications", "/notifications"],
  ["weather", "/weather"],
  ["contractors", "/contractors"],
  ["estimate", "/estimate"],
  ["takeoff", "/takeoff"],
  ["cross-gantt", "/cross-project-gantt"],
  ["progress-review", "/progress-review"],
  ["photos", "/photos"],
  ["safety", "/safety"],
  ["procurement", "/procurement"],
  ["orders", "/orders"],
  ["cost", "/cost-management"],
  ["crm", "/crm"],
  ["invoice", "/invoice"],
  ["freee", "/freee"],
  ["help", "/help"],
  ["node-schedule", "/node-schedule"],
  ["cards", "/cards"],
  ["reports", "/reports"],
  ["finishing", "/finishing"],
  ["schedule", "/schedule"],
  ["phase-templates", "/phase-templates"],
  ["project-real", `/project/${REAL_PID}`],
  ["project-audit", `/project/${AUDIT_PID}`],
  ["documents-audit", `/project/${AUDIT_PID}/documents`],
];

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "ja-JP" });
const page = await ctx.newPage();

const findings = [];
let current = { route: "(login)", console: [], pageErrors: [], failed: [] };
page.on("console", (msg) => {
  if (msg.type() === "error" || msg.type() === "warning") {
    current.console.push(`[${msg.type()}] ${msg.text().slice(0, 400)}`);
  }
});
page.on("pageerror", (err) => current.pageErrors.push(String(err).slice(0, 400)));
page.on("response", (res) => {
  if (res.status() >= 400) current.failed.push(`${res.status()} ${res.url().slice(0, 200)}`);
});

// --- login
await page.goto(linkData.properties.action_link, { waitUntil: "load" });
await page.waitForTimeout(6000);
await page.screenshot({ path: path.join(OUT, "00_after_login.png"), fullPage: false });
console.log("after login URL:", page.url());
findings.push(current);

for (const [name, route] of ROUTES) {
  current = { route, console: [], pageErrors: [], failed: [] };
  try {
    await page.goto(`${BASE}/#${route}`, { waitUntil: "load", timeout: 30000 });
    await page.waitForTimeout(3500);
    await page.screenshot({ path: path.join(OUT, `d_${name}.png`), fullPage: true });
    // 見えている赤バナー/エラーテキストを拾う
    const errText = await page.evaluate(() => {
      const sel = '[class*="error"],[class*="Error"],[role="alert"]';
      return Array.from(document.querySelectorAll(sel))
        .map((e) => (e.textContent || "").trim())
        .filter((t) => t && t.length < 300)
        .slice(0, 5);
    });
    current.visibleErrors = errText;
  } catch (e) {
    current.navError = String(e).slice(0, 200);
  }
  findings.push(current);
  console.log(`${name}: console=${current.console.length} pageErr=${current.pageErrors.length} http=${current.failed.length} visible=${(current.visibleErrors || []).length}`);
}

// --- project detail tabs (契約タブ含む)
const TABS = ["overview", "contract", "finance", "chat"];
for (const pid of [AUDIT_PID, REAL_PID]) {
  const label = pid === AUDIT_PID ? "audit" : "real";
  await page.goto(`${BASE}/#/project/${pid}`, { waitUntil: "load" });
  await page.waitForTimeout(3000);
  const tabButtons = await page.locator("button, [role=tab]").allTextContents();
  console.log(`${label} tabs seen:`, tabButtons.filter((t) => t.trim()).slice(0, 30).join(" | "));
  for (const tabText of ["契約", "収支", "チャット", "概要"]) {
    current = { route: `/project/${pid} tab=${tabText}`, console: [], pageErrors: [], failed: [] };
    try {
      const tab = page.locator(`button:has-text("${tabText}"), [role=tab]:has-text("${tabText}")`).first();
      if ((await tab.count()) === 0) { current.navError = "tab not found"; findings.push(current); continue; }
      await tab.click();
      await page.waitForTimeout(2500);
      await page.screenshot({ path: path.join(OUT, `tab_${label}_${tabText}.png`), fullPage: true });
      current.visibleErrors = await page.evaluate(() => {
        const sel = '[class*="error"],[class*="Error"],[role="alert"]';
        return Array.from(document.querySelectorAll(sel)).map((e) => (e.textContent || "").trim()).filter((t) => t && t.length < 300).slice(0, 5);
      });
    } catch (e) {
      current.navError = String(e).slice(0, 200);
    }
    findings.push(current);
    console.log(`${label}/${tabText}: console=${current.console.length} visible=${(current.visibleErrors || []).length} ${current.navError || ""}`);
  }
}

// --- mobile pass (主要ページのみ)
await ctx.close();
const mctx = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: "ja-JP", storageState: undefined, isMobile: true, hasTouch: true });
// モバイルは再ログインが必要 → 新しいmagiclink
const { data: link2 } = await admin.auth.admin.generateLink({
  type: "magiclink",
  email: "niiyama+audit20260712@laporta.co.jp",
  options: { redirectTo: BASE + "/" },
});
const mpage = await mctx.newPage();
current = { route: "(mobile-login)", console: [], pageErrors: [], failed: [] };
mpage.on("console", (msg) => { if (msg.type() === "error") current.console.push(msg.text().slice(0, 300)); });
mpage.on("pageerror", (err) => current.pageErrors.push(String(err).slice(0, 300)));
await mpage.goto(link2.properties.action_link, { waitUntil: "load" });
await mpage.waitForTimeout(5000);
findings.push(current);
for (const [name, route] of [["today", "/today"], ["projects", "/app"], ["project-real", `/project/${REAL_PID}`], ["documents-audit", `/project/${AUDIT_PID}/documents`], ["estimate", "/estimate"], ["gantt", `/gantt/${REAL_PID}`]]) {
  current = { route: `mobile ${route}`, console: [], pageErrors: [], failed: [] };
  await mpage.goto(`${BASE}/#${route}`, { waitUntil: "load" });
  await mpage.waitForTimeout(3000);
  await mpage.screenshot({ path: path.join(OUT, `m_${name}.png`), fullPage: true });
  // 横スクロールはみ出し検出
  current.hOverflow = await mpage.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  findings.push(current);
  console.log(`mobile ${name}: console=${current.console.length} hOverflow=${current.hOverflow}px`);
}

fs.writeFileSync(path.join(OUT, "..", "sweep-findings.json"), JSON.stringify(findings, null, 1));
console.log("DONE. findings written.");
await browser.close();
