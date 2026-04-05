#!/usr/bin/env -S node --experimental-strip-types

import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { parseScheduleImportFile } from "./schedule-importer.js";

const PROJECT_STATUSES = ["planning", "active", "completed", "on_hold"] as const;
const TASK_STATUSES = ["todo", "in_progress", "done"] as const;
const DEFAULT_PORT = 3001;

export type ProjectStatus = (typeof PROJECT_STATUSES)[number];
export type TaskStatus = (typeof TASK_STATUSES)[number];

export type ApiProjectRecord = {
  id: string;
  createdAt: string;
  updatedAt: string;
  name: string;
  contractor: string;
  address: string;
  status: ProjectStatus;
  description: string;
  startDate: string;
  endDate?: string;
  includeWeekends: boolean;
};

export type ApiTaskRecord = {
  id: string;
  createdAt: string;
  updatedAt: string;
  projectId: string;
  name: string;
  description: string;
  status: TaskStatus;
  startDate?: string;
  dueDate?: string;
  progress: number;
  dependencies: string[];
  contractorId?: string;
  contractor?: string;
};

type DatabaseState = {
  projects: ApiProjectRecord[];
  tasks: ApiTaskRecord[];
};

type CreateProjectInput = Pick<ApiProjectRecord, "name" | "contractor" | "address" | "status">;
type CreateTaskInput = {
  name: string;
  startDate: string;
  endDate: string;
  contractorId?: string;
  contractor?: string;
  description: string;
};
type UpdateTaskInput = {
  status?: TaskStatus;
  startDate?: string | null;
  endDate?: string | null;
};

type UploadedFile = {
  fieldName: string;
  filename: string;
  contentType: string;
  buffer: Buffer;
};

type MultipartBody = {
  fields: Record<string, string>;
  files: UploadedFile[];
};

export interface ApiStore {
  listProjects(): Promise<ApiProjectRecord[]>;
  getProject(id: string): Promise<ApiProjectRecord | null>;
  createProject(input: CreateProjectInput): Promise<ApiProjectRecord>;
  listTasks(projectId: string): Promise<ApiTaskRecord[]>;
  getTask(id: string): Promise<ApiTaskRecord | null>;
  createTask(projectId: string, input: CreateTaskInput): Promise<ApiTaskRecord>;
  updateTask(id: string, input: UpdateTaskInput): Promise<ApiTaskRecord | null>;
  deleteTask(id: string): Promise<boolean>;
}

export type ApiResponse = {
  statusCode: number;
  body?: unknown;
};

