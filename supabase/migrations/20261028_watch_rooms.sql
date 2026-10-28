-- Run this migration in the connected Supabase project before enabling Watch Together.
create table if not exists public.watch_rooms (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references auth.users(id) on delete cascade,
  host_name text not null,
  anime_id integer not null,
  anime_title text not null,
  anime_cover text,
  episode integer not null check (episode > 0),
  audio text not null default 'sub' check (audio in ('sub','dub')),
  status text not null default 'waiting' check (status in ('waiting','live','ended')),
  is_public boolean not null default true,
  playback_seconds double precision not null default 0,
  is_playing boolean not null default false,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create table if not exists public.watch_room_messages (
  id bigint generated always as identity primary key,
  room_id uuid not null references public.watch_rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  username text not null,
  body text not null check (char_length(body) between 1 and 500),
  created_at timestamptz not null default now()
);
create index if not exists watch_rooms_status_created on public.watch_rooms(status,created_at desc);
create index if not exists watch_room_messages_room on public.watch_room_messages(room_id,created_at);
alter table public.watch_rooms enable row level security;
alter table public.watch_room_messages enable row level security;
create policy "Authenticated users see public rooms and own rooms" on public.watch_rooms for select to authenticated using (is_public or host_id = auth.uid());
create policy "Users create own rooms" on public.watch_rooms for insert to authenticated with check (host_id = auth.uid());
create policy "Hosts control their rooms" on public.watch_rooms for update to authenticated using (host_id = auth.uid()) with check (host_id = auth.uid());
create policy "Hosts remove rooms" on public.watch_rooms for delete to authenticated using (host_id = auth.uid());
create policy "Authenticated users read public room chat" on public.watch_room_messages for select to authenticated using (exists (select 1 from public.watch_rooms r where r.id=room_id and (r.is_public or r.host_id=auth.uid())));
create policy "Users send their own chat messages" on public.watch_room_messages for insert to authenticated with check (user_id=auth.uid() and exists (select 1 from public.watch_rooms r where r.id=room_id and r.status <> 'ended' and (r.is_public or r.host_id=auth.uid())));
alter publication supabase_realtime add table public.watch_rooms;
alter publication supabase_realtime add table public.watch_room_messages;
