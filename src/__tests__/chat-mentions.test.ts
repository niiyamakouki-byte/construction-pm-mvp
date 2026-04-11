import { describe, it, expect, beforeEach } from "vitest";
import {
  extractMentions,
  sendMessage,
  getMentionsForUser,
  _resetChatStore,
} from "../lib/chat-store.js";

describe("chat-mentions", () => {
  beforeEach(() => {
    _resetChatStore();
  });

  describe("extractMentions", () => {
    it("extracts a single mention", () => {
      expect(extractMentions("@新山 確認お願いします")).toEqual(["新山"]);
    });

    it("extracts multiple mentions", () => {
      expect(extractMentions("@新山 と @鈴木 に連絡")).toEqual(["新山", "鈴木"]);
    });

    it("deduplicates repeated mentions", () => {
      expect(extractMentions("@新山 と @新山 どう？")).toEqual(["新山"]);
    });

    it("returns empty array when no mentions", () => {
      expect(extractMentions("メンションなしのテキスト")).toEqual([]);
    });

    it("ignores email-like patterns correctly — treats as mention", () => {
      // @foo in any context is captured; caller decides semantics
      const result = extractMentions("send to @user123");
      expect(result).toEqual(["user123"]);
    });

    it("handles mention at end of sentence", () => {
      expect(extractMentions("よろしく @鈴木")).toEqual(["鈴木"]);
    });
  });

  describe("sendMessage — auto mentions", () => {
    it("sets mentions when content has @username", () => {
      const msg = sendMessage("p1", "u1", "新山", "@鈴木 確認して");
      expect(msg.mentions).toEqual(["鈴木"]);
    });

    it("omits mentions field when no @username in content", () => {
      const msg = sendMessage("p1", "u1", "新山", "メンションなし");
      expect(msg.mentions).toBeUndefined();
    });

    it("sets multiple mentions from content", () => {
      const msg = sendMessage("p1", "u1", "新山", "@鈴木 と @我妻 に確認");
      expect(msg.mentions).toEqual(["鈴木", "我妻"]);
    });
  });

  describe("getMentionsForUser", () => {
    it("returns messages that mention the given userId", () => {
      sendMessage("p1", "u1", "新山", "@鈴木 これ確認して");
      sendMessage("p1", "u1", "新山", "関係ないメッセージ");
      const result = getMentionsForUser("p1", "鈴木");
      expect(result).toHaveLength(1);
      expect(result[0].content).toBe("@鈴木 これ確認して");
    });

    it("returns empty array for unknown project", () => {
      expect(getMentionsForUser("no-such-project", "鈴木")).toEqual([]);
    });

    it("returns empty array when user has no mentions", () => {
      sendMessage("p1", "u1", "新山", "@我妻 確認");
      expect(getMentionsForUser("p1", "鈴木")).toEqual([]);
    });

    it("returns all messages that mention the user across different senders", () => {
      sendMessage("p1", "u1", "新山", "@鈴木 件名A");
      sendMessage("p1", "u2", "我妻", "@鈴木 件名B");
      sendMessage("p1", "u3", "田中", "関係なし");
      const result = getMentionsForUser("p1", "鈴木");
      expect(result).toHaveLength(2);
    });
  });
});
