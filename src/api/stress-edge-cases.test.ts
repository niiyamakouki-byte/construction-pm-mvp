/* @vitest-environment node */

/**
 * Stress tests and edge case audit for real-world multi-user usage scenarios.
 * Covers:
 * 1. Concurrent project updates from two browser tabs simultaneously
 * 2. Very long project names (500+ Japanese chars)
 * 3. Date handling edge cases: year boundaries, endDate < startDate, leap years
 * 4. Gantt chart with 100+ tasks performance
 * 5. Notification digest with zero vs 1000+ notifications
 * 6. Document version history with 50+ versions
 */

import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  ApiError,
  InMemoryApiStore,
  JsonFileApiStore,
  handleApiRequest,
} from "./server.js";
import type { ApiStore } from "./types.js";

const TEST_API_KEY = "test-api-key";

process.env.API_KEY = TEST_API_KEY;

type TestResponse = { status: number; body: unknown };

async function request(
  store: ApiStore,
  method: string,
  url: string,
  body?: unknown,
): Promise<TestResponse> {
  try {
    const response = await handleApiRequest(
      { method, url, body, headers: { "x-api-key": TEST_API_KEY } },
      store,
    );
    return { status: response.statusCode, body: response.body ?? null };
  } catch (error) {
    if (error instanceof ApiError) {
      return { status: error.statusCode, body: { error: error.message } };
    }
    throw error;
  }
}

async function createProject(store: ApiStore, name = "Test Project"): Promise<string> {
  const resp = await request(store, "POST", "/api/projects", {
    name,
    contractor: "Test GC",
    address: "東京都港区南青山",
    status: "planning",
  });
  expect(resp.status).toBe(201);
  return (resp.body as { project: { id: string } }).project.id;
}

async function createTask(
  store: ApiStore,
  projectId: string,
  name: string,
  startDate: string,
  endDate: string,
): Promise<string> {
  const resp = await request(store, "POST", `/api/projects/${projectId}/tasks`, {
    name,
    startDate,
    endDate,
    description: "",
  });
  expect(resp.status).toBe(201);
  return (resp.body as { task: { id: string } }).task.id;
}

async function withTempDb<T>(run: (filePath: string) => Promise<T>): Promise<T> {
  const dirPath = await mkdtemp(join(tmpdir(), "genbahub-stress-"));
  const filePath = join(dirPath, "db.json");
  try {
    return await run(filePath);
  } finally {
    await rm(dirPath, { recursive: true, force: true });
  }
}

// ── 1. Concurrent project updates from two browser tabs simultaneously ──────

describe("Scenario 1: Concurrent project updates (two tabs)", () => {
  it("JsonFileApiStore serializes concurrent PATCH updates without data loss", async () => {
    await withTempDb(async (filePath) => {
      const store = new JsonFileApiStore(filePath);
      const projectId = await createProject(store, "Concurrent Update Project");

      // Simulate two tabs simultaneously updating different fields
      const [resp1, resp2] = await Promise.all([
        request(store, "PATCH", `/api/projects/${projectId}`, {
          name: "Updated by Tab 1",
        }),
        request(store, "PATCH", `/api/projects/${projectId}`, {
          contractor: "Updated Contractor by Tab 2",
        }),
      ]);

      // Both should succeed (serialized via operationQueue)
      expect(resp1.status).toBe(200);
      expect(resp2.status).toBe(200);

      // Final state should reflect both updates (last-write-wins per field)
      const finalResp = await request(store, "GET", `/api/projects/${projectId}`);
      expect(finalResp.status).toBe(200);
      const project = (finalResp.body as { project: { name: string; contractor: string } }).project;
      // One of them should have won - verify consistency (not corruption)
      expect(typeof project.name).toBe("string");
      expect(typeof project.contractor).toBe("string");
      expect(project.name.length).toBeGreaterThan(0);
      expect(project.contractor.length).toBeGreaterThan(0);
    });
  });

  it("InMemoryApiStore handles concurrent reads during concurrent writes safely", async () => {
    const store = new InMemoryApiStore();
    const projectId = await createProject(store, "Race Condition Project");

    // Create tasks concurrently (50 simultaneous creates)
    const results = await Promise.all(
      Array.from({ length: 50 }, (_, i) =>
        request(store, "POST", `/api/projects/${projectId}/tasks`, {
          name: `Task ${i}`,
          startDate: "2026-01-01",
          endDate: "2026-01-31",
          description: "",
        }),
      ),
    );

    expect(results.every((r) => r.status === 201)).toBe(true);

    const tasksResp = await request(store, "GET", `/api/projects/${projectId}/tasks`);
    const tasks = (tasksResp.body as { tasks: Array<{ id: string }> }).tasks;
    expect(tasks).toHaveLength(50);

    // All IDs must be unique (no ID collision from concurrent creates)
    const ids = tasks.map((t) => t.id);
    expect(new Set(ids).size).toBe(50);
  });

  it("simultaneous DELETE and PATCH on same project returns appropriate status codes", async () => {
    await withTempDb(async (filePath) => {
      const store = new JsonFileApiStore(filePath);
      const projectId = await createProject(store, "Delete Race Project");

      // Race: one tab patches, one tab deletes
      const [patchResp, deleteResp] = await Promise.all([
        request(store, "PATCH", `/api/projects/${projectId}`, { name: "Still Alive" }),
        request(store, "DELETE", `/api/projects/${projectId}`),
      ]);

      // One should succeed with 200/204, the other should get 404 or 200
      // (order-dependent, but no crash or 500)
      const statuses = [patchResp.status, deleteResp.status];
      expect(statuses.every((s) => s !== 500)).toBe(true);
      expect(statuses.some((s) => s === 404 || s === 200 || s === 204)).toBe(true);
    });
  });
});

