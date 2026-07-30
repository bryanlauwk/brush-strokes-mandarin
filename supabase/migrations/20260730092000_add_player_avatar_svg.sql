ALTER TABLE public.players
ADD COLUMN IF NOT EXISTS avatar_svg text;

ALTER TABLE public.players
DROP CONSTRAINT IF EXISTS players_avatar_svg_length;

ALTER TABLE public.players
ADD CONSTRAINT players_avatar_svg_length
CHECK (avatar_svg IS NULL OR char_length(avatar_svg) <= 5000);
