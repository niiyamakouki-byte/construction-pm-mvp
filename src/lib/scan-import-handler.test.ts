import { describe, expect, it, vi } from "vitest";
import {
  handleScanImport,
  MAX_DOCUMENT_BASE64_BYTES,
  MAX_PHOTO_BASE64_BYTES,
  SCAN_IMPORT_RATE_LIMIT_PER_MIN,
  type ScanImportDb,
  type ScanImportResponse,
} from "./scan-import-handler.js";
import type { RateLimitStore } from "./rate-limiter.js";

function makeRes() {
  const calls: { status?: number; body?: unknown; headers: Record<string, string> } = {
    headers: {},
  };
  const res: ScanImportResponse = {
    status(code) {
      calls.status = code;
      return res;
    },
    json(body) {
      calls.body = body;
      return res;
    },
    setHeader(name, value) {
      calls.headers[name] = value;
    },
  };
  return { res, calls };
}

function okAuth() {
  return {
    getUser: vi.fn(async () => ({
      data: { user: { id: "user-1", email: "a@b.c" } },
      error: null,
    })),
  };
}

function rlStore(count = 1): RateLimitStore {
  return {
    async increment() {
      return { count, error: null };
    },
  };
}

function fakeDb(): { db: ScanImportDb; calls: Record<string, unknown[]> } {
  const calls: Record<string, unknown[]> = {
    insertProject: [],
    uploadFile: [],
    insertPhoto: [],
    insertDocument: [],
  };
  const db: ScanImportDb = {
    async insertProject(row) {
      calls.insertProject.push(row);
      return { error: null };
    },
    async uploadFile(args) {
      calls.uploadFile.push(args);
      return { url: `https://storage.example/${args.bucket}/${args.path}`, error: null };
    },
    async insertPhoto(row) {
      calls.insertPhoto.push(row);
      return { error: null };
    },
    async insertDocument(row) {
      calls.insertDocument.push(row);
      return { error: null };
    },
  };
  return { db, calls };
}

const validBody = {
  projectName: "test-スキャン取込案件",
  client: "テスト太郎",
  quantities: { floorAreaM2: 9.72, wallAreaNetM2: 26.88 },
  estimate: {
    items: [{ name: "壁クロス張替", quantity: 26.88, unit: "m2", amount: 50000 }],
    taxExcludedTotal: 50000,
    taxIncludedTotal: 55000,
  },
};

describe("handleScanImport — メソッド", () => {
  it("POST 以外は 405", async () => {
    const { res, calls } = makeRes();
    const { db } = fakeDb();
    await handleScanImport(
      { method: "GET" },
      res,
      { auth: okAuth(), rateLimitStore: rlStore(), db },
    );
    expect(calls.status).toBe(405);
  });
});

describe("handleScanImport — 認証", () => {
  it("Authorization ヘッダなしで 401", async () => {
    const { res, calls } = makeRes();
    const { db } = fakeDb();
    await handleScanImport(
      { method: "POST", headers: {}, body: validBody },
      res,
      { auth: okAuth(), rateLimitStore: rlStore(), db },
    );
    expect(calls.status).toBe(401);
  });

  it("無効な JWT は 401", async () => {
    const { res, calls } = makeRes();
    const { db } = fakeDb();
    await handleScanImport(
      { method: "POST", headers: { authorization: "Bearer bad" }, body: validBody },
      res,
      {
        auth: { getUser: async () => ({ data: { user: null }, error: { message: "invalid" } }) },
        rateLimitStore: rlStore(),
        db,
      },
    );
    expect(calls.status).toBe(401);
  });
});

describe("handleScanImport — バリデーション", () => {
  it("projectName なしで 400", async () => {
    const { res, calls } = makeRes();
    const { db } = fakeDb();
    await handleScanImport(
      { method: "POST", headers: { authorization: "Bearer good" }, body: { quantities: {} } },
      res,
      { auth: okAuth(), rateLimitStore: rlStore(), db },
    );
    expect(calls.status).toBe(400);
  });

  it("間取り画像が上限超過で 413", async () => {
    const { res, calls } = makeRes();
    const { db } = fakeDb();
    await handleScanImport(
      {
        method: "POST",
        headers: { authorization: "Bearer good" },
        body: {
          ...validBody,
          floorPlan: {
            mediaType: "image/png",
            data: "a".repeat(MAX_DOCUMENT_BASE64_BYTES + 1),
            fileName: "plan.png",
          },
        },
      },
      res,
      { auth: okAuth(), rateLimitStore: rlStore(), db },
    );
    expect(calls.status).toBe(413);
  });

  it("写真が上限超過で 413", async () => {
    const { res, calls } = makeRes();
    const { db } = fakeDb();
    await handleScanImport(
      {
        method: "POST",
        headers: { authorization: "Bearer good" },
        body: {
          ...validBody,
          photos: [
            { mediaType: "image/png", data: "a".repeat(MAX_PHOTO_BASE64_BYTES + 1), fileName: "p.png" },
          ],
        },
      },
      res,
      { auth: okAuth(), rateLimitStore: rlStore(), db },
    );
    expect(calls.status).toBe(413);
  });

  it("非対応の写真形式は 400", async () => {
    const { res, calls } = makeRes();
    const { db } = fakeDb();
    await handleScanImport(
      {
        method: "POST",
        headers: { authorization: "Bearer good" },
        body: {
          ...validBody,
          photos: [{ mediaType: "image/gif", data: "aGVsbG8=", fileName: "p.gif" }],
        },
      },
      res,
      { auth: okAuth(), rateLimitStore: rlStore(), db },
    );
    expect(calls.status).toBe(400);
  });
});

