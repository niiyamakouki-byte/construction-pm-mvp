import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { DocumentsPage } from "./DocumentsPageImpl.js";
import type { Project } from "../domain/types.js";

// ── Mocks ──────────────────────────────────────────────────────────────────────

const mockFindById = vi.fn();
const mockDocumentFindAll = vi.fn();
const mockDocumentCreate = vi.fn();
const mockDocumentUpdate = vi.fn();
const mockVersionFindAll = vi.fn();
const mockVersionCreate = vi.fn();
const mockNavigate = vi.hoisted(() => vi.fn());
const mockUploadProjectDocumentFile = vi.hoisted(() => vi.fn());
const mockRefreshDocumentUrl = vi.hoisted(() => vi.fn());

vi.mock("../infra/supabase-adapter/document-file-storage.js", async () => {
  const actual = await vi.importActual<typeof import("../infra/supabase-adapter/document-file-storage.js")>(
    "../infra/supabase-adapter/document-file-storage.js",
  );
  return {
    ...actual,
    uploadProjectDocumentFile: mockUploadProjectDocumentFile,
    refreshDocumentUrl: mockRefreshDocumentUrl,
  };
});

vi.mock("../stores/project-store.js", () => ({
  createProjectRepository: () => ({
    findById: mockFindById,
  }),
}));

vi.mock("../stores/document-store.js", () => ({
  createDocumentRepository: () => ({
    findAll: mockDocumentFindAll,
    create: mockDocumentCreate,
    update: mockDocumentUpdate,
  }),
  createDocumentVersionRepository: () => ({
    findAll: mockVersionFindAll,
    create: mockVersionCreate,
  }),
}));

vi.mock("../contexts/OrganizationContext.js", () => ({
  useOrganizationContext: () => ({ organizationId: "test-org" }),
}));

vi.mock("../contexts/AuthContext.js", () => ({
  useAuth: () => ({ user: { id: "user-1", email: "tester@example.com" } }),
}));

vi.mock("../hooks/useHashRouter.js", () => ({
  navigate: mockNavigate,
}));

// construction_pm_mvp-6jt: 直接.pdf URLは黒画面になる生iframe埋め込みをやめ、
// pdf.js canvas描画コンポーネントへ委譲する。ここでは委譲先が正しく呼ばれることのみ検証する
// (canvas描画自体の挙動は PdfCanvasPreview.test.tsx で検証済み)。
vi.mock("./PdfCanvasPreview.js", () => ({
  PdfCanvasPreview: ({ src, title }: { src: string; title: string }) => (
    <div data-testid="pdf-canvas-preview" data-src={src} data-title={title} />
  ),
}));

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: "proj-1",
    name: "青山オフィス改修",
    description: "",
    status: "active",
    startDate: "2025-01-01",
    includeWeekends: true,
    budget: 100000,
    createdAt: "2025-01-01T00:00:00.000Z",
    updatedAt: "2025-01-01T00:00:00.000Z",
    ...overrides,
  } as Project;
}

type DocumentFixture = {
  id: string;
  createdAt: string;
  updatedAt: string;
  projectId: string;
  name: string;
  type: string;
  url: string;
  uploadedBy: string;
  version: string;
};

function makeDocument(overrides: Partial<DocumentFixture> = {}): DocumentFixture {
  return {
    id: "doc-1",
    createdAt: "2026-06-01T00:00:00.000Z",
    updatedAt: "2026-06-01T00:00:00.000Z",
    projectId: "proj-1",
    name: "意匠図_A-101",
    type: "drawing",
    url: "https://drive.google.com/file/d/original/view",
    uploadedBy: "tester@example.com",
    version: "v1.0",
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockFindById.mockResolvedValue(makeProject());
  mockVersionFindAll.mockResolvedValue([]);
  mockVersionCreate.mockResolvedValue(undefined);
  mockRefreshDocumentUrl.mockImplementation(async (url: string) => url);
});

afterEach(() => {
  cleanup();
});

