DROP POLICY IF EXISTS rooms_public_read ON public.rooms;
DROP POLICY IF EXISTS players_public_read ON public.players;
DROP POLICY IF EXISTS guesses_public_read ON public.guesses;
DROP POLICY IF EXISTS strokes_public_read ON public.strokes;

REVOKE SELECT ON public.rooms FROM anon, authenticated;
REVOKE SELECT ON public.players FROM anon, authenticated;
REVOKE SELECT ON public.guesses FROM anon, authenticated;
REVOKE SELECT ON public.strokes FROM anon, authenticated;

GRANT ALL ON public.rooms TO service_role;
GRANT ALL ON public.players TO service_role;
GRANT ALL ON public.guesses TO service_role;
GRANT ALL ON public.strokes TO service_role;
GRANT ALL ON public.room_secrets TO service_role;
GRANT ALL ON public.player_tokens TO service_role;

ALTER TABLE public.player_tokens ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS player_tokens_no_client_access ON public.player_tokens;
CREATE POLICY player_tokens_no_client_access
  ON public.player_tokens
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);
REVOKE ALL ON public.player_tokens FROM anon, authenticated;
REVOKE ALL ON public.room_secrets FROM anon, authenticated;