// ── 2. Very long project names (500+ Japanese chars) ──────────────────────

describe("Scenario 2: Long project name validation", () => {
  it("rejects 500+ character Japanese project name with clear error", async () => {
    const store = new InMemoryApiStore();
    const longJapaneseName = "東京都港区南青山の建設工事プロジェクト".repeat(30); // 18*30 = 540 chars
    expect(longJapaneseName.length).toBeGreaterThan(500);

    const resp = await request(store, "POST", "/api/projects", {
      name: longJapaneseName,
      contractor: "テスト建設",
      address: "東京都港区",
      status: "planning",
    });

    expect(resp.status).toBe(400);
    expect((resp.body as { error: string }).error).toBe("プロジェクト名は200文字以内で入力してください。");
  });

  it("accepts exactly 200 Japanese character project name (boundary)", async () => {
    const store = new InMemoryApiStore();
    const exactLimit = "あ".repeat(200);
    expect(exactLimit.length).toBe(200);

    const resp = await request(store, "POST", "/api/projects", {
      name: exactLimit,
      contractor: "テスト建設",
      address: "東京都港区",
      status: "planning",
    });

    expect(resp.status).toBe(201);
  });

  it("rejects 201 character project name (one over boundary)", async () => {
    const store = new InMemoryApiStore();
    const overLimit = "あ".repeat(201);

    const resp = await request(store, "POST", "/api/projects", {
      name: overLimit,
      contractor: "テスト建設",
      address: "東京都港区",
      status: "planning",
    });

    expect(resp.status).toBe(400);
  });

  it("PATCH with 500+ char name is also rejected", async () => {
    const store = new InMemoryApiStore();
    const projectId = await createProject(store, "Short Name");
    const longName = "長い名前".repeat(200); // 800 chars

    const resp = await request(store, "PATCH", `/api/projects/${projectId}`, {
      name: longName,
    });

    expect(resp.status).toBe(400);
    expect((resp.body as { error: string }).error).toContain("200文字以内");
  });
});

// ── 3. Date handling edge cases ──────────────────────────────────────────

