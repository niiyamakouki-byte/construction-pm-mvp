-- 票 laporta-beads-79ere / Codex
-- 協力業者依頼と署名付き回答を notifications に保存する。
alter table public.notifications
  drop constraint if exists notifications_type_check;

alter table public.notifications
  add constraint notifications_type_check
  check (type in ('schedule_confirmed', 'schedule_changed', 'reminder', 'alert', 'contractor_request'));

alter table public.notifications
  drop constraint if exists notifications_status_check;

alter table public.notifications
  add constraint notifications_status_check
  check (status in ('pending', 'sent', 'failed', 'accepted', 'rejected'));
