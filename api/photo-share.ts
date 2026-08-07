/** laporta-beads-yf4or — Codex implementation, 2026-08-07; commit 881e1661e67e8bcf050cf75c884e8bd741a1013b. */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { asSupabaseAuthVerifier } from "../src/lib/auth-helper.js";
import {
  handlePhotoShareRequest,
  type PhotoShareDatabase,
  type PhotoShareRequest,
  type PhotoShareResponse,
  type SharedPhotoRecord,
} from "../src/lib/photo-share-handler.js";

function createDatabase(supabase: SupabaseClient): PhotoShareDatabase {
  return {
    async isProjectMember(projectId, userId) {
      const { data: project, error: projectError } = await supabase
        .from("projects")
        .select("organization_id")
        .eq("id", projectId)
        .maybeSingle();
      if (projectError) throw new Error(projectError.message);
      if (!project?.organization_id) return false;
      const { data: membership, error: membershipError } = await supabase
        .from("organization_members")
        .select("id")
        .eq("organization_id", project.organization_id)
        .eq("user_id", userId)
        .maybeSingle();
      if (membershipError) throw new Error(membershipError.message);
      return Boolean(membership);
    },
    async createShare(input) {
      const { error } = await supabase.from("photo_shares").insert({
        project_id: input.projectId,
        token_hash: input.tokenHash,
        expires_at: input.expiresAt,
        created_by: input.createdBy,
      });
      if (error) throw new Error(error.message);
    },
    async findShare(tokenHash) {
      const { data, error } = await supabase
        .from("photo_shares")
        .select("project_id, expires_at, revoked_at")
        .eq("token_hash", tokenHash)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data
        ? { projectId: data.project_id, expiresAt: data.expires_at, revokedAt: data.revoked_at }
        : null;
    },
    async getProjectName(projectId) {
      const { data, error } = await supabase
        .from("projects")
        .select("name")
        .eq("id", projectId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data?.name ?? null;
    },
    async listPhotos(projectId) {
      const { data, error } = await supabase
        .from("photos")
        .select("id, storage_bucket, storage_path, file_name, category, caption, taken_at")
        .eq("project_id", projectId)
        .order("taken_at", { ascending: false });
      if (error) throw new Error(error.message);
      return (data ?? []).map((photo): SharedPhotoRecord => ({
        id: photo.id,
        storageBucket: photo.storage_bucket,
        storagePath: photo.storage_path,
        fileName: photo.file_name,
        category: photo.category,
        caption: photo.caption,
        takenAt: photo.taken_at,
      }));
    },
    async createSignedPhotoUrl(bucket, path, expiresInSeconds) {
      const { data, error } = await supabase.storage
        .from(bucket)
        .createSignedUrl(path, expiresInSeconds);
      if (error || !data?.signedUrl) throw new Error(error?.message ?? "写真URLの生成に失敗しました");
      return data.signedUrl;
    },
  };
}

export default async function handler(
  req: PhotoShareRequest,
  res: PhotoShareResponse,
): Promise<void> {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    res.status(500).json({ error: "Supabaseサーバー環境変数が未設定です" });
    return;
  }
  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  await handlePhotoShareRequest(req, res, {
    auth: asSupabaseAuthVerifier(supabase.auth),
    db: createDatabase(supabase),
  });
}