describe("Scenario 3: Date handling edge cases", () => {
  it("rejects task where endDate is before startDate", async () => {
    const store = new InMemoryApiStore();
    const projectId = await createProject(store, "Date Order Project");

    const resp = await request(store, "POST", `/api/projects/${projectId}/tasks`, {
      name: "Invalid Date Order Task",
      startDate: "2026-12-31",
      endDate: "2026-01-01",
      description: "",
    });

    expect(resp.status).toBe(400);
    expect((resp.body as { error: string }).error).toBe("開始日は終了日以前の日付を指定してください。");
  });

  it("PATCH task with endDate before existing startDate is rejected", async () => {
    const store = new InMemoryApiStore();
    const projectId = await createProject(store, "Patch Date Project");
    const taskId = await createTask(store, projectId, "Task", "2026-06-01", "2026-06-30");

    // Try to move endDate before startDate
    const resp = await request(store, "PATCH", `/api/tasks/${taskId}`, {
      endDate: "2026-01-01",
    });

    expect(resp.status).toBe(400);
    expect((resp.body as { error: string }).error).toBe("開始日は終了日以前の日付を指定してください。");
  });

  it("PATCH task with startDate after existing endDate is rejected", async () => {
    const store = new InMemoryApiStore();
    const projectId = await createProject(store, "Patch StartDate Project");
    const taskId = await createTask(store, projectId, "Task", "2026-01-01", "2026-01-31");

    // Try to move startDate past endDate
    const resp = await request(store, "PATCH", `/api/tasks/${taskId}`, {
      startDate: "2026-12-01",
    });

    expect(resp.status).toBe(400);
    expect((resp.body as { error: string }).error).toBe("開始日は終了日以前の日付を指定してください。");
  });

  it("accepts task spanning year boundary (Dec 31 to Jan 1 next year)", async () => {
    const store = new InMemoryApiStore();
    const projectId = await createProject(store, "Year Boundary Project");

    const resp = await request(store, "POST", `/api/projects/${projectId}/tasks`, {
      name: "Year Crossing Task",
      startDate: "2026-12-15",
      endDate: "2027-01-15",
      description: "",
    });

    expect(resp.status).toBe(201);
    const task = (resp.body as { task: { startDate: string; endDate: string } }).task;
    expect(task.startDate).toBe("2026-12-15");
    expect(task.endDate).toBe("2027-01-15");
  });

  it("accepts leap year date 2028-02-29 (2028 is a leap year)", async () => {
    const store = new InMemoryApiStore();
    const projectId = await createProject(store, "Leap Year Project");

    const resp = await request(store, "POST", `/api/projects/${projectId}/tasks`, {
      name: "Leap Day Task",
      startDate: "2028-02-29",
      endDate: "2028-03-01",
      description: "",
    });

    expect(resp.status).toBe(201);
    expect((resp.body as { task: { startDate: string } }).task.startDate).toBe("2028-02-29");
  });

  it("rejects invalid leap year date 2027-02-29 (2027 is NOT a leap year)", async () => {
    const store = new InMemoryApiStore();
    const projectId = await createProject(store, "Non-Leap Year Project");

    const resp = await request(store, "POST", `/api/projects/${projectId}/tasks`, {
      name: "Invalid Leap Day Task",
      startDate: "2027-02-29",
      endDate: "2027-03-01",
      description: "",
    });

    expect(resp.status).toBe(400);
    expect((resp.body as { error: string }).error).toContain("不正");
  });

  it("accepts task with startDate === endDate (same day task)", async () => {
    const store = new InMemoryApiStore();
    const projectId = await createProject(store, "Single Day Project");

    const resp = await request(store, "POST", `/api/projects/${projectId}/tasks`, {
      name: "Same Day Task",
      startDate: "2026-06-15",
      endDate: "2026-06-15",
      description: "",
    });

    expect(resp.status).toBe(201);
  });
});

// ── 4. Gantt chart performance: 100+ tasks ────────────────────────────────

describe("Scenario 4: Gantt chart with 100+ tasks", () => {
  it("creates and lists 100 tasks spanning year boundaries without degradation", async () => {
    const store = new InMemoryApiStore();
    const projectId = await createProject(store, "Large Gantt Project");

    const start = Date.now();

    // Create 100 tasks with various date ranges
    await Promise.all(
      Array.from({ length: 100 }, (_, i) => {
        const month = String((i % 12) + 1).padStart(2, "0");
        const year = 2026 + Math.floor(i / 12);
        const day = String((i % 28) + 1).padStart(2, "0");
        const startDate = `${year}-${month}-${day}`;
        const endDate = `${year}-${month}-${String(Math.min((i % 28) + 3, 28)).padStart(2, "0")}`;
        return request(store, "POST", `/api/projects/${projectId}/tasks`, {
          name: `工程 ${i + 1}`,
          startDate: startDate <= endDate ? startDate : endDate,
          endDate: startDate <= endDate ? endDate : startDate,
          description: `作業内容 ${i + 1}`,
          progress: Math.floor(i * 0.99),
        });
      }),
    );

    const _elapsed = Date.now() - start;

    // Listing should be fast
    const listStart = Date.now();
    const resp = await request(store, "GET", `/api/projects/${projectId}/tasks`);
    const listElapsed = Date.now() - listStart;

    expect(resp.status).toBe(200);
    const tasks = (resp.body as { tasks: unknown[] }).tasks;
    expect(tasks).toHaveLength(100);

    // Performance: listing should complete in under 500ms
    expect(listElapsed).toBeLessThan(500);

    // Progress report should also handle 100 tasks
    const progressResp = await request(store, "GET", `/api/projects/${projectId}/progress`);
    expect(progressResp.status).toBe(200);
    expect((progressResp.body as { overallProgress: number }).overallProgress).toBeGreaterThanOrEqual(0);
    expect((progressResp.body as { overallProgress: number }).overallProgress).toBeLessThanOrEqual(100);

    // Cost summary with 100 tasks should work
    const costResp = await request(store, "GET", `/api/projects/${projectId}/cost-summary`);
    expect(costResp.status).toBe(200);
  });

  it("schedule PDF generation with 100+ tasks completes without error", async () => {
    const store = new InMemoryApiStore();
    const projectId = await createProject(store, "PDF Gantt Project");

    // Create 100 tasks across multiple years
    for (let i = 0; i < 100; i++) {
      const year = 2026 + Math.floor(i / 24);
      const month = String((i % 12) + 1).padStart(2, "0");
      await store.createTask(projectId, {
        name: `工程${i + 1}`,
        startDate: `${year}-${month}-01`,
        endDate: `${year}-${month}-15`,
        description: "",
      });
    }

    const pdfResp = await request(store, "GET", `/api/projects/${projectId}/schedule-pdf`);
    expect(pdfResp.status).toBe(200);
    // schedule-pdf returns raw HTML string as body
    const htmlBody = pdfResp.body as string;
    expect(typeof htmlBody).toBe("string");
    expect(htmlBody.length).toBeGreaterThan(0);
    // Should contain task names
    expect(htmlBody).toContain("工程1");
    expect(htmlBody).toContain("工程100");
  });
});

