// wave-20260712-renpa 第2波: ガント2修正の本番検証
//  A. 工期が過去の案件(渋谷ワインバー 3/1-4/22)で初期表示に工程バーが見える(空に見えない)
//  B. 左列ヘッダーが1行表記になり、その他フェーズ行と重ならない
// 作成者: Claude worker (公開レベルロングラン第2波 2026-07-12)
import { chromium } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import * as fs from "node:fs";
import * as path from "node:path";

const BASE = process.argv[2] || "https://construction-pm-mvp.vercel.app";
const OUT = "/Users/koki/construction-pm-mvp/tasks/wave-20260712-renpa/gantt-shots";
const REAL_PID = "6676c2c6-2bea-4535-b723-4e371ae5802f";

fs.mkdirSync(OUT, { recursive: true });

const envText = fs.readFileSync("/Users/koki/construction-pm-mvp/.env.local", "utf8");
const env = {};
for (const line of envText.split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) env[m[1]] = m[2];
}
const admin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const { data: linkData } = await admin.auth.admin.generateLink({ type: "magiclink", email: "niiyama+audit20260712@laporta.co.jp", options: { redirectTo: BASE + "/" } });

const browser = await chromium.launch();
const results = {};

for (const [label, vp] of [["desktop", { width: 1440, height: 900 }], ["mobile", { width: 390, height: 844 }]]) {
  const ctx = await browser.newContext({ viewport: vp, locale: "ja-JP" });
  const page = await ctx.newPage();
  await page.goto((await admin.auth.admin.generateLink({ type: "magiclink", email: "niiyama+audit20260712@laporta.co.jp", options: { redirectTo: BASE + "/" } })).data.properties.action_link, { waitUntil: "load" });
  await page.waitForTimeout(5000);
  await page.goto(`${BASE}/#/gantt/${REAL_PID}`, { waitUntil: "load" });
  await page.waitForTimeout(6000);

  const info = await page.evaluate(() => {
    // .mobile-scroll-x は案件チップ行等にも付くため、タイムライン(最大scrollWidth)を選ぶ
    const container = [...document.querySelectorAll(".mobile-scroll-x")].sort((a, b) => b.scrollWidth - a.scrollWidth)[0];
    if (!container) return { error: "no scroll container" };
    const containerRect = container.getBoundingClientRect();
    // 初期表示のビューポート内に工程バー(GanttTaskBar: data-task-id)が見えるか
    const bars = [...container.querySelectorAll("[data-task-id]")];
    const visibleBars = bars.filter((el) => {
      const r = el.getBoundingClientRect();
      // モバイルはタイムライン窓が約196pxしかないため、10px以上見えていれば可視と判定
      return r.width > 8 && r.right > containerRect.left + 10 && r.left < containerRect.right - 10;
    });
    // 左列ヘッダーの重なり: ヘッダーセルの下端がフェーズ行の上端を越えていないか
    const headerP = [...document.querySelectorAll("p")].find((p) => p.textContent === "工程名・業者・進捗");
    const headerCell = headerP?.parentElement;
    const phaseRow = [...document.querySelectorAll("div")].find((d) => d.className.includes?.("bg-slate-100/80"));
    let headerOverlap = null;
    if (headerCell && phaseRow) {
      const hb = headerCell.getBoundingClientRect().bottom;
      const pt = phaseRow.getBoundingClientRect().top;
      headerOverlap = { headerBottom: Math.round(hb), phaseTop: Math.round(pt), overlaps: hb > pt + 1 };
    }
    return { scrollLeft: Math.round(container.scrollLeft), visibleBarCount: visibleBars.length, headerLabelFound: !!headerP, headerOverlap };
  });
  results[label] = info;
  await page.screenshot({ path: path.join(OUT, `${label}_gantt_initial.png`) });
  await ctx.close();
}

await browser.close();
console.log(JSON.stringify(results, null, 1));
const ok = (r) => r && !r.error && r.visibleBarCount > 0 && r.headerLabelFound && r.headerOverlap && !r.headerOverlap.overlaps;
const pass = ok(results.desktop) && ok(results.mobile);
console.log(pass ? "GANTT FIXES VERIFY: PASS" : "GANTT FIXES VERIFY: FAIL");
process.exit(pass ? 0 : 1);
