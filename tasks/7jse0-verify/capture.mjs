// Ticket: laporta-beads-7jse0 | Author: Codex | 2026-08-06
import { chromium } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const baseUrl = process.env.GENBAHUB_URL ?? "http://127.0.0.1:5173";
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
await context.addInitScript(() => {
  window.__E2E_BYPASS_AUTH__ = true;
  localStorage.setItem("genbahub_onboarding_done", "1");
  localStorage.setItem("genbahub_tour_done", "1");
  localStorage.setItem("genbahub:projects", JSON.stringify([{
    id: "550e8400-e29b-41d4-a716-446655440000",
    name: "渋谷オフィスビル内装工事",
    description: "モバイル確認用の案件です。",
    address: "東京都渋谷区",
    status: "active",
    mode: "normal",
    startDate: "2026-08-06",
    includeWeekends: true,
    createdAt: "2026-08-06T00:00:00.000Z",
    updatedAt: "2026-08-06T00:00:00.000Z",
  }]));
});
const page = await context.newPage();

const routes = [
  ["04-projects-390.png", "/app", "案件一覧"],
  ["05-estimate-390.png", "/estimate", "見積を作る"],
  ["07-contractors-390.png", "/contractors", "業者管理"],
];

for (const [file, route, marker] of routes) {
  await page.goto(`${baseUrl}/#${route}`, { waitUntil: "domcontentloaded", timeout: 10_000 });
  await page.waitForTimeout(2_000);
  const bodyText = await page.locator("body").innerText();
  if (!bodyText.includes(marker)) {
    throw new Error(`${route} did not render ${marker}: ${bodyText.slice(0, 160)}`);
  }
  await page.screenshot({ path: path.join(root, "after", file), fullPage: true, animations: "disabled" });
  const overflow = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    document: document.documentElement.scrollWidth,
  }));
  if (overflow.document > overflow.viewport) {
    throw new Error(`${route} horizontal overflow: ${overflow.document}px > ${overflow.viewport}px`);
  }
  console.log(`${route}: ${overflow.document}px/${overflow.viewport}px, ${file}`);
}

await browser.close();
console.log("3 mobile screenshots captured without horizontal overflow");
