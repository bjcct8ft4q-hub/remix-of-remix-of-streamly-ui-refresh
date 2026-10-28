-- Streamly friend requests: apply in Supabase SQL editor before using Friends.
create table if not exists public.friend_requests (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references auth.users(id) on delete cascade,
  receiver_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','accepted','declined')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint no_self_friend_requests check (sender_id <> receiver_id),
  constraint unique_friend_direction unique(sender_id,receiver_id)
);
create index if not exists friend_requests_receiver on public.friend_requests(receiver_id,status);
create index if not exists friend_requests_sender on public.friend_requests(sender_id,status);
alter table public.friend_requests enable row level security;
create policy "Only participants read friend requests" on public.friend_requests
  for select to authenticated using (sender_id=auth.uid() or receiver_id=auth.uid());
create policy "Only sender creates pending request" on public.friend_requests
  for insert to authenticated with check (sender_id=auth.uid() and status='pending');
create policy "Receiver can respond to pending request" on public.friend_requests
  for update to authenticated using (receiver_id=auth.uid() and status='pending')
  with check (receiver_id=auth.uid() and status in ('accepted','declined'));
create policy "Participants may remove friend requests" on public.friend_requests
  for delete to authenticated using (sender_id=auth.uid() or receiver_id=auth.uid());
-- Public directory reveals only usernames and avatars; never expose account_credentials or email.
create or replace function public.search_streamly_users(search_text text)
returns table(id uuid, username text)
language sql stable security definer
set search_path = ''
as $$
  select p.id, p.username
  from public.profiles p
  where auth.uid() is not null
    and length(trim(search_text)) between 2 and 40
    and p.id <> auth.uid()
    and p.username ilike '%' || replace(replace(trim(search_text), '%', '\%'), '_', '\_') || '%' escape '\'
  order by p.username
  limit 20;
$$;
revoke all on function public.search_streamly_users(text) from public;
grant execute on function public.search_streamly_users(text) to authenticated;

-- Prevent recipients from changing either participant when responding.
create or replace function public.friend_request_immutable_participants()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.sender_id <> old.sender_id or new.receiver_id <> old.receiver_id then
    raise exception 'Friend request participants cannot change';
  end if;
  if old.status <> 'pending' and new.status <> old.status then
    raise exception 'Accepted or declined requests cannot be reopened';
  end if;
  return new;
end;
$$;
create trigger friend_request_participants_immutable
before update on public.friend_requests
for each row execute function public.friend_request_immutable_participants();
