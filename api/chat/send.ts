/**
 * Vercel Serverless Function: POST /api/chat/send
 *
 * GenbaHub UI からのメッセージを Discord チャンネルに投稿する。
 * Discord Bot API を直接呼び出す（webhook 不使用）。
 *
 * リクエスト body (JSON):
 *   { userId: string, text: string }
 *
 * レスポンス (JSON):
 *   { ok: true, messageId: string }
 */

type VercelRequest = {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  body?: unknown;
};

type VercelResponse = {
  status: (code: number) => VercelResponse;
  json: (body: unknown) => void;
  setHeader: (name: string, value: string) => void;
};

const CHANNEL_ID = process.env.DISCORD_CHAT_CHANNEL_ID ?? "1489407813230002347";
const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN ?? "";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.status(204).json({});
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  if (!BOT_TOKEN) {
    res.status(500).json({ error: "DISCORD_BOT_TOKEN not configured" });
    return;
  }

  const body = req.body as { userId?: string; text?: string } | undefined;
  const userId = body?.userId?.trim();
  const text = body?.text?.trim();

  if (!userId || !text) {
    res.status(400).json({ error: "userId and text are required" });
    return;
  }

  // テキストを 1800 文字に制限
  const truncatedText = text.length > 1800 ? text.slice(0, 1800) + "..." : text;
  const content = `[GenbaHub:${userId}] ${truncatedText}`;

  const response = await fetch(
    `https://discord.com/api/v10/channels/${CHANNEL_ID}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bot ${BOT_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ content }),
    },
  );

  if (!response.ok) {
    const errorText = await response.text();
    res.status(502).json({ error: `Discord API error: ${response.status}`, detail: errorText });
    return;
  }

  const message = (await response.json()) as { id: string };
  res.status(200).json({ ok: true, messageId: message.id });
}
