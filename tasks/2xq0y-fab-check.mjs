/**
 * bead 2xq0y; base 8104b67; created by Codex.
 * 49 application routes: scroll to the bottom and report FAB × visible text
 * intersections over 4px. Also samples five routes at 768px and 1280px.
 * Reuses the route set/result shape from /tmp/genbahub-audit and the
 * Playwright setup from tasks/yx44x-fab-check.mjs (commit 012877f).
 */
import { chromium } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const port = process.argv[2] || "5183";
const outDir = process.argv[3] || "tasks/2xq0y-verify";
const base = `http://127.0.0.1:${port}/#`;

const ROUTES = [
  "/app", "/today", "/tasks", "/schedule", "/cross-project-gantt",
  "/finishing", "/progress-review", "/safety", "/phase-templates", "/estimate",
  "/takeoff", "/invoice", "/cost-management", "/reports", "/freee", "/crm",
  "/contractors", "/help", "/account", "/notifications", "/weather", "/photos",
  "/procurement", "/orders", "/change-order", "/crew-optimizer", "/funnel",
  "/handover-package", "/inquiry-responder", "/insurance-assessment", "/invoices",
  "/local-seo", "/longterm-followup", "/margin-watch", "/meeting-runner",
  "/node-schedule", "/owner-ambassador", "/owner-suggestion", "/pricing",
  "/profit-ranking", "/proposal-generator", "/repeat-predictor", "/resource-analysis",
  "/sales-pipeline", "/share-tokens", "/site-livestream", "/login", "/signup", "/landing",
];

const RESPONSIVE_ROUTES = ["/app", "/schedule", "/weather", "/proposal-generator", "/site-livestream"];
const VIEWPORT_HEIGHT = 812;
const TEXT_SELECTOR = "h1,h2,h3,h4,h5,h6,p,span,label,button,a,li,td,th,dt,dd";

if (ROUTES.length !== 49) throw new Error(`Expected 49 routes, got ${ROUTES.length}`);
mkdirSync(outDir, { recursive: true });

function slug(route) {
  return route.slice(1).replaceAll("/", "-") || "root";
}

async function installState(context, mode) {
  await context.addInitScript(({ stateMode }) => {
    window.__E2E_BYPASS_AUTH__ = true;
    localStorage.clear();
    localStorage.setItem("genbahub_onboarding_done", "1");
    if (stateMode === "seeded") {
      const now = "2026-07-18T00:00:00.000Z";
      const projects = [
        { id: "4b9e1234-5678-4abc-bdef-000000000001", name: "渋谷オフィスビル内装工事", status: "active", startDate: "2026-07-01", endDate: "2026-09-30", createdAt: now, updatedAt: now },
        { id: "4b9e1234-5678-4abc-bdef-000000000002", name: "横浜倉庫改修工事", status: "active", startDate: "2026-07-10", endDate: "2026-10-15", createdAt: now, updatedAt: now },
      ];
      localStorage.setItem("genbahub:projects", JSON.stringify(projects));
      localStorage.setItem("genbahub:last-project-id", projects[0].id);
    } else {
      localStorage.setItem("genbahub:projects", JSON.stringify([]));
    }
  }, { stateMode: mode });
}

async function measureBottom(page) {
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await page.waitForTimeout(300);
  return page.evaluate((selector) => {
    const fab = document.querySelector('[data-testid="assistant-chat-fab"]');
    const main = document.querySelector("#main-content");
    const fabRect = fab?.getBoundingClientRect();
    const overlaps = [];
    if (fabRect) {
      for (const element of document.querySelectorAll(selector)) {
        if (element === fab || fab.contains(element) || element.contains(fab)) continue;
        const style = getComputedStyle(element);
        if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0) continue;
        if (style.position === "fixed" || style.position === "sticky") continue;
        const text = (element.textContent || "").trim();
        if (!text) continue;
        const rect = element.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0 || rect.bottom <= 0 || rect.top >= innerHeight) continue;
        const ox = Math.max(0, Math.min(fabRect.right, rect.right) - Math.max(fabRect.left, rect.left));
        const oy = Math.max(0, Math.min(fabRect.bottom, rect.bottom) - Math.max(fabRect.top, rect.top));
        if (ox > 4 && oy > 4) overlaps.push({ text: text.slice(0, 80), ox: Math.round(ox), oy: Math.round(oy) });
      }
    }
    return {
      viewport: { width: innerWidth, height: innerHeight },
      scrollY: Math.round(scrollY),
      scrollHeight: document.documentElement.scrollHeight,
      fab: fabRect ? { top: Math.round(fabRect.top), right: Math.round(fabRect.right), bottom: Math.round(fabRect.bottom), left: Math.round(fabRect.left), width: Math.round(fabRect.width), height: Math.round(fabRect.height) } : null,
      mainPaddingBottom: main ? getComputedStyle(main).paddingBottom : null,
      overlaps,
    };
  }, TEXT_SELECTOR);
}