export class ApiError extends Error {
  constructor(
    readonly statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

function createEmptyState(): DatabaseState {
  return { projects: [], tasks: [] };
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function parseDateString(value: string, fieldLabel: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new ApiError(400, `${fieldLabel}はYYYY-MM-DD形式で入力してください。`);
  }

  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || formatDate(date) !== value) {
    throw new ApiError(400, `${fieldLabel}が不正です。`);
  }

  return value;
}

function assertDateOrder(startDate: string, endDate: string): void {
  if (startDate > endDate) {
    throw new ApiError(400, "開始日は終了日以前の日付を指定してください。");
  }
}

function validateEnum<T extends readonly string[]>(
  value: unknown,
  allowed: T,
  fieldLabel: string,
): T[number] {
  if (typeof value !== "string" || !allowed.includes(value)) {
    throw new ApiError(400, `${fieldLabel}が不正です。`);
  }
  return value as T[number];
}

function requireString(
  input: Record<string, unknown>,
  fieldName: string,
  fieldLabel: string,
  maxLength: number,
): string {
  const value = input[fieldName];
  if (!isNonEmptyString(value)) {
    throw new ApiError(400, `${fieldLabel}は必須です。`);
  }

  const normalized = value.trim();
  if (normalized.length > maxLength) {
    throw new ApiError(400, `${fieldLabel}は${maxLength}文字以内で入力してください。`);
  }
  return normalized;
}

function optionalTrimmedString(
  input: Record<string, unknown>,
  fieldName: string,
  fieldLabel: string,
  maxLength: number,
): string | undefined {
  const value = input[fieldName];
  if (value === undefined || value === null || value === "") {
    return undefined;
  }
  if (typeof value !== "string") {
    throw new ApiError(400, `${fieldLabel}は文字列で入力してください。`);
  }
  const normalized = value.trim();
  if (!normalized) {
    throw new ApiError(400, `${fieldLabel}を空文字にはできません。`);
  }
  if (normalized.length > maxLength) {
    throw new ApiError(400, `${fieldLabel}は${maxLength}文字以内で入力してください。`);
  }
  return normalized;
}

function validateCreateProjectInput(payload: unknown): CreateProjectInput {
  if (!isObject(payload)) {
    throw new ApiError(400, "リクエストボディはJSONオブジェクトで送信してください。");
  }

  return {
    name: requireString(payload, "name", "プロジェクト名", 200),
    contractor: requireString(payload, "contractor", "元請会社名", 200),
    address: requireString(payload, "address", "住所", 500),
    status: validateEnum(payload.status, PROJECT_STATUSES, "ステータス"),
  };
}

function validateCreateTaskInput(payload: unknown): CreateTaskInput {
  if (!isObject(payload)) {
    throw new ApiError(400, "リクエストボディはJSONオブジェクトで送信してください。");
  }

  const startDate = parseDateString(
    requireString(payload, "startDate", "開始日", 10),
    "開始日",
  );
  const endDate = parseDateString(
    requireString(payload, "endDate", "終了日", 10),
    "終了日",
  );
  assertDateOrder(startDate, endDate);

  return {
    name: requireString(payload, "name", "タスク名", 200),
    startDate,
    endDate,
    contractorId: optionalTrimmedString(payload, "contractorId", "業者ID", 200),
    description:
      optionalTrimmedString(payload, "description", "説明", 2000) ?? "",
  };
}

function validateUpdateTaskInput(payload: unknown): UpdateTaskInput {
  if (!isObject(payload)) {
    throw new ApiError(400, "リクエストボディはJSONオブジェクトで送信してください。");
  }

  const update: UpdateTaskInput = {};

  if ("status" in payload) {
    update.status = validateEnum(payload.status, TASK_STATUSES, "ステータス");
  }
  if ("startDate" in payload) {
    if (payload.startDate === null) {
      update.startDate = null;
    } else if (typeof payload.startDate === "string") {
      update.startDate = parseDateString(payload.startDate.trim(), "開始日");
    } else {
      throw new ApiError(400, "開始日はYYYY-MM-DD形式で入力してください。");
    }
  }
  if ("endDate" in payload) {
    if (payload.endDate === null) {
      update.endDate = null;
    } else if (typeof payload.endDate === "string") {
      update.endDate = parseDateString(payload.endDate.trim(), "終了日");
    } else {
      throw new ApiError(400, "終了日はYYYY-MM-DD形式で入力してください。");
    }
  }

  if (Object.keys(update).length === 0) {
    throw new ApiError(400, "更新対象の項目を指定してください。");
  }

  return update;
}

function serializeProject(project: ApiProjectRecord) {
  return {
    id: project.id,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
    name: project.name,
    contractor: project.contractor,
    address: project.address,
    status: project.status,
    description: project.description,
    startDate: project.startDate,
    endDate: project.endDate ?? null,
    includeWeekends: project.includeWeekends,
  };
}

function serializeTask(task: ApiTaskRecord) {
  return {
    id: task.id,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
    projectId: task.projectId,
    name: task.name,
    description: task.description,
    status: task.status,
    startDate: task.startDate ?? null,
    endDate: task.dueDate ?? null,
    contractorId: task.contractorId ?? null,
    contractor: task.contractor ?? null,
  };
}

export class InMemoryApiStore implements ApiStore {
  private state: DatabaseState = createEmptyState();

  async listProjects(): Promise<ApiProjectRecord[]> {
    return clone(this.state.projects);
  }

  async getProject(id: string): Promise<ApiProjectRecord | null> {
    const project = this.state.projects.find((item) => item.id === id);
    return project ? clone(project) : null;
  }

  async createProject(input: CreateProjectInput): Promise<ApiProjectRecord> {
    const now = new Date();
    const project: ApiProjectRecord = {
      id: crypto.randomUUID(),
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      name: input.name,
      contractor: input.contractor,
      address: input.address,
      status: input.status,
      description: "",
      startDate: formatDate(now),
      includeWeekends: true,
    };
    this.state.projects.push(project);
    return clone(project);
  }

