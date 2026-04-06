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
        { name: "案件A", taskCount: 0 },
        { name: "案件B", taskCount: 0 },
      ],
    });
  });

  it("GET /api/projects?search=... でプロジェクト名の部分一致検索と taskCount を返す", async () => {
    const godivaProject = await request("POST", "/api/projects", {
      name: "ゴディバ銀座店",
      contractor: "元請A",
      address: "東京都",
      status: "planning",
    });
    const otherProject = await request("POST", "/api/projects", {
      name: "渋谷改修",
      contractor: "元請B",
      address: "東京都",
      status: "active",
    });
    const godivaProjectId = (godivaProject.body as { project: { id: string } }).project.id;
    const otherProjectId = (otherProject.body as { project: { id: string } }).project.id;

    await request("POST", `/api/projects/${godivaProjectId}/tasks`, {
      name: "墨出し",
      startDate: "2026-01-10",
      endDate: "2026-01-11",
      description: "",
    });
    await request("POST", `/api/projects/${godivaProjectId}/tasks`, {
      name: "LGS",
      startDate: "2026-01-12",
      endDate: "2026-01-13",
      description: "",
    });
    await request("POST", `/api/projects/${otherProjectId}/tasks`, {
      name: "解体",
      startDate: "2026-01-14",
      endDate: "2026-01-15",
      description: "",
    });

    const response = await request("GET", "/api/projects?search=ゴディバ");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      projects: [
        expect.objectContaining({
          id: godivaProjectId,
          name: "ゴディバ銀座店",
          taskCount: 2,
        }),
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

  it("PATCH /api/projects/:id でプロジェクトを更新できる", async () => {
    const created = await request("POST", "/api/projects", {
      name: "案件C",
      contractor: "元請C",
      address: "埼玉県",
      status: "planning",
    });
    const projectId = (created.body as { project: { id: string } }).project.id;

    const response = await request("PATCH", `/api/projects/${projectId}`, {
      name: "案件C改",
      contractor: "元請C改",
      address: "東京都港区",
      status: "active",
      description: "夜間施工あり",
      startDate: "2026-03-01",
      endDate: "2026-03-31",
    });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      project: {
        id: projectId,
        name: "案件C改",
        contractor: "元請C改",
        address: "東京都港区",
        status: "active",
        description: "夜間施工あり",
        startDate: "2026-03-01",
        endDate: "2026-03-31",
      },
    });
  });

  it("DELETE /api/projects/:id で関連タスクごとプロジェクトを削除できる", async () => {
    const createdProject = await request("POST", "/api/projects", {
      name: "削除対象案件",
      contractor: "元請削除",
      address: "東京都",
      status: "planning",
    });
    const keptProject = await request("POST", "/api/projects", {
      name: "継続案件",
      contractor: "元請継続",
      address: "神奈川県",
      status: "active",
    });
    const projectId = (createdProject.body as { project: { id: string } }).project.id;
    const keptProjectId = (keptProject.body as { project: { id: string } }).project.id;

    await request("POST", `/api/projects/${projectId}/tasks`, {
      name: "削除されるタスク",
      startDate: "2026-04-01",
      endDate: "2026-04-02",
      description: "",
    });
    await request("POST", `/api/projects/${keptProjectId}/tasks`, {
      name: "残るタスク",
      startDate: "2026-04-03",
      endDate: "2026-04-04",
      description: "",
    });

    const deleteResponse = await request("DELETE", `/api/projects/${projectId}`);
    const deletedProjectResponse = await request("GET", `/api/projects/${projectId}`);
    const deletedProjectTasksResponse = await request("GET", `/api/projects/${projectId}/tasks`);
    const keptProjectTasksResponse = await request("GET", `/api/projects/${keptProjectId}/tasks`);

    expect(deleteResponse.status).toBe(204);
    expect(deleteResponse.body).toBeNull();
    expect(deletedProjectResponse).toEqual({
      status: 404,
      body: { error: "指定されたプロジェクトが見つかりません。" },
    });
    expect(deletedProjectTasksResponse).toEqual({
      status: 404,
      body: { error: "指定されたプロジェクトが見つかりません。" },
    });
    expect(keptProjectTasksResponse.body).toMatchObject({
      tasks: [{ name: "残るタスク" }],
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

  it("PATCH /api/tasks/:id で projectId を変更して別プロジェクトへ移動できる", async () => {
    const fromProject = await request("POST", "/api/projects", {
      name: "移動元案件",
      contractor: "元請元",
      address: "東京都",
      status: "planning",
    });
    const toProject = await request("POST", "/api/projects", {
      name: "移動先案件",
      contractor: "元請先",
      address: "神奈川県",
      status: "active",
    });
    const fromProjectId = (fromProject.body as { project: { id: string } }).project.id;
    const toProjectId = (toProject.body as { project: { id: string } }).project.id;
    const createdTask = await request("POST", `/api/projects/${fromProjectId}/tasks`, {
      name: "移動タスク",
      startDate: "2026-06-10",
      endDate: "2026-06-12",
      description: "",
    });
    const taskId = (createdTask.body as { task: { id: string } }).task.id;

    const response = await request("PATCH", `/api/tasks/${taskId}`, {
      projectId: toProjectId,
    });
    const fromTasksResponse = await request("GET", `/api/projects/${fromProjectId}/tasks`);
    const toTasksResponse = await request("GET", `/api/projects/${toProjectId}/tasks`);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      task: {
        id: taskId,
        projectId: toProjectId,
        name: "移動タスク",
      },
    });
    expect(fromTasksResponse.body).toEqual({ tasks: [] });
    expect(toTasksResponse.body).toMatchObject({
      tasks: [{ id: taskId, name: "移動タスク" }],
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
