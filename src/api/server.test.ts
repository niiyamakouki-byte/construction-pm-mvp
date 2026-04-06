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
  const TEST_API_KEY = "test-api-key";
  let store: InMemoryApiStore;

  beforeEach(() => {
    store = new InMemoryApiStore();
    process.env.API_KEY = TEST_API_KEY;
  });

  async function request(
    method: string,
    url: string,
    body?: unknown,
    headers: Record<string, string> = { "x-api-key": TEST_API_KEY },
  ): Promise<{ status: number; body: unknown }> {
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

  async function requestRaw(
    method: string,
    url: string,
    body?: unknown,
    headers: Record<string, string> = { "x-api-key": TEST_API_KEY },
  ): Promise<{ status: number; headers: Record<string, string>; body: unknown }> {
    try {
      const response = await handleApiRequest({ method, url, body, headers }, store);
      return {
        status: response.statusCode,
        headers: response.headers ?? {},
        body: response.body ?? null,
      };
    } catch (error) {
      if (error instanceof ApiError) {
        return {
          status: error.statusCode,
          headers: {},
          body: { error: error.message },
        };
      }
      throw error;
    }
  }

  it("GET /api/health はAPIキーなしで応答する", async () => {
    const response = await request("GET", "/api/health", undefined, {});

    expect(response).toEqual({
      status: 200,
      body: { status: "ok" },
    });
  });

  it("保護されたエンドポイントはAPIキーがないと401を返す", async () => {
    const response = await request("GET", "/api/projects", undefined, {});

    expect(response).toEqual({
      status: 401,
      body: { error: "APIキーが未設定、または不正です。" },
    });
  });

  it("保護されたエンドポイントは不正なAPIキーで401を返す", async () => {
    const response = await request("GET", "/api/projects", undefined, {
      "x-api-key": "wrong-key",
    });

    expect(response).toEqual({
      status: 401,
      body: { error: "APIキーが未設定、または不正です。" },
    });
  });

  it("POST /api/projects でプロジェクトを作成できる", async () => {
    const response = await request("POST", "/api/projects", {
      name: "ゴディバ銀座店",
      contractor: "フィールドクラブ",
      address: "東京都中央区",
      status: "planning",
      clientId: "client-001",
      clientName: "株式会社サンプル",
      contractAmount: 2500000,
      contractDate: "2026-01-05",
      inspectionDate: "2026-02-20",
      handoverDate: "2026-02-28",
      warrantyEndDate: "2027-02-28",
    });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      project: {
        name: "ゴディバ銀座店",
        contractor: "フィールドクラブ",
        address: "東京都中央区",
        status: "planning",
        clientId: "client-001",
        clientName: "株式会社サンプル",
        contractAmount: 2500000,
        contractDate: "2026-01-05",
        inspectionDate: "2026-02-20",
        handoverDate: "2026-02-28",
        warrantyEndDate: "2027-02-28",
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

  it("POST /api/projects は不正なステータスに候補付きの日本語エラーを返す", async () => {
    const response = await request("POST", "/api/projects", {
      name: "案件StatusError",
      contractor: "フィールドクラブ",
      address: "東京都中央区",
      status: "started",
    });

    expect(response).toEqual({
      status: 400,
      body: {
        error: "ステータスは「planning」、「active」、「completed」のいずれかを指定してください。",
      },
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
      clientName: "株式会社更新先",
      contractAmount: 3300000,
      contractDate: "2026-02-01",
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
        clientName: "株式会社更新先",
        contractAmount: 3300000,
        contractDate: "2026-02-01",
      },
    });
  });

  it("PATCH /api/projects/:id は planning から completed へのスキップ更新を拒否する", async () => {
    const created = await request("POST", "/api/projects", {
      name: "案件Lifecycle",
      contractor: "元請Lifecycle",
      address: "東京都",
      status: "planning",
    });
    const projectId = (created.body as { project: { id: string } }).project.id;

    const response = await request("PATCH", `/api/projects/${projectId}`, {
      status: "completed",
    });

    expect(response).toEqual({
      status: 400,
      body: {
        error: "プロジェクトステータスは planning → active → completed の順でのみ更新できます。",
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

  it("POST/GET /api/contractors で業者台帳を登録・取得できる", async () => {
    const created = await request("POST", "/api/contractors", {
      name: "山田内装",
      trade: "軽天・ボード",
      phone: "03-1234-5678",
      email: "yamada@example.com",
    });
    const list = await request("GET", "/api/contractors");

    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({
      contractor: {
        name: "山田内装",
        trade: "軽天・ボード",
        phone: "03-1234-5678",
        email: "yamada@example.com",
      },
    });
    expect(list.status).toBe(200);
    expect(list.body).toMatchObject({
      contractors: [
        {
          name: "山田内装",
          trade: "軽天・ボード",
        },
      ],
    });
  });

  it("POST /api/projects/:id/tasks でタスクを作成できる", async () => {
    const createdContractor = await request("POST", "/api/contractors", {
      name: "鈴木設備",
      trade: "設備",
      phone: "03-9999-0000",
      email: "suzuki@example.com",
    });
    const contractorId = (createdContractor.body as { contractor: { id: string } }).contractor.id;
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
      contractorId,
      progress: 15,
      cost: 120000,
      description: "軽量下地の先行施工",
    });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      task: {
        projectId,
        name: "LGS工事",
        startDate: "2026-04-10",
        endDate: "2026-04-15",
        progress: 15,
        cost: 120000,
        contractorId,
        contractor: "鈴木設備",
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

  it("POST /api/projects/:id/tasks はマイルストーン作成時に同日指定を要求する", async () => {
    const createdProject = await request("POST", "/api/projects", {
      name: "案件MilestoneValidation",
      contractor: "元請MilestoneValidation",
      address: "東京都",
      status: "planning",
    });
    const projectId = (createdProject.body as { project: { id: string } }).project.id;

    const response = await request("POST", `/api/projects/${projectId}/tasks`, {
      name: "引渡し",
      startDate: "2026-05-10",
      endDate: "2026-05-12",
      isMilestone: true,
      description: "",
    });

    expect(response).toEqual({
      status: 400,
      body: { error: "マイルストーンは開始日と終了日を同日にしてください。" },
    });
  });

  it("GET /api/projects/:id/milestones でマイルストーンだけを取得できる", async () => {
    const createdProject = await request("POST", "/api/projects", {
      name: "案件Milestones",
      contractor: "元請Milestones",
      address: "東京都",
      status: "planning",
    });
    const projectId = (createdProject.body as { project: { id: string } }).project.id;

    const milestoneResponse = await request("POST", `/api/projects/${projectId}/tasks`, {
      name: "引渡し",
      startDate: "2026-05-20",
      endDate: "2026-05-20",
      isMilestone: true,
      description: "",
    });
    await request("POST", `/api/projects/${projectId}/tasks`, {
      name: "内装工事",
      startDate: "2026-05-10",
      endDate: "2026-05-15",
      description: "",
    });

    const response = await request("GET", `/api/projects/${projectId}/milestones`);

    expect(milestoneResponse.status).toBe(201);
    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      milestones: [
        expect.objectContaining({
          name: "引渡し",
          startDate: "2026-05-20",
          endDate: "2026-05-20",
          isMilestone: true,
        }),
      ],
    });
  });

  it("PATCH /api/tasks/:id でステータスと日付を更新できる", async () => {
    const createdContractor = await request("POST", "/api/contractors", {
      name: "田中電気",
      trade: "電気",
      phone: "045-123-4567",
      email: "tanaka@example.com",
    });
    const contractorId = (createdContractor.body as { contractor: { id: string } }).contractor.id;
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
      progress: 45,
      cost: 180000,
      contractorId,
    });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      task: {
        id: taskId,
        status: "in_progress",
        startDate: "2026-06-02",
        endDate: "2026-06-04",
        progress: 45,
        cost: 180000,
        contractorId,
        contractor: "田中電気",
      },
    });
  });

  it("POST /api/tasks/:id/dependencies で依存関係を追加できる", async () => {
    const createdProject = await request("POST", "/api/projects", {
      name: "案件Dependencies",
      contractor: "元請Dependencies",
      address: "東京都",
      status: "planning",
    });
    const projectId = (createdProject.body as { project: { id: string } }).project.id;
    const predecessor = await request("POST", `/api/projects/${projectId}/tasks`, {
      name: "墨出し",
      startDate: "2026-06-01",
      endDate: "2026-06-02",
      description: "",
    });
    const successor = await request("POST", `/api/projects/${projectId}/tasks`, {
      name: "軽天",
      startDate: "2026-06-03",
      endDate: "2026-06-05",
      description: "",
    });
    const predecessorId = (predecessor.body as { task: { id: string } }).task.id;
    const successorId = (successor.body as { task: { id: string } }).task.id;

    const response = await request("POST", `/api/tasks/${successorId}/dependencies`, {
      predecessorId,
      type: "FS",
      lagDays: 2,
    });

    expect(response.status).toBe(201);
    expect(response.body).toEqual({
      task: expect.objectContaining({
        id: successorId,
        dependencies: [
          {
            predecessorId,
            type: "FS",
            lagDays: 2,
          },
        ],
      }),
    });
  });

  it("POST /api/tasks/:id/dependencies は存在しない依存先を拒否する", async () => {
    const createdProject = await request("POST", "/api/projects", {
      name: "案件DependencyValidation",
      contractor: "元請DependencyValidation",
      address: "東京都",
      status: "planning",
    });
    const projectId = (createdProject.body as { project: { id: string } }).project.id;
    const successor = await request("POST", `/api/projects/${projectId}/tasks`, {
      name: "後続",
      startDate: "2026-06-10",
      endDate: "2026-06-12",
      description: "",
    });
    const successorId = (successor.body as { task: { id: string } }).task.id;

    const response = await request("POST", `/api/tasks/${successorId}/dependencies`, {
      predecessorId: "missing-task",
      type: "FS",
      lagDays: 0,
    });

    expect(response).toEqual({
      status: 404,
      body: { error: "指定された依存先タスクが見つかりません。" },
    });
  });

  it("POST /api/tasks/:id/dependencies は不正な依存関係タイプに候補付きの日本語エラーを返す", async () => {
    const createdProject = await request("POST", "/api/projects", {
      name: "案件DependencyTypeValidation",
      contractor: "元請DependencyTypeValidation",
      address: "東京都",
      status: "planning",
    });
    const projectId = (createdProject.body as { project: { id: string } }).project.id;
    const successor = await request("POST", `/api/projects/${projectId}/tasks`, {
      name: "後続",
      startDate: "2026-06-10",
      endDate: "2026-06-12",
      description: "",
    });
    const successorId = (successor.body as { task: { id: string } }).task.id;

    const response = await request("POST", `/api/tasks/${successorId}/dependencies`, {
      predecessorId: "task-x",
      type: "INVALID",
      lagDays: 0,
    });

    expect(response).toEqual({
      status: 400,
      body: {
        error: "依存関係タイプは「FS」、「SS」、「FF」、「SF」のいずれかを指定してください。",
      },
    });
  });

  it("POST /api/projects/:id/tasks は未登録業者の contractorId を拒否する", async () => {
    const createdProject = await request("POST", "/api/projects", {
      name: "案件F-2",
      contractor: "元請F-2",
      address: "群馬県",
      status: "planning",
    });
    const projectId = (createdProject.body as { project: { id: string } }).project.id;

    const response = await request("POST", `/api/projects/${projectId}/tasks`, {
      name: "配線",
      startDate: "2026-06-05",
      endDate: "2026-06-06",
      contractorId: "missing-contractor",
      description: "",
    });

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      error: "指定された業者が見つかりません。",
    });
  });

  it("POST/GET /api/projects/:id/materials で資材を管理できる", async () => {
    const createdProject = await request("POST", "/api/projects", {
      name: "案件Materials",
      contractor: "元請Materials",
      address: "東京都",
      status: "active",
    });
    const projectId = (createdProject.body as { project: { id: string } }).project.id;

    const createdMaterial = await request("POST", `/api/projects/${projectId}/materials`, {
      name: "石膏ボード",
      quantity: 120,
      unit: "枚",
      unitPrice: 980,
      supplier: "建材商事",
      deliveryDate: "2026-06-20",
      status: "ordered",
    });
    const list = await request("GET", `/api/projects/${projectId}/materials`);

    expect(createdMaterial.status).toBe(201);
    expect(createdMaterial.body).toMatchObject({
      material: {
        projectId,
        name: "石膏ボード",
        quantity: 120,
        unit: "枚",
        unitPrice: 980,
        supplier: "建材商事",
        deliveryDate: "2026-06-20",
        status: "ordered",
        totalCost: 117600,
      },
    });
    expect(list.status).toBe(200);
    expect(list.body).toMatchObject({
      materials: [
        {
          name: "石膏ボード",
          totalCost: 117600,
        },
      ],
    });
  });

  it("POST/GET /api/projects/:id/changes で変更指示を管理できる", async () => {
    const createdProject = await request("POST", "/api/projects", {
      name: "案件Changes",
      contractor: "元請Changes",
      address: "東京都",
      status: "active",
    });
    const projectId = (createdProject.body as { project: { id: string } }).project.id;

    const createdChange = await request("POST", `/api/projects/${projectId}/changes`, {
      description: "厨房区画の追加下地",
      amount: 250000,
      approvedBy: "現場代理人 佐藤",
      date: "2026-06-18",
      status: "approved",
    });
    const list = await request("GET", `/api/projects/${projectId}/changes`);

    expect(createdChange.status).toBe(201);
    expect(createdChange.body).toMatchObject({
      change: {
        projectId,
        description: "厨房区画の追加下地",
        amount: 250000,
        approvedBy: "現場代理人 佐藤",
        date: "2026-06-18",
        status: "approved",
      },
    });
    expect(list.status).toBe(200);
    expect(list.body).toMatchObject({
      changes: [
        {
          description: "厨房区画の追加下地",
          amount: 250000,
        },
      ],
    });
  });

  it("GET /api/projects/:id/progress でタスク進捗から全体進捗を返す", async () => {
    const createdProject = await request("POST", "/api/projects", {
      name: "案件Progress",
      contractor: "元請Progress",
      address: "千葉県",
      status: "active",
    });
    const projectId = (createdProject.body as { project: { id: string } }).project.id;

    const taskA = await request("POST", `/api/projects/${projectId}/tasks`, {
      name: "墨出し",
      startDate: "2026-07-01",
      endDate: "2026-07-02",
      progress: 0,
      description: "",
    });
    const taskB = await request("POST", `/api/projects/${projectId}/tasks`, {
      name: "軽天",
      startDate: "2026-07-03",
      endDate: "2026-07-04",
      progress: 60,
      description: "",
    });
    const taskC = await request("POST", `/api/projects/${projectId}/tasks`, {
      name: "ボード",
      startDate: "2026-07-05",
      endDate: "2026-07-06",
      progress: 100,
      description: "",
    });

    expect(taskA.status).toBe(201);
    expect(taskB.status).toBe(201);
    expect(taskC.status).toBe(201);

    const response = await request("GET", `/api/projects/${projectId}/progress`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      projectId,
      overallProgress: 53,
      taskCount: 3,
    });
  });

  it("GET /api/projects/:id/cost-summary でタスク・資材・変更指示の原価を集計できる", async () => {
    const createdProject = await request("POST", "/api/projects", {
      name: "案件Cost",
      contractor: "元請Cost",
      address: "埼玉県",
      status: "active",
    });
    const projectId = (createdProject.body as { project: { id: string } }).project.id;

    await request("POST", `/api/projects/${projectId}/tasks`, {
      name: "解体",
      startDate: "2026-08-01",
      endDate: "2026-08-02",
      cost: 300000,
      description: "",
    });
    await request("POST", `/api/projects/${projectId}/tasks`, {
      name: "LGS",
      startDate: "2026-08-03",
      endDate: "2026-08-05",
      cost: 450000,
      description: "",
    });
    await request("POST", `/api/projects/${projectId}/materials`, {
      name: "スタッド",
      quantity: 200,
      unit: "本",
      unitPrice: 850,
      supplier: "建材センター",
      deliveryDate: "2026-08-02",
      status: "delivered",
    });
    await request("POST", `/api/projects/${projectId}/changes`, {
      description: "追加下地補強",
      amount: 120000,
      approvedBy: "工事部長",
      date: "2026-08-04",
      status: "approved",
    });
    await request("POST", `/api/projects/${projectId}/changes`, {
      description: "見切り変更",
      amount: 50000,
      approvedBy: "工事部長",
      date: "2026-08-05",
      status: "pending",
    });
    await request("POST", `/api/projects/${projectId}/changes`, {
      description: "減額調整",
      amount: -20000,
      approvedBy: "工事部長",
      date: "2026-08-06",
      status: "rejected",
    });

    const response = await request("GET", `/api/projects/${projectId}/cost-summary`);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      projectId,
      taskCost: 750000,
      materialCost: 170000,
      approvedChangeOrderCost: 120000,
      pendingChangeOrderCost: 50000,
      rejectedChangeOrderCost: -20000,
      totalCost: 1040000,
    });
  });

  it("GET /api/projects/:id/schedule-pdf で印刷用HTML工程表を返す", async () => {
    const createdProject = await request("POST", "/api/projects", {
      name: "案件Schedule",
      contractor: "元請Schedule",
      address: "東京都港区",
      status: "active",
    });
    const projectId = (createdProject.body as { project: { id: string } }).project.id;

    await request("POST", `/api/projects/${projectId}/tasks`, {
      name: "墨出し",
      startDate: "2026-09-01",
      endDate: "2026-09-02",
      contractor: "内装班A",
      progress: 100,
      description: "",
    });
    await request("POST", `/api/projects/${projectId}/tasks`, {
      name: "軽天",
      startDate: "2026-09-03",
      endDate: "2026-09-05",
      contractor: "軽鉄工事",
      progress: 40,
      description: "",
    });

    const response = await requestRaw("GET", `/api/projects/${projectId}/schedule-pdf`);

    expect(response.status).toBe(200);
    expect(response.headers["Content-Type"]).toBe("text/html; charset=utf-8");
    expect(response.body).toEqual(expect.any(String));
    expect(response.body).toContain("<html lang=\"ja\">");
    expect(response.body).toContain("案件Schedule 工程表");
    expect(response.body).toContain("工程一覧");
    expect(response.body).toContain("墨出し");
    expect(response.body).toContain("軽天");
    expect(response.body).toContain("内装班A");
    expect(response.body).toContain("40%");
  });

  it("GET /api/projects/:id/cost-report で日本語の印刷用原価レポートを返す", async () => {
    const createdProject = await request("POST", "/api/projects", {
      name: "案件Report",
      contractor: "元請Report",
      address: "神奈川県横浜市",
      status: "active",
    });
    const projectId = (createdProject.body as { project: { id: string } }).project.id;

    await request("POST", `/api/projects/${projectId}/tasks`, {
      name: "解体",
      startDate: "2026-10-01",
      endDate: "2026-10-02",
      contractor: "解体チーム",
      progress: 100,
      cost: 300000,
      description: "",
    });
    await request("POST", `/api/projects/${projectId}/materials`, {
      name: "石膏ボード",
      quantity: 50,
      unit: "枚",
      unitPrice: 1200,
      supplier: "建材商社",
      deliveryDate: "2026-10-03",
      status: "delivered",
    });
    await request("POST", `/api/projects/${projectId}/changes`, {
      description: "追加補強",
      amount: 50000,
      approvedBy: "工事部長",
      date: "2026-10-04",
      status: "approved",
    });
    await request("POST", `/api/projects/${projectId}/changes`, {
      description: "未承認変更",
      amount: 10000,
      approvedBy: "工事部長",
      date: "2026-10-05",
      status: "pending",
    });

    const response = await requestRaw("GET", `/api/projects/${projectId}/cost-report`);

    expect(response.status).toBe(200);
    expect(response.headers["Content-Type"]).toBe("text/html; charset=utf-8");
    expect(response.body).toEqual(expect.any(String));
    expect(response.body).toContain("案件Report 原価集計レポート");
    expect(response.body).toContain("タスク原価一覧");
    expect(response.body).toContain("資材原価一覧");
    expect(response.body).toContain("変更指示一覧");
    expect(response.body).toContain("小計");
    expect(response.body).toContain("消費税（10%）");
    expect(response.body).toContain("総合計");
    expect(response.body).toContain("￥410,000");
    expect(response.body).toContain("￥41,000");
    expect(response.body).toContain("￥451,000");
    expect(response.body).toContain("小計には承認済みの変更指示のみ含めています。");
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
