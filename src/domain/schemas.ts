import { z } from "zod";

// ── SchemaValidationError ────────────────────────────────────────────────────

export class SchemaValidationError extends Error {
  constructor(
    public readonly entityName: string,
    public readonly cause: z.ZodError,
  ) {
    super(
      `SchemaValidationError [${entityName}]: ${cause.issues.map((i) => i.message).join(", ")}`,
    );
    this.name = "SchemaValidationError";
  }
}

/**
 * Parses `data` with `schema`, throwing `SchemaValidationError` on failure.
 */
export function parseOrThrow<T>(
  schema: z.ZodType<T>,
  entityName: string,
  data: unknown,
): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new SchemaValidationError(entityName, result.error);
  }
  return result.data;
}

/**
 * Parses `data` with `schema`. On failure, logs a warning and returns the
 * original data cast to T instead of throwing. Use for read paths against
 * existing production data that may not yet match schema constraints.
 */
export function parseOrWarn<T>(
  schema: z.ZodType<T>,
  entityName: string,
  data: unknown,
): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    if (typeof console !== "undefined" && console.warn) {
      console.warn(
        `[schema] ${entityName} validation warning:`,
        result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "),
      );
    }
    return data as T;
  }
  return result.data;
}

// ── Shared validators ────────────────────────────────────────────────────────

/**
 * Accepts ISO 8601 date strings in two forms:
 *   - Date-only:  "2025-04-01"
 *   - Full datetime: "2025-04-01T10:00:00.000Z" (with or without offset)
 *
 * NaN/Infinity are rejected via the Date parse check.
 * Rejects non-date strings like "foo" or "2025-13-01".
 */
const isoDateString = z
  .string()
  .refine(
    (val) => {
      // Must start with YYYY-MM-DD pattern (basic sanity)
      if (!/^\d{4}-\d{2}-\d{2}/.test(val)) return false;
      const ts = Date.parse(val);
      return !isNaN(ts);
    },
    { message: "ISO 8601 date string required (YYYY-MM-DD or datetime)" },
  );

// ── BaseEntity ───────────────────────────────────────────────────────────────

export const BaseEntitySchema = z.object({
  id: z.string().uuid(),
  createdAt: isoDateString,
  updatedAt: isoDateString,
});

// ── Project ──────────────────────────────────────────────────────────────────

export const ProjectStatusSchema = z.enum([
  "planning",
  "active",
  "completed",
  "on_hold",
]);

export const ProjectModeSchema = z.enum(["memo", "normal", "full"]);

export const ProjectSchema = BaseEntitySchema.extend({
  name: z.string(),
  description: z.string(),
  status: ProjectStatusSchema,
  mode: ProjectModeSchema.default("normal"),
  startDate: isoDateString,
  endDate: isoDateString.optional(),
  address: z.string().optional(),
  latitude: z.number().finite().optional(),
  longitude: z.number().finite().optional(),
  budget: z.number().finite().optional(),
  includeWeekends: z.boolean(),
});

export type ProjectStatus = z.infer<typeof ProjectStatusSchema>;
export type ProjectMode = z.infer<typeof ProjectModeSchema>;
export type Project = Omit<z.infer<typeof ProjectSchema>, "mode"> & {
  mode?: ProjectMode;
};

// ── Task ─────────────────────────────────────────────────────────────────────

export const TaskStatusSchema = z.enum(["todo", "in_progress", "done"]);

export const DependencyTypeSchema = z.enum(["FS", "FF", "SS", "SF", "none"]);

export const TaskSchema = BaseEntitySchema.extend({
  projectId: z.string().uuid(),
  name: z.string(),
  description: z.string(),
  status: TaskStatusSchema,
  includeWeekends: z.boolean().optional(),
  assigneeId: z.string().optional(),
  startDate: isoDateString.optional(),
  dueDate: isoDateString.optional(),
  progress: z.number().finite(),
  dependencies: z.array(z.string()),
  /** Dependency relationship type; defaults to 'FS' when not set */
  dependencyType: DependencyTypeSchema.optional(),
  contractorId: z.string().optional(),
  materials: z.array(z.string()).optional(),
  lead_time: z.number().optional(),
  leadTimeDays: z.number().optional(),
  canvasX: z.number().optional(),
  canvasY: z.number().optional(),
  majorCategory: z.string().optional(),
  middleCategory: z.string().optional(),
  minorCategory: z.string().optional(),
  /** Manual row order in the Gantt view; undefined falls back to date sorting */
  sortIndex: z.number().optional(),
});

export type Task = z.infer<typeof TaskSchema>;
export type TaskStatus = z.infer<typeof TaskStatusSchema>;
export type DependencyType = z.infer<typeof DependencyTypeSchema>;

// ── CostItem ─────────────────────────────────────────────────────────────────

export const CostPaymentStatusSchema = z.enum(["paid", "unpaid"]);

export const CostBreakdownTypeSchema = z.enum([
  "task_cost",
  "material_cost",
  "change_order_cost",
  "invoice_received",
]);

