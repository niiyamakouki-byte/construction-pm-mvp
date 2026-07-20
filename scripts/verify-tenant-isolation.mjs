// Ticket: P0-TENANT-20260721
// Provenance: base commit dddf1c5; author type Codex agent; created 2026-07-21 JST.
// Creates an email-confirmed test user through the admin API (no email is sent),
// verifies PostgREST tenant isolation, then deletes every created row and user.
/* global fetch */
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { URL } from "node:url";
import { createClient } from "@supabase/supabase-js";

function loadEnvFile(path) {
  const values = {};
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    if (!line || line.startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator < 1) continue;
    values[line.slice(0, separator)] = line.slice(separator + 1);
  }
  return values;
}

function required(value, name) {
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const env = { ...loadEnvFile(new URL("../.env.local", import.meta.url)), ...process.env };
const supabaseUrl = required(env.SUPABASE_URL ?? env.VITE_SUPABASE_URL, "SUPABASE_URL");
const anonKey = required(env.SUPABASE_ANON_KEY ?? env.VITE_SUPABASE_ANON_KEY, "SUPABASE_ANON_KEY");
const serviceRoleKey = required(env.SUPABASE_SERVICE_ROLE_KEY, "SUPABASE_SERVICE_ROLE_KEY");
const runId = `p0-${Date.now()}-${randomUUID().slice(0, 8)}`;
const email = `${runId}@example.invalid`;
const password = `${randomUUID()}Aa1!`;
const projectId = randomUUID();
const projectName = `P0 tenant cleanup probe ${runId}`;
const godivaId = "a1b2c3d4-0001-0001-0001-000000000001";

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const tenant = createClient(supabaseUrl, anonKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

let userId = null;
let organizationId = null;
let accessToken;
let failure = null;

try {
  const created = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { company_name: `P0 Isolation ${runId}` },
  });
  if (created.error) throw created.error;
  userId = created.data.user.id;
  console.log("ACCOUNT_CREATE status=PASS delivery=email_not_sent");

  const signedIn = await tenant.auth.signInWithPassword({ email, password });
  if (signedIn.error) throw signedIn.error;
  accessToken = signedIn.data.session.access_token;

  const ensured = await tenant.rpc("ensure_user_organization", {
    p_user_id: userId,
    p_org_name: `P0 Isolation ${runId}`,
  });
  if (ensured.error) throw ensured.error;
  organizationId = ensured.data;
  console.log(`ORG_CREATE status=PASS org=${organizationId}`);

  const tables = [
    "projects",
    "tasks",
    "documents",
    "document_versions",
    "photos",
    "estimates",
    "invoices",
    "customers",
    "contractors",
  ];
  for (const table of tables) {
    const result = await tenant.from(table).select("*", { count: "exact", head: true });
    if (result.error) throw result.error;
    console.log(`TABLE_PROBE table=${table} status=200 count=${result.count}`);
    assert(result.count === 0, `${table} leaked ${result.count} rows`);
  }

  const directIdUrl = new URL(`${supabaseUrl}/rest/v1/projects`);
  directIdUrl.searchParams.set("select", "id,name");
  directIdUrl.searchParams.set("id", `eq.${godivaId}`);
  const directIdResponse = await fetch(directIdUrl, {
    headers: { apikey: anonKey, Authorization: `Bearer ${accessToken}` },
  });
  const directIdRows = await directIdResponse.json();
  console.log(`DIRECT_API probe=godiva_id http=${directIdResponse.status} rows=${directIdRows.length}`);
  assert(directIdResponse.status === 200 && directIdRows.length === 0, "Godiva direct ID leaked");

  for (const [label, name] of [["godiva", "ゴディバ"], ["nichii", "ニチイ"]]) {
    const url = new URL(`${supabaseUrl}/rest/v1/projects`);
    url.searchParams.set("select", "id,name");
    url.searchParams.set("name", `ilike.*${name}*`);
    const response = await fetch(url, {
      headers: { apikey: anonKey, Authorization: `Bearer ${accessToken}` },
    });
    const rows = await response.json();
    console.log(`DIRECT_API probe=${label}_name http=${response.status} rows=${rows.length}`);
    assert(response.status === 200 && rows.length === 0, `${label} name probe leaked`);
  }

  const inserted = await tenant.from("projects").insert({
    id: projectId,
    name: projectName,
    description: "test data; delete in finally",
    status: "planning",
    start_date: new Date().toISOString().slice(0, 10),
    mode: "memo",
  }).select("id,organization_id").single();
  if (inserted.error) throw inserted.error;
  assert(inserted.data.organization_id === organizationId, "insert trigger assigned the wrong organization");
  console.log(`OWN_WRITE status=PASS auto_org=${inserted.data.organization_id}`);

  const postInsert = await tenant.from("projects").select("id", { count: "exact", head: true });
  if (postInsert.error) throw postInsert.error;
  assert(postInsert.count === 1, `own tenant expected 1 project, got ${postInsert.count}`);
  console.log(`OWN_READ status=PASS count=${postInsert.count}`);
} catch (error) {
  failure = error;
  console.error(`VERIFY status=FAIL message=${error.message}`);
} finally {
  if (projectId) {
    const deletedProject = await admin.from("projects").delete().eq("id", projectId);
    if (deletedProject.error) console.error(`CLEANUP project=FAIL message=${deletedProject.error.message}`);
  }
  if (userId) {
    const deletedMembership = await admin.from("organization_members").delete().eq("user_id", userId);
    if (deletedMembership.error) console.error(`CLEANUP membership=FAIL message=${deletedMembership.error.message}`);
  }
  if (organizationId) {
    const deletedOrganization = await admin.from("organizations").delete().eq("id", organizationId);
    if (deletedOrganization.error) console.error(`CLEANUP organization=FAIL message=${deletedOrganization.error.message}`);
  }
  if (userId) {
    const deletedUser = await admin.auth.admin.deleteUser(userId);
    if (deletedUser.error) console.error(`CLEANUP user=FAIL message=${deletedUser.error.message}`);
  }

  const projectCheck = await admin.from("projects").select("id", { count: "exact", head: true }).eq("id", projectId);
  const membershipCheck = userId
    ? await admin.from("organization_members").select("user_id", { count: "exact", head: true }).eq("user_id", userId)
    : { count: 0, error: null };
  const orgCheck = organizationId
    ? await admin.from("organizations").select("id", { count: "exact", head: true }).eq("id", organizationId)
    : { count: 0, error: null };
  const cleanupPassed = !projectCheck.error && !membershipCheck.error && !orgCheck.error
    && projectCheck.count === 0 && membershipCheck.count === 0 && orgCheck.count === 0;
  console.log(`CLEANUP status=${cleanupPassed ? "PASS" : "FAIL"} project=${projectCheck.count} membership=${membershipCheck.count} organization=${orgCheck.count}`);
  if (!cleanupPassed && !failure) failure = new Error("cleanup verification failed");
}

if (failure) process.exitCode = 1;
else console.log("VERIFY status=PASS tenant_isolation=ENFORCED");