  async listTasks(projectId: string): Promise<ApiTaskRecord[]> {
    return clone(this.state.tasks.filter((task) => task.projectId === projectId));
  }

  async getTask(id: string): Promise<ApiTaskRecord | null> {
    const task = this.state.tasks.find((item) => item.id === id);
    return task ? clone(task) : null;
  }

  async createTask(projectId: string, input: CreateTaskInput): Promise<ApiTaskRecord> {
    const now = new Date();
    const task: ApiTaskRecord = {
      id: crypto.randomUUID(),
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      projectId,
      name: input.name,
      description: input.description,
      status: "todo",
      startDate: input.startDate,
      dueDate: input.endDate,
      progress: 0,
      dependencies: [],
      contractorId: input.contractorId,
      contractor: input.contractor,
    };
    this.state.tasks.push(task);
    return clone(task);
  }

  async updateTask(id: string, input: UpdateTaskInput): Promise<ApiTaskRecord | null> {
    const index = this.state.tasks.findIndex((item) => item.id === id);
    if (index === -1) {
      return null;
    }

    const existing = this.state.tasks[index];
    const updated: ApiTaskRecord = {
      ...existing,
      updatedAt: new Date().toISOString(),
      ...(input.status ? { status: input.status } : {}),
      ...(input.startDate !== undefined
        ? { startDate: input.startDate ?? undefined }
        : {}),
      ...(input.endDate !== undefined
        ? { dueDate: input.endDate ?? undefined }
        : {}),
    };
    this.state.tasks[index] = updated;
    return clone(updated);
  }

  async deleteTask(id: string): Promise<boolean> {
    const previousLength = this.state.tasks.length;
    this.state.tasks = this.state.tasks.filter((item) => item.id !== id);
    return this.state.tasks.length !== previousLength;
  }
}

export class JsonFileApiStore implements ApiStore {
  private operationQueue = Promise.resolve();

  constructor(private readonly filePath: string) {}

  private enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const next = this.operationQueue.then(operation, operation);
    this.operationQueue = next.then(
      () => undefined,
      () => undefined,
    );
    return next;
  }

  private async readState(): Promise<DatabaseState> {
    try {
      const raw = await readFile(this.filePath, "utf8");
      const parsed = JSON.parse(raw) as Partial<DatabaseState>;
      return {
        projects: Array.isArray(parsed.projects) ? parsed.projects : [],
        tasks: Array.isArray(parsed.tasks) ? parsed.tasks : [],
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return createEmptyState();
      }
      throw error;
    }
  }

  private async writeState(state: DatabaseState): Promise<void> {
    await mkdir(dirname(this.filePath), { recursive: true });
    await writeFile(this.filePath, JSON.stringify(state, null, 2), "utf8");
  }

  async listProjects(): Promise<ApiProjectRecord[]> {
    return this.enqueue(async () => clone((await this.readState()).projects));
  }

  async getProject(id: string): Promise<ApiProjectRecord | null> {
    return this.enqueue(async () => {
      const project = (await this.readState()).projects.find((item) => item.id === id);
      return project ? clone(project) : null;
    });
  }

  async createProject(input: CreateProjectInput): Promise<ApiProjectRecord> {
    return this.enqueue(async () => {
      const state = await this.readState();
      const now = new Date();
      const project: ApiProjectRecord = {
        id: crypto.randomUUID(),
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
        name: input.name,
        contractor: input.contractor,
        address: input.address,
        status: input.status,
        description: "",
        startDate: formatDate(now),
        includeWeekends: true,
      };
      state.projects.push(project);
      await this.writeState(state);
      return clone(project);
    });
  }

  async listTasks(projectId: string): Promise<ApiTaskRecord[]> {
    return this.enqueue(async () =>
      clone((await this.readState()).tasks.filter((item) => item.projectId === projectId)),
    );
  }

  async getTask(id: string): Promise<ApiTaskRecord | null> {
    return this.enqueue(async () => {
      const task = (await this.readState()).tasks.find((item) => item.id === id);
      return task ? clone(task) : null;
    });
  }

