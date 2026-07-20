// bead laporta-beads-98b9w: 今日ダッシュボード「進行中案件」カードの母数検証
import { describe, expect, it } from "vitest";
import { countActiveProjects } from "../pages/TodayDashboardPage.js";
import type { Project, ProjectStatus } from "../domain/types.js";

const makeProject = (status: ProjectStatus): Project => ({
  id: crypto.randomUUID(),
  name: "案件",
  description: "",
  status,
  startDate: "2026-06-01",
  includeWeekends: false,
  createdAt: "2026-06-01T00:00:00Z",
  updatedAt: "2026-06-01T00:00:00Z",
});

describe("countActiveProjects (bead 98b9w: ラベル「進行中案件」との整合)", () => {
  it("active のみを数え、planning は含めない", () => {
    // 票の実データ構成: active2件(渋谷/ゴディバ) + planning2件(ニチイ/監査テスト)
    const projects = [
      makeProject("active"),
      makeProject("active"),
      makeProject("planning"),
      makeProject("planning"),
    ];
    expect(countActiveProjects(projects)).toBe(2);
  });

  it("completed / on_hold も含めない", () => {
    const projects = [
      makeProject("active"),
      makeProject("completed"),
      makeProject("on_hold"),
    ];
    expect(countActiveProjects(projects)).toBe(1);
  });

  it("空配列は 0", () => {
    expect(countActiveProjects([])).toBe(0);
  });
});
