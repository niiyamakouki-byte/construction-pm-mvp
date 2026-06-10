import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CostItem, Expense, Project, Task } from "../domain/types.js";
import {
  buildNotifications,
  clearPaymentConfirmedNotifications,
  getPaymentConfirmedNotifications,
  isStaleOverdue,
  pushPaymentConfirmedNotification,
  STALE_OVERDUE_DAYS,
} from "../lib/notifications.js";

// jsdom の --localstorage-file 問題を回避するため手動スタブ
const localStorageData: Record<string, string> = {};
const localStorageMock = {
  getItem: vi.fn((key: string) => localStorageData[key] ?? null),
  setItem: vi.fn((key: string, value: string) => { localStorageData[key] = value; }),
  removeItem: vi.fn((key: string) => { delete localStorageData[key]; }),
  clear: vi.fn(() => { for (const k of Object.keys(localStorageData)) delete localStorageData[k]; }),
};

beforeEach(() => {
  vi.stubGlobal("localStorage", localStorageMock);
  localStorageMock.clear();
});

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: "p-1",
    name: "渋谷駅前新築",
    description: "",
    status: "active",
    startDate: "2025-01-01",
    includeWeekends: true,
    budget: 100000,
    createdAt: "2025-01-01T00:00:00.000Z",
    updatedAt: "2025-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: "t-1",
    projectId: "p-1",
    name: "足場組立",
    description: "",
    status: "todo",
    progress: 0,
    dependencies: [],
    createdAt: "2025-01-01T00:00:00.000Z",
    updatedAt: "2025-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function makeCostItem(overrides: Partial<CostItem> = {}): CostItem {
  return {
    id: "c-1",
    projectId: "p-1",
    description: "鉄骨手配",
    amount: 120000,
    category: "材料費",
    paymentStatus: "paid",
    createdAt: "2025-01-01T00:00:00.000Z",
    updatedAt: "2025-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("buildNotifications", () => {
  it("builds overdue, budget overrun, and upcoming deadline notifications in priority order", () => {
    const notifications = buildNotifications({
      projects: [makeProject()],
      tasks: [
        makeTask({ id: "t-overdue", name: "外壁塗装", dueDate: "2025-01-09" }),
        makeTask({ id: "t-upcoming", name: "資材搬入", dueDate: "2025-01-12" }),
      ],
      costItems: [makeCostItem()],
      expenses: [] satisfies Expense[],
      today: "2025-01-10",
    });

    expect(notifications.map((item) => item.type)).toEqual([
      "overdue_task",
      "cost_overrun",
      "upcoming_deadline",
    ]);
    expect(notifications[0].message).toContain("外壁塗装");
    expect(notifications[1].message).toContain("予算超過");
    expect(notifications[2].message).toContain("2025-01-12");
  });

  it("ignores cost-like tasks from deadline notifications", () => {
    const notifications = buildNotifications({
      projects: [makeProject()],
      tasks: [
        makeTask({
          id: "t-cost",
          name: "Grow 広告運用",
          description: "外注費 50000円",
          dueDate: "2025-01-11",
        }),
      ],
      today: "2025-01-10",
    });

    expect(notifications).toEqual([]);
  });

  it("builds procurement alerts for tasks approaching their lead time window", () => {
    const notifications = buildNotifications({
      projects: [makeProject()],
      tasks: [
        makeTask({
          id: "t-procurement",
          name: "受変電設備搬入",
          startDate: "2025-01-14",
          lead_time: 2,
        }),
      ],
      today: "2025-01-10",
    });

    expect(notifications).toHaveLength(1);
    expect(notifications[0].type).toBe("procurement_alert");
    expect(notifications[0].tone).toBe("orange");
    expect(notifications[0].message).toContain("リードタイム 2日");
    expect(notifications[0].path).toBe("/gantt/p-1");
  });

  it("annotates overdue notifications with daysOverdue", () => {
    const notifications = buildNotifications({
      projects: [makeProject({ budget: 0 })],
      tasks: [
        makeTask({ id: "t-fresh", name: "壁紙貼り", dueDate: "2025-01-05" }),
        makeTask({ id: "t-stale", name: "巾木補修", dueDate: "2024-11-01" }),
      ],
      today: "2025-01-10",
    });

    const fresh = notifications.find((item) => item.taskId === "t-fresh");
    const stale = notifications.find((item) => item.taskId === "t-stale");
    expect(fresh?.daysOverdue).toBe(5);
    expect(stale?.daysOverdue).toBeGreaterThanOrEqual(STALE_OVERDUE_DAYS);
    expect(isStaleOverdue(fresh!)).toBe(false);
    expect(isStaleOverdue(stale!)).toBe(true);
  });

  it("keeps stale overdue notifications in the result set (no filtering)", () => {
    // 古い超過もデータとしては残し、UI側でサブグループに収納する
    const notifications = buildNotifications({
      projects: [makeProject({ budget: 0 })],
      tasks: [
        makeTask({ id: "t-very-old", name: "古い超過", dueDate: "2024-01-01" }),
      ],
      today: "2025-01-10",
    });
    expect(notifications).toHaveLength(1);
    expect(notifications[0].type).toBe("overdue_task");
    expect(isStaleOverdue(notifications[0])).toBe(true);
  });
});

describe("pushPaymentConfirmedNotification", () => {
  afterEach(() => {
    clearPaymentConfirmedNotifications();
  });

  it("確定後に getPaymentConfirmedNotifications で通知が1件返る", () => {
    pushPaymentConfirmedNotification({
      invoiceId: "inv-1",
      invoiceNumber: "inv-1",
      vendorName: "山田建設",
      amount: 330_000,
      confirmedAt: "2026-06-10",
    });

    const notifs = getPaymentConfirmedNotifications();
    expect(notifs).toHaveLength(1);
    expect(notifs[0].type).toBe("payment_confirmed");
    expect(notifs[0].tone).toBe("blue");
    expect(notifs[0].message).toContain("山田建設");
    expect(notifs[0].message).toContain("330,000");
    expect(notifs[0].path).toBe("/invoices/reconcile");
  });

  it("同じ invoiceId を2回 push しても重複しない（冪等）", () => {
    pushPaymentConfirmedNotification({
      invoiceId: "inv-2",
      invoiceNumber: "inv-2",
      vendorName: "鈴木工務店",
      amount: 110_000,
      confirmedAt: "2026-06-10",
    });
    pushPaymentConfirmedNotification({
      invoiceId: "inv-2",
      invoiceNumber: "inv-2",
      vendorName: "鈴木工務店",
      amount: 110_000,
      confirmedAt: "2026-06-10",
    });

    const notifs = getPaymentConfirmedNotifications();
    expect(notifs).toHaveLength(1);
  });

  it("失敗パス: 確定処理が呼ばれなければ通知は作られない", () => {
    // pushPaymentConfirmedNotification を呼ばなければキューは空のまま
    const notifs = getPaymentConfirmedNotifications();
    expect(notifs).toHaveLength(0);
  });
});
