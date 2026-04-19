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

export const ProjectSchema = BaseEntitySchema.extend({
  name: z.string(),
  description: z.string(),
  status: ProjectStatusSchema,
  startDate: isoDateString,
  endDate: isoDateString.optional(),
  address: z.string().optional(),
  latitude: z.number().finite().optional(),
  longitude: z.number().finite().optional(),
  budget: z.number().finite().optional(),
  includeWeekends: z.boolean(),
});

export type Project = z.infer<typeof ProjectSchema>;
export type ProjectStatus = z.infer<typeof ProjectStatusSchema>;

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
  caption: z.string().optional(),
  takenAt: isoDateString.optional(),
  uploaderName: z.string().optional(),
});

export type Photo = z.infer<typeof PhotoSchema>;