describe("DocumentsPage - 既存資料への新バージョンアップロード", () => {
  it("資料一覧の各行に「新しいバージョンをアップロード」操作がある", async () => {
    const existingDocument = makeDocument();
    mockDocumentFindAll.mockResolvedValue([existingDocument]);

    render(<DocumentsPage projectId="proj-1" />);

    await screen.findByText(existingDocument.name);
    expect(screen.getByRole("button", { name: "新しいバージョンをアップロード" })).toBeTruthy();
  });

  it("新しいバージョンをアップロードすると documentRepository.create ではなく update を呼び、旧urlが履歴に退避される", async () => {
    const existingDocument = makeDocument();
    const updatedDocument = { ...existingDocument, url: "https://drive.google.com/file/d/updated/view", version: "v1.1" };

    mockDocumentFindAll.mockResolvedValue([existingDocument]);
    mockDocumentUpdate.mockResolvedValue(updatedDocument);
    mockVersionFindAll.mockResolvedValue([
      { ...existingDocument, id: "version-1", documentId: existingDocument.id },
    ]);

    render(<DocumentsPage projectId="proj-1" />);
    await screen.findByText(existingDocument.name);

    fireEvent.click(screen.getByRole("button", { name: "新しいバージョンをアップロード" }));

    const urlInput = screen.getByPlaceholderText("新しいバージョンのファイルURL");
    fireEvent.change(urlInput, { target: { value: "https://drive.google.com/file/d/updated/view" } });
    fireEvent.click(screen.getByRole("button", { name: "アップロード" }));

    await waitFor(() => {
      expect(mockDocumentUpdate).toHaveBeenCalledTimes(1);
    });
    expect(mockDocumentUpdate).toHaveBeenCalledWith(
      existingDocument.id,
      expect.objectContaining({ url: "https://drive.google.com/file/d/updated/view", version: "v1.1" }),
    );

    // 更新前のドキュメントがバージョン履歴として退避される
    expect(mockVersionCreate).toHaveBeenCalledTimes(1);
    expect(mockVersionCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        documentId: existingDocument.id,
        url: existingDocument.url,
        version: existingDocument.version,
      }),
    );

    // documentRepository.create(新規登録) は呼ばれていない
    expect(mockDocumentCreate).not.toHaveBeenCalled();

    // 版数バッジが更新後の版数を表示する
    await screen.findByText("版 v1.1");

    // 一覧に旧版が別行として並ばない（依然1件のみ、アップロード導線も1つだけ）
    expect(screen.getAllByRole("button", { name: "新しいバージョンをアップロード" })).toHaveLength(1);
  });

  it("同名資料が既存の場合、新規追加か既存の新版にするか選択させる", async () => {
    const existingDocument = makeDocument({ name: "意匠図_A-101" });
    const updatedDocument = {
      ...existingDocument,
      url: "https://drive.google.com/file/d/replaced/view",
      version: "v1.1",
    };

    mockDocumentFindAll.mockResolvedValue([existingDocument]);
    mockDocumentUpdate.mockResolvedValue(updatedDocument);
    mockVersionFindAll.mockResolvedValue([]);

    render(<DocumentsPage projectId="proj-1" />);
    await screen.findByText(existingDocument.name);

    fireEvent.change(screen.getByPlaceholderText("例: 意匠図_A-101"), {
      target: { value: "意匠図_A-101" },
    });
    fireEvent.change(screen.getByPlaceholderText("https://drive.google.com/file/d/..."), {
      target: { value: "https://drive.google.com/file/d/replaced/view" },
    });
    fireEvent.click(screen.getByRole("button", { name: "ドキュメントを追加" }));

    await screen.findByRole("alert");
    expect(screen.getByText(/同名のドキュメントが既に登録されています/)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "既存の新しいバージョンにする" }));

    await waitFor(() => {
      expect(mockDocumentUpdate).toHaveBeenCalledTimes(1);
    });

    // documentRepository.create(新規登録) は呼ばれてはいけない（既存の新版にするを選択した場合）
    expect(mockDocumentCreate).not.toHaveBeenCalled();

    // 一覧には依然1件のみ（新規ドキュメントとして並存しない）
    expect(screen.getAllByRole("button", { name: "新しいバージョンをアップロード" })).toHaveLength(1);
  });

  it("既存の新規登録フロー（同名なし）は documentRepository.create を呼ぶ", async () => {
    const createdDocument = makeDocument({ id: "doc-2", name: "新規図面_B-1" });

    mockDocumentFindAll.mockResolvedValue([]);
    mockDocumentCreate.mockResolvedValue(createdDocument);
    mockVersionFindAll.mockResolvedValue([]);

    render(<DocumentsPage projectId="proj-1" />);
    await waitFor(() => expect(mockFindById).toHaveBeenCalled());

    fireEvent.change(screen.getByPlaceholderText("例: 意匠図_A-101"), {
      target: { value: "新規図面_B-1" },
    });
    fireEvent.change(screen.getByPlaceholderText("https://drive.google.com/file/d/..."), {
      target: { value: "https://drive.google.com/file/d/new/view" },
    });
    fireEvent.click(screen.getByRole("button", { name: "ドキュメントを追加" }));

    await waitFor(() => {
      expect(mockDocumentCreate).toHaveBeenCalledTimes(1);
    });
    expect(mockDocumentCreate).toHaveBeenCalledWith(
      expect.objectContaining({ name: "新規図面_B-1", projectId: "proj-1", version: "v1.0" }),
    );

    await screen.findByText("版 v1.0");
  });
});

