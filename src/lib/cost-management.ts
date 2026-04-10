import type {
  CostBreakdownType,
  CostItem,
  CostPaymentStatus,
  Expense,
  Project,
  Task,
} from "../domain/types.js";
import { getTotalByStatus } from "./order-management.js";

export const COST_CATEGORIES = ["労務費", "材料費", "外注費", "経費"] as const;

export type CostCategory = (typeof COST_CATEGORIES)[number];

export type CostRow = {
  id: string;
  projectId: string;
  date: string;
  description: string;
  amount: number;
  paymentStatus: CostPaymentStatus;
  category: CostCategory;
  breakdownType: CostBreakdownType;
  source: "cost_item" | "expense" | "task";
  taskId?: string;
};

type CostDataset = {
  tasks: Task[];
  costItems: CostItem[];
  expenses: Expense[];
};

const COST_TASK_PATTERNS = [/\bgrow\b/i, /\bnanairo\b/i, /ジョウシン/i];

function hasKeyword(value: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(value));
}

function normalizeDate(value: string | undefined, fallback: string): string {
  if (!value) return fallback;
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : value.slice(0, 10);
}

function parseAmount(text: string): number {
  const match = text.match(/[¥￥]?\s*([\d,]+)(?:円)?/);
  if (!match) return 0;
  const amount = Number(match[1].replaceAll(",", ""));
  return Number.isFinite(amount) ? amount : 0;
}

function inferBreakdownType(description: string, category?: string): CostBreakdownType {
  const text = `${category ?? ""} ${description}`;
  if (hasKeyword(text, [/請求/i, /invoice/i])) return "invoice_received";
  if (hasKeyword(text, [/変更/i, /追加/i, /change order/i])) return "change_order_cost";
  if (hasKeyword(text, [/材料/i, /資材/i, /部材/i])) return "material_cost";
  return "task_cost";
}

function normalizeCategory(
  category: string | undefined,
  description: string,
  breakdownType: CostBreakdownType,
): CostCategory {
  const text = `${category ?? ""} ${description}`;

  if (text.includes("材料費")) return "材料費";
  if (text.includes("労務費")) return "労務費";
  if (text.includes("外注費")) return "外注費";
  if (text.includes("経費")) return "経費";

  if (hasKeyword(text, [/材料/i, /資材/i, /部材/i, /ジョウシン/i])) return "材料費";
  if (hasKeyword(text, [/交通費/i, /駐車/i, /諸経費/i, /経費/i])) return "経費";
  if (breakdownType === "material_cost") return "材料費";
  if (breakdownType === "invoice_received") return "外注費";
  return "外注費";
}

function normalizePaymentStatus(value: string | undefined): CostPaymentStatus {
  return value === "paid" || value === "approved" || value === "done" ? "paid" : "unpaid";
}

function toTaskCostRow(task: Task): CostRow {
  const description = task.description.trim() || task.name.trim();
  const fallbackDate = task.updatedAt.slice(0, 10);
  const date = normalizeDate(task.dueDate ?? task.startDate, fallbackDate);
  const breakdownType = inferBreakdownType(
    `${task.name} ${task.description} ${(task.materials ?? []).join(" ")}`.trim(),
    task.materials?.length ? "材料費" : undefined,
  );

  return {
    id: `task:${task.id}`,
    projectId: task.projectId,
    date,
    description: task.name.trim(),
    amount: parseAmount(`${task.description} ${(task.materials ?? []).join(" ")}`),
    paymentStatus: normalizePaymentStatus(task.status),
    category: normalizeCategory(task.materials?.length ? "材料費" : undefined, description, breakdownType),
    breakdownType,
    source: "task",
    taskId: task.id,
  };
}

function toCostItemRow(costItem: CostItem): CostRow {
  const breakdownType = costItem.breakdownType ?? inferBreakdownType(costItem.description, costItem.category);

  return {
    id: `cost_item:${costItem.id}`,
    projectId: costItem.projectId,
    date: normalizeDate(costItem.costDate, costItem.updatedAt.slice(0, 10)),
    description: costItem.description,
    amount: costItem.amount,
    paymentStatus: costItem.paymentStatus ?? "unpaid",
    category: normalizeCategory(costItem.category, costItem.description, breakdownType),
    breakdownType,
    source: "cost_item",
    taskId: costItem.taskId,
  };
}

