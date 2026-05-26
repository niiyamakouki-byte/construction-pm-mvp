/**
 * share-token.ts — 施主向け進捗共有リンクのトークン発行・検証
 *
 * UUIDv4 ベース。JWT 非依存（新規 npm install 禁止のため）。
 * ttl/oneTime/allowedIps/scope を payload に埋め込み、
 * share-token-store 経由で revoke/redeemed 状態を管理する。
 */

import {
  revokedTokens,
  redeemedTokens,
  appendShareAuditLog,
} from "./share-token-store.js";
import { isIpAllowed } from "./ip-allowlist.js";

export type ShareTokenScope = "progress" | "photos" | "all";

export type ShareTokenPayload = {
  tokenId: string;
  projectId: string;
  scope: ShareTokenScope;
  issuedAt: number; // Unix ms
  expiresAt: number; // Unix ms
  oneTime: boolean;
  allowedIps: string[];
};

export type ShareToken = {
  token: string; // base64url-encoded JSON payload
  payload: ShareTokenPayload;
};

export type VerifyShareTokenResult =
  | { ok: true; payload: ShareTokenPayload }
  | {
      ok: false;
      reason: "expired" | "revoked" | "redeemed" | "ip_blocked" | "invalid";
    };

const DEFAULT_TTL_MINUTES = 5;

/**
 * トークン文字列をデコードして payload を取り出す。
 * 失敗時は null を返す。
 */
function decodePayload(token: string): ShareTokenPayload | null {
  try {
    const json = atob(token.replace(/-/g, "+").replace(/_/g, "/"));
    const parsed = JSON.parse(json) as unknown;
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      !("tokenId" in parsed) ||
      !("projectId" in parsed)
    ) {
      return null;
    }
    return parsed as ShareTokenPayload;
  } catch {
    return null;
  }
}

/**
 * 施主向け共有トークンを発行する。
 *
 * @param projectId 対象プロジェクト ID
 * @param scope 共有するデータ範囲
 * @param opts オプション（ttlMinutes / oneTime / allowedIps）
 */
export function generateShareToken(
  projectId: string,
  scope: ShareTokenScope,
  opts?: {
    ttlMinutes?: number;
    oneTime?: boolean;
    allowedIps?: string[];
  },
): ShareToken {
  const ttlMinutes = opts?.ttlMinutes ?? DEFAULT_TTL_MINUTES;
  const oneTime = opts?.oneTime ?? false;
  const allowedIps = opts?.allowedIps ?? [];

  const now = Date.now();
  const tokenId = crypto.randomUUID();

  const payload: ShareTokenPayload = {
    tokenId,
    projectId,
    scope,
    issuedAt: now,
    expiresAt: now + ttlMinutes * 60 * 1000,
    oneTime,
    allowedIps,
  };

  const json = JSON.stringify(payload);
  const token = btoa(json)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  appendShareAuditLog({
    event: "issued",
    tokenId,
    projectId,
    ts: new Date(now).toISOString(),
  });

  return { token, payload };
}

/**
 * 共有トークンを検証する。
 *
 * @param token generateShareToken が返したトークン文字列
 * @param currentIp アクセス元 IP（省略時は IP チェックをスキップ）
 */
export function verifyShareToken(
  token: string,
  currentIp?: string,
): VerifyShareTokenResult {
  const payload = decodePayload(token);

  if (!payload) {
    appendShareAuditLog({
      event: "failed",
      tokenId: "unknown",
      projectId: "unknown",
      ts: new Date().toISOString(),
      reason: "invalid",
    });
    return { ok: false, reason: "invalid" };
  }

  const { tokenId, projectId, expiresAt, oneTime, allowedIps } = payload;
  const now = Date.now();

  if (now > expiresAt) {
    appendShareAuditLog({
      event: "failed",
      tokenId,
      projectId,
      ts: new Date().toISOString(),
      reason: "expired",
    });
    return { ok: false, reason: "expired" };
  }

  if (revokedTokens.has(tokenId)) {
    appendShareAuditLog({
      event: "failed",
      tokenId,
      projectId,
      ts: new Date().toISOString(),
      reason: "revoked",
    });
    return { ok: false, reason: "revoked" };
  }

  if (oneTime && redeemedTokens.has(tokenId)) {
    appendShareAuditLog({
      event: "failed",
      tokenId,
      projectId,
      ts: new Date().toISOString(),
      reason: "redeemed",
    });
    return { ok: false, reason: "redeemed" };
  }

  if (currentIp !== undefined && allowedIps.length > 0) {
    if (!isIpAllowed(currentIp, allowedIps)) {
      appendShareAuditLog({
        event: "failed",
        tokenId,
        projectId,
        ts: new Date().toISOString(),
        reason: "ip_blocked",
      });
      return { ok: false, reason: "ip_blocked" };
    }
  }

  appendShareAuditLog({
    event: "used",
    tokenId,
    projectId,
    ts: new Date().toISOString(),
  });

  return { ok: true, payload };
}

