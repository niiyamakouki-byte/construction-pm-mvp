-- ============================================================
-- 20260904120000: inquiries (HP問い合わせ受信箱の永続化先)
-- 作成日: 2026-09-04 (JST)
-- 状態: 未適用 (票 laporta-beads-4fo1y, 適用は司令塔便 pcd3c8c41 が担当)
-- ============================================================
-- 背景: laporta-hp /contact からの問い合わせは receiveContactSubmissionAndNotify
-- でメール通知するのみで、GenbaHub側は localStorage (inquiry-store.ts) にしか
-- 残らずブラウザを跨いで共有できなかった。通知後段でこのテーブルへ insert し、
-- InquiryInboxPage を localStorage から Supabase 読み取りへ切り替える。
--
-- INSERT は service role (サーバーレス関数) のみを想定するため authenticated/anon への
-- INSERT 権限は付与しない(service role は RLS を bypass する)。

CREATE TABLE IF NOT EXISTS public.inquiries (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at       timestamptz NOT NULL DEFAULT now(),
  source           text NOT NULL DEFAULT 'hp_contact',
  submission       jsonb NOT NULL,
  estimate         jsonb NOT NULL,
  status           text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'replied', 'closed')),
  replied_at       timestamptz,
  notes            text
);

CREATE INDEX IF NOT EXISTS idx_inquiries_created_at ON public.inquiries(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inquiries_status ON public.inquiries(status);

ALTER TABLE public.inquiries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_select" ON public.inquiries
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "authenticated_update" ON public.inquiries
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
