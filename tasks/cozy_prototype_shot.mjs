/* global process, window, localStorage */
import { chromium } from "@playwright/test";
import fs from "node:fs/promises";
import path from "node:path";

const baseUrl = process.env.GENBAHUB_AUDIT_BASE_URL || "http://127.0.0.1:5173";
const label = process.argv[2] ?? "before";
const outDir = path.resolve("tasks/cozy_prototype_2026-06-11");

const shots = [
  { route: "/today", name: "today" },
  { route: "/gantt", name: "gantt" },
];

const viewports = [
  { label: "desktop", width: 1280, height: 900 },
  { label: "mobile", width: 390, height: 844, isMobile: true },
];

await fs.mkdir(outDir, { recursive: true });
const browser = await chromium.launch({ headless: true });

for (const vp of viewports) {
  const context = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    isMobile: vp.isMobile ?? false,
  });
  await context.addInitScript(() => {
    window.__E2E_BYPASS_AUTH__ = true;
    localStorage.setItem("genbahub_onboarding_done", "1");
    localStorage.setItem("genbahub_tour_done", "1");
  });
  const page = await context.newPage();

  for (const shot of shots) {
    await page.goto(`${baseUrl}/#${shot.route}`, { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForTimeout(1200);
    const file = path.join(outDir, `${label}-${shot.name}-${vp.label}.png`);
    await page.screenshot({ path: file, fullPage: true });
    console.log(`saved: ${file}`);
  }

  await context.close();
}

await browser.close();
