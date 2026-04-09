import type { CostItem, Expense, Project, Task } from "../domain/types.js";
import { buildProjectCostRows, getProjectBudgetSummary } from "./cost-management.js";
import { filterScheduleTasks } from "./cost-management.js";

export type AppNotificationType =
  | "overdue_task"
  | "upcoming_deadline"
  | "weather_warning"
  | "cost_overrun";

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
};

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
      return {
        id: `overdue:${task.id}`,
        type: "overdue_task" as const,
        tone: "red" as const,
        title: "期限超過タスク",
        message: `${projectName}: ${task.name} は ${task.dueDate} までに対応が必要でした。`,
        path: "/tasks",
        projectId: task.projectId,
        taskId: task.id,
        sortDate: task.dueDate,
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
        sortDate: task.dueDate,
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
    ...upcomingNotifications,
  ]);
}
