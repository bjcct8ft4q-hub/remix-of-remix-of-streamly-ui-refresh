-- Privacy-conscious aggregate page view counts; no IP addresses, cookies or user identifiers.
create table if not exists public.page_view_counts (
 day date not null default (now() at time zone 'utc')::date,
 path text not null check (length(path) between 1 and 160),
 views bigint not null default 0 check (views >= 0),
 primary key(day,path)
);
alter table public.page_view_counts enable row level security;
create or replace function public.record_page_view(page_path text) returns void
language plpgsql security definer set search_path = public as $$
declare clean_path text;
begin
 clean_path := left(split_part(coalesce(page_path,'/'), '?', 1),160);
 if clean_path !~ '^/[a-zA-Z0-9/_-]*$' then clean_path := '/other'; end if;
 insert into public.page_view_counts(day,path,views)
 values ((now() at time zone 'utc')::date, clean_path, 1)
 on conflict(day,path) do update set views = public.page_view_counts.views + 1;
end $$;
revoke all on function public.record_page_view(text) from public;
grant execute on function public.record_page_view(text) to anon, authenticated;
create policy "Admins can read aggregate analytics" on public.page_view_counts for select to authenticated
 using (exists(select 1 from public.user_roles ur where ur.user_id = auth.uid() and ur.role = 'admin'));
