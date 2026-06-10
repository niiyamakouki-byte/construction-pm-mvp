import { buildHealthPayload } from "../../../../api/health.js";

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}

export async function GET(request: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET?.trim();

  if (!secret) {
    return json(
      {
        status: "misconfigured",
        error: "CRON_SECRET is required",
      },
      500,
    );
  }

  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return json(
      {
        status: "unauthorized",
      },
      401,
    );
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
