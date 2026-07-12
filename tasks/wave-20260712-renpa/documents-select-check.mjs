// wave-20260712-renpa: 認証ユーザーでのdocuments select可視性確認(読み取りのみ)
// 作成者: Claude worker (PDFビューアー担当・後継 2026-07-12)
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const envText = readFileSync("/Users/koki/construction-pm-mvp/.env.local", "utf8");
const env = {};
for (const line of envText.split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) env[m[1]] = m[2];
}
const admin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const { data: adminDocs } = await admin.from("documents").select("id,project_id,name,url").order("created_at", { ascending: false }).limit(5);
console.log("admin sees docs:", (adminDocs || []).length);
for (const d of adminDocs || []) console.log("  ", d.id.slice(0, 8), d.name, "| proj:", d.project_id?.slice(0, 8));

const { data: link } = await admin.auth.admin.generateLink({ type: "magiclink", email: "niiyama+audit20260712@laporta.co.jp" });
const anon = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY);
const { error: vErr } = await anon.auth.verifyOtp({ token_hash: link.properties.hashed_token, type: "magiclink" });
if (vErr) { console.error("verify FAIL:", vErr.message); process.exit(1); }

const { data: docs, error } = await anon.from("documents").select("*").order("created_at", { ascending: true });
console.log("authed select documents:", error ? `ERROR: ${error.message}` : `${docs.length} rows`);

// RLSポリシー確認(admin経由のSQLは使えないのでpg_policiesはManagement APIで別途)