describe("DocumentsPage - PDFプレビュー(construction_pm_mvp-6jt 黒画面バグ回帰)", () => {
  it("直接.pdf URLのドキュメントを選択すると、生iframeではなくPdfCanvasPreviewへ委譲する", async () => {
    const pdfDocument = makeDocument({
      id: "doc-pdf-1",
      name: "1F平面図.pdf",
      url: "https://example.com/files/1F-plan.pdf",
    });
    mockDocumentFindAll.mockResolvedValue([pdfDocument]);

    render(<DocumentsPage projectId="proj-1" />);
    await screen.findByText(pdfDocument.name);

    fireEvent.click(screen.getByText(pdfDocument.name));

    const preview = await screen.findByTestId("pdf-canvas-preview");
    expect(preview.getAttribute("data-src")).toBe(pdfDocument.url);
    expect(preview.getAttribute("data-title")).toBe(pdfDocument.name);

    // 黒画面の原因だった「生PDF URLを指すiframe」が描画されないこと
    expect(document.querySelector('iframe[src$=".pdf"]')).toBeNull();
  });
});

describe("DocumentsPage - バージョン履歴「開く」リンクの再署名(7日期限切れ対策)", () => {
  it("旧版・現在版とも「開く」リンクは保存済み署名URLではなく再署名後のURLを指す", async () => {
    const staleCurrentUrl =
      "https://example.supabase.co/storage/v1/object/sign/project-documents/proj-1/current.pdf?token=stale-current";
    const staleOldUrl =
      "https://example.supabase.co/storage/v1/object/sign/project-documents/proj-1/old.pdf?token=stale-old";
    const pdfDocument = makeDocument({ name: "図面_A-101.pdf", url: staleCurrentUrl, version: "v1.1" });
    mockDocumentFindAll.mockResolvedValue([pdfDocument]);
    mockVersionFindAll.mockResolvedValue([
      { ...makeDocument({ url: staleOldUrl, version: "v1.0" }), id: "version-1", documentId: pdfDocument.id },
    ]);
    mockRefreshDocumentUrl.mockImplementation(async (url: string) => url.replace(/token=[^&]+/, "token=fresh"));

    render(<DocumentsPage projectId="proj-1" />);
    await screen.findByText(pdfDocument.name);
    fireEvent.click(screen.getByText(pdfDocument.name));

    await screen.findAllByRole("link", { name: "開く" });
    await waitFor(() => {
      const hrefs = screen.getAllByRole("link", { name: "開く" }).map((link) => link.getAttribute("href"));
      expect(hrefs).toContain(staleOldUrl.replace("token=stale-old", "token=fresh"));
      expect(hrefs).toContain(staleCurrentUrl.replace("token=stale-current", "token=fresh"));
      expect(hrefs.join(" ")).not.toContain("token=stale");
    });
  });

  it("再署名対象外のURL(Drive等)はそのまま「開く」リンクに使われる", async () => {
    const driveDocument = makeDocument();
    mockDocumentFindAll.mockResolvedValue([driveDocument]);
    mockVersionFindAll.mockResolvedValue([
      { ...makeDocument({ url: "https://drive.google.com/file/d/old-version/view", version: "v0.9" }), id: "version-1", documentId: driveDocument.id },
    ]);

    render(<DocumentsPage projectId="proj-1" />);
    await screen.findByText(driveDocument.name);
    fireEvent.click(screen.getByText(driveDocument.name));

    await waitFor(() => {
      const hrefs = screen.getAllByRole("link", { name: "開く" }).map((link) => link.getAttribute("href"));
      expect(hrefs).toContain(driveDocument.url);
      expect(hrefs).toContain("https://drive.google.com/file/d/old-version/view");
    });
  });
});

