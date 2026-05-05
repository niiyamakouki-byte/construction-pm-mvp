/**
 * Vercel Serverless Function: GET /api/chat/poll
 *
 * Discord チャンネルから bot の最新返信を取得して返す。
 * afterMessageId より後のメッセージのうち、bot (ID: 1488015940565209148) の
 * 発言で [GenbaHub:{userId}] への返信を抽出して返す。
 *
 * クエリパラメータ:
 *   userId: string      — 送信元ユーザーID
 *   after?: string      — このメッセージIDより後のみ取得（初回は省略）
 *
 * レスポンス (JSON):
 *   { messages: Array<{ id: string, content: string, timestamp: string }> }
 */

type VercelRequest = {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  query: Record<string, string | string[] | undefined>;
};

type VercelResponse = {
  status: (code: number) => VercelResponse;
  json: (body: unknown) => void;
  setHeader: (name: string, value: string) => void;
};

const CHANNEL_ID = process.env.DISCORD_CHAT_CHANNEL_ID ?? "1489407813230002347";
const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN ?? "";
const BOT_ID = "1488015940565209148";

type DiscordMessage = {
  id: string;
  content: string;
  timestamp: string;
  author: { id: string; bot?: boolean };
  message_reference?: { message_id: string };
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", process.env.APP_BASE_URL || "https://construction-pm-mvp.vercel.app");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.status(204).json({});
    return;
  }

  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  if (!BOT_TOKEN) {
    res.status(500).json({ error: "DISCORD_BOT_TOKEN not configured" });
    return;
  }

  const userId = Array.isArray(req.query.userId) ? req.query.userId[0] : req.query.userId;
  const after = Array.isArray(req.query.after) ? req.query.after[0] : req.query.after;

  if (!userId) {
    res.status(400).json({ error: "userId is required" });
    return;
  }

  // Discord から最新50件を取得
  const url = new URL(`https://discord.com/api/v10/channels/${CHANNEL_ID}/messages`);
  url.searchParams.set("limit", "50");
  if (after) {
    url.searchParams.set("after", after);
  }

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Bot ${BOT_TOKEN}`,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    res.status(502).json({ error: `Discord API error: ${response.status}`, detail: errorText });
    return;
  }

  const messages = (await response.json()) as DiscordMessage[];

  // bot のメッセージのうち、このユーザーへの返信を抽出
  // bot は [GenbaHub:userId] プレフィックスを含むメッセージへ返信する
  const prefix = `[GenbaHub:${userId}]`;

  // ユーザーのメッセージIDセットを作成
  const userMessageIds = new Set<string>();
  for (const msg of messages) {
    if (msg.content.startsWith(prefix)) {
      userMessageIds.add(msg.id);
    }
  }

  // bot からの返信を抽出（reply_to でユーザーメッセージを参照しているもの）
  const botReplies = messages
    .filter(
      (msg) =>
        msg.author.id === BOT_ID &&
        msg.author.bot &&
        msg.message_reference &&
        userMessageIds.has(msg.message_reference.message_id),
    )
    .map((msg) => ({
      id: msg.id,
      content: msg.content,
      timestamp: msg.timestamp,
    }));

  // Discord は新しい順に返すので古い順に並び替え
  botReplies.sort((a, b) => a.id.localeCompare(b.id));

  res.status(200).json({ messages: botReplies });
}
