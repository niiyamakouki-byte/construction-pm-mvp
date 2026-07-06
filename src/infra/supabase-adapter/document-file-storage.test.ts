import { describe, expect, it, vi } from "vitest";
import {
  inferDocumentTypeFromFile,
  isSupportedDocumentFile,
  MAX_DOCUMENT_FILE_SIZE,
  uploadProjectDocumentFile,
  validateDocumentFile,
} from "./document-file-storage.js";

function makeFile(name: string, type: string, size = 1024): File {
  const bytes = new Uint8Array(size);
  return new File([bytes], name, { type });
}

describe("isSupportedDocumentFile / inferDocumentTypeFromFile", () => {
  it("PDFと主要画像形式を許可する", () => {
    expect(isSupportedDocumentFile(makeFile("a.pdf", "application/pdf"))).toBe(true);
    expect(isSupportedDocumentFile(makeFile("a.png", "image/png"))).toBe(true);
    expect(isSupportedDocumentFile(makeFile("a.jpg", "image/jpeg"))).toBe(true);
  });

  it("MIMEが空でも拡張子で判定してPDF/画像を許可する", () => {
    expect(isSupportedDocumentFile(makeFile("scan.pdf", ""))).toBe(true);
    expect(isSupportedDocumentFile(makeFile("photo.heic", ""))).toBe(true);
  });

  it("非対応形式(zip等)は拒否する", () => {
    expect(isSupportedDocumentFile(makeFile("archive.zip", "application/zip"))).toBe(false);
  });

  it("画像はphoto、それ以外(PDF等)はdrawingとして推定する", () => {
    expect(inferDocumentTypeFromFile(makeFile("a.png", "image/png"))).toBe("photo");
    expect(inferDocumentTypeFromFile(makeFile("a.pdf", "application/pdf"))).toBe("drawing");
  });
});

describe("validateDocumentFile", () => {
  it("空ファイルを拒否する", () => {
    expect(() => validateDocumentFile(makeFile("empty.pdf", "application/pdf", 0))).toThrow(/空/);
  });

  it("上限を超えるファイルサイズを拒否する", () => {
    expect(() =>
      validateDocumentFile(makeFile("huge.pdf", "application/pdf", MAX_DOCUMENT_FILE_SIZE + 1)),
    ).toThrow(/上限/);
  });

  it("非対応形式を拒否する", () => {
    expect(() => validateDocumentFile(makeFile("a.zip", "application/zip"))).toThrow(/対応していない/);
  });
});

describe("uploadProjectDocumentFile", () => {
  it("Supabase未接続時はオブジェクトURLにフォールバックする(ローカル/E2E動作)", async () => {
    const createObjectUrl = vi.fn().mockReturnValue("blob:mock-url");
    // jsdomはURL.createObjectURLを実装していないため直接差し替える
    (URL as unknown as { createObjectURL: typeof createObjectUrl }).createObjectURL = createObjectUrl;

    const result = await uploadProjectDocumentFile(makeFile("a.pdf", "application/pdf"), "proj-1", {
      hasSupabaseEnv: () => false,
      isE2EBypass: () => false,
    });

    expect(result.url).toBe("blob:mock-url");
    expect(result.storagePath).toBeNull();
    expect(createObjectUrl).toHaveBeenCalledTimes(1);
  });

  it("E2Eバイパス時もオブジェクトURLにフォールバックする", async () => {
    const createObjectUrl = vi.fn().mockReturnValue("blob:e2e-url");
    (URL as unknown as { createObjectURL: typeof createObjectUrl }).createObjectURL = createObjectUrl;

    const result = await uploadProjectDocumentFile(makeFile("a.png", "image/png"), "proj-1", {
      hasSupabaseEnv: () => true,
      isE2EBypass: () => true,
    });

    expect(result.url).toBe("blob:e2e-url");
  });

  it("Supabase接続時はStorageへアップロードし署名付きURLを返す", async () => {
    const upload = vi.fn().mockResolvedValue({ data: { path: "proj-1/id.pdf" }, error: null });
    const createSignedUrl = vi.fn().mockResolvedValue({ data: { signedUrl: "https://signed.example/a.pdf" }, error: null });
    const remove = vi.fn().mockResolvedValue({ data: null, error: null });
    const from = vi.fn().mockReturnValue({ upload, createSignedUrl, remove });

    const result = await uploadProjectDocumentFile(makeFile("a.pdf", "application/pdf"), "proj-1", {
      hasSupabaseEnv: () => true,
      isE2EBypass: () => false,
      idGenerator: () => "fixed-id",
      getClient: async () => ({
        from: vi.fn(),
        auth: {} as never,
        storage: { from },
      }),
    });

    expect(from).toHaveBeenCalledWith("project-documents");
    expect(upload).toHaveBeenCalledWith(
      "proj-1/fixed-id.pdf",
      expect.anything(),
      expect.objectContaining({ contentType: "application/pdf" }),
    );
    expect(result.url).toBe("https://signed.example/a.pdf");
    expect(result.storagePath).toBe("proj-1/fixed-id.pdf");
  });

  it("アップロード失敗時はエラーを投げる", async () => {
    const upload = vi.fn().mockResolvedValue({ data: null, error: { message: "boom" } });
    const from = vi.fn().mockReturnValue({ upload, createSignedUrl: vi.fn(), remove: vi.fn() });

    await expect(
      uploadProjectDocumentFile(makeFile("a.pdf", "application/pdf"), "proj-1", {
        hasSupabaseEnv: () => true,
        isE2EBypass: () => false,
        getClient: async () => ({ from: vi.fn(), auth: {} as never, storage: { from } }),
      }),
    ).rejects.toThrow("boom");
  });

  it("案件IDが無い場合はエラー", async () => {
    await expect(
      uploadProjectDocumentFile(makeFile("a.pdf", "application/pdf"), "", {
        hasSupabaseEnv: () => false,
        isE2EBypass: () => false,
      }),
    ).rejects.toThrow(/案件/);
  });
});
