/**
 * snapshot-builder.test.ts
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildOwnerSnapshot } from "../snapshot-builder.js";
import { ownerStore } from "../owner-store.js";
import type { ChangeRequest, OwnerMessage } from "../types.js";
import { _resetChatStore, sendMessage } from "../../chat-store.js";

// jsdom では localStorage.clear が未実装のためモックする
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();
Object.defineProperty(globalThis, "localStorage", { value: localStorageMock, writable: true });

// Mock fetchProjectTasks
vi.mock("../../project-tasks-store.js", () => ({
  fetchProjectTasks: vi.fn().mockResolvedValue([]),
}));

// Mock payment-plan-store
vi.mock("../../../stores/payment-plan-store.js", () => ({
  paymentPlanRepository: {
    findAll: vi.fn().mockResolvedValue([]),
  },
}));

import { fetchProjectTasks } from "../../project-tasks-store.js";
import { paymentPlanRepository } from "../../../stores/payment-plan-store.js";

beforeEach(() => {
  localStorage.clear();
  ownerStore._reset();
  _resetChatStore();
  vi.clearAllMocks();
});

afterEach(() => {
  localStorage.clear();
});

function makeMockTasks(count: number, doneCount: number) {
  const today = new Date().toISOString().split("T")[0];
  return Array.from({ length: count }, (_, i) => ({
    id: `task-${i}`,
    projectId: "proj-snap",
    category: "内装工事",
    title: `タスク ${i}`,
    startDate: today,
    endDate: today,
    durationDays: 1,
    dependsOn: [],
    status: i < doneCount ? "done" : "in_progress",
    orderIndex: i,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }));
}

describe("buildOwnerSnapshot", () => {
  it("returns snapshot with correct projectId and name", async () => {
    vi.mocked(fetchProjectTasks).mockResolvedValue([]);
    const snap = await buildOwnerSnapshot("proj-snap", "テストプロジェクト");
    expect(snap.projectId).toBe("proj-snap");
    expect(snap.projectName).toBe("テストプロジェクト");
  });

  it("calculates 0% progress when no tasks", async () => {
    vi.mocked(fetchProjectTasks).mockResolvedValue([]);
    const snap = await buildOwnerSnapshot("p", "P");
    expect(snap.overallProgress).toBe(0);
  });

  it("calculates 50% progress for 2/4 done tasks", async () => {
    vi.mocked(fetchProjectTasks).mockResolvedValue(makeMockTasks(4, 2) as never);
    const snap = await buildOwnerSnapshot("p", "P");
    expect(snap.overallProgress).toBe(50);
  });

  it("calculates 100% progress when all tasks done", async () => {
    vi.mocked(fetchProjectTasks).mockResolvedValue(makeMockTasks(3, 3) as never);
    const snap = await buildOwnerSnapshot("p", "P");
    expect(snap.overallProgress).toBe(100);
  });

  it("includes pendingRequests from ownerStore", async () => {
    vi.mocked(fetchProjectTasks).mockResolvedValue([]);
    const req: ChangeRequest = {
      id: "r1",
      projectId: "p-req",
      title: "要望1",
      body: "",
      photo_urls: [],
      status: "pending",
      ts: new Date().toISOString(),
    };
    ownerStore.submitChangeRequest("p-req", req);
    const snap = await buildOwnerSnapshot("p-req", "P");
    expect(snap.pendingRequests).toHaveLength(1);
    expect(snap.pendingRequests[0].id).toBe("r1");
  });

  it("excludes non-pending requests from pendingRequests", async () => {
    vi.mocked(fetchProjectTasks).mockResolvedValue([]);
    const req: ChangeRequest = {
      id: "r-approved",
      projectId: "p-approved",
      title: "承認済",
      body: "",
      photo_urls: [],
      status: "approved",
      ts: new Date().toISOString(),
    };
    ownerStore.submitChangeRequest("p-approved", req);
    const snap = await buildOwnerSnapshot("p-approved", "P");
    expect(snap.pendingRequests).toHaveLength(0);
  });

  it("returns recentMessages from chat store (max 10)", async () => {
    vi.mocked(fetchProjectTasks).mockResolvedValue([]);
    for (let i = 0; i < 12; i++) {
      sendMessage("p-chat", `user-${i}`, `User ${i}`, `msg ${i}`);
    }
    const snap = await buildOwnerSnapshot("p-chat", "P");
    expect(snap.recentMessages.length).toBeLessThanOrEqual(10);
  });

  it("maps chat messages to OwnerMessage sender correctly", async () => {
    vi.mocked(fetchProjectTasks).mockResolvedValue([]);
    sendMessage("p-sender", "owner", "Owner User", "hello");
    sendMessage("p-sender", "pm-user", "PM", "reply");
    const snap = await buildOwnerSnapshot("p-sender", "P");
    expect(snap.recentMessages[0].sender).toBe("owner");
    expect(snap.recentMessages[1].sender).toBe("pm");
  });

  it("caps todaysPhotos to 6", async () => {
    vi.mocked(fetchProjectTasks).mockResolvedValue([]);
    const photos = Array.from({ length: 10 }, (_, i) => `http://img/${i}.jpg`);
    const snap = await buildOwnerSnapshot("p", "P", photos);
    expect(snap.todaysPhotos).toHaveLength(6);
  });

  it("accepts empty todaysPhotos", async () => {
    vi.mocked(fetchProjectTasks).mockResolvedValue([]);
    const snap = await buildOwnerSnapshot("p", "P", []);
    expect(snap.todaysPhotos).toEqual([]);
  });

  it("sets currentPhase from today's in-progress task category", async () => {
    const today = new Date().toISOString().split("T")[0];
    vi.mocked(fetchProjectTasks).mockResolvedValue([
      {
        id: "t1",
        projectId: "p",
        category: "タイル工事",
        title: "T1",
        startDate: today,
        endDate: today,
        durationDays: 1,
        dependsOn: [],
        status: "in_progress",
        orderIndex: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ] as never);
    const snap = await buildOwnerSnapshot("p", "P");
    expect(snap.currentPhase).toBe("タイル工事");
  });

  it("falls back to '施工中' when no tasks match today", async () => {
    vi.mocked(fetchProjectTasks).mockResolvedValue([]);
    const snap = await buildOwnerSnapshot("p-empty", "P");
    expect(snap.currentPhase).toBe("施工中");
  });

  it("includes paymentMilestones filtered by projectId, sorted by scheduledDate", async () => {
    vi.mocked(fetchProjectTasks).mockResolvedValue([]);
    vi.mocked(paymentPlanRepository.findAll).mockResolvedValue([
      {
        id: "pp-2",
        projectId: "p-pay",
        milestoneLabel: "中間金",
        scheduledDate: "2026-08-01",
        scheduledAmount: 500000,
        status: "planned",
        createdAt: "",
        updatedAt: "",
      },
      {
        id: "pp-1",
        projectId: "p-pay",
        milestoneLabel: "着手金",
        scheduledDate: "2026-06-01",
        scheduledAmount: 300000,
        status: "paid",
        actualPaidDate: "2026-06-03",
        createdAt: "",
        updatedAt: "",
      },
      {
        id: "pp-cancelled",
        projectId: "p-pay",
        milestoneLabel: "キャンセル分",
        scheduledDate: "2026-07-01",
        scheduledAmount: 100000,
        status: "cancelled",
        createdAt: "",
        updatedAt: "",
      },
      {
        id: "pp-other",
        projectId: "p-other",
        milestoneLabel: "他案件",
        scheduledDate: "2026-06-15",
        scheduledAmount: 200000,
        status: "planned",
        createdAt: "",
        updatedAt: "",
      },
    ] as never);
    const snap = await buildOwnerSnapshot("p-pay", "P");
    expect(snap.paymentMilestones).toHaveLength(2);
    expect(snap.paymentMilestones[0].id).toBe("pp-1");
    expect(snap.paymentMilestones[1].id).toBe("pp-2");
  });

  it("returns empty paymentMilestones when repository throws", async () => {
    vi.mocked(fetchProjectTasks).mockResolvedValue([]);
    vi.mocked(paymentPlanRepository.findAll).mockRejectedValueOnce(new Error("supabase offline"));
    const snap = await buildOwnerSnapshot("p-err", "P");
    expect(snap.paymentMilestones).toEqual([]);
  });
});
