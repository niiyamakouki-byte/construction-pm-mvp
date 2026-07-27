/**
 * share-token-handler.ts — /api/share-token のテスタブルなコア。
 *
 * 背景 (2026-07-27 セキュリティ監査・HIGH):
 *   旧実装 (src/lib/share-token.ts の createShareToken/verifySignedToken) は
 *   HMAC-SHA256 の署名・検証をブラウザの crypto.subtle で行っており、
 *   署名鍵を import.meta.env.VITE_SHARE_TOKEN_SECRET から読んでいた。
 *   VITE_ 接頭辞の環境変数は Vite がビルド時にクライアントJSへ埋め込むため、
 *   「サーバー専用の署名鍵」のはずが実際にはブラウザに露出していた。
 *   さらに本番 Vercel に当該変数が未設定だったため、ハードコードされた
 *   開発用フォールバック鍵がコード内に平文で存在し、それが使われる状態だった。
 *
 * このファイルは署名・検証をサーバー専用（Vercel Serverless Function）に移す。
 *   - 署名鍵は SHARE_TOKEN_SECRET（VITE_ 接頭辞なし）。サーバーの process.env にのみ存在し、
 *     Vite のクライアントバンドルには一切含まれない。
 *   - 鍵が未設定の場合は弱い鍵にフォールバックせず ShareTokenSecretMissingError を投げて失敗する
 *     （黙って弱い鍵で動き続ける方が事故の本体であるため、安全側に倒す）。
 *   - action=create（トークン発行）は Authorization: Bearer <supabase-jwt> を必須にする。
 *     署名鍵を守っても、発行 API 自体が無認証で任意の projectId を受け付けるなら
 *     「誰でも任意プロジェクトの有効なトークンを得られる」という同型の脆弱性が残るため。
 *   - action=verify（施主が共有リンクを開く側）は無認証のままでよい
 *     （共有リンクは受け取った本人がログインなしで開ける設計が意図であるため）。
 */

import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import {
  verifyBearerAuth,
  type SupabaseAuthVerifier,
} from "./auth-helper.js";

export const SHARE_TOKEN_ENDPOINT = "/api/share-token";

export class ShareTokenSecretMissingError extends Error {
  constructor() {
    super(
      "SHARE_TOKEN_SECRET が設定されていません。共有トークンの発行・検証はできません（Vercel の環境変数を設定してください）",
    );
    this.name = "ShareTokenSecretMissingError";
  }
}

function getShareTokenSecret(env: NodeJS.ProcessEnv): string {
  const secret = env.SHARE_TOKEN_SECRET;
  if (!secret) {
    throw new ShareTokenSecretMissingError();
  }
  return secret;
}

