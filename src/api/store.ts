import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { ApiError } from "./types.js";
import {
  DEPENDENCY_TYPES,
  type ApiChangeOrderRecord,
  type ApiContractorRecord,
  type ApiDocumentRecord,
  type ApiDocumentVersionRecord,
  type ApiMaterialRecord,
  type ApiNotificationRecord,
  type ApiProjectRecord,
  type ApiStore,
  type ApiTaskRecord,
  type CreateChangeOrderInput,
  type CreateContractorInput,
  type CreateDocumentInput,
  type CreateMaterialInput,
  type CreateNotificationInput,
  type CreateProjectInput,
  type CreateTaskInput,
  type DatabaseState,
  type DependencyRecord,
  type DependencyType,
  type DocumentType,
  type UpdateDocumentInput,
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
    notifications: [],
    documents: [],
    documentVersions: [],
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

function normalizeNotificationRecord(notification: ApiNotificationRecord): ApiNotificationRecord {
  return {
    ...notification,
    read: notification.read ?? false,
    readAt: notification.readAt ?? undefined,
  };
}

function normalizeDocumentRecord(document: ApiDocumentRecord): ApiDocumentRecord {
  return {
    ...document,
  };
}

function normalizeDocumentVersionRecord(
  version: ApiDocumentVersionRecord,
): ApiDocumentVersionRecord {
  return {
    ...version,
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
    notifications: Array.isArray(parsed.notifications)
      ? parsed.notifications.map((notification) => normalizeNotificationRecord(notification as ApiNotificationRecord))
      : [],
    documents: Array.isArray(parsed.documents)
      ? parsed.documents.map((document) => normalizeDocumentRecord(document as ApiDocumentRecord))
      : [],
    documentVersions: Array.isArray(parsed.documentVersions)
      ? parsed.documentVersions.map((version) => normalizeDocumentVersionRecord(version as ApiDocumentVersionRecord))
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

function createNotificationRecord(input: CreateNotificationInput): ApiNotificationRecord {
  const now = new Date().toISOString();

  return {
    id: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
    type: input.type,
    message: input.message,
    projectId: input.projectId,
    recipientId: input.recipientId,
    priority: input.priority,
    read: false,
  };
}

function createDocumentRecord(projectId: string, input: CreateDocumentInput): ApiDocumentRecord {
  const now = new Date().toISOString();

  return {
    id: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
    projectId,
    name: input.name,
    type: input.type,
    url: input.url,
    uploadedBy: input.uploadedBy,
    version: input.version,
  };
}

function createDocumentVersionRecord(
  document: ApiDocumentRecord,
  archivedAt = new Date().toISOString(),
): ApiDocumentVersionRecord {
  return {
    id: crypto.randomUUID(),
    createdAt: archivedAt,
    updatedAt: archivedAt,
    documentId: document.id,
    projectId: document.projectId,
    name: document.name,
    type: document.type,
    url: document.url,
    uploadedBy: document.uploadedBy,
    version: document.version,
  };
}

function applyDocumentUpdate(existing: ApiDocumentRecord, input: UpdateDocumentInput): ApiDocumentRecord {
  return {
    ...existing,
    updatedAt: new Date().toISOString(),
    ...(input.url !== undefined ? { url: input.url } : {}),
    ...(input.version !== undefined ? { version: input.version } : {}),
  };
}

function markNotificationRecordAsRead(existing: ApiNotificationRecord): ApiNotificationRecord {
  if (existing.read) {
    return existing;
  }

  const now = new Date().toISOString();
  return {
    ...existing,
    updatedAt: now,
    read: true,
    readAt: now,
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
  state.notifications = state.notifications.filter((notification) => notification.projectId !== id);
  const deletedDocumentIds = new Set(
    state.documents.filter((document) => document.projectId === id).map((document) => document.id),
  );
  state.documents = state.documents.filter((document) => document.projectId !== id);
  state.documentVersions = state.documentVersions.filter(
    (version) => version.projectId !== id && !deletedDocumentIds.has(version.documentId),
  );
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

function deleteDocumentFromState(state: DatabaseState, id: string): boolean {
  const previousLength = state.documents.length;
  state.documents = state.documents.filter((document) => document.id !== id);
  if (state.documents.length === previousLength) {
    return false;
  }

  state.documentVersions = state.documentVersions.filter((version) => version.documentId !== id);
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

  async listNotifications(filter?: { read?: boolean }): Promise<ApiNotificationRecord[]> {
    const notifications =
      filter?.read === undefined
        ? this.state.notifications
        : this.state.notifications.filter((notification) => notification.read === filter.read);

    return clone(notifications);
  }

  async getNotification(id: string): Promise<ApiNotificationRecord | null> {
    const notification = this.state.notifications.find((item) => item.id === id);
    return notification ? clone(notification) : null;
  }

  async createNotification(input: CreateNotificationInput): Promise<ApiNotificationRecord> {
    const notification = createNotificationRecord(input);
    this.state.notifications.push(notification);
    return clone(notification);
  }

  async markNotificationRead(id: string): Promise<ApiNotificationRecord | null> {
    const index = this.state.notifications.findIndex((item) => item.id === id);
    if (index === -1) {
      return null;
    }

    const updated = markNotificationRecordAsRead(this.state.notifications[index]);
    this.state.notifications[index] = updated;
    return clone(updated);
  }

  async countUnreadNotifications(): Promise<number> {
    return this.state.notifications.filter((notification) => !notification.read).length;
  }

  async listDocuments(
    projectId: string,
    filter?: { type?: DocumentType },
  ): Promise<ApiDocumentRecord[]> {
    return clone(
      this.state.documents.filter(
        (document) =>
          document.projectId === projectId &&
          (filter?.type === undefined || document.type === filter.type),
      ),
    );
  }

  async getDocument(id: string): Promise<ApiDocumentRecord | null> {
    const document = this.state.documents.find((item) => item.id === id);
    return document ? clone(document) : null;
  }

  async createDocument(projectId: string, input: CreateDocumentInput): Promise<ApiDocumentRecord> {
    const document = createDocumentRecord(projectId, input);
    this.state.documents.push(document);
    return clone(document);
  }

  async updateDocument(id: string, input: UpdateDocumentInput): Promise<ApiDocumentRecord | null> {
    const index = this.state.documents.findIndex((item) => item.id === id);
    if (index === -1) {
      return null;
    }

    const existing = this.state.documents[index];
    if (input.url !== undefined || input.version !== undefined) {
      this.state.documentVersions.push(createDocumentVersionRecord(existing));
    }

    const updated = applyDocumentUpdate(existing, input);
    this.state.documents[index] = updated;
    return clone(updated);
  }

  async deleteDocument(id: string): Promise<boolean> {
    return deleteDocumentFromState(this.state, id);
  }

  async listDocumentVersions(documentId: string): Promise<ApiDocumentVersionRecord[]> {
    return clone(this.state.documentVersions.filter((version) => version.documentId === documentId));
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

  async listNotifications(filter?: { read?: boolean }): Promise<ApiNotificationRecord[]> {
    return this.enqueue(async () => {
      const notifications = (await this.readState()).notifications;
      return clone(
        filter?.read === undefined
          ? notifications
          : notifications.filter((notification) => notification.read === filter.read),
      );
    });
  }

  async getNotification(id: string): Promise<ApiNotificationRecord | null> {
    return this.enqueue(async () => {
      const notification = (await this.readState()).notifications.find((item) => item.id === id);
      return notification ? clone(notification) : null;
    });
  }

  async createNotification(input: CreateNotificationInput): Promise<ApiNotificationRecord> {
    return this.enqueue(async () => {
      const state = await this.readState();
      const notification = createNotificationRecord(input);
      state.notifications.push(notification);
      await this.writeState(state);
      return clone(notification);
    });
  }

  async markNotificationRead(id: string): Promise<ApiNotificationRecord | null> {
    return this.enqueue(async () => {
      const state = await this.readState();
      const index = state.notifications.findIndex((item) => item.id === id);
      if (index === -1) {
        return null;
      }

      const updated = markNotificationRecordAsRead(state.notifications[index]);
      state.notifications[index] = updated;
      await this.writeState(state);
      return clone(updated);
    });
  }

  async countUnreadNotifications(): Promise<number> {
    return this.enqueue(async () =>
      (await this.readState()).notifications.filter((notification) => !notification.read).length,
    );
  }

  async listDocuments(
    projectId: string,
    filter?: { type?: DocumentType },
  ): Promise<ApiDocumentRecord[]> {
    return this.enqueue(async () =>
      clone(
        (await this.readState()).documents.filter(
          (document) =>
            document.projectId === projectId &&
            (filter?.type === undefined || document.type === filter.type),
        ),
      ),
    );
  }

  async getDocument(id: string): Promise<ApiDocumentRecord | null> {
    return this.enqueue(async () => {
      const document = (await this.readState()).documents.find((item) => item.id === id);
      return document ? clone(document) : null;
    });
  }

  async createDocument(projectId: string, input: CreateDocumentInput): Promise<ApiDocumentRecord> {
    return this.enqueue(async () => {
      const state = await this.readState();
      const document = createDocumentRecord(projectId, input);
      state.documents.push(document);
      await this.writeState(state);
      return clone(document);
    });
  }

  async updateDocument(id: string, input: UpdateDocumentInput): Promise<ApiDocumentRecord | null> {
    return this.enqueue(async () => {
      const state = await this.readState();
      const index = state.documents.findIndex((item) => item.id === id);
      if (index === -1) {
        return null;
      }

      const existing = state.documents[index];
      if (input.url !== undefined || input.version !== undefined) {
        state.documentVersions.push(createDocumentVersionRecord(existing));
      }

      const updated = applyDocumentUpdate(existing, input);
      state.documents[index] = updated;
      await this.writeState(state);
      return clone(updated);
    });
  }

  async deleteDocument(id: string): Promise<boolean> {
    return this.enqueue(async () => {
      const state = await this.readState();
      const deleted = deleteDocumentFromState(state, id);
      if (!deleted) {
        return false;
      }

      await this.writeState(state);
      return true;
    });
  }

  async listDocumentVersions(documentId: string): Promise<ApiDocumentVersionRecord[]> {
    return this.enqueue(async () =>
      clone((await this.readState()).documentVersions.filter((version) => version.documentId === documentId)),
    );
  }
}
