// 来歴: laporta-beads-4wos3 / worker(opus) / 2026-07-19
import { describe, expect, it } from "vitest";
import { checkSource } from "./screenshotGate.js";

describe("screenshotGate.checkSource", () => {
  it("passes a script that uses the captureScreenshot() helper only", () => {
    const src = `
      await page.goto("/#/today");
      await captureScreenshot(page, "out.png", { testId: "today-page" });
    `;
    expect(checkSource(src)).toEqual([]);
  });

  it("passes a raw script with visible-wait + loading-dismissed wait before screenshot", () => {
    const src = `
      await page.goto("/#/today");
      await page.waitForSelector('[data-testid="today-page"]', { state: "visible" });
      await page.waitForSelector('[data-testid="loading"]', { state: "detached" });
      await page.screenshot({ path: "out.png" });
    `;
    expect(checkSource(src)).toEqual([]);
  });

  it("flags a script that only uses waitForTimeout before screenshot", () => {
    const src = `
      await page.goto("/#/today");
      await page.waitForTimeout(2500);
      await page.screenshot({ path: "out.png" });
    `;
    const violations = checkSource(src);
    expect(violations).toHaveLength(1);
    expect(violations[0].line).toBe(4);
    expect(violations[0].reason).toMatch(/waitFor/);
  });

  it("flags a script with no wait at all before screenshot", () => {
    const src = `
      await page.goto("/#/today");
      await page.screenshot({ path: "out.png" });
    `;
    expect(checkSource(src)).toHaveLength(1);
  });

  it("flags only the non-compliant goto block among several", () => {
    const src = `
      await page.goto("/#/today");
      await page.waitForSelector('[data-testid="today-page"]', { state: "visible" });
      await page.waitForSelector('[data-testid="loading"]', { state: "detached" });
      await page.screenshot({ path: "today.png" });

      await page.goto("/#/estimate");
      await page.waitForTimeout(500);
      await page.screenshot({ path: "estimate.png" });
    `;
    const violations = checkSource(src);
    expect(violations).toHaveLength(1);
    expect(violations[0].line).toBe(9);
  });

  it("checks a screenshot-less-of-goto script as a single block when there is no goto", () => {
    const compliant = `
      await page.waitForSelector('[data-testid="modal"]', { state: "visible" });
      await page.waitForSelector('[data-testid="loading"]', { state: "hidden" });
      await page.screenshot({ path: "modal.png" });
    `;
    expect(checkSource(compliant)).toEqual([]);

    const nonCompliant = `
      await page.click('[data-testid="open-modal"]');
      await page.screenshot({ path: "modal.png" });
    `;
    expect(checkSource(nonCompliant)).toHaveLength(1);
  });

  it("does not accept a visible-wait on a non-loading selector as satisfying the loading check", () => {
    const src = `
      await page.goto("/#/today");
      await page.waitForSelector('[data-testid="today-page"]', { state: "visible" });
      await page.screenshot({ path: "out.png" });
    `;
    expect(checkSource(src)).toHaveLength(1);
  });
});
