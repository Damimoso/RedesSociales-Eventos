-- ============================================================================
-- Gamificación: Rachas (Streaks) + Logros (Achievements)
-- ============================================================================

-- 1. Rachas diarias
CREATE TABLE IF NOT EXISTS public.user_streaks (
    user_id         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    current_streak  INTEGER NOT NULL DEFAULT 0,
    longest_streak  INTEGER NOT NULL DEFAULT 0,
    last_visit_date DATE NOT NULL DEFAULT CURRENT_DATE,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.user_streaks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "streaks_select_own"
    ON public.user_streaks FOR SELECT
    USING (user_id = auth.uid() OR public.is_admin());

CREATE POLICY "streaks_upsert_own"
    ON public.user_streaks FOR INSERT
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "streaks_update_own"
    ON public.user_streaks FOR UPDATE
    USING (user_id = auth.uid());

-- RPC: check_streak — actualiza racha al abrir la app
-- Llámala cada vez que el usuario abre la app (onMount de Home)
CREATE OR REPLACE FUNCTION public.check_streak()
RETURNS TABLE(current_streak INTEGER, longest_streak INTEGER)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = 'public'
AS $$
DECLARE
    v_user_id   UUID := auth.uid();
    v_today     DATE := CURRENT_DATE;
    v_yesterday DATE := CURRENT_DATE - 1;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'not authenticated';
    END IF;

    -- Insertar si no existe
    INSERT INTO public.user_streaks (user_id, current_streak, longest_streak, last_visit_date)
    VALUES (v_user_id, 1, 1, v_today)
    ON CONFLICT (user_id) DO NOTHING;

    -- Leer estado actual
    SELECT s.current_streak, s.longest_streak, s.last_visit_date
    INTO current_streak, longest_streak
    FROM public.user_streaks
    WHERE user_id = v_user_id;

    -- Si ya visitó hoy, no hacer nada
    IF FOUND AND last_visit_date = v_today THEN
        RETURN NEXT;
        RETURN;
    END IF;

    -- Si visitó ayer, incrementar racha
    IF FOUND AND last_visit_date = v_yesterday THEN
        UPDATE public.user_streaks
        SET current_streak = current_streak + 1,
            longest_streak = GREATEST(longest_streak, current_streak + 1),
            last_visit_date = v_today,
            updated_at = NOW()
        WHERE user_id = v_user_id
        RETURNING current_streak, longest_streak INTO current_streak, longest_streak;
    ELSE
        -- Si no visitó ayer, reiniciar racha
        UPDATE public.user_streaks
        SET current_streak = 1,
            last_visit_date = v_today,
            updated_at = NOW()
        WHERE user_id = v_user_id
        RETURNING current_streak, longest_streak INTO current_streak, longest_streak;
    END IF;

    RETURN NEXT;
END;
$$;

-- 2. Logros
CREATE TABLE IF NOT EXISTS public.user_achievements (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    achievement_key TEXT NOT NULL,
    unlocked_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, achievement_key)
);

ALTER TABLE public.user_achievements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "achievements_select_own"
    ON public.user_achievements FOR SELECT
    USING (user_id = auth.uid() OR public.is_admin());

CREATE POLICY "achievements_insert_own"
    ON public.user_achievements FOR INSERT
    WITH CHECK (user_id = auth.uid());

-- RPC: unlock_achievement — desbloquear un logro
CREATE OR REPLACE FUNCTION public.unlock_achievement(p_key TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = 'public'
AS $$
DECLARE
    v_user_id UUID := auth.uid();
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'not authenticated';
    END IF;

    INSERT INTO public.user_achievements (user_id, achievement_key)
    VALUES (v_user_id, p_key)
    ON CONFLICT (user_id, achievement_key) DO NOTHING;

    RETURN FOUND;
END;
$$;

-- RPC: get_achievements — lista de logros del usuario
CREATE OR REPLACE FUNCTION public.get_achievements()
RETURNS TABLE(achievement_key TEXT, unlocked_at TIMESTAMPTZ)
LANGUAGE plpgsql STABLE
SECURITY INVOKER
SET search_path = 'public'
AS $$
BEGIN
    RETURN QUERY
    SELECT ua.achievement_key, ua.unlocked_at
    FROM public.user_achievements ua
    WHERE ua.user_id = auth.uid()
    ORDER BY ua.unlocked_at DESC;
END;
$$;

SELECT '✅ Gamificación lista' AS status;
