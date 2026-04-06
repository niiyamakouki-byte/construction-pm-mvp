#!/usr/bin/env -S node --experimental-strip-types

import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { parseScheduleImportFile } from "./schedule-importer.js";

const PROJECT_STATUSES = ["planning", "active", "completed", "on_hold"] as const;
const TASK_STATUSES = ["todo", "in_progress", "done"] as const;
const MATERIAL_STATUSES = ["ordered", "delivered", "installed"] as const;
const CHANGE_ORDER_STATUSES = ["pending", "approved", "rejected"] as const;
const DEFAULT_PORT = 3001;

export type ProjectStatus = (typeof PROJECT_STATUSES)[number];
export type TaskStatus = (typeof TASK_STATUSES)[number];
export type MaterialStatus = (typeof MATERIAL_STATUSES)[number];
export type ChangeOrderStatus = (typeof CHANGE_ORDER_STATUSES)[number];

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
  cost: number;
  dependencies: string[];
  contractorId?: string;
  contractor?: string;
};

export type ApiContractorRecord = {
  id: string;
  createdAt: string;
  updatedAt: string;
  name: string;
  trade: string;
  phone: string;
  email: string;
};

export type ApiMaterialRecord = {
  id: string;
  createdAt: string;
  updatedAt: string;
  projectId: string;
  name: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  supplier: string;
  deliveryDate: string;
  status: MaterialStatus;
};

export type ApiChangeOrderRecord = {
  id: string;
  createdAt: string;
  updatedAt: string;
  projectId: string;
  description: string;
  amount: number;
  approvedBy: string;
  date: string;
  status: ChangeOrderStatus;
};

type DatabaseState = {
  projects: ApiProjectRecord[];
  tasks: ApiTaskRecord[];
  contractors: ApiContractorRecord[];
  materials: ApiMaterialRecord[];
  changeOrders: ApiChangeOrderRecord[];
};

type CreateProjectInput = Pick<ApiProjectRecord, "name" | "contractor" | "address" | "status">;
type CreateTaskInput = {
  name: string;
  startDate: string;
  endDate: string;
  progress?: number;
  cost?: number;
  contractorId?: string;
  contractor?: string;
  description: string;
};
type CreateContractorInput = Pick<ApiContractorRecord, "name" | "trade" | "phone" | "email">;
type CreateMaterialInput = Pick<
  ApiMaterialRecord,
  "name" | "quantity" | "unit" | "unitPrice" | "supplier" | "deliveryDate" | "status"
>;
type CreateChangeOrderInput = Pick<
  ApiChangeOrderRecord,
  "description" | "amount" | "approvedBy" | "date" | "status"
