// ── Re-exports from schemas (Zod-derived types) ──────────────────────────────
// These 7 types are now derived from Zod schemas in ./schemas.ts.
// All existing imports of these type names continue to work unchanged.
export type {
  Project,
  ProjectStatus,
  ProjectMode,
  Task,
  TaskStatus,
  DependencyType,
  CostItem,
  CostPaymentStatus,
  CostBreakdownType,
  Invoice,
  InvoiceStatus,
  Contract,
  ContractStatus,
  ChangeOrder,
  ChangeOrderStatus,
  Photo,
  ProjectPaymentPlan,
  PaymentPlanStatus,
  ExecutionBudget,
} from "./schemas.js";

/** 全エンティティ共通フィールド */
export type BaseEntity = {
  id: string;
  createdAt: string;
  updatedAt: string;
};

// ── Resource ────────────────────────────────────────

export type ResourceType = "worker" | "equipment" | "material";

export type Resource = BaseEntity & {
  name: string;
  type: ResourceType;
  unit?: string;
};

// ── TeamMember ──────────────────────────────────────

export type TeamMember = BaseEntity & {
  name: string;
  role: string;
  email?: string;
  phone?: string;
};

// ── DailyReport ─────────────────────────────────────

export type DailyReport = BaseEntity & {
  projectId: string;
  reportDate: string;
  weather?: string;
  content: string;
  photoUrls: string[];
  authorId?: string;
};

// ── EstimateLineItem ─────────────────────────────────

/** 工事見積の1行項目 (domain entity)。見積書全体は src/estimate/types.ts の Estimate を参照 */
export type EstimateLineItem = BaseEntity & {
  projectId: string;
  itemName: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  amount: number;
  category: string;
};

// ── Expense ─────────────────────────────────────────

export type ExpenseApprovalStatus = "pending" | "approved" | "rejected";

export type Expense = BaseEntity & {
  projectId: string;
  expenseDate: string;
  description: string;
  amount: number;
  category: string;
  receiptUrl?: string;
  approvalStatus: ExpenseApprovalStatus;
};

// ── Contractor ──────────────────────────────────────

export type Contractor = BaseEntity & {
  name: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  lineId?: string;
  specialty?: string;
};

// ── ChatMessage / ChatRoom ───────────────────────────────

/** Message classification: text=通常, inquiry=質疑, notice=周知, image=画像 */
export type MessageType = "text" | "inquiry" | "notice" | "image";

export type ChatMessage = {
  id: string;
  projectId: string;
  userId: string;
  userName: string;
  content: string;
  timestamp: string;
  type?: MessageType;
  /** User IDs who have read this message */
  readBy?: string[];
  attachments?: string[];
  /** Usernames mentioned in the message (e.g. ["新山", "鈴木"]) */
  mentions?: string[];
};

export type ChatRoom = {
  projectId: string;
  messages: ChatMessage[];
  lastActivity: string;
};

// ── Notification ────────────────────────────────────

export type NotificationType =
  | "schedule_confirmed"
  | "schedule_changed"
  | "reminder"
  | "alert";

export type NotificationStatus = "pending" | "sent" | "failed";

export type Notification = BaseEntity & {
  projectId?: string;
  taskId?: string;
  contractorId?: string;
  type: NotificationType;
  message: string;
  status: NotificationStatus;
  scheduledAt?: string;
  sentAt?: string;
};

// ProjectPaymentPlan / ExecutionBudget は schemas.ts 側で zod 定義済 (Task #41)

// ── ContractChecklistItem ─────────────────────────────

/** 案件ごとの契約チェックリスト1行 */
export type ContractChecklistItem = BaseEntity & {
  projectId: string;
  itemKey: string;   // DEFAULT_CONTRACT_ITEMS のキー
  checked: boolean;
};

// ── ProjectDocument / DocumentVersion ─────────────────

export type DocumentType =
  | "drawing"
  | "contract"
  | "permit"
  | "daily_report"
  | "photo"
  | "invoice"
  | "other";

/** 案件ドキュメント（現行版）。旧版は DocumentVersion として document_versions に退避する */
export type ProjectDocument = BaseEntity & {
  projectId: string;
  name: string;
  type: DocumentType;
  url: string;
  uploadedBy: string;
  version: string;
};

/** ドキュメントの旧版スナップショット */
export type DocumentVersion = BaseEntity & {
  documentId: string;
  projectId: string;
  name: string;
  type: DocumentType;
  url: string;
  uploadedBy: string;
  version: string;
};
