import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { ClientViewerPage } from "./ClientViewerPage.js";

function createMockLocalStorage(): Storage {
  const store = new Map<string, string>();
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => { store.set(key, value); },
    removeItem: (key: string) => { store.delete(key); },
    clear: () => { store.clear(); },
    get length() { return store.size; },
    key: (index: number) => [...store.keys()][index] ?? null,
  };
}

const mockFindById = vi.fn();
const mockFindAll = vi.fn();

vi.mock("../stores/project-store.js", () => ({
  createProjectRepository: () => ({
    findById: mockFindById,
  }),
}));

vi.mock("../stores/task-store.js", () => ({
  createTaskRepository: () => ({
    findAll: mockFindAll,
  }),
}));

vi.mock("../lib/chat-store.js", () => ({
  getMessages: vi.fn().mockReturnValue([]),
}));

vi.mock("../lib/change-request.js", () => ({
  getChangeRequests: vi.fn().mockReturnValue([]),
  updateChangeRequest: vi.fn(),
}));

const baseProject = {
  id: "proj-1",
  name: "南青山リノベーション",
  description: "内装工事",
  status: "active",
  startDate: "2025-01-01",
  address: "東京都港区南青山",
  budget: 5_000_000,
  includeWeekends: false,
  createdAt: "2025-01-01T00:00:00.000Z",
  updatedAt: "2025-01-01T00:00:00.000Z",
};

const doneTasks = [
  {
    id: "t1",
    projectId: "proj-1",
    title: "解体工事",
    status: "done",
    startDate: "2025-01-10",
    dueDate: "2025-01-15",
    photoUrls: ["https://example.com/photo1.jpg"],
    createdAt: "2025-01-01T00:00:00.000Z",
    updatedAt: "2025-01-01T00:00:00.000Z",
  },
  {
    id: "t2",
    projectId: "proj-1",
    title: "配線工事",
    status: "todo",
    startDate: "2025-01-20",
    dueDate: "2025-01-25",
    photoUrls: [],
    createdAt: "2025-01-01T00:00:00.000Z",
    updatedAt: "2025-01-01T00:00:00.000Z",
  },
];

describe("ClientViewerPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("localStorage", createMockLocalStorage());
    mockFindById.mockResolvedValue(baseProject);
    mockFindAll.mockResolvedValue([]);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("renders loading state initially", () => {
    render(<ClientViewerPage projectId="proj-1" />);
    expect(screen.getByText("読み込み中...")).toBeDefined();
  });

  it("renders project name after load", async () => {
    render(<ClientViewerPage projectId="proj-1" />);
    const el = await screen.findByText("南青山リノベーション");
    expect(el).toBeDefined();
  });

  it("shows 施主ポータル label", async () => {
    render(<ClientViewerPage projectId="proj-1" />);
    await screen.findByText("南青山リノベーション");
    expect(screen.getByText(/施主ポータル/)).toBeDefined();
  });

  it("shows 読み取り専用 notice", async () => {
    render(<ClientViewerPage projectId="proj-1" />);
    await screen.findByText("南青山リノベーション");
    expect(screen.getByText(/読み取り専用/)).toBeDefined();
  });

  it("shows project address", async () => {
    render(<ClientViewerPage projectId="proj-1" />);
    await screen.findByText("南青山リノベーション");
    expect(screen.getByText("東京都港区南青山")).toBeDefined();
  });

  it("renders not found state for unknown project", async () => {
    mockFindById.mockResolvedValueOnce(null);
    render(<ClientViewerPage projectId="unknown" />);
    const el = await screen.findByText("プロジェクトが見つかりません");
    expect(el).toBeDefined();
  });

  it("calculates 50% progress with 1 done of 2 tasks", async () => {
    mockFindAll.mockResolvedValue(doneTasks);
    render(<ClientViewerPage projectId="proj-1" />);
    await screen.findByText("南青山リノベーション");
    expect(screen.getByText("50%")).toBeDefined();
  });

  it("shows 0% progress when no tasks", async () => {
    render(<ClientViewerPage projectId="proj-1" />);
    await screen.findByText("南青山リノベーション");
    expect(screen.getByText("0%")).toBeDefined();
  });

  it("shows project flow stages", async () => {
    render(<ClientViewerPage projectId="proj-1" />);
    await screen.findByText("南青山リノベーション");
    expect(screen.getByText("依頼")).toBeDefined();
    expect(screen.getByText("着工")).toBeDefined();
    expect(screen.getByText("完工")).toBeDefined();
  });

  it("shows photo gallery when tasks have photos", async () => {
    mockFindAll.mockResolvedValue(doneTasks);
    render(<ClientViewerPage projectId="proj-1" />);
    await screen.findByText("南青山リノベーション");
    expect(screen.getByText("最新の工事写真")).toBeDefined();
    const img = screen.getByAltText("工事写真 1") as HTMLImageElement;
    expect(img.src).toBe("https://example.com/photo1.jpg");
  });

  it("shows コメント投稿 form", async () => {
    render(<ClientViewerPage projectId="proj-1" />);
    await screen.findByText("南青山リノベーション");
    expect(screen.getByText("施主コメント")).toBeDefined();
    expect(screen.getByPlaceholderText("現場への質問・ご要望をどうぞ")).toBeDefined();
  });

  it("submits a comment and shows it", async () => {
    render(<ClientViewerPage projectId="proj-1" />);
    await screen.findByText("南青山リノベーション");
    const textarea = screen.getByPlaceholderText("現場への質問・ご要望をどうぞ") as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: "壁の色を変えたい" } });
    const btn = screen.getByText("送信する");
    fireEvent.click(btn);
    expect(screen.getByText(/壁の色を変えたい/)).toBeDefined();
  });

  it("shows 今後1週間の工程予定 section", async () => {
    render(<ClientViewerPage projectId="proj-1" />);
    await screen.findByText("南青山リノベーション");
    expect(screen.getByText("今後1週間の工程予定")).toBeDefined();
  });

  it("shows 今日の作業内容 section", async () => {
    render(<ClientViewerPage projectId="proj-1" />);
    await screen.findByText("南青山リノベーション");
    expect(screen.getByText("今日の作業内容")).toBeDefined();
  });
});
