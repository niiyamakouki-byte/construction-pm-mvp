/**
 * Vercel Serverless Function: POST /api/push/subscribe
 *
 * 認証済みユーザーの Web Push 購読情報を Supabase (push_subscriptions) に保存する。
 * endpoint を一意キーとして upsert する。
 *
 * セキュリティ:
 *   - Authorization: Bearer <supabase jwt> が必須（未認証は 401）
 *   - user_id は JWT から導出（クライアント指定不可）
 *
 * リクエスト body (JSON):
 *   { subscription: PushSubscriptionJSON, userAgent?: string }
 */
import { createClient } from "@supabase/supabase-js";
import { asSupabaseAuthVerifier } from "../../src/lib/auth-helper.js";

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

function parseBody(body: unknown): Record<string, unknown> {
  if (typeof body === "string") {
    try {
      return JSON.parse(body) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
  if (body && typeof body === "object") return body as Record<string, unknown>;
  return {};
}

function extractBearer(req: VercelRequest): string | null {
  const raw = req.headers.authorization ?? req.headers.Authorization;
  const header = Array.isArray(raw) ? raw[0] : raw;
  if (!header) return null;
  const match = /^Bearer\s+(.+)$/i.exec(header);
  return match ? match[1].trim() : null;
}

type SubscriptionInput = {
  endpoint?: unknown;
  keys?: { p256dh?: unknown; auth?: unknown };
};

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.status(405).json({ error: "POST のみ受け付けます" });
    return;
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseServiceKey) {
    res.status(500).json({
      error: "SUPABASE_URL または SUPABASE_SERVICE_ROLE_KEY が未設定です。",
    });
    return;
  }

  const token = extractBearer(req);
  if (!token) {
    res.status(401).json({ error: "認証が必要です" });
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const authVerifier = asSupabaseAuthVerifier(supabase.auth);
  const { data: userData, error: userErr } = await authVerifier.getUser(token);
  if (userErr || !userData?.user) {
    res.status(401).json({ error: "認証トークンが無効です" });
    return;
  }
  const authedUser = userData.user;

  const body = parseBody(req.body);
  const subscription = body.subscription as SubscriptionInput | undefined;
  const endpoint = subscription?.endpoint;
  const p256dh = subscription?.keys?.p256dh;
  const auth = subscription?.keys?.auth;

  if (
    typeof endpoint !== "string" ||
    typeof p256dh !== "string" ||
    typeof auth !== "string"
  ) {
    res.status(400).json({ error: "subscription (endpoint, keys) が不正です" });
    return;
  }

  const userAgent =
    typeof body.userAgent === "string" ? body.userAgent.slice(0, 512) : null;

  const { error: upsertErr } = await supabase
    .from("push_subscriptions")
    .upsert(
      {
        user_id: authedUser.id,
        endpoint,
        p256dh,
        auth,
        user_agent: userAgent,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "endpoint" },
    );

  if (upsertErr) {
    console.error("[push/subscribe] upsert failed:", upsertErr);
    res.status(500).json({ error: `購読の保存に失敗しました: ${upsertErr.message}` });
    return;
  }

  res.status(200).json({ ok: true });
}
