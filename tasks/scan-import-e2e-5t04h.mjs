// scan-import-e2e-5t04h.mjs — LaPorta Scan→GenbaHub連携 (bead laporta-beads-5t04h) の実プロダクトSupabase向けE2E検証。
//
// scan-to-estimate（bead 7srcc）が出力した quantities.json / estimate.json と、
// scan-to-genbahub/make_floorplan.py が生成した間取りPNGを実際にGenbaHub本番Supabaseへ
// 書き込み、署名付きURLで実際に読み出せることまで確認する。
//
// api/scan-import.ts / src/lib/scan-import-handler.ts と同じテーブル・バケット・行の形を
// そのまま踏襲しているが、本スクリプトは Service Role キーで直接Supabaseを叩く
// （実機からの認証済みJWT取得はこの環境では検証不能なため、その手前までのDB/Storage経路を検証する）。
//
// 検証後、作成した test- プレフィクスの案件・写真・ドキュメントは全て削除し、本番を汚さない。
//
// Usage: node tasks/scan-import-e2e-5t04h.mjs
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';

const envText = readFileSync('.env.local', 'utf8');
const env = {};
for (const line of envText.split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) env[m[1]] = m[2];
}

const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const SCAN_DIR = `${process.env.HOME}/laporta-scan-pipeline/scan-to-estimate/out`;
const FLOORPLAN_PNG = `${process.env.HOME}/laporta-scan-pipeline/scan-to-genbahub/floorplan.png`;

const quantities = JSON.parse(readFileSync(`${SCAN_DIR}/quantities.json`, 'utf8'));
const estimate = JSON.parse(readFileSync(`${SCAN_DIR}/estimate.json`, 'utf8'));
const floorPlanBytes = readFileSync(FLOORPLAN_PNG);

function formatQuantities(q) {
  const lines = [
    `床面積: ${q.floor_area_m2}m2`,
    `壁面積(開口控除): ${q.wall_area_net_m2}m2`,
    `天井高: ${q.ceiling_height_m}m`,
    `周長: ${q.perimeter_m}m`,
    `巾木長: ${q.skirting_length_m}m`,
  ];
  return `【スキャン寸法】\n${lines.join('\n')}`;
}

function formatEstimate(e) {
  const lines = e.items.map((it) => `- ${it.name}(${it.qty}${it.unit}): ¥${it.amount.toLocaleString('ja-JP')}`);
  lines.push(`税抜合計: ¥${e.subtotal_untaxed.toLocaleString('ja-JP')}`);
  lines.push(`税込合計: ¥${e.total_taxed.toLocaleString('ja-JP')}`);
  return `【概算見積(スキャン自動生成・要確認)】\n${lines.join('\n')}`;
}

const results = { steps: [] };

async function step(name, fn) {
  try {
    const value = await fn();
    results.steps.push({ name, ok: true, value });
    console.log(`OK   ${name}`);
    return value;
  } catch (err) {
    results.steps.push({ name, ok: false, error: String(err?.message ?? err) });
    console.error(`FAIL ${name}:`, err?.message ?? err);
    throw err;
  }
}

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const projectId = randomUUID();
const documentId = randomUUID();
const photoId = randomUUID();

let cleanup = { projectId };

