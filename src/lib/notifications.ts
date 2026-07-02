import type { CostItem, Expense, Project, Task } from "../domain/types.js";
import { buildProjectCostRows, getProjectBudgetSummary } from "./cost-management.js";
import { filterScheduleTasks } from "./cost-management.js";
import { buildProcurementAlerts } from "./procurement-alerts.js";

export type AppNotificationType =
  | "overdue_task"
  | "upcoming_deadline"
  | "weather_warning"
  | "cost_overrun"
  | "procurement_alert"
  | "payment_confirmed";

export type AppNotificationTone = "red" | "yellow" | "blue" | "orange";

export type AppNotification = {
  id: string;
  type: AppNotificationType;
  tone: AppNotificationTone;
  title: string;
  message: string;
  path: string;
  projectId?: string;
  taskId?: string;
  sortDate?: string;
  daysOverdue?: number;
};

/**
 * 期限から STALE_OVERDUE_DAYS 日以上経過した overdue_task は
 * バナーUI上で「古い超過」サブグループに収納する（情報は消さない）。
 */
export const STALE_OVERDUE_DAYS = 30;

export function isStaleOverdue(notification: AppNotification): boolean {
  return (
    notification.type === "overdue_task" &&
    typeof notification.daysOverdue === "number" &&
    notification.daysOverdue >= STALE_OVERDUE_DAYS
  );
}

function diffDays(fromDateString: string, toDateString: string): number {
  const from = new Date(`${fromDateString}T00:00:00`).getTime();
  const to = new Date(`${toDateString}T00:00:00`).getTime();
  return Math.floor((to - from) / (1000 * 60 * 60 * 24));
}

type NotificationInput = {
  projects: Project[];
  tasks: Task[];
  costItems?: CostItem[];
  expenses?: Expense[];
  today?: string;
};

function toLocalDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(dateString: string, days: number): string {
  const base = new Date(`${dateString}T00:00:00`);
  base.setDate(base.getDate() + days);
  return toLocalDateString(base);
}

const TONE_PRIORITY: Record<AppNotificationTone, number> = {
  red: 0,
  orange: 1,
  yellow: 2,
  blue: 3,
};

export function sortNotifications(notifications: AppNotification[]): AppNotification[] {
  return [...notifications].sort((left, right) => {
    const toneDelta = TONE_PRIORITY[left.tone] - TONE_PRIORITY[right.tone];
    if (toneDelta !== 0) return toneDelta;

    const leftDate = left.sortDate ?? "";
    const rightDate = right.sortDate ?? "";
    return leftDate.localeCompare(rightDate);
  });
}

export function buildNotifications({
  projects,
  tasks,
  costItems = [],
  expenses = [],
  today = toLocalDateString(new Date()),
}: NotificationInput): AppNotification[] {
  const scheduleTasks = filterScheduleTasks(tasks);
  const projectMap = new Map(projects.map((project) => [project.id, project]));
  const deadlineLimit = addDays(today, 3);

  const overdueNotifications = scheduleTasks
    .filter((task) => task.status !== "done" && task.dueDate && task.dueDate < today)
    .map((task) => {
      const projectName = projectMap.get(task.projectId)?.name ?? "未割当案件";
      const dueDate = task.dueDate as string;
      return {
        id: `overdue:${task.id}`,
        type: "overdue_task" as const,
        tone: "red" as const,
        title: "期限超過タスク",
        message: `${projectName}: ${task.name} は ${dueDate} までに対応が必要でした。`,
        path: "/tasks",
        projectId: task.projectId,
        taskId: task.id,
        sortDate: dueDate,
        daysOverdue: diffDays(dueDate, today),
      };
    });

  const upcomingNotifications = scheduleTasks
    .filter(
      (task) =>
        task.status !== "done" &&
        task.dueDate &&
        task.dueDate >= today &&
        task.dueDate <= deadlineLimit,
    )
    .map((task) => {
      const projectName = projectMap.get(task.projectId)?.name ?? "未割当案件";
      return {
        id: `upcoming:${task.id}`,
        type: "upcoming_deadline" as const,
        tone: "yellow" as const,
        title: "3日以内の期限",
        message: `${projectName}: ${task.name} の期限は ${task.dueDate} です。`,
        path: "/tasks",
        projectId: task.projectId,
        taskId: task.id,
        sortDate: task.dueDate ?? undefined,
      };
    });

  const procurementNotifications = buildProcurementAlerts(scheduleTasks, today)
    .map((alert) => {
      const projectName = projectMap.get(alert.projectId)?.name ?? "未割当案件";
      return {
        id: `procurement:${alert.taskId}`,
        type: "procurement_alert" as const,
        tone: "orange" as const,
        title: "調達アラート",
        message: `${projectName}: ${alert.taskName} は ${alert.startDate} 開始予定です。リードタイム ${alert.leadTime}日、残り ${alert.daysRemaining}日です。`,
        path: `/gantt/${alert.projectId}`,
        projectId: alert.projectId,
        taskId: alert.taskId,
        sortDate: alert.startDate,
      };
    });

  const costOverrunNotifications = projects
    .filter((project) => typeof project.budget === "number" && project.budget > 0)
    .flatMap((project) => {
      const costRows = buildProjectCostRows(project.id, {
        tasks,
        costItems,
        expenses,
      });
      const budgetSummary = getProjectBudgetSummary(project, costRows);
      if (budgetSummary.spent <= budgetSummary.budget) {
        return [];
      }

      const overrun = budgetSummary.spent - budgetSummary.budget;
      return [
        {
          id: `cost:${project.id}`,
          type: "cost_overrun" as const,
          tone: "orange" as const,
          title: "予算超過",
          message: `${project.name} は ¥${overrun.toLocaleString("ja-JP")} の予算超過です。`,
          path: "/cost-management",
          projectId: project.id,
          sortDate: today,
        },
      ];
    });

  return sortNotifications([
    ...overdueNotifications,
    ...costOverrunNotifications,
    ...procurementNotifications,
    ...upcomingNotifications,
  ]);
}

