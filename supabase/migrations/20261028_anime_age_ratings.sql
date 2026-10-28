-- Run in the connected Supabase SQL editor before enabling persisted age ratings.
create table if not exists public.anime_age_ratings (
  mal_id integer primary key check (mal_id > 0),
  rating text,
  source text not null default 'jikan' check (source in ('jikan','admin')),
  updated_at timestamptz not null default now()
);
create index if not exists anime_age_ratings_updated_at on public.anime_age_ratings(updated_at);
alter table public.anime_age_ratings enable row level security;
-- Only the server service-role client may read or write this table.
revoke all on public.anime_age_ratings from anon, authenticated;
