// wave-20260712-renpa 第2波: バージョン履歴「開く」リンクの再署名修正(e80a7b2)の本番検証
// 作成者: Claude worker (公開レベルロングラン第2波 2026-07-12)
// 検証:
//  A. 期限切れ相当(token破壊)URLを持つ旧版rowを自作テストdocに作成
//  B. 本番UIでdocを選択→バージョン履歴の「開く」リンクhrefが再署名URL(壊れたtokenでない)を指す
//  C. 旧版・現在版両方のhrefをfetchして200が返る
// 対象データ: 監査テスト案件(50d84b67)の自作pdf-verify-* docのみ。顧客データ非接触。
import { chromium } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import * as fs from "node:fs";
import * as path from "node:path";

const BASE = process.argv[2] || "https://construction-pm-mvp.vercel.app";
const OUT = "/Users/koki/construction-pm-mvp/tasks/wave-20260712-renpa/version-link-shots";
const AUDIT_PID = "50d84b67-373b-417b-a1aa-d7ebf9cb6582";
const BROKEN_TOKEN = "token=invalid-expired-oldversion-simulation";

fs.mkdirSync(OUT, { recursive: true });

const envText = fs.readFileSync("/Users/koki/construction-pm-mvp/.env.local", "utf8");
const env = {};
for (const line of envText.split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) env[m[1]] = m[2];
}
const admin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

// --- A: 旧版row作成(既存の同シミュレーション行があれば再利用)
const { data: docs } = await admin.from("documents").select("id,name,url").eq("project_id", AUDIT_PID).like("name", "pdf-verify-%").order("created_at", { ascending: true });
if (!docs?.length) { console.error("no pdf-verify-* docs"); process.exit(1); }
const target = docs[0];
const brokenUrl = target.url.replace(/token=[^&]+/, BROKEN_TOKEN);
const { data: existing } = await admin.from("document_versions").select("id").eq("document_id", target.id).eq("version", "v0.9-expired-sim");
if (!existing?.length) {
  const now = new Date().toISOString();
  const { error: insErr } = await admin.from("document_versions").insert({
    id: crypto.randomUUID(),
    created_at: now,
    updated_at: now,
    document_id: target.id,
    project_id: AUDIT_PID,
    name: target.name,
    type: "drawing",
    url: brokenUrl,
    uploaded_by: "niiyama+audit20260712@laporta.co.jp",
    version: "v0.9-expired-sim",
  });
  if (insErr) { console.error("version insert FAIL:", insErr.message); process.exit(1); }
}
console.log("A-prep: expired-sim old version ready for", target.name);

const mkLink = async () => (await admin.auth.admin.generateLink({ type: "magiclink", email: "niiyama+audit20260712@laporta.co.jp", options: { redirectTo: BASE + "/" } })).data.properties.action_link;

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: "ja-JP" });
const page = await ctx.newPage();

await page.goto(await mkLink(), { waitUntil: "load" });
await page.waitForTimeout(5000);
await page.goto(`${BASE}/#/project/${AUDIT_PID}/documents`, { waitUntil: "load" });
await page.waitForTimeout(3500);

await page.locator(`button:has-text('${target.name}')`).first().click();
await page.waitForTimeout(6000);

const links = await page.locator("a", { hasText: "開く" }).evaluateAll((els) =>
  els.filter((el) => el.textContent.trim() === "開く").map((el) => el.href),
);
await page.screenshot({ path: path.join(OUT, "01_version_history.png"), fullPage: true });
await ctx.close();
await browser.close();

const results = { linkCount: links.length, containsBrokenToken: links.some((h) => h.includes(BROKEN_TOKEN)) };
results.fetchStatuses = [];
for (const href of links) {
  const res = await fetch(href);
  results.fetchStatuses.push(res.status);
}
console.log(JSON.stringify({ ...results, links: links.map((l) => l.slice(0, 120)) }, null, 1));

const pass = links.length >= 2 && !results.containsBrokenToken && results.fetchStatuses.every((s) => s === 200);
console.log(pass ? "VERSION LINK VERIFY: PASS" : "VERSION LINK VERIFY: FAIL");
process.exit(pass ? 0 : 1);
