/**
 * API Gateway for GenbaHub REST API v1.
 * Provides API key management, rate limiting, routing, and response helpers
 * for external integrations (ANDPAD対抗・蒸留P2).
 */

import { randomBytes } from "node:crypto";

// ── Response type ──────────────────────────────────────────────────────────────

export type ApiResponseMeta = {
  total: number;
  page: number;
  perPage: number;
};

export type ApiResponse<T = unknown> = {
  success: boolean;
  data?: T;
  error?: string;
  meta?: ApiResponseMeta;
};

// ── API Key management ─────────────────────────────────────────────────────────

export type ApiKeyRecord = {
  key: string;
  createdAt: string;
  revoked: boolean;
};

// In-memory key store (same pattern as other lib modules in this codebase)
const apiKeys = new Map<string, ApiKeyRecord>();

export function generateApiKey(): ApiKeyRecord {
  const key = `genbahub_${randomBytes(24).toString("hex")}`;
  const record: ApiKeyRecord = {
    key,
    createdAt: new Date().toISOString(),
    revoked: false,
  };
  apiKeys.set(key, record);
  return record;
}

export function validateApiKey(key: string): boolean {
  const record = apiKeys.get(key);
  if (!record) return false;
  return !record.revoked;
}

export function revokeApiKey(key: string): boolean {
  const record = apiKeys.get(key);
  if (!record) return false;
  record.revoked = true;
  return true;
}

/** Exposed for testing — clears the in-memory key store. */
export function _clearApiKeys(): void {
  apiKeys.clear();
}

// ── Rate limiting ──────────────────────────────────────────────────────────────

const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 60;

type RateLimitBucket = {
  count: number;
  windowStart: number;
};

const rateLimitBuckets = new Map<string, RateLimitBucket>();

export function checkRateLimit(apiKey: string, endpoint: string): boolean {
  const bucketKey = `${apiKey}:${endpoint}`;
  const now = Date.now();
  const bucket = rateLimitBuckets.get(bucketKey);

  if (!bucket || now - bucket.windowStart >= RATE_LIMIT_WINDOW_MS) {
    rateLimitBuckets.set(bucketKey, { count: 1, windowStart: now });
    return true;
  }

  if (bucket.count >= RATE_LIMIT_MAX_REQUESTS) {
    return false;
  }

  bucket.count += 1;
  return true;
}

/** Exposed for testing — clears the in-memory rate limit buckets. */
export function _clearRateLimits(): void {
  rateLimitBuckets.clear();
}

// ── Pagination ─────────────────────────────────────────────────────────────────

export type PaginationParams = {
  page: number;
  perPage: number;
  offset: number;
};

const DEFAULT_PAGE = 1;
const DEFAULT_PER_PAGE = 20;
const MAX_PER_PAGE = 100;

export function parsePagination(query: Record<string, string | undefined>): PaginationParams {
  const rawPage = parseInt(query["page"] ?? "", 10);
  const rawPerPage = parseInt(query["per_page"] ?? "", 10);

  const page = Number.isFinite(rawPage) && rawPage >= 1 ? rawPage : DEFAULT_PAGE;
  const perPage =
    Number.isFinite(rawPerPage) && rawPerPage >= 1
      ? Math.min(rawPerPage, MAX_PER_PAGE)
      : DEFAULT_PER_PAGE;

  return {
    page,
    perPage,
    offset: (page - 1) * perPage,
  };
}

// ── Endpoint registry ──────────────────────────────────────────────────────────

export type EndpointMethod = "GET" | "POST" | "PATCH" | "DELETE";

export type GatewayRequest = {
  method: EndpointMethod;
  pathname: string;
  query: Record<string, string | undefined>;
  apiKey?: string;
};

export type EndpointHandler = (
  request: GatewayRequest,
) => Promise<ApiResponse>;

type EndpointEntry = {
  method: EndpointMethod;
  pattern: RegExp;
  handler: EndpointHandler;
};

const endpoints: EndpointEntry[] = [];

export function registerEndpoint(
  method: EndpointMethod,
  pattern: RegExp,
  handler: EndpointHandler,
): void {
  endpoints.push({ method, pattern, handler });
}

export type HandleRequestResult =
  | { matched: true; response: ApiResponse }
  | { matched: false };

export async function handleRequest(request: GatewayRequest): Promise<HandleRequestResult> {
  // API key validation
  if (!request.apiKey || !validateApiKey(request.apiKey)) {
    return {
      matched: true,
      response: { success: false, error: "APIキーが未設定、または不正です。" },
    };
  }

  // Rate limit check
  if (!checkRateLimit(request.apiKey, request.pathname)) {
    return {
      matched: true,
      response: { success: false, error: "リクエスト上限（60回/分）を超えました。" },
    };
  }

  for (const entry of endpoints) {
    if (entry.method !== request.method) continue;
    if (!entry.pattern.test(request.pathname)) continue;

    const response = await entry.handler(request);
    return { matched: true, response };
  }

  return { matched: false };
}

/** Exposed for testing — clears registered endpoints. */
export function _clearEndpoints(): void {
  endpoints.length = 0;
}

// ── v1 Endpoint definitions ────────────────────────────────────────────────────

// These are stub handlers that return the structure expected by callers.
// Real implementations wire into ApiStore in server.ts / route handlers.

registerEndpoint("GET", /^\/api\/v1\/projects$/, async (req) => {
  const pagination = parsePagination(req.query);
  return {
    success: true,
    data: [],
    meta: { total: 0, page: pagination.page, perPage: pagination.perPage },
  };
});

registerEndpoint("GET", /^\/api\/v1\/projects\/([^/]+)$/, async () => {
  return { success: true, data: null };
});

registerEndpoint("GET", /^\/api\/v1\/projects\/([^/]+)\/tasks$/, async (req) => {
  const pagination = parsePagination(req.query);
  return {
    success: true,
    data: [],
    meta: { total: 0, page: pagination.page, perPage: pagination.perPage },
  };
});

registerEndpoint("GET", /^\/api\/v1\/projects\/([^/]+)\/photos$/, async (req) => {
  const pagination = parsePagination(req.query);
  return {
    success: true,
    data: [],
    meta: { total: 0, page: pagination.page, perPage: pagination.perPage },
  };
});

registerEndpoint("GET", /^\/api\/v1\/projects\/([^/]+)\/entries$/, async (req) => {
  const pagination = parsePagination(req.query);
  return {
    success: true,
    data: [],
    meta: { total: 0, page: pagination.page, perPage: pagination.perPage },
  };
});
