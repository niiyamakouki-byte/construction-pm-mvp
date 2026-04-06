import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { ApiError } from "./types.js";
import {
  DEPENDENCY_TYPES,
  type ApiChangeOrderRecord,
  type ApiContractorRecord,
  type ApiMaterialRecord,
  type ApiProjectRecord,
  type ApiStore,
  type ApiTaskRecord,
  type CreateChangeOrderInput,
  type CreateContractorInput,
  type CreateMaterialInput,
  type CreateProjectInput,
  type CreateTaskInput,
  type DatabaseState,
  type DependencyRecord,
  type DependencyType,
  type UpdateProjectInput,
  type UpdateTaskInput,
} from "./types.js";
import { clone, formatDate, isNonEmptyString, isObject } from "./utils.js";

function createEmptyState(): DatabaseState {
  return {
    projects: [],
    tasks: [],
    contractors: [],
    materials: [],
    changeOrders: [],
  };
}

function normalizeDependencyRecord(value: unknown): DependencyRecord | null {
  if (typeof value === "string" && value.trim()) {
    return {
      predecessorId: value.trim(),
      type: "FS",
      lagDays: 0,
    };
  }

  if (!isObject(value) || !isNonEmptyString(value.predecessorId)) {
    return null;
  }

  return {
    predecessorId: value.predecessorId.trim(),
    type:
      typeof value.type === "string" && DEPENDENCY_TYPES.includes(value.type as DependencyType)
        ? (value.type as DependencyType)
        : "FS",
    lagDays:
      typeof value.lagDays === "number" && Number.isInteger(value.lagDays)
        ? value.lagDays
        : 0,
  };
}

function normalizeProjectRecord(project: ApiProjectRecord): ApiProjectRecord {
  return {
    ...project,
    description: project.description ?? "",
    startDate: project.startDate ?? formatDate(new Date(project.createdAt ?? Date.now())),
    includeWeekends: project.includeWeekends ?? true,
    clientId: project.clientId ?? undefined,
    clientName: project.clientName ?? undefined,
    contractAmount: typeof project.contractAmount === "number" ? project.contractAmount : undefined,
    contractDate: project.contractDate ?? undefined,
    inspectionDate: project.inspectionDate ?? undefined,
    handoverDate: project.handoverDate ?? undefined,
    warrantyEndDate: project.warrantyEndDate ?? undefined,
  };
}