  async createTask(projectId: string, input: CreateTaskInput): Promise<ApiTaskRecord> {
    return this.enqueue(async () => {
      const state = await this.readState();
      const now = new Date();
      const task: ApiTaskRecord = {
        id: crypto.randomUUID(),
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
        projectId,
        name: input.name,
        description: input.description,
        status: "todo",
        startDate: input.startDate,
        dueDate: input.endDate,
      progress: 0,
      dependencies: [],
      contractorId: input.contractorId,
      contractor: input.contractor,
    };
      state.tasks.push(task);
      await this.writeState(state);
      return clone(task);
    });
  }

  async updateTask(id: string, input: UpdateTaskInput): Promise<ApiTaskRecord | null> {
    return this.enqueue(async () => {
      const state = await this.readState();
      const index = state.tasks.findIndex((item) => item.id === id);
      if (index === -1) {
        return null;
      }

      const existing = state.tasks[index];
      const updated: ApiTaskRecord = {
        ...existing,
        updatedAt: new Date().toISOString(),
        ...(input.status ? { status: input.status } : {}),
        ...(input.startDate !== undefined
          ? { startDate: input.startDate ?? undefined }
          : {}),
        ...(input.endDate !== undefined
          ? { dueDate: input.endDate ?? undefined }
          : {}),
      };
      state.tasks[index] = updated;
      await this.writeState(state);
      return clone(updated);
    });
  }

  async deleteTask(id: string): Promise<boolean> {
    return this.enqueue(async () => {
      const state = await this.readState();
      const previousLength = state.tasks.length;
      state.tasks = state.tasks.filter((item) => item.id !== id);
      if (state.tasks.length === previousLength) {
        return false;
      }
      await this.writeState(state);
      return true;
    });
  }
}

async function readRawBody(request: IncomingMessage): Promise<Buffer> {
  const chunks: Uint8Array[] = [];

  for await (const chunk of request) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }

  if (chunks.length === 0) {
    return Buffer.alloc(0);
  }

  return Buffer.concat(chunks);
}

async function readJsonBody(request: IncomingMessage): Promise<unknown> {
  const rawBody = (await readRawBody(request)).toString("utf8");
  if (!rawBody) {
    return {};
  }

  try {
    return JSON.parse(rawBody);
  } catch {
    throw new ApiError(400, "JSON形式のリクエストボディを送信してください。");
  }
}

async function readMultipartBody(
  request: IncomingMessage,
  contentType: string,
): Promise<MultipartBody> {
  const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
  const boundary = boundaryMatch?.[1] ?? boundaryMatch?.[2];
  if (!boundary) {
    throw new ApiError(400, "multipart/form-data のboundaryが不正です。");
  }

  return parseMultipartBody(await readRawBody(request), boundary);
}

export function parseMultipartBody(body: Buffer, boundary: string): MultipartBody {
  const boundaryBuffer = Buffer.from(`--${boundary}`);
  const headerSeparator = Buffer.from("\r\n\r\n");
  const fields: Record<string, string> = {};
  const files: UploadedFile[] = [];
  let searchOffset = 0;

  while (searchOffset < body.length) {
    const boundaryIndex = body.indexOf(boundaryBuffer, searchOffset);
    if (boundaryIndex === -1) {
      break;
    }

    let cursor = boundaryIndex + boundaryBuffer.length;
    const isFinalBoundary = body[cursor] === 45 && body[cursor + 1] === 45;
    if (isFinalBoundary) {
      break;
    }

    if (body[cursor] === 13 && body[cursor + 1] === 10) {
      cursor += 2;
    }

    const headerEnd = body.indexOf(headerSeparator, cursor);
    if (headerEnd === -1) {
      throw new ApiError(400, "multipart/form-data のヘッダー解析に失敗しました。");
    }

    const headers = parseMultipartHeaders(body.toString("utf8", cursor, headerEnd));
    const contentStart = headerEnd + headerSeparator.length;
    const nextBoundaryIndex = body.indexOf(boundaryBuffer, contentStart);
    if (nextBoundaryIndex === -1) {
      throw new ApiError(400, "multipart/form-data の本文解析に失敗しました。");
    }

    const contentEnd =
      body[nextBoundaryIndex - 2] === 13 && body[nextBoundaryIndex - 1] === 10
        ? nextBoundaryIndex - 2
        : nextBoundaryIndex;
    const content = body.subarray(contentStart, contentEnd);
    const disposition = parseContentDisposition(headers["content-disposition"]);

    if (disposition.filename) {
      files.push({
        fieldName: disposition.name,
        filename: disposition.filename,
        contentType: headers["content-type"] ?? "application/octet-stream",
        buffer: Buffer.from(content),
      });
    } else {
      fields[disposition.name] = content.toString("utf8");
    }

    searchOffset = nextBoundaryIndex;
  }

  return { fields, files };
}

