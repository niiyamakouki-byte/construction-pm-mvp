import { chromium } from "@playwright/test";

const outDir = process.env.HOME + "/reports/genbahub-ux-fix-20260704";
const base = process.env.SHOT_BASE ?? "http://localhost:4173/#";
const testImg = outDir + "/entry-step1-initial.png";

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 480, height: 900 } });
await ctx.addInitScript(() => { window.__E2E_BYPASS_AUTH__ = true; });

const page = await ctx.newPage();
await page.goto(base + "/entry/demo-project-1", { waitUntil: "networkidle", timeout: 20000 }).catch(e => console.log("load warn:", e.message.split("\n")[0]));
await page.waitForTimeout(1500);

try {
  await page.getByRole("button", { name: "+ 手動入力" }).click({ timeout: 5000 });
  await page.getByPlaceholder("田中 太郎").fill("山田太郎");
  await page.getByPlaceholder("ABC建設").fill("ラポルタ");
  await page.locator("select:visible").last().selectOption("大工").catch(() => {});
  await page.screenshot({ path: `${outDir}/entry-1-modal.png` });
  console.log("shot: entry-1-modal");

  await page.getByRole("button", { name: "次へ" }).click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${outDir}/entry-2-start-photo.png` });
  console.log("shot: entry-2-start-photo");

  const fileInput = page.locator('input[type="file"]').first();
  await fileInput.setInputFiles(testImg);
  await page.waitForTimeout(1000);
  await page.getByRole("button", { name: "入場" }).click({ timeout: 5000 });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${outDir}/entry-3-working.png` });
  console.log("shot: entry-3-working");

  const outBtn = page.getByRole("button", { name: /OUT|退場|完了/ }).first();
  await outBtn.click({ timeout: 5000 }).catch(e => console.log("OUT warn:", e.message.split("\n")[0]));
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${outDir}/entry-4-end-photo.png` });
  console.log("shot: entry-4-end-photo");
  const endInput = page.locator('input[type="file"]').last();
  await endInput.setInputFiles(testImg).catch(e => console.log("end photo warn:", e.message.split("\n")[0]));
  await page.waitForTimeout(1000);
  await page.getByRole("button", { name: /退場|完了/ }).first().click({ timeout: 5000 }).catch(e => console.log("exit warn:", e.message.split("\n")[0]));
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${outDir}/entry-5-after-exit.png` });
  console.log("shot: entry-5-after-exit");
} catch (e) {
  console.log("interact warn:", e.message.split("\n")[0]);
  await page.screenshot({ path: `${outDir}/entry-fallback3.png` });
}
await browser.close();
