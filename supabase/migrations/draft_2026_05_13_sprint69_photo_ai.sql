-- Sprint 69: 写真AI×Supabase 永続化
-- photos テーブルに AI 分類結果カラムを追加
-- photo-classifier.ts の PhotoClassification 型に対応:
--   category (PhotoCategory), confidence (0-1), subcategory, tags[],
--   location, floor, room

alter table public.photos
  add column if not exists ai_category text,
  add column if not exists ai_confidence numeric(4, 3) check (ai_confidence is null or (ai_confidence >= 0 and ai_confidence <= 1)),
  add column if not exists ai_subcategory text,
  add column if not exists ai_tags jsonb not null default '[]'::jsonb,
  add column if not exists ai_location text,
  add column if not exists ai_floor integer,
  add column if not exists ai_room text;

-- 検索用インデックス（フィルタ用途を想定）
create index if not exists photos_ai_category_idx on public.photos (ai_category);
create index if not exists photos_ai_floor_idx on public.photos (ai_floor);

comment on column public.photos.ai_category is 'photo-classifier.ts PhotoCategory enum';
comment on column public.photos.ai_confidence is '0.0-1.0 AI分類信頼度';
comment on column public.photos.ai_tags is 'AI抽出タグ配列 (string[])';
