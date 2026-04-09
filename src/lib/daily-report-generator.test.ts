import { describe, expect, it } from "vitest";
import type { Contractor, Project, Task } from "../domain/types.js";
import {
  gatherReportData,
  generateDailyReport,
  toDailyReportEntity,
} from "./daily-report-generator.js";

function makeProject(overrides?: Partial<Project>): Project {
  return {
    id: "proj-1",
    name: "南青山リノベ",
    description: "内装工事",
    status: "active",
    startDate: "2025-01-01",
    includeWeekends: false,
    createdAt: "2025-01-01T00:00:00.000Z",
    updatedAt: "2025-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function makeTask(overrides: Partial<Task> & Pick<Task, "id" | "name">): Task {
  return {
    projectId: "proj-1",
    description: "",
    status: "todo",
    progress: 0,
    dependencies: [],
    createdAt: "2025-01-01T00:00:00.000Z",
    updatedAt: "2025-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function makeContractor(overrides: Partial<Contractor> & Pick<Contractor, "id" | "name">): Contractor {
  return {
    createdAt: "2025-01-01T00:00:00.000Z",
    updatedAt: "2025-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("daily-report-generator", () => {
  const project = makeProject();
  const contractors = [
    makeContractor({ id: "c1", name: "電気工事 田中" }),
    makeContractor({ id: "c2", name: "配管工事 鈴木" }),
  ];

  describe("gatherReportData", () => {
    it("gathers active tasks and workers for the date", () => {
      const tasks = [
        makeTask({
          id: "t1",
          name: "配線工事",
          contractorId: "c1",
          startDate: "2025-01-05",
          dueDate: "2025-01-10",
          status: "in_progress",
          progress: 40,
        }),
        makeTask({
          id: "t2",
          name: "配管工事",
          contractorId: "c2",
          startDate: "2025-01-12",
          dueDate: "2025-01-15",
          status: "todo",
          progress: 0,
        }),
      ];

      const data = gatherReportData({
        project,
        date: "2025-01-07",
        weather: "晴れ",
        tasks,
        contractors,
      });

      expect(data.projectName).toBe("南青山リノベ");
      expect(data.weather).toBe("晴れ");
      expect(data.workersPresent).toEqual(["電気工事 田中"]);
      expect(data.workCompleted).toHaveLength(1);
      expect(data.workCompleted[0].taskName).toBe("配線工事");
    });

    it("defaults weather to 未記入", () => {
      const data = gatherReportData({
        project,
        date: "2025-01-07",
        tasks: [],
        contractors: [],
      });

      expect(data.weather).toBe("未記入");
    });

    it("includes materials from tasks and input", () => {
      const tasks = [
        makeTask({
          id: "t1",
          name: "塗装",
          startDate: "2025-01-05",
          dueDate: "2025-01-10",
          materials: ["塗料", "養生テープ"],
        }),
      ];

      const data = gatherReportData({
        project,
        date: "2025-01-07",
        tasks,
        contractors: [],
        materialsUsed: ["ローラー"],
      });

      expect(data.materialsUsed).toContain("塗料");
      expect(data.materialsUsed).toContain("養生テープ");
      expect(data.materialsUsed).toContain("ローラー");
    });
  });

  describe("generateDailyReport", () => {
    it("returns valid HTML with all sections", () => {
      const tasks = [
        makeTask({
          id: "t1",
          name: "内装解体",
          contractorId: "c1",
          startDate: "2025-01-05",
          dueDate: "2025-01-10",
          status: "in_progress",
          progress: 60,
        }),
      ];

      const html = generateDailyReport({
        project,
        date: "2025-01-07",
        weather: "曇り",
        tasks,
        contractors,
        issues: ["騒音クレーム対応"],
        photoUrls: ["https://example.com/photo1.jpg"],
        notes: "午後から雨予報",
      });

      expect(html).toContain("<!DOCTYPE html>");
      expect(html).toContain("作業日報");
      expect(html).toContain("南青山リノベ");
      expect(html).toContain("2025-01-07");
      expect(html).toContain("曇り");
      expect(html).toContain("電気工事 田中");
      expect(html).toContain("内装解体");
      expect(html).toContain("60%");
      expect(html).toContain("騒音クレーム対応");
      expect(html).toContain("https://example.com/photo1.jpg");
      expect(html).toContain("午後から雨予報");
    });

    it("handles empty tasks gracefully", () => {
      const html = generateDailyReport({
        project,
        date: "2025-01-07",
        tasks: [],
        contractors: [],
      });

      expect(html).toContain("作業日報");
      expect(html).toContain("なし");
    });

    it("escapes HTML in project name", () => {
      const xssProject = makeProject({ name: '<script>alert("xss")</script>' });
      const html = generateDailyReport({
        project: xssProject,
        date: "2025-01-07",
        tasks: [],
        contractors: [],
      });

      expect(html).not.toContain("<script>");
      expect(html).toContain("&lt;script&gt;");
    });
  });

  describe("toDailyReportEntity", () => {
    it("creates a DailyReport domain object", () => {
      const data = gatherReportData({
        project,
        date: "2025-01-07",
        weather: "晴れ",
        tasks: [],
        contractors: [],
      });

      const entity = toDailyReportEntity(data, "proj-1", "user-1");

      expect(entity.id).toBe("report-proj-1-2025-01-07");
      expect(entity.projectId).toBe("proj-1");
      expect(entity.reportDate).toBe("2025-01-07");
      expect(entity.weather).toBe("晴れ");
      expect(entity.authorId).toBe("user-1");
      expect(entity.content).toContain("作業員:");
    });

    it("works without authorId", () => {
      const data = gatherReportData({
        project,
        date: "2025-01-07",
        tasks: [],
        contractors: [],
      });
      const entity = toDailyReportEntity(data, "proj-1");
      expect(entity.authorId).toBeUndefined();
      expect(entity.id).toBe("report-proj-1-2025-01-07");
    });

    it("includes task progress in content", () => {
      const tasks = [
        makeTask({
          id: "t1",
          name: "塗装",
          startDate: "2025-01-05",
          dueDate: "2025-01-10",
          status: "in_progress",
          progress: 75,
        }),
      ];
      const data = gatherReportData({
        project,
        date: "2025-01-07",
        tasks,
        contractors: [],
      });
      const entity = toDailyReportEntity(data, "proj-1");
      expect(entity.content).toContain("塗装(75%)");
    });

    it("includes notes in content", () => {
      const data = gatherReportData({
        project,
        date: "2025-01-07",
        tasks: [],
        contractors: [],
        notes: "特記事項あり",
      });
      const entity = toDailyReportEntity(data, "proj-1");
      expect(entity.content).toContain("備考: 特記事項あり");
    });

    it("has valid createdAt and updatedAt timestamps", () => {
      const data = gatherReportData({
        project,
        date: "2025-01-07",
        tasks: [],
        contractors: [],
      });
      const before = new Date().toISOString();
      const entity = toDailyReportEntity(data, "proj-1");
      const after = new Date().toISOString();
      expect(entity.createdAt >= before).toBe(true);
      expect(entity.createdAt <= after).toBe(true);
      expect(entity.updatedAt).toBe(entity.createdAt);
    });

    it("photoUrls are passed through", () => {
      const data = gatherReportData({
        project,
        date: "2025-01-07",
        tasks: [],
        contractors: [],
        photoUrls: ["https://example.com/a.jpg", "https://example.com/b.jpg"],
      });
      const entity = toDailyReportEntity(data, "proj-1");
      expect(entity.photoUrls).toEqual(["https://example.com/a.jpg", "https://example.com/b.jpg"]);
    });
  });

  describe("gatherReportData edge cases", () => {
    it("deduplicates materials", () => {
      const tasks = [
        makeTask({
          id: "t1",
          name: "作業A",
          startDate: "2025-01-05",
          dueDate: "2025-01-10",
          materials: ["セメント", "砂"],
        }),
      ];
      const data = gatherReportData({
        project,
        date: "2025-01-07",
        tasks,
        contractors: [],
        materialsUsed: ["セメント", "水"],
      });
      // "セメント" appears in both but should be deduplicated
      const cementCount = data.materialsUsed.filter((m) => m === "セメント").length;
      expect(cementCount).toBe(1);
      expect(data.materialsUsed).toContain("砂");
      expect(data.materialsUsed).toContain("水");
    });

    it("includes in_progress tasks without startDate", () => {
      const tasks = [
        makeTask({
          id: "t1",
          name: "進行中作業",
          startDate: undefined,
          dueDate: undefined,
          status: "in_progress",
          progress: 50,
        }),
      ];
      const data = gatherReportData({
        project,
        date: "2025-01-07",
        tasks,
        contractors: [],
      });
      expect(data.workCompleted).toHaveLength(1);
      expect(data.workCompleted[0].taskName).toBe("進行中作業");
    });

    it.skip("sorts workers alphabetically", () => {
      const tasks = [
        makeTask({ id: "t1", name: "A", contractorId: "c2", startDate: "2025-01-05", dueDate: "2025-01-10" }),
        makeTask({ id: "t2", name: "B", contractorId: "c1", startDate: "2025-01-05", dueDate: "2025-01-10" }),
      ];
      const data = gatherReportData({
        project,
        date: "2025-01-07",
        tasks,
        contractors,
      });
      // Workers are sorted by JS string comparison
      const sorted = [...data.workersPresent].sort();
      expect(data.workersPresent).toEqual(sorted);
      expect(data.workersPresent).toHaveLength(2);
    });

    it("handles issues array passed through", () => {
      const data = gatherReportData({
        project,
        date: "2025-01-07",
        tasks: [],
        contractors: [],
        issues: ["雨天中断", "資材遅延"],
      });
      expect(data.issues).toEqual(["雨天中断", "資材遅延"]);
    });

    it("handles task with no contractorId", () => {
      const tasks = [
        makeTask({ id: "t1", name: "自社作業", startDate: "2025-01-05", dueDate: "2025-01-10" }),
      ];
      const data = gatherReportData({
        project,
        date: "2025-01-07",
        tasks,
        contractors,
      });
      expect(data.workersPresent).toHaveLength(0);
      expect(data.workCompleted).toHaveLength(1);
    });
  });

  describe("generateDailyReport edge cases", () => {
    it("includes photo images in HTML", () => {
      const html = generateDailyReport({
        project,
        date: "2025-01-07",
        tasks: [],
        contractors: [],
        photoUrls: ["https://example.com/img.jpg"],
      });
      expect(html).toContain('<img src="https://example.com/img.jpg"');
      expect(html).toContain("現場写真");
    });

    it("shows 写真なし when no photos", () => {
      const html = generateDailyReport({
        project,
        date: "2025-01-07",
        tasks: [],
        contractors: [],
      });
      expect(html).toContain("写真なし");
    });

    it("omits 備考 section when no notes", () => {
      const html = generateDailyReport({
        project,
        date: "2025-01-07",
        tasks: [],
        contractors: [],
      });
      expect(html).not.toContain("備考");
    });

    it("escapes HTML in issue text", () => {
      const html = generateDailyReport({
        project,
        date: "2025-01-07",
        tasks: [],
        contractors: [],
        issues: ['<img onerror="alert(1)">'],
      });
      expect(html).not.toContain('onerror="alert(1)"');
      expect(html).toContain("&lt;img");
    });

    it("includes print media query", () => {
      const html = generateDailyReport({
        project,
        date: "2025-01-07",
        tasks: [],
        contractors: [],
      });
      expect(html).toContain("@media print");
    });
  });
});
