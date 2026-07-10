-- Pega esto en Supabase Dashboard > SQL Editor
-- Sistema de invitaciones para artistas

-- 1. Añadir columnas a event_artists
ALTER TABLE public.event_artists
    ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'accepted'
    CHECK (status IN ('pending', 'accepted', 'rejected')),
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- 2. Obtener invitaciones pendientes para un artista
CREATE OR REPLACE FUNCTION public.get_artist_invitations(p_artist_id UUID)
RETURNS TABLE(
    id          UUID,
    event_id    UUID,
    event_title TEXT,
    event_city  TEXT,
    start_date  TIMESTAMPTZ,
    stage_time  TIMESTAMPTZ,
    status      TEXT,
    organizer_name TEXT,
    created_at  TIMESTAMPTZ
)
LANGUAGE plpgsql STABLE
SECURITY INVOKER
SET search_path = 'public'
AS $$
BEGIN
    RETURN QUERY
    SELECT
        ea.id,
        e.id,
        e.title,
        e.city,
        e.start_date,
        ea.stage_time,
        ea.status,
        o.org_name,
        ea.created_at
    FROM public.event_artists ea
    JOIN public.events e ON e.id = ea.event_id
    JOIN public.organizers o ON o.id = e.organizer_id
    WHERE ea.artist_id = p_artist_id
      AND e.status = 'published'
    ORDER BY
        CASE WHEN ea.status = 'pending' THEN 0 ELSE 1 END,
        e.start_date ASC;
END;
$$;

-- 3. Responder a una invitación (aceptar/rechazar)
CREATE OR REPLACE FUNCTION public.respond_artist_invitation(
    p_invitation_id UUID,
    p_accept BOOLEAN
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = 'public'
AS $$
DECLARE
    v_artist_id UUID;
    v_user_id UUID := auth.uid();
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'not authenticated';
    END IF;

    -- Obtener el artist_id de la invitación
    SELECT ea.artist_id INTO v_artist_id
    FROM public.event_artists ea
    JOIN public.artists a ON a.id = ea.artist_id
    WHERE ea.id = p_invitation_id AND a.user_id = v_user_id;

    IF v_artist_id IS NULL THEN
        RAISE EXCEPTION 'invitation not found or not yours';
    END IF;

    UPDATE public.event_artists
    SET status = CASE WHEN p_accept THEN 'accepted' ELSE 'rejected' END
    WHERE id = p_invitation_id;

    RETURN CASE WHEN p_accept THEN 'accepted' ELSE 'rejected' END;
END;
$$;

-- 4. Actualizar get_artist_schedule a SECURITY INVOKER y filtrar solo accepted
DROP FUNCTION IF EXISTS public.get_artist_schedule(UUID);

CREATE OR REPLACE FUNCTION public.get_artist_schedule(p_artist_id UUID)
RETURNS TABLE(
    event_id        UUID,
    title           TEXT,
    cover_image_url TEXT,
    city            TEXT,
    start_date      TIMESTAMPTZ,
    end_date        TIMESTAMPTZ,
    stage_time      TIMESTAMPTZ,
    status          TEXT,
    organizer_name  TEXT
)
LANGUAGE plpgsql STABLE
SECURITY INVOKER
SET search_path = 'public'
AS $$
BEGIN
    RETURN QUERY
    SELECT
        e.id,
        e.title,
        e.cover_image_url,
        e.city,
        e.start_date,
        e.end_date,
        ea.stage_time,
        e.status::TEXT,
        o.org_name
    FROM public.event_artists ea
    JOIN public.events e ON e.id = ea.event_id
    JOIN public.organizers o ON o.id = e.organizer_id
    WHERE ea.artist_id = p_artist_id
      AND ea.status = 'accepted'
      AND e.status IN ('published', 'completed')
    ORDER BY
        CASE WHEN e.start_date >= NOW() THEN 0 ELSE 1 END,
        e.start_date ASC;
END;
$$;