function makeDropFile(name: string, type: string): File {
  return new File([new Uint8Array(4)], name, { type });
}

function fireDropEvent(target: Element, files: File[]) {
  const dataTransfer = { files, types: ["Files"] };
  fireEvent.dragEnter(target, { dataTransfer });
  fireEvent.drop(target, { dataTransfer });
}

describe("DocumentsPage - ドラッグ&ドロップ一括インポート", () => {
  it("複数ファイルをドロップすると一括でdocumentRepository.createが呼ばれ、最後の1件が選択(即プレビュー)される", async () => {
    mockDocumentFindAll.mockResolvedValue([]);
    const createdA = makeDocument({ id: "doc-a", name: "a.pdf", url: "blob:a" });
    const createdB = makeDocument({ id: "doc-b", name: "b.png", url: "blob:b" });

    mockUploadProjectDocumentFile
      .mockResolvedValueOnce({ url: "blob:a", storagePath: null, fileName: "a.pdf", contentType: "application/pdf", fileSize: 4 })
      .mockResolvedValueOnce({ url: "blob:b", storagePath: null, fileName: "b.png", contentType: "image/png", fileSize: 4 });
    mockDocumentCreate.mockResolvedValueOnce(createdA).mockResolvedValueOnce(createdB);

    const { container } = render(<DocumentsPage projectId="proj-1" />);
    await waitFor(() => expect(mockFindById).toHaveBeenCalled());

    const dropTarget = container.querySelector(".relative.mx-auto") as Element;
    fireDropEvent(dropTarget, [makeDropFile("a.pdf", "application/pdf"), makeDropFile("b.png", "image/png")]);

    await waitFor(() => expect(mockDocumentCreate).toHaveBeenCalledTimes(2));
    expect(mockUploadProjectDocumentFile).toHaveBeenCalledTimes(2);

    await waitFor(() => expect(screen.getAllByText("b.png").length).toBeGreaterThan(0));
    expect(screen.getAllByText("a.pdf").length).toBeGreaterThan(0);

    // 最後にアップロードした資料のバージョン履歴が読み込まれる(=即選択・即プレビュー)
    await waitFor(() => expect(mockVersionFindAll).toHaveBeenCalled());

    // blob:オブジェクトURL(拡張子なし)でもファイル名(b.png)から画像プレビューに委譲される
    // (window.open フォールバックに落ちない = 即プレビューが成立している)
    const preview = await screen.findByAltText("b.png");
    expect(preview.getAttribute("src")).toBe("blob:b");
  });

  it("非対応形式をドロップするとエラー表示になりcreateは呼ばれない", async () => {
    mockDocumentFindAll.mockResolvedValue([]);

    const { container } = render(<DocumentsPage projectId="proj-1" />);
    await waitFor(() => expect(mockFindById).toHaveBeenCalled());

    const dropTarget = container.querySelector(".relative.mx-auto") as Element;
    fireDropEvent(dropTarget, [makeDropFile("archive.zip", "application/zip")]);

    await screen.findByRole("alert");
    expect(mockDocumentCreate).not.toHaveBeenCalled();
    expect(mockUploadProjectDocumentFile).not.toHaveBeenCalled();
  });

  it("ドラッグ中はドロップを促すオーバーレイを表示する", async () => {
    mockDocumentFindAll.mockResolvedValue([]);
    const { container } = render(<DocumentsPage projectId="proj-1" />);
    await waitFor(() => expect(mockFindById).toHaveBeenCalled());

    const dropTarget = container.querySelector(".relative.mx-auto") as Element;
    fireEvent.dragEnter(dropTarget, { dataTransfer: { files: [], types: ["Files"] } });

    expect(await screen.findByText("ここにPDF・画像をドロップして登録")).toBeTruthy();
  });

  it("ファイル選択ボタン(モバイル等D&D不可環境向け)からも同じ一括インポートが動く", async () => {
    mockDocumentFindAll.mockResolvedValue([]);
    const created = makeDocument({ id: "doc-picked", name: "picked.pdf", url: "blob:picked" });
    mockUploadProjectDocumentFile.mockResolvedValueOnce({
      url: "blob:picked",
      storagePath: null,
      fileName: "picked.pdf",
      contentType: "application/pdf",
      fileSize: 4,
    });
    mockDocumentCreate.mockResolvedValueOnce(created);

    render(<DocumentsPage projectId="proj-1" />);
    await waitFor(() => expect(mockFindById).toHaveBeenCalled());

    const input = screen.getByLabelText("PDF・画像ファイルを選択して登録") as HTMLInputElement;
    fireEvent.change(input, { target: { files: [makeDropFile("picked.pdf", "application/pdf")] } });

    await waitFor(() => expect(mockDocumentCreate).toHaveBeenCalledTimes(1));
    expect(mockUploadProjectDocumentFile).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.getAllByText("picked.pdf").length).toBeGreaterThan(0));
    // 続けて同じファイルを選び直せるようinputはリセットされる
    expect(input.value).toBe("");
  });
});

