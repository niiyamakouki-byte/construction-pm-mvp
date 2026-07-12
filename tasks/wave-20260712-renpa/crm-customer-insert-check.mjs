// wave-20260712-renpa 第3波: CRM顧客登録がサイレント失敗する真因の実証
// アプリ(CRMRepository.saveCustomerAsync)と同じペイロードで本番customersへINSERTを試す
// 作成者: Claude worker (公開レベルロングラン第3波)
import { createClient } from "@supabase/supabase-js";
import * as fs from "node:fs";

const envText = fs.readFileSync("/Users/koki/construction-pm-mvp/.env.local", "utf8");
const env = {};
for (const line of envText.split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) env[m[1]] = m[2];
}

// 監査ユーザーとして実ログイン(anonキー+magiclink token交換の代わりにadminでセッション発行)
const admin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
  type: "magiclink",
  email: "niiyama+audit20260712@laporta.co.jp",
});
if (linkErr) { console.error("magiclink FAIL:", linkErr.message); process.exit(1); }
const authed = createClient(env.SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY);
const { error: verifyErr } = await authed.auth.verifyOtp({
  token_hash: linkData.properties.hashed_token,
  type: "magiclink",
});
if (verifyErr) { console.error("verifyOtp FAIL:", verifyErr.message); process.exit(1); }

// アプリのcustomerToRowと同じ形(organization_id無し)
const id = crypto.randomUUID();
const row = {
  id,
  name: "第3波検証顧客(insert-check・削除可)",
  company: null,
  phone: null,
  email: null,
  address: null,
  notes: null,
  created_at: new Date().toISOString(),
};
const { error: insErr } = await authed.from("customers").insert(row);
console.log("app-payload insert:", insErr ? `FAIL: ${insErr.message} (code=${insErr.code})` : "OK");
if (!insErr) {
  await authed.from("customers").delete().eq("id", id);
  console.log("(cleanup済み)");
}
process.exit(0);
