// GenbaHub / LapoSite 本番 E2E: 新規登録 → 案件作成 → 見積 → 請求
// 来歴: 2026-07-21 SaaS公開推進タスク (Claude Opus 4.8 ワーカー) / commit fa1b03b, ed8577a の後続検証
// 使い方: node docs/saas-launch-verify-20260721/prod-e2e.mjs [baseUrl]
// 注意: 実顧客データ・実課金には触れない。テストアカウントのみ。
import { chromium } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";
import * as url from "url";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "evidence");
fs.mkdirSync(OUT, { recursive: true });

const BASE = process.argv[2] || "https://construction-pm-mvp.vercel.app";
const STAMP = process.env.RUN_STAMP || "run";
const EMAIL = process.env.E2E_EMAIL;
const PASSWORD = process.env.E2E_PASSWORD;
const log = [];
function say(...a) {
  const line = a.join(" ");
  log.push(line);
  console.log(line);
}
function flush() {
  fs.writeFileSync(path.join(OUT, `${STAMP}.log`), log.join("\n") + "\n");
}

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();
const consoleErrors = [];
page.on("pageerror", (e) => consoleErrors.push("pageerror: " + e.message));
page.on("console", (m) => {
  if (m.type() === "error") consoleErrors.push("console.error: " + m.text().slice(0, 240));
});

async function shot(name) {
  const p = path.join(OUT, `${STAMP}-${name}.png`);
  await page.screenshot({ path: p, fullPage: false });
  say(`  [shot] ${p}`);
}
async function dump(label) {
  const inputs = await page
    .locator("input,textarea,select")
    .evaluateAll((els) => els.map((e) => `${e.id || "(noid)"}|${e.type || e.tagName}|${e.placeholder || "-"}`));
  const buttons = await page
    .locator("button,[role=button],a")
    .evaluateAll((els) => els.map((e) => e.textContent.trim().slice(0, 28)).filter(Boolean));
  say(`  [${label}] url=${page.url().replace(BASE, "")}`);
  say(`  [${label}] fields=${JSON.stringify(inputs)}`);
  say(`  [${label}] actions=${JSON.stringify(buttons.slice(0, 40))}`);
}

try {
  // ── STEP 1: 新規登録 ──────────────────────────────────────────────
  say("### STEP 1: 新規登録 (signup)");
  const resp = await page.goto(BASE + "/#/signup", { waitUntil: "networkidle" });
  say(`  HTTP ${resp.status()} ${BASE}/#/signup`);
  await page.waitForTimeout(1800);
  await shot("01-signup-form");
  await dump("signup");

  if (EMAIL && PASSWORD) {
    say(`  filling email=${EMAIL}`);
    const company = page.locator("#company");
    if (await company.count()) await company.fill("E2Eテスト工務店(2026-07-21)");
    const emailBox = page.locator('input[type="email"]').first();
    const pwBoxes = page.locator('input[type="password"]');
    await emailBox.fill(EMAIL);
    const pwCount = await pwBoxes.count();
    for (let i = 0; i < pwCount; i++) await pwBoxes.nth(i).fill(PASSWORD);
    say(`  password fields filled: ${pwCount}`);
    await shot("02-signup-filled");

    const submit = page
      .locator("button[type=submit]")
      .or(page.getByRole("button", { name: /登録|作成|サインアップ|続ける/ }))
      .first();
    await submit.click();
    await page.waitForTimeout(6000);
    await shot("03-signup-result");
    await dump("after-signup");
    say("  body snippet:", (await page.locator("body").innerText()).replace(/\s+/g, " ").slice(0, 500));
  } else {
    say("  (E2E_EMAIL/E2E_PASSWORD 未指定 — 入力はスキップし構造ダンプのみ)");
  }
} catch (e) {
  say("  !! STEP1 error:", e.message);
  await shot("01-error");
}

say(`\nconsole errors: ${consoleErrors.length}`);
consoleErrors.slice(0, 15).forEach((e) => say("  " + e));
flush();
await browser.close();
