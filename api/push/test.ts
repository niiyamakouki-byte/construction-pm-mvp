/**
 * Vercel Serverless Function: POST /api/push/test
 *
 * 認証済みユーザー本人の全購読へテスト通知を送信する。
 * 本番ユーザーへの一斉配信ではなく「自分に届くか」の実証用エンドポイント。
 *
 * セキュリティ:
 *   - Authorization: Bearer <supabase jwt> が必須（未認証は 401）
 *   - 送信先は JWT の user_id に紐づく購読のみ
 *
 * 必要な環境変数: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT
 */
import { createClient } from "@supabase/supabase-js";
import { asSupabaseAuthVerifier } from "../../src/lib/auth-helper.js";
import webpush from "web-push";

type VercelRequest = {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
};

type VercelResponse = {
  status: (code: number) => VercelResponse;
  json: (body: unknown) => void;
  setHeader: (name: string, value: string) => void;
};

type PushSubscriptionRow = {
  endpoint: string;
  p256dh: string;
  auth: string;
};

function extractBearer(req: VercelRequest): string | null {
  const raw = req.headers.authorization ?? req.headers.Authorization;
  const header = Array.isArray(raw) ? raw[0] : raw;
  if (!header) return null;
  const match = /^Bearer\s+(.+)$/i.exec(header);
  return match ? match[1].trim() : null;
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.status(405).json({ error: "POST のみ受け付けます" });
    return;
  }

  const vapidPublic = process.env.VAPID_PUBLIC_KEY;
  const vapidPrivate = process.env.VAPID_PRIVATE_KEY;
  const vapidSubject = process.env.VAPID_SUBJECT ?? "mailto:niiyama@laporta.co.jp";
  if (!vapidPublic || !vapidPrivate) {
    res.status(500).json({
      error: "VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY が未設定です。",
    });
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

  const auth = asSupabaseAuthVerifier(supabase.auth);
  const { data: userData, error: userErr } = await auth.getUser(token);
  if (userErr || !userData?.user) {
    res.status(401).json({ error: "認証トークンが無効です" });
    return;
  }
  const authedUser = userData.user;

  const { data: subs, error: subsErr } = await supabase
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth")
    .eq("user_id", authedUser.id);

  if (subsErr) {
    res.status(500).json({ error: `購読の取得に失敗しました: ${subsErr.message}` });
    return;
  }
  const subscriptions = (subs ?? []) as PushSubscriptionRow[];
  if (subscriptions.length === 0) {
    res.status(404).json({ error: "この端末の購読が見つかりません。先に通知を有効化してください。" });
    return;
  }

  webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);

  const payload = JSON.stringify({
    title: "GenbaHub テスト通知",
    body: "プッシュ通知が正常に届きました。",
    url: "/",
    tag: "genbahub-test",
  });

  let sent = 0;
  const staleEndpoints: string[] = [];
  await Promise.all(
    subscriptions.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          payload,
        );
        sent += 1;
      } catch (err) {
        const statusCode = (err as { statusCode?: number }).statusCode;
        // 404/410 = 購読失効。掃除しておく。
        if (statusCode === 404 || statusCode === 410) {
          staleEndpoints.push(s.endpoint);
        } else {
          console.error("[push/test] send failed:", err);
        }
      }
    }),
  );

  if (staleEndpoints.length > 0) {
    await supabase
      .from("push_subscriptions")
      .delete()
      .in("endpoint", staleEndpoints);
  }

  res.status(200).json({ sent });
}
