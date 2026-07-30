ALTER TABLE public.players ADD COLUMN IF NOT EXISTS avatar_svg text;
ALTER TABLE public.rooms ADD COLUMN IF NOT EXISTS room_theme text;