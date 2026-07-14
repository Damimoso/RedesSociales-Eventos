-- Fix: check_streak returns (0,0) when not authenticated instead of raising
CREATE OR REPLACE FUNCTION public.check_streak()
RETURNS TABLE(current_streak INTEGER, longest_streak INTEGER)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = 'public'
AS $$
DECLARE
    v_user_id    UUID := auth.uid();
    v_today      DATE := CURRENT_DATE;
    v_yesterday  DATE := CURRENT_DATE - 1;
    v_last_visit DATE;
    r record;
BEGIN
    IF v_user_id IS NULL THEN
        current_streak := 0;
        longest_streak := 0;
        RETURN NEXT;
        RETURN;
    END IF;

    INSERT INTO public.user_streaks (user_id, current_streak, longest_streak, last_visit_date)
    VALUES (v_user_id, 1, 1, v_today)
    ON CONFLICT (user_id) DO NOTHING;

    SELECT s.current_streak, s.longest_streak, s.last_visit_date
    INTO current_streak, longest_streak, v_last_visit
    FROM public.user_streaks s
    WHERE user_id = v_user_id;

    IF FOUND AND v_last_visit = v_today THEN
        RETURN NEXT;
        RETURN;
    END IF;

    IF FOUND AND v_last_visit = v_yesterday THEN
        UPDATE public.user_streaks
        SET current_streak = current_streak + 1,
            longest_streak = GREATEST(longest_streak, current_streak + 1),
            last_visit_date = v_today,
            updated_at = NOW()
        WHERE user_id = v_user_id
        RETURNING current_streak, longest_streak INTO current_streak, longest_streak;
    ELSE
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

SELECT '✅ check_streak fixed' AS status;
