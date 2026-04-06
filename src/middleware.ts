import { validateApiKey } from "./api/api-key.js";

function jsonErrorResponse(status: number, error: string): Response {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}

export function middleware(request: Request): Response | undefined {
  const { pathname } = new URL(request.url);

  if (request.method === "OPTIONS" || pathname === "/api/health") {
    return undefined;
  }

  const result = validateApiKey(request.headers);
  if (result.ok) {
    return undefined;
  }

  return jsonErrorResponse(result.statusCode, result.error);
}

export const config = {
  matcher: ["/api/:path*"],
};
