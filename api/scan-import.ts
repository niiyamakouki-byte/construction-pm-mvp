/**
 * /api/scan-import — LaPorta Scan（RoomPlanスキャンパイプライン, bead 4h6dm/7srcc）の
 * 出力を GenbaHub 案件として取り込むサーバー関数。
 *
 * Vercel Serverless Function として動く。認証済みユーザーの Supabase JWT を受け取り、
 * サーバー側で Service Role キーを使って案件・写真・間取り画像を作成する
 * （ブラウザ/スキャン端末に Service Role キーを渡さないための中継）。
 *
 * セキュリティ:
 *   - Authorization: Bearer <supabase-jwt> を必須（401 で拒否）
 *   - ユーザー単位で 5 req/min のレートリミット（429 + Retry-After）
 *   - 写真は1枚10MB、間取り画像は25MB上限（413）
 *
 * 必要な環境変数:
 *   SUPABASE_URL              — Supabase プロジェクト URL（必須）
 *   SUPABASE_SERVICE_ROLE_KEY — Supabase Service Role キー（必須。JWT 検証 + 書き込み用）
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  handleScanImport,
  type ScanImportDb,
  type ScanImportRequest,
  type ScanImportResponse,
} from "../src/lib/scan-import-handler.js";
import { asSupabaseAuthVerifier } from "../src/lib/auth-helper.js";
import { createSupabaseRateLimitStore } from "../src/lib/rate-limiter.js";

const SIGNED_URL_EXPIRES_IN_SECONDS = 60 * 60 * 24 * 7;

function createScanImportDb(supabase: SupabaseClient): ScanImportDb {
  return {
    async insertProject(row) {
      const { error } = await supabase.from("projects").insert({
        id: row.id,
        name: row.name,
        description: row.description,
        status: row.status,
        start_date: row.startDate,
        address: row.address,
      });
      return { error };
    },
    async uploadFile({ bucket, path, data, contentType }) {
      const storage = supabase.storage.from(bucket);
      const { error: uploadError } = await storage.upload(path, data, {
        cacheControl: "3600",
        contentType,
        upsert: false,
      });
      if (uploadError) return { url: "", error: uploadError };
      const { data: signed, error: signError } = await storage.createSignedUrl(
        path,
        SIGNED_URL_EXPIRES_IN_SECONDS,
      );
      if (signError || !signed?.signedUrl) {
        await storage.remove([path]);
        return { url: "", error: signError ?? { message: "署名付きURLの生成に失敗しました" } };
      }
      return { url: signed.signedUrl, error: null };
    },
    async insertPhoto(row) {
      const { error } = await supabase.from("photos").insert({
        id: row.id,
        project_id: row.projectId,
        storage_bucket: row.storageBucket,
        storage_path: row.storagePath,
        url: row.url,
        file_name: row.fileName,
        content_type: row.contentType,
        file_size: row.fileSize,
        category: row.category,
        caption: row.caption,
        taken_at: row.takenAt,
      });
      return { error };
    },
    async insertDocument(row) {
      const { error } = await supabase.from("documents").insert({
        id: row.id,
        project_id: row.projectId,
        name: row.name,
        type: row.type,
        url: row.url,
        uploaded_by: row.uploadedBy,
        version: row.version,
      });
      return { error };
    },
  };
}

export default async function handler(
  req: ScanImportRequest,
  res: ScanImportResponse,
): Promise<void> {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    res.status(500).json({
      error:
        "SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY が未設定です（Vercel の環境変数を設定してください）",
    });
    return;
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  await handleScanImport(req, res, {
    auth: asSupabaseAuthVerifier(supabase.auth),
    rateLimitStore: createSupabaseRateLimitStore(supabase),
    db: createScanImportDb(supabase),
  });
}