describe("DocumentsPage - 共有/エクスポート", () => {
  it("Web Share API対応時はファイル共有を1タップで呼び出す", async () => {
    const pdfDocument = makeDocument({ id: "doc-pdf-1", name: "1F平面図.pdf", url: "https://example.com/files/1F-plan.pdf" });
    mockDocumentFindAll.mockResolvedValue([pdfDocument]);

    const blob = new Blob(["dummy"], { type: "application/pdf" });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, blob: () => Promise.resolve(blob) }));
    const shareMock = vi.fn().mockResolvedValue(undefined);
    const canShareMock = vi.fn().mockReturnValue(true);
    vi.stubGlobal("navigator", { ...navigator, share: shareMock, canShare: canShareMock });

    render(<DocumentsPage projectId="proj-1" />);
    await screen.findByText(pdfDocument.name);
    fireEvent.click(screen.getByText(pdfDocument.name));

    const shareButton = await screen.findByRole("button", { name: "共有 / ダウンロード" });
    fireEvent.click(shareButton);

    await waitFor(() => expect(shareMock).toHaveBeenCalledTimes(1));
    expect(canShareMock).toHaveBeenCalled();

    vi.unstubAllGlobals();
  });

  it("Web Share API非対応時はダウンロードにフォールバックする", async () => {
    const pdfDocument = makeDocument({ id: "doc-pdf-1", name: "1F平面図.pdf", url: "https://example.com/files/1F-plan.pdf" });
    mockDocumentFindAll.mockResolvedValue([pdfDocument]);

    const blob = new Blob(["dummy"], { type: "application/pdf" });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, blob: () => Promise.resolve(blob) }));
    const createObjectUrl = vi.fn().mockReturnValue("blob:download-url");
    const revokeObjectUrl = vi.fn();
    (URL as unknown as { createObjectURL: typeof createObjectUrl }).createObjectURL = createObjectUrl;
    (URL as unknown as { revokeObjectURL: typeof revokeObjectUrl }).revokeObjectURL = revokeObjectUrl;
    vi.stubGlobal("navigator", { ...navigator, share: undefined, canShare: undefined });

    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    render(<DocumentsPage projectId="proj-1" />);
    await screen.findByText(pdfDocument.name);
    fireEvent.click(screen.getByText(pdfDocument.name));

    const shareButton = await screen.findByRole("button", { name: "共有 / ダウンロード" });
    fireEvent.click(shareButton);

    await waitFor(() => expect(clickSpy).toHaveBeenCalledTimes(1));
    expect(createObjectUrl).toHaveBeenCalledWith(blob);

    clickSpy.mockRestore();
    vi.unstubAllGlobals();
  });
});
