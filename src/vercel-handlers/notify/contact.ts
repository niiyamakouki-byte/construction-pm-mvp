/**
 * Vercel Serverless Function: POST /api/push/contact
 *
 * 経緯: 本来 /api/notify のような独立エンドポイントにすべき内容だが、本プロジェクトは
 * 既に Hobby プランの Serverless Functions 上限(12)に到達済み（api/cron/supabase-keepalive.ts,
 * api/freee/[resource].ts のコメント参照）。api/push/[action].ts は既存の [action] 動的セグメント
 * ディスパッチャで新規ファイルを増やさず機能追加できるため、ここに間借りする
 * （Web Push とは無関係。ルーティングのみ共用）。
 *
 * 問い合わせフォーム（laporta-hp /contact または GenbaHub 自身の問い合わせ導線）から送られた
 * payload を受信し、正常な場合のみ運営(niiyama@laporta.co.jp)へ通知メールを送る。
 * 認証不要（外部フォームからの受信を想定）。
 *
 * リクエスト body (JSON): { payload: ContactPayload }
 */
import {
  receiveContactSubmissionAndNotify,
  type ContactPayload,
} from "../../lib/contact-webhook/contact-webhook-receiver.js";

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

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.status(405).json({ ok: false, error: "POST のみ受け付けます" });
    return;
  }

  const body = parseBody(req.body);
  const payload = (body.payload ?? {}) as ContactPayload;

  try {
    const result = await receiveContactSubmissionAndNotify(payload);

    if (!result.ok) {
      res.status(400).json({ ok: false, errors: result.errors });
      return;
    }

    if (!("notification" in result)) {
      // receiveContactSubmissionAndNotify は ok:true の場合、必ず notification を含む。
      // 型上の網羅性のためだけの分岐（実行時には到達しない）。
      res.status(200).json({ ok: true, submissionId: result.submission.id });
      return;
    }

    res.status(200).json({
      ok: true,
      submissionId: result.notification.submission.id,
      emailId: result.notification.email.id,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "不明なエラー";
    console.error("[push/contact] failed:", err);
    res.status(502).json({ ok: false, error: `メール送信に失敗しました: ${message}` });
  }
}
