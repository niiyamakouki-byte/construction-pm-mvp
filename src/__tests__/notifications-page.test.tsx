/**
 * NotificationsPage のテスト
 */
import { describe, expect, it, beforeEach, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NotificationsPage } from "../pages/NotificationsPage.js";
import type { Notification } from "../domain/types.js";

vi.stubGlobal("confirm", vi.fn(() => true));

let mockNotifications: Notification[] = [];
const mockFindAll = vi.fn(async () => [...mockNotifications]);
const mockUpdate = vi.fn(async () => {});
const mockDelete = vi.fn(async (id: string) => {
  mockNotifications = mockNotifications.filter((n) => n.id !== id);
});

vi.mock("../stores/notification-store.js", () => ({
  createNotificationRepository: () => ({
    findAll: mockFindAll,
    update: mockUpdate,
    delete: mockDelete,
  }),
}));

vi.mock("../contexts/OrganizationContext.js", () => ({
  useOrganizationContext: () => ({ organizationId: "test-org" }),
}));

function makeNotification(overrides: Partial<Notification> = {}): Notification {
  const now = new Date().toISOString();
  return {
    id: `n-${Date.now()}-${Math.random()}`,
    type: "reminder",
    message: "テスト通知",
    status: "pending",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe("NotificationsPage", () => {
  beforeEach(() => {
    cleanup();
    mockNotifications = [];
    mockFindAll.mockClear();
    mockUpdate.mockClear();
    mockDelete.mockClear();
    vi.mocked(confirm).mockReturnValue(true);
  });

  it("ページタイトル「通知一覧」が表示される", async () => {
    render(<NotificationsPage />);
    await waitFor(() => expect(screen.getByText("通知一覧")).toBeDefined());
  });

  it("空状態メッセージ「通知はありません」が表示される", async () => {
    render(<NotificationsPage />);
    await waitFor(() => expect(screen.getByText("通知はありません")).toBeDefined());
  });

  it("通知が存在する場合に一覧表示される", async () => {
    mockNotifications = [
      makeNotification({ id: "n-1", message: "工程が確定しました", status: "pending" }),
    ];
    render(<NotificationsPage />);
    await waitFor(() => expect(screen.getByText("工程が確定しました")).toBeDefined());
  });

  it("「送信済みに」ボタンクリックで update が呼ばれる", async () => {
    mockNotifications = [
      makeNotification({ id: "n-1", message: "リマインダー通知", status: "pending" }),
    ];
    const user = userEvent.setup();
    render(<NotificationsPage />);
    await waitFor(() => screen.getByText("リマインダー通知"));

    const sentButton = screen.getByRole("button", { name: "送信済みにする" });
    await user.click(sentButton);

    await waitFor(() => expect(mockUpdate).toHaveBeenCalledWith("n-1", expect.objectContaining({ status: "sent" })));
  });

  it("pending が複数ある場合に「全て送信済みに」ボタンが表示される", async () => {
    mockNotifications = [
      makeNotification({ id: "n-1", status: "pending" }),
      makeNotification({ id: "n-2", status: "pending" }),
    ];
    render(<NotificationsPage />);
    await waitFor(() => expect(screen.getByText("全て送信済みに")).toBeDefined());
  });

  it("「全て送信済みに」クリックで全 pending が update される", async () => {
    mockNotifications = [
      makeNotification({ id: "n-a", status: "pending" }),
      makeNotification({ id: "n-b", status: "pending" }),
    ];
    const user = userEvent.setup();
    render(<NotificationsPage />);
    await waitFor(() => screen.getByText("全て送信済みに"));

    await user.click(screen.getByText("全て送信済みに"));

    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalledTimes(2);
    });
  });

  it("削除ボタンクリックで delete が呼ばれる", async () => {
    mockNotifications = [
      makeNotification({ id: "n-del", message: "削除対象通知", status: "pending" }),
    ];
    const user = userEvent.setup();
    render(<NotificationsPage />);
    await waitFor(() => screen.getByText("削除対象通知"));

    const deleteButton = screen.getByRole("button", { name: "削除" });
    await user.click(deleteButton);

    await waitFor(() => expect(mockDelete).toHaveBeenCalledWith("n-del"));
  });
});
