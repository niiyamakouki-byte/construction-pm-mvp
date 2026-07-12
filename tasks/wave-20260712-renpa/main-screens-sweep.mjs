// wave-20260712-renpa 第2波: 主要画面(ダッシュボード/案件/工程表/見積)の公開ブロッカー巡回
// デスクトップ1440+モバイル390でスクショ+consoleエラー+主要要素の存在確認
// 作成者: Claude worker (公開レベルロングラン第2波 2026-07-12)
import { chromium } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import * as fs from "node:fs";
import * as path from "node:path";

const BASE = "https://construction-pm-mvp.vercel.app";
const OUT = "/Users/koki/construction-pm-mvp/tasks/wave-20260712-renpa/main-shots";
const AUDIT_PID = "50d84b67-373b-417b-a1aa-d7ebf9cb6582";
const REAL_PID = "6676c2c6-2bea-4535-b723-4e371ae5802f"; // 渋谷ワインバー

fs.mkdirSync(OUT, { recursive: true });

const envText = fs.readFileSync("/Users/koki/construction-pm-mvp/.env.local", "utf8");
const env = {};
for (const line of envText.split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) env[m[1]] = m[2];
}
const admin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const mkLink = async () => (await admin.auth.admin.generateLink({ type: "magiclink", email: "niiyama+audit20260712@laporta.co.jp", options: { redirectTo: BASE + "/" } })).data.properties.action_link;

const SCREENS = [
  ["dashboard", "/today"],
  ["projects", "/app"],
  ["project-detail", `/project/${REAL_PID}`],
  ["gantt", `/gantt/${REAL_PID}`],
  ["estimate", "/estimate"],
];

const browser = await chromium.launch();
const findings = [];

for (const [label, vp] of [["desktop", { width: 1440, height: 900 }], ["mobile", { width: 390, height: 844, isMobile: true, hasTouch: true }]]) {
  const { isMobile, hasTouch, ...viewport } = vp;
  const ctx = await browser.newContext({ viewport, locale: "ja-JP", ...(isMobile ? { isMobile, hasTouch } : {}) });
  const page = await ctx.newPage();
  const logs = [];
  page.on("console", (m) => { if (m.type() === "error") logs.push(m.text().slice(0, 200)); });
  page.on("pageerror", (e) => logs.push("pageerror: " + String(e).slice(0, 200)));
  page.on("response", (r) => { if (r.status() >= 400) logs.push(`http ${r.status()} ${r.url().slice(0, 140)}`); });

  await page.goto(await mkLink(), { waitUntil: "load" });
  await page.waitForTimeout(5000);

  for (const [name, route] of SCREENS) {
    logs.length = 0;
    await page.goto(`${BASE}/#${route}`, { waitUntil: "load" });
    await page.waitForTimeout(4500);
    const bodyText = await page.evaluate(() => document.body.innerText.slice(0, 4000));
    const suspicious = ["undefined", "NaN", "[object Object]", "Invalid Date", "エラーが発生"].filter((w) => bodyText.includes(w));
    await page.screenshot({ path: path.join(OUT, `${label}_${name}.png`), fullPage: true });
    findings.push({ screen: `${label}/${name}`, consoleErrors: [...new Set(logs)].slice(0, 5), suspiciousText: suspicious });
  }
  await ctx.close();
}

await browser.close();
fs.writeFileSync(path.join(OUT, "findings.json"), JSON.stringify(findings, null, 1));
console.log(JSON.stringify(findings, null, 1));
