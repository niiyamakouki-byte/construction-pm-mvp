import { requireExistingDocument, requireExistingProject } from "../route-helpers.js";
import { serializeDocument, serializeDocumentVersion } from "../serialization.js";
import { created, noContent, ok } from "../responses.js";
import { ApiError, DOCUMENT_TYPES, type ApiRouteHandler, type DocumentType } from "../types.js";
import { validateCreateDocumentInput, validateUpdateDocumentInput } from "../validation.js";

function parseDocumentTypeFilter(value: string | null): DocumentType | undefined {
  if (value === null) {
    return undefined;
  }

  if (!DOCUMENT_TYPES.includes(value as DocumentType)) {
    const allowedValues = DOCUMENT_TYPES.map((item) => `「${item}」`).join("、");
    throw new ApiError(400, `type は${allowedValues}のいずれかを指定してください。`);
  }

  return value as DocumentType;
}

export const handleDocumentsRoutes: ApiRouteHandler = async ({ pathname, request, store, url }) => {
  const projectDocumentsMatch = pathname.match(/^\/api\/projects\/([^/]+)\/documents$/);
  if (projectDocumentsMatch) {
    const projectId = decodeURIComponent(projectDocumentsMatch[1]);
    await requireExistingProject(store, projectId);

    if (request.method === "GET") {
      const type = parseDocumentTypeFilter(url.searchParams.get("type"));
      return ok({
        documents: (await store.listDocuments(projectId, { type })).map(serializeDocument),
      });
    }

    if (request.method === "POST") {
      const input = validateCreateDocumentInput(request.body ?? {});
      const document = await store.createDocument(projectId, input);
      return created({
        document: serializeDocument(document),
      });
    }
  }

  const documentVersionsMatch = pathname.match(/^\/api\/documents\/([^/]+)\/versions$/);
  if (request.method === "GET" && documentVersionsMatch) {
    const documentId = decodeURIComponent(documentVersionsMatch[1]);
    await requireExistingDocument(store, documentId);
    return ok({
      versions: (await store.listDocumentVersions(documentId)).map(serializeDocumentVersion),
    });
  }

  const documentMatch = pathname.match(/^\/api\/documents\/([^/]+)$/);
  if (!documentMatch) {
    return null;
  }

  const documentId = decodeURIComponent(documentMatch[1]);

  if (request.method === "GET") {
    const document = await requireExistingDocument(store, documentId);
    return ok({
      document: serializeDocument(document),
    });
  }

  if (request.method === "PATCH") {
    await requireExistingDocument(store, documentId);
    const input = validateUpdateDocumentInput(request.body ?? {});
    const document = await store.updateDocument(documentId, input);
    if (!document) {
      throw new ApiError(404, "指定されたドキュメントが見つかりません。");
    }

    return ok({
      document: serializeDocument(document),
    });
  }

  if (request.method === "DELETE") {
    const deleted = await store.deleteDocument(documentId);
    if (!deleted) {
      throw new ApiError(404, "指定されたドキュメントが見つかりません。");
    }

    return noContent();
  }

  return null;
};