// ── Sprint 66: HMAC-SHA256 署名 + パスワード保護付き share token ──────────────

const DEV_SECRET = "genbahub-dev-secret-change-in-production";

function getSecret(): string {
  const secret =
    typeof import.meta !== "undefined"
      ? (import.meta.env?.VITE_SHARE_TOKEN_SECRET as string | undefined)
      : undefined;
  if (!secret) {
    if (typeof import.meta !== "undefined" && import.meta.env?.PROD) {
      console.warn(
        "[share-token] VITE_SHARE_TOKEN_SECRET is not set in production!",
      );
    }
    return DEV_SECRET;
  }
  return secret;
}

async function hmacSign(data: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  const bytes = new Uint8Array(sig);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * SHA-256 ハッシュを base64url で返す。パスワード保存・比較に使用。
 */
export async function hashPassword(plain: string): Promise<string> {
  const enc = new TextEncoder();
  const buf = await crypto.subtle.digest("SHA-256", enc.encode(plain));
  const bytes = new Uint8Array(buf);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export type SignedTokenOptions = {
  expiresInDays: number;
  password?: string;
};

export type SignedTokenVerifyResult = {
  valid: boolean;
  projectId?: string;
  expired?: boolean;
  requiresPassword?: boolean;
  tampered?: boolean;
};

type SignedTokenClaims = {
  projectId: string;
  issuedAt: number;
  expiresAt: number;
  passwordHash?: string;
};

/**
 * HMAC-SHA256 署名付き共有トークンを発行する。
 * @returns "claimsB64.signature" 形式の base64url トークン
 */
export async function createShareToken(
  projectId: string,
  options: SignedTokenOptions,
): Promise<string> {
  const { expiresInDays, password } = options;
  const now = Date.now();
  const expiresAt = now + expiresInDays * 24 * 60 * 60 * 1000;

  const claims: SignedTokenClaims = { projectId, issuedAt: now, expiresAt };

  if (password !== undefined && password !== "") {
    claims.passwordHash = await hashPassword(password);
  }

  const claimsJson = JSON.stringify(claims);
  const enc = new TextEncoder();
  const claimsB64 = btoa(
    String.fromCharCode(...enc.encode(claimsJson)),
  )
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  const sig = await hmacSign(claimsB64, getSecret());
  return `${claimsB64}.${sig}`;
}

/**
 * HMAC-SHA256 署名付きトークンを検証する。
 */
export async function verifySignedToken(
  token: string,
  password?: string,
): Promise<SignedTokenVerifyResult> {
  const dotIdx = token.lastIndexOf(".");
  if (dotIdx === -1) {
    return { valid: false, tampered: true };
  }

  const claimsB64 = token.slice(0, dotIdx);
  const providedSig = token.slice(dotIdx + 1);

  const expectedSig = await hmacSign(claimsB64, getSecret());
  if (expectedSig !== providedSig) {
    return { valid: false, tampered: true };
  }

  let claims: SignedTokenClaims;
  try {
    const json = atob(claimsB64.replace(/-/g, "+").replace(/_/g, "/"));
    claims = JSON.parse(json) as SignedTokenClaims;
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
    const inputHash = await hashPassword(password);
    if (inputHash !== passwordHash) {
      return { valid: false, projectId, requiresPassword: true };
    }
  }

  return { valid: true, projectId };
}
