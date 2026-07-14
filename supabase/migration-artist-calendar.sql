-- Pega esto en Supabase Dashboard > SQL Editor
-- Calendario de actuaciones para artistas

-- 1. Crear tabla de actuaciones independientes
CREATE TABLE IF NOT EXISTS public.artist_performances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  artist_id UUID NOT NULL REFERENCES public.artists(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  venue TEXT,
  city TEXT,
  performance_date DATE NOT NULL,
  performance_time TIME,
  is_public BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_artist_performances_artist_date
  ON public.artist_performances(artist_id, performance_date);

CREATE INDEX IF NOT EXISTS idx_artist_performances_public_date
  ON public.artist_performances(artist_id, performance_date)
  WHERE is_public = TRUE;

-- 2. RLS
ALTER TABLE public.artist_performances ENABLE ROW LEVEL SECURITY;

-- Artistas pueden CRUD sus propias actuaciones
CREATE POLICY "artist_performances_artist_manage"
  ON public.artist_performances
  FOR ALL
  TO authenticated
  USING (
    artist_id IN (SELECT id FROM public.artists WHERE user_id = auth.uid())
  )
  WITH CHECK (
    artist_id IN (SELECT id FROM public.artists WHERE user_id = auth.uid())
  );

-- Todos pueden ver actuaciones públicas
CREATE POLICY "artist_performances_public_select"
  ON public.artist_performances
  FOR SELECT
  TO public
  USING (is_public = TRUE);

-- 3. Trigger para updated_at
CREATE OR REPLACE FUNCTION public.update_artist_performances_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_artist_performances_updated_at ON public.artist_performances;
CREATE TRIGGER trg_artist_performances_updated_at
  BEFORE UPDATE ON public.artist_performances
  FOR EACH ROW
  EXECUTE FUNCTION public.update_artist_performances_updated_at();
