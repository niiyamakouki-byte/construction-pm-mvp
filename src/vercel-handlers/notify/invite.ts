/**
 * Vercel Serverless Function: POST /api/push/invite
 *
 * 経緯: api/push/contact.ts と同じ理由（Hobby プラン Function 上限12に到達済み）で
 * api/push/[action].ts の動的ディスパッチャに間借りする。Web Push とは無関係。
 *
 * 組織オーナー/管理者によるメンバーメール招待。招待管理用の新規テーブルは追加せず、
 * Supabase Auth の既存の招待プリミティブ（auth.admin.generateLink）でリンクを発行し、
 * sendUserInvitation でメール送信する。
 *
 * 認証: Authorization: Bearer <supabase jwt> 必須。
 * リクエスト body (JSON): { email: string, inviterName?: string }
 */
import { createClient } from "@supabase/supabase-js";
import { inviteOrgMember, type OrgMembership } from "../../lib/email/invite-org-member.js";
import { asSupabaseAuthVerifier } from "../../lib/auth-helper.js";

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

function getAppBaseUrl(): string {
  const configured = process.env.APP_BASE_URL;
  return configured ? configured.replace(/\/$/, "") : "https://genbahub.vercel.app";
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    res.status(405).json({ ok: false, error: "POST のみ受け付けます" });
    return;
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseServiceKey) {
    res.status(500).json({ ok: false, error: "SUPABASE_URL または SUPABASE_SERVICE_ROLE_KEY が未設定です。" });
    return;
  }

  const token = extractBearer(req);
  if (!token) {
    res.status(401).json({ ok: false, error: "認証が必要です" });
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const auth = asSupabaseAuthVerifier(supabase.auth);
  const { data: userData, error: userErr } = await auth.getUser(token);
  if (userErr || !userData?.user) {
    res.status(401).json({ ok: false, error: "認証トークンが無効です" });
    return;
  }
  const requesterId = userData.user.id;

  const body = parseBody(req.body);
  const email = typeof body.email === "string" ? body.email : "";
  const inviterName = typeof body.inviterName === "string" ? body.inviterName : undefined;

  try {
    const result = await inviteOrgMember(
      requesterId,
      { email, inviterName },
      {
        lookupRequesterMembership: async (uid): Promise<OrgMembership | null> => {
          const { data, error } = await supabase
            .from("organization_members")
            .select("organization_id, role, organizations(name)")
            .eq("user_id", uid)
            .in("role", ["owner", "admin"])
            .limit(1)
            .maybeSingle();
          if (error || !data) return null;
          const orgName = Array.isArray(data.organizations)
            ? (data.organizations[0] as { name?: string } | undefined)?.name
            : (data.organizations as { name?: string } | null)?.name;
          return {
            organizationId: data.organization_id as string,
            organizationName: orgName ?? "GenbaHub",
            role: data.role as OrgMembership["role"],
          };
        },
        generateInviteLink: async (inviteeEmail) => {
          // Vercel のビルド時型チェッカーがパッケージ跨ぎの継承(SupabaseAuthClient → AuthClient →
          // GoTrueClient.admin)を解決できない場合があるため、admin API 呼び出し部分のみ最小の
          // 構造的型で明示する（実行時の挙動は createClient(...).auth.admin と完全に同一）。
          const adminAuth = supabase.auth as unknown as {
            admin: {
              generateLink: (params: {
                type: "invite";
                email: string;
                options?: { redirectTo?: string };
              }) => Promise<{
                data: { properties?: { action_link?: string } } | null;
                error: { message: string } | null;
              }>;
            };
          };
          const { data, error } = await adminAuth.admin.generateLink({
            type: "invite",
            email: inviteeEmail,
            options: { redirectTo: `${getAppBaseUrl()}/#/login` },
          });
          if (error || !data?.properties?.action_link) {
            return { ok: false, error: error?.message ?? "招待リンクの発行に失敗しました" };
          }
          return { ok: true, invitationUrl: data.properties.action_link };
        },
      },
    );

    if (!result.ok) {
      res.status(result.status).json({ ok: false, error: result.error });
      return;
    }

    res.status(200).json({ ok: true, emailId: result.emailId, organizationName: result.organizationName });
  } catch (err) {
    const message = err instanceof Error ? err.message : "不明なエラー";
    console.error("[push/invite] failed:", err);
    res.status(502).json({ ok: false, error: `メール送信に失敗しました: ${message}` });
  }
}
