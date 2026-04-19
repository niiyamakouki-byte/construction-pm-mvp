import { getSupabaseClient, type SupabaseClientLike } from "../supabase-client.js";

export const PHOTO_BUCKET = "construction-photos";
export const MAX_PHOTO_FILE_SIZE = 10 * 1024 * 1024;
const SIGNED_URL_EXPIRES_IN_SECONDS = 60 * 60 * 24 * 7;

type SupabaseError = { message: string } | null;

type DbPhotoRow = {
  id: string;
  project_id: string;
  task_id: string | null;
  storage_bucket: string;
  storage_path: string;
  url: string;
  file_name: string;
  content_type: string;
  file_size: number;
  category: string | null;
  caption: string | null;
  taken_at: string;
  created_at: string;
  updated_at: string;
};

export type PhotoUploadOptions = {
  category?: string;
  caption?: string;
};

export type UploadedPhoto = {
  id: string;
  url: string;
  projectId: string;
  taskId?: string;
  storagePath: string;
  fileName: string;
  contentType: string;
  fileSize: number;
  category?: string;
  caption?: string;
  takenAt: string;
  createdAt: string;
  updatedAt: string;
};

export type PhotoRepositoryDeps = {
  getClient?: () => Promise<SupabaseClientLike>;
  idGenerator?: () => string;
  now?: () => Date;
};

function assertNoSupabaseError(error: SupabaseError, fallback: string): void {
  if (error) {
    throw new Error(error.message || fallback);
  }
}

function getPhotoExtension(file: File): string {
  if (file.type === "image/jpeg") return "jpg";
  if (file.type === "image/png") return "png";
  if (file.type === "image/heic") return "heic";
  if (file.type === "image/heif") return "heif";
  return "jpg";
}

function validateUploadFile(file: File): void {
  if (!["image/jpeg", "image/png", "image/heic", "image/heif"].includes(file.type)) {
    throw new Error(`ファイル形式が非対応です: ${file.type || "不明"}`);
  }
  if (file.size > MAX_PHOTO_FILE_SIZE) {
    throw new Error("ファイルサイズが上限を超えています（上限10MB）");
  }
  if (file.size === 0) {
    throw new Error("ファイルが空です");
  }
}

function fallbackRandomId(): string {
  const value = Math.random().toString(16).slice(2).padEnd(32, "0");
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20, 32)}`;
}

function defaultIdGenerator(): string {
  return globalThis.crypto?.randomUUID?.() ?? fallbackRandomId();
}

function rowToPhoto(row: DbPhotoRow, url: string = row.url): UploadedPhoto {
  return {
    id: row.id,
    url,
    projectId: row.project_id,
    taskId: row.task_id ?? undefined,
    storagePath: row.storage_path,
    fileName: row.file_name,
    contentType: row.content_type,
    fileSize: row.file_size,
    category: row.category ?? undefined,
    caption: row.caption ?? undefined,
    takenAt: row.taken_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class PhotoRepository {
  private readonly getClient: () => Promise<SupabaseClientLike>;
  private readonly idGenerator: () => string;
  private readonly now: () => Date;

  constructor(deps: PhotoRepositoryDeps = {}) {
    this.getClient = deps.getClient ?? getSupabaseClient;
    this.idGenerator = deps.idGenerator ?? defaultIdGenerator;
    this.now = deps.now ?? (() => new Date());
  }

  private async createSignedUrl(client: SupabaseClientLike, path: string): Promise<string> {
    const { data, error } = await client
      .storage
      .from(PHOTO_BUCKET)
      .createSignedUrl(path, SIGNED_URL_EXPIRES_IN_SECONDS);
    assertNoSupabaseError(error, "写真URLの生成に失敗しました");
    if (!data?.signedUrl) {
      throw new Error("写真URLの生成に失敗しました");
    }
    return data.signedUrl;
  }

  async uploadPhoto(
    file: File,
    projectId: string,
    taskId?: string,
    options: PhotoUploadOptions = {},
  ): Promise<UploadedPhoto> {
    validateUploadFile(file);
    if (!projectId) {
      throw new Error("アップロード先の案件がありません");
    }

    const client = await this.getClient();
    const id = this.idGenerator();
    const takenAt = this.now().toISOString();
    const storagePath = `${projectId}/${id}.${getPhotoExtension(file)}`;
    const storage = client.storage.from(PHOTO_BUCKET);

    const { error: uploadError } = await storage.upload(storagePath, file, {
      cacheControl: "3600",
      contentType: file.type,
      upsert: false,
    });
    assertNoSupabaseError(uploadError, "写真のアップロードに失敗しました");

    let signedUrl: string;
    try {
      signedUrl = await this.createSignedUrl(client, storagePath);
    } catch (error) {
      await storage.remove([storagePath]);
      throw error;
    }

    const row = {
      id,
      project_id: projectId,
      task_id: taskId ?? null,
      storage_bucket: PHOTO_BUCKET,
      storage_path: storagePath,
      url: signedUrl,
      file_name: file.name,
      content_type: file.type,
      file_size: file.size,
      category: options.category ?? null,
      caption: options.caption ?? null,
      taken_at: takenAt,
      created_at: takenAt,
      updated_at: takenAt,
    };

    const query = client.from("photos").insert(row).select("*").single();
    const { data, error } = await query;
    if (error) {
      await storage.remove([storagePath]);
      throw new Error(error.message || "写真メタデータの保存に失敗しました");
    }
    return rowToPhoto((data ?? row) as DbPhotoRow, signedUrl);
  }

  async listPhotosByProject(projectId: string): Promise<UploadedPhoto[]> {
    if (!projectId) return [];
    const client = await this.getClient();
    const { data, error } = await client
      .from("photos")
      .select("*")
      .eq("project_id", projectId)
      .order("taken_at", { ascending: false });
    assertNoSupabaseError(error, "写真一覧の取得に失敗しました");
    const rows = Array.isArray(data) ? (data as DbPhotoRow[]) : [];
    return Promise.all(
      rows.map(async (row) => rowToPhoto(row, await this.createSignedUrl(client, row.storage_path))),
    );
  }
}

export function createPhotoRepository(deps?: PhotoRepositoryDeps): PhotoRepository {
  return new PhotoRepository(deps);
}
