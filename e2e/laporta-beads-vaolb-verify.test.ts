/**
 * E2E: 票laporta-beads-vaolb「工程表ファーストIA: ログイン後の初期画面を工程表へ」実機検証
 *
 * 変更前(実測): ルート "/" はログイン済み/E2Eバイパス時に navigate("/app") で
 * ProjectListPage(案件一覧)へ着地していた。
 * 変更後: navigate(ganttPath) で工程表(lastProjectIdがあれば /gantt/:id、
 * なければ /gantt。初回はサンプル案件bootstrap後に /gantt/:id)へ着地する。
 */
import { test, expect } from "@playwright/test";
import * as path from "path";
import * as url from "url";
import * as fs from "fs";
import { bypassAuthWithSeed } from "./helpers/e2e-bypass.js";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const screenshotsDir = path.join(__dirname, "screenshots", "laporta-beads-vaolb-verify");
if (!fs.existsSync(screenshotsDir)) {
  fs.mkdirSync(screenshotsDir, { recursive: true });
}

const PID = "44444444-4444-4444-4444-444444444444";

const SEED_PROJECTS = [
  {
    id: PID,
    name: "vaolb検証デモ案件",
    description: "工程表ファーストIA E2E検証用",
    status: "active",
    mode: "normal",
    startDate: "2026-07-01",
    endDate: "2026-09-30",
    includeWeekends: false,
    createdAt: "2026-07-01T00:00:00Z",
    updatedAt: "2026-07-01T00:00:00Z",
  },
];

test.describe("laporta-beads-vaolb: 工程表ファーストIA", () => {
  test("既存案件ありの状態でルート「/」を開くと、案件一覧を経由せず直接工程表へ着地する", async ({ page }) => {
    await bypassAuthWithSeed(page, {
      "genbahub:projects": SEED_PROJECTS,
      "genbahub:tasks": [],
      "genbahub:contractors": [],
      "genbahub:last-project-id": PID,
      "genbahub_onboarding_done": "1",
    });

    await page.goto("/");
    await page.waitForURL(new RegExp(`#/gantt/${PID}`), { timeout: 15000 });

    // 案件一覧(ProjectListPage)の見出しを経由していないこと、工程表本体が見えていること
    await expect(page.getByRole("heading", { name: "vaolb検証デモ案件" })).toBeVisible({ timeout: 10000 });

    await page.screenshot({ path: path.join(screenshotsDir, "01-login-lands-on-gantt.png") });
  });

  test("案件が0件の新規ユーザーがルート「/」を開くと、サンプル案件bootstrap後に工程表へ着地する", async ({ page }) => {
    await bypassAuthWithSeed(page, {});

    await page.goto("/");
    await page.waitForURL(/#\/gantt\//, { timeout: 15000 });

    await expect(page.locator("body")).not.toContainText("案件がありません");

    await page.screenshot({ path: path.join(screenshotsDir, "02-fresh-user-lands-on-gantt.png") });
  });
});
