ALTER TABLE public.players
  ADD COLUMN IF NOT EXISTS client_id text,
  ADD COLUMN IF NOT EXISTS connection_status text NOT NULL DEFAULT 'connected',
  ADD COLUMN IF NOT EXISTS disconnected_at timestamptz;

CREATE INDEX IF NOT EXISTS players_room_client_idx ON public.players (room_id, client_id);