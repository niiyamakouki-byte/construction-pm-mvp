/* @vitest-environment node */

import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  ApiError,
  type ApiStore,
  handleApiRequest,
  InMemoryApiStore,
  JsonFileApiStore,
} from "./server.js";

const TEST_API_KEY = "test-api-key";
const EMPTY_DB_STATE = JSON.stringify(
  {
    projects: [],
    tasks: [],
    contractors: [],
    materials: [],
    changeOrders: [],
  },
  null,
  2,
);
const originalApiKey = process.env.API_KEY;

type TestResponse = {
  status: number;
  body: unknown;
};

beforeEach(() => {
  process.env.API_KEY = TEST_API_KEY;
});

afterEach(() => {
  if (originalApiKey === undefined) {
    delete process.env.API_KEY;
    return;
  }

  process.env.API_KEY = originalApiKey;
});

async function request(
  store: ApiStore,
  method: string,
  url: string,
  body?: unknown,
  headers: Record<string, string> = { "x-api-key": TEST_API_KEY },
): Promise<TestResponse> {
  try {
    const response = await handleApiRequest({ method, url, body, headers }, store);
    return {
      status: response.statusCode,
      body: response.body ?? null,
    };
  } catch (error) {
    if (error instanceof ApiError) {
      return {
        status: error.statusCode,
        body: { error: error.message },
      };
    }

    throw error;
  }
}

async function withTempDbFile<T>(
  contents: string | undefined,
  run: (filePath: string) => Promise<T>,
): Promise<T> {
  const dirPath = await mkdtemp(join(tmpdir(), "genbahub-chaos-"));
  const filePath = join(dirPath, "db.json");

  try {
    if (contents !== undefined) {
      await writeFile(filePath, contents, "utf8");
    }

    return await run(filePath);
  } finally {
    await rm(dirPath, { recursive: true, force: true });
  }
}

async function createProject(store: ApiStore, name = "Chaos Project"): Promise<string> {
  const response = await request(store, "POST", "/api/projects", {
    name,
    contractor: "Chaos GC",
    address: "東京都港区",
    status: "planning",
  });

  expect(response.status).toBe(201);
  return (response.body as { project: { id: string } }).project.id;
}

async function createTask(
  store: ApiStore,
  projectId: string,
  name: string,
  startDate = "2026-01-01",
  endDate = "2026-01-02",
): Promise<string> {
  const response = await request(store, "POST", `/api/projects/${projectId}/tasks`, {
    name,
    startDate,
    endDate,
    description: "",
  });

  expect(response.status).toBe(201);
  return (response.body as { task: { id: string } }).task.id;
}

