import { serializeDocument, serializeProject, serializeTask } from "../serialization.js";
import { ApiError, type ApiRouteHandler } from "../types.js";
import { ok } from "../responses.js";

type Pagination = {
  page: number;
  perPage: number;
  offset: number;
};

const DEFAULT_PAGE = 1;
const DEFAULT_PER_PAGE = 20;
const MAX_PER_PAGE = 100;

function parsePagination(url: URL): Pagination {
  const rawPage = Number.parseInt(url.searchParams.get("page") ?? "", 10);
  const rawPerPage = Number.parseInt(url.searchParams.get("per_page") ?? "", 10);
  const page = Number.isFinite(rawPage) && rawPage >= 1 ? rawPage : DEFAULT_PAGE;
  const perPage =
    Number.isFinite(rawPerPage) && rawPerPage >= 1
      ? Math.min(rawPerPage, MAX_PER_PAGE)
      : DEFAULT_PER_PAGE;

  return { page, perPage, offset: (page - 1) * perPage };
}

function withPagination<T>(items: T[], pagination: Pagination) {
  return {
    data: items.slice(pagination.offset, pagination.offset + pagination.perPage),
    meta: {
      total: items.length,
      page: pagination.page,
      perPage: pagination.perPage,
    },
  };
}

function gatewayOk<T>(items: T[], pagination: Pagination) {
  const page = withPagination(items, pagination);
  return ok({
    success: true,
    data: page.data,
    meta: page.meta,
  });
}

export const handleV1GatewayRoutes: ApiRouteHandler = async ({ request, url, pathname, store }) => {
  if (!pathname.startsWith("/api/v1/")) {
    return null;
  }

  if (request.method !== "GET") {
    throw new ApiError(405, "このエンドポイントではGETのみ利用できます。");
  }

  const pagination = parsePagination(url);

  if (pathname === "/api/v1/projects") {
    const projects = (await store.listProjects()).map((project) => serializeProject(project));
    return gatewayOk(projects, pagination);
  }

  const projectMatch = pathname.match(/^\/api\/v1\/projects\/([^/]+)$/);
  if (projectMatch) {
    const project = await store.getProject(decodeURIComponent(projectMatch[1]));
    return ok({ success: true, data: project ? serializeProject(project) : null });
  }

  const tasksMatch = pathname.match(/^\/api\/v1\/projects\/([^/]+)\/tasks$/);
  if (tasksMatch) {
    const tasks = (await store.listTasks(decodeURIComponent(tasksMatch[1]))).map(serializeTask);
    return gatewayOk(tasks, pagination);
  }

  const photosMatch = pathname.match(/^\/api\/v1\/projects\/([^/]+)\/photos$/);
  if (photosMatch) {
    const photos = (await store.listDocuments(decodeURIComponent(photosMatch[1]), { type: "photo" })).map(
      serializeDocument,
    );
    return gatewayOk(photos, pagination);
  }

  const entriesMatch = pathname.match(/^\/api\/v1\/projects\/([^/]+)\/entries$/);
  if (entriesMatch) {
    return gatewayOk([], pagination);
  }

  return null;
};
