import { handleChangesRoutes } from "./routes/changes.js";
import { handleContractorsRoutes } from "./routes/contractors.js";
import { handleDocumentsRoutes } from "./routes/documents.js";
import { buildHealthPayload } from "./health.js";
import { handleMaterialsRoutes } from "./routes/materials.js";
import { handleNotificationsRoutes } from "./routes/notifications.js";
import { handleProjectsRoutes } from "./routes/projects.js";
import { handleTasksRoutes } from "./routes/tasks.js";
import { requireApiKey } from "./route-helpers.js";
import { noContent, ok } from "./responses.js";
import { ApiError, type ApiRequest, type ApiResponse, type ApiStore } from "./types.js";

const routeHandlers = [
  handleNotificationsRoutes,
  handleContractorsRoutes,
  handleDocumentsRoutes,
  handleMaterialsRoutes,
  handleChangesRoutes,
  handleTasksRoutes,
  handleProjectsRoutes,
];

export async function handleApiRequest(request: ApiRequest, store: ApiStore): Promise<ApiResponse> {
  const url = new URL(request.url ?? "/", "http://127.0.0.1");
  const pathname = url.pathname;

  if (request.method === "OPTIONS") {
    return noContent();
  }

  if (request.method === "GET" && pathname === "/api/health") {
    return ok(await buildHealthPayload({ store }));
  }

  requireApiKey(request.headers);

  for (const handler of routeHandlers) {
    const result = await handler({ request, url, pathname, store });
    if (result) {
      return result;
    }
  }

  throw new ApiError(404, "指定されたエンドポイントが見つかりません。");
}
