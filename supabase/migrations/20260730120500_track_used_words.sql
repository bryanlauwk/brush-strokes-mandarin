ALTER TABLE public.room_secrets
ADD COLUMN IF NOT EXISTS used_words jsonb NOT NULL DEFAULT '[]'::jsonb;

UPDATE public.room_secrets
SET used_words = '[]'::jsonb
WHERE used_words IS NULL;
