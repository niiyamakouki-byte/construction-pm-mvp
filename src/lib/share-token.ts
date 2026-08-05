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
//
// 署名・検証は /api/share-token（サーバー専用）で行う。以前はブラウザの
// crypto.subtle + import.meta.env.VITE_SHARE_TOKEN_SECRET で署名鍵をクライアント側に
// 持たせていたが、VITE_ 接頭辞はビルド時にクライアントJSへ埋め込まれるため鍵が露出していた
// （ハードコードされた開発用フォールバック鍵も含む）。2026-07-27 セキュリティ監査で発覚し、
// 実際の署名・検証ロジックは src/lib/share-token-handler.ts + api/share-token.ts へ移設した。

const SHARE_TOKEN_API_ENDPOINT = "/api/share-token";

export type ShareTokenFetcher = (
  url: string,
  init: RequestInit,
) => Promise<Response>;

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
  /** Supabase アクセストークンを返す関数。/api/share-token の action=create は認証必須。 */
  getAccessToken?: () => Promise<string | null>;
  /** テスト注入用の fetch 実装。デフォルトは global fetch。 */
  fetcher?: ShareTokenFetcher;
  contractorRequest?: { notificationId: string; taskName: string };
};

export type SignedTokenVerifyResult = {
  valid: boolean;
  projectId?: string;
  expired?: boolean;
  requiresPassword?: boolean;
  tampered?: boolean;
  purpose?: "contractor_request";
  notificationId?: string;
  taskName?: string;
};

/**
 * HMAC-SHA256 署名付き共有トークンを発行する。
 * 実際の署名は /api/share-token（サーバー専用、SHARE_TOKEN_SECRET 使用）が行う。
 *
 * @returns "claimsB64.signature" 形式の base64url トークン
 * @throws サーバーが失敗を返した場合（未認証・鍵未設定・ネットワークエラー等）
 */
export async function createShareToken(
  projectId: string,
  options: SignedTokenOptions,
): Promise<string> {
  const { expiresInDays, password, getAccessToken, fetcher, contractorRequest } = options;
  const doFetch = fetcher ?? (fetch.bind(globalThis) as ShareTokenFetcher);

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const accessToken = await getAccessToken?.();
  if (accessToken) {
    headers["Authorization"] = `Bearer ${accessToken}`;
  }

  const res = await doFetch(SHARE_TOKEN_API_ENDPOINT, {
    method: "POST",
    headers,
    body: JSON.stringify({ action: "create", projectId, expiresInDays, password, contractorRequest }),
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `share-token の発行に失敗しました (${res.status})`);
  }

  const { token } = (await res.json()) as { token: string };
  return token;
}

export async function respondToContractorRequest(
  token: string,
  response: "accepted" | "rejected",
  opts?: { fetcher?: ShareTokenFetcher },
): Promise<void> {
  const doFetch = opts?.fetcher ?? (fetch.bind(globalThis) as ShareTokenFetcher);
  const res = await doFetch(SHARE_TOKEN_API_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "respond", token, response }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `依頼回答の保存に失敗しました (${res.status})`);
  }
}

/**
 * HMAC-SHA256 署名付きトークンを検証する。
 * 実際の検証は /api/share-token（サーバー専用、SHARE_TOKEN_SECRET 使用）が行う。
 *
 * サーバーに到達できない・鍵未設定等でサーバーが失敗を返した場合は、
 * 安全側に倒して { valid: false, tampered: true } を返す
 * （弱い鍵にフォールバックして検証を続けることはしない）。
 */
export async function verifySignedToken(
  token: string,
  password?: string,
  opts?: { fetcher?: ShareTokenFetcher },
): Promise<SignedTokenVerifyResult> {
  const doFetch = opts?.fetcher ?? (fetch.bind(globalThis) as ShareTokenFetcher);

  try {
    const res = await doFetch(SHARE_TOKEN_API_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "verify", token, password }),
    });

    if (!res.ok) {
      console.error(`[share-token] verify failed (${res.status})`);
      return { valid: false, tampered: true };
    }

    return (await res.json()) as SignedTokenVerifyResult;
  } catch (err) {
    console.error("[share-token] verify request failed", err);
    return { valid: false, tampered: true };
  }
}
