-- Apply after review. Keep the newest active room per host/episode/audio.
-- Older duplicate rooms are ended, not deleted, preserving their chat history.
with ranked as (
 select id, row_number() over (
   partition by host_id,anime_id,episode,audio
   order by created_at desc,id desc
 ) as position
 from public.watch_rooms where status in ('waiting','live')
)
update public.watch_rooms r set status='ended',is_playing=false,updated_at=now()
from ranked where ranked.id=r.id and ranked.position>1;

-- Prevent two simultaneous W2G clicks/tabs from creating duplicate active rooms.
create unique index if not exists watch_rooms_one_active_per_episode
on public.watch_rooms(host_id,anime_id,episode,audio)
where status in ('waiting','live');
