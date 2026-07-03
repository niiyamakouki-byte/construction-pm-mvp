import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SiteEntryPage, filterTasksByJobType } from "./SiteEntryPage.js";
import type { Task } from "../lib/supabase-adapter/TaskRepository.js";

// ── Mocks ──────────────────────────────────────────────────────────────────────

const {
  mockListByProject,
  mockSaveEntry,
  mockListTasks,
  mockSavePhoto,
  mockNavigate,
} = vi.hoisted(() => ({
  mockListByProject: vi.fn(),
  mockSaveEntry: vi.fn(),
  mockListTasks: vi.fn(),
  mockSavePhoto: vi.fn(),
  mockNavigate: vi.fn(),
}));

vi.mock("../lib/supabase-adapter/SiteEntryRepository.js", () => ({
  SiteEntryRepository: vi.fn().mockImplementation(() => ({
    listByProjectAsync: mockListByProject,
    saveAsync: mockSaveEntry,
  })),
}));

vi.mock("../lib/supabase-adapter/TaskRepository.js", () => ({
  TaskRepository: vi.fn().mockImplementation(() => ({
    listByProjectAsync: mockListTasks,
  })),
}));

vi.mock("../lib/supabase-adapter/PhotoRepository.js", () => ({
  PhotoRepository: vi.fn().mockImplementation(() => ({
    saveAsync: mockSavePhoto,
  })),
}));

vi.mock("../hooks/useHashRouter.js", () => ({
  navigate: mockNavigate,
}));

// ── Helpers ──────────────────────────────────────────────────────────────────

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

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: "task-1",
    projectId: "proj-1",
    name: "電気配線工事",
    description: "電気工事",
    status: "todo",
    progress: 0,
    isMilestone: false,
    createdAt: "2026-07-04T00:00:00.000Z",
    updatedAt: "2026-07-04T00:00:00.000Z",
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("localStorage", createMockLocalStorage());
  vi.stubGlobal("crypto", { randomUUID: () => "test-uuid" });
  mockListByProject.mockResolvedValue([]);
  mockListTasks.mockResolvedValue([]);
  mockSaveEntry.mockResolvedValue(undefined);
  mockSavePhoto.mockResolvedValue(undefined);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

// ── Unit: filterTasksByJobType ──────────────────────────────────────────────

describe("filterTasksByJobType", () => {
  it("電気 filters tasks matching 電気 pattern", () => {
    const tasks = [
      makeTask({ id: "t1", name: "電気配線工事", description: "" }),
      makeTask({ id: "t2", name: "木工造作", description: "" }),
      makeTask({ id: "t3", name: "外壁塗装", description: "" }),
    ];
    const result = filterTasksByJobType(tasks, "電気");
    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe("t1");
  });

  it("その他 returns all tasks", () => {
    const tasks = [makeTask({ id: "t1" }), makeTask({ id: "t2" })];
    const result = filterTasksByJobType(tasks, "その他");
    expect(result).toHaveLength(2);
  });

  it("大工 matches 造作 in name", () => {
    const tasks = [makeTask({ id: "t1", name: "造作工事", description: "" })];
    const result = filterTasksByJobType(tasks, "大工");
    expect(result).toHaveLength(1);
  });

  it("returns empty when no tasks match", () => {
    const tasks = [makeTask({ id: "t1", name: "外壁防水工事", description: "" })];
    const result = filterTasksByJobType(tasks, "電気");
    expect(result).toHaveLength(0);
  });
});

// ── Component: SiteEntryPage ──────────────────────────────────────────────

