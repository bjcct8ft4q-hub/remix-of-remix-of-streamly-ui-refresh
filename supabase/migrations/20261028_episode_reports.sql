-- Apply in Supabase SQL Editor. Reports are private to administrators.
create table if not exists public.episode_reports (
 id uuid primary key default gen_random_uuid(),
 user_id uuid references auth.users(id) on delete set null,
 anime_id integer not null,
 anime_title text not null,
 episode integer not null,
 audio text not null check (audio in ('sub','dub')),
 provider text,
 category text not null check (category in ('wrong_episode','video_not_working','audio_issue','subtitle_issue','other')),
 details text not null default '' check (char_length(details) <= 2000),
 device_info text check (char_length(device_info) <= 350),
 status text not null default 'open' check (status in ('open','reviewing','resolved','dismissed')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists episode_reports_status_created_idx on public.episode_reports(status, created_at desc);
alter table public.episode_reports enable row level security;
create policy "Viewers submit episode reports" on public.episode_reports for insert to authenticated
 with check (user_id = auth.uid() and status = 'open');
create policy "Admins read episode reports" on public.episode_reports for select to authenticated
 using (exists (select 1 from public.user_roles ur where ur.user_id = auth.uid() and ur.role = 'admin'));
create policy "Admins update episode reports" on public.episode_reports for update to authenticated
 using (exists (select 1 from public.user_roles ur where ur.user_id = auth.uid() and ur.role = 'admin'))
 with check (exists (select 1 from public.user_roles ur where ur.user_id = auth.uid() and ur.role = 'admin'));
