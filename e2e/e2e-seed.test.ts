import { expect, test } from "@playwright/test";

test("/#/e2e-seed creates the complete deterministic demo state in one visit", async ({ page }) => {
  await page.goto("/#/e2e-seed");
  await page.waitForURL(/#\/today$/);

  const seeded = await page.evaluate(() => ({
    projects: JSON.parse(localStorage.getItem("genbahub:projects") ?? "[]").length,
    tasks: JSON.parse(localStorage.getItem("genbahub:tasks") ?? "[]").length,
    photos: JSON.parse(localStorage.getItem("genbahub:e2e-photos") ?? "[]").length,
    estimates: JSON.parse(localStorage.getItem("genbahub:e2e-estimates") ?? "[]").length,
    estimateItems: JSON.parse(localStorage.getItem("takeoff_estimate_inject") ?? "[]").length,
    projectId: localStorage.getItem("genbahub:last-project-id"),
  }));

  expect(seeded).toEqual({
    projects: 1,
    tasks: 4,
    photos: 2,
    estimates: 1,
    estimateItems: 3,
    projectId: "e2e00000-0000-4000-8000-000000000001",
  });
  await expect(page.getByText("E2Eデモ：青山オフィス改装", { exact: false }).first()).toBeVisible();

  await page.goto("/#/photos");
  await expect(page.getByText("着工前の室内全景")).toBeVisible();
  await expect(page.getByText("軽量下地の施工状況")).toBeVisible();

  await page.goto(`/#/estimate?projectId=${seeded.projectId}`);
  await page.getByRole("button", { name: /手動で作成/ }).click();
  await expect(page.getByText("図面の拾い出し数量を品目に追加しました。単価を入力して見積を作成してください。")).toBeVisible();
});
