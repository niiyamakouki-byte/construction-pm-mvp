import type { DocumentType } from "../../domain/types.js";
import { getSupabaseClient, hasSupabaseEnv, type SupabaseClientLike } from "../supabase-client.js";

/**
 * ドキュメントタブのドラッグ&ドロップ一括インポート用ストレージ層。
 * 既存の `documents` テーブル（url参照方式）はそのまま使い、
 * ここではドロップされたファイル本体をSupabase Storageへアップロードして
 * 署名付きURLを払い出すことだけを担う（写真の `photo-repository.ts` と同系統の実装）。
 */
export const DOCUMENT_STORAGE_BUCKET = "project-documents";
export const MAX_DOCUMENT_FILE_SIZE = 25 * 1024 * 1024;
const SIGNED_URL_EXPIRES_IN_SECONDS = 60 * 60 * 24 * 7;

const ACCEPTED_DOCUMENT_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/heic",
  "image/heif",
  "image/webp",
];

const ACCEPTED_DOCUMENT_EXTENSIONS = /\.(pdf|png|jpe?g|heic|heif|webp)$/i;

export type UploadedDocumentFile = {
  url: string;
  storagePath: string | null;
  fileName: string;
  contentType: string;
  fileSize: number;
};

export type DocumentFileUploadDeps = {
  getClient?: () => Promise<SupabaseClientLike>;
  isE2EBypass?: () => boolean;
  idGenerator?: () => string;
  hasSupabaseEnv?: () => boolean;
};

function defaultIsE2EBypass(): boolean {
  return typeof window !== "undefined" && (window as { __E2E_BYPASS_AUTH__?: boolean }).__E2E_BYPASS_AUTH__ === true;
}

function fallbackRandomId(): string {
  const value = Math.random().toString(16).slice(2).padEnd(32, "0");
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20, 32)}`;
}

function defaultIdGenerator(): string {
  return globalThis.crypto?.randomUUID?.() ?? fallbackRandomId();
}

function getDocumentExtension(file: File): string {
  const extMatch = file.name.toLowerCase().match(/\.([a-z0-9]+)$/);
  if (extMatch) return extMatch[1];
  if (file.type === "application/pdf") return "pdf";
  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";
  return "jpg";
}

export function isSupportedDocumentFile(file: File): boolean {
  if (ACCEPTED_DOCUMENT_MIME_TYPES.includes(file.type)) return true;
  // 一部ブラウザ/OSはドラッグ&ドロップ時にMIMEを空で渡すため拡張子でも判定する
  return ACCEPTED_DOCUMENT_EXTENSIONS.test(file.name);
}

export function inferDocumentTypeFromFile(file: File): DocumentType {
  if (file.type.startsWith("image/") || /\.(png|jpe?g|heic|heif|webp)$/i.test(file.name)) {
    return "photo";
  }
  return "drawing";
}

export function validateDocumentFile(file: File): void {
  if (!isSupportedDocumentFile(file)) {
    throw new Error(`対応していないファイル形式です: ${file.name}`);
  }
  if (file.size === 0) {
    throw new Error(`ファイルが空です: ${file.name}`);
  }
  if (file.size > MAX_DOCUMENT_FILE_SIZE) {
    throw new Error(`ファイルサイズが上限(25MB)を超えています: ${file.name}`);
  }
}

/**
 * ドロップされたファイルをアップロードし、`documents.url` にそのまま使える
 * 参照URLを返す。
 *
 * - 本番(Supabase接続あり・E2Eバイパスでない): Storageへ実アップロードし署名付きURLを発行する。
 * - ローカル/E2Eバイパス時: Supabase未接続のためオブジェクトURL(`URL.createObjectURL`)で代替する。
 *   このURLは現在のブラウザタブ内でのみ有効で、リロードや別端末では参照できない
 *   （既存の `LocalStorageRepository` によるE2E/ローカル動作と同じ「本番相当ではない」制約）。
 */
export async function uploadProjectDocumentFile(
  file: File,
  projectId: string,
  deps: DocumentFileUploadDeps = {},
): Promise<UploadedDocumentFile> {
  validateDocumentFile(file);
  if (!projectId) {
    throw new Error("アップロード先の案件がありません");
  }

  const isE2EBypass = deps.isE2EBypass ?? defaultIsE2EBypass;
  const checkHasSupabaseEnv = deps.hasSupabaseEnv ?? hasSupabaseEnv;

  if (!checkHasSupabaseEnv() || isE2EBypass()) {
    return {
      url: URL.createObjectURL(file),
      storagePath: null,
      fileName: file.name,
      contentType: file.type || "application/octet-stream",
      fileSize: file.size,
    };
  }

  const getClient = deps.getClient ?? getSupabaseClient;
  const idGenerator = deps.idGenerator ?? defaultIdGenerator;
  const client = await getClient();
  const id = idGenerator();
  const storagePath = `${projectId}/${id}.${getDocumentExtension(file)}`;
  const storage = client.storage.from(DOCUMENT_STORAGE_BUCKET);

  const { error: uploadError } = await storage.upload(storagePath, file, {
    cacheControl: "3600",
    contentType: file.type || "application/octet-stream",
    upsert: false,
  });
  if (uploadError) {
    throw new Error(uploadError.message || "ドキュメントのアップロードに失敗しました");
  }

  const { data, error } = await storage.createSignedUrl(storagePath, SIGNED_URL_EXPIRES_IN_SECONDS);
  if (error || !data?.signedUrl) {
    await storage.remove([storagePath]);
    throw new Error(error?.message || "ドキュメントURLの生成に失敗しました");
  }

  return {
    url: data.signedUrl,
    storagePath,
    fileName: file.name,
    contentType: file.type || "application/octet-stream",
    fileSize: file.size,
  };
}

const SIGNED_URL_PATH_PATTERN = /\/storage\/v1\/object\/sign\/([^/]+)\/([^?]+)/;

/**
 * `documents.url` には発行時点の署名付きURL(7日期限)がそのまま保存されているため、
 * 期限が切れると保存済みドキュメントのプレビュー・共有・ダウンロードが全て失敗する。
 * ファイル本体はStorageに残っているので、URLに含まれるbucket/pathから
 * 新しい署名URLを表示・共有の直前に発行し直す。
 * Supabase Storageの署名URL以外(Drive・blob:等)や再署名に失敗した場合は元のURLを返す。
 */
export async function refreshDocumentUrl(url: string, deps: DocumentFileUploadDeps = {}): Promise<string> {
  const match = url.match(SIGNED_URL_PATH_PATTERN);
  if (!match) return url;

  const isE2EBypass = deps.isE2EBypass ?? defaultIsE2EBypass;
  const checkHasSupabaseEnv = deps.hasSupabaseEnv ?? hasSupabaseEnv;
  if (!checkHasSupabaseEnv() || isE2EBypass()) return url;

  try {
    const getClient = deps.getClient ?? getSupabaseClient;
    const client = await getClient();
    const [, bucket, rawPath] = match;
    const { data, error } = await client.storage
      .from(bucket)
      .createSignedUrl(decodeURIComponent(rawPath), SIGNED_URL_EXPIRES_IN_SECONDS);
    if (error || !data?.signedUrl) return url;
    return data.signedUrl;
  } catch {
    return url;
  }
}
