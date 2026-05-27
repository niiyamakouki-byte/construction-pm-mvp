/**
 * owner-app/share-token.ts — 施主向け share token (30日有効)
 * localStorage: genbahub:owner-tokens
 */

import type { OwnerSession } from "./types.js";

const STORAGE_KEY = "genbahub:owner-tokens";

type StoredToken = {
  token: string;
  projectId: string;
  expiresAt: number;
  revoked?: boolean;
};

export type ShareTokenValidationFailureReason = "not_found" | "revoked" | "expired";

export type ShareTokenValidationResult =
  | { ok: true; session: OwnerSession }
  | { ok: false; reason: ShareTokenValidationFailureReason };

function loadTokens(): StoredToken[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as StoredToken[];
  } catch {
    return [];
  }
}

function saveTokens(tokens: StoredToken[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tokens));
}

/**
 * base64url 安全な乱数トークンを生成する (crypto.getRandomValues ベース)
 */
function randomBase64Url(byteLength = 32): string {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  // base64url: no padding, + → -, / → _
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * 施主共有トークンを発行し localStorage に保存する。
 */
export function generateShareToken(
  projectId: string,
  expiresInDays = 30,
): string {
  const token = randomBase64Url(32);
  const expiresAt = Date.now() + expiresInDays * 24 * 60 * 60 * 1000;
  const tokens = loadTokens();
  tokens.push({ token, projectId, expiresAt });
  saveTokens(tokens);
  return token;
}

/**
 * トークンを検証し、失敗時は理由を返す。
 */
export function validateShareTokenDetailed(token: string): ShareTokenValidationResult {
  const tokens = loadTokens();
  const found = tokens.find((t) => t.token === token);
  if (!found) return { ok: false, reason: "not_found" };
  if (found.revoked) return { ok: false, reason: "revoked" };
  if (Date.now() > found.expiresAt) return { ok: false, reason: "expired" };
  return {
    ok: true,
    session: {
      token: found.token,
      projectId: found.projectId,
      expiresAt: found.expiresAt,
    },
  };
}

/**
 * トークンを検証し有効な場合は OwnerSession を返す。
 * 無効・期限切れ・revoke 済みは null。
 */
export function validateShareToken(token: string): OwnerSession | null {
  const result = validateShareTokenDetailed(token);
  return result.ok ? result.session : null;
}

/**
 * トークンを無効化する (revoke)。
 */
export function revokeShareToken(token: string): void {
  const tokens = loadTokens();
  const idx = tokens.findIndex((t) => t.token === token);
  if (idx !== -1) {
    tokens[idx] = { ...tokens[idx], revoked: true };
    saveTokens(tokens);
  }
}

/**
 * あるプロジェクトのアクティブなトークン一覧を返す。
 */
export function listShareTokens(
  projectId: string,
): Array<{ token: string; expiresAt: number; revoked: boolean }> {
  return loadTokens()
    .filter((t) => t.projectId === projectId)
    .map((t) => ({
      token: t.token,
      expiresAt: t.expiresAt,
      revoked: t.revoked ?? false,
    }));
}
