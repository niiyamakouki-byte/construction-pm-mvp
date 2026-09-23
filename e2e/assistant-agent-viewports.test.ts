import { test, expect, type Page } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

const OUT_DIR = path.join(process.cwd(), "docs", "ai-agent-verification");

async function openApp(page: Page) {
  await page.addInitScript(() => {
    window.__E2E_BYPASS_AUTH__ = true;
    localStorage.setItem("genbahub_onboarding_done", "1");
    localStorage.setItem("genbahub_tour_done", "1");
    localStorage.setItem("genbahub:last-project-id", "e2e-assistant");
    localStorage.removeItem("genbahub_assistant_chat_v3");
    localStorage.removeItem("genbahub_chat_size");
    localStorage.removeItem("genbahub_chat_pos");
  });
  await page.goto("/#/app");
  await expect(page.locator("header")).toBeVisible({ timeout: 15000 });
}

test.describe("AI秘書 ビューポート", () => {
  test("desktop 1440: ヘッダーから開き、/help がすぐ返る", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openApp(page);
    const launcher = page.getByRole("button", { name: "AIに相談" });
    await expect(launcher).toBeVisible();
    await expect(page.getByTestId("assistant-chat-fab")).toHaveCount(0);

    const started = Date.now();
    await launcher.click();
    const dialog = page.getByRole("dialog", { name: "ラポルタ秘書チャット" });
    await expect(dialog).toBeVisible();
    const box = await dialog.boundingBox();
    expect(box).not.toBeNull();
    if (box) {
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(1440 + 1);
      expect(box.y + box.height).toBeLessThanOrEqual(900 + 1);
    }

    await dialog.getByLabel("メッセージ入力").fill("/help");
    const sentAt = Date.now();
    await dialog.getByRole("button", { name: "送信" }).click({ force: true });
    await expect(dialog.getByText(/\/estimate/)).toBeVisible();
    const replyMs = Date.now() - sentAt;
    expect(replyMs).toBeLessThan(1500);

    fs.mkdirSync(OUT_DIR, { recursive: true });
    await page.screenshot({ path: path.join(OUT_DIR, "desktop-1440-assistant.png") });
    fs.writeFileSync(
      path.join(OUT_DIR, "desktop-1440.json"),
      JSON.stringify({ openToVisibleMs: Date.now() - started, replyMs, viewport: "1440x900" }, null, 2),
    );
  });

  for (const viewport of [
    { name: "android-390", width: 390, height: 844 },
    { name: "android-412", width: 412, height: 915 },
  ]) {
    test(`${viewport.name}: FAB は下ナビと重ならず、シートは画面内`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await openApp(page);

      const fab = page.getByTestId("assistant-chat-fab");
      const nav = page.getByTestId("mobile-bottom-nav");
      await expect(fab).toBeVisible();
      await expect(nav).toBeVisible();
      const fabBox = await fab.boundingBox();
      const navBox = await nav.boundingBox();
      expect(fabBox && navBox).toBeTruthy();
      if (fabBox && navBox) {
        const overlap = fabBox.y < navBox.y + navBox.height && fabBox.y + fabBox.height > navBox.y
          && fabBox.x < navBox.x + navBox.width && fabBox.x + fabBox.width > navBox.x;
        expect(overlap).toBe(false);
      }

      await fab.click();
      const dialog = page.getByRole("dialog", { name: "ラポルタ秘書チャット" });
      await expect(dialog).toBeVisible();
      const box = await dialog.boundingBox();
      expect(box).not.toBeNull();
      if (box) {
        expect(box.width).toBeLessThanOrEqual(viewport.width + 1);
        expect(box.x).toBeGreaterThanOrEqual(-1);
        expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 1);
      }
      const input = dialog.getByLabel("メッセージ入力");
      await expect(input).toBeVisible();
      await input.fill("/help");
      const sentAt = Date.now();
      await dialog.getByRole("button", { name: "送信" }).click({ force: true });
      await expect(dialog.getByText(/\/estimate/)).toBeVisible();
      const replyMs = Date.now() - sentAt;

      fs.mkdirSync(OUT_DIR, { recursive: true });
      await page.screenshot({ path: path.join(OUT_DIR, `${viewport.name}-assistant.png`) });
      fs.writeFileSync(
        path.join(OUT_DIR, `${viewport.name}.json`),
        JSON.stringify({
          replyMs,
          fab: fabBox,
          nav: navBox,
          panel: box,
          viewport,
        }, null, 2),
      );
    });
  }
});
