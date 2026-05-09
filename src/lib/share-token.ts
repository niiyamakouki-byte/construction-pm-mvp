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
