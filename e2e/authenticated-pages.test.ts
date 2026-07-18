import { test, expect, type Page } from "@playwright/test";
import * as path from "path";
import * as url from "url";
import * as fs from "fs";

// Bypass AuthGuard by injecting window.__E2E_BYPASS_AUTH__ before any React code runs.
// This is safe because:
//   1. No production build includes this flag — it must be explicitly injected by the test runner.
//   2. The check in AuthGuard is a simple window property guard with no env-var dependency.
async function bypassAuth(page: Page) {
  await page.addInitScript(() => {
    window.__E2E_BYPASS_AUTH__ = true;
  });
}

// ESM-compatible __dirname
const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

// Ensure screenshots directory exists
const screenshotsDir = path.join(__dirname, "screenshots");
if (!fs.existsSync(screenshotsDir)) {
  fs.mkdirSync(screenshotsDir, { recursive: true });
}

const ROUTES: Array<{ name: string; hash: string; expectText?: string }> = [
  { name: "app", hash: "/app", expectText: "LapoSite" },
  { name: "gantt", hash: "/gantt", expectText: "LapoSite" },
  { name: "tasks", hash: "/tasks", expectText: "LapoSite" },
  { name: "estimate", hash: "/estimate", expectText: "LapoSite" },
  { name: "contractors", hash: "/contractors", expectText: "LapoSite" },
  { name: "safety", hash: "/safety", expectText: "LapoSite" },
  { name: "crm", hash: "/crm", expectText: "LapoSite" },
  { name: "reports", hash: "/reports", expectText: "LapoSite" },
];

test.describe("認証済みページ (auth bypass)", () => {
  test.beforeEach(async ({ page }) => {
    await bypassAuth(page);
  });

  for (const route of ROUTES) {
    test(`${route.name} ページがロードされる (${route.hash})`, async ({ page }) => {
      const errors: string[] = [];

      page.on("pageerror", (err) => {
        errors.push(err.message);
      });

      await page.goto(`/#${route.hash}`);

      // Wait for Suspense to resolve and page to stabilize
      await page.waitForLoadState("networkidle");

      // Brand header must be visible (confirms app shell rendered, not login page)
      await expect(page.locator("text=LapoSite").first()).toBeVisible({ timeout: 10000 });

      // Must NOT be showing the login form (would mean AuthGuard redirected)
      await expect(page.locator("#email")).not.toBeVisible();

      // No uncaught JS errors
      expect(errors).toHaveLength(0);

      // Screenshot for visual verification
      await page.screenshot({
        path: path.join(screenshotsDir, `${route.name}.png`),
        fullPage: false,
      });
    });
  }

  test("認証バイパス後に別ページへナビゲートできる", async ({ page }) => {
    await page.goto("/#/app");
    await page.waitForLoadState("networkidle");
    await expect(page.locator("text=LapoSite").first()).toBeVisible({ timeout: 10000 });

    // Navigate to tasks
    await page.goto("/#/tasks");
    await page.waitForLoadState("networkidle");
    await expect(page.locator("text=LapoSite").first()).toBeVisible({ timeout: 10000 });

    // Still not showing login form
    await expect(page.locator("#email")).not.toBeVisible();
  });
});
