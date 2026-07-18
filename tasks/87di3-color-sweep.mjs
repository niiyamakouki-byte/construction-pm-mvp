/**
 * All-route screenshot sweep for GenbaHub bead 87di3.
 * Base commit: 7d89cb5. Author: Codex.
 */
import { chromium } from "../node_modules/@playwright/test/index.mjs";
import { mkdirSync, writeFileSync } from "node:fs";

const OUT = "tasks/87di3-verify/after/all-pages";
const ROUTES = ["/app","/today","/tasks","/schedule","/cross-project-gantt","/finishing","/progress-review","/safety","/phase-templates","/estimate","/takeoff","/invoice","/cost-management","/reports","/freee","/crm","/contractors","/help","/account","/notifications","/weather","/photos","/procurement","/orders","/change-order","/crew-optimizer","/funnel","/handover-package","/inquiry-responder","/insurance-assessment","/invoices","/local-seo","/longterm-followup","/margin-watch","/meeting-runner","/node-schedule","/owner-ambassador","/owner-suggestion","/pricing","/profit-ranking","/proposal-generator","/repeat-predictor","/resource-analysis","/sales-pipeline","/share-tokens","/site-livestream","/login","/signup","/landing","/"];

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 375, height: 812 } });
await context.addInitScript(() => {
  window.__E2E_BYPASS_AUTH__ = true;
  const now = "2026-07-18T00:00:00.000Z";
  localStorage.setItem("genbahub_onboarding_done", "1");
  localStorage.setItem("genbahub_tour_done", "1");
  localStorage.setItem("genbahub:last-project-id", "audit-p1");
  localStorage.setItem("genbahub:projects", JSON.stringify([{ id: "audit-p1", name: "渋谷オフィスビル内装工事", address: "東京都渋谷区", status: "active", mode: "normal", startDate: "2026-07-18", includeWeekends: false, createdAt: now, updatedAt: now }]));
});

const page = await context.newPage();
const results = [];
for (const route of ROUTES) {
  const errors = [];
  const onConsole = (message) => { if (message.type() === "error") errors.push(message.text()); };
  page.on("console", onConsole);
  await page.goto(`http://localhost:5173/#${route}`, { waitUntil: "networkidle", timeout: 15000 });
  await page.waitForTimeout(900);
  const name = route === "/" ? "root" : route.slice(1).replaceAll("/", "_");
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true, animations: "disabled" });
  const legacyGreenNodes = await page.locator('[class*="emerald-"], [class*="green-"]').count();
  results.push({ route, legacyGreenNodes, errors: [...new Set(errors)] });
  page.off("console", onConsole);
  console.log(`${route} legacy-green=${legacyGreenNodes} console-errors=${errors.length}`);
}

writeFileSync("tasks/87di3-verify/after/all-pages-result.json", JSON.stringify(results, null, 2));
await browser.close();

if (results.some((result) => result.legacyGreenNodes > 0)) process.exitCode = 1;
console.log(`87di3 color sweep: ${results.length} routes, legacy green nodes ${results.reduce((sum, result) => sum + result.legacyGreenNodes, 0)}`);
