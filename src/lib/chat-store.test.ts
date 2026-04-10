import { describe, it, expect, beforeEach } from "vitest";
import {
  sendMessage,
  getMessages,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  _resetChatStore,
} from "./chat-store.js";

describe("chat-store", () => {
  beforeEach(() => {
    _resetChatStore();
  });

  describe("sendMessage", () => {
    it("returns a ChatMessage with correct fields", () => {
      const msg = sendMessage("proj-1", "user-1", "新山", "こんにちは");
      expect(msg.projectId).toBe("proj-1");
      expect(msg.userId).toBe("user-1");
      expect(msg.userName).toBe("新山");
      expect(msg.content).toBe("こんにちは");
      expect(msg.id).toMatch(/^chat-/);
      expect(typeof msg.timestamp).toBe("string");
    });

    it("assigns unique IDs to each message", () => {
      const a = sendMessage("proj-1", "u1", "A", "hello");
      const b = sendMessage("proj-1", "u1", "A", "world");
      expect(a.id).not.toBe(b.id);
    });

    it("stores attachments when provided", () => {
      const msg = sendMessage("proj-1", "u1", "A", "see file", ["図面.pdf"]);
      expect(msg.attachments).toEqual(["図面.pdf"]);
    });

    it("omits attachments field when none provided", () => {
      const msg = sendMessage("proj-1", "u1", "A", "no attach");
      expect(msg.attachments).toBeUndefined();
    });

    it("defaults type to 'text' when not specified", () => {
      const msg = sendMessage("proj-1", "u1", "A", "hello");
      expect(msg.type).toBe("text");
    });

    it("stores specified message type", () => {
      const msg = sendMessage("proj-1", "u1", "A", "質問です", undefined, "inquiry");
      expect(msg.type).toBe("inquiry");
    });

    it("initialises readBy as empty array", () => {
      const msg = sendMessage("proj-1", "u1", "A", "hello");
      expect(msg.readBy).toEqual([]);
    });
  });

  describe("getMessages", () => {
    it("returns empty array for unknown project", () => {
      expect(getMessages("no-such-project")).toEqual([]);
    });

    it("returns all messages in order", () => {
      sendMessage("p1", "u1", "A", "first");
      sendMessage("p1", "u1", "A", "second");
      const msgs = getMessages("p1");
      expect(msgs).toHaveLength(2);
      expect(msgs[0].content).toBe("first");
      expect(msgs[1].content).toBe("second");
    });

    it("returns only messages for the given project", () => {
      sendMessage("proj-a", "u1", "A", "for A");
      sendMessage("proj-b", "u1", "B", "for B");
      expect(getMessages("proj-a")).toHaveLength(1);
      expect(getMessages("proj-b")).toHaveLength(1);
    });

    it("respects limit — returns last N messages", () => {
      for (let i = 0; i < 5; i++) {
        sendMessage("p1", "u1", "A", `msg ${i}`);
      }
      const msgs = getMessages("p1", 3);
      expect(msgs).toHaveLength(3);
      expect(msgs[0].content).toBe("msg 2");
      expect(msgs[2].content).toBe("msg 4");
    });

    it("respects before filter", () => {
      const m1 = sendMessage("p1", "u1", "A", "old");
      const m2 = sendMessage("p1", "u1", "A", "new");
      const msgs = getMessages("p1", undefined, m2.timestamp);
      // only messages strictly before m2.timestamp
      // m1 has same or earlier timestamp
      expect(msgs.every((m) => m.timestamp < m2.timestamp || m.id === m1.id)).toBe(true);
    });
  });

  describe("getUnreadCount", () => {
    it("returns 0 for unknown project", () => {
      expect(getUnreadCount("no-project", new Date().toISOString())).toBe(0);
    });

    it("counts messages newer than lastRead", () => {
      const beforeAll = new Date(Date.now() - 1000).toISOString();
      sendMessage("p1", "u1", "A", "msg 1");
      sendMessage("p1", "u1", "A", "msg 2");
      expect(getUnreadCount("p1", beforeAll)).toBe(2);
    });

    it("excludes messages at or before lastRead timestamp", () => {
      const m1 = sendMessage("p1", "u1", "A", "read");
      sendMessage("p1", "u1", "A", "unread");
      // anything after m1.timestamp is unread
      const count = getUnreadCount("p1", m1.timestamp);
      expect(count).toBeLessThanOrEqual(1);
    });

    it("returns 0 when all messages are read", () => {
      sendMessage("p1", "u1", "A", "msg");
      const after = new Date(Date.now() + 1000).toISOString();
      expect(getUnreadCount("p1", after)).toBe(0);
    });
  });

  describe("markAsRead", () => {
    it("adds userId to readBy", () => {
      const msg = sendMessage("p1", "u1", "A", "hello");
      markAsRead("p1", msg.id, "u2");
      const msgs = getMessages("p1");
      expect(msgs[0].readBy).toContain("u2");
    });

    it("is idempotent — second call does not duplicate", () => {
      const msg = sendMessage("p1", "u1", "A", "hello");
      markAsRead("p1", msg.id, "u2");
      markAsRead("p1", msg.id, "u2");
      const msgs = getMessages("p1");
      expect(msgs[0].readBy?.filter((id) => id === "u2")).toHaveLength(1);
    });

    it("is a no-op for unknown project", () => {
      expect(() => markAsRead("no-proj", "msg-1", "u1")).not.toThrow();
    });

    it("is a no-op for unknown message", () => {
      expect(() => markAsRead("p1", "no-msg", "u1")).not.toThrow();
    });
  });

  describe("markAllAsRead", () => {
    it("marks all messages as read by userId", () => {
      sendMessage("p1", "u1", "A", "msg 1");
      sendMessage("p1", "u1", "A", "msg 2");
      markAllAsRead("p1", "u2");
      const msgs = getMessages("p1");
      expect(msgs.every((m) => m.readBy?.includes("u2"))).toBe(true);
    });

    it("respects beforeTimestamp — excludes messages after cutoff", () => {
      const future = new Date(Date.now() + 60_000).toISOString();
      sendMessage("p1", "u1", "A", "present");
      markAllAsRead("p1", "u2", future);
      const msgs = getMessages("p1");
      // The message was sent before the future cutoff, so it should be marked
      expect(msgs[0].readBy).toContain("u2");

      // A message with a timestamp after the cutoff should NOT be marked
      const pastCutoff = new Date(Date.now() - 60_000).toISOString();
      sendMessage("p1", "u1", "A", "future message");
      // markAllAsRead with a cutoff in the past — newly added message is after cutoff
      markAllAsRead("p1", "u3", pastCutoff);
      const msgsAfter = getMessages("p1");
      const newerMsg = msgsAfter[msgsAfter.length - 1];
      expect(newerMsg.readBy).not.toContain("u3");
    });

    it("is a no-op for unknown project", () => {
      expect(() => markAllAsRead("no-proj", "u1")).not.toThrow();
    });
  });
});