// ── 入金確定通知キュー ────────────────────────────────────────────────────────
// InvoiceReconcilePage で「確定」操作が成功した時に pushPaymentConfirmedNotification を呼ぶ。
// NotificationBanner は getPaymentConfirmedNotifications で読み出して表示する。
// localStorage に JSON 配列として永続化し、dismissals で既読管理される。

const PAYMENT_CONFIRMED_KEY = "gh-payment-confirmed-notifs";

export type PaymentConfirmedEntry = {
  invoiceId: string;
  invoiceNumber: string;
  vendorName: string;
  amount: number;
  confirmedAt: string;
};

function loadPaymentConfirmedEntries(): PaymentConfirmedEntry[] {
  try {
    const raw = localStorage.getItem(PAYMENT_CONFIRMED_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as PaymentConfirmedEntry[];
  } catch {
    return [];
  }
}

function savePaymentConfirmedEntries(entries: PaymentConfirmedEntry[]): void {
  try {
    localStorage.setItem(PAYMENT_CONFIRMED_KEY, JSON.stringify(entries));
  } catch {
    // localStorage が使えない環境（テスト等）では無視
  }
}

/**
 * 入金確定通知を1件追加する。
 * 同じ invoiceId が既に存在する場合は重複を作らない（冪等）。
 */
export function pushPaymentConfirmedNotification(entry: PaymentConfirmedEntry): void {
  const entries = loadPaymentConfirmedEntries();
  const alreadyExists = entries.some((e) => e.invoiceId === entry.invoiceId);
  if (alreadyExists) return;
  entries.push(entry);
  savePaymentConfirmedEntries(entries);
  // NotificationBanner に再描画を促す
  try {
    window.dispatchEvent(new CustomEvent("gh:payment-confirmed"));
  } catch {
    // SSR / テスト環境では無視
  }
}

/** localStorage キューを AppNotification[] に変換して返す */
export function getPaymentConfirmedNotifications(): AppNotification[] {
  return loadPaymentConfirmedEntries().map((entry) => ({
    id: `payment_confirmed:${entry.invoiceId}`,
    type: "payment_confirmed" as const,
    tone: "blue" as const,
    title: "入金確認",
    message: `✓ 請求書 ${entry.invoiceNumber}（${entry.vendorName}）¥${entry.amount.toLocaleString("ja-JP")} の入金を確認しました。`,
    path: "/invoices/reconcile",
    sortDate: entry.confirmedAt,
  }));
}

/** テスト用: キューをクリアする */
export function clearPaymentConfirmedNotifications(): void {
  try {
    localStorage.removeItem(PAYMENT_CONFIRMED_KEY);
  } catch {
    // ignore
  }
}
