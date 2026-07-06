-- Per-project custom text for the site-entry QR poster (rules/notices section).
-- Nullable, no backfill: existing rows stay NULL and the app falls back to
-- DEFAULT_SITE_ENTRY_NOTES (src/lib/site-entry-qr.ts) until a project owner
-- edits it via the "現場ルール/注意事項" textarea on the project detail page.
alter table public.projects
  add column if not exists site_entry_notes text;