async function auditMode(browser, mode) {
  const context = await browser.newContext({ viewport: { width: 375, height: VIEWPORT_HEIGHT } });
  await installState(context, mode);
  const page = await context.newPage();
  const results = [];
  for (const route of ROUTES) {
    const errors = [];
    const onPageError = (error) => errors.push(error.message);
    page.on("pageerror", onPageError);
    await page.goto(base + route, { waitUntil: "networkidle", timeout: 20_000 }).catch(() => {});
    await page.waitForTimeout(500);
    const bottom = await measureBottom(page);
    results.push({ route, bottom, errors });
    console.log(`[375/${mode}] ${route} positives=${bottom.overlaps.length} padding=${bottom.mainPaddingBottom}`);
    page.off("pageerror", onPageError);
  }
  await context.close();
  writeFileSync(join(outDir, `result-${mode}-375.json`), `${JSON.stringify(results, null, 2)}\n`);
  return results;
}

async function auditResponsive(browser) {
  const results = [];
  for (const width of [768, 1280]) {
    const context = await browser.newContext({ viewport: { width, height: VIEWPORT_HEIGHT } });
    await installState(context, "seeded");
    const page = await context.newPage();
    for (const route of RESPONSIVE_ROUTES) {
      await page.goto(base + route, { waitUntil: "networkidle", timeout: 20_000 }).catch(() => {});
      await page.waitForTimeout(500);
      const layout = await page.evaluate(() => {
        const main = document.querySelector("#main-content");
        const rect = main?.getBoundingClientRect();
        return {
          bodyOverflowX: Math.max(0, document.documentElement.scrollWidth - innerWidth),
          mainVisible: Boolean(rect && rect.width > 0 && rect.height > 0),
          mainLeft: rect ? Math.round(rect.left) : null,
          mainRight: rect ? Math.round(rect.right) : null,
          mainPaddingBottom: main ? getComputedStyle(main).paddingBottom : null,
          fabVisible: Boolean(document.querySelector('[data-testid="assistant-chat-fab"]')),
        };
      });
      results.push({ width, route, ...layout });
      await page.screenshot({ path: join(outDir, `responsive-${width}-${slug(route)}.png`) });
      console.log(`[responsive/${width}] ${route} overflow=${layout.bodyOverflowX} main=${layout.mainVisible} padding=${layout.mainPaddingBottom} fab=${layout.fabVisible}`);
    }
    await context.close();
  }
  writeFileSync(join(outDir, "result-responsive.json"), `${JSON.stringify(results, null, 2)}\n`);
  return results;
}

const browser = await chromium.launch();
try {
  const seeded = await auditMode(browser, "seeded");
  const empty = await auditMode(browser, "empty");
  const responsive = await auditResponsive(browser);
  const seededPositiveRoutes = seeded.filter((entry) => entry.bottom.overlaps.length > 0).length;
  const emptyPositiveRoutes = empty.filter((entry) => entry.bottom.overlaps.length > 0).length;
  const seededIntersections = seeded.reduce((sum, entry) => sum + entry.bottom.overlaps.length, 0);
  const emptyIntersections = empty.reduce((sum, entry) => sum + entry.bottom.overlaps.length, 0);
  const responsiveFailures = responsive.filter((entry) => entry.bodyOverflowX > 0 || !entry.mainVisible || entry.mainPaddingBottom !== "96px" || entry.fabVisible).length;
  const summary = { routesPerMode: ROUTES.length, seededPositiveRoutes, emptyPositiveRoutes, seededIntersections, emptyIntersections, responsiveSamples: responsive.length, responsiveFailures };
  writeFileSync(join(outDir, "summary.json"), `${JSON.stringify(summary, null, 2)}\n`);
  console.log(`SUMMARY ${JSON.stringify(summary)}`);
  if (seededIntersections || emptyIntersections || responsiveFailures) process.exitCode = 1;
} finally {
  await browser.close();
}