function parseMultipartHeaders(source: string): Record<string, string> {
  const headers: Record<string, string> = {};

  for (const line of source.split("\r\n")) {
    const separatorIndex = line.indexOf(":");
    if (separatorIndex === -1) {
      continue;
    }
    const key = line.slice(0, separatorIndex).trim().toLowerCase();
    const value = line.slice(separatorIndex + 1).trim();
    headers[key] = value;
  }

  return headers;
}

function parseContentDisposition(value: string | undefined): {
  name: string;
  filename?: string;
} {
  if (!value) {
    throw new ApiError(400, "multipart/form-data のContent-Dispositionが不足しています。");
  }

  const nameMatch = value.match(/\bname="([^"]+)"/i);
  if (!nameMatch) {
    throw new ApiError(400, "multipart/form-data のnameが不足しています。");
  }

  const filenameMatch = value.match(/\bfilename="([^"]*)"/i);
  return {
    name: nameMatch[1],
    ...(filenameMatch?.[1] ? { filename: filenameMatch[1] } : {}),
  };
}

function requireMultipartFile(payload: unknown): UploadedFile {
  if (!isObject(payload) || !Array.isArray(payload.files)) {
    throw new ApiError(400, "アップロードファイルを指定してください。");
  }

  const file = payload.files.find((item): item is UploadedFile =>
    isObject(item) &&
    typeof item.filename === "string" &&
    item.buffer instanceof Buffer,
  );

  if (!file) {
    throw new ApiError(400, "アップロードファイルを指定してください。");
  }

  return file;
}

function sendJson(response: ServerResponse, statusCode: number, body: unknown): void {
  response.statusCode = statusCode;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.end(JSON.stringify(body));
}

function setCorsHeaders(response: ServerResponse): void {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type");
  response.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,DELETE,OPTIONS");
}

