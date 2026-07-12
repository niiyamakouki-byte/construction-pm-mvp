// wave-20260712-renpa: project-documentsバケットのRLS/ポリシー調査(読み取り+テストアップロード1件)
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

// バケット設定
const { data: buckets, error: bErr } = await admin.storage.listBuckets();
console.log("--- buckets:", bErr?.message || "");
for (const b of buckets || []) console.log(" ", b.id, "| public:", b.public, "| allowed:", b.allowed_mime_types, "| size limit:", b.file_size_limit);

// storage.objectsのRLSポリシー一覧(pg_policies読み取り)
const { data: pol, error: pErr } = await admin.rpc("exec_sql", { sql: "select policyname from pg_policies where tablename='objects'" });
console.log("--- policies via rpc:", pErr?.message || JSON.stringify(pol));

// 認証ユーザー(監査アカウント)としてアップロードを試す
const { data: link, error: lErr } = await admin.auth.admin.generateLink({ type: "magiclink", email: "niiyama+audit20260712@laporta.co.jp" });
if (lErr) { console.error("link FAIL:", lErr.message); process.exit(1); }
const anon = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY);
const { error: vErr } = await anon.auth.verifyOtp({ token_hash: link.properties.hashed_token, type: "magiclink" });
if (vErr) { console.error("verify FAIL:", vErr.message); process.exit(1); }

const pdfBytes = new Uint8Array(readFileSync("/Users/koki/construction-pm-mvp/src/pages/EstimatePage/__tests__/fixtures/floorplan-1-50.pdf"));
const path = `50d84b67-373b-417b-a1aa-d7ebf9cb6582/policy-check-20260712.pdf`;
const { error: upErr } = await anon.storage.from("project-documents").upload(path, pdfBytes, { contentType: "application/pdf", upsert: false });
console.log("--- authed upload:", upErr ? `FAIL: ${upErr.message} (status ${upErr.statusCode ?? "?"})` : "OK");

if (!upErr) {
  const { data: signed, error: sErr } = await anon.storage.from("project-documents").createSignedUrl(path, 60);
  console.log("--- authed createSignedUrl:", sErr ? `FAIL: ${sErr.message}` : "OK");
  // 後片付け(テスト成果物のみ削除)
  await admin.storage.from("project-documents").remove([path]);
  console.log("cleaned up test object");
}

// service roleでのアップロード(バケット自体の設定確認)
const { error: adminUpErr } = await admin.storage.from("project-documents").upload(path.replace(".pdf", "-admin.pdf"), pdfBytes, { contentType: "application/pdf" });
console.log("--- service-role upload:", adminUpErr ? `FAIL: ${adminUpErr.message}` : "OK");
if (!adminUpErr) await admin.storage.from("project-documents").remove([path.replace(".pdf", "-admin.pdf")]);
