#!/usr/bin/env -S node --experimental-strip-types

import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { resolve } from "node:path";
import { readJsonBody, readMultipartBody } from "./http.js";
import { handleApiRequest } from "./router.js";
import { sendJson, sendResponse, setCorsHeaders } from "./responses.js";
import { InMemoryApiStore, JsonFileApiStore } from "./store.js";
import { ApiError, DEFAULT_PORT } from "./types.js";

export { parseMultipartBody } from "./http.js";
export { handleApiRequest } from "./router.js";
export { InMemoryApiStore, JsonFileApiStore } from "./store.js";
export { ApiError } from "./types.js";
export type * from "./types.js";

async function handleRequest(
  request: IncomingMessage,
  response: ServerResponse,
  store: InMemoryApiStore | JsonFileApiStore,
): Promise<void> {
  setCorsHeaders(response);
  const shouldReadBody = request.method === "POST" || request.method === "PATCH";
  const contentType = request.headers["content-type"] ?? "";
  const result = await handleApiRequest(
    {
      method: request.method,
      url: request.url,
      headers: request.headers,
      body: shouldReadBody
        ? contentType.startsWith("multipart/form-data")
          ? await readMultipartBody(request, contentType)
          : await readJsonBody(request)
        : undefined,
    },
    store,
  );

  if (result.statusCode === 204) {
    response.statusCode = 204;
    response.end();
    return;
  }

  sendResponse(response, result);
}

export function createApiServer(options: {
  store?: InMemoryApiStore | JsonFileApiStore;
  dataFilePath?: string;
} = {}): Server {
  const store =
    options.store ??
    new JsonFileApiStore(
      options.dataFilePath ??
        process.env.GENBAHUB_API_DB_FILE ??
        resolve(process.cwd(), ".genbahub-api-db.json"),
    );

  return createServer(async (request, response) => {
    try {
      await handleRequest(request, response, store);
    } catch (error) {
      if (error instanceof ApiError) {
        sendJson(response, error.statusCode, { error: error.message });
        return;
      }

      console.error(error);
      sendJson(response, 500, { error: "サーバー内部でエラーが発生しました。" });
    }
  });
}

export function startApiServer(options: {
  port?: number;
  dataFilePath?: string;
  store?: InMemoryApiStore | JsonFileApiStore;
} = {}): Server {
  const port = options.port ?? Number(process.env.PORT ?? DEFAULT_PORT);
  const server = createApiServer(options);
  server.listen(port, () => {
    console.log(`GenbaHub API server listening on http://127.0.0.1:${port}`);
  });
  return server;
}

if (import.meta.url === new URL(process.argv[1] ?? "", "file:").href) {
  startApiServer();
}
