import type { IncomingMessage } from "node:http";
import { ApiError } from "./types.js";
import type { MultipartBody, UploadedFile } from "./types.js";
import { isObject } from "./utils.js";

const MAX_BODY_BYTES = 1 * 1024 * 1024; // 1 MB

async function readRawBody(request: IncomingMessage): Promise<Buffer> {
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  for await (const chunk of request) {
    const buf = typeof chunk === "string" ? Buffer.from(chunk) : chunk;
    totalBytes += buf.length;
    if (totalBytes > MAX_BODY_BYTES) {
      request.destroy();
      throw new ApiError(413, "リクエストボディが大きすぎます（上限1MB）。");
    }
    chunks.push(buf);
  }

  if (chunks.length === 0) {
    return Buffer.alloc(0);
  }

  return Buffer.concat(chunks);
}

export async function readJsonBody(request: IncomingMessage): Promise<unknown> {
  const rawBody = (await readRawBody(request)).toString("utf8");
  if (!rawBody) {
    return {};
  }

  try {
    return JSON.parse(rawBody);
  } catch {
    throw new ApiError(400, "JSON形式のリクエストボディを送信してください。");
  }
}

export async function readMultipartBody(
  request: IncomingMessage,
  contentType: string,
): Promise<MultipartBody> {
  const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
  const boundary = boundaryMatch?.[1] ?? boundaryMatch?.[2];
  if (!boundary) {
    throw new ApiError(400, "multipart/form-data のboundaryが不正です。");
  }

  return parseMultipartBody(await readRawBody(request), boundary);
}

export function parseMultipartBody(body: Buffer, boundary: string): MultipartBody {
  const boundaryBuffer = Buffer.from(`--${boundary}`);
  const headerSeparator = Buffer.from("\r\n\r\n");
  const fields: Record<string, string> = {};
  const files: UploadedFile[] = [];
  let searchOffset = 0;

  while (searchOffset < body.length) {
    const boundaryIndex = body.indexOf(boundaryBuffer, searchOffset);
    if (boundaryIndex === -1) {
      break;
    }

    let cursor = boundaryIndex + boundaryBuffer.length;
    const isFinalBoundary = body[cursor] === 45 && body[cursor + 1] === 45;
    if (isFinalBoundary) {
      break;
    }

    if (body[cursor] === 13 && body[cursor + 1] === 10) {
      cursor += 2;
    }

    const headerEnd = body.indexOf(headerSeparator, cursor);
    if (headerEnd === -1) {
      throw new ApiError(400, "multipart/form-data のヘッダー解析に失敗しました。");
    }

    const headers = parseMultipartHeaders(body.toString("utf8", cursor, headerEnd));
    const contentStart = headerEnd + headerSeparator.length;
    const nextBoundaryIndex = body.indexOf(boundaryBuffer, contentStart);
    if (nextBoundaryIndex === -1) {
      throw new ApiError(400, "multipart/form-data の本文解析に失敗しました。");
    }

    const contentEnd =
      body[nextBoundaryIndex - 2] === 13 && body[nextBoundaryIndex - 1] === 10
        ? nextBoundaryIndex - 2
        : nextBoundaryIndex;
    const content = body.subarray(contentStart, contentEnd);
    const disposition = parseContentDisposition(headers["content-disposition"]);

    if (disposition.filename) {
      files.push({
        fieldName: disposition.name,
        filename: disposition.filename,
        contentType: headers["content-type"] ?? "application/octet-stream",
        buffer: Buffer.from(content),
      });
    } else {
      fields[disposition.name] = content.toString("utf8");
    }

    searchOffset = nextBoundaryIndex;
  }

  return { fields, files };
}

function parseMultipartHeaders(source: string): Record<string, string> {
  const headers: Record<string, string> = {};

  for (const line of source.split("\r\n")) {
    const separatorIndex = line.indexOf(":");
    if (separatorIndex === -1) {
      continue;
    }
    const key = line.slice(0, separatorIndex).trim().toLowerCase();
    const value = line.slice(separatorIndex + 1).trim();
    headers[key] = value;
  }

  return headers;
}

function parseContentDisposition(value: string | undefined): {
  name: string;
  filename?: string;
} {
  if (!value) {
    throw new ApiError(400, "multipart/form-data のContent-Dispositionが不足しています。");
  }

  const nameMatch = value.match(/\bname="([^"]+)"/i);
  if (!nameMatch) {
    throw new ApiError(400, "multipart/form-data のnameが不足しています。");
  }

  const filenameMatch = value.match(/\bfilename="([^"]*)"/i);
  return {
    name: nameMatch[1],
    ...(filenameMatch?.[1] ? { filename: filenameMatch[1] } : {}),
  };
}

export function requireMultipartFile(payload: unknown): UploadedFile {
  if (!isObject(payload) || !Array.isArray(payload.files)) {
    throw new ApiError(400, "アップロードファイルを指定してください。");
  }

  const file = payload.files.find((item): item is UploadedFile =>
    isObject(item) &&
    typeof item.filename === "string" &&
    item.buffer instanceof Buffer,
  );

  if (!file) {
    throw new ApiError(400, "アップロードファイルを指定してください。");
  }

  return file;
}
