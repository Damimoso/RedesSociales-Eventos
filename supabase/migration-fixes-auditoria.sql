-- ============================================================================
-- Fixes de auditoría: is_approved, double-decrement, tests
-- ============================================================================

-- 1. Eventos: solo organizadores aprobados pueden publicar
-- La policy existente solo verifica que el organizador le pertenezca al user,
-- pero no que esté aprobado. Corregimos la WITH CHECK.
DROP POLICY IF EXISTS "events_insert_own" ON public.events;
CREATE POLICY "events_insert_own"
    ON public.events FOR INSERT
    WITH CHECK (
        organizer_id IN (
            SELECT id FROM public.organizers
            WHERE user_id = auth.uid() AND is_approved = TRUE
        )
        OR public.is_admin()
    );

-- 2. purchase_tickets: eliminar UPDATE duplicado de remaining_capacity
-- El trigger trg_tickets_decrement_capacity ya decrementa remaining_capacity
-- al INSERTAR en tickets. purchase_tickets lo hacía explícitamente ANTES del
-- INSERT, causando DOBLE decremento.
CREATE OR REPLACE FUNCTION public.purchase_tickets(
    p_event_id UUID,
    p_tier_id  UUID,
    p_quantity INTEGER
)
RETURNS TABLE(success BOOLEAN, ticket_id UUID, qr_code TEXT)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = 'public'
AS $$
DECLARE
    v_user_id   UUID := auth.uid();
    v_ticket_id UUID;
    v_qr_code   TEXT;
    v_price     INTEGER;
    v_total     INTEGER;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'not authenticated';
    END IF;

    IF p_quantity <= 0 THEN
        RAISE EXCEPTION 'quantity must be positive';
    END IF;

    -- 1. Bloquear evento + tier simultáneamente (orden fijo para evitar deadlock)
    PERFORM 1 FROM public.events WHERE id = p_event_id FOR UPDATE;
    PERFORM 1 FROM public.ticket_tiers WHERE id = p_tier_id FOR UPDATE;

    -- 2. Validar estados
    IF (SELECT status FROM public.events WHERE id = p_event_id) != 'published' THEN
        success := FALSE; ticket_id := NULL; qr_code := 'event not published'; RETURN NEXT; RETURN;
    END IF;

    -- 3. Validar capacidad del evento (el trigger la decrementará tras INSERT)
    IF (SELECT remaining_capacity FROM public.events WHERE id = p_event_id) < p_quantity THEN
        success := FALSE; ticket_id := NULL; qr_code := 'event sold out'; RETURN NEXT; RETURN;
    END IF;

    -- 4. Validar stock del tier
    IF (SELECT remaining FROM public.ticket_tiers WHERE id = p_tier_id) < p_quantity THEN
        success := FALSE; ticket_id := NULL; qr_code := 'tier sold out'; RETURN NEXT; RETURN;
    END IF;

    -- 5. Obtener precio en céntimos
    v_price := (SELECT price_cents FROM public.ticket_tiers WHERE id = p_tier_id);
    v_total := v_price * p_quantity;

    -- 6. Decrementar tier (ya bloqueado por FOR UPDATE)
    UPDATE public.ticket_tiers
    SET remaining = remaining - p_quantity
    WHERE id = p_tier_id;

    -- 7. Generar QR dinámico
    v_qr_code := ENCODE(
        HMAC(
            CONCAT(p_event_id::TEXT, v_user_id::TEXT, gen_random_uuid()::TEXT),
            gen_random_uuid()::TEXT,
            'SHA256'
        ),
        'hex'
    );

    -- 8. Insertar ticket (el trigger trg_tickets_decrement_capacity
    --    decrementará events.remaining_capacity automáticamente)
    INSERT INTO public.tickets (
        event_id, user_id, quantity, unit_price,
        total_amount, status, qr_code,
        valid_token, token_expires_at
    ) VALUES (
        p_event_id, v_user_id, p_quantity,
        v_price / 100.0,
        v_total / 100.0,
        'pending',
        v_qr_code,
        NOW() + INTERVAL '60 seconds'
    )
    RETURNING id INTO v_ticket_id;

    success := TRUE; ticket_id := v_ticket_id; qr_code := v_qr_code;
    RETURN NEXT;
END;
$$;

-- 3. GET_FEED: actualizar para incluir también follows de tipo 'user' y
--    actividad social reciente (amigos comprando tickets, confirmando asistencia)
CREATE OR REPLACE FUNCTION public.get_feed()
RETURNS TABLE(
    id                UUID,
    title             TEXT,
    short_description TEXT,
    cover_image_url   TEXT,
    city              TEXT,
    start_date        TIMESTAMPTZ,
    end_date          TIMESTAMPTZ,
    is_free           BOOLEAN,
    price             DECIMAL(10,2),
    organizer_name    TEXT,
    organizer_id      UUID,
    category_slug     TEXT,
    tags              TEXT[],
    feed_type         TEXT,
    friend_name       TEXT
)
LANGUAGE plpgsql STABLE
SECURITY INVOKER
SET search_path = 'public'
AS $$
DECLARE
    v_user_id UUID := auth.uid();
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'not authenticated';
    END IF;

    RETURN QUERY
    -- Eventos de organizadores/artistas seguidos
    SELECT DISTINCT
        e.id, e.title, e.short_description, e.cover_image_url,
        e.city, e.start_date, e.end_date, e.is_free,
        e.price, o.org_name, o.id, c.slug, e.tags,
        'evento_seguido'::TEXT, NULL::TEXT
    FROM public.follows f
    JOIN public.events e ON (
        (f.following_type = 'organizer' AND e.organizer_id = f.following_id::UUID)
        OR
        (f.following_type = 'artist' AND e.id IN (
            SELECT ea.event_id FROM public.event_artists ea WHERE ea.artist_id = f.following_id::UUID
        ))
        OR
        (f.following_type = 'user' AND e.organizer_id IN (
            SELECT o2.id FROM public.organizers o2 WHERE o2.user_id = f.following_id::UUID
        ))
    )
    JOIN public.organizers o ON o.id = e.organizer_id
    LEFT JOIN public.categories c ON c.id = e.category_id
    WHERE
        f.follower_id = v_user_id
        AND e.status = 'published'
        AND e.start_date >= NOW()

    UNION ALL

    -- Amigos que han comprado tickets (actividad social)
    SELECT DISTINCT
        e.id, e.title, e.short_description, e.cover_image_url,
        e.city, e.start_date, e.end_date, e.is_free,
        e.price, o.org_name, o.id, c.slug, e.tags,
        'amigo_asiste'::TEXT, p.display_name
    FROM public.friendships fs
    JOIN public.tickets t ON t.user_id = CASE WHEN fs.requester_id = v_user_id THEN fs.addressee_id ELSE fs.requester_id END
    JOIN public.events e ON e.id = t.event_id
    JOIN public.organizers o ON o.id = e.organizer_id
    LEFT JOIN public.categories c ON c.id = e.category_id
    LEFT JOIN public.profiles p ON p.id = CASE WHEN fs.requester_id = v_user_id THEN fs.addressee_id ELSE fs.requester_id END
    WHERE
        (fs.requester_id = v_user_id OR fs.addressee_id = v_user_id)
        AND fs.status = 'accepted'
        AND t.status IN ('confirmed', 'pending')
        AND e.status = 'published'
        AND e.start_date >= NOW()

    ORDER BY start_date ASC;
END;
$$;

SELECT '✅ Fixes de auditoría aplicados' AS status;
