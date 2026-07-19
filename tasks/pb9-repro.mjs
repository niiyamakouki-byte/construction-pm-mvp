/**
 * bead construction_pm_mvp-pb9; worker(claude); 2026-07-20
 * Verify: photo repository E2E bypass now avoids all supabase.co network
 * traffic during upload -> list, and measure the real tap count for the
 * photo-attach flow (previously unmeasurable per REBUILD-BLUEPRINT-20260720.md §2.2).
 */
import { chromium } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { captureScreenshot } from "./lib/screenshot-guard.mjs";

const port = process.argv[2] || "5173";
const outDir = process.argv[3] || "tasks/pb9-verify";
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

const browser = await chromium.launch();
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await installState(context);
  const page = await context.newPage();

  const supabaseRequests = [];
  page.on("request", (req) => {
    if (req.url().includes("supabase.co")) supabaseRequests.push({ url: req.url(), method: req.method() });
  });

  let taps = 0;
  const tap = async (locatorOrSelector, opts) => {
    const locator = typeof locatorOrSelector === "string" ? page.locator(locatorOrSelector) : locatorOrSelector;
    await locator.click(opts);
    taps++;
  };

  // ── Step 1: navigate to Today, select the daily-report project ──
  await page.goto(`${base}/today`, { waitUntil: "networkidle", timeout: 20_000 });
  await page.waitForSelector('[data-testid="mobile-bottom-nav"]', { state: "visible", timeout: 10_000 });

  // The photo uploader binds to `dailyReportProject`; confirm the project selector if present.
  const projectSelect = page.locator("select").filter({ hasText: "" }).first();
  const hasProjectSelector = await page.locator("#photo-file").count();
  if (hasProjectSelector === 0) {
    // no direct uploader visible yet — some flows require selecting a project card first
    const projectCard = page.locator(`text=渋谷オフィスビル内装工事`).first();
    if (await projectCard.count()) {
      await tap(projectCard);
    }
  }

  // ── Step 2: attach a real file via the native <input type=file> (not a tap — OS file picker in real use) ──
  const fileInput = page.locator("#photo-file");
  await fileInput.waitFor({ state: "attached", timeout: 10_000 });
  await fileInput.setInputFiles({
    name: "test-site.jpg",
    mimeType: "image/jpeg",
    buffer: Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0]), // minimal JPEG-ish bytes, size>0
  });
  await captureScreenshot(page, join(outDir, "today-photo-selected.png"), { testId: "mobile-bottom-nav" });

  // ── Step 3: tap save ──
  await tap(page.getByRole("button", { name: "この写真を保存" }));
  await page.waitForTimeout(800);
  await captureScreenshot(page, join(outDir, "today-photo-saved.png"), { testId: "mobile-bottom-nav" });

  const afterUploadUrl = page.url();

  // ── Step 4: navigate to /photos and confirm listing works without touching supabase ──
  await tap(page.locator('[data-testid="mobile-bottom-nav"] >> text=写真'));
  await page.waitForTimeout(600);
  await captureScreenshot(page, join(outDir, "photos-page.png"), { testId: "mobile-bottom-nav" });

  const photoState = await page.evaluate(() => {
    const raw = localStorage.getItem("genbahub:photos");
    const photos = raw ? JSON.parse(raw) : [];
    return {
      storedPhotoCount: photos.length,
      storedPhoto: photos[0] ?? null,
      cardVisibleInDom: document.querySelector('[data-testid="mobile-bottom-nav"]') !== null && document.body.innerText.includes("その他"),
    };
  });

  const result = {
    tapCount: taps,
    afterUploadUrl,
    photoState,
    supabaseRequestCount: supabaseRequests.length,
    supabaseRequests,
  };
  writeFileSync(join(outDir, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
  console.log(JSON.stringify(result, null, 2));
} finally {
  await browser.close();
}
