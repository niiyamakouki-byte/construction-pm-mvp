import { requireExistingProject } from "../route-helpers.js";
import { serializeChangeOrder } from "../serialization.js";
import { created, ok } from "../responses.js";
import type { ApiRouteHandler } from "../types.js";
import { validateCreateChangeOrderInput } from "../validation.js";

export const handleChangesRoutes: ApiRouteHandler = async ({ pathname, request, store }) => {
  const projectChangesMatch = pathname.match(/^\/api\/projects\/([^/]+)\/changes$/);
  if (!projectChangesMatch) {
    return null;
  }

  const projectId = decodeURIComponent(projectChangesMatch[1]);
  await requireExistingProject(store, projectId);

  if (request.method === "GET") {
    return ok({
      changes: (await store.listChangeOrders(projectId)).map(serializeChangeOrder),
    });
  }

  if (request.method === "POST") {
    const input = validateCreateChangeOrderInput(request.body ?? {});
    const changeOrder = await store.createChangeOrder(projectId, input);
    return created({
      change: serializeChangeOrder(changeOrder),
    });
  }

  return null;
};
