import { beforeEach, describe, expect, it, vi } from "vitest";
import { MAX_PHOTO_FILE_SIZE, PHOTO_BUCKET, PhotoRepository } from "../photo-repository.js";
import type { SupabaseClientLike } from "../../supabase-client.js";

const fixedId = "11111111-1111-4111-8111-111111111111";
const fixedDate = new Date("2026-04-19T10:00:00.000Z");

type QueryResult = {
  data: unknown;
  error: { message: string } | null;
};

type MockBuilder = Record<"select" | "eq" | "order" | "insert" | "single", ReturnType<typeof vi.fn>>;

function makeFile(name = "site.jpg", type = "image/jpeg", size = 1024): File {
  return new File([new Uint8Array(size)], name, { type });
}

function makeRow(overrides: Record<string, unknown> = {}) {
  return {
    id: fixedId,
    project_id: "project-1",
    task_id: null,
    storage_bucket: PHOTO_BUCKET,
    storage_path: `project-1/${fixedId}.jpg`,
    url: "https://signed.example/uploaded",
    file_name: "site.jpg",
    content_type: "image/jpeg",
    file_size: 1024,
    category: null,
    caption: null,
    taken_at: fixedDate.toISOString(),
    created_at: fixedDate.toISOString(),
    updated_at: fixedDate.toISOString(),
    ...overrides,
  };
}

function makeBuilder(result: QueryResult) {
  const builder = {} as MockBuilder;
  const chain = () => builder;
  builder.select = vi.fn(chain);
  builder.eq = vi.fn(chain);
  builder.order = vi.fn(() => Promise.resolve(result));
  builder.insert = vi.fn(chain);
  builder.single = vi.fn(() => Promise.resolve(result));
  return builder;
}

function makeClient(options: {
  upload?: QueryResult;
  signedUrl?: QueryResult;
  insert?: QueryResult;
  list?: QueryResult;
} = {}) {
  const upload = vi.fn(() => Promise.resolve(options.upload ?? { data: { path: "" }, error: null }));
  const createSignedUrl = vi.fn((path: string) => Promise.resolve(options.signedUrl ?? { data: { signedUrl: `https://signed.example/${path}` }, error: null }));
  const remove = vi.fn(() => Promise.resolve({ data: [], error: null }));
  const insertBuilder = makeBuilder(options.insert ?? { data: makeRow(), error: null });
  const listBuilder = makeBuilder(options.list ?? { data: [makeRow()], error: null });
  const tableBuilder = {
    insert: vi.fn(() => insertBuilder),
    select: vi.fn(() => listBuilder),
  };
  const from = vi.fn(() => tableBuilder);
  const client = {
    from,
    storage: { from: vi.fn(() => ({ upload, createSignedUrl, remove })) },
    auth: {} as SupabaseClientLike["auth"],
  } as unknown as SupabaseClientLike;
  return { client, upload, createSignedUrl, remove, from, tableBuilder, insertBuilder, listBuilder };
}

function makeRepo(client: SupabaseClientLike) {
  return new PhotoRepository({ getClient: () => Promise.resolve(client), idGenerator: () => fixedId, now: () => fixedDate });
}

describe("PhotoRepository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uploads a jpeg to the construction photos bucket", async () => {
    const mock = makeClient();
    const result = await makeRepo(mock.client).uploadPhoto(makeFile(), "project-1");
    expect(mock.client.storage.from).toHaveBeenCalledWith(PHOTO_BUCKET);
    expect(mock.upload).toHaveBeenCalledWith(`project-1/${fixedId}.jpg`, expect.any(File), expect.objectContaining({ contentType: "image/jpeg" }));
    expect(result.projectId).toBe("project-1");
  });

  it("inserts metadata after upload", async () => {
    const mock = makeClient();
    await makeRepo(mock.client).uploadPhoto(makeFile(), "project-1", "task-1", { category: "safety" });
    expect(mock.tableBuilder.insert).toHaveBeenCalledWith(expect.objectContaining({ id: fixedId, project_id: "project-1" }));
  });

  it("returns signed url and takenAt", async () => {
    const mock = makeClient();
    const result = await makeRepo(mock.client).uploadPhoto(makeFile(), "project-1");
    expect(result.url).toContain("https://signed.example/");
    expect(result.takenAt).toBe(fixedDate.toISOString());
  });

  it("rejects files over 10MB before network calls", async () => {
    const mock = makeClient();
    await expect(makeRepo(mock.client).uploadPhoto(makeFile("big.jpg", "image/jpeg", MAX_PHOTO_FILE_SIZE + 1), "project-1"))
      .rejects.toThrow("10MB");
    expect(mock.upload).not.toHaveBeenCalled();
  });

  it("rejects unsupported file types before network calls", async () => {
    const mock = makeClient();
    await expect(makeRepo(mock.client).uploadPhoto(makeFile("memo.pdf", "application/pdf"), "project-1"))
      .rejects.toThrow("非対応");
    expect(mock.upload).not.toHaveBeenCalled();
  });

  it("propagates permission errors from storage upload", async () => {
    const mock = makeClient({ upload: { data: null, error: { message: "permission denied" } } });
    await expect(makeRepo(mock.client).uploadPhoto(makeFile(), "project-1")).rejects.toThrow("permission denied");
    expect(mock.tableBuilder.insert).not.toHaveBeenCalled();
  });

  it("propagates missing bucket errors", async () => {
    const mock = makeClient({ upload: { data: null, error: { message: "Bucket not found" } } });
    await expect(makeRepo(mock.client).uploadPhoto(makeFile(), "project-1")).rejects.toThrow("Bucket not found");
  });

  it("removes uploaded object when signed url generation fails", async () => {
    const mock = makeClient({ signedUrl: { data: null, error: { message: "network failed" } } });
    await expect(makeRepo(mock.client).uploadPhoto(makeFile(), "project-1")).rejects.toThrow("network failed");
    expect(mock.remove).toHaveBeenCalledWith([`project-1/${fixedId}.jpg`]);
  });

  it("removes uploaded object when metadata insert fails", async () => {
    const mock = makeClient({ insert: { data: null, error: { message: "insert failed" } } });
    await expect(makeRepo(mock.client).uploadPhoto(makeFile(), "project-1")).rejects.toThrow("insert failed");
    expect(mock.remove).toHaveBeenCalledWith([`project-1/${fixedId}.jpg`]);
  });

  it("uses png extension for png uploads", async () => {
    const mock = makeClient();
    await makeRepo(mock.client).uploadPhoto(makeFile("site.png", "image/png"), "project-1");
    expect(mock.upload).toHaveBeenCalledWith(`project-1/${fixedId}.png`, expect.any(File), expect.any(Object));
  });

  it("lists photos by project and refreshes signed urls", async () => {
    const mock = makeClient({ list: { data: [makeRow({ storage_path: "project-1/photo-2.jpg" })], error: null } });
    const result = await makeRepo(mock.client).listPhotosByProject("project-1");
    expect(mock.listBuilder.eq).toHaveBeenCalledWith("project_id", "project-1");
    expect(result[0].url).toContain("project-1/photo-2.jpg");
  });

  it("propagates list network failures", async () => {
    const mock = makeClient({ list: { data: null, error: { message: "network down" } } });
    await expect(makeRepo(mock.client).listPhotosByProject("project-1")).rejects.toThrow("network down");
  });
});
