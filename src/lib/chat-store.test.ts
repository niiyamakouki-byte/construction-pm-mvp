import { describe, it, expect, beforeEach } from "vitest";
import {
  sendMessage,
  getMessages,
  getUnreadCount,
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
});