function toExpenseRow(expense: Expense): CostRow {
  const breakdownType = inferBreakdownType(expense.description, expense.category);

  return {
    id: `expense:${expense.id}`,
    projectId: expense.projectId,
    date: normalizeDate(expense.expenseDate, expense.updatedAt.slice(0, 10)),
    description: expense.description,
    amount: expense.amount,
    paymentStatus: normalizePaymentStatus(expense.approvalStatus),
    category: normalizeCategory(expense.category, expense.description, breakdownType),
    breakdownType,
    source: "expense",
  };
}

export function isCostLikeTask(task: Pick<Task, "name" | "description">): boolean {
  return hasKeyword(`${task.name} ${task.description}`.trim(), COST_TASK_PATTERNS);
}

export function filterScheduleTasks(tasks: Task[]): Task[] {
  return tasks.filter((task) => !isCostLikeTask(task));
}

export function buildProjectCostRows(projectId: string, dataset: CostDataset): CostRow[] {
  const derivedTaskRows = dataset.tasks
    .filter((task) => task.projectId === projectId)
    .filter(isCostLikeTask)
    .map(toTaskCostRow);

  const costItemRows = dataset.costItems
    .filter((item) => item.projectId === projectId)
    .map(toCostItemRow);

  const expenseRows = dataset.expenses
    .filter((expense) => expense.projectId === projectId)
    .map(toExpenseRow);

  return [...costItemRows, ...derivedTaskRows, ...expenseRows].sort((left, right) =>
    right.date.localeCompare(left.date),
  );
}

export function summarizeCostRows(costRows: CostRow[]) {
  const total = costRows.reduce((sum, row) => sum + row.amount, 0);
  const paid = costRows
    .filter((row) => row.paymentStatus === "paid")
    .reduce((sum, row) => sum + row.amount, 0);
  const unpaid = total - paid;
  const byBreakdown = {
    taskCost: costRows
      .filter((row) => row.breakdownType === "task_cost")
      .reduce((sum, row) => sum + row.amount, 0),
    materialCost: costRows
      .filter((row) => row.breakdownType === "material_cost")
      .reduce((sum, row) => sum + row.amount, 0),
    changeOrderCost: costRows
      .filter((row) => row.breakdownType === "change_order_cost")
      .reduce((sum, row) => sum + row.amount, 0),
    invoicesReceived: costRows
      .filter((row) => row.breakdownType === "invoice_received")
      .reduce((sum, row) => sum + row.amount, 0),
  };

  return { total, paid, unpaid, byBreakdown };
}

export function groupCostRowsByCategory(costRows: CostRow[]) {
  return COST_CATEGORIES.map((category) => ({
    category,
    rows: costRows.filter((row) => row.category === category),
  }));
}

export function getProjectBudgetSummary(project: Project | null, costRows: CostRow[]) {
  const budget = project?.budget ?? 0;
  const { paid } = summarizeCostRows(costRows);
  return {
    budget,
    spent: paid,
    remaining: budget - paid,
  };
}

export type RemainingBudgetDetail = {
  budget: number;
  spent: number;
  committedUndelivered: number;
  remaining: number;
  /** 0–100 percentage of budget used (spent + committed) */
  usedPct: number;
  alertLevel: "none" | "warning" | "danger";
};

/**
 * Calculates "how much can we still spend" in real time.
 * remaining = budget - spent - committed_undelivered
 * warning  when remaining <= 20% of budget
 * danger   when remaining <= 10% of budget
 */
export function getRemainingBudgetDetail(
  project: Project | null,
  costRows: CostRow[],
): RemainingBudgetDetail {
  const budget = project?.budget ?? 0;
  const { paid } = summarizeCostRows(costRows);

  const projectId = project?.id;
  // Orders that have been placed but not yet received (発注済 + 納品待ち)
  const committedUndelivered = projectId
    ? getTotalByStatus("発注済", projectId) + getTotalByStatus("納品待ち", projectId)
    : 0;

  const remaining = budget - paid - committedUndelivered;
  const usedPct = budget > 0 ? Math.round(((paid + committedUndelivered) / budget) * 100) : 0;

  let alertLevel: RemainingBudgetDetail["alertLevel"] = "none";
  if (budget > 0) {
    const remainingPct = remaining / budget;
    if (remainingPct <= 0.1) alertLevel = "danger";
    else if (remainingPct <= 0.2) alertLevel = "warning";
  }

  return { budget, spent: paid, committedUndelivered, remaining, usedPct, alertLevel };
}