>;
type UpdateProjectInput = {
  name?: string;
  contractor?: string;
  address?: string;
  status?: ProjectStatus;
  description?: string;
  startDate?: string;
  endDate?: string | null;
};
type UpdateTaskInput = {
  status?: TaskStatus;
  startDate?: string | null;
  endDate?: string | null;
  projectId?: string;
  contractorId?: string | null;
  contractor?: string | null;
  progress?: number;
  cost?: number;
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
  updateProject(id: string, input: UpdateProjectInput): Promise<ApiProjectRecord | null>;
  deleteProject(id: string): Promise<boolean>;
  listContractors(): Promise<ApiContractorRecord[]>;
  getContractor(id: string): Promise<ApiContractorRecord | null>;
  createContractor(input: CreateContractorInput): Promise<ApiContractorRecord>;
  listTasks(projectId: string): Promise<ApiTaskRecord[]>;
  getTask(id: string): Promise<ApiTaskRecord | null>;
  createTask(projectId: string, input: CreateTaskInput): Promise<ApiTaskRecord>;
  updateTask(id: string, input: UpdateTaskInput): Promise<ApiTaskRecord | null>;
  deleteTask(id: string): Promise<boolean>;
  listMaterials(projectId: string): Promise<ApiMaterialRecord[]>;
  createMaterial(projectId: string, input: CreateMaterialInput): Promise<ApiMaterialRecord>;
  listChangeOrders(projectId: string): Promise<ApiChangeOrderRecord[]>;
  createChangeOrder(projectId: string, input: CreateChangeOrderInput): Promise<ApiChangeOrderRecord>;
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
  return {
    projects: [],
    tasks: [],
    contractors: [],
    materials: [],
    changeOrders: [],
  };
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

function optionalUpdatedString(
  input: Record<string, unknown>,
  fieldName: string,
  fieldLabel: string,
  maxLength: number,
  options: { allowEmpty?: boolean } = {},
): string | undefined {
  if (!(fieldName in input)) {
    return undefined;
  }

  const value = input[fieldName];
  if (typeof value !== "string") {
    throw new ApiError(400, `${fieldLabel}は文字列で入力してください。`);
  }

  const normalized = value.trim();
  if (!options.allowEmpty && !normalized) {
    throw new ApiError(400, `${fieldLabel}を空文字にはできません。`);
  }
  if (normalized.length > maxLength) {
    throw new ApiError(400, `${fieldLabel}は${maxLength}文字以内で入力してください。`);
  }
  return normalized;
}

function requireStringFromAliases(
  input: Record<string, unknown>,
  fieldNames: string[],
  fieldLabel: string,
  maxLength: number,
): string {
  for (const fieldName of fieldNames) {
    if (fieldName in input) {
      return requireString(input, fieldName, fieldLabel, maxLength);
    }
  }

  throw new ApiError(400, `${fieldLabel}は必須です。`);
}

function parseNumericValue(
  value: unknown,
  fieldLabel: string,
  options: { min?: number; max?: number; integer?: boolean } = {},
): number {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim() !== ""
        ? Number(value)
        : Number.NaN;

  if (!Number.isFinite(parsed)) {
    throw new ApiError(400, `${fieldLabel}は数値で入力してください。`);
  }
  if (options.integer && !Number.isInteger(parsed)) {
    throw new ApiError(400, `${fieldLabel}は整数で入力してください。`);
  }
  if (options.min !== undefined && parsed < options.min) {
    throw new ApiError(400, `${fieldLabel}は${options.min}以上で入力してください。`);
  }
  if (options.max !== undefined && parsed > options.max) {
    throw new ApiError(400, `${fieldLabel}は${options.max}以下で入力してください。`);
  }

  return parsed;
}

function optionalUpdatedNullableString(
  input: Record<string, unknown>,
  fieldName: string,
  fieldLabel: string,
  maxLength: number,
): string | null | undefined {
  if (!(fieldName in input)) {
    return undefined;
  }

  if (input[fieldName] === null) {
    return null;
  }

  return optionalUpdatedString(input, fieldName, fieldLabel, maxLength);
}

function optionalUpdatedNumber(
  input: Record<string, unknown>,
  fieldName: string,
  fieldLabel: string,
  options: { min?: number; max?: number; integer?: boolean } = {},
): number | undefined {
  if (!(fieldName in input)) {
    return undefined;
  }

  return parseNumericValue(input[fieldName], fieldLabel, options);
}

function validateEmail(value: string, fieldLabel: string): string {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    throw new ApiError(400, `${fieldLabel}の形式が不正です。`);
  }

  return value;
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

function validateUpdateProjectInput(payload: unknown): UpdateProjectInput {
  if (!isObject(payload)) {
    throw new ApiError(400, "リクエストボディはJSONオブジェクトで送信してください。");
  }

  const update: UpdateProjectInput = {};

  if ("name" in payload) {
    update.name = optionalUpdatedString(payload, "name", "プロジェクト名", 200);
  }
  if ("contractor" in payload) {
    update.contractor = optionalUpdatedString(payload, "contractor", "元請会社名", 200);
  }
  if ("address" in payload) {
    update.address = optionalUpdatedString(payload, "address", "住所", 500);
  }
  if ("status" in payload) {
    update.status = validateEnum(payload.status, PROJECT_STATUSES, "ステータス");
  }
  if ("description" in payload) {
    update.description = optionalUpdatedString(payload, "description", "説明", 2000, {
      allowEmpty: true,
    });
  }
  if ("startDate" in payload) {
    if (typeof payload.startDate !== "string") {
      throw new ApiError(400, "開始日はYYYY-MM-DD形式で入力してください。");
    }
    update.startDate = parseDateString(payload.startDate.trim(), "開始日");
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
    progress:
      "progress" in payload
        ? parseNumericValue(payload.progress, "進捗率", { min: 0, max: 100, integer: true })
        : undefined,
    cost:
      "cost" in payload
        ? parseNumericValue(payload.cost, "タスク原価", { min: 0 })
        : undefined,
    contractorId: optionalTrimmedString(payload, "contractorId", "業者ID", 200),
    description:
      optionalTrimmedString(payload, "description", "説明", 2000) ?? "",
  };
}

function validateCreateContractorInput(payload: unknown): CreateContractorInput {
  if (!isObject(payload)) {
    throw new ApiError(400, "リクエストボディはJSONオブジェクトで送信してください。");
  }

  return {
    name: requireString(payload, "name", "業者名", 200),
    trade: requireStringFromAliases(payload, ["trade", "職種"], "職種", 100),
    phone: requireString(payload, "phone", "電話番号", 50),
    email: validateEmail(requireString(payload, "email", "メールアドレス", 200), "メールアドレス"),
  };
}

function validateCreateMaterialInput(payload: unknown): CreateMaterialInput {
  if (!isObject(payload)) {
    throw new ApiError(400, "リクエストボディはJSONオブジェクトで送信してください。");
  }

  return {
    name: requireString(payload, "name", "資材名", 200),
    quantity: parseNumericValue(payload.quantity, "数量", { min: 0 }),
    unit: requireString(payload, "unit", "単位", 50),
    unitPrice: parseNumericValue(payload.unitPrice, "単価", { min: 0 }),
    supplier: requireString(payload, "supplier", "仕入先", 200),
    deliveryDate: parseDateString(
      requireString(payload, "deliveryDate", "納品日", 10),
      "納品日",
    ),
    status: validateEnum(payload.status, MATERIAL_STATUSES, "資材ステータス"),
  };
}

function validateCreateChangeOrderInput(payload: unknown): CreateChangeOrderInput {
  if (!isObject(payload)) {
    throw new ApiError(400, "リクエストボディはJSONオブジェクトで送信してください。");
  }

  return {
    description: requireString(payload, "description", "変更内容", 2000),
    amount: parseNumericValue(payload.amount, "金額"),
    approvedBy: requireString(payload, "approvedBy", "承認者", 200),
    date: parseDateString(requireString(payload, "date", "日付", 10), "日付"),
    status: validateEnum(payload.status, CHANGE_ORDER_STATUSES, "変更指示ステータス"),
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
  if ("projectId" in payload) {
    update.projectId = optionalUpdatedString(payload, "projectId", "プロジェクトID", 200);
  }
  if ("contractorId" in payload) {
    update.contractorId = optionalUpdatedNullableString(payload, "contractorId", "業者ID", 200);
  }
  if ("progress" in payload) {
    update.progress = optionalUpdatedNumber(payload, "progress", "進捗率", {
      min: 0,
      max: 100,
      integer: true,
    });
  }
  if ("cost" in payload) {
    update.cost = optionalUpdatedNumber(payload, "cost", "タスク原価", {
      min: 0,
    });
  }

  if (Object.keys(update).length === 0) {
    throw new ApiError(400, "更新対象の項目を指定してください。");
  }

  return update;
}

function serializeProject(project: ApiProjectRecord, taskCount?: number) {
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
    ...(taskCount !== undefined ? { taskCount } : {}),
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
    progress: task.progress,
    cost: task.cost,
    contractorId: task.contractorId ?? null,
    contractor: task.contractor ?? null,
  };
}

function serializeContractor(contractor: ApiContractorRecord) {
  return {
    id: contractor.id,
    createdAt: contractor.createdAt,
    updatedAt: contractor.updatedAt,
    name: contractor.name,
    trade: contractor.trade,
    phone: contractor.phone,
    email: contractor.email,
  };
}

function serializeMaterial(material: ApiMaterialRecord) {
  return {
    id: material.id,
    createdAt: material.createdAt,
    updatedAt: material.updatedAt,
    projectId: material.projectId,
    name: material.name,
    quantity: material.quantity,
    unit: material.unit,
    unitPrice: material.unitPrice,
    supplier: material.supplier,
    deliveryDate: material.deliveryDate,
    status: material.status,
    totalCost: material.quantity * material.unitPrice,
  };
}

function serializeChangeOrder(changeOrder: ApiChangeOrderRecord) {
  return {
    id: changeOrder.id,
    createdAt: changeOrder.createdAt,
    updatedAt: changeOrder.updatedAt,
    projectId: changeOrder.projectId,
    description: changeOrder.description,
    amount: changeOrder.amount,
    approvedBy: changeOrder.approvedBy,
    date: changeOrder.date,
    status: changeOrder.status,
  };
}

function calculateProjectProgress(tasks: ApiTaskRecord[]): number {
  if (tasks.length === 0) {
    return 0;
  }

  const totalProgress = tasks.reduce((sum, task) => sum + task.progress, 0);
  return Math.round(totalProgress / tasks.length);
}

function calculateCostSummary(
  tasks: ApiTaskRecord[],
  materials: ApiMaterialRecord[],
  changeOrders: ApiChangeOrderRecord[],
) {
  const taskCost = tasks.reduce((sum, task) => sum + task.cost, 0);
  const materialCost = materials.reduce(
    (sum, material) => sum + material.quantity * material.unitPrice,
    0,
  );
  const approvedChangeOrderCost = changeOrders
    .filter((changeOrder) => changeOrder.status === "approved")
    .reduce((sum, changeOrder) => sum + changeOrder.amount, 0);
  const pendingChangeOrderCost = changeOrders
    .filter((changeOrder) => changeOrder.status === "pending")
    .reduce((sum, changeOrder) => sum + changeOrder.amount, 0);
  const rejectedChangeOrderCost = changeOrders
    .filter((changeOrder) => changeOrder.status === "rejected")
    .reduce((sum, changeOrder) => sum + changeOrder.amount, 0);

  return {
    taskCost,
    materialCost,
    approvedChangeOrderCost,
    pendingChangeOrderCost,
    rejectedChangeOrderCost,
    totalCost: taskCost + materialCost + approvedChangeOrderCost,
  };
}

function normalizeProjectRecord(project: ApiProjectRecord): ApiProjectRecord {
  return {
    ...project,
    description: project.description ?? "",
    startDate: project.startDate ?? formatDate(new Date(project.createdAt ?? Date.now())),
    includeWeekends: project.includeWeekends ?? true,
  };
}

function normalizeTaskRecord(task: ApiTaskRecord): ApiTaskRecord {
  return {
    ...task,
    description: task.description ?? "",
    progress: typeof task.progress === "number" ? task.progress : 0,
    cost: typeof task.cost === "number" ? task.cost : 0,
    dependencies: Array.isArray(task.dependencies) ? task.dependencies : [],
  };
}

function normalizeState(parsed: Partial<DatabaseState>): DatabaseState {
  return {
    projects: Array.isArray(parsed.projects)
      ? parsed.projects.map((project) => normalizeProjectRecord(project as ApiProjectRecord))
      : [],
    tasks: Array.isArray(parsed.tasks)
      ? parsed.tasks.map((task) => normalizeTaskRecord(task as ApiTaskRecord))
      : [],
    contractors: Array.isArray(parsed.contractors)
      ? parsed.contractors.map((contractor) => contractor as ApiContractorRecord)
      : [],
    materials: Array.isArray(parsed.materials)
      ? parsed.materials.map((material) => material as ApiMaterialRecord)
      : [],
    changeOrders: Array.isArray(parsed.changeOrders)
      ? parsed.changeOrders.map((changeOrder) => changeOrder as ApiChangeOrderRecord)
      : [],
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

  async updateProject(id: string, input: UpdateProjectInput): Promise<ApiProjectRecord | null> {
    const index = this.state.projects.findIndex((item) => item.id === id);
    if (index === -1) {
      return null;
    }

    const existing = this.state.projects[index];
    const updated: ApiProjectRecord = {
      ...existing,
      updatedAt: new Date().toISOString(),
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.contractor !== undefined ? { contractor: input.contractor } : {}),
      ...(input.address !== undefined ? { address: input.address } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.startDate !== undefined ? { startDate: input.startDate } : {}),
      ...(input.endDate !== undefined
        ? { endDate: input.endDate ?? undefined }
        : {}),
    };
    this.state.projects[index] = updated;
    return clone(updated);
  }

  async deleteProject(id: string): Promise<boolean> {
    const previousLength = this.state.projects.length;
    this.state.projects = this.state.projects.filter((item) => item.id !== id);
    if (this.state.projects.length === previousLength) {
      return false;
    }
    this.state.tasks = this.state.tasks.filter((task) => task.projectId !== id);
    this.state.materials = this.state.materials.filter((material) => material.projectId !== id);
    this.state.changeOrders = this.state.changeOrders.filter((changeOrder) => changeOrder.projectId !== id);
    return true;
  }

  async listContractors(): Promise<ApiContractorRecord[]> {
    return clone(this.state.contractors);
  }

  async getContractor(id: string): Promise<ApiContractorRecord | null> {
    const contractor = this.state.contractors.find((item) => item.id === id);
    return contractor ? clone(contractor) : null;
  }

  async createContractor(input: CreateContractorInput): Promise<ApiContractorRecord> {
    const now = new Date();
    const contractor: ApiContractorRecord = {
      id: crypto.randomUUID(),
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      name: input.name,
      trade: input.trade,
      phone: input.phone,
      email: input.email,
    };
    this.state.contractors.push(contractor);
    return clone(contractor);
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
      progress: input.progress ?? 0,
      cost: input.cost ?? 0,
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
      ...(input.projectId !== undefined ? { projectId: input.projectId } : {}),
      ...(input.contractorId !== undefined
        ? { contractorId: input.contractorId ?? undefined }
        : {}),
      ...(input.contractor !== undefined
        ? { contractor: input.contractor ?? undefined }
        : {}),
      ...(input.progress !== undefined ? { progress: input.progress } : {}),
      ...(input.cost !== undefined ? { cost: input.cost } : {}),
    };
    this.state.tasks[index] = updated;
    return clone(updated);
  }

  async deleteTask(id: string): Promise<boolean> {
    const previousLength = this.state.tasks.length;
    this.state.tasks = this.state.tasks.filter((item) => item.id !== id);
    return this.state.tasks.length !== previousLength;
  }

  async listMaterials(projectId: string): Promise<ApiMaterialRecord[]> {
    return clone(this.state.materials.filter((material) => material.projectId === projectId));
  }

  async createMaterial(projectId: string, input: CreateMaterialInput): Promise<ApiMaterialRecord> {
    const now = new Date();
    const material: ApiMaterialRecord = {
      id: crypto.randomUUID(),
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      projectId,
      name: input.name,
      quantity: input.quantity,
      unit: input.unit,
      unitPrice: input.unitPrice,
      supplier: input.supplier,
      deliveryDate: input.deliveryDate,
      status: input.status,
    };
    this.state.materials.push(material);
    return clone(material);
  }

  async listChangeOrders(projectId: string): Promise<ApiChangeOrderRecord[]> {
    return clone(this.state.changeOrders.filter((changeOrder) => changeOrder.projectId === projectId));
  }

  async createChangeOrder(
    projectId: string,
    input: CreateChangeOrderInput,
  ): Promise<ApiChangeOrderRecord> {
    const now = new Date();
    const changeOrder: ApiChangeOrderRecord = {
      id: crypto.randomUUID(),
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      projectId,
      description: input.description,
      amount: input.amount,
      approvedBy: input.approvedBy,
      date: input.date,
      status: input.status,
    };
    this.state.changeOrders.push(changeOrder);
    return clone(changeOrder);
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
      return normalizeState(parsed);
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

  async updateProject(id: string, input: UpdateProjectInput): Promise<ApiProjectRecord | null> {
    return this.enqueue(async () => {
      const state = await this.readState();
      const index = state.projects.findIndex((item) => item.id === id);
      if (index === -1) {
        return null;
      }

      const existing = state.projects[index];
      const updated: ApiProjectRecord = {
        ...existing,
        updatedAt: new Date().toISOString(),
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.contractor !== undefined ? { contractor: input.contractor } : {}),
        ...(input.address !== undefined ? { address: input.address } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.startDate !== undefined ? { startDate: input.startDate } : {}),
        ...(input.endDate !== undefined
          ? { endDate: input.endDate ?? undefined }
          : {}),
      };
      state.projects[index] = updated;
      await this.writeState(state);
      return clone(updated);
    });
  }

  async deleteProject(id: string): Promise<boolean> {
    return this.enqueue(async () => {
      const state = await this.readState();
      const previousLength = state.projects.length;
      state.projects = state.projects.filter((item) => item.id !== id);
      if (state.projects.length === previousLength) {
        return false;
      }
      state.tasks = state.tasks.filter((task) => task.projectId !== id);
      state.materials = state.materials.filter((material) => material.projectId !== id);
      state.changeOrders = state.changeOrders.filter((changeOrder) => changeOrder.projectId !== id);
      await this.writeState(state);
      return true;
    });
  }

  async listContractors(): Promise<ApiContractorRecord[]> {
    return this.enqueue(async () => clone((await this.readState()).contractors));
  }

  async getContractor(id: string): Promise<ApiContractorRecord | null> {
    return this.enqueue(async () => {
      const contractor = (await this.readState()).contractors.find((item) => item.id === id);
      return contractor ? clone(contractor) : null;
    });
  }

  async createContractor(input: CreateContractorInput): Promise<ApiContractorRecord> {
    return this.enqueue(async () => {
      const state = await this.readState();
      const now = new Date();
      const contractor: ApiContractorRecord = {
        id: crypto.randomUUID(),
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
        name: input.name,
        trade: input.trade,
        phone: input.phone,
        email: input.email,
      };
      state.contractors.push(contractor);
      await this.writeState(state);
      return clone(contractor);
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
        progress: input.progress ?? 0,
        cost: input.cost ?? 0,
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
        ...(input.projectId !== undefined ? { projectId: input.projectId } : {}),
        ...(input.contractorId !== undefined
          ? { contractorId: input.contractorId ?? undefined }
          : {}),
        ...(input.contractor !== undefined
          ? { contractor: input.contractor ?? undefined }
          : {}),
        ...(input.progress !== undefined ? { progress: input.progress } : {}),
        ...(input.cost !== undefined ? { cost: input.cost } : {}),
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

  async listMaterials(projectId: string): Promise<ApiMaterialRecord[]> {
    return this.enqueue(async () =>
      clone((await this.readState()).materials.filter((item) => item.projectId === projectId)),
    );
  }

  async createMaterial(projectId: string, input: CreateMaterialInput): Promise<ApiMaterialRecord> {
    return this.enqueue(async () => {
      const state = await this.readState();
      const now = new Date();
      const material: ApiMaterialRecord = {
        id: crypto.randomUUID(),
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
        projectId,
        name: input.name,
        quantity: input.quantity,
        unit: input.unit,
        unitPrice: input.unitPrice,
        supplier: input.supplier,
        deliveryDate: input.deliveryDate,
        status: input.status,
      };
      state.materials.push(material);
      await this.writeState(state);
      return clone(material);
    });
  }

  async listChangeOrders(projectId: string): Promise<ApiChangeOrderRecord[]> {
    return this.enqueue(async () =>
      clone((await this.readState()).changeOrders.filter((item) => item.projectId === projectId)),
    );
  }

  async createChangeOrder(
    projectId: string,
    input: CreateChangeOrderInput,
  ): Promise<ApiChangeOrderRecord> {
    return this.enqueue(async () => {
      const state = await this.readState();
      const now = new Date();
      const changeOrder: ApiChangeOrderRecord = {
        id: crypto.randomUUID(),
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
        projectId,
        description: input.description,
        amount: input.amount,
        approvedBy: input.approvedBy,
        date: input.date,
        status: input.status,
      };
      state.changeOrders.push(changeOrder);
      await this.writeState(state);
      return clone(changeOrder);
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

async function requireExistingProject(store: ApiStore, projectId: string): Promise<ApiProjectRecord> {
  const project = await store.getProject(projectId);
  if (!project) {
    throw new ApiError(404, "指定されたプロジェクトが見つかりません。");
  }

  return project;
}

async function resolveTaskContractor(
  store: ApiStore,
  contractorId: string | undefined | null,
): Promise<{ contractorId?: string | null; contractor?: string | null }> {
  if (contractorId === undefined) {
    return {};
  }
  if (contractorId === null) {
    return { contractorId: null, contractor: null };
  }

  const contractor = await store.getContractor(contractorId);
  if (!contractor) {
    throw new ApiError(404, "指定された業者が見つかりません。");
  }

  return {
    contractorId: contractor.id,
    contractor: contractor.name,
  };
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
    const search = url.searchParams.get("search")?.trim();
    const projects = (await store.listProjects()).filter((project) =>
      search ? project.name.includes(search) : true,
    );
    const serializedProjects = await Promise.all(
      projects.map(async (project) =>
        serializeProject(project, (await store.listTasks(project.id)).length),
      ),
    );
    return {
      statusCode: 200,
      body: { projects: serializedProjects },
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

  if (pathname === "/api/contractors") {
    if (request.method === "GET") {
      return {
        statusCode: 200,
        body: { contractors: (await store.listContractors()).map(serializeContractor) },
      };
    }

    if (request.method === "POST") {
      const input = validateCreateContractorInput(request.body ?? {});
      const contractor = await store.createContractor(input);
      return {
        statusCode: 201,
        body: { contractor: serializeContractor(contractor) },
      };
    }
  }

  const projectMatch = pathname.match(/^\/api\/projects\/([^/]+)$/);
  if (projectMatch) {
    const projectId = decodeURIComponent(projectMatch[1]);

    if (request.method === "GET") {
      const project = await store.getProject(projectId);
      if (!project) {
        throw new ApiError(404, "指定されたプロジェクトが見つかりません。");
      }
      return {
        statusCode: 200,
        body: { project: serializeProject(project) },
      };
    }

    if (request.method === "PATCH") {
      const existing = await store.getProject(projectId);
      if (!existing) {
        throw new ApiError(404, "指定されたプロジェクトが見つかりません。");
      }

      const input = validateUpdateProjectInput(request.body ?? {});
      const nextStartDate = input.startDate ?? existing.startDate;
      const nextEndDate =
        input.endDate === undefined ? existing.endDate : (input.endDate ?? undefined);

      if (nextEndDate) {
        assertDateOrder(nextStartDate, nextEndDate);
      }

      const project = await store.updateProject(projectId, input);
      if (!project) {
        throw new ApiError(404, "指定されたプロジェクトが見つかりません。");
      }
      return {
        statusCode: 200,
        body: { project: serializeProject(project) },
      };
    }

    if (request.method === "DELETE") {
      const deleted = await store.deleteProject(projectId);
      if (!deleted) {
        throw new ApiError(404, "指定されたプロジェクトが見つかりません。");
      }
      return { statusCode: 204 };
    }
  }

  const projectTasksMatch = pathname.match(/^\/api\/projects\/([^/]+)\/tasks$/);
  if (projectTasksMatch) {
    const projectId = decodeURIComponent(projectTasksMatch[1]);
    await requireExistingProject(store, projectId);

    if (request.method === "GET") {
      return {
        statusCode: 200,
        body: { tasks: (await store.listTasks(projectId)).map(serializeTask) },
      };
    }

    if (request.method === "POST") {
      const input = validateCreateTaskInput(request.body ?? {});
      const contractorLink =
        input.contractorId !== undefined
          ? await resolveTaskContractor(store, input.contractorId)
          : {};
      const task = await store.createTask(projectId, {
        ...input,
        contractorId: contractorLink.contractorId ?? input.contractorId,
        contractor: contractorLink.contractor ?? input.contractor,
      });
      return {
        statusCode: 201,
        body: { task: serializeTask(task) },
      };
    }
  }

  const projectMaterialsMatch = pathname.match(/^\/api\/projects\/([^/]+)\/materials$/);
  if (projectMaterialsMatch) {
    const projectId = decodeURIComponent(projectMaterialsMatch[1]);
    await requireExistingProject(store, projectId);

    if (request.method === "GET") {
      return {
        statusCode: 200,
        body: { materials: (await store.listMaterials(projectId)).map(serializeMaterial) },
      };
    }

    if (request.method === "POST") {
      const input = validateCreateMaterialInput(request.body ?? {});
      const material = await store.createMaterial(projectId, input);
      return {
        statusCode: 201,
        body: { material: serializeMaterial(material) },
      };
    }
  }

  const projectChangesMatch = pathname.match(/^\/api\/projects\/([^/]+)\/changes$/);
  if (projectChangesMatch) {
    const projectId = decodeURIComponent(projectChangesMatch[1]);
    await requireExistingProject(store, projectId);

    if (request.method === "GET") {
      return {
        statusCode: 200,
        body: { changes: (await store.listChangeOrders(projectId)).map(serializeChangeOrder) },
      };
    }

    if (request.method === "POST") {
      const input = validateCreateChangeOrderInput(request.body ?? {});
      const changeOrder = await store.createChangeOrder(projectId, input);
      return {
        statusCode: 201,
        body: { change: serializeChangeOrder(changeOrder) },
      };
    }
  }

  const projectProgressMatch = pathname.match(/^\/api\/projects\/([^/]+)\/progress$/);
  if (request.method === "GET" && projectProgressMatch) {
    const projectId = decodeURIComponent(projectProgressMatch[1]);
    await requireExistingProject(store, projectId);
    const tasks = await store.listTasks(projectId);
    return {
      statusCode: 200,
      body: {
        projectId,
        overallProgress: calculateProjectProgress(tasks),
        taskCount: tasks.length,
      },
    };
  }

  const projectCostSummaryMatch = pathname.match(/^\/api\/projects\/([^/]+)\/cost-summary$/);
  if (request.method === "GET" && projectCostSummaryMatch) {
    const projectId = decodeURIComponent(projectCostSummaryMatch[1]);
    await requireExistingProject(store, projectId);
    const [tasks, materials, changeOrders] = await Promise.all([
      store.listTasks(projectId),
      store.listMaterials(projectId),
      store.listChangeOrders(projectId),
    ]);
    return {
      statusCode: 200,
      body: {
        projectId,
        ...calculateCostSummary(tasks, materials, changeOrders),
      },
    };
  }

  const projectImportMatch = pathname.match(/^\/api\/projects\/([^/]+)\/import$/);
  if (request.method === "POST" && projectImportMatch) {
    const projectId = decodeURIComponent(projectImportMatch[1]);
    await requireExistingProject(store, projectId);

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
      if (input.projectId !== undefined && !(await store.getProject(input.projectId))) {
        throw new ApiError(404, "指定されたプロジェクトが見つかりません。");
      }
      if (input.contractorId !== undefined) {
        Object.assign(input, await resolveTaskContractor(store, input.contractorId));
      }
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
