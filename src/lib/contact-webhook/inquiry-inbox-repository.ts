/**
 * inquiry-inbox-repository — InquiryInboxPage 用の Supabase 読み取り/更新。
 *
 * ブラウザ側 (認証済みユーザー) から `inquiries` テーブルへアクセスする。
 * RLS は authenticated の SELECT/UPDATE のみを許可しており、INSERT は
 * サーバー側 (inquiry-repository.ts, service role) 経由に限定されている。
 */

import { getSupabaseClient } from "../../infra/supabase-client.js";
import type { ContactSubmission } from "./contact-webhook-receiver.js";
import type { EstimateRange } from "../estimate-assistant/cost-lookup.js";

export type InquiryStatus = "new" | "replied" | "closed";

export type InquiryDbRecord = {
  id: string;
  createdAt: string;
  source: string;
  submission: ContactSubmission;
  estimate: EstimateRange;
  status: InquiryStatus;
  repliedAt: string | null;
  notes: string | null;
};

type InquiryRow = {
  id: string;
  created_at: string;
  source: string;
  submission: ContactSubmission;
  estimate: EstimateRange;
  status: InquiryStatus;
  replied_at: string | null;
  notes: string | null;
};

function fromRow(row: InquiryRow): InquiryDbRecord {
  return {
    id: row.id,
    createdAt: row.created_at,
    source: row.source,
    submission: row.submission,
    estimate: row.estimate,
    status: row.status,
    repliedAt: row.replied_at,
    notes: row.notes,
  };
}

/** 問い合わせ一覧を新しい順に取得する。 */
export async function listInquiries(): Promise<InquiryDbRecord[]> {
  const supabase = await getSupabaseClient();
  const { data, error } = await supabase
    .from("inquiries")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as InquiryRow[]).map(fromRow);
}

/** ステータスを更新する（replied へ変更時は replied_at も記録）。 */
export async function updateInquiryStatus(id: string, status: InquiryStatus): Promise<void> {
  const supabase = await getSupabaseClient();
  const patch: Record<string, unknown> = { status };
  if (status === "replied") {
    patch.replied_at = new Date().toISOString();
  }
  const { error } = await supabase.from("inquiries").update(patch).eq("id", id);
  if (error) throw new Error(error.message);
}
