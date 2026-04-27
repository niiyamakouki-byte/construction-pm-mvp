/**
 * ラポルタ秘書チャット API テスト
 *
 * (1) chat send POST のロジックテスト
 * (2) chat poll のフィルタリングロジックテスト
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── テスト用型定義 ─────────────────────────────────────────────
type MockRequest = {
  method: string;
  headers: Record<string, string>;
  body?: unknown;
  query?: Record<string, string>;
};

type MockResponse = {
  statusCode: number;
  body: unknown;
  status: (code: number) => MockResponse;
  json: (body: unknown) => void;
  setHeader: (name: string, value: string) => void;
};

function makeMockRes(): MockResponse {
  const res: MockResponse = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
    },
    setHeader() {},
  };
  return res;
}

// ── Discord API モック用ヘルパー ─────────────────────────────────
type DiscordMessage = {
  id: string;
  content: string;
  timestamp: string;
  author: { id: string; bot?: boolean };
  message_reference?: { message_id: string };
};

function filterBotReplies(
  messages: DiscordMessage[],
  userId: string,
  botId: string,
): Array<{ id: string; content: string; timestamp: string }> {
  const prefix = `[GenbaHub:${userId}]`;

  const userMessageIds = new Set<string>();
  for (const msg of messages) {
    if (msg.content.startsWith(prefix)) {
      userMessageIds.add(msg.id);
    }
  }

  const botReplies = messages
    .filter(
      (msg) =>
        msg.author.id === botId &&
        msg.author.bot &&
        msg.message_reference &&
        userMessageIds.has(msg.message_reference.message_id),
    )
    .map((msg) => ({
      id: msg.id,
      content: msg.content,
      timestamp: msg.timestamp,
    }));

  botReplies.sort((a, b) => a.id.localeCompare(b.id));
  return botReplies;
}

// ── (1) chat send POST テスト ────────────────────────────────────
describe("chat send - content format", () => {
  it("[GenbaHub:userId] プレフィックスを付けてメッセージを構築する", () => {
    const userId = "test-user-123";
    const text = "現場の写真を確認してください";
    const content = `[GenbaHub:${userId}] ${text}`;
    expect(content).toBe("[GenbaHub:test-user-123] 現場の写真を確認してください");
  });

  it("1800文字超のテキストは末尾を切り詰める", () => {
    const longText = "あ".repeat(1900);
    const truncated = longText.length > 1800 ? longText.slice(0, 1800) + "..." : longText;
    expect(truncated.length).toBe(1803);
    expect(truncated.endsWith("...")).toBe(true);
  });

  it("1800文字以内のテキストはそのまま使用する", () => {
    const text = "短いメッセージ";
    const result = text.length > 1800 ? text.slice(0, 1800) + "..." : text;
    expect(result).toBe("短いメッセージ");
  });

  it("userId と text が空の場合は invalid として扱う", () => {
    const userId = "  ";
    const text = "";
    expect(userId.trim()).toBe("");
    expect(text.trim()).toBe("");
    const isInvalid = !userId.trim() || !text.trim();
    expect(isInvalid).toBe(true);
  });

  it("OPTIONS リクエストは 204 を返す", () => {
    const req: MockRequest = { method: "OPTIONS", headers: {} };
    const res = makeMockRes();

    if (req.method === "OPTIONS") {
      res.status(204).json({});
    }

    expect(res.statusCode).toBe(204);
  });

  it("POST 以外のメソッドは 405 を返す", () => {
    const req: MockRequest = { method: "GET", headers: {} };
    const res = makeMockRes();

    if (req.method !== "POST" && req.method !== "OPTIONS") {
      res.status(405).json({ error: "Method not allowed" });
    }

    expect(res.statusCode).toBe(405);
  });
});

// ── (2) chat poll フィルタリングテスト ──────────────────────────
describe("chat poll - bot reply filtering", () => {
  const BOT_ID = "1488015940565209148";
  const userId = "demo-user";

  it("userId 宛てのユーザーメッセージへの bot 返信のみを返す", () => {
    const messages: DiscordMessage[] = [
      {
        id: "1001",
        content: `[GenbaHub:${userId}] 質問です`,
        timestamp: "2026-04-27T10:00:00.000Z",
        author: { id: "user-123" },
      },
      {
        id: "1002",
        content: "はい、お答えします",
        timestamp: "2026-04-27T10:01:00.000Z",
        author: { id: BOT_ID, bot: true },
        message_reference: { message_id: "1001" },
      },
    ];

    const replies = filterBotReplies(messages, userId, BOT_ID);
    expect(replies).toHaveLength(1);
    expect(replies[0].id).toBe("1002");
    expect(replies[0].content).toBe("はい、お答えします");
  });

  it("別の userId のメッセージへの bot 返信は含めない", () => {
    const messages: DiscordMessage[] = [
      {
        id: "2001",
        content: "[GenbaHub:other-user] 別のユーザーの質問",
        timestamp: "2026-04-27T10:00:00.000Z",
        author: { id: "other-user-id" },
      },
      {
        id: "2002",
        content: "別ユーザーへの返信",
        timestamp: "2026-04-27T10:01:00.000Z",
        author: { id: BOT_ID, bot: true },
        message_reference: { message_id: "2001" },
      },
    ];

    const replies = filterBotReplies(messages, userId, BOT_ID);
    expect(replies).toHaveLength(0);
  });

  it("bot でない author のメッセージは含めない", () => {
    const messages: DiscordMessage[] = [
      {
        id: "3001",
        content: `[GenbaHub:${userId}] 質問`,
        timestamp: "2026-04-27T10:00:00.000Z",
        author: { id: "user-123" },
      },
      {
        id: "3002",
        content: "人間からの返信",
        timestamp: "2026-04-27T10:01:00.000Z",
        author: { id: "human-user", bot: false },
        message_reference: { message_id: "3001" },
      },
    ];

    const replies = filterBotReplies(messages, userId, BOT_ID);
    expect(replies).toHaveLength(0);
  });

  it("message_reference を持たない bot メッセージは含めない", () => {
    const messages: DiscordMessage[] = [
      {
        id: "4001",
        content: "bot の独り言",
        timestamp: "2026-04-27T10:00:00.000Z",
        author: { id: BOT_ID, bot: true },
      },
    ];

    const replies = filterBotReplies(messages, userId, BOT_ID);
    expect(replies).toHaveLength(0);
  });

  it("複数の返信を id の昇順で並び替えて返す", () => {
    const messages: DiscordMessage[] = [
      {
        id: "5001",
        content: `[GenbaHub:${userId}] 質問1`,
        timestamp: "2026-04-27T10:00:00.000Z",
        author: { id: "user-123" },
      },
      {
        id: "5002",
        content: `[GenbaHub:${userId}] 質問2`,
        timestamp: "2026-04-27T10:01:00.000Z",
        author: { id: "user-123" },
      },
      // Discord は新しい順で返すので id 降順
      {
        id: "5004",
        content: "回答2",
        timestamp: "2026-04-27T10:03:00.000Z",
        author: { id: BOT_ID, bot: true },
        message_reference: { message_id: "5002" },
      },
      {
        id: "5003",
        content: "回答1",
        timestamp: "2026-04-27T10:02:00.000Z",
        author: { id: BOT_ID, bot: true },
        message_reference: { message_id: "5001" },
      },
    ];

    const replies = filterBotReplies(messages, userId, BOT_ID);
    expect(replies).toHaveLength(2);
    expect(replies[0].id).toBe("5003");
    expect(replies[1].id).toBe("5004");
  });
});
