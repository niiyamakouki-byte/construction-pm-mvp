import { buildHealthPayload } from "../../../api/health.js";

export async function GET(): Promise<Response> {
  const payload = await buildHealthPayload();

  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}
