import { serializeNotification } from "./serialization.js";
import type {
  ApiChangeOrderRecord,
  ApiMaterialRecord,
  ApiNotificationRecord,
  ApiStore,
  ApiTaskRecord,
  NotificationPriority,
  TaskStatus,
} from "./types.js";
import { diffInDays, formatDate } from "./utils.js";

const AUTO_NOTIFICATION_RECIPIENT_ID = "system";

const taskStatusLabels: Record<TaskStatus, string> = {
  todo: "未着手",
  in_progress: "進行中",
  done: "完了",
};

function buildUpcomingMaterialMessage(material: ApiMaterialRecord): string {
  return `資材「${material.name}」の納品予定日（${material.deliveryDate}）が3日以内です。`;
}

function buildTaskStatusMessage(task: ApiTaskRecord, previousStatus: TaskStatus): string {
  return `タスク「${task.name}」のステータスが「${taskStatusLabels[previousStatus]}」から「${taskStatusLabels[task.status]}」に更新されました。`;
}

function buildChangeOrderMessage(changeOrder: ApiChangeOrderRecord): string {
  return `変更指示が作成されました。内容: ${changeOrder.description}`;
}

function priorityFromDaysUntilDelivery(daysUntilDelivery: number): NotificationPriority {
  return daysUntilDelivery <= 1 ? "high" : "medium";
}

function isMaterialDeliveryUpcoming(material: ApiMaterialRecord, today: string): boolean {
  const daysUntilDelivery = diffInDays(today, material.deliveryDate);
  return daysUntilDelivery >= 0 && daysUntilDelivery <= 3;
}

export function serializeNotificationsDescending(notifications: ApiNotificationRecord[]) {
  return notifications
    .slice()
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .map(serializeNotification);
}

export async function createTaskStatusChangedNotification(
  store: ApiStore,
  task: ApiTaskRecord,
  previousStatus: TaskStatus,
): Promise<ApiNotificationRecord> {
  return store.createNotification({
    type: "task_status_changed",
    message: buildTaskStatusMessage(task, previousStatus),
    projectId: task.projectId,
    recipientId: AUTO_NOTIFICATION_RECIPIENT_ID,
    priority: task.status === "done" ? "medium" : "high",
  });
}

export async function ensureUpcomingMaterialDeliveryNotifications(
  store: ApiStore,
  projectId: string,
): Promise<ApiNotificationRecord[]> {
  const today = formatDate(new Date());
  const materials = await store.listMaterials(projectId);
  const existingNotifications = await store.listNotifications();
  const createdNotifications: ApiNotificationRecord[] = [];

  for (const material of materials) {
    if (!isMaterialDeliveryUpcoming(material, today)) {
      continue;
    }

    const message = buildUpcomingMaterialMessage(material);
    const alreadyExists = existingNotifications.some(
      (notification) =>
        notification.type === "material_delivery_due" &&
        notification.projectId === projectId &&
        notification.message === message,
    );
    if (alreadyExists) {
      continue;
    }

    const daysUntilDelivery = diffInDays(today, material.deliveryDate);
    const notification = await store.createNotification({
      type: "material_delivery_due",
      message,
      projectId,
      recipientId: AUTO_NOTIFICATION_RECIPIENT_ID,
      priority: priorityFromDaysUntilDelivery(daysUntilDelivery),
    });
    existingNotifications.push(notification);
    createdNotifications.push(notification);
  }

  return createdNotifications;
}

export async function createChangeOrderCreatedNotification(
  store: ApiStore,
  changeOrder: ApiChangeOrderRecord,
): Promise<ApiNotificationRecord> {
  return store.createNotification({
    type: "change_order_created",
    message: buildChangeOrderMessage(changeOrder),
    projectId: changeOrder.projectId,
    recipientId: AUTO_NOTIFICATION_RECIPIENT_ID,
    priority: "high",
  });
}

export function buildJapaneseDailyDigest(
  notifications: ApiNotificationRecord[],
  date: string = formatDate(new Date()),
) {
  const todaysNotifications = notifications.filter((notification) => notification.createdAt.startsWith(date));
  const unreadAll = notifications.filter((notification) => !notification.read).length;

  if (todaysNotifications.length === 0) {
    return {
      date,
      summary: `本日（${date}）の新着通知はありません。未読通知は${unreadAll}件です。`,
      totals: {
        today: 0,
        unreadToday: 0,
        unreadAll,
        highPriorityToday: 0,
      },
    };
  }

  const unreadToday = todaysNotifications.filter((notification) => !notification.read).length;
  const highPriorityToday = todaysNotifications.filter(
    (notification) => notification.priority === "high",
  ).length;
  const typeCounts = {
    task: todaysNotifications.filter((notification) => notification.type === "task_status_changed").length,
    material: todaysNotifications.filter((notification) => notification.type === "material_delivery_due").length,
    change: todaysNotifications.filter((notification) => notification.type === "change_order_created").length,
  };
  const otherCount =
    todaysNotifications.length - typeCounts.task - typeCounts.material - typeCounts.change;

  const summary = [
    `本日（${date}）の通知は${todaysNotifications.length}件です。未読は${unreadToday}件、優先度高は${highPriorityToday}件です。`,
    `内訳はタスク更新${typeCounts.task}件、資材納品${typeCounts.material}件、変更指示${typeCounts.change}件、その他${otherCount}件です。`,
  ].join(" ");

  return {
    date,
    summary,
    totals: {
      today: todaysNotifications.length,
      unreadToday,
      unreadAll,
      highPriorityToday,
    },
  };
}