export async function handleApiRequest(
  request: {
    method?: string;
    url?: string;
    body?: unknown;
  },
  store: ApiStore,
): Promise<ApiResponse> {
  const url = new URL(request.url ?? "/", "http://127.0.0.1");
  const { pathname } = url;

  if (request.method === "OPTIONS") {
    return { statusCode: 204 };
  }

  if (request.method === "GET" && pathname === "/api/projects") {
    return {
      statusCode: 200,
      body: { projects: (await store.listProjects()).map(serializeProject) },
    };
  }

  if (request.method === "POST" && pathname === "/api/projects") {
    const input = validateCreateProjectInput(request.body ?? {});
    const project = await store.createProject(input);
    return {
      statusCode: 201,
      body: { project: serializeProject(project) },
    };
  }

  const projectMatch = pathname.match(/^\/api\/projects\/([^/]+)$/);
  if (request.method === "GET" && projectMatch) {
    const project = await store.getProject(decodeURIComponent(projectMatch[1]));
    if (!project) {
      throw new ApiError(404, "指定されたプロジェクトが見つかりません。");
    }
    return {
      statusCode: 200,
      body: { project: serializeProject(project) },
    };
  }

  const projectTasksMatch = pathname.match(/^\/api\/projects\/([^/]+)\/tasks$/);
  if (projectTasksMatch) {
    const projectId = decodeURIComponent(projectTasksMatch[1]);
    const project = await store.getProject(projectId);
    if (!project) {
      throw new ApiError(404, "指定されたプロジェクトが見つかりません。");
    }

    if (request.method === "GET") {
      return {
        statusCode: 200,
        body: { tasks: (await store.listTasks(projectId)).map(serializeTask) },
      };
    }

    if (request.method === "POST") {
      const input = validateCreateTaskInput(request.body ?? {});
      const task = await store.createTask(projectId, input);
      return {
        statusCode: 201,
        body: { task: serializeTask(task) },
      };
    }
  }

  const projectImportMatch = pathname.match(/^\/api\/projects\/([^/]+)\/import$/);
  if (request.method === "POST" && projectImportMatch) {
    const projectId = decodeURIComponent(projectImportMatch[1]);
    const project = await store.getProject(projectId);
    if (!project) {
      throw new ApiError(404, "指定されたプロジェクトが見つかりません。");
    }

    const uploadedFile = requireMultipartFile(request.body ?? {});
    const importedTasks = parseScheduleImportFile({
      buffer: uploadedFile.buffer,
      filename: uploadedFile.filename,
    });

    const createdTasks = await Promise.all(
      importedTasks.map((task) =>
        store.createTask(projectId, {
          name: task.name,
          startDate: task.startDate,
          endDate: task.endDate,
          contractor: task.contractor,
          description: task.description ?? "",
        }),
      ),
    );

    return {
      statusCode: 201,
      body: {
        tasks: createdTasks.map(serializeTask),
      },
    };
  }

  const taskMatch = pathname.match(/^\/api\/tasks\/([^/]+)$/);
  if (taskMatch) {
    const taskId = decodeURIComponent(taskMatch[1]);

    if (request.method === "PATCH") {
      const existing = await store.getTask(taskId);
      if (!existing) {
        throw new ApiError(404, "指定されたタスクが見つかりません。");
      }

      const input = validateUpdateTaskInput(request.body ?? {});
      const nextStartDate =
        input.startDate === undefined
          ? existing.startDate
          : (input.startDate ?? undefined);
      const nextEndDate =
        input.endDate === undefined
          ? existing.dueDate
          : (input.endDate ?? undefined);

      if (nextStartDate && nextEndDate) {
        assertDateOrder(nextStartDate, nextEndDate);
      }

      const task = await store.updateTask(taskId, input);
      if (!task) {
        throw new ApiError(404, "指定されたタスクが見つかりません。");
      }
      return {
        statusCode: 200,
        body: { task: serializeTask(task) },
      };
    }

    if (request.method === "DELETE") {
      const deleted = await store.deleteTask(taskId);
      if (!deleted) {
        throw new ApiError(404, "指定されたタスクが見つかりません。");
      }
      return { statusCode: 204 };
    }
  }

  throw new ApiError(404, "指定されたエンドポイントが見つかりません。");
}

async function handleRequest(
  request: IncomingMessage,
  response: ServerResponse,
  store: ApiStore,
): Promise<void> {
  setCorsHeaders(response);
  const shouldReadBody = request.method === "POST" || request.method === "PATCH";
  const contentType = request.headers["content-type"] ?? "";
  const result = await handleApiRequest(
    {
      method: request.method,
      url: request.url,
      body: shouldReadBody
        ? contentType.startsWith("multipart/form-data")
          ? await readMultipartBody(request, contentType)
          : await readJsonBody(request)
        : undefined,
    },
    store,
  );

  if (result.statusCode === 204) {
    response.statusCode = 204;
    response.end();
    return;
  }

  sendJson(response, result.statusCode, result.body ?? {});
}

export function createApiServer(options: {
  store?: ApiStore;
  dataFilePath?: string;
} = {}): Server {
  const store =
    options.store ??
    new JsonFileApiStore(
      options.dataFilePath ??
        process.env.GENBAHUB_API_DB_FILE ??
        resolve(process.cwd(), ".genbahub-api-db.json"),
    );

  return createServer(async (request, response) => {
    try {
      await handleRequest(request, response, store);
    } catch (error) {
      if (error instanceof ApiError) {
        sendJson(response, error.statusCode, { error: error.message });
        return;
      }

      console.error(error);
      sendJson(response, 500, { error: "サーバー内部でエラーが発生しました。" });
    }
  });
}

export function startApiServer(options: {
  port?: number;
  dataFilePath?: string;
  store?: ApiStore;
} = {}): Server {
  const port = options.port ?? Number(process.env.PORT ?? DEFAULT_PORT);
  const server = createApiServer(options);
  server.listen(port, () => {
    console.log(`GenbaHub API server listening on http://127.0.0.1:${port}`);
  });
  return server;
}

if (import.meta.url === new URL(process.argv[1] ?? "", "file:").href) {
  startApiServer();
}
