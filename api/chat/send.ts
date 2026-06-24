/**
 * Vercel Serverless Function: POST /api/chat/send
 *
 * GenbaHub UI からのメッセージを Discord チャンネルに投稿する。
 * DISCORD_CHAT_WEBHOOK_URL が設定されている場合は webhook 経由で投稿する。
 * webhook 投稿は bot から見ると「他者発言」になるため Claude sentinel が通常通り反応できる。
 * 環境変数が未設定の場合は既存の Bot REST API にフォールバックする（後方互換）。
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
const WEBHOOK_URL = process.env.DISCORD_CHAT_WEBHOOK_URL ?? "";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", process.env.APP_BASE_URL || "https://construction-pm-mvp.vercel.app");
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

  if (!WEBHOOK_URL && !BOT_TOKEN) {
    res.status(500).json({ error: "DISCORD_CHAT_WEBHOOK_URL or DISCORD_BOT_TOKEN must be configured" });
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

  let response: Response;

  if (WEBHOOK_URL) {
    // webhook 経由で投稿（bot から見ると「他者発言」→ Claude sentinel が反応できる）
    response = await fetch(WEBHOOK_URL + "?wait=true", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content, username: "GenbaHub Panel" }),
    });
  } else {
    // フォールバック: Bot REST API（後方互換）
    response = await fetch(
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
  }

  if (!response.ok) {
    const errorText = await response.text();
    res.status(502).json({ error: `Discord API error: ${response.status}`, detail: errorText });
    return;
  }

  const message = (await response.json()) as { id: string };
  res.status(200).json({ ok: true, messageId: message.id });
}
