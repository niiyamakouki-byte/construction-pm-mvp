// wave-20260712-renpa 第3波: 契約タブ contract_checklists 404修正(033適用)の本番検証
// 作成者: Claude worker (公開レベルロングラン第3波) / commit: 033_contract_checklists.sql昇格分
// 検証: ①契約タブでエラーバナー0+404無し ②チェックON→リロード後も保持(永続化) ③OFFに戻す
import { chromium } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import * as fs from "node:fs";
import * as path from "node:path";

const BASE = "https://construction-pm-mvp.vercel.app";
const OUT = "/Users/koki/construction-pm-mvp/tasks/wave-20260712-renpa/contract-shots";
const AUDIT_PID = "50d84b67-373b-417b-a1aa-d7ebf9cb6582"; // 監査テスト案件
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
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const failed = [];
page.on("response", (res) => {
  if (res.status() >= 400 && res.url().includes("contract_checklists")) failed.push(`${res.status()} ${res.url().slice(0, 160)}`);
});

await page.goto(linkData.properties.action_link, { waitUntil: "load" });
await page.waitForTimeout(6000);

const openContractTab = async () => {
  await page.goto(`${BASE}/#/project/${AUDIT_PID}`, { waitUntil: "load" });
  await page.waitForTimeout(3000);
  await page.locator('button:has-text("契約"), [role=tab]:has-text("契約")').first().click();
  await page.waitForTimeout(2500);
};

// ① タブ表示: エラーバナーと404が消えているか
await openContractTab();
const alerts = await page.locator('[role="alert"]').allTextContents();
await page.screenshot({ path: path.join(OUT, "01_contract_tab.png") });
console.log("alerts:", JSON.stringify(alerts));
console.log("contract_checklists 4xx/5xx:", JSON.stringify(failed));

// ② 先頭チェックボックスをON→リロード→保持確認
const firstBox = page.locator('section[aria-label="契約チェックリスト"] input[type=checkbox]').first();
const before = await firstBox.isChecked();
await firstBox.click();
await page.waitForTimeout(2000);
const alertsAfterToggle = await page.locator('[role="alert"]').allTextContents();
await openContractTab();
const afterReload = await page.locator('section[aria-label="契約チェックリスト"] input[type=checkbox]').first().isChecked();
const counter = await page.locator('section[aria-label="契約チェックリスト"]').innerText();
await page.screenshot({ path: path.join(OUT, "02_after_toggle_reload.png") });
console.log(`toggle: before=${before} afterReload=${afterReload} (期待: 反転して保持)`);
console.log("alerts after toggle:", JSON.stringify(alertsAfterToggle));
console.log("counter text head:", counter.split("\n")[0]);

// ③ 元に戻す(検証データを残さない)
const box2 = page.locator('section[aria-label="契約チェックリスト"] input[type=checkbox]').first();
if ((await box2.isChecked()) !== before) { await box2.click(); await page.waitForTimeout(2000); }

const pass = alerts.length === 0 && failed.length === 0 && alertsAfterToggle.length === 0 && afterReload === !before;
console.log(pass ? "CONTRACT TAB VERIFY: PASS" : "CONTRACT TAB VERIFY: FAIL");
await browser.close();
process.exit(pass ? 0 : 1);
