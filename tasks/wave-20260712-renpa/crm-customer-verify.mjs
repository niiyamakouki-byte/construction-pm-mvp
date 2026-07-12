// wave-20260712-renpa 第3波: CRM顧客登録修正(034)の本番実UI検証
// 判定: 顧客登録→リロード後も顧客一覧に残る(修正前は消えていた)
// 作成者: Claude worker (公開レベルロングラン第3波)
import { chromium } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import * as fs from "node:fs";
import * as path from "node:path";

const BASE = "https://construction-pm-mvp.vercel.app";
const OUT = "/Users/koki/construction-pm-mvp/tasks/wave-20260712-renpa/wave3-shots";
const NAME = `第3波検証顧客-${process.pid}`;

const envText = fs.readFileSync("/Users/koki/construction-pm-mvp/.env.local", "utf8");
const env = {};
for (const line of envText.split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) env[m[1]] = m[2];
}
const admin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const { data: linkData } = await admin.auth.admin.generateLink({
  type: "magiclink",
  email: "niiyama+audit20260712@laporta.co.jp",
  options: { redirectTo: BASE + "/" },
});

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on("console", (msg) => { if (msg.type() === "error" || msg.type() === "warning") console.log(`  [console.${msg.type()}] ${msg.text().slice(0, 200)}`); });
page.on("pageerror", (err) => console.log(`  [pageerror] ${String(err).slice(0, 300)}`));
page.on("response", async (res) => {
  if (res.url().includes("/rest/v1/customers")) {
    let body = "";
    try { body = (await res.text()).slice(0, 200); } catch { /* ignore */ }
    console.log(`  [net] ${res.request().method()} customers → ${res.status()} ${body}`);
  }
});
await page.goto(linkData.properties.action_link, { waitUntil: "load" });
await page.waitForTimeout(6000);

// 顧客登録(商談追加フォーム内の+顧客経由 = 実ユーザー導線)
await page.goto(`${BASE}/#/crm`, { waitUntil: "load" });
await page.waitForTimeout(2500);
await page.locator('button:has-text("商談追加")').first().click();
await page.waitForTimeout(800);
await page.locator('button:has-text("+顧客")').first().click();
await page.waitForTimeout(800);
await page.locator('input[placeholder="氏名 *"]').fill(NAME);
await page.locator('button:has-text("顧客を登録")').click();
await page.waitForTimeout(2500);

// リロードして永続性確認
await page.reload({ waitUntil: "load" });
await page.waitForTimeout(4000);
await page.locator('button:has-text("顧客一覧")').first().click();
await page.waitForTimeout(2000);
const listText = await page.locator("body").innerText();
const persisted = listText.includes(NAME);
await page.screenshot({ path: path.join(OUT, "verify_customer_persisted.png") });
console.log(`リロード後の顧客一覧に「${NAME}」:`, persisted);

// DB直接確認
const { data: rows } = await admin.from("customers").select("id,name").eq("name", NAME);
console.log("DB rows:", JSON.stringify(rows));

// cleanup: 検証顧客をDBから削除
if (rows?.length) {
  await admin.from("customers").delete().eq("name", NAME);
  console.log("(検証顧客をcleanup済み)");
}

console.log(persisted && rows?.length ? "CRM CUSTOMER VERIFY: PASS" : "CRM CUSTOMER VERIFY: FAIL");
await browser.close();
process.exit(persisted && rows?.length ? 0 : 1);
