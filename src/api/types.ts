export const PROJECT_STATUSES = ["planning", "active", "completed"] as const;
export const TASK_STATUSES = ["todo", "in_progress", "done"] as const;
export const MATERIAL_STATUSES = ["ordered", "delivered", "installed"] as const;
export const CHANGE_ORDER_STATUSES = ["pending", "approved", "rejected"] as const;
export const NOTIFICATION_PRIORITIES = ["low", "medium", "high"] as const;
export const DEPENDENCY_TYPES = ["FS", "SS", "FF", "SF"] as const;
export const DOCUMENT_TYPES = [
  "drawing",
  "contract",
  "permit",
  "daily_report",
  "photo",
  "invoice",
  "other",
] as const;
export const DEFAULT_PORT = 3001;

export type ProjectStatus = (typeof PROJECT_STATUSES)[number];
export type TaskStatus = (typeof TASK_STATUSES)[number];
export type MaterialStatus = (typeof MATERIAL_STATUSES)[number];
export type ChangeOrderStatus = (typeof CHANGE_ORDER_STATUSES)[number];
export type NotificationPriority = (typeof NOTIFICATION_PRIORITIES)[number];
export type DependencyType = (typeof DEPENDENCY_TYPES)[number];
export type DocumentType = (typeof DOCUMENT_TYPES)[number];

export type DependencyRecord = {
  predecessorId: string;
  type: DependencyType;
  lagDays: number;
};

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
  clientId?: string;
  clientName?: string;
  contractAmount?: number;
  contractDate?: string;
  inspectionDate?: string;
  handoverDate?: string;
  warrantyEndDate?: string;
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
  dependencies: DependencyRecord[];
  contractorId?: string;
  contractor?: string;
  isMilestone: boolean;
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

export type ApiNotificationRecord = {
  id: string;
  createdAt: string;
  updatedAt: string;
  type: string;
  message: string;
  projectId: string;
  recipientId: string;
  priority: NotificationPriority;
  read: boolean;
  readAt?: string;
};

export type ApiDocumentRecord = {
  id: string;
  createdAt: string;
  updatedAt: string;
  projectId: string;
  name: string;
  type: DocumentType;
  url: string;
  uploadedBy: string;
  version: string;
};

export type ApiDocumentVersionRecord = {
  id: string;
  createdAt: string;
  updatedAt: string;
  documentId: string;
  projectId: string;
  name: string;
  type: DocumentType;
  url: string;
  uploadedBy: string;
  version: string;
};

export type DatabaseState = {
  projects: ApiProjectRecord[];
  tasks: ApiTaskRecord[];
  contractors: ApiContractorRecord[];
  materials: ApiMaterialRecord[];
  changeOrders: ApiChangeOrderRecord[];
  notifications: ApiNotificationRecord[];
  documents: ApiDocumentRecord[];
  documentVersions: ApiDocumentVersionRecord[];
};

export type CreateProjectInput = Pick<
  ApiProjectRecord,
  | "name"
  | "contractor"
  | "address"
  | "status"
  | "clientId"
  | "clientName"
  | "contractAmount"
  | "contractDate"
  | "inspectionDate"
  | "handoverDate"
  | "warrantyEndDate"
>;

export type CreateTaskInput = {
  name: string;
  startDate: string;
  endDate: string;
  progress?: number;
  cost?: number;
  contractorId?: string;
  contractor?: string;
  description: string;
  isMilestone?: boolean;
};

export type CreateContractorInput = Pick<ApiContractorRecord, "name" | "trade" | "phone" | "email">;

export type CreateMaterialInput = Pick<
  ApiMaterialRecord,
  "name" | "quantity" | "unit" | "unitPrice" | "supplier" | "deliveryDate" | "status"
>;

export type CreateChangeOrderInput = Pick<
  ApiChangeOrderRecord,
  "description" | "amount" | "approvedBy" | "date" | "status"
>;

export type CreateNotificationInput = Pick<
  ApiNotificationRecord,
  "type" | "message" | "projectId" | "recipientId" | "priority"
>;

export type CreateDocumentInput = Pick<
  ApiDocumentRecord,
  "name" | "type" | "url" | "uploadedBy" | "version"
>;

export type UpdateProjectInput = {
  name?: string;
  contractor?: string;
  address?: string;
  status?: ProjectStatus;
  description?: string;
  startDate?: string;
  endDate?: string | null;
  clientId?: string | null;
  clientName?: string | null;
  contractAmount?: number | null;
  contractDate?: string | null;
  inspectionDate?: string | null;
  handoverDate?: string | null;
  warrantyEndDate?: string | null;
};

export type UpdateTaskInput = {
  status?: TaskStatus;
  startDate?: string | null;
  endDate?: string | null;
  projectId?: string;
  contractorId?: string | null;
  contractor?: string | null;
  progress?: number;
  cost?: number;
  dependencies?: DependencyRecord[];
  isMilestone?: boolean;
};

export type UpdateDocumentInput = {
  url?: string;
  version?: string;
};

export type UploadedFile = {
  fieldName: string;
  filename: string;
  contentType: string;
  buffer: Buffer;
};

export type MultipartBody = {
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
  listAllTasks(): Promise<ApiTaskRecord[]>;
  getTask(id: string): Promise<ApiTaskRecord | null>;
  createTask(projectId: string, input: CreateTaskInput): Promise<ApiTaskRecord>;
  updateTask(id: string, input: UpdateTaskInput): Promise<ApiTaskRecord | null>;
  deleteTask(id: string): Promise<boolean>;
  listMaterials(projectId: string): Promise<ApiMaterialRecord[]>;
  createMaterial(projectId: string, input: CreateMaterialInput): Promise<ApiMaterialRecord>;
  listChangeOrders(projectId: string): Promise<ApiChangeOrderRecord[]>;
  createChangeOrder(projectId: string, input: CreateChangeOrderInput): Promise<ApiChangeOrderRecord>;
  listNotifications(filter?: { read?: boolean }): Promise<ApiNotificationRecord[]>;
  getNotification(id: string): Promise<ApiNotificationRecord | null>;
  createNotification(input: CreateNotificationInput): Promise<ApiNotificationRecord>;
  markNotificationRead(id: string): Promise<ApiNotificationRecord | null>;
  countUnreadNotifications(): Promise<number>;
  listDocuments(projectId: string, filter?: { type?: DocumentType }): Promise<ApiDocumentRecord[]>;
  getDocument(id: string): Promise<ApiDocumentRecord | null>;
  createDocument(projectId: string, input: CreateDocumentInput): Promise<ApiDocumentRecord>;
  updateDocument(id: string, input: UpdateDocumentInput): Promise<ApiDocumentRecord | null>;
  deleteDocument(id: string): Promise<boolean>;
  listDocumentVersions(documentId: string): Promise<ApiDocumentVersionRecord[]>;
}

export type ApiRequest = {
  method?: string;
  url?: string;
  body?: unknown;
  headers?: Record<string, string | string[] | undefined>;
};

export type ApiResponse = {
  statusCode: number;
  headers?: Record<string, string>;
  body?: unknown;
};

export type ApiRouteContext = {
  request: ApiRequest;
  url: URL;
  pathname: string;
  store: ApiStore;
};

export type ApiRouteHandler = (context: ApiRouteContext) => Promise<ApiResponse | null>;

export class ApiError extends Error {
  constructor(
    readonly statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}