describe("GenbaHub API chaos engineering", () => {
  describe("DB corruption", () => {
    it("returns 500 with a clear error when the JSON DB contains invalid JSON", async () => {
      await withTempDbFile("{ invalid json", async (filePath) => {
        const store = new JsonFileApiStore(filePath);

        const response = await request(store, "GET", "/api/projects");

        expect(response).toEqual({
          status: 500,
          body: { error: "データベースファイルが破損しているため読み込めません。" },
        });
      });
    });

    it("returns 500 with a clear error when the JSON DB file is empty", async () => {
      await withTempDbFile("", async (filePath) => {
        const store = new JsonFileApiStore(filePath);

        const response = await request(store, "GET", "/api/projects");

        expect(response).toEqual({
          status: 500,
          body: { error: "データベースファイルが空のため読み込めません。" },
        });
      });
    });

    it("handles a missing JSON DB file by bootstrapping an empty state instead of crashing", async () => {
      await withTempDbFile(undefined, async (filePath) => {
        const store = new JsonFileApiStore(filePath);

        const response = await request(store, "GET", "/api/projects");

        expect(response).toEqual({
          status: 200,
          body: { projects: [] },
        });
      });
    });
  });

  describe("Auth edge cases", () => {
    it.each([
      { label: "expired-format key", key: "expired:2024-01-01T00:00:00Z" },
      { label: "extremely long key", key: "k".repeat(10 * 1024) },
      { label: "null-byte key", key: "test-api-key\u0000suffix" },
      { label: "unicode key", key: "現場🔑アクセス" },
      { label: "empty key", key: "" },
    ])("rejects $label without crashing", async ({ key }) => {
      const store = new InMemoryApiStore();

      const response = await request(store, "GET", "/api/projects", undefined, {
        "x-api-key": key,
      });

      expect(response).toEqual({
        status: 401,
        body: { error: "APIキーが未設定、または不正です。" },
      });
    });
  });

  describe("Concurrent requests", () => {
    it("creates 100 projects simultaneously without corrupting the JSON DB", async () => {
      await withTempDbFile(EMPTY_DB_STATE, async (filePath) => {
        const store = new JsonFileApiStore(filePath);

        const responses = await Promise.all(
          Array.from({ length: 100 }, (_, index) =>
            request(store, "POST", "/api/projects", {
              name: `Concurrent Project ${index}`,
              contractor: `Concurrent GC ${index}`,
              address: `Address ${index}`,
              status: "planning",
            }),
          ),
        );

        expect(responses.every((response) => response.status === 201)).toBe(true);

        const listResponse = await request(store, "GET", "/api/projects");
        expect(listResponse.status).toBe(200);

        const projects = (listResponse.body as { projects: Array<{ id: string; name: string }> }).projects;
        expect(projects).toHaveLength(100);
        expect(new Set(projects.map((project) => project.id)).size).toBe(100);

        const persisted = JSON.parse(await readFile(filePath, "utf8")) as {
          projects: Array<{ name: string }>;
        };
        expect(persisted.projects).toHaveLength(100);
      });
    });
  });

  describe("Circular dependencies", () => {
    it("rejects task dependency cycles such as A -> B -> C -> A", async () => {
      const store = new InMemoryApiStore();
      const projectId = await createProject(store, "Cycle Project");
      const taskAId = await createTask(store, projectId, "Task A");
      const taskBId = await createTask(store, projectId, "Task B", "2026-01-03", "2026-01-04");
      const taskCId = await createTask(store, projectId, "Task C", "2026-01-05", "2026-01-06");

      expect(
        await request(store, "POST", `/api/tasks/${taskAId}/dependencies`, {
          predecessorId: taskBId,
          type: "FS",
          lagDays: 0,
        }),
      ).toMatchObject({ status: 201 });
      expect(
        await request(store, "POST", `/api/tasks/${taskBId}/dependencies`, {
          predecessorId: taskCId,
          type: "FS",
          lagDays: 0,
        }),
      ).toMatchObject({ status: 201 });

      const response = await request(store, "POST", `/api/tasks/${taskCId}/dependencies`, {
        predecessorId: taskAId,
        type: "FS",
        lagDays: 0,
      });

      expect(response).toEqual({
        status: 400,
        body: { error: "依存関係が循環するため追加できません。" },
      });
      expect((await store.getTask(taskCId))?.dependencies).toEqual([]);
    });
  });

  describe("Boundary values", () => {
    it("rejects 10000-character project names with a validation error instead of crashing", async () => {
      const store = new InMemoryApiStore();

      const response = await request(store, "POST", "/api/projects", {
        name: "a".repeat(10_000),
        contractor: "Chaos GC",
        address: "東京都港区",
        status: "planning",
      });

      expect(response).toEqual({
        status: 400,
        body: { error: "プロジェクト名は200文字以内で入力してください。" },
      });
    });

    it("rejects negative-style dates cleanly", async () => {
      const store = new InMemoryApiStore();
      const projectId = await createProject(store, "Negative Date Project");

      const response = await request(store, "POST", `/api/projects/${projectId}/tasks`, {
        name: "Negative Date Task",
        startDate: "-001-01-01",
        endDate: "-001-01-02",
        description: "",
      });

      expect(response).toEqual({
        status: 400,
        body: { error: "開始日はYYYY-MM-DD形式で入力してください。" },
      });
    });

    it("accepts far-future dates in year 9999", async () => {
      const store = new InMemoryApiStore();
      const projectId = await createProject(store, "Year 9999 Project");

      const response = await request(store, "POST", `/api/projects/${projectId}/tasks`, {
        name: "Far Future Task",
        startDate: "9999-01-01",
        endDate: "9999-12-31",
        description: "",
      });

      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({
        task: {
          name: "Far Future Task",
          startDate: "9999-01-01",
          endDate: "9999-12-31",
        },
      });
    });

    it("returns zero-length arrays for empty project task lists", async () => {
      const store = new InMemoryApiStore();
      const projectId = await createProject(store, "Empty Array Project");

      const response = await request(store, "GET", `/api/projects/${projectId}/tasks`);

      expect(response).toEqual({
        status: 200,
        body: { tasks: [] },
      });
    });
  });

  describe("Resource exhaustion", () => {
    it("still serves the task list endpoint with 10000 tasks in one project", async () => {
      const store = new InMemoryApiStore();
      const projectId = await createProject(store, "Huge Project");

      await Promise.all(
        Array.from({ length: 10_000 }, (_, index) =>
          store.createTask(projectId, {
            name: `Task ${index}`,
            startDate: "2026-08-01",
            endDate: "2026-08-01",
            description: "",
          }),
        ),
      );

      const response = await request(store, "GET", `/api/projects/${projectId}/tasks`);
      expect(response.status).toBe(200);

      const tasks = (response.body as { tasks: Array<{ name: string }> }).tasks;
      expect(tasks).toHaveLength(10_000);
      expect(tasks[0]?.name).toBe("Task 0");
      expect(tasks[9_999]?.name).toBe("Task 9999");
    });
  });
});
