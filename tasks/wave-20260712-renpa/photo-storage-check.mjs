// wave-20260712-renpa 第2波: construction-photosバケットが032適用後に403穴が塞がったかの実検証
// (申し送り②: is_project_org_member依存で写真アップロードも403だった可能性 → 032の関数修正で直っているはず)
// 作成者: Claude worker (公開レベルロングラン第2波 2026-07-12) / 参照: storage-policy-check.mjs(前任)
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const envText = readFileSync("/Users/koki/construction-pm-mvp/.env.local", "utf8");
const env = {};
for (const line of envText.split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) env[m[1]] = m[2];
}
const admin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

// 認証ユーザー(監査アカウント)としてアップロードを試す
const { data: link, error: lErr } = await admin.auth.admin.generateLink({ type: "magiclink", email: "niiyama+audit20260712@laporta.co.jp" });
if (lErr) { console.error("link FAIL:", lErr.message); process.exit(1); }
const anon = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY);
const { error: vErr } = await anon.auth.verifyOtp({ token_hash: link.properties.hashed_token, type: "magiclink" });
if (vErr) { console.error("verify FAIL:", vErr.message); process.exit(1); }

// 1x1 PNG(実アプリと同じ `${projectId}/${id}.ext` パス形式)
const pngBytes = Uint8Array.from(atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="), (c) => c.charCodeAt(0));
const path = `50d84b67-373b-417b-a1aa-d7ebf9cb6582/photo-policy-check-20260712.png`;

const { error: upErr } = await anon.storage.from("construction-photos").upload(path, pngBytes, { contentType: "image/png", upsert: false });
console.log("--- authed photo upload:", upErr ? `FAIL: ${upErr.message} (status ${upErr.statusCode ?? "?"})` : "OK");

let signOk = false;
if (!upErr) {
  const { data: signed, error: sErr } = await anon.storage.from("construction-photos").createSignedUrl(path, 60);
  signOk = !sErr && !!signed?.signedUrl;
  console.log("--- authed createSignedUrl:", sErr ? `FAIL: ${sErr.message}` : "OK");
  if (signOk) {
    const res = await fetch(signed.signedUrl);
    console.log("--- signed URL fetch:", res.ok ? `OK (${res.status})` : `FAIL (${res.status})`);
  }
  await admin.storage.from("construction-photos").remove([path]);
  console.log("cleaned up test object");
}

console.log(upErr || !signOk ? "PHOTO CHECK: FAIL" : "PHOTO CHECK: PASS");
process.exit(upErr || !signOk ? 1 : 0);
