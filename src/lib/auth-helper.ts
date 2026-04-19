/**
 * auth-helper — Vercel Serverless Function 用の共通認証ヘルパー。
 *
 * ブラウザから送られてきた `Authorization: Bearer <jwt>` を
 * Supabase で検証してユーザー ID を返す。
 * 無課金 API（/api/invoice-ocr 等）を認証済みユーザーに限定するために使う。
 */

export type AuthenticatedUser = {
  id: string;
  email?: string;
};

export type VerifyAuthResult =
  | { ok: true; user: AuthenticatedUser; token: string }
  | { ok: false; status: 401; error: string };

/**
 * Supabase Auth の `auth.getUser(token)` と同じ形のメソッドを持つ最小インターフェース。
 * テストでモックを差し込むためにこの形で受け取る。
 */
export type SupabaseAuthVerifier = {
  getUser: (token: string) => Promise<{
    data: { user: { id: string; email?: string } | null };
    error: { message: string } | null;
  }>;
};

type RequestHeaders = Record<string, string | string[] | undefined>;

function extractBearerToken(headers: RequestHeaders | undefined): string | null {
  if (!headers) return null;
  const raw = headers["authorization"] ?? headers["Authorization"];
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value || typeof value !== "string") return null;
  const match = value.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;
  const token = match[1].trim();
  return token.length > 0 ? token : null;
}

/**
 * Authorization ヘッダから JWT を抜き出し、Supabase で検証する。
 *
 * @returns 認証成功時は { ok: true, user, token }。
 *          失敗時は { ok: false, status: 401, error } を返すので
 *          呼び出し側はそのまま HTTP レスポンスにできる。
 */
export async function verifyBearerAuth(
  auth: SupabaseAuthVerifier,
  headers: RequestHeaders | undefined,
): Promise<VerifyAuthResult> {
  const token = extractBearerToken(headers);
  if (!token) {
    return {
      ok: false,
      status: 401,
      error: "認証が必要です（Authorization: Bearer <token>）",
    };
  }

  let result: Awaited<ReturnType<SupabaseAuthVerifier["getUser"]>>;
  try {
    result = await auth.getUser(token);
  } catch (err) {
    return {
      ok: false,
      status: 401,
      error: `トークン検証に失敗しました: ${
        err instanceof Error ? err.message : "不明なエラー"
      }`,
    };
  }

  if (result.error || !result.data?.user) {
    return {
      ok: false,
      status: 401,
      error: result.error?.message ?? "認証トークンが無効です",
    };
  }

  return {
    ok: true,
    token,
    user: {
      id: result.data.user.id,
      email: result.data.user.email,
    },
  };
}
