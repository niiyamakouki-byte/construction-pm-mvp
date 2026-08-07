/** laporta-beads-yf4or — Codex regression tests, 2026-08-07. */
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  handlePhotoShareRequest,
  hashPhotoShareToken,
  type PhotoShareDatabase,
  type PhotoShareResponse,
} from "../photo-share-handler.js";

function responseRecorder() {
  let statusCode = 0;
  let body: unknown;
  const response: PhotoShareResponse = {
    status(code) {
      statusCode = code;
      return response;
    },
    json(value) {
      body = value;
    },
  };
  return { response, result: () => ({ statusCode, body }) };
}

function createDb(): PhotoShareDatabase {
  return {
    isProjectMember: vi.fn().mockResolvedValue(true),
    createShare: vi.fn().mockResolvedValue(undefined),
    findShare: vi.fn().mockResolvedValue({
      projectId: "project-1",
      expiresAt: "2026-08-14T00:00:00.000Z",
      revokedAt: null,
    }),
    getProjectName: vi.fn().mockResolvedValue("青山邸"),
    listPhotos: vi.fn().mockResolvedValue([
      {
        id: "photo-1",
        storageBucket: "construction-photos",
        storagePath: "project-1/photo-1.jpg",
        fileName: "外観.jpg",
        category: "外装",
        caption: "足場解体後",
        takenAt: "2026-08-06T01:00:00.000Z",
      },
    ]),
    createSignedPhotoUrl: vi.fn().mockResolvedValue("https://signed.example/photo-1"),
  };
}

const auth = {
  getUser: vi.fn().mockResolvedValue({
    data: { user: { id: "user-1" } },
    error: null,
  }),
};

describe("photo share handler", () => {
  beforeEach(() => vi.clearAllMocks());

  it("認証済み案件メンバーが期限付きトークンを発行できる", async () => {
    const db = createDb();
    const recorder = responseRecorder();
    await handlePhotoShareRequest(
      {
        method: "POST",
        headers: { authorization: "Bearer valid" },
        body: { action: "create", projectId: "project-1", expiresInDays: 7 },
      },
      recorder.response,
      {
        auth,
        db,
        now: () => new Date("2026-08-07T00:00:00.000Z"),
        randomToken: () => "fixed-photo-share-token-1234567890",
      },
    );

    expect(recorder.result()).toEqual({
      statusCode: 201,
      body: {
        token: "fixed-photo-share-token-1234567890",
        expiresAt: "2026-08-14T00:00:00.000Z",
      },
    });
    expect(db.createShare).toHaveBeenCalledWith({
      projectId: "project-1",
      tokenHash: hashPhotoShareToken("fixed-photo-share-token-1234567890"),
      expiresAt: "2026-08-14T00:00:00.000Z",
      createdBy: "user-1",
    });
  });

  it("期限切れトークンは403で拒否する", async () => {
    const db = createDb();
    vi.mocked(db.findShare).mockResolvedValue({
      projectId: "project-1",
      expiresAt: "2026-08-06T23:59:59.000Z",
      revokedAt: null,
    });
    const recorder = responseRecorder();
    await handlePhotoShareRequest(
      { method: "POST", body: { action: "read", token: "valid-looking-photo-share-token" } },
      recorder.response,
      { auth, db, now: () => new Date("2026-08-07T00:00:00.000Z") },
    );

    expect(recorder.result()).toEqual({
      statusCode: 403,
      body: { error: "共有リンクは無効または期限切れです" },
    });
    expect(db.listPhotos).not.toHaveBeenCalled();
  });

  it("有効な匿名トークンへ案件写真の署名URLを返す", async () => {
    const db = createDb();
    const recorder = responseRecorder();
    await handlePhotoShareRequest(
      { method: "POST", body: { action: "read", token: "valid-looking-photo-share-token" } },
      recorder.response,
      { auth, db, now: () => new Date("2026-08-07T00:00:00.000Z") },
    );

    expect(recorder.result()).toEqual({
      statusCode: 200,
      body: {
        projectId: "project-1",
        projectName: "青山邸",
        expiresAt: "2026-08-14T00:00:00.000Z",
        photos: [
          {
            id: "photo-1",
            url: "https://signed.example/photo-1",
            fileName: "外観.jpg",
            category: "外装",
            caption: "足場解体後",
            takenAt: "2026-08-06T01:00:00.000Z",
          },
        ],
      },
    });
    expect(db.createSignedPhotoUrl).toHaveBeenCalledWith(
      "construction-photos",
      "project-1/photo-1.jpg",
      3600,
    );
  });
});
