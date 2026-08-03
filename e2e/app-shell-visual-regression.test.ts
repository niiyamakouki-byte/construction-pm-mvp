/**
 * LapoSite visual sweep 20260722 regression coverage.
 * Provenance: report laposite-visual-sweep-20260722 / author type: Codex.
 */
import { expect, test, type Page } from "@playwright/test";
import { bypassAuthWithSeed } from "./helpers/e2e-bypass.js";

async function openAuthenticated(page: Page, route: string, theme: "light" | "dark" = "light") {
  await bypassAuthWithSeed(page, {
    "genbahub-sidebar-collapsed": "0",
    "genbahub-theme": theme,
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`/#${route}`);
  await page.waitForLoadState("networkidle");
  await expect(page.locator("main h1, main h2").first()).toBeVisible();
}

async function contrastRatio(page: Page, selector: string) {
  return page.locator(selector).evaluate((element) => {
    const parse = (value: string) => {
      const channels = value.match(/[\d.]+/g)?.map(Number) ?? [];
      return channels.slice(0, 3);
    };
    const luminance = (channels: number[]) => {
      const [red, green, blue] = channels.map((channel) => {
        const normalized = channel / 255;
        return normalized <= 0.03928
          ? normalized / 12.92
          : ((normalized + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
    };
    const style = getComputedStyle(element);
    const foreground = luminance(parse(style.color));
    const background = luminance(parse(style.backgroundColor));
    return (Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05);
  });
}

test("desktop shell keeps every major page heading clear of the sidebar", async ({ page }) => {
  const routes = ["/today", "/app", "/photos", "/tasks", "/estimate", "/account", "/crm"];

  for (const route of routes) {
    await openAuthenticated(page, route);
    const geometry = await page.evaluate(() => {
      const sidebar = document.querySelector<HTMLElement>(".ios-sidebar");
      const main = document.querySelector<HTMLElement>("main");
      const heading = document.querySelector<HTMLElement>("main h1, main h2");
      if (!sidebar || !main || !heading) throw new Error("app shell geometry target missing");
      return {
        sidebarRight: sidebar.getBoundingClientRect().right,
        mainLeft: main.getBoundingClientRect().left,
        headingLeft: heading.getBoundingClientRect().left,
      };
    });

    expect(geometry.mainLeft, `${route}: main must start at the sidebar edge`).toBe(geometry.sidebarRight);
    expect(geometry.headingLeft, `${route}: heading must not sit beneath the sidebar`).toBeGreaterThan(geometry.sidebarRight);
  }
});

test("CRM first pipeline stage is readable and the duplicate quick-action panel is absent", async ({ page }) => {
  await openAuthenticated(page, "/crm", "dark");
  const sidebarRight = await page.locator(".ios-sidebar").evaluate((element) => element.getBoundingClientRect().right);
  const firstStage = page.getByText(/^引合\s+\(\d+\)$/).first();

  await expect(firstStage).toBeVisible();
  await expect(firstStage).toContainText("引合");
  expect(await firstStage.evaluate((element) => element.getBoundingClientRect().left)).toBeGreaterThan(sidebarRight);
  await expect(page.getByText("次にやること", { exact: true })).toHaveCount(0);
  await expect(page.locator('[data-testid="sidebar-primary-nav"]')).toBeVisible();
});

for (const theme of ["light", "dark"] as const) {
  test(`theme toggle remains visible in ${theme} mode`, async ({ page }) => {
    await openAuthenticated(page, "/crm", theme);
    const toggle = page.locator(".theme-toggle");

    await expect(toggle).toBeVisible();
    expect(await contrastRatio(page, ".theme-toggle")).toBeGreaterThanOrEqual(4.5);
  });
}
