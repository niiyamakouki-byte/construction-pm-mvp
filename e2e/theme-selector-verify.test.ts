/**
 * テーマカラー選択の実走検証（2026-08-08 光輝さん「テーマカラーは選択式でもいいよね」）
 * 各テーマについて: localStorage シード → 起動時適用(initAccentTheme) →
 * --color-brand-700 の computed 値がテーマ定義と一致することを実測 → 1440幅スクショ。
 * スクショ出力先は THEME_SHOT_DIR 環境変数で上書き可能。
 */
import { test, expect } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";
import * as url from "url";
import { bypassAuthWithSeed } from "./helpers/e2e-bypass.js";
import { ACCENT_THEMES, ACCENT_STORAGE_KEY } from "../src/theme/accents.js";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const outDir =
  process.env.THEME_SHOT_DIR ?? path.join(__dirname, "screenshots", "theme-selector");
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

for (const theme of ACCENT_THEMES) {
  test(`テーマ「${theme.label}」(${theme.id}) が適用され brand-700 が ${theme.swatch} になる`, async ({ page }) => {
    await bypassAuthWithSeed(page, { [ACCENT_STORAGE_KEY]: theme.id });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/#/account");

    await expect(page.getByRole("radiogroup", { name: "テーマカラー" })).toBeVisible();

    // 既定セージは data-accent を持たない（素の :root = sage-guard の検証対象のまま）
    const accentAttr = await page.evaluate(
      () => document.documentElement.dataset.accent ?? null,
    );
    expect(accentAttr).toBe(theme.id === "sage" ? null : theme.id);

    // アクセントトークンの実測値がテーマ定義と一致する
    const brand700 = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue("--color-brand-700").trim(),
    );
    expect(brand700.toLowerCase()).toBe(theme.swatch.toLowerCase());

    // 選択中テーマのラジオが checked 表示になっている
    await expect(
      page.getByRole("radio", { name: new RegExp(theme.label) }),
    ).toHaveAttribute("aria-checked", "true");

    await page.screenshot({
      path: path.join(outDir, `theme-${theme.id}-1440.png`),
      fullPage: true,
    });
  });
}
