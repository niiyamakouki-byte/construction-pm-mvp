/**
 * inquiry-repository — 問い合わせを Supabase `inquiries` テーブルへ保存する。
 *
 * service role で insert する(RLS は authenticated の SELECT/UPDATE のみ許可、
 * INSERT は service role 経由のサーバーサイド処理に限定する設計)。
 * SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY が未設定の環境(ローカル開発・テスト)では
 * 何もせず正常終了する — メール通知を止めないため。
 */

import { createClient } from "@supabase/supabase-js";
import type { ContactSubmission } from "./contact-webhook-receiver.js";
import type { EstimateRange } from "../estimate-assistant/cost-lookup.js";

export async function insertInquiryRecord(input: {
  submission: ContactSubmission;
  estimate: EstimateRange;
}): Promise<void> {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseServiceKey) {
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { error } = await supabase.from("inquiries").insert({
    source: input.submission.source || "hp_contact",
    submission: input.submission,
    estimate: input.estimate,
    status: "new",
  });

  if (error) {
    throw new Error(error.message);
  }
}
