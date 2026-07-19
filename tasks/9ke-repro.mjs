/**
 * bead construction_pm_mvp-9ke; worker(claude); 2026-07-20
 * 500x844 headless Chromium repro/verify for the mobile submit-button vs
 * fixed bottom-nav overlap bug. E2E bypass (localStorage) — no Supabase.
 *
 * Checks all three AC:
 *  1. task-add form (ProjectDetailPage): open → fill → real-coordinate tap →
 *     task actually created (not the exact reported y=829-865 hijack to /photos)
 *  2. submit button boundingBox does not intersect [data-testid=mobile-bottom-nav]
 *  3. same check repeated for project-creation form (ProjectListPage) and the
 *     estimate line-item flow (EstimatePage), to confirm no equivalent overlap
 */
import { chromium } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { captureScreenshot } from "./lib/screenshot-guard.mjs";

const port = process.argv[2] || "5173";
const outDir = process.argv[3] || "tasks/9ke-verify";
const base = `http://localhost:${port}/#`;
const PROJECT_ID = "4b9e1234-5678-4abc-bdef-000000000001";

mkdirSync(outDir, { recursive: true });

async function installState(context) {
  await context.addInitScript(({ projectId }) => {
    window.__E2E_BYPASS_AUTH__ = true;
    localStorage.clear();
    localStorage.setItem("genbahub_onboarding_done", "1");
    const now = "2026-07-18T00:00:00.000Z";
    const projects = [
      { id: projectId, name: "渋谷オフィスビル内装工事", description: "", status: "active", mode: "normal", startDate: "2026-07-01", endDate: "2026-09-30", includeWeekends: false, createdAt: now, updatedAt: now },
    ];
    localStorage.setItem("genbahub:projects", JSON.stringify(projects));
    localStorage.setItem("genbahub:last-project-id", projectId);
  }, { projectId: PROJECT_ID });
}

async function measure(page, submitSelector, navSelector = '[data-testid="mobile-bottom-nav"]') {
  return page.evaluate(({ submitSelector, navSelector }) => {
    const submit = document.querySelector(submitSelector);
    const nav = document.querySelector(navSelector);
    if (!submit || !nav) return { submit: null, nav: null, intersects: null, missing: { submit: !submit, nav: !nav } };
    const sr = submit.getBoundingClientRect();
    const nr = nav.getBoundingClientRect();
    const ox = Math.max(0, Math.min(sr.right, nr.right) - Math.max(sr.left, nr.left));
    const oy = Math.max(0, Math.min(sr.bottom, nr.bottom) - Math.max(sr.top, nr.top));
    return {
      submit: { top: Math.round(sr.top), bottom: Math.round(sr.bottom), left: Math.round(sr.left), right: Math.round(sr.right) },
      nav: { top: Math.round(nr.top), bottom: Math.round(nr.bottom) },
      intersects: ox > 0 && oy > 0,
    };
  }, { submitSelector, navSelector });
}

async function realTap(page, selector) {
  const box = await page.locator(selector).boundingBox();
  if (!box) return { ok: false, reason: "no boundingBox" };
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  const hitTarget = await page.evaluate(([x, y]) => {
    const el = document.elementFromPoint(x, y);
    return { tag: el?.tagName, testid: el?.closest("[data-testid]")?.getAttribute("data-testid") || null, text: (el?.textContent || "").slice(0, 20) };
  }, [x, y]);
  const urlBefore = page.url();
  await page.mouse.click(x, y);
  await page.waitForTimeout(600);
  const urlAfter = page.url();
  return { ok: true, x: Math.round(x), y: Math.round(y), hitTarget, urlBefore, urlAfter, navigatedAway: urlBefore !== urlAfter };
}

const browser = await chromium.launch();
const results = {};
try {
  // ── 1&2: task-add form (ProjectDetailPage) ──
  {
    const context = await browser.newContext({ viewport: { width: 500, height: 844 } });
    await installState(context);
    const page = await context.newPage();
    await page.goto(`${base}/project/${PROJECT_ID}`, { waitUntil: "networkidle", timeout: 20_000 });
    await page.waitForTimeout(800);
    await page.click("text=タスク追加");
    await page.waitForTimeout(600);
    await page.fill('input[aria-label="タスク名"]', "テストタスク9ke検証");
    const layout = await measure(page, 'button[type="submit"]');
    await captureScreenshot(page, join(outDir, "task-form-filled.png"), { testId: "mobile-bottom-nav" });
    const tap = await realTap(page, 'button[type="submit"]');
    await page.waitForTimeout(500);
    const taskCreated = await page.evaluate(() => document.body.innerText.includes("テストタスク9ke検証"));
    await captureScreenshot(page, join(outDir, "task-form-after-tap.png"), { testId: "mobile-bottom-nav" });
    results.taskForm = { layout, tap, taskCreated };
    await context.close();
  }

  // ── 3a: project-creation form (ProjectListPage) ──
  {
    const context = await browser.newContext({ viewport: { width: 500, height: 844 } });
    await installState(context);
    const page = await context.newPage();
    await page.goto(`${base}/app`, { waitUntil: "networkidle", timeout: 20_000 });
    await page.waitForTimeout(800);
    await page.click("text=新規案件");
    await page.waitForTimeout(600);
    await page.fill('input[name="name"], input[id="name"], input[placeholder*="案件"]', "検証用テスト案件9ke").catch(async () => {
      // fallback: first text input in the form
      await page.locator("form input[type=text]").first().fill("検証用テスト案件9ke");
    });
    const layout = await measure(page, 'button[type="submit"]');
    await captureScreenshot(page, join(outDir, "project-create-form.png"), { testId: "mobile-bottom-nav" });
    results.projectCreateForm = { layout };
    await context.close();
  }

  // ── 3b: estimate flow (EstimatePage) — button-driven, not a <form>, per blueprint no known bug ──
  {
    const context = await browser.newContext({ viewport: { width: 500, height: 844 } });
    await installState(context);
    const page = await context.newPage();
    await page.goto(`${base}/estimate`, { waitUntil: "networkidle", timeout: 20_000 });
    await page.waitForTimeout(800);
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await page.waitForTimeout(300);
    const overlaps = await page.evaluate(() => {
      const nav = document.querySelector('[data-testid="mobile-bottom-nav"]');
      if (!nav) return { navPresent: false, overlaps: [] };
      const nr = nav.getBoundingClientRect();
      const overlaps = [];
      for (const el of document.querySelectorAll("button")) {
        if (nav.contains(el)) continue;
        const style = getComputedStyle(el);
        if (style.position === "fixed" || style.position === "sticky") continue;
        if (style.display === "none" || style.visibility === "hidden") continue;
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        const ox = Math.max(0, Math.min(r.right, nr.right) - Math.max(r.left, nr.left));
        const oy = Math.max(0, Math.min(r.bottom, nr.bottom) - Math.max(r.top, nr.top));
        if (ox > 0 && oy > 0) overlaps.push((el.textContent || "").slice(0, 20));
      }
      return { navPresent: true, overlaps };
    });
    await captureScreenshot(page, join(outDir, "estimate-page-scrolled.png"), { testId: "mobile-bottom-nav" });
    results.estimatePage = overlaps;
    await context.close();
  }

  writeFileSync(join(outDir, "result.json"), `${JSON.stringify(results, null, 2)}\n`);
  console.log(JSON.stringify(results, null, 2));
} finally {
  await browser.close();
}
