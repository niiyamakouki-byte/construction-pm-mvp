import type { DocumentVersion, ProjectDocument } from "../domain/types.js";
import { createAppRepository } from "../infra/create-app-repository.js";
import type { Repository } from "../domain/repository.js";

/**
 * Returns a repository for ProjectDocument entities (現行版のドキュメント台帳).
 */
export function createDocumentRepository(
  getOrganizationId?: () => string | null,
): Repository<ProjectDocument> {
  return createAppRepository<ProjectDocument>("documents", getOrganizationId);
}

/**
 * Returns a repository for DocumentVersion entities (旧版スナップショット)。
 * 新バージョンをアップロードする際、更新前のドキュメントをここに退避する。
 */
export function createDocumentVersionRepository(
  getOrganizationId?: () => string | null,
): Repository<DocumentVersion> {
  return createAppRepository<DocumentVersion>("document_versions", getOrganizationId);
}