describe("handleScanImport — レートリミット", () => {
  it("limit 超過で 429 + Retry-After", async () => {
    const { res, calls } = makeRes();
    const { db } = fakeDb();
    await handleScanImport(
      { method: "POST", headers: { authorization: "Bearer good" }, body: validBody },
      res,
      { auth: okAuth(), rateLimitStore: rlStore(SCAN_IMPORT_RATE_LIMIT_PER_MIN + 1), db },
    );
    expect(calls.status).toBe(429);
    expect(calls.headers["Retry-After"]).toBeDefined();
  });
});

describe("handleScanImport — 正常系", () => {
  it("案件を作成し、寸法・見積を description に埋め込む", async () => {
    const { res, calls } = makeRes();
    const { db, calls: dbCalls } = fakeDb();
    await handleScanImport(
      { method: "POST", headers: { authorization: "Bearer good" }, body: validBody },
      res,
      { auth: okAuth(), rateLimitStore: rlStore(), db },
    );
    expect(calls.status).toBe(200);
    const body = calls.body as { projectId: string; photoCount: number; documentCount: number };
    expect(body.projectId).toBeTruthy();
    expect(body.photoCount).toBe(0);
    expect(body.documentCount).toBe(0);

    expect(dbCalls.insertProject).toHaveLength(1);
    const projectRow = dbCalls.insertProject[0] as { name: string; description: string };
    expect(projectRow.name).toBe("test-スキャン取込案件");
    expect(projectRow.description).toContain("施主: テスト太郎");
    expect(projectRow.description).toContain("床面積: 9.72m2");
    expect(projectRow.description).toContain("壁クロス張替");
    expect(projectRow.description).toContain("税込合計: ¥55,000");
  });

  it("間取り画像と写真をアップロードし、documents/photos に登録する", async () => {
    const { res, calls } = makeRes();
    const { db, calls: dbCalls } = fakeDb();
    await handleScanImport(
      {
        method: "POST",
        headers: { authorization: "Bearer good" },
        body: {
          ...validBody,
          floorPlan: { mediaType: "image/png", data: "aGVsbG8=", fileName: "floorplan.png" },
          photos: [
            { mediaType: "image/jpeg", data: "aGVsbG8=", fileName: "room1.jpg", category: "scan" },
            { mediaType: "image/jpeg", data: "aGVsbG8=", fileName: "room2.jpg" },
          ],
        },
      },
      res,
      { auth: okAuth(), rateLimitStore: rlStore(), db },
    );
    expect(calls.status).toBe(200);
    const body = calls.body as { photoCount: number; documentCount: number };
    expect(body.documentCount).toBe(1);
    expect(body.photoCount).toBe(2);

    expect(dbCalls.uploadFile).toHaveLength(3);
    expect(dbCalls.insertDocument).toHaveLength(1);
    const docRow = dbCalls.insertDocument[0] as { type: string; name: string; url: string };
    expect(docRow.type).toBe("drawing");
    expect(docRow.name).toBe("floorplan.png");
    expect(docRow.url).toMatch(/^https:\/\/storage\.example/);

    expect(dbCalls.insertPhoto).toHaveLength(2);
    const photoRow = dbCalls.insertPhoto[0] as { category: string; fileName: string };
    expect(photoRow.category).toBe("scan");
    expect(photoRow.fileName).toBe("room1.jpg");
  });

  it("uploadFile がエラーを返したら 502 でロールバックせず終了する", async () => {
    const { res, calls } = makeRes();
    const { db } = fakeDb();
    db.uploadFile = async () => ({ url: "", error: { message: "storage down" } });
    await handleScanImport(
      {
        method: "POST",
        headers: { authorization: "Bearer good" },
        body: {
          ...validBody,
          floorPlan: { mediaType: "image/png", data: "aGVsbG8=", fileName: "floorplan.png" },
        },
      },
      res,
      { auth: okAuth(), rateLimitStore: rlStore(), db },
    );
    expect(calls.status).toBe(502);
  });
});
