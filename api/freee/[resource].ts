/**
 * GET /api/freee/companies | /api/freee/deals | /api/freee/invoices
 *
 * Vercel Hobby プランの Serverless Functions 上限(12)対応で
 * companies.ts / deals.ts / invoices.ts (旧: いずれも handleFreeeRequest への
 * 薄いラッパーで endpoint 文字列以外差分なし) を1関数に統合。
 * URL パスは変更なし(動的セグメント [resource] が旧ファイル名を吸収)。
 *
 * 認証: Authorization: Bearer <supabase jwt>
 * 必須 env: VITE_FREEE_CLIENT_ID / FREEE_CLIENT_SECRET /
 *          SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from "@supabase/supabase-js";
import { asSupabaseAuthVerifier } from "../../src/lib/auth-helper.js";
import { handleFreeeRequest, type FreeeEndpoint } from "../../src/lib/freee-api-handler.js";
import type { StoredFreeeToken } from "../../src/lib/freee-api.js";

type Req = {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  query?: Record<string, string | string[] | undefined>;
};
type Res = {
  status: (code: number) => Res;
  json: (body: unknown) => void;
  setHeader: (name: string, value: string) => void;
};

const VALID_RESOURCES: readonly FreeeEndpoint[] = ["companies", "deals", "invoices"];

function isFreeeEndpoint(value: string): value is FreeeEndpoint {
  return (VALID_RESOURCES as readonly string[]).includes(value);
}

export default async function handler(req: Req, res: Res): Promise<void> {
  const resourceRaw = req.query?.resource;
  const resource = Array.isArray(resourceRaw) ? resourceRaw[0] : resourceRaw;

  if (!resource || !isFreeeEndpoint(resource)) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  const clientId = process.env.VITE_FREEE_CLIENT_ID;
  const clientSecret = process.env.FREEE_CLIENT_SECRET;
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!clientId || !clientSecret || !supabaseUrl || !serviceKey) {
    res.status(500).json({ error: "freee / Supabase 環境変数が未設定です" });
    return;
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  await handleFreeeRequest(
    req,
    res,
    resource,
    {
      auth: asSupabaseAuthVerifier(supabase.auth),
      async loadToken(userId) {
        const { data } = await supabase
          .from("freee_tokens")
          .select("access_token, refresh_token, expires_at")
          .eq("user_id", userId)
          .maybeSingle();
        return data ?? null;
      },
      async saveToken(userId, token: StoredFreeeToken) {
        return supabase.from("freee_tokens").upsert({
          user_id: userId,
          access_token: token.accessToken,
          refresh_token: token.refreshToken,
          expires_at: token.expiresAt,
        });
      },
    },
    { clientId, clientSecret },
  );
}
