import type { Notification } from "../domain/types.js";
import { createAppRepository } from "../infra/create-app-repository.js";
import type { Repository } from "../domain/repository.js";

export function createNotificationRepository(
  getOrganizationId?: () => string | null,
): Repository<Notification> {
  return createAppRepository<Notification>("notifications", getOrganizationId);
}
