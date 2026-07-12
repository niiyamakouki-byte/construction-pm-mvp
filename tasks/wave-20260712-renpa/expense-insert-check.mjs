import { createClient } from "@supabase/supabase-js";
import * as fs from "node:fs";
const envText = fs.readFileSync("/Users/koki/construction-pm-mvp/.env.local", "utf8");
const env = {};
for (const line of envText.split("\n")) { const m = line.match(/^([A-Z_]+)=(.*)$/); if (m) env[m[1]] = m[2]; }
const admin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const { data: linkData } = await admin.auth.admin.generateLink({ type: "magiclink", email: "niiyama+audit20260712@laporta.co.jp" });
const authed = createClient(env.SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);
await authed.auth.verifyOtp({ token_hash: linkData.properties.hashed_token, type: "magiclink" });
const { error } = await authed.from("expenses").insert({
  id: crypto.randomUUID(), project_id: "", expense_date: "2026-07-12",
  description: "請求書: 検証", amount: 1000, category: "請求書",
  approval_status: "pending", created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
});
console.log("expenses insert(project_id=''):", error ? `FAIL: ${error.message} (code=${error.code})` : "OK(要cleanup)");
