// wave-20260712-renpa 第2波: デスクトップでサイドバーが本文に重なって見えるのが
// fullPageスクショの合成アーティファクトか実バグかの判定(viewportスクショ+DOM矩形)
// 作成者: Claude worker (公開レベルロングラン第2波 2026-07-12)
import { chromium } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import * as fs from "node:fs";
import * as path from "node:path";

const BASE = "https://construction-pm-mvp.vercel.app";
const OUT = "/Users/koki/construction-pm-mvp/tasks/wave-20260712-renpa/main-shots";
const REAL_PID = "6676c2c6-2bea-4535-b723-4e371ae5802f";

const envText = fs.readFileSync("/Users/koki/construction-pm-mvp/.env.local", "utf8");
const env = {};
for (const line of envText.split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) env[m[1]] = m[2];
}
const admin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const { data: linkData } = await admin.auth.admin.generateLink({ type: "magiclink", email: "niiyama+audit20260712@laporta.co.jp", options: { redirectTo: BASE + "/" } });

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "ja-JP" });
const page = await ctx.newPage();
await page.goto(linkData.properties.action_link, { waitUntil: "load" });
await page.waitForTimeout(5000);

for (const [name, route] of [["projects", "/app"], ["gantt", `/gantt/${REAL_PID}`], ["dashboard", "/today"]]) {
  await page.goto(`${BASE}/#${route}`, { waitUntil: "load" });
  await page.waitForTimeout(4500);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(500);
  const info = await page.evaluate(() => {
    const rectOf = (el) => { if (!el) return null; const r = el.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; };
    const byText = (txt) => [...document.querySelectorAll("aside, nav, div, p, h1, h2, h3, span")].find((e) => e.childElementCount === 0 && e.textContent.trim() === txt);
    const panel = [...document.querySelectorAll("div, section, aside")].find((e) => e.textContent.trim().startsWith("次にやること") && e.textContent.length < 200);
    const alertTitle = byText("アラートセンター");
    const main = document.querySelector("main");
    return { panel: rectOf(panel), alertTitle: rectOf(alertTitle), main: rectOf(main) };
  });
  console.log(name, JSON.stringify(info));
  await page.screenshot({ path: path.join(OUT, `viewport_${name}.png`) });
}
await ctx.close();
await browser.close();