export const CostItemSchema = BaseEntitySchema.extend({
  projectId: z.string().uuid(),
  taskId: z.string().optional(),
  description: z.string(),
  // Negative numbers allowed (returns / discounts). NaN/Infinity rejected.
  amount: z.number().finite(),
  category: z.string(),
  costDate: isoDateString.optional(),
  paymentStatus: CostPaymentStatusSchema.optional(),
  breakdownType: CostBreakdownTypeSchema.optional(),
});

export type CostItem = z.infer<typeof CostItemSchema>;
export type CostPaymentStatus = z.infer<typeof CostPaymentStatusSchema>;
export type CostBreakdownType = z.infer<typeof CostBreakdownTypeSchema>;

// ── Invoice ──────────────────────────────────────────────────────────────────

export const InvoiceStatusSchema = z.enum([
  "draft",
  "sent",
  "paid",
  "overdue",
  "cancelled",
]);

export const InvoiceSchema = BaseEntitySchema.extend({
  projectId: z.string().uuid(),
  invoiceNumber: z.string(),
  amount: z.number().finite(),
  status: InvoiceStatusSchema,
  issueDate: isoDateString,
  dueDate: isoDateString,
  description: z.string().optional(),
});

export type Invoice = z.infer<typeof InvoiceSchema>;
export type InvoiceStatus = z.infer<typeof InvoiceStatusSchema>;

// ── Contract ─────────────────────────────────────────────────────────────────

export const ContractStatusSchema = z.enum([
  "draft",
  "active",
  "completed",
  "terminated",
]);

export const ContractSchema = BaseEntitySchema.extend({
  projectId: z.string().uuid(),
  contractorId: z.string().uuid(),
  title: z.string(),
  amount: z.number().finite(),
  status: ContractStatusSchema,
  startDate: isoDateString,
  endDate: isoDateString.optional(),
  description: z.string().optional(),
});

export type Contract = z.infer<typeof ContractSchema>;
export type ContractStatus = z.infer<typeof ContractStatusSchema>;

// ── ChangeOrder ──────────────────────────────────────────────────────────────

export const ChangeOrderStatusSchema = z.enum([
  "pending",
  "approved",
  "rejected",
]);

export const ChangeOrderSchema = BaseEntitySchema.extend({
  projectId: z.string().uuid(),
  title: z.string(),
  description: z.string(),
  amount: z.number().finite(),
  status: ChangeOrderStatusSchema,
  requestDate: isoDateString,
  approvedDate: isoDateString.optional(),
});

export type ChangeOrder = z.infer<typeof ChangeOrderSchema>;
export type ChangeOrderStatus = z.infer<typeof ChangeOrderStatusSchema>;

// ── Photo ─────────────────────────────────────────────────────────────────────

export const PhotoSchema = BaseEntitySchema.extend({
  projectId: z.string().uuid(),
  taskId: z.string().optional(),
  url: z.string().url(),
  storagePath: z.string().optional(),
  fileName: z.string().optional(),
  contentType: z.string().optional(),
  fileSize: z.number().finite().positive().optional(),
  category: z.string().optional(),
  caption: z.string().optional(),
  takenAt: isoDateString.optional(),
  uploaderName: z.string().optional(),
});

export type Photo = z.infer<typeof PhotoSchema>;

// ── MoodBoard ────────────────────────────────────────────────────────────────

export const MoodBoardCategorySchema = z.enum([
  "床",
  "壁",
  "天井",
  "家具",
  "照明",
  "カーテン",
  "その他",
]);

export const MoodBoardItemSchema = z.object({
  id: z.string(),
  imageUrl: z.string().url(),
  title: z.string(),
  description: z.string(),
  category: MoodBoardCategorySchema,
  supplier: z.string().optional(),
  price: z.number().finite().nonnegative().optional(),
  position: z.object({
    x: z.number().finite(),
    y: z.number().finite(),
  }),
  size: z.object({
    w: z.number().finite().positive(),
    h: z.number().finite().positive(),
  }),
});

export const MoodBoardSchema = BaseEntitySchema.extend({
  projectId: z.string().uuid(),
  title: z.string(),
  items: z.array(MoodBoardItemSchema),
});

export type MoodBoardCategory = z.infer<typeof MoodBoardCategorySchema>;
export type MoodBoardItem = z.infer<typeof MoodBoardItemSchema>;
export type MoodBoard = z.infer<typeof MoodBoardSchema>;

// ── SelectionItem ────────────────────────────────────────────────────────────

export const SelectionCategorySchema = z.enum([
  "床材",
  "壁材",
  "天井材",
  "建具",
  "照明",
  "衛生器具",
  "その他",
]);

export const SelectionStatusSchema = z.enum([
  "選定中",
  "施主確認待ち",
  "承認済",
  "変更依頼",
]);

export const SelectionOptionSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  unitPrice: z.number().finite().nonnegative(),
  imageUrl: z.string().url().optional(),
  catalogUrl: z.string().url().optional(),
});

export const SelectionSchema = BaseEntitySchema.extend({
  projectId: z.string().uuid(),
  category: SelectionCategorySchema,
  name: z.string(),
  options: z.array(SelectionOptionSchema),
  selectedOptionId: z.string().nullable(),
  status: SelectionStatusSchema,
  clientNote: z.string(),
});

