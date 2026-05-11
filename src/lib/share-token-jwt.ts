/**
 * share-token-jwt.ts — 施主向けJWTベースのshare-token
 *
 * HMAC-SHA256 (HS256) を Web Crypto API で自前実装。外部ライブラリ不要。
 * payload: { sub: projectId, exp: unix秒, iat: unix秒, pwd?: SHA-256ハッシュ(hex) }
 *
 * 秘密鍵は localStorage に永続化（デモ用途; 本番はサーバー側で管理する）。
 */

const SECRET_STORAGE_KEY = "genbahub:jwt_secret";

// ── HMAC-SHA256 helpers ───────────────────────────────────────────────────────

/** base64url encode (no padding) */
function b64u(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** base64url decode */
function b64uDecode(s: string): Uint8Array {
  const padded = s.replace(/-/g, "+").replace(/_/g, "/");
  const pad = (4 - (padded.length % 4)) % 4;
  const b64 = padded + "=".repeat(pad);
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

/** テキスト → Uint8Array */
function enc(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

/** 秘密鍵バイト列 (32 byte) を取得 or 生成する */
async function getSecretBytes(): Promise<Uint8Array> {
  const stored = (() => {
    try {
      return localStorage.getItem(SECRET_STORAGE_KEY);
    } catch {
      return null;
    }
  })();

  if (stored) {
    try {
      return b64uDecode(stored);
    } catch {
      // fall through to generate
    }
  }

  // 新規生成
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  try {
    localStorage.setItem(SECRET_STORAGE_KEY, b64u(bytes));
  } catch {
    // localStorage unavailable (test env) — 使い捨て
  }
  return bytes;
}

/** HMAC-SHA256 署名を返す */
async function sign(data: string, secretBytes: Uint8Array): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    "raw",
    secretBytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc(data));
  return new Uint8Array(sig);
}

/** HMAC-SHA256 検証 */
async function verify(data: string, sig: Uint8Array, secretBytes: Uint8Array): Promise<boolean> {
  const key = await crypto.subtle.importKey(
    "raw",
    secretBytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );
  return crypto.subtle.verify("HMAC", key, sig, enc(data));
}

// ── SHA-256 password hash ─────────────────────────────────────────────────────

/**
 * パスワードを SHA-256 でハッシュして hex 文字列を返す。
 */
export async function hashPassword(password: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", enc(password));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ── JWT payload ───────────────────────────────────────────────────────────────

export type JwtSharePayload = {
  /** プロジェクト ID */
  sub: string;
  /** 発行時刻 (Unix秒) */
  iat: number;
  /** 有効期限 (Unix秒) */
  exp: number;
  /** SHA-256ハッシュ(hex) — パスワード保護有効時のみ */
  pwd?: string;
};

export type JwtVerifyResult =
  | { ok: true; payload: JwtSharePayload }
  | { ok: false; reason: "expired" | "invalid_signature" | "malformed" | "password_required" | "password_mismatch" };

// ── Public API ────────────────────────────────────────────────────────────────

const HEADER = b64u(enc(JSON.stringify({ alg: "HS256", typ: "JWT" })));

/**
 * JWT share-token を生成する。
 *
 * @param projectId 案件 ID
 * @param opts.ttlMinutes 有効期間（分）。デフォルト 30 日
 * @param opts.password パスワード（設定時は SHA-256 ハッシュを payload に格納）
 */
export async function generateJwtShareToken(
  projectId: string,
  opts?: {
    ttlMinutes?: number;
    password?: string;
  },
): Promise<string> {
  const ttlMs = (opts?.ttlMinutes ?? 30 * 24 * 60) * 60 * 1000;
  const now = Math.floor(Date.now() / 1000);
  const exp = Math.floor((Date.now() + ttlMs) / 1000);

  const payload: JwtSharePayload = { sub: projectId, iat: now, exp };
  if (opts?.password) {
    payload.pwd = await hashPassword(opts.password);
  }

  const payloadB64 = b64u(enc(JSON.stringify(payload)));
  const signingInput = `${HEADER}.${payloadB64}`;

  const secretBytes = await getSecretBytes();
  const sigBytes = await sign(signingInput, secretBytes);

  return `${signingInput}.${b64u(sigBytes)}`;
}

/**
 * JWT share-token を検証する。
 *
 * @param token generateJwtShareToken が返したトークン
 * @param password パスワード（トークンに pwd が含まれている場合に検証する）
 */
export async function verifyJwtShareToken(
  token: string,
  password?: string,
): Promise<JwtVerifyResult> {
  const parts = token.split(".");
  if (parts.length !== 3) {
    return { ok: false, reason: "malformed" };
  }

  const [header, payloadB64, sigB64] = parts;

  // payload デコード
  let payload: JwtSharePayload;
  try {
    const decoded = new TextDecoder().decode(b64uDecode(payloadB64));
    payload = JSON.parse(decoded) as JwtSharePayload;
  } catch {
    return { ok: false, reason: "malformed" };
  }

  // 署名検証
  const secretBytes = await getSecretBytes();
  let sigValid: boolean;
  try {
    sigValid = await verify(`${header}.${payloadB64}`, b64uDecode(sigB64), secretBytes);
  } catch {
    return { ok: false, reason: "invalid_signature" };
  }

  if (!sigValid) {
    return { ok: false, reason: "invalid_signature" };
  }

  // 期限確認
  const nowSec = Math.floor(Date.now() / 1000);
  if (nowSec > payload.exp) {
    return { ok: false, reason: "expired" };
  }

  // パスワード確認
  if (payload.pwd !== undefined) {
    if (password === undefined || password === "") {
      return { ok: false, reason: "password_required" };
    }
    const inputHash = await hashPassword(password);
    if (inputHash !== payload.pwd) {
      return { ok: false, reason: "password_mismatch" };
    }
  }

  return { ok: true, payload };
}

/**
 * トークンにパスワード保護が設定されているか確認する（署名検証なし）。
 * パスワードフォームの表示判定に使う。
 */
export function jwtTokenRequiresPassword(token: string): boolean {
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  try {
    const decoded = new TextDecoder().decode(b64uDecode(parts[1]));
    const payload = JSON.parse(decoded) as Partial<JwtSharePayload>;
    return typeof payload.pwd === "string" && payload.pwd.length > 0;
  } catch {
    return false;
  }
}
