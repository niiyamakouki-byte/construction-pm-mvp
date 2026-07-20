/**
 * Vercel Serverless Function: GET /api/cron/supabase-keepalive
 *
 * 兼: GET /api/health (vercel.json の rewrite で ?mode=health として到達)
 *
 * Hobby プランの Function 上限 12 に収めるため 1 関数に集約している。
 * ロジック本体と単体テストは src/vercel-handlers/ops.ts / ops.test.ts。
 */

import { handleOpsRequest } from "../../src/vercel-handlers/ops.js";

type VercelRequest = {
  method?: string;
  url?: string;
  headers: Record<string, string | string[] | undefined>;
  query?: Record<string, string | string[] | undefined>;
};

type VercelResponse = {
  status: (code: number) => VercelResponse;
  json: (body: unknown) => void;
  setHeader: (name: string, value: string) => void;
};

function firstHeader(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method && req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const mode = Array.isArray(req.query?.mode) ? req.query.mode[0] : req.query?.mode;
  const url = new URL(req.url ?? "/api/cron/supabase-keepalive", "http://localhost");
  if (mode) {
    url.searchParams.set("mode", mode);
  }

  const headers = new Headers();
  const authorization = firstHeader(req.headers.authorization);
  if (authorization) {
    headers.set("authorization", authorization);
  }

  const response = await handleOpsRequest(new Request(url, { headers }));
  const body: unknown = await response.json();

  const cacheControl = response.headers.get("Cache-Control");
  if (cacheControl) {
    res.setHeader("Cache-Control", cacheControl);
  }
  res.status(response.status).json(body);
}
