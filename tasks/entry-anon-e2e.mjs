// QR入場ページ anon書込E2E（本番）— draft migration 適用後の再検証用
// 使い方: PROJECT_ID=<本番projectのUUID> node tasks/entry-anon-e2e.mjs
// 成功条件: 未ログインで 入場(開始写真)→退場(完了写真) が保存エラーなく完走し、入場者一覧に反映される
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";

const projectId = process.env.PROJECT_ID;
if (!projectId) {
  console.error("FAIL: PROJECT_ID env が必要です（本番projectのUUID）");
  process.exit(2);
}
const base = process.env.SHOT_BASE ?? "https://construction-pm-mvp.vercel.app/#";
const outDir = `${process.env.HOME}/reports/entry-anon-e2e-20260704`;
mkdirSync(outDir, { recursive: true });

const workerName = `E2E検証_${new Date().toISOString().slice(11, 16).replace(":", "")}`;
let failed = false;
const fail = (msg) => { console.error("FAIL:", msg); failed = true; };

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 480, height: 900 } });
const page = await ctx.newPage();

await page.goto(`${base}/entry/${projectId}`, { waitUntil: "networkidle", timeout: 30000 });
await page.waitForTimeout(1500);
const testImg = `${outDir}/anon-0-initial.png`;
await page.screenshot({ path: testImg });

try {
  await page.getByRole("button", { name: "+ 手動入力" }).click({ timeout: 8000 });
  await page.getByPlaceholder("田中 太郎").fill(workerName);
  await page.getByPlaceholder("ABC建設").fill("ラポルタ検証");
  await page.locator("select:visible").last().selectOption("大工").catch(() => {});
  await page.getByRole("button", { name: "次へ" }).click();
  await page.waitForTimeout(500);

  await page.locator('input[type="file"]').first().setInputFiles(testImg);
  await page.waitForTimeout(800);
  await page.getByRole("button", { name: "入場" }).click({ timeout: 5000 });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: `${outDir}/anon-1-after-enter.png` });

  if (await page.getByText(/入場記録の保存に失敗しました/).count()) {
    fail("入場保存がRLS等で拒否された（migration未適用 or anonポリシー不備）");
  } else if (!(await page.getByText(workerName).count())) {
    fail(`入場者一覧に ${workerName} が表示されない`);
  } else {
    console.log("OK: anon入場保存 + 一覧反映");
  }

  if (!failed) {
    await page.getByRole("button", { name: /OUT|退場|完了/ }).first().click({ timeout: 5000 });
    await page.waitForTimeout(800);
    await page.locator('input[type="file"]').last().setInputFiles(testImg);
    await page.waitForTimeout(800);
    await page.getByRole("button", { name: /退場|完了/ }).first().click({ timeout: 5000 });
    await page.waitForTimeout(3000);
    await page.screenshot({ path: `${outDir}/anon-2-after-exit.png` });
    if (await page.getByText(/退場記録の保存に失敗しました/).count()) {
      fail("退場保存が拒否された（anon UPDATEポリシー不備）");
    } else {
      console.log("OK: anon退場保存（完了写真つき）");
    }
  }
} catch (e) {
  fail(e.message.split("\n")[0]);
  await page.screenshot({ path: `${outDir}/anon-error.png` });
}

await browser.close();
console.log(failed ? "RESULT: FAIL" : "RESULT: PASS", "| shots:", outDir, "| test worker:", workerName);
process.exit(failed ? 1 : 0);
