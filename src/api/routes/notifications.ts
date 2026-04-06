import {
  buildJapaneseDailyDigest,
  serializeNotificationsDescending,
} from "../notifications.js";
import { requireExistingProject } from "../route-helpers.js";
import { serializeNotification } from "../serialization.js";
import { created, ok } from "../responses.js";
import { ApiError, type ApiRouteHandler } from "../types.js";
import { validateCreateNotificationInput } from "../validation.js";

function parseReadFilter(value: string | null): boolean | undefined {
  if (value === null) {
    return undefined;
  }
  if (value === "true") {
    return true;
  }
  if (value === "false") {
    return false;
  }

  throw new ApiError(400, "read は true または false を指定してください。");
}

export const handleNotificationsRoutes: ApiRouteHandler = async ({
  pathname,
  request,
  store,
  url,
}) => {
  if (request.method === "GET" && pathname === "/api/notifications/unread-count") {
    return ok({
      unreadCount: await store.countUnreadNotifications(),
    });
  }

  if (request.method === "GET" && pathname === "/api/notifications/digest") {
    const notifications = await store.listNotifications();
    return ok(buildJapaneseDailyDigest(notifications));
  }

  if (pathname === "/api/notifications") {
    if (request.method === "GET") {
      const read = parseReadFilter(url.searchParams.get("read"));
      const notifications = await store.listNotifications({ read });
      return ok({
        notifications: serializeNotificationsDescending(notifications),
      });
    }

    if (request.method === "POST") {
      const input = validateCreateNotificationInput(request.body ?? {});
      await requireExistingProject(store, input.projectId);
      const notification = await store.createNotification(input);
      return created({
        notification: serializeNotification(notification),
      });
    }
  }

  const markReadMatch = pathname.match(/^\/api\/notifications\/([^/]+)\/read$/);
  if (request.method === "PATCH" && markReadMatch) {
    const notificationId = decodeURIComponent(markReadMatch[1]);
    const notification = await store.markNotificationRead(notificationId);
    if (!notification) {
      throw new ApiError(404, "指定された通知が見つかりません。");
    }

    return ok({
      notification: serializeNotification(notification),
    });
  }

  return null;
};
