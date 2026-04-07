import { createClient } from "@supabase/supabase-js";
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
  type DependencyRecord,
  type DependencyType,
  type DocumentType,
  type UpdateDocumentInput,
  type UpdateProjectInput,
  type UpdateTaskInput,
} from "./types.js";
import { clone, formatDate, isNonEmptyString, isObject } from "./utils.js";

type SupabaseError = {
  message: string;
};

type SupabaseQueryResult<T> = {
  data: T | null;
  error: SupabaseError | null;
};

type SupabaseQueryBuilder<T> = {
  select(columns?: string): SupabaseQueryBuilder<T>;
  insert(values: Record<string, unknown> | Array<Record<string, unknown>>): SupabaseQueryBuilder<T>;
  update(values: Record<string, unknown>): SupabaseQueryBuilder<T>;
  delete(): SupabaseQueryBuilder<T>;
  eq(column: string, value: unknown): SupabaseQueryBuilder<T>;
  order(column: string, options?: { ascending?: boolean }): SupabaseQueryBuilder<T>;
  single(): Promise<SupabaseQueryResult<T>>;
  maybeSingle(): Promise<SupabaseQueryResult<T>>;
  then<TResult1 = SupabaseQueryResult<T>, TResult2 = never>(
    onfulfilled?: ((value: SupabaseQueryResult<T>) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2>;
};

export type SupabaseClientLike = {
  from<T extends Record<string, unknown>>(table: string): SupabaseQueryBuilder<T | T[]>;
};

type DbProjectRecord = {
  id: string;
  created_at: string;
  updated_at: string;
  name: string;
  contractor: string;
  address: string;
  status: ApiProjectRecord["status"];
  description: string;
  start_date: string;
  end_date: string | null;
  include_weekends: boolean;
  client_id: string | null;
  client_name: string | null;
  contract_amount: number | null;
  contract_date: string | null;
  inspection_date: string | null;
  handover_date: string | null;
  warranty_end_date: string | null;
};

type DbTaskRecord = {
  id: string;
  created_at: string;
  updated_at: string;
  project_id: string;
  name: string;
  description: string;
  status: ApiTaskRecord["status"];
  start_date: string | null;
  due_date: string | null;
  progress: number;
  cost: number;
  dependencies: DependencyRecord[];
  contractor_id: string | null;
  contractor: string | null;
  is_milestone: boolean;
};

type DbContractorRecord = {
  id: string;
  created_at: string;
  updated_at: string;
  name: string;
  trade: string;
  phone: string;
  email: string;
};

type DbMaterialRecord = {
  id: string;
  created_at: string;
  updated_at: string;
  project_id: string;
  name: string;
  quantity: number;
  unit: string;
  unit_price: number;
  supplier: string;
  delivery_date: string;
  status: ApiMaterialRecord["status"];
};

type DbChangeOrderRecord = {
  id: string;
  created_at: string;
  updated_at: string;
  project_id: string;
  description: string;
  amount: number;
  approved_by: string;
  date: string;
  status: ApiChangeOrderRecord["status"];
};

type DbNotificationRecord = {
  id: string;
  created_at: string;
  updated_at: string;
  type: string;
  message: string;
  project_id: string;
  recipient_id: string;
  priority: ApiNotificationRecord["priority"];
  read: boolean;
  read_at: string | null;
};

type DbDocumentRecord = {
  id: string;
  created_at: string;
  updated_at: string;
  project_id: string;
  name: string;
  type: ApiDocumentRecord["type"];
  url: string;
  uploaded_by: string;
  version: string;
};

type DbDocumentVersionRecord = {
  id: string;
  created_at: string;
  updated_at: string;
  document_id: string;
  project_id: string;
  name: string;
  type: ApiDocumentVersionRecord["type"];
  url: string;
  uploaded_by: string;
  version: string;
};

export type SupabaseStoreOptions = {
  client?: SupabaseClientLike;
  url?: string;
  anonKey?: string;
};

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
      typeof value.lagDays === "number" && Number.isInteger(value.lagDays) ? value.lagDays : 0,
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

function toNullable<T>(value: T | undefined): T | null {
  return value ?? null;
}

function projectToDb(record: ApiProjectRecord): DbProjectRecord {
  return {
    id: record.id,
    created_at: record.createdAt,
    updated_at: record.updatedAt,
    name: record.name,
    contractor: record.contractor,
    address: record.address,
    status: record.status,
    description: record.description,
    start_date: record.startDate,
    end_date: toNullable(record.endDate),
    include_weekends: record.includeWeekends,
    client_id: toNullable(record.clientId),
    client_name: toNullable(record.clientName),
    contract_amount: toNullable(record.contractAmount),
    contract_date: toNullable(record.contractDate),
    inspection_date: toNullable(record.inspectionDate),
    handover_date: toNullable(record.handoverDate),
    warranty_end_date: toNullable(record.warrantyEndDate),
  };
}

function projectPatchToDb(record: ApiProjectRecord): Omit<DbProjectRecord, "id" | "created_at"> {
  const { id: _id, created_at: _createdAt, ...rest } = projectToDb(record);
  return rest;
}

function projectFromDb(record: DbProjectRecord): ApiProjectRecord {
  return normalizeProjectRecord({
    id: record.id,
    createdAt: record.created_at,
    updatedAt: record.updated_at,
    name: record.name,
    contractor: record.contractor,
    address: record.address,
    status: record.status,
    description: record.description,
    startDate: record.start_date,
    endDate: record.end_date ?? undefined,
    includeWeekends: record.include_weekends,
    clientId: record.client_id ?? undefined,
    clientName: record.client_name ?? undefined,
    contractAmount: record.contract_amount ?? undefined,
    contractDate: record.contract_date ?? undefined,
    inspectionDate: record.inspection_date ?? undefined,
    handoverDate: record.handover_date ?? undefined,
    warrantyEndDate: record.warranty_end_date ?? undefined,
  });
}

function taskToDb(record: ApiTaskRecord): DbTaskRecord {
  return {
    id: record.id,
    created_at: record.createdAt,
    updated_at: record.updatedAt,
    project_id: record.projectId,
    name: record.name,
    description: record.description,
    status: record.status,
    start_date: toNullable(record.startDate),
    due_date: toNullable(record.dueDate),
    progress: record.progress,
    cost: record.cost,
    dependencies: record.dependencies,
    contractor_id: toNullable(record.contractorId),
    contractor: toNullable(record.contractor),
    is_milestone: record.isMilestone,
  };
}

function taskPatchToDb(record: ApiTaskRecord): Omit<DbTaskRecord, "id" | "created_at"> {
  const { id: _id, created_at: _createdAt, ...rest } = taskToDb(record);
  return rest;
}

function taskFromDb(record: DbTaskRecord): ApiTaskRecord {
  return normalizeTaskRecord({
    id: record.id,
    createdAt: record.created_at,
    updatedAt: record.updated_at,
    projectId: record.project_id,
    name: record.name,
    description: record.description,
    status: record.status,
    startDate: record.start_date ?? undefined,
    dueDate: record.due_date ?? undefined,
    progress: record.progress,
    cost: record.cost,
    dependencies: Array.isArray(record.dependencies) ? record.dependencies : [],
    contractorId: record.contractor_id ?? undefined,
    contractor: record.contractor ?? undefined,
    isMilestone: record.is_milestone,
  });
}

function contractorToDb(record: ApiContractorRecord): DbContractorRecord {
  return {
    id: record.id,
    created_at: record.createdAt,
    updated_at: record.updatedAt,
    name: record.name,
    trade: record.trade,
    phone: record.phone,
    email: record.email,
  };
}

function contractorFromDb(record: DbContractorRecord): ApiContractorRecord {
  return {
    id: record.id,
    createdAt: record.created_at,
    updatedAt: record.updated_at,
    name: record.name,
    trade: record.trade,
    phone: record.phone,
    email: record.email,
  };
}

function materialToDb(record: ApiMaterialRecord): DbMaterialRecord {
  return {
    id: record.id,
    created_at: record.createdAt,
    updated_at: record.updatedAt,
    project_id: record.projectId,
    name: record.name,
    quantity: record.quantity,
    unit: record.unit,
    unit_price: record.unitPrice,
    supplier: record.supplier,
    delivery_date: record.deliveryDate,
    status: record.status,
  };
}

function materialFromDb(record: DbMaterialRecord): ApiMaterialRecord {
  return {
    id: record.id,
    createdAt: record.created_at,
    updatedAt: record.updated_at,
    projectId: record.project_id,
    name: record.name,
    quantity: record.quantity,
    unit: record.unit,
    unitPrice: record.unit_price,
    supplier: record.supplier,
    deliveryDate: record.delivery_date,
    status: record.status,
  };
}

function changeOrderToDb(record: ApiChangeOrderRecord): DbChangeOrderRecord {
  return {
    id: record.id,
    created_at: record.createdAt,
    updated_at: record.updatedAt,
    project_id: record.projectId,
    description: record.description,
    amount: record.amount,
    approved_by: record.approvedBy,
    date: record.date,
    status: record.status,
  };
}

function changeOrderFromDb(record: DbChangeOrderRecord): ApiChangeOrderRecord {
  return {
    id: record.id,
    createdAt: record.created_at,
    updatedAt: record.updated_at,
    projectId: record.project_id,
    description: record.description,
    amount: record.amount,
    approvedBy: record.approved_by,
    date: record.date,
    status: record.status,
  };
}

function notificationToDb(record: ApiNotificationRecord): DbNotificationRecord {
  return {
    id: record.id,
    created_at: record.createdAt,
    updated_at: record.updatedAt,
    type: record.type,
    message: record.message,
    project_id: record.projectId,
    recipient_id: record.recipientId,
    priority: record.priority,
    read: record.read,
    read_at: toNullable(record.readAt),
  };
}

function notificationPatchToDb(
  record: ApiNotificationRecord,
): Omit<DbNotificationRecord, "id" | "created_at"> {
  const { id: _id, created_at: _createdAt, ...rest } = notificationToDb(record);
  return rest;
}

function notificationFromDb(record: DbNotificationRecord): ApiNotificationRecord {
  return normalizeNotificationRecord({
    id: record.id,
    createdAt: record.created_at,
    updatedAt: record.updated_at,
    type: record.type,
    message: record.message,
    projectId: record.project_id,
    recipientId: record.recipient_id,
    priority: record.priority,
    read: record.read,
    readAt: record.read_at ?? undefined,
  });
}

function documentToDb(record: ApiDocumentRecord): DbDocumentRecord {
  return {
    id: record.id,
    created_at: record.createdAt,
    updated_at: record.updatedAt,
    project_id: record.projectId,
    name: record.name,
    type: record.type,
    url: record.url,
    uploaded_by: record.uploadedBy,
    version: record.version,
  };
}

function documentPatchToDb(record: ApiDocumentRecord): Omit<DbDocumentRecord, "id" | "created_at"> {
  const { id: _id, created_at: _createdAt, ...rest } = documentToDb(record);
  return rest;
}

function documentFromDb(record: DbDocumentRecord): ApiDocumentRecord {
  return normalizeDocumentRecord({
    id: record.id,
    createdAt: record.created_at,
    updatedAt: record.updated_at,
    projectId: record.project_id,
    name: record.name,
    type: record.type,
    url: record.url,
    uploadedBy: record.uploaded_by,
    version: record.version,
  });
}

function documentVersionToDb(record: ApiDocumentVersionRecord): DbDocumentVersionRecord {
  return {
    id: record.id,
    created_at: record.createdAt,
    updated_at: record.updatedAt,
    document_id: record.documentId,
    project_id: record.projectId,
    name: record.name,
    type: record.type,
    url: record.url,
    uploaded_by: record.uploadedBy,
    version: record.version,
  };
}

function documentVersionFromDb(record: DbDocumentVersionRecord): ApiDocumentVersionRecord {
  return normalizeDocumentVersionRecord({
    id: record.id,
    createdAt: record.created_at,
    updatedAt: record.updated_at,
    documentId: record.document_id,
    projectId: record.project_id,
    name: record.name,
    type: record.type,
    url: record.url,
    uploadedBy: record.uploaded_by,
    version: record.version,
  });
}

function throwIfSupabaseError(error: SupabaseError | null): void {
  if (error) {
    throw new ApiError(500, "Supabaseへのアクセスに失敗しました。");
  }
}

export class SupabaseStore implements ApiStore {
  private readonly client: SupabaseClientLike;

  constructor(options: SupabaseStoreOptions = {}) {
    if (options.client) {
      this.client = options.client;
      return;
    }

    const url = options.url ?? process.env.SUPABASE_URL;
    const anonKey = options.anonKey ?? process.env.SUPABASE_ANON_KEY;

    if (!url || !anonKey) {
      throw new Error("SUPABASE_URL and SUPABASE_ANON_KEY must be set when USE_SUPABASE is enabled.");
    }

    this.client = createClient(url, anonKey) as unknown as SupabaseClientLike;
  }

  async listProjects(): Promise<ApiProjectRecord[]> {
    const { data, error } = await this.client
      .from<DbProjectRecord>("projects")
      .select("*")
      .order("created_at", { ascending: true });
    throwIfSupabaseError(error);
    return clone(
      (Array.isArray(data) ? data : []).map((record) => projectFromDb(record as DbProjectRecord)),
    );
  }

  async getProject(id: string): Promise<ApiProjectRecord | null> {
    const { data, error } = await this.client
      .from<DbProjectRecord>("projects")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    throwIfSupabaseError(error);
    return data ? clone(projectFromDb(data as DbProjectRecord)) : null;
  }

  async createProject(input: CreateProjectInput): Promise<ApiProjectRecord> {
    const project = createProjectRecord(input);
    const { data, error } = await this.client
      .from<DbProjectRecord>("projects")
      .insert(projectToDb(project))
      .select("*")
      .single();
    throwIfSupabaseError(error);
    return clone(projectFromDb(data as DbProjectRecord));
  }

  async updateProject(id: string, input: UpdateProjectInput): Promise<ApiProjectRecord | null> {
    const existing = await this.getProject(id);
    if (!existing) {
      return null;
    }

    const updated = applyProjectUpdate(existing, input);
    const { data, error } = await this.client
      .from<DbProjectRecord>("projects")
      .update(projectPatchToDb(updated))
      .eq("id", id)
      .select("*")
      .maybeSingle();
    throwIfSupabaseError(error);
    return data ? clone(projectFromDb(data as DbProjectRecord)) : null;
  }

  async deleteProject(id: string): Promise<boolean> {
    const { data, error } = await this.client
      .from<DbProjectRecord>("projects")
      .delete()
      .eq("id", id)
      .select("id")
      .maybeSingle();
    throwIfSupabaseError(error);
    if (!data) {
      return false;
    }

    await Promise.all([
      this.client.from<DbTaskRecord>("tasks").delete().eq("project_id", id),
      this.client.from<DbMaterialRecord>("materials").delete().eq("project_id", id),
      this.client.from<DbChangeOrderRecord>("change_orders").delete().eq("project_id", id),
      this.client.from<DbNotificationRecord>("notifications").delete().eq("project_id", id),
      this.client.from<DbDocumentRecord>("documents").delete().eq("project_id", id),
      this.client.from<DbDocumentVersionRecord>("document_versions").delete().eq("project_id", id),
    ]).then((results) => {
      for (const result of results) {
        throwIfSupabaseError(result.error);
      }
    });

    return true;
  }

  async listContractors(): Promise<ApiContractorRecord[]> {
    const { data, error } = await this.client
      .from<DbContractorRecord>("contractors")
      .select("*")
      .order("created_at", { ascending: true });
    throwIfSupabaseError(error);
    return clone(
      (Array.isArray(data) ? data : []).map((record) => contractorFromDb(record as DbContractorRecord)),
    );
  }

  async getContractor(id: string): Promise<ApiContractorRecord | null> {
    const { data, error } = await this.client
      .from<DbContractorRecord>("contractors")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    throwIfSupabaseError(error);
    return data ? clone(contractorFromDb(data as DbContractorRecord)) : null;
  }

  async createContractor(input: CreateContractorInput): Promise<ApiContractorRecord> {
    const contractor = createContractorRecord(input);
    const { data, error } = await this.client
      .from<DbContractorRecord>("contractors")
      .insert(contractorToDb(contractor))
      .select("*")
      .single();
    throwIfSupabaseError(error);
    return clone(contractorFromDb(data as DbContractorRecord));
  }

  async listTasks(projectId: string): Promise<ApiTaskRecord[]> {
    const { data, error } = await this.client
      .from<DbTaskRecord>("tasks")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: true });
    throwIfSupabaseError(error);
    return clone((Array.isArray(data) ? data : []).map((record) => taskFromDb(record as DbTaskRecord)));
  }

  async listAllTasks(): Promise<ApiTaskRecord[]> {
    const { data, error } = await this.client
      .from<DbTaskRecord>("tasks")
      .select("*")
      .order("created_at", { ascending: true });
    throwIfSupabaseError(error);
    return clone((Array.isArray(data) ? data : []).map((record) => taskFromDb(record as DbTaskRecord)));
  }

  async getTask(id: string): Promise<ApiTaskRecord | null> {
    const { data, error } = await this.client
      .from<DbTaskRecord>("tasks")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    throwIfSupabaseError(error);
    return data ? clone(taskFromDb(data as DbTaskRecord)) : null;
  }

  async createTask(projectId: string, input: CreateTaskInput): Promise<ApiTaskRecord> {
    const task = createTaskRecord(projectId, input);
    const { data, error } = await this.client
      .from<DbTaskRecord>("tasks")
      .insert(taskToDb(task))
      .select("*")
      .single();
    throwIfSupabaseError(error);
    return clone(taskFromDb(data as DbTaskRecord));
  }

  async updateTask(id: string, input: UpdateTaskInput): Promise<ApiTaskRecord | null> {
    const existing = await this.getTask(id);
    if (!existing) {
      return null;
    }

    const updated = applyTaskUpdate(existing, input);
    const { data, error } = await this.client
      .from<DbTaskRecord>("tasks")
      .update(taskPatchToDb(updated))
      .eq("id", id)
      .select("*")
      .maybeSingle();
    throwIfSupabaseError(error);
    return data ? clone(taskFromDb(data as DbTaskRecord)) : null;
  }

  async deleteTask(id: string): Promise<boolean> {
    const existing = await this.getTask(id);
    if (!existing) {
      return false;
    }

    const { data, error } = await this.client
      .from<DbTaskRecord>("tasks")
      .delete()
      .eq("id", id)
      .select("id")
      .maybeSingle();
    throwIfSupabaseError(error);
    if (!data) {
      return false;
    }

    const tasks = await this.listTasks(existing.projectId);
    for (const task of tasks) {
      const dependencies = task.dependencies.filter((dependency) => dependency.predecessorId !== id);
      if (dependencies.length === task.dependencies.length) {
        continue;
      }

      const { error: updateError } = await this.client
        .from<DbTaskRecord>("tasks")
        .update({
          dependencies,
          updated_at: new Date().toISOString(),
        })
        .eq("id", task.id);
      throwIfSupabaseError(updateError);
    }

    return true;
  }

  async listMaterials(projectId: string): Promise<ApiMaterialRecord[]> {
    const { data, error } = await this.client
      .from<DbMaterialRecord>("materials")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: true });
    throwIfSupabaseError(error);
    return clone(
      (Array.isArray(data) ? data : []).map((record) => materialFromDb(record as DbMaterialRecord)),
    );
  }

  async createMaterial(projectId: string, input: CreateMaterialInput): Promise<ApiMaterialRecord> {
    const material = createMaterialRecord(projectId, input);
    const { data, error } = await this.client
      .from<DbMaterialRecord>("materials")
      .insert(materialToDb(material))
      .select("*")
      .single();
    throwIfSupabaseError(error);
    return clone(materialFromDb(data as DbMaterialRecord));
  }

  async listChangeOrders(projectId: string): Promise<ApiChangeOrderRecord[]> {
    const { data, error } = await this.client
      .from<DbChangeOrderRecord>("change_orders")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: true });
    throwIfSupabaseError(error);
    return clone(
      (Array.isArray(data) ? data : []).map((record) => changeOrderFromDb(record as DbChangeOrderRecord)),
    );
  }

  async createChangeOrder(
    projectId: string,
    input: CreateChangeOrderInput,
  ): Promise<ApiChangeOrderRecord> {
    const changeOrder = createChangeOrderRecord(projectId, input);
    const { data, error } = await this.client
      .from<DbChangeOrderRecord>("change_orders")
      .insert(changeOrderToDb(changeOrder))
      .select("*")
      .single();
    throwIfSupabaseError(error);
    return clone(changeOrderFromDb(data as DbChangeOrderRecord));
  }

  async listNotifications(filter?: { read?: boolean }): Promise<ApiNotificationRecord[]> {
    let query = this.client
      .from<DbNotificationRecord>("notifications")
      .select("*")
      .order("created_at", { ascending: true });
    if (filter?.read !== undefined) {
      query = query.eq("read", filter.read);
    }

    const { data, error } = await query;
    throwIfSupabaseError(error);
    return clone(
      (Array.isArray(data) ? data : []).map((record) => notificationFromDb(record as DbNotificationRecord)),
    );
  }

  async getNotification(id: string): Promise<ApiNotificationRecord | null> {
    const { data, error } = await this.client
      .from<DbNotificationRecord>("notifications")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    throwIfSupabaseError(error);
    return data ? clone(notificationFromDb(data as DbNotificationRecord)) : null;
  }

  async createNotification(input: CreateNotificationInput): Promise<ApiNotificationRecord> {
    const notification = createNotificationRecord(input);
    const { data, error } = await this.client
      .from<DbNotificationRecord>("notifications")
      .insert(notificationToDb(notification))
      .select("*")
      .single();
    throwIfSupabaseError(error);
    return clone(notificationFromDb(data as DbNotificationRecord));
  }

  async markNotificationRead(id: string): Promise<ApiNotificationRecord | null> {
    const existing = await this.getNotification(id);
    if (!existing) {
      return null;
    }

    const updated = markNotificationRecordAsRead(existing);
    const { data, error } = await this.client
      .from<DbNotificationRecord>("notifications")
      .update(notificationPatchToDb(updated))
      .eq("id", id)
      .select("*")
      .maybeSingle();
    throwIfSupabaseError(error);
    return data ? clone(notificationFromDb(data as DbNotificationRecord)) : null;
  }

  async countUnreadNotifications(): Promise<number> {
    return (await this.listNotifications({ read: false })).length;
  }

  async listDocuments(
    projectId: string,
    filter?: { type?: DocumentType },
  ): Promise<ApiDocumentRecord[]> {
    let query = this.client
      .from<DbDocumentRecord>("documents")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: true });
    if (filter?.type !== undefined) {
      query = query.eq("type", filter.type);
    }

    const { data, error } = await query;
    throwIfSupabaseError(error);
    return clone((Array.isArray(data) ? data : []).map((record) => documentFromDb(record as DbDocumentRecord)));
  }

  async getDocument(id: string): Promise<ApiDocumentRecord | null> {
    const { data, error } = await this.client
      .from<DbDocumentRecord>("documents")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    throwIfSupabaseError(error);
    return data ? clone(documentFromDb(data as DbDocumentRecord)) : null;
  }

  async createDocument(projectId: string, input: CreateDocumentInput): Promise<ApiDocumentRecord> {
    const document = createDocumentRecord(projectId, input);
    const { data, error } = await this.client
      .from<DbDocumentRecord>("documents")
      .insert(documentToDb(document))
      .select("*")
      .single();
    throwIfSupabaseError(error);
    return clone(documentFromDb(data as DbDocumentRecord));
  }

  async updateDocument(id: string, input: UpdateDocumentInput): Promise<ApiDocumentRecord | null> {
    const existing = await this.getDocument(id);
    if (!existing) {
      return null;
    }

    if (input.url !== undefined || input.version !== undefined) {
      const versionRecord = createDocumentVersionRecord(existing);
      const versionResult = await this.client
        .from<DbDocumentVersionRecord>("document_versions")
        .insert(documentVersionToDb(versionRecord))
        .select("id")
        .single();
      throwIfSupabaseError(versionResult.error);
    }

    const updated = applyDocumentUpdate(existing, input);
    const { data, error } = await this.client
      .from<DbDocumentRecord>("documents")
      .update(documentPatchToDb(updated))
      .eq("id", id)
      .select("*")
      .maybeSingle();
    throwIfSupabaseError(error);
    return data ? clone(documentFromDb(data as DbDocumentRecord)) : null;
  }

  async deleteDocument(id: string): Promise<boolean> {
    const { data, error } = await this.client
      .from<DbDocumentRecord>("documents")
      .delete()
      .eq("id", id)
      .select("id")
      .maybeSingle();
    throwIfSupabaseError(error);
    if (!data) {
      return false;
    }

    const versionResult = await this.client
      .from<DbDocumentVersionRecord>("document_versions")
      .delete()
      .eq("document_id", id);
    throwIfSupabaseError(versionResult.error);
    return true;
  }

  async listDocumentVersions(documentId: string): Promise<ApiDocumentVersionRecord[]> {
    const { data, error } = await this.client
      .from<DbDocumentVersionRecord>("document_versions")
      .select("*")
      .eq("document_id", documentId)
      .order("created_at", { ascending: true });
    throwIfSupabaseError(error);
    return clone(
      (Array.isArray(data) ? data : []).map((record) => documentVersionFromDb(record as DbDocumentVersionRecord)),
    );
  }
}
