import { describe, it, expect, beforeEach } from "vitest";
import { NotificationManager } from "./notification-system.js";

describe("NotificationManager", () => {
  let mgr: NotificationManager;
  beforeEach(() => {
    mgr = new NotificationManager();
    mgr.clear();
  });

  it("sends a notification", () => {
    const n = mgr.send("user1", "Hello", "normal");
    expect(n.userId).toBe("user1");
    expect(n.read).toBe(false);
  });

  it("gets unread notifications", () => {
    mgr.send("user1", "A");
    mgr.send("user1", "B");
    expect(mgr.getUnread("user1")).toHaveLength(2);
  });

  it("marks as read", () => {
    const n = mgr.send("user1", "Read me");
    expect(mgr.markAsRead(n.id)).toBe(true);
    expect(mgr.getUnread("user1")).toHaveLength(0);
  });

  it("markAsRead returns false for unknown id", () => {
    expect(mgr.markAsRead("nope")).toBe(false);
  });

  it("gets all notifications", () => {
    mgr.send("user1", "A");
    const n = mgr.send("user1", "B");
    mgr.markAsRead(n.id);
    expect(mgr.getAll("user1")).toHaveLength(2);
  });

  it("marks all as read", () => {
    mgr.send("u1", "A");
    mgr.send("u1", "B");
    const count = mgr.markAllAsRead("u1");
    expect(count).toBe(2);
    expect(mgr.getUnread("u1")).toHaveLength(0);
  });

  it("handles different priorities", () => {
    const n = mgr.send("u1", "Urgent!", "urgent", "alert");
    expect(n.priority).toBe("urgent");
    expect(n.type).toBe("alert");
  });
});
