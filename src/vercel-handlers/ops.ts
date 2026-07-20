/**
 * 運用エンドポイント共通ハンドラ (health + Supabase keepalive cron)。
 *
 * 経緯: 旧実装は src/app/api/**\/route.ts という Next.js App Router 形式だったが、
 * 本プロジェクトは Vite + Vercel Serverless Functions 構成であり Next は依存に無い。
 * つまり両ルートは **一度もデプロイされておらず** /api/health も
 * vercel.json の cron が叩く /api/cron/supabase-keepalive も本番で 404 を返していた
 * (2026-07-21 実測)。Hobby プランの Function 上限 12 に収めるため、
 * 1 関数 (api/cron/supabase-keepalive.ts) に両方の責務を集約し、
 * /api/health は vercel.json の rewrite で ?mode=health として同関数へ流す。
 *
 * - GET ?mode=health          → 認証不要。HealthPayload を返す (middleware の許可パスと一致)
 * - GET (Authorization 必須)  → Vercel Cron 用。CRON_SECRET 照合後に keepalive 結果を返す
 */

import { buildHealthPayload } from "../api/health.js";

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}

async function handleHealth(): Promise<Response> {
  const payload = await buildHealthPayload();
  return json(payload, 200);
}

async function handleKeepalive(request: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET?.trim();

  if (!secret) {
    return json({ status: "misconfigured", error: "CRON_SECRET is required" }, 500);
  }

  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return json({ status: "unauthorized" }, 401);
  }

  const payload = await buildHealthPayload();
  return json(
    {
      status: payload.status,
      uptime: payload.uptime,
      database: payload.database,
      triggeredBy: "vercel-cron",
    },
    payload.database.connected ? 200 : 503,
  );
}

export async function handleOpsRequest(request: Request): Promise<Response> {
  const mode = new URL(request.url).searchParams.get("mode");

  if (mode === "health") {
    return handleHealth();
  }

  return handleKeepalive(request);
}
