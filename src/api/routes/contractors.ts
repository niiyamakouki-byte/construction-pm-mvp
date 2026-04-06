import { serializeContractor } from "../serialization.js";
import { created, ok } from "../responses.js";
import type { ApiRouteHandler } from "../types.js";
import { validateCreateContractorInput } from "../validation.js";

export const handleContractorsRoutes: ApiRouteHandler = async ({ pathname, request, store }) => {
  if (pathname !== "/api/contractors") {
    return null;
  }

  if (request.method === "GET") {
    return ok({
      contractors: (await store.listContractors()).map(serializeContractor),
    });
  }

  if (request.method === "POST") {
    const input = validateCreateContractorInput(request.body ?? {});
    const contractor = await store.createContractor(input);
    return created({
      contractor: serializeContractor(contractor),
    });
  }

  return null;
};