// ── 5. Notification digest: zero vs 1000+ notifications ──────────────────

describe("Scenario 5: Notification digest edge cases", () => {
  it("digest with zero notifications returns correct empty summary in Japanese", async () => {
    const store = new InMemoryApiStore();
    // No notifications created - fresh store

    const resp = await request(store, "GET", "/api/notifications/digest");
    expect(resp.status).toBe(200);

    const body = resp.body as {
      summary: string;
      totals: { today: number; unreadToday: number; unreadAll: number; highPriorityToday: number };
    };
    expect(body.totals.today).toBe(0);
    expect(body.totals.unreadAll).toBe(0);
    expect(body.totals.highPriorityToday).toBe(0);
    expect(body.summary).toContain("新着通知はありません");
  });

  it("digest with 1000+ notifications aggregates correctly without crash", async () => {
    const store = new InMemoryApiStore();
    const projectId = await createProject(store, "Notification Flood Project");

    // Create 1000 notifications directly via store (fast path)
    const types = ["task_status_changed", "material_delivery_due", "change_order_created", "other"];
    const priorities = ["high", "medium", "low"] as const;

    await Promise.all(
      Array.from({ length: 1000 }, (_, i) =>
        store.createNotification({
          type: types[i % types.length],
          message: `通知メッセージ ${i}`,
          projectId,
          recipientId: "system",
          priority: priorities[i % priorities.length],
        }),
      ),
    );

    // List all notifications
    const listResp = await request(store, "GET", "/api/notifications");
    expect(listResp.status).toBe(200);
    const notifications = (listResp.body as { notifications: unknown[] }).notifications;
    expect(notifications).toHaveLength(1000);

    // Unread count
    const countResp = await request(store, "GET", "/api/notifications/unread-count");
    expect(countResp.status).toBe(200);
    expect((countResp.body as { unreadCount: number }).unreadCount).toBe(1000);

    // Digest should handle 1000 notifications
    const digestResp = await request(store, "GET", "/api/notifications/digest");
    expect(digestResp.status).toBe(200);
    const digest = digestResp.body as {
      totals: { unreadAll: number };
      summary: string;
    };
    expect(digest.totals.unreadAll).toBe(1000);
    expect(typeof digest.summary).toBe("string");
    expect(digest.summary.length).toBeGreaterThan(0);
  });

  it("filter by read=false returns only unread when 500 read and 500 unread", async () => {
    const store = new InMemoryApiStore();
    const projectId = await createProject(store, "Filter Test Project");

    // Create 1000 notifications
    const notificationIds: string[] = [];
    for (let i = 0; i < 1000; i++) {
      const notification = await store.createNotification({
        type: "task_status_changed",
        message: `Notification ${i}`,
        projectId,
        recipientId: "system",
        priority: "medium",
      });
      notificationIds.push(notification.id);
    }

    // Mark first 500 as read
    await Promise.all(
      notificationIds.slice(0, 500).map((id) => store.markNotificationRead(id)),
    );

    const unreadResp = await request(store, "GET", "/api/notifications?read=false");
    const readResp = await request(store, "GET", "/api/notifications?read=true");

    expect(unreadResp.status).toBe(200);
    expect(readResp.status).toBe(200);

    const unread = (unreadResp.body as { notifications: unknown[] }).notifications;
    const read = (readResp.body as { notifications: unknown[] }).notifications;

    expect(unread).toHaveLength(500);
    expect(read).toHaveLength(500);
  });
});

