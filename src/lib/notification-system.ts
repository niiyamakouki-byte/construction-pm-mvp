/**
 * Notification system — send, read, and manage user notifications.
 */

export type NotificationPriority = "low" | "normal" | "high" | "urgent";
export type NotificationType = "info" | "warning" | "alert" | "task";

export type Notification = {
  id: string;
  userId: string;
  type: NotificationType;
  message: string;
  priority: NotificationPriority;
  timestamp: string;
  read: boolean;
};

// In-memory store
const notifications: Map<string, Notification[]> = new Map();
let nextId = 1;

export class NotificationManager {
  send(
    userId: string,
    message: string,
    priority: NotificationPriority = "normal",
    type: NotificationType = "info",
  ): Notification {
    const notification: Notification = {
      id: `notif-${nextId++}`,
      userId,
      type,
      message,
      priority,
      timestamp: new Date().toISOString(),
      read: false,
    };
    const list = notifications.get(userId) ?? [];
    list.push(notification);
    notifications.set(userId, list);
    return notification;
  }

  getUnread(userId: string): Notification[] {
    const list = notifications.get(userId) ?? [];
    return list.filter((n) => !n.read);
  }

  getAll(userId: string): Notification[] {
    return [...(notifications.get(userId) ?? [])];
  }

  markAsRead(id: string): boolean {
    for (const list of notifications.values()) {
      const n = list.find((n) => n.id === id);
      if (n) {
        n.read = true;
        return true;
      }
    }
    return false;
  }

  markAllAsRead(userId: string): number {
    const list = notifications.get(userId) ?? [];
    let count = 0;
    list.forEach((n) => {
      if (!n.read) {
        n.read = true;
        count++;
      }
    });
    return count;
  }

  clear(): void {
    notifications.clear();
    nextId = 1;
  }
}
