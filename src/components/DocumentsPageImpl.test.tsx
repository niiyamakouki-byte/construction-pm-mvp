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
