-- Fix: check_streak returns (0,0) when not authenticated instead of raising
CREATE OR REPLACE FUNCTION public.check_streak()
RETURNS TABLE(out_current INTEGER, out_longest INTEGER)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = 'public'
AS $$
DECLARE
    v_user_id       UUID := auth.uid();
    v_today         DATE := CURRENT_DATE;
    v_yesterday     DATE := CURRENT_DATE - 1;
    v_last_visit    DATE;
    v_current_streak INTEGER;
    v_longest_streak INTEGER;
BEGIN
    IF v_user_id IS NULL THEN
        out_current := 0;
        out_longest := 0;
        RETURN NEXT;
        RETURN;
    END IF;

    INSERT INTO public.user_streaks (user_id, current_streak, longest_streak, last_visit_date)
    VALUES (v_user_id, 1, 1, v_today)
    ON CONFLICT (user_id) DO NOTHING;

    SELECT s.current_streak, s.longest_streak, s.last_visit_date
    INTO v_current_streak, v_longest_streak, v_last_visit
    FROM public.user_streaks s
    WHERE s.user_id = v_user_id;

    IF FOUND AND v_last_visit = v_today THEN
        out_current := v_current_streak;
        out_longest := v_longest_streak;
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
        RETURNING current_streak, longest_streak INTO v_current_streak, v_longest_streak;
    ELSE
        UPDATE public.user_streaks
        SET current_streak = 1,
            last_visit_date = v_today,
            updated_at = NOW()
        WHERE user_id = v_user_id
        RETURNING current_streak, longest_streak INTO v_current_streak, v_longest_streak;
    END IF;

    out_current := v_current_streak;
    out_longest := v_longest_streak;
    RETURN NEXT;
END;
$$;

SELECT '✅ check_streak fixed' AS status;
