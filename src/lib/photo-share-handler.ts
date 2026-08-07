/** laporta-beads-yf4or — Codex implementation, 2026-08-07. */
import { createHash, randomBytes } from "node:crypto";
import { verifyBearerAuth, type SupabaseAuthVerifier } from "./auth-helper.js";

export type PhotoShareRequest = {
  method?: string;
  headers?: Record<string, string | string[] | undefined>;
  body?: unknown;
};

export type PhotoShareResponse = {
  status(code: number): PhotoShareResponse;
  json(body: unknown): void;
};

export type PhotoShareRecord = {
  projectId: string;
  expiresAt: string;
  revokedAt: string | null;
};

export type SharedPhotoRecord = {
  id: string;
  storageBucket: string;
  storagePath: string;
  fileName: string;
  category: string | null;
  caption: string | null;
  takenAt: string;
};

export type PhotoShareDatabase = {
  isProjectMember(projectId: string, userId: string): Promise<boolean>;
  createShare(input: {
    projectId: string;
    tokenHash: string;
    expiresAt: string;
    createdBy: string;
  }): Promise<void>;
  findShare(tokenHash: string): Promise<PhotoShareRecord | null>;
  getProjectName(projectId: string): Promise<string | null>;
  listPhotos(projectId: string): Promise<SharedPhotoRecord[]>;
  createSignedPhotoUrl(bucket: string, path: string, expiresInSeconds: number): Promise<string>;
};

export type PhotoShareHandlerDeps = {
  auth: SupabaseAuthVerifier;
  db: PhotoShareDatabase;
  now?: () => Date;
  randomToken?: () => string;
};

type CreateBody = { action: "create"; projectId: string; expiresInDays: number };
type ReadBody = { action: "read"; token: string };

export function hashPhotoShareToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

function parseBody(body: unknown): CreateBody | ReadBody | null {
  if (!body || typeof body !== "object" || !("action" in body)) return null;
  if (body.action === "create" && "projectId" in body && "expiresInDays" in body) {
    return body as CreateBody;
  }
  if (body.action === "read" && "token" in body) return body as ReadBody;
  return null;
}

export async function handlePhotoShareRequest(
  req: PhotoShareRequest,
  res: PhotoShareResponse,
  deps: PhotoShareHandlerDeps,
): Promise<void> {
  if (req.method !== "POST") {
    res.status(405).json({ error: "POSTのみ対応しています" });
    return;
  }

  const body = parseBody(req.body);
  if (!body) {
    res.status(400).json({ error: "action=create または action=read を指定してください" });
    return;
  }

  const now = deps.now?.() ?? new Date();

  try {
    if (body.action === "create") {
      const authResult = await verifyBearerAuth(deps.auth, req.headers);
      if (!authResult.ok) {
        res.status(401).json({ error: authResult.error });
        return;
      }
      if (
        typeof body.projectId !== "string" ||
        body.projectId.length === 0 ||
        !Number.isInteger(body.expiresInDays) ||
        body.expiresInDays < 1 ||
        body.expiresInDays > 30
      ) {
        res.status(400).json({ error: "projectId と1〜30日の有効期限が必要です" });
        return;
      }
      if (!(await deps.db.isProjectMember(body.projectId, authResult.user.id))) {
        res.status(403).json({ error: "この案件の共有リンクは発行できません" });
        return;
      }

      const token = deps.randomToken?.() ?? randomBytes(32).toString("base64url");
      const expiresAt = new Date(
        now.getTime() + body.expiresInDays * 24 * 60 * 60 * 1000,
      ).toISOString();
      await deps.db.createShare({
        projectId: body.projectId,
        tokenHash: hashPhotoShareToken(token),
        expiresAt,
        createdBy: authResult.user.id,
      });
      res.status(201).json({ token, expiresAt });
      return;
    }

    if (typeof body.token !== "string" || body.token.length < 20) {
      res.status(403).json({ error: "共有リンクが無効です" });
      return;
    }
    const share = await deps.db.findShare(hashPhotoShareToken(body.token));
    if (!share || share.revokedAt || new Date(share.expiresAt).getTime() <= now.getTime()) {
      res.status(403).json({ error: "共有リンクは無効または期限切れです" });
      return;
    }

    const [projectName, photos] = await Promise.all([
      deps.db.getProjectName(share.projectId),
      deps.db.listPhotos(share.projectId),
    ]);
    if (!projectName) {
      res.status(403).json({ error: "共有対象の案件が見つかりません" });
      return;
    }
    const secondsUntilExpiry = Math.max(
      60,
      Math.min(3600, Math.floor((new Date(share.expiresAt).getTime() - now.getTime()) / 1000)),
    );
    const sharedPhotos = await Promise.all(
      photos.map(async (photo) => ({
        id: photo.id,
        url: await deps.db.createSignedPhotoUrl(
          photo.storageBucket,
          photo.storagePath,
          secondsUntilExpiry,
        ),
        fileName: photo.fileName,
        category: photo.category,
        caption: photo.caption,
        takenAt: photo.takenAt,
      })),
    );
    res.status(200).json({
      projectId: share.projectId,
      projectName,
      expiresAt: share.expiresAt,
      photos: sharedPhotos,
    });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "内部エラー" });
  }
}
