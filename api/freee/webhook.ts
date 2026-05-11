/**
 * POST /api/freee/webhook — freee 会計 Webhook 受信
 *
 * 検証: ヘッダー `x-freee-token` が env FREEE_WEBHOOK_TOKEN と一致するか。
 * 入金/取引イベントを Discord #経費・請求 へ転送する。
 *
 * 必要な環境変数:
 *   - FREEE_WEBHOOK_TOKEN          freee アプリ管理画面の「検証用トークン」
 *   - DISCORD_WEBHOOK_URL_KEIHI    Discord webhook URL (#経費・請求 用)
 */
import {
  tokensMatch,
  formatDiscordContent,
  postToDiscord,
  type FreeePayload,
} from "../../src/lib/freee-webhook.js";

type Req = {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  body?: unknown;
};
type Res = {
  status: (code: number) => Res;
  json: (body: unknown) => void;
  setHeader: (name: string, value: string) => void;
};

function headerStr(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

export default async function handler(req: Req, res: Res): Promise<void> {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const expectedToken = process.env.FREEE_WEBHOOK_TOKEN;
  const discordUrl = process.env.DISCORD_WEBHOOK_URL_KEIHI;
  if (!expectedToken || !discordUrl) {
    console.error("[freee-webhook] FREEE_WEBHOOK_TOKEN or DISCORD_WEBHOOK_URL_KEIHI not set");
    res.status(500).json({ error: "server not configured" });
    return;
  }

  const receivedToken = headerStr(req.headers["x-freee-token"]);
  if (!tokensMatch(receivedToken, expectedToken)) {
    console.warn("[freee-webhook] invalid x-freee-token");
    res.status(401).json({ error: "invalid token" });
    return;
  }

  const payload: FreeePayload =
    typeof req.body === "object" && req.body !== null
      ? (req.body as FreeePayload)
      : {};

  // ack 即返し → Discord 送信は fire-and-forget
  res.status(200).json({ ok: true });

  try {
    const content = formatDiscordContent(payload);
    await postToDiscord(discordUrl, content);
  } catch (err) {
    console.error("[freee-webhook] discord forward failed:", err);
  }
}