describe("SiteEntryPage", () => {
  it("renders GenbaHub back link", async () => {
    render(<SiteEntryPage projectId="proj-1" />);
    await waitFor(() => expect(mockListByProject).toHaveBeenCalled());
    expect(screen.getByText("← GenbaHub")).toBeTruthy();
  });

  it("IN button is disabled when no worker is selected", async () => {
    render(<SiteEntryPage projectId="proj-1" />);
    await waitFor(() => expect(mockListByProject).toHaveBeenCalled());
    const inBtn = screen.getByRole("button", { name: "IN" });
    expect((inBtn as HTMLButtonElement).disabled).toBe(true);
  });

  it("selecting a worker enables IN button", async () => {
    const ls = createMockLocalStorage();
    ls.setItem(
      "genbahub_kiosk_recent_workers",
      JSON.stringify([
        { workerName: "田中一郎", company: "ABC建設", jobType: "大工", lastSeen: "" },
      ]),
    );
    vi.stubGlobal("localStorage", ls);

    render(<SiteEntryPage projectId="proj-1" />);
    await waitFor(() => expect(mockListByProject).toHaveBeenCalled());

    fireEvent.click(screen.getByText("田中一郎"));
    const inBtn = screen.getByRole("button", { name: "IN" });
    expect((inBtn as HTMLButtonElement).disabled).toBe(false);
  });

  it("clicking IN opens start-photo modal", async () => {
    const ls = createMockLocalStorage();
    ls.setItem(
      "genbahub_kiosk_recent_workers",
      JSON.stringify([
        { workerName: "田中一郎", company: "ABC建設", jobType: "大工", lastSeen: "" },
      ]),
    );
    vi.stubGlobal("localStorage", ls);

    render(<SiteEntryPage projectId="proj-1" />);
    await waitFor(() => expect(mockListByProject).toHaveBeenCalled());

    fireEvent.click(screen.getByText("田中一郎"));
    fireEvent.click(screen.getByRole("button", { name: "IN" }));

    expect(screen.getByText("開始写真を撮影")).toBeTruthy();
  });

  it("入場 button in start-photo modal is disabled without a photo", async () => {
    const ls = createMockLocalStorage();
    ls.setItem(
      "genbahub_kiosk_recent_workers",
      JSON.stringify([
        { workerName: "田中一郎", company: "ABC建設", jobType: "大工", lastSeen: "" },
      ]),
    );
    vi.stubGlobal("localStorage", ls);

    render(<SiteEntryPage projectId="proj-1" />);
    await waitFor(() => expect(mockListByProject).toHaveBeenCalled());

    fireEvent.click(screen.getByText("田中一郎"));
    fireEvent.click(screen.getByRole("button", { name: "IN" }));

    const enterBtn = screen.getByRole("button", { name: "入場" });
    expect((enterBtn as HTMLButtonElement).disabled).toBe(true);
  });

  it("入場記録の保存失敗時はエラーを表示してモーダルに留まる", async () => {
    mockSaveEntry.mockRejectedValueOnce(new Error("RLS denied"));
    const ls = createMockLocalStorage();
    ls.setItem(
      "genbahub_kiosk_recent_workers",
      JSON.stringify([
        { workerName: "田中一郎", company: "ABC建設", jobType: "大工", lastSeen: "" },
      ]),
    );
    vi.stubGlobal("localStorage", ls);

    render(<SiteEntryPage projectId="proj-1" />);
    await waitFor(() => expect(mockListByProject).toHaveBeenCalled());

    fireEvent.click(screen.getByText("田中一郎"));
    fireEvent.click(screen.getByRole("button", { name: "IN" }));

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["x"], "start.jpg", { type: "image/jpeg" });
    fireEvent.change(fileInput, { target: { files: [file] } });

    fireEvent.click(screen.getByRole("button", { name: "入場" }));

    await waitFor(() =>
      expect(screen.getByText(/入場記録の保存に失敗しました/)).toBeTruthy(),
    );
    expect(screen.getByText("開始写真を撮影")).toBeTruthy();
  });

  it("業種フィルタ: 入場中の業種に対応するタスクだけ表示される", async () => {
    mockListTasks.mockResolvedValue([
      makeTask({ id: "t1", name: "電気配線工事", description: "" }),
      makeTask({ id: "t2", name: "木工造作工事", description: "" }),
    ]);
    // Active entry record for 電気 job type (no exitTime = currently in)
    mockListByProject.mockResolvedValue([
      {
        id: "entry-1",
        projectId: "proj-1",
        workerName: "山田",
        company: "A社",
        entryTime: new Date().toISOString(),
        jobType: "電気",
      },
    ]);

    render(<SiteEntryPage projectId="proj-1" />);

    await waitFor(() => {
      expect(screen.queryByText("電気配線工事")).toBeTruthy();
    });
    // 大工 task should not appear for 電気 worker
    expect(screen.queryByText("木工造作工事")).toBeNull();
  });
});
