import type { ServerResponse } from "node:http";
import type { ApiResponse } from "./types.js";

export function ok(body: Record<string, unknown>): ApiResponse {
  return {
    statusCode: 200,
    body,
  };
}

export function created(body: Record<string, unknown>): ApiResponse {
  return {
    statusCode: 201,
    body,
  };
}

export function noContent(): ApiResponse {
  return { statusCode: 204 };
}

export function html(body: string, statusCode = 200): ApiResponse {
  return {
    statusCode,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
    },
    body,
  };
}

export function sendJson(response: ServerResponse, statusCode: number, body: unknown): void {
  response.statusCode = statusCode;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.end(JSON.stringify(body));
}

export function sendResponse(response: ServerResponse, apiResponse: ApiResponse): void {
  response.statusCode = apiResponse.statusCode;

  for (const [name, value] of Object.entries(apiResponse.headers ?? {})) {
    response.setHeader(name, value);
  }

  if (apiResponse.body === undefined) {
    response.end();
    return;
  }

  const hasContentType = Object.keys(apiResponse.headers ?? {}).some(
    (name) => name.toLowerCase() === "content-type",
  );
  if (typeof apiResponse.body === "string") {
    if (!hasContentType) {
      response.setHeader("Content-Type", "text/plain; charset=utf-8");
    }
    response.end(apiResponse.body);
    return;
  }

  if (!hasContentType) {
    response.setHeader("Content-Type", "application/json; charset=utf-8");
  }
  response.end(JSON.stringify(apiResponse.body));
}

export function setCorsHeaders(response: ServerResponse): void {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type, X-API-Key");
  response.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,DELETE,OPTIONS");
}
