// LapoSite(GenbaHub) 本番 主要フローE2E: ログイン → 案件作成 → 見積 → 請求
// 来歴: 2026-07-21 SaaS公開推進タスク (Claude Opus 4.8 ワーカー)
// 使い方: E2E_EMAIL=... E2E_PASSWORD=... node docs/saas-launch-verify-20260721/prod-flow.mjs [baseUrl] [startStep]
// 注意: テストアカウント専用。実課金(Stripe本番)には触れない。
import { chromium } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";
import * as url from "url";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "evidence");
fs.mkdirSync(OUT, { recursive: true });

const BASE = process.argv[2] || "https://construction-pm-mvp.vercel.app";
const STAMP = process.env.RUN_STAMP || "flow";
const EMAIL = process.env.E2E_EMAIL;
const PASSWORD = process.env.E2E_PASSWORD;

const log = [];
const say = (...a) => {
  const l = a.join(" ");
  log.push(l);
  console.log(l);
};
const flush = () => fs.writeFileSync(path.join(OUT, `${STAMP}.log`), log.join("\n") + "\n");

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1400, height: 950 } });
const page = await ctx.newPage();
const errs = [];
page.on("pageerror", (e) => errs.push("pageerror: " + e.message));
page.on("console", (m) => {
  if (m.type() === "error") errs.push("console.error: " + m.text().slice(0, 200));
});

const shot = async (n) => {
  const p = path.join(OUT, `${STAMP}-${n}.png`);
  await page.screenshot({ path: p });
  say(`  [shot] ${path.basename(p)}`);
};
const dump = async (label) => {
  const acts = await page
    .locator("button,[role=button],a")
    .evaluateAll((els) =>
      els.map((e) => e.textContent.replace(/\s+/g, " ").trim().slice(0, 26)).filter(Boolean),
    );
  const fields = await page
    .locator("input,textarea,select")
    .evaluateAll((els) => els.map((e) => `${e.id || e.name || "(noid)"}|${e.type || e.tagName}`));
  say(`  [${label}] url=${page.url().replace(BASE, "")}`);
  say(`  [${label}] fields=${JSON.stringify(fields.slice(0, 30))}`);
  say(`  [${label}] actions=${JSON.stringify([...new Set(acts)].slice(0, 45))}`);
};

const results = {};
async function step(name, fn) {
  say(`\n### ${name}`);
  try {
    await fn();
    results[name] = "PASS";
    say(`  => PASS`);
  } catch (e) {
    results[name] = "FAIL: " + e.message.split("\n")[0].slice(0, 160);
    say(`  => FAIL: ${e.message.split("\n")[0].slice(0, 200)}`);
    await shot(`ERR-${name.replace(/[^a-z0-9]/gi, "")}`);
  }
}

// ── 1. ログイン ──────────────────────────────────────────────────────
await step("1-login", async () => {
  await page.goto(BASE + "/#/login", { waitUntil: "networkidle" });
  await page.waitForTimeout(1200);
  await page.getByRole("button", { name: /メールアドレスとパスワードでログイン/ }).click();
  await page.waitForTimeout(600);
  await page.locator('input[type="email"]').first().fill(EMAIL);
  await page.locator('input[type="password"]').first().fill(PASSWORD);
  await shot("01-login-filled");
  await page.locator("button[type=submit]").first().click();
  await page.waitForTimeout(7000);
  await shot("02-after-login");
  await dump("after-login");
  const body = (await page.locator("body").innerText()).replace(/\s+/g, " ");
  say("  body:", body.slice(0, 300));
  if (/ログインに失敗|Invalid login|メールアドレスとパスワードでログイン/.test(body)) {
    throw new Error("still on login screen: " + body.slice(0, 160));
  }
});

const PNAME = process.env.E2E_PROJECT_NAME || "E2E検証案件-20260721";

// ── 2. 案件作成 ──────────────────────────────────────────────────────
await step("2-project-create", async () => {
  await page.goto(BASE + "/#/today", { waitUntil: "networkidle" });
  await page.waitForTimeout(2500);
  await page.getByRole("button", { name: "案件一覧" }).first().click();
  await page.waitForTimeout(3000);
  say("  route after 案件一覧 click:", page.url().replace(BASE, ""));
  await shot("03-projects");
  await dump("projects");
  const btn = page.getByRole("button", { name: /案件を(作成|登録|追加)|新規案件|\+ ?案件/ }).first();
  await btn.click({ timeout: 15000 });
  await page.waitForTimeout(2000);
  await shot("04-project-form");
  await dump("project-form");
  const nameBox = page.locator('input[type="text"]:visible').first();
  await nameBox.fill(PNAME);
  await shot("05-project-filled");
  await page
    .getByRole("button", { name: /作成|登録|保存|次へ/ })
    .last()
    .click();
  await page.waitForTimeout(4000);
  await shot("06-project-created");
  const body = (await page.locator("body").innerText()).replace(/\s+/g, " ");
  say("  body:", body.slice(0, 260));
  if (!body.includes(PNAME)) throw new Error(`created project "${PNAME}" not visible after submit`);
});

// ── 3. 見積 ─────────────────────────────────────────────────────────
await step("3-estimate", async () => {
  await page.goto(BASE + "/#/estimate", { waitUntil: "networkidle" });
  await page.waitForTimeout(3000);
  await shot("07-estimate");
  await page.getByRole("button", { name: /品目追加/ }).first().click();
  await page.waitForTimeout(3000);
  await shot("07b-estimate-items");
  await dump("estimate-items");
  const body = (await page.locator("body").innerText()).replace(/\s+/g, " ");
  say("  body:", body.slice(0, 500));
});

// ── 4. 請求 ─────────────────────────────────────────────────────────
await step("4-invoice", async () => {
  await page.goto(BASE + "/#/invoices", { waitUntil: "networkidle" });
  await page.waitForTimeout(3000);
  await shot("08-invoices");
  await page.getByRole("button", { name: /請求書を登録/ }).first().click();
  await page.waitForTimeout(3000);
  await shot("08b-invoice-form");
  await dump("invoice-form");
  const body = (await page.locator("body").innerText()).replace(/\s+/g, " ");
  say("  body:", body.slice(0, 500));
});

say(`\n=== console/page errors: ${errs.length} ===`);
errs.slice(0, 20).forEach((e) => say("  " + e));
say("\n=== RESULTS ===");
for (const [k, v] of Object.entries(results)) say(`  ${k}: ${v}`);
flush();
await browser.close();
