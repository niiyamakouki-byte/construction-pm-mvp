import { test, expect } from "@playwright/test";

/**
 * ライブの Google OAuth は Dashboard の Client Secret が必要なので、ここでは UI と
 * 未設定時の失敗表示だけを自動確認する。本番の同意画面は docs/auth-google.md の手動確認。
 */
const VIEWPORTS = [
  { name: "desktop-1440", width: 1440, height: 900 },
  { name: "android-390", width: 390, height: 844 },
  { name: "android-412", width: 412, height: 915 },
];

for (const viewport of VIEWPORTS) {
  test(`Google が主ボタンである (${viewport.name})`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto("/#/login");
    const button = page.getByTestId("google-sign-in");
    await expect(button).toBeVisible();
    await expect(button).toContainText("Google でログイン");

    const box = await button.boundingBox();
    expect(box).not.toBeNull();
    if (box) {
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 1);
    }

    await button.click();
    await expect(page.getByRole("alert")).toContainText("Supabase が設定されていません");
  });
}

test.describe("ライブ Google OAuth（手動）", () => {
  test.skip(true, "Supabase と Google Cloud の秘密情報が必要。docs/auth-google.md の手動確認");
  test("本番で同意後に /app へ戻る", async () => {
    // checklist: docs/auth-google.md
  });
});