function normalizeTaskRecord(task: ApiTaskRecord): ApiTaskRecord {
  return {
    ...task,
    description: task.description ?? "",
    progress: typeof task.progress === "number" ? task.progress : 0,
    cost: typeof task.cost === "number" ? task.cost : 0,
    dependencies: Array.isArray(task.dependencies)
      ? task.dependencies
          .map((dependency) => normalizeDependencyRecord(dependency))
          .filter((dependency): dependency is DependencyRecord => dependency !== null)
      : [],
    isMilestone: task.isMilestone ?? false,
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

function createProjectRecord(input: CreateProjectInput): ApiProjectRecord {
  const now = new Date();

  return {
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
    clientId: input.clientId,
    clientName: input.clientName,
    contractAmount: input.contractAmount,
    contractDate: input.contractDate,
    inspectionDate: input.inspectionDate,
    handoverDate: input.handoverDate,
    warrantyEndDate: input.warrantyEndDate,
  };
}

function applyProjectUpdate(existing: ApiProjectRecord, input: UpdateProjectInput): ApiProjectRecord {
  return {
    ...existing,
    updatedAt: new Date().toISOString(),
    ...(input.name !== undefined ? { name: input.name } : {}),
    ...(input.contractor !== undefined ? { contractor: input.contractor } : {}),
    ...(input.address !== undefined ? { address: input.address } : {}),
    ...(input.status !== undefined ? { status: input.status } : {}),
    ...(input.description !== undefined ? { description: input.description } : {}),
    ...(input.startDate !== undefined ? { startDate: input.startDate } : {}),
    ...(input.endDate !== undefined ? { endDate: input.endDate ?? undefined } : {}),
    ...(input.clientId !== undefined ? { clientId: input.clientId ?? undefined } : {}),
    ...(input.clientName !== undefined ? { clientName: input.clientName ?? undefined } : {}),
    ...(input.contractAmount !== undefined ? { contractAmount: input.contractAmount ?? undefined } : {}),
    ...(input.contractDate !== undefined ? { contractDate: input.contractDate ?? undefined } : {}),
    ...(input.inspectionDate !== undefined
      ? { inspectionDate: input.inspectionDate ?? undefined }
      : {}),
    ...(input.handoverDate !== undefined ? { handoverDate: input.handoverDate ?? undefined } : {}),
    ...(input.warrantyEndDate !== undefined
      ? { warrantyEndDate: input.warrantyEndDate ?? undefined }
      : {}),
  };
}

function createContractorRecord(input: CreateContractorInput): ApiContractorRecord {
  const now = new Date();

  return {
    id: crypto.randomUUID(),
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    name: input.name,
    trade: input.trade,
    phone: input.phone,
    email: input.email,
  };
}

function createTaskRecord(projectId: string, input: CreateTaskInput): ApiTaskRecord {
  const now = new Date();

  return {
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
    isMilestone: input.isMilestone ?? false,
  };
}

function applyTaskUpdate(existing: ApiTaskRecord, input: UpdateTaskInput): ApiTaskRecord {
  return {
    ...existing,
    updatedAt: new Date().toISOString(),
    ...(input.status !== undefined ? { status: input.status } : {}),
    ...(input.startDate !== undefined ? { startDate: input.startDate ?? undefined } : {}),
    ...(input.endDate !== undefined ? { dueDate: input.endDate ?? undefined } : {}),
    ...(input.projectId !== undefined ? { projectId: input.projectId } : {}),
    ...(input.contractorId !== undefined ? { contractorId: input.contractorId ?? undefined } : {}),
    ...(input.contractor !== undefined ? { contractor: input.contractor ?? undefined } : {}),
    ...(input.progress !== undefined ? { progress: input.progress } : {}),
    ...(input.cost !== undefined ? { cost: input.cost } : {}),
    ...(input.dependencies !== undefined ? { dependencies: input.dependencies } : {}),
    ...(input.isMilestone !== undefined ? { isMilestone: input.isMilestone } : {}),
  };
}

function createMaterialRecord(projectId: string, input: CreateMaterialInput): ApiMaterialRecord {
  const now = new Date();

  return {
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
}

function createChangeOrderRecord(
  projectId: string,
  input: CreateChangeOrderInput,
): ApiChangeOrderRecord {
  const now = new Date();

  return {
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
}

function deleteProjectFromState(state: DatabaseState, id: string): boolean {
  const previousLength = state.projects.length;
  state.projects = state.projects.filter((item) => item.id !== id);
  if (state.projects.length === previousLength) {
    return false;
  }

  state.tasks = state.tasks.filter((task) => task.projectId !== id);
  state.materials = state.materials.filter((material) => material.projectId !== id);
  state.changeOrders = state.changeOrders.filter((changeOrder) => changeOrder.projectId !== id);
  return true;
}

function deleteTaskFromState(state: DatabaseState, id: string): boolean {
  const previousLength = state.tasks.length;
  state.tasks = state.tasks.filter((item) => item.id !== id);
  if (state.tasks.length === previousLength) {
    return false;
  }

  state.tasks = state.tasks.map((task) => ({
    ...task,
    dependencies: task.dependencies.filter((dependency) => dependency.predecessorId !== id),
  }));
  return true;
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
    const project = createProjectRecord(input);
    this.state.projects.push(project);
    return clone(project);
  }

  async updateProject(id: string, input: UpdateProjectInput): Promise<ApiProjectRecord | null> {
    const index = this.state.projects.findIndex((item) => item.id === id);
    if (index === -1) {
      return null;
    }

    const updated = applyProjectUpdate(this.state.projects[index], input);
    this.state.projects[index] = updated;
    return clone(updated);
  }

  async deleteProject(id: string): Promise<boolean> {
    return deleteProjectFromState(this.state, id);
  }

  async listContractors(): Promise<ApiContractorRecord[]> {
    return clone(this.state.contractors);
  }

  async getContractor(id: string): Promise<ApiContractorRecord | null> {
    const contractor = this.state.contractors.find((item) => item.id === id);
    return contractor ? clone(contractor) : null;
  }

  async createContractor(input: CreateContractorInput): Promise<ApiContractorRecord> {
    const contractor = createContractorRecord(input);
    this.state.contractors.push(contractor);
    return clone(contractor);
  }

  async listTasks(projectId: string): Promise<ApiTaskRecord[]> {
    return clone(this.state.tasks.filter((task) => task.projectId === projectId));
  }

  async listAllTasks(): Promise<ApiTaskRecord[]> {
    return clone(this.state.tasks);
  }

  async getTask(id: string): Promise<ApiTaskRecord | null> {
    const task = this.state.tasks.find((item) => item.id === id);
    return task ? clone(task) : null;
  }

  async createTask(projectId: string, input: CreateTaskInput): Promise<ApiTaskRecord> {
    const task = createTaskRecord(projectId, input);
    this.state.tasks.push(task);
    return clone(task);
  }

  async updateTask(id: string, input: UpdateTaskInput): Promise<ApiTaskRecord | null> {
    const index = this.state.tasks.findIndex((item) => item.id === id);
    if (index === -1) {
      return null;
    }

    const updated = applyTaskUpdate(this.state.tasks[index], input);
    this.state.tasks[index] = updated;
    return clone(updated);
  }

  async deleteTask(id: string): Promise<boolean> {
    return deleteTaskFromState(this.state, id);
  }

  async listMaterials(projectId: string): Promise<ApiMaterialRecord[]> {
    return clone(this.state.materials.filter((material) => material.projectId === projectId));
  }

  async createMaterial(projectId: string, input: CreateMaterialInput): Promise<ApiMaterialRecord> {
    const material = createMaterialRecord(projectId, input);
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
    const changeOrder = createChangeOrderRecord(projectId, input);
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
      if (!raw.trim()) {
        throw new ApiError(500, "データベースファイルが空のため読み込めません。");
      }

      let parsed: Partial<DatabaseState>;
      try {
        parsed = JSON.parse(raw) as Partial<DatabaseState>;
      } catch {
        throw new ApiError(500, "データベースファイルが破損しているため読み込めません。");
      }

      return normalizeState(parsed);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return createEmptyState();
      }
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError(500, "データベースファイルの読み込みに失敗しました。");
    }
  }

  private async writeState(state: DatabaseState): Promise<void> {
    try {
      await mkdir(dirname(this.filePath), { recursive: true });
      await writeFile(this.filePath, JSON.stringify(state, null, 2), "utf8");
    } catch {
      throw new ApiError(500, "データベースファイルの書き込みに失敗しました。");
    }
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
      const project = createProjectRecord(input);
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

      const updated = applyProjectUpdate(state.projects[index], input);
      state.projects[index] = updated;
      await this.writeState(state);
      return clone(updated);
    });
  }

  async deleteProject(id: string): Promise<boolean> {
    return this.enqueue(async () => {
      const state = await this.readState();
      const deleted = deleteProjectFromState(state, id);
      if (!deleted) {
        return false;
      }

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
      const contractor = createContractorRecord(input);
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

  async listAllTasks(): Promise<ApiTaskRecord[]> {
    return this.enqueue(async () => clone((await this.readState()).tasks));
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
      const task = createTaskRecord(projectId, input);
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

      const updated = applyTaskUpdate(state.tasks[index], input);
      state.tasks[index] = updated;
      await this.writeState(state);
      return clone(updated);
    });
  }

  async deleteTask(id: string): Promise<boolean> {
    return this.enqueue(async () => {
      const state = await this.readState();
      const deleted = deleteTaskFromState(state, id);
      if (!deleted) {
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
      const material = createMaterialRecord(projectId, input);
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
      const changeOrder = createChangeOrderRecord(projectId, input);
      state.changeOrders.push(changeOrder);
      await this.writeState(state);
      return clone(changeOrder);
    });
  }
}
