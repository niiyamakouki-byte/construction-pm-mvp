import { chromium } from "@playwright/test";

const BASE = "http://127.0.0.1:5173";
const OUT = new URL(".", import.meta.url).pathname;

const MOBILE = { width: 390, height: 844 };
const DESKTOP = { width: 1280, height: 900 };

// Empty-state routes. Fresh localStorage (no projects/tasks/photos) => empty states.
const routes = [
  { name: "tasks", hash: "/tasks", expect: "タスクがありません" },
  { name: "photos", hash: "/photos", expect: "保存済み写真がありません" },
  { name: "progress-review", hash: "/progress-review", expect: "案件選択と写真選択" },
  { name: "cost-management", hash: "/cost-management", expect: "コスト管理を開始" },
];

const browser = await chromium.launch();
const results = [];

for (const viewport of [
  { label: "390", size: MOBILE },
  { label: "desktop", size: DESKTOP },
]) {
  for (const route of routes) {
    // fresh context = empty data each time
    const context = await browser.newContext({ viewport: viewport.size });
    await context.addInitScript(() => {
      window.__E2E_BYPASS_AUTH__ = true;
      localStorage.clear();
      localStorage.setItem("genbahub_onboarding_done", "1");
      localStorage.setItem("genbahub_tour_done", "1");
    });
    const page = await context.newPage();
    await page.goto(`${BASE}/#${route.hash}`);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(800);
    const bodyText = await page.evaluate(() => document.body.innerText);
    const found = bodyText.includes(route.expect);
    // Count actionable buttons within empty-state cards (dashed border container)
    const ctaCount = await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll("div"))
        .filter((d) => d.className.includes("border-dashed"));
      let n = 0;
      for (const c of cards) n += c.querySelectorAll("button").length;
      return n;
    });
    const file = `${OUT}${route.name}-${viewport.label}.png`;
    await page.screenshot({ path: file, fullPage: true });
    results.push({ route: route.name, viewport: viewport.label, found, ctaCount, file });
    await context.close();
  }
}

await browser.close();
console.log(JSON.stringify(results, null, 2));
