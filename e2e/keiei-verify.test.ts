import { test, expect } from "@playwright/test";
import { bypassAuth } from "./helpers/e2e-bypass.js";

// 経営タブ(/keiei)の実機検証。委譲ブリーフ「経営の数字を1画面で見えるようにする」の
// --done 条件(実データ表示・予測/実績の視覚区別・データ欠損628件の表示・スマホ幅崩れなし)を
// スクショで実証する。screenshotは tasks/keiei-verify/ (gitignore対象、コミットしない)。

const EVIDENCE_DIR = "tasks/keiei-verify";

test.describe("経営タブ 実機検証", () => {
  test("PC幅: 実データ(残高・ランウェイ・未回収・データ欠損)が表示される", async ({ page }) => {
    await bypassAuth(page);
    await page.setViewportSize({ width: 1440, height: 900 });

    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));

    await page.goto("/#/keiei");
    await expect(page.getByRole("heading", { name: "経営" })).toBeVisible({ timeout: 10000 });
    // 実データ(freee実残高)が表示されるまで待つ
    await expect(page.getByText(/￥[\d,]+/).first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByText("予測").first()).toBeVisible();
    await expect(page.getByText(/データ欠損: 未登録取引/)).toBeVisible();

    await page.screenshot({ path: `${EVIDENCE_DIR}/pc-1440x900.png`, fullPage: true });
    expect(errors).toHaveLength(0);
  });

  test("スマホ幅375px: 横スクロールなし・実データ表示", async ({ page }) => {
    await bypassAuth(page);
    await page.setViewportSize({ width: 375, height: 812 });

    await page.goto("/#/keiei");
    await expect(page.getByRole("heading", { name: "経営" })).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/￥[\d,]+/).first()).toBeVisible({ timeout: 10000 });

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    expect(overflow).toBe(false);

    await page.screenshot({ path: `${EVIDENCE_DIR}/mobile-375x812.png`, fullPage: true });
  });
});