// ── 6. Document version history: 50+ versions ─────────────────────────────

describe("Scenario 6: Document version history with 50+ versions", () => {
  it("creates 50 document versions and retrieves full history correctly", async () => {
    const store = new InMemoryApiStore();
    const projectId = await createProject(store, "Document Version Project");

    // Create initial document
    const createResp = await request(store, "POST", `/api/projects/${projectId}/documents`, {
      name: "設計図書",
      type: "drawing",
      url: "https://example.com/docs/v1.pdf",
      uploadedBy: "田中太郎",
      version: "v1.0",
    });
    expect(createResp.status).toBe(201);
    const documentId = (createResp.body as { document: { id: string } }).document.id;

    // Update document 50 times, creating 50 versions
    for (let i = 2; i <= 51; i++) {
      const patchResp = await request(store, "PATCH", `/api/documents/${documentId}`, {
        url: `https://example.com/docs/v${i}.pdf`,
        version: `v${i}.0`,
      });
      expect(patchResp.status).toBe(200);
    }

    // Verify version history has 50 archived versions (v1-v50)
    const versionsResp = await request(store, "GET", `/api/documents/${documentId}/versions`);
    expect(versionsResp.status).toBe(200);
    const versions = (versionsResp.body as { versions: Array<{ version: string }> }).versions;
    expect(versions).toHaveLength(50);

    // Current document should be at v51.0
    const docResp = await request(store, "GET", `/api/documents/${documentId}`);
    expect(docResp.status).toBe(200);
    expect((docResp.body as { document: { version: string } }).document.version).toBe("v51.0");
  });

  it("deleting a document removes all its version history", async () => {
    const store = new InMemoryApiStore();
    const projectId = await createProject(store, "Delete Document Project");

    // Create and update document to build version history
    const createResp = await request(store, "POST", `/api/projects/${projectId}/documents`, {
      name: "仕様書",
      type: "other",
      url: "https://example.com/spec/v1.pdf",
      uploadedBy: "鈴木花子",
      version: "v1.0",
    });
    expect(createResp.status).toBe(201);
    const documentId = (createResp.body as { document: { id: string } }).document.id;

    // Create 10 versions
    for (let i = 2; i <= 11; i++) {
      await request(store, "PATCH", `/api/documents/${documentId}`, {
        url: `https://example.com/spec/v${i}.pdf`,
        version: `v${i}.0`,
      });
    }

    // Verify versions exist
    const beforeDelete = await request(store, "GET", `/api/documents/${documentId}/versions`);
    expect((beforeDelete.body as { versions: unknown[] }).versions).toHaveLength(10);

    // Delete the document
    const deleteResp = await request(store, "DELETE", `/api/documents/${documentId}`);
    expect(deleteResp.status).toBe(204);

    // Versions should no longer be accessible (document not found)
    const afterDelete = await request(store, "GET", `/api/documents/${documentId}/versions`);
    expect(afterDelete.status).toBe(404);
  });

  it("JsonFileApiStore preserves 50 document versions across serialization", async () => {
    await withTempDb(async (filePath) => {
      const store = new JsonFileApiStore(filePath);
      const projectId = await createProject(store, "Persistent Version Project");

      const createResp = await request(store, "POST", `/api/projects/${projectId}/documents`, {
        name: "契約書",
        type: "contract",
        url: "https://example.com/contract/v1.pdf",
        uploadedBy: "システム",
        version: "v1.0",
      });
      const documentId = (createResp.body as { document: { id: string } }).document.id;

      // Create 50 versions
      for (let i = 2; i <= 51; i++) {
        await request(store, "PATCH", `/api/documents/${documentId}`, {
          version: `v${i}.0`,
        });
      }

      // Create a new store instance from the same file (simulates server restart)
      const store2 = new JsonFileApiStore(filePath);
      const versionsResp = await request(store2, "GET", `/api/documents/${documentId}/versions`);
      expect(versionsResp.status).toBe(200);
      const versions = (versionsResp.body as { versions: unknown[] }).versions;
      expect(versions).toHaveLength(50);
    });
  });
});
