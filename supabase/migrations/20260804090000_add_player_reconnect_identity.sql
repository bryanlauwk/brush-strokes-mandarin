-- Stable browser identity plus a reconnect grace period.
alter table public.players
  add column if not exists client_id uuid,
  add column if not exists connection_status text not null default 'connected',
  add column if not exists disconnected_at timestamptz;

alter table public.players
  drop constraint if exists players_connection_status_check;

alter table public.players
  add constraint players_connection_status_check
  check (connection_status in ('connected', 'disconnected'));

update public.players
set connection_status = 'connected'
where connection_status is null;

create unique index if not exists players_room_client_id_unique
  on public.players (room_id, client_id)
  where client_id is not null;

create index if not exists players_presence_cleanup_idx
  on public.players (room_id, connection_status, last_seen, disconnected_at);
