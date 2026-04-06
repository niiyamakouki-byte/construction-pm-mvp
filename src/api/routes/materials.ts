import { requireExistingProject } from "../route-helpers.js";
import { serializeMaterial } from "../serialization.js";
import { created, ok } from "../responses.js";
import type { ApiRouteHandler } from "../types.js";
import { validateCreateMaterialInput } from "../validation.js";

export const handleMaterialsRoutes: ApiRouteHandler = async ({ pathname, request, store }) => {
  const projectMaterialsMatch = pathname.match(/^\/api\/projects\/([^/]+)\/materials$/);
  if (!projectMaterialsMatch) {
    return null;
  }

  const projectId = decodeURIComponent(projectMaterialsMatch[1]);
  await requireExistingProject(store, projectId);

  if (request.method === "GET") {
    return ok({
      materials: (await store.listMaterials(projectId)).map(serializeMaterial),
    });
  }

  if (request.method === "POST") {
    const input = validateCreateMaterialInput(request.body ?? {});
    const material = await store.createMaterial(projectId, input);
    return created({
      material: serializeMaterial(material),
    });
  }

  return null;
};