function toBase64Url(buf: Buffer): string {
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function fromBase64Url(s: string): Buffer {
  const padded = s.replace(/-/g, "+").replace(/_/g, "/");
  const pad = (4 - (padded.length % 4)) % 4;
  return Buffer.from(padded + "=".repeat(pad), "base64");
}

/** SHA-256 ハッシュを base64url で返す。パスワード保存・比較に使用。鍵不要。 */
export function hashPasswordServer(plain: string): string {
  return toBase64Url(createHash("sha256").update(plain, "utf8").digest());
}

function signClaimsB64(claimsB64: string, secret: string): string {
  return toBase64Url(createHmac("sha256", secret).update(claimsB64).digest());
}

/** 定数時間比較（タイミング攻撃対策）。長さが違う場合は即 false。 */
function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export type SignedTokenClaims = {
  projectId: string;
  issuedAt: number;
  expiresAt: number;
  passwordHash?: string;
};

export type SignedTokenVerifyResult = {
  valid: boolean;
  projectId?: string;
  expired?: boolean;
  requiresPassword?: boolean;
  tampered?: boolean;
};

/**
 * HMAC-SHA256 署名付き共有トークンを発行する（サーバー専用）。
 * @throws ShareTokenSecretMissingError SHARE_TOKEN_SECRET 未設定時
 */
export function createSignedShareToken(
  projectId: string,
  options: { expiresInDays: number; password?: string },
  env: NodeJS.ProcessEnv,
): string {
  const secret = getShareTokenSecret(env);
  const { expiresInDays, password } = options;
  const now = Date.now();
  const expiresAt = now + expiresInDays * 24 * 60 * 60 * 1000;

  const claims: SignedTokenClaims = { projectId, issuedAt: now, expiresAt };
  if (password !== undefined && password !== "") {
    claims.passwordHash = hashPasswordServer(password);
  }

  const claimsB64 = toBase64Url(Buffer.from(JSON.stringify(claims), "utf8"));
  const sig = signClaimsB64(claimsB64, secret);
  return `${claimsB64}.${sig}`;
}

/**
 * HMAC-SHA256 署名付きトークンを検証する（サーバー専用）。
 * @throws ShareTokenSecretMissingError SHARE_TOKEN_SECRET 未設定時
 */
export function verifySignedShareToken(
  token: string,
  password: string | undefined,
  env: NodeJS.ProcessEnv,
): SignedTokenVerifyResult {
  const secret = getShareTokenSecret(env);

  const dotIdx = token.lastIndexOf(".");
  if (dotIdx === -1) {
    return { valid: false, tampered: true };
  }

  const claimsB64 = token.slice(0, dotIdx);
  const providedSig = token.slice(dotIdx + 1);
  const expectedSig = signClaimsB64(claimsB64, secret);
  if (!safeEqual(expectedSig, providedSig)) {
    return { valid: false, tampered: true };
  }

  let claims: SignedTokenClaims;
  try {
    claims = JSON.parse(fromBase64Url(claimsB64).toString("utf8")) as SignedTokenClaims;
  } catch {
    return { valid: false, tampered: true };
  }

  const { projectId, expiresAt, passwordHash } = claims;

  if (Date.now() > expiresAt) {
    return { valid: false, projectId, expired: true };
  }

  if (passwordHash !== undefined) {
    if (password === undefined || password === "") {
      return { valid: false, projectId, requiresPassword: true };
    }
    const inputHash = hashPasswordServer(password);
    if (!safeEqual(inputHash, passwordHash)) {
      return { valid: false, projectId, requiresPassword: true };
    }
  }

  return { valid: true, projectId };
}

// ── Vercel handler ───────────────────────────────────────────────────────────

export type ShareTokenRequest = {
  method?: string;
  headers?: Record<string, string | string[] | undefined>;
  body?: unknown;
};

export type ShareTokenResponse = {
  status: (code: number) => ShareTokenResponse;
  json: (body: unknown) => ShareTokenResponse;
  setHeader?: (name: string, value: string) => void;
};

export type ShareTokenHandlerDeps = {
  auth: SupabaseAuthVerifier;
  /** テスト注入用。デフォルトは process.env。 */
  env?: NodeJS.ProcessEnv;
};

type ShareTokenRequestBody =
  | {
      action: "create";
      projectId?: string;
      expiresInDays?: number;
      password?: string;
    }
  | { action: "verify"; token?: string; password?: string };

function readBody(req: ShareTokenRequest): ShareTokenRequestBody | null {
  if (req.body == null) return null;
  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body) as ShareTokenRequestBody;
    } catch {
      return null;
    }
  }
  return req.body as ShareTokenRequestBody;
}

export async function handleShareTokenRequest(
  req: ShareTokenRequest,
  res: ShareTokenResponse,
  deps: ShareTokenHandlerDeps,
): Promise<void> {
  if (req.method !== "POST") {
    res.setHeader?.("Allow", "POST");
    res.status(405).json({ error: "POST のみ受け付けます" });
    return;
  }

  const env = deps.env ?? process.env;
  const body = readBody(req);
  if (!body || (body.action !== "create" && body.action !== "verify")) {
    res.status(400).json({ error: "action は 'create' または 'verify' が必要です" });
    return;
  }

  try {
    if (body.action === "create") {
      // 発行は担当者のみ。無認証で誰でも任意の projectId のトークンを発行できると、
      // 署名鍵を守っても実質的に同じ脆弱性が別経路で残るため。
      const authResult = await verifyBearerAuth(deps.auth, req.headers);
      if (!authResult.ok) {
        res.status(401).json({ error: authResult.error });
        return;
      }
      if (!body.projectId || typeof body.expiresInDays !== "number") {
        res.status(400).json({ error: "projectId と expiresInDays(number) が必要です" });
        return;
      }
      const token = createSignedShareToken(
        body.projectId,
        { expiresInDays: body.expiresInDays, password: body.password },
        env,
      );
      res.status(200).json({ token });
      return;
    }

    // verify: 共有リンクを受け取った施主本人が呼ぶ想定なので無認証で受け付ける。
    if (!body.token) {
      res.status(400).json({ error: "token が必要です" });
      return;
    }
    const result = verifySignedShareToken(body.token, body.password, env);
    res.status(200).json(result);
  } catch (err) {
    if (err instanceof ShareTokenSecretMissingError) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.status(500).json({ error: err instanceof Error ? err.message : "内部エラー" });
  }
}
