import { ApiError } from "./types.js";

type HeaderValue = string | string[] | undefined;
type HeaderRecord = Record<string, HeaderValue>;
type HeaderSource = HeaderRecord | Headers | undefined;

export type ApiKeyValidationResult =
  | { ok: true }
  | { ok: false; statusCode: number; error: string };

export function readHeader(headers: HeaderSource, name: string): string | undefined {
  if (!headers) {
    return undefined;
  }

  if (typeof Headers !== "undefined" && headers instanceof Headers) {
    return headers.get(name) ?? undefined;
  }

  const targetName = name.toLowerCase();
  for (const [headerName, headerValue] of Object.entries(headers)) {
    if (headerName.toLowerCase() !== targetName) {
      continue;
    }

    return Array.isArray(headerValue) ? headerValue[0] : headerValue;
  }

  return undefined;
}

export function validateApiKey(
  headers: HeaderSource,
  env: NodeJS.ProcessEnv = process.env,
): ApiKeyValidationResult {
  const expectedApiKey = env.API_KEY;
  if (!expectedApiKey) {
    return {
      ok: false,
      statusCode: 500,
      error: "API_KEYが設定されていません。",
    };
  }

  const providedApiKey = readHeader(headers, "x-api-key");
  if (providedApiKey !== expectedApiKey) {
    return {
      ok: false,
      statusCode: 401,
      error: "APIキーが未設定、または不正です。",
    };
  }

  return { ok: true };
}

export function requireApiKey(
  headers: HeaderSource,
  env: NodeJS.ProcessEnv = process.env,
): void {
  const result = validateApiKey(headers, env);
  if (!result.ok) {
    throw new ApiError(result.statusCode, result.error);
  }
}
