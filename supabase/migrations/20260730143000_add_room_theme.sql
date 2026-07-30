ALTER TABLE public.rooms
ADD COLUMN IF NOT EXISTS room_theme text NOT NULL DEFAULT '全部主题';

UPDATE public.rooms
SET room_theme = '全部主题'
WHERE room_theme IS NULL;
