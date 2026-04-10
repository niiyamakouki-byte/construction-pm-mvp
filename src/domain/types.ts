/** 全エンティティ共通フィールド */
export type BaseEntity = {
  id: string;
  createdAt: string;
  updatedAt: string;
};

// ── Project ─────────────────────────────────────────

export type ProjectStatus = "planning" | "active" | "completed" | "on_hold";

export type Project = BaseEntity & {
  name: string;
  description: string;
  status: ProjectStatus;
  startDate: string;
  endDate?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  budget?: number;
  includeWeekends: boolean;
};

// ── Task ────────────────────────────────────────────

export type TaskStatus = "todo" | "in_progress" | "done";

export type Task = BaseEntity & {
  projectId: string;
  name: string;
  description: string;
  status: TaskStatus;
  includeWeekends?: boolean;
  assigneeId?: string;
  startDate?: string;
  dueDate?: string;
  progress: number;
  dependencies: string[];
  contractorId?: string;
  materials?: string[];
  lead_time?: number;
  leadTimeDays?: number;
  canvasX?: number;
  canvasY?: number;
};

// ── Resource ────────────────────────────────────────

export type ResourceType = "worker" | "equipment" | "material";

export type Resource = BaseEntity & {
  name: string;
  type: ResourceType;
  unit?: string;
};

// ── CostItem ────────────────────────────────────────

export type CostPaymentStatus = "paid" | "unpaid";

export type CostBreakdownType =
  | "task_cost"
  | "material_cost"
  | "change_order_cost"
  | "invoice_received";

export type CostItem = BaseEntity & {
  projectId: string;
  taskId?: string;
  description: string;
  amount: number;
  category: string;
  costDate?: string;
  paymentStatus?: CostPaymentStatus;
  breakdownType?: CostBreakdownType;
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

// ── Estimate ────────────────────────────────────────

export type Estimate = BaseEntity & {
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

export type ChatMessage = {
  id: string;
  projectId: string;
  userId: string;
  userName: string;
  content: string;
  timestamp: string;
  attachments?: string[];
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
