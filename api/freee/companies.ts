/**
 * GET /api/freee/companies — freee 事業所一覧
 *
 * 認証: Authorization: Bearer <supabase jwt>
 * 必須 env: VITE_FREEE_CLIENT_ID / FREEE_CLIENT_SECRET /
 *          SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from "@supabase/supabase-js";
import { asSupabaseAuthVerifier } from "../../src/lib/auth-helper.js";
import { handleFreeeRequest } from "../../src/lib/freee-api-handler.js";
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

export default async function handler(req: Req, res: Res): Promise<void> {
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
    "companies",
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
