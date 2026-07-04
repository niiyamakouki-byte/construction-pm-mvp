import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { DocumentsPage } from "./DocumentsPageImpl.js";
import type { Project } from "../domain/types.js";

// ── Mocks ──────────────────────────────────────────────────────────────────────

const mockFindById = vi.fn();
const mockNavigate = vi.hoisted(() => vi.fn());

vi.mock("../stores/project-store.js", () => ({
  createProjectRepository: () => ({
    findById: mockFindById,
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

function jsonResponse(body: unknown, init: { ok?: boolean; status?: number } = {}) {
  const ok = init.ok ?? true;
  return {
    ok,
    status: init.status ?? (ok ? 200 : 400),
    json: async () => body,
  } as Response;
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  mockFindById.mockResolvedValue(makeProject());
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("DocumentsPage - 既存資料への新バージョンアップロード", () => {
  it("資料一覧の各行に「新しいバージョンをアップロード」操作がある", async () => {
    const existingDocument = makeDocument();
    fetchMock.mockResolvedValueOnce(jsonResponse({ documents: [existingDocument] }));

    render(<DocumentsPage projectId="proj-1" />);

    await screen.findByText(existingDocument.name);
    expect(screen.getByRole("button", { name: "新しいバージョンをアップロード" })).toBeTruthy();
  });

  it("新しいバージョンをアップロードすると createDocument(POST) ではなく updateDocument(PATCH) を呼び、旧urlが履歴に退避される", async () => {
    const existingDocument = makeDocument();
    const updatedDocument = { ...existingDocument, url: "https://drive.google.com/file/d/updated/view", version: "v1.1" };

    fetchMock.mockImplementation((input: string, init?: RequestInit) => {
      if (input === "/api/projects/proj-1/documents" && (!init || init.method === undefined)) {
        return Promise.resolve(jsonResponse({ documents: [existingDocument] }));
      }
      if (input === `/api/documents/${existingDocument.id}` && init?.method === "PATCH") {
        const body = JSON.parse(init.body as string) as { url: string; version: string };
        expect(body.url).toBe("https://drive.google.com/file/d/updated/view");
        expect(body.version).toBe("v1.1");
        return Promise.resolve(jsonResponse({ document: updatedDocument }));
      }
      if (input === `/api/documents/${existingDocument.id}/versions`) {
        return Promise.resolve(
          jsonResponse({
            versions: [
              {
                ...existingDocument,
                id: "version-1",
                documentId: existingDocument.id,
              },
            ],
          }),
        );
      }
      throw new Error(`unexpected fetch call: ${input} ${init?.method ?? "GET"}`);
    });

    render(<DocumentsPage projectId="proj-1" />);
    await screen.findByText(existingDocument.name);

    fireEvent.click(screen.getByRole("button", { name: "新しいバージョンをアップロード" }));

    const urlInput = screen.getByPlaceholderText("新しいバージョンのファイルURL");
    fireEvent.change(urlInput, { target: { value: "https://drive.google.com/file/d/updated/view" } });
    fireEvent.click(screen.getByRole("button", { name: "アップロード" }));

    await waitFor(() => {
      const patchCalls = fetchMock.mock.calls.filter(
        (call) => call[0] === `/api/documents/${existingDocument.id}` && call[1]?.method === "PATCH",
      );
      expect(patchCalls).toHaveLength(1);
    });

    // createDocument(新規POST) は呼ばれていない
    const createCalls = fetchMock.mock.calls.filter(
      (call) => call[0] === "/api/projects/proj-1/documents" && call[1]?.method === "POST",
    );
    expect(createCalls).toHaveLength(0);

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

    fetchMock.mockImplementation((input: string, init?: RequestInit) => {
      if (input === "/api/projects/proj-1/documents" && init?.method === undefined) {
        return Promise.resolve(jsonResponse({ documents: [existingDocument] }));
      }
      if (input === `/api/documents/${existingDocument.id}` && init?.method === "PATCH") {
        return Promise.resolve(jsonResponse({ document: updatedDocument }));
      }
      if (input === `/api/documents/${existingDocument.id}/versions`) {
        return Promise.resolve(jsonResponse({ versions: [] }));
      }
      if (input === "/api/projects/proj-1/documents" && init?.method === "POST") {
        throw new Error("createDocument(POST) は呼ばれてはいけない（既存の新版にするを選択した場合）");
      }
      throw new Error(`unexpected fetch call: ${input} ${init?.method ?? "GET"}`);
    });

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
      const patchCalls = fetchMock.mock.calls.filter(
        (call) => call[0] === `/api/documents/${existingDocument.id}` && call[1]?.method === "PATCH",
      );
      expect(patchCalls).toHaveLength(1);
    });

    // 一覧には依然1件のみ（新規ドキュメントとして並存しない）
    expect(screen.getAllByRole("button", { name: "新しいバージョンをアップロード" })).toHaveLength(1);
  });

  it("既存の新規登録フロー（同名なし）は createDocument(POST) を呼ぶ", async () => {
    const createdDocument = makeDocument({ id: "doc-2", name: "新規図面_B-1" });

    fetchMock.mockImplementation((input: string, init?: RequestInit) => {
      if (input === "/api/projects/proj-1/documents" && init?.method === undefined) {
        return Promise.resolve(jsonResponse({ documents: [] }));
      }
      if (input === "/api/projects/proj-1/documents" && init?.method === "POST") {
        return Promise.resolve(jsonResponse({ document: createdDocument }, { status: 201 }));
      }
      if (input === "/api/documents/doc-2/versions") {
        return Promise.resolve(jsonResponse({ versions: [] }));
      }
      throw new Error(`unexpected fetch call: ${input} ${init?.method ?? "GET"}`);
    });

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
      const createCalls = fetchMock.mock.calls.filter(
        (call) => call[0] === "/api/projects/proj-1/documents" && call[1]?.method === "POST",
      );
      expect(createCalls).toHaveLength(1);
    });

    await screen.findByText("版 v1.0");
  });
});