try {
  await step('1. GenbaHub案件作成 (projects insert)', async () => {
    const description = [
      '施主: test-スキャンE2E太郎',
      formatQuantities(quantities),
      formatEstimate(estimate),
      '(LaPorta Scan 取り込み / bead laporta-beads-5t04h E2E検証)',
    ].join('\n\n');
    const { error } = await supabase.from('projects').insert({
      id: projectId,
      name: `test-scan-import-5t04h-${stamp}`,
      description,
      status: 'planning',
      start_date: new Date().toISOString().slice(0, 10),
      address: null,
    });
    if (error) throw new Error(error.message);
    return { projectId };
  });

  const docUrl = await step('2. 間取り図PNGアップロード (project-documents storage)', async () => {
    const path = `${projectId}/${documentId}.png`;
    const { error: upErr } = await supabase.storage.from('project-documents').upload(path, floorPlanBytes, {
      cacheControl: '3600',
      contentType: 'image/png',
      upsert: false,
    });
    if (upErr) throw new Error(upErr.message);
    const { data: signed, error: signErr } = await supabase.storage
      .from('project-documents')
      .createSignedUrl(path, 60 * 60);
    if (signErr) throw new Error(signErr.message);
    return signed.signedUrl;
  });

  await step('3. documentsテーブル登録', async () => {
    const { error } = await supabase.from('documents').insert({
      id: documentId,
      project_id: projectId,
      name: 'floorplan.png',
      type: 'drawing',
      url: docUrl,
      uploaded_by: 'scan-import-e2e-5t04h',
      version: '1',
    });
    if (error) throw new Error(error.message);
  });

  const photoUrl = await step('4. 写真アップロード (construction-photos storage)', async () => {
    const path = `${projectId}/${photoId}.png`;
    const { error: upErr } = await supabase.storage.from('construction-photos').upload(path, floorPlanBytes, {
      cacheControl: '3600',
      contentType: 'image/png',
      upsert: false,
    });
    if (upErr) throw new Error(upErr.message);
    const { data: signed, error: signErr } = await supabase.storage
      .from('construction-photos')
      .createSignedUrl(path, 60 * 60);
    if (signErr) throw new Error(signErr.message);
    return signed.signedUrl;
  });

  await step('5. photosテーブル登録', async () => {
    const { error } = await supabase.from('photos').insert({
      id: photoId,
      project_id: projectId,
      storage_bucket: 'construction-photos',
      storage_path: `${projectId}/${photoId}.png`,
      url: photoUrl,
      file_name: 'floorplan.png',
      content_type: 'image/png',
      file_size: floorPlanBytes.length,
      category: 'scan',
      caption: '実写真無し、スキャンE2E検証用ダミー画像(間取り図と同一ファイル)',
      taken_at: new Date().toISOString(),
    });
    if (error) throw new Error(error.message);
  });

  await step('6. projects読み出し確認 (description に寸法・見積が入っているか)', async () => {
    const { data, error } = await supabase.from('projects').select('*').eq('id', projectId).single();
    if (error) throw new Error(error.message);
    if (!data.description.includes('壁クロス張替')) throw new Error('description に見積明細が含まれていない');
    if (!data.description.includes('9.72m2')) throw new Error('description に寸法が含まれていない');
    return { name: data.name, descriptionLength: data.description.length };
  });

  await step('7. photos/documents 一覧読み出し確認', async () => {
    const { data: docs, error: docErr } = await supabase.from('documents').select('*').eq('project_id', projectId);
    if (docErr) throw new Error(docErr.message);
    const { data: photos, error: photoErr } = await supabase.from('photos').select('*').eq('project_id', projectId);
    if (photoErr) throw new Error(photoErr.message);
    if (docs.length !== 1) throw new Error(`documents件数が想定外: ${docs.length}`);
    if (photos.length !== 1) throw new Error(`photos件数が想定外: ${photos.length}`);
    return { documentsCount: docs.length, photosCount: photos.length };
  });

  await step('8. 署名付きURLで実際にバイト取得できるか (document)', async () => {
    const res = await fetch(docUrl);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length !== floorPlanBytes.length) throw new Error(`バイト数不一致: got ${buf.length}, want ${floorPlanBytes.length}`);
    return { status: res.status, bytes: buf.length, contentType: res.headers.get('content-type') };
  });

  await step('9. 署名付きURLで実際にバイト取得できるか (photo)', async () => {
    const res = await fetch(photoUrl);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length !== floorPlanBytes.length) throw new Error(`バイト数不一致: got ${buf.length}, want ${floorPlanBytes.length}`);
    return { status: res.status, bytes: buf.length, contentType: res.headers.get('content-type') };
  });

  console.log('\n=== E2E成功。テストデータをクリーンアップします ===');
} finally {
  // クリーンアップ: photos/documents/storage objects/projects(cascadeでtasks等も消える)
  try {
    await supabase.storage.from('construction-photos').remove([`${projectId}/${photoId}.png`]);
    await supabase.storage.from('project-documents').remove([`${projectId}/${documentId}.png`]);
    await supabase.from('photos').delete().eq('project_id', projectId);
    await supabase.from('documents').delete().eq('project_id', projectId);
    await supabase.from('projects').delete().eq('id', projectId);
    console.log(`CLEANUP done for project ${projectId}`);
  } catch (cleanupErr) {
    console.error('CLEANUP FAILED — 手動確認要:', projectId, cleanupErr?.message ?? cleanupErr);
  }
}

console.log('\n=== RESULT JSON ===');
console.log(JSON.stringify(results, null, 2));

if (results.steps.some((s) => !s.ok)) {
  process.exit(1);
}
