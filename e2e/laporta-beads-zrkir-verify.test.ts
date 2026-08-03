import { test, expect } from "@playwright/test";
import { bypassAuth } from "./helpers/e2e-bypass.js";

// laporta-beads-zrkir: TourGuideのTOUR_STEPS(5件)が参照するdata-tour属性が
// 全て実DOM要素に付与され、各ステップでhighlightRectが非null(=実要素をhighlight)
// になることを固定する。
//
// 検証方法: TourGuideは highlightRect が非nullの時だけ
// `.ring-4.ring-brand-400` のハイライト枠divを描画する(TourGuide.tsx参照)。
// 各ステップでこの枠が「幅・高さとも正の値」で存在することを見れば、
// querySelectorが実要素を見つけて向いていることを直接検証できる
// (nullなら枠自体がDOMに無い = toBeVisibleが失敗する)。
//
// nav-contractors/help-linkは折りたたみ済みのドロワー/アコーディオン背後にあり
// 自動ツアー中は到達不能と判明したため、常時レンダリングされるGanttPageの
// 「出力」「分析」メニューへ差し替え済み(TourGuide.tsx参照)。

test.describe("laporta-beads-zrkir: TourGuide 5ステップ全てが実要素をhighlightする", () => {
  test("390px: 5ステップ全てでhighlight枠が実要素の上に表示される", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await bypassAuth(page);

    await page.goto("/#/app");
    await page.waitForURL(/#\/gantt\//, { timeout: 15000 });
    await page.waitForLoadState("networkidle");

    const dialog = page.getByRole("dialog", { name: /ツアーガイド/ });
    await expect(dialog).toBeVisible({ timeout: 10000 });

    const ring = page.locator(".ring-4.ring-brand-400");
    const expectedTitles = [
      "ここが工程表です",
      "タスクを追加するには",
      "ドラッグで日数変更",
      "PDFやカレンダーに出力",
      "リソースやリスクを分析",
    ];

    for (let i = 0; i < expectedTitles.length; i++) {
      await expect(dialog).toContainText(expectedTitles[i]);
      await expect(dialog).toContainText(`${i + 1} / ${expectedTitles.length}`);

      // highlightRectが非null(=実要素を指している)ことを、実際に描画される
      // ハイライト枠の存在+正のサイズで検証する
      await expect(ring).toBeVisible({ timeout: 5000 });
      const box = await ring.boundingBox();
      expect(box, `step ${i + 1} (${expectedTitles[i]}): highlight枠が見つからない`).not.toBeNull();
      expect(box!.width, `step ${i + 1}: highlight枠の幅が0`).toBeGreaterThan(0);
      expect(box!.height, `step ${i + 1}: highlight枠の高さが0`).toBeGreaterThan(0);

      const isLast = i === expectedTitles.length - 1;
      await dialog.getByText(isLast ? "完了" : "次へ →", { exact: true }).click();
    }

    await expect(dialog).not.toBeVisible();
  });

  test("1440px: 5ステップ全てでhighlight枠が実要素の上に表示される", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await bypassAuth(page);

    await page.goto("/#/app");
    await page.waitForURL(/#\/gantt\//, { timeout: 15000 });
    await page.waitForLoadState("networkidle");

    const dialog = page.getByRole("dialog", { name: /ツアーガイド/ });
    await expect(dialog).toBeVisible({ timeout: 10000 });

    const ring = page.locator(".ring-4.ring-brand-400");
    const steps = 5;
    for (let i = 0; i < steps; i++) {
      await expect(dialog).toContainText(`${i + 1} / ${steps}`);
      await expect(ring).toBeVisible({ timeout: 5000 });
      const box = await ring.boundingBox();
      expect(box, `step ${i + 1}: highlight枠が見つからない`).not.toBeNull();
      expect(box!.width, `step ${i + 1}: highlight枠の幅が0`).toBeGreaterThan(0);
      expect(box!.height, `step ${i + 1}: highlight枠の高さが0`).toBeGreaterThan(0);

      const isLast = i === steps - 1;
      await dialog.getByText(isLast ? "完了" : "次へ →", { exact: true }).click();
    }

    await expect(dialog).not.toBeVisible();
  });
});