export type SelectionCategory = z.infer<typeof SelectionCategorySchema>;
export type SelectionStatus = z.infer<typeof SelectionStatusSchema>;
export type SelectionOption = z.infer<typeof SelectionOptionSchema>;
export type Selection = z.infer<typeof SelectionSchema>;

// ── ProcurementMaterial ──────────────────────────────────────────────────────

export const ProcurementMaterialStatusSchema = z.enum([
  "unordered",
  "ordered",
  "delivered",
  "accepted",
]);

export const ProcurementMaterialSchema = BaseEntitySchema.extend({
  projectId: z.string().uuid(),
  name: z.string(),
  category: z.string(),
  quantity: z.number().finite().nonnegative(),
  unit: z.string(),
  status: ProcurementMaterialStatusSchema,
  dueDate: isoDateString,
});

export type ProcurementMaterialStatus = z.infer<typeof ProcurementMaterialStatusSchema>;
export type ProcurementMaterial = z.infer<typeof ProcurementMaterialSchema>;

// ── PurchaseOrder (order management) ─────────────────────────────────────────

export const PurchaseOrderStatusSchema = z.enum([
  "下書き",
  "発注済",
  "納品待ち",
  "納品済",
  "検収済",
  "請求済",
  "支払済",
]);

export const PurchaseOrderItemSchema = z.object({
  code: z.string(),
  name: z.string(),
  unit: z.string(),
  quantity: z.number().finite().nonnegative(),
  unitPrice: z.number().finite().nonnegative(),
  amount: z.number().finite().nonnegative(),
});

export const PurchaseOrderSchema = BaseEntitySchema.extend({
  projectId: z.string().uuid(),
  contractorId: z.string(),
  contractorName: z.string(),
  items: z.array(PurchaseOrderItemSchema),
  status: PurchaseOrderStatusSchema,
  orderDate: isoDateString,
  deliveryDate: isoDateString,
  totalAmount: z.number().finite().nonnegative(),
  taxAmount: z.number().finite().nonnegative(),
  totalWithTax: z.number().finite().nonnegative(),
  notes: z.string().optional(),
});

export type PurchaseOrderStatus = z.infer<typeof PurchaseOrderStatusSchema>;
export type PurchaseOrderItem = z.infer<typeof PurchaseOrderItemSchema>;
export type PurchaseOrder = z.infer<typeof PurchaseOrderSchema>;

// ── CRM: Contact / Deal ──────────────────────────────────────────────────────

export const CRMContactSchema = BaseEntitySchema.extend({
  name: z.string(),
  company: z.string(),
  phone: z.string(),
  email: z.string(),
  address: z.string(),
  note: z.string(),
});

export const CRMDealStageSchema = z.enum([
  "引合",
  "現調",
  "見積提出",
  "商談中",
  "受注",
  "失注",
]);

export const CRMDealSchema = BaseEntitySchema.extend({
  customerId: z.string().uuid(),
  projectName: z.string(),
  stage: CRMDealStageSchema,
  estimatedAmount: z.number().finite().nonnegative(),
  actualAmount: z.number().finite().nonnegative().nullable(),
  probability: z.number().finite().min(0).max(100),
  expectedCloseDate: z.string(),
  note: z.string(),
});

export type CRMContact = z.infer<typeof CRMContactSchema>;
export type CRMDealStage = z.infer<typeof CRMDealStageSchema>;
export type CRMDeal = z.infer<typeof CRMDealSchema>;

// ── ProjectPaymentPlan (入金計画) ───────────────────────────────────────────
// Task #41

export const PaymentPlanStatusSchema = z.enum([
  "planned",
  "invoiced",
  "paid",
  "overdue",
  "cancelled",
]);

export const ProjectPaymentPlanSchema = BaseEntitySchema.extend({
  projectId: z.string(),
  milestoneLabel: z.string(),
  scheduledDate: isoDateString,
  scheduledAmount: z.number().finite().nonnegative(),
  invoiceId: z.string().optional(),
  actualPaidDate: isoDateString.optional(),
  actualAmount: z.number().finite().nonnegative().optional(),
  freeeDealId: z.string().optional(),
  status: PaymentPlanStatusSchema,
  notes: z.string().optional(),
});

export type PaymentPlanStatus = z.infer<typeof PaymentPlanStatusSchema>;
export type ProjectPaymentPlan = z.infer<typeof ProjectPaymentPlanSchema>;

// ── ExecutionBudget (実行予算) ─────────────────────────────────────────────
// Task #41

export const ExecutionBudgetSchema = BaseEntitySchema.extend({
  projectId: z.string(),
  category: z.string(),
  plannedAmount: z.number().finite().nonnegative(),
  committedAmount: z.number().finite().nonnegative(),
  actualAmount: z.number().finite().nonnegative(),
  freeeAccountCode: z.string().optional(),
  notes: z.string().optional(),
});

export type ExecutionBudget = z.infer<typeof ExecutionBudgetSchema>;
