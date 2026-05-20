/* @vitest-environment node */

import { describe, expect, it } from "vitest";
import { createEstimate, parseEstimateNl } from "./estimate-tools.js";
import { classifyPhoto, listPhotos, savePhotoForMcp, tagPhoto } from "./photo-tools.js";
import { createDailyReport, generateDailyReport } from "./report-tools.js";
import { importSchedule } from "./schedule-tools.js";
import { generateArticle, recommendKeywords } from "./meo-tools.js";
import {
  computeEstimateTotal,
  saveCostMasterItemForMcp,
  searchCostMaster,
} from "./cost-tools.js";
import type { TaskRow } from "./supabase-tools.js";

describe("MCP wrapper tools", () => {
  it("creates and parses estimates", async () => {
    const estimate = await createEstimate({
      project_id: "project-1",
      items: [{ name: "クロス貼り", quantity: 10, unit: "㎡", unit_price: 1200 }],
      notes: "現調前",
    });

    expect(estimate.projectId).toBe("project-1");
    expect(estimate.totalAmount).toBe(12000);
    expect(parseEstimateNl("LDK 20㎡ クロス張替 標準").items[0].itemName).toContain("クロス");
  });

  it("classifies, lists, and tags photos", async () => {
    const now = new Date().toISOString();
    await savePhotoForMcp({
      id: "photo-1",
      projectId: "project-1",
      fileName: "flooring施工.jpg",
      category: "",
      url: "https://example.com/flooring.jpg",
      createdAt: now,
      updatedAt: now,
    });

    const classified = await classifyPhoto({ photo_id: "photo-1" });
    const tagged = await tagPhoto({ photo_id: "photo-1", tags: ["床", "進捗"] });
    const photos = await listPhotos({ tag: "床" });

    expect(classified.category).toBe("フローリング");
    expect(tagged.tags).toEqual(["床", "進捗"]);
    expect(photos).toHaveLength(1);
  });

  it("creates and generates daily reports", async () => {
    const report = await createDailyReport({
      project_id: "project-1",
      date: "2026-05-20",
      body: "床工事を実施",
      attendees: ["佐藤"],
    });
    const generated = await generateDailyReport({ project_id: "project-1", date: "2026-05-20" });

    expect(report.id).toBe("daily-report-project-1-2026-05-20");
    expect(generated.html).toContain("作業日報");
  });

  it("imports schedule items through injected task service", async () => {
    const created: TaskRow[] = [];
    const tools = {
      createTask: async (input: Partial<TaskRow>): Promise<TaskRow> => {
        const task: TaskRow = {
          id: `task-${created.length + 1}`,
          project_id: input.project_id ?? "",
          name: input.name ?? "",
          description: input.description ?? "",
          status: "todo",
          progress: input.progress ?? 0,
          cost: input.cost ?? 0,
          created_at: "2026-05-20T00:00:00.000Z",
          updated_at: "2026-05-20T00:00:00.000Z",
        };
        created.push(task);
        return task;
      },
    };

    const tasks = await importSchedule(
      {
        project_id: "project-1",
        buffer: JSON.stringify([{ name: "解体", progress: 10 }]),
      },
      tools,
    );

    expect(tasks[0].name).toBe("解体");
    expect(created).toHaveLength(1);
  });

  it("runs MEO keyword and article workflow", async () => {
    const keywords = await recommendKeywords("project-meo");
    const article = await generateArticle({
      project_id: "project-meo",
      primary_keyword: keywords[0].keyword,
    });

    expect(keywords.length).toBeGreaterThan(0);
    expect(article?.projectId).toBe("project-meo");
  });

  it("searches cost master and computes estimate totals", async () => {
    const now = new Date().toISOString();
    await saveCostMasterItemForMcp({
      id: "cost-1",
      code: "C-001",
      name: "クロス貼り",
      unit: "㎡",
      unitPrice: 1200,
      category: "内装",
      createdAt: now,
      updatedAt: now,
    });

    const matches = await searchCostMaster("クロス");
    const total = computeEstimateTotal([{ quantity: 10, unit_price: 1200 }]);

    expect(matches[0].id).toBe("cost-1");
    expect(total).toEqual({ subtotal: 12000, tax: 1200, total: 13200 });
  });
});
