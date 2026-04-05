/* @vitest-environment node */

import { beforeEach, describe, expect, it } from "vitest";
import {
  ApiError,
  InMemoryApiStore,
  handleApiRequest,
  parseMultipartBody,
} from "./server.js";
import { createMockXlsxBuffer } from "./test-utils.js";

describe("GenbaHub API", () => {
  let store: InMemoryApiStore;

  beforeEach(() => {
    store = new InMemoryApiStore();
  });

  async function request(
    method: string,
    url: string,
    body?: unknown,
  ): Promise<{ status: number; body: unknown }> {
    try {
      const response = await handleApiRequest({ method, url, body }, store);
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

  it("POST /api/projects でプロジェクトを作成できる", async () => {
    const response = await request("POST", "/api/projects", {
      name: "ゴディバ銀座店",
      contractor: "フィールドクラブ",
      address: "東京都中央区",
      status: "planning",
    });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      project: {
        name: "ゴディバ銀座店",
        contractor: "フィールドクラブ",
        address: "東京都中央区",
        status: "planning",
      },
    });
  });

  it("POST /api/projects は必須項目不足で日本語エラーを返す", async () => {
    const response = await request("POST", "/api/projects", {
      name: "",
      contractor: "フィールドクラブ",
      address: "東京都中央区",
      status: "planning",
    });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: "プロジェクト名は必須です。",
    });
  });

  it("GET /api/projects で一覧を取得できる", async () => {
    await request("POST", "/api/projects", {
      name: "案件A",
      contractor: "元請A",
      address: "東京都",
      status: "planning",
    });
    await request("POST", "/api/projects", {
      name: "案件B",
      contractor: "元請B",
      address: "神奈川県",
      status: "active",
    });

    const response = await request("GET", "/api/projects");

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      projects: [
        { name: "案件A" },
        { name: "案件B" },
      ],
    });
  });

  it("GET /api/projects/:id で単一プロジェクトを取得できる", async () => {
    const created = await request("POST", "/api/projects", {
      name: "案件C",
      contractor: "元請C",
      address: "埼玉県",
      status: "active",
    });
    const projectId = (created.body as { project: { id: string } }).project.id;

    const response = await request("GET", `/api/projects/${projectId}`);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      project: {
        id: projectId,
        name: "案件C",
        contractor: "元請C",
      },
    });
  });

  it("POST /api/projects/:id/tasks でタスクを作成できる", async () => {
    const createdProject = await request("POST", "/api/projects", {
      name: "案件D",
      contractor: "元請D",
      address: "千葉県",
      status: "planning",
    });
    const projectId = (createdProject.body as { project: { id: string } }).project.id;

    const response = await request("POST", `/api/projects/${projectId}/tasks`, {
      name: "LGS工事",
      startDate: "2026-04-10",
      endDate: "2026-04-15",
      contractorId: "contractor-1",
      description: "軽量下地の先行施工",
    });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      task: {
        projectId,
        name: "LGS工事",
        startDate: "2026-04-10",
        endDate: "2026-04-15",
        contractorId: "contractor-1",
        contractor: null,
      },
    });
  });

  it("GET /api/projects/:id/tasks でタスク一覧を取得できる", async () => {
    const createdProject = await request("POST", "/api/projects", {
      name: "案件E",
      contractor: "元請E",
      address: "茨城県",
      status: "planning",
    });
    const projectId = (createdProject.body as { project: { id: string } }).project.id;

    await request("POST", `/api/projects/${projectId}/tasks`, {
      name: "墨出し",
      startDate: "2026-05-01",
      endDate: "2026-05-02",
      description: "",
    });

    const response = await request("GET", `/api/projects/${projectId}/tasks`);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      tasks: [
        {
          name: "墨出し",
          startDate: "2026-05-01",
          endDate: "2026-05-02",
        },
      ],
    });
  });

  it("PATCH /api/tasks/:id でステータスと日付を更新できる", async () => {
    const createdProject = await request("POST", "/api/projects", {
      name: "案件F",
      contractor: "元請F",
      address: "群馬県",
      status: "planning",
    });
    const projectId = (createdProject.body as { project: { id: string } }).project.id;
    const createdTask = await request("POST", `/api/projects/${projectId}/tasks`, {
      name: "ボード張り",
      startDate: "2026-06-01",
      endDate: "2026-06-03",
      description: "",
    });
    const taskId = (createdTask.body as { task: { id: string } }).task.id;

    const response = await request("PATCH", `/api/tasks/${taskId}`, {
      status: "in_progress",
      startDate: "2026-06-02",
      endDate: "2026-06-04",
    });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      task: {
        id: taskId,
        status: "in_progress",
        startDate: "2026-06-02",
        endDate: "2026-06-04",
        contractor: null,
      },
    });
  });

  it("multipart/form-data のファイルを解析できる", () => {
    const boundary = "----genbahub-boundary";
    const workbook = createMockXlsxBuffer([
      ["作業名", "開始日", "完了日"],
      ["軽量下地", "R8.4.10", "2026年4月12日"],
    ]);
    const body = Buffer.concat([
      Buffer.from(`--${boundary}\r\n`),
      Buffer.from("Content-Disposition: form-data; name=\"file\"; filename=\"schedule.xlsx\"\r\n"),
      Buffer.from("Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet\r\n\r\n"),
      workbook,
      Buffer.from(`\r\n--${boundary}--\r\n`),
    ]);

    const parsed = parseMultipartBody(body, boundary);

    expect(parsed.files).toHaveLength(1);
    expect(parsed.files[0]).toMatchObject({
      fieldName: "file",
      filename: "schedule.xlsx",
      contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    expect(Buffer.compare(parsed.files[0].buffer, workbook)).toBe(0);
  });

  it("POST /api/projects/:id/import で工程表を取り込める", async () => {
    const createdProject = await request("POST", "/api/projects", {
      name: "案件Import",
      contractor: "元請Import",
      address: "東京都",
      status: "planning",
    });
    const projectId = (createdProject.body as { project: { id: string } }).project.id;

    const response = await request("POST", `/api/projects/${projectId}/import`, {
      files: [
        {
          fieldName: "file",
          filename: "schedule.xlsx",
          contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          buffer: createMockXlsxBuffer([
            ["作業名", "開始日", "完了日", "業者", "備考"],
            ["軽量下地", "R8.4.10", "2026年4月12日", "山田内装", "先行施工"],
          ]),
        },
      ],
      fields: {},
    });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      tasks: [
        {
          projectId,
          name: "軽量下地",
          startDate: "2026-04-10",
          endDate: "2026-04-12",
          contractor: "山田内装",
          description: "先行施工",
        },
      ],
    });

    const listResponse = await request("GET", `/api/projects/${projectId}/tasks`);
    expect(listResponse.body).toMatchObject({
      tasks: [
        {
          name: "軽量下地",
          startDate: "2026-04-10",
          endDate: "2026-04-12",
          contractor: "山田内装",
        },
      ],
    });
  });

  it("DELETE /api/tasks/:id でタスクを削除できる", async () => {
    const createdProject = await request("POST", "/api/projects", {
      name: "案件G",
      contractor: "元請G",
      address: "栃木県",
      status: "planning",
    });
    const projectId = (createdProject.body as { project: { id: string } }).project.id;
    const createdTask = await request("POST", `/api/projects/${projectId}/tasks`, {
      name: "検査",
      startDate: "2026-07-01",
      endDate: "2026-07-01",
      description: "",
    });
    const taskId = (createdTask.body as { task: { id: string } }).task.id;

    const deleteResponse = await request("DELETE", `/api/tasks/${taskId}`);
    const listResponse = await request("GET", `/api/projects/${projectId}/tasks`);

    expect(deleteResponse.status).toBe(204);
    expect(deleteResponse.body).toBeNull();
    expect(listResponse.body).toEqual({ tasks: [] });
  });

  it("存在しないタスク更新では404を返す", async () => {
    const response = await request("PATCH", "/api/tasks/missing-task", {
      status: "done",
    });

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      error: "指定されたタスクが見つかりません。",
    });
  });
});
