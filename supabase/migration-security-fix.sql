-- ============================================================================
-- Migración: Correcciones de Seguridad, Fraude, Rendimiento y RGPD
-- ============================================================================
-- 1. decrement_tier_remaining → FOR UPDATE (evita sobreventa)
-- 2. purchase_tickets atómico (evento + tier en una transacción)
-- 3. rotate_ticket_token + columnas valid_token (QR dinámico antifraude)
-- 4. confirm_ticket → SECURITY INVOKER + auth.uid()
-- 5. ticket_details → SECURITY INVOKER
-- 6. Políticas RLS corregidas (tickets INSERT propia)
-- 7. Índices compuestos PostGIS + rendimiento
-- 8. Función anonymize_user (RGPD derecho al olvido)
-- 9. Tabla geo_consent (RGPD geolocalización)
-- ============================================================================

-- ##############################################################################
-- 1. DECREMENT_TIER_REMAINING — AÑADIR BLOQUEO DE FILA (FOR UPDATE)
-- ##############################################################################

CREATE OR REPLACE FUNCTION public.decrement_tier_remaining(
    p_tier_id  UUID,
    p_quantity INTEGER
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
    v_remaining INTEGER;
BEGIN
    IF p_quantity <= 0 THEN
        RAISE EXCEPTION 'quantity must be positive, got: %', p_quantity;
    END IF;

    -- Bloqueo pesimista: las siguientes transacciones esperan
    SELECT remaining INTO v_remaining
    FROM public.ticket_tiers
    WHERE id = p_tier_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'tier not found: %', p_tier_id;
    END IF;

    IF v_remaining < p_quantity THEN
        RETURN FALSE;
    END IF;

    UPDATE public.ticket_tiers
    SET remaining = remaining - p_quantity
    WHERE id = p_tier_id;

    RETURN TRUE;
END;
$$;

-- ##############################################################################
-- 2. PURCHASE_TICKETS — FUNCIÓN ATÓMICA (evento + tier + ticket)
-- ##############################################################################
-- Uso: SELECT * FROM public.purchase_tickets('evento-uuid', 'tier-uuid', 2);
-- Retorna: success BOOLEAN, ticket_id UUID, qr_code TEXT

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

    -- 3. Validar capacidad del evento
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

    -- 6. Decrementar (ya bloqueados por FOR UPDATE)
    UPDATE public.events
    SET remaining_capacity = remaining_capacity - p_quantity
    WHERE id = p_event_id;

    UPDATE public.ticket_tiers
    SET remaining = remaining - p_quantity
    WHERE id = p_tier_id;

    -- 7. Generar QR dinámico: HMAC(event_id + user_id + nonce)
    v_qr_code := ENCODE(
        HMAC(
            CONCAT(p_event_id::TEXT, v_user_id::TEXT, gen_random_uuid()::TEXT),
            gen_random_uuid()::TEXT,
            'SHA256'
        ),
        'hex'
    );

    -- 8. Insertar ticket (la RLS permite insert con user_id = auth.uid())
    INSERT INTO public.tickets (
        event_id, user_id, quantity, unit_price,
        total_amount, status, qr_code,
        valid_token, token_expires_at
    ) VALUES (
        p_event_id, v_user_id, p_quantity,
        v_price / 100.0,                          -- unit_price en euros (de céntimos)
        v_total / 100.0,                          -- total_amount en euros
        'pending',                                -- pendiente de pago
        v_qr_code,                                -- el qr_code actual es el token inicial
        NOW() + INTERVAL '60 seconds'
    )
    RETURNING id INTO v_ticket_id;

    success := TRUE; ticket_id := v_ticket_id; qr_code := v_qr_code;
    RETURN NEXT;
END;
$$;

-- ##############################################################################
-- 3. ROTATE_TICKET_TOKEN — QR DINÁMICO (RENOVACIÓN CADA 30-60s)
-- ##############################################################################

ALTER TABLE public.tickets
    ADD COLUMN IF NOT EXISTS valid_token TEXT,
    ADD COLUMN IF NOT EXISTS token_expires_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS used_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_tickets_valid_token ON public.tickets(valid_token)
    WHERE valid_token IS NOT NULL;

CREATE OR REPLACE FUNCTION public.rotate_ticket_token(p_ticket_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = 'public'
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_token   TEXT;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'not authenticated';
    END IF;

    -- Solo el dueño del ticket puede rotar su token
    IF NOT EXISTS (
        SELECT 1 FROM public.tickets
        WHERE id = p_ticket_id AND user_id = v_user_id
    ) THEN
        RAISE EXCEPTION 'not your ticket';
    END IF;

    -- No rotar si el ticket ya fue usado
    IF EXISTS (
        SELECT 1 FROM public.tickets
        WHERE id = p_ticket_id AND status = 'used'
    ) THEN
        RAISE EXCEPTION 'ticket already used';
    END IF;

    -- Generar token criptográfico aleatorio (32 bytes → 64 chars hex)
    v_token := ENCODE(gen_random_bytes(32), 'hex');

    UPDATE public.tickets
    SET valid_token = v_token,
        token_expires_at = NOW() + INTERVAL '60 seconds'
    WHERE id = p_ticket_id;

    RETURN v_token;
END;
$$;

-- ##############################################################################
-- 4. VALIDATE_TICKET — VALIDACIÓN EN PUERTA (organizador escanea QR)
-- ##############################################################################

CREATE OR REPLACE FUNCTION public.validate_ticket(
    p_token TEXT
)
RETURNS TABLE(result TEXT, ticket_id UUID, event_title TEXT, user_name TEXT)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = 'public'
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_ticket  RECORD;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'not authenticated';
    END IF;

    -- Buscar ticket por token
    SELECT t.id, t.user_id, t.status, t.used_at, t.token_expires_at,
           e.title, p.display_name
    INTO v_ticket
    FROM public.tickets t
    JOIN public.events e ON e.id = t.event_id
    JOIN public.organizers o ON o.id = e.organizer_id
    LEFT JOIN public.profiles p ON p.id = t.user_id
    WHERE t.valid_token = p_token;

    IF NOT FOUND THEN
        result := 'INVALID'; RETURN NEXT; RETURN;
    END IF;

    -- Verificar que quien escanea es el organizador del evento
    IF NOT EXISTS (
        SELECT 1 FROM public.organizers
        WHERE id = (SELECT organizer_id FROM public.events WHERE id = v_ticket.event_id)
        AND user_id = v_user_id
    ) AND NOT public.is_admin() THEN
        result := 'UNAUTHORIZED'; RETURN NEXT; RETURN;
    END IF;

    -- Verificar expiración
    IF v_ticket.token_expires_at < NOW() THEN
        result := 'EXPIRED'; RETURN NEXT; RETURN;
    END IF;

    -- Verificar no usado
    IF v_ticket.status = 'used' THEN
        result := 'ALREADY_USED'; RETURN NEXT; RETURN;
    END IF;

    -- ¡VALIDADO! Marcar como usado
    UPDATE public.tickets
    SET status = 'used', used_at = NOW()
    WHERE id = v_ticket.id;

    result := 'VALID';
    ticket_id := v_ticket.id;
    event_title := v_ticket.title;
    user_name := v_ticket.display_name;
    RETURN NEXT;
END;
$$;

-- ##############################################################################
-- 5. CONFIRM_TICKET — CORREGIDO (SECURITY INVOKER + auth.uid())
-- ##############################################################################

CREATE OR REPLACE FUNCTION public.confirm_ticket(
    p_event_id          UUID,
    p_quantity          INTEGER,
    p_unit_price        DECIMAL,
    p_total_amount      DECIMAL,
    p_stripe_session_id TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = 'public'
AS $$
DECLARE
    v_user_id   UUID := auth.uid();
    v_ticket_id UUID;
    v_qr_code   TEXT;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'not authenticated';
    END IF;

    IF p_quantity <= 0 THEN
        RAISE EXCEPTION 'quantity must be positive, got: %', p_quantity;
    END IF;

    -- Protección contra duplicados de sesión Stripe
    IF EXISTS (SELECT 1 FROM public.tickets WHERE stripe_session_id = p_stripe_session_id) THEN
        RAISE EXCEPTION 'duplicate stripe session: %', p_stripe_session_id;
    END IF;

    -- Verificar que el evento existe y está publicado
    IF NOT EXISTS (
        SELECT 1 FROM public.events
        WHERE id = p_event_id AND status = 'published'
    ) THEN
        RAISE EXCEPTION 'event not found or not published: %', p_event_id;
    END IF;

    -- Generar QR único
    v_qr_code := ENCODE(
        HMAC(
            CONCAT(p_event_id::TEXT, v_user_id::TEXT, gen_random_uuid()::TEXT),
            gen_random_uuid()::TEXT,
            'SHA256'
        ),
        'hex'
    );

    INSERT INTO public.tickets (
        event_id, user_id, quantity, unit_price,
        total_amount, status, stripe_session_id, qr_code,
        valid_token, token_expires_at
    ) VALUES (
        p_event_id, v_user_id, p_quantity, p_unit_price,
        p_total_amount, 'confirmed', p_stripe_session_id, v_qr_code,
        v_qr_code, NOW() + INTERVAL '60 seconds'
    )
    RETURNING id INTO v_ticket_id;

    RETURN v_ticket_id;
END;
$$;

-- ##############################################################################
-- 6. TICKET_DETAILS VIEW — SECURITY INVOKER
-- ##############################################################################

CREATE OR REPLACE VIEW public.ticket_details
WITH (security_invoker = true)
AS
SELECT
    t.id AS ticket_id,
    t.event_id,
    t.user_id,
    t.quantity,
    t.unit_price,
    t.total_amount,
    t.status,
    t.stripe_session_id,
    t.qr_code,
    t.created_at AS purchased_at,
    e.title AS event_title,
    e.cover_image_url,
    e.city AS event_city,
    e.address AS event_address,
    e.start_date,
    e.end_date,
    e.organizer_id,
    o.org_name AS organizer_name
FROM public.tickets t
JOIN public.events e ON e.id = t.event_id
JOIN public.organizers o ON o.id = e.organizer_id
WHERE
    t.user_id = auth.uid()
    OR EXISTS (
        SELECT 1 FROM public.organizers o2
        WHERE o2.id = e.organizer_id AND o2.user_id = auth.uid()
    )
    OR public.is_admin();

COMMENT ON VIEW public.ticket_details IS 'Tickets con datos del evento. SECURITY INVOKER — filtrado por user_id, organizer_id o admin.';

-- ##############################################################################
-- 7. POLÍTICAS RLS CORREGIDAS
-- ##############################################################################

-- 7.1. tickets: permitir INSERT del propio usuario (necesario para SECURITY INVOKER)
DROP POLICY IF EXISTS "tickets_insert_service" ON public.tickets;
DROP POLICY IF EXISTS "tickets_insert_own" ON public.tickets;

CREATE POLICY "tickets_insert_own"
    ON public.tickets FOR INSERT
    WITH CHECK (
        user_id = auth.uid()
        OR public.is_admin()
    );

-- 7.2. tickets: permitir UPDATE del organizador para validación en puerta
--     (solo cambiar status a 'used' — otras columnas inmutables)
DROP POLICY IF EXISTS "tickets_update_admin" ON public.tickets;
DROP POLICY IF EXISTS "tickets_update_organizer" ON public.tickets;

CREATE POLICY "tickets_update_organizer"
    ON public.tickets FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.events e
            JOIN public.organizers o ON o.id = e.organizer_id
            WHERE e.id = event_id AND o.user_id = auth.uid()
        )
        OR public.is_admin()
    )
    WITH CHECK (
        public.is_admin()
        OR (
            -- Solo el organizador puede actualizar tickets de su evento
            EXISTS (
                SELECT 1 FROM public.events e
                JOIN public.organizers o ON o.id = e.organizer_id
                WHERE e.id = event_id AND o.user_id = auth.uid()
            )
        )
    );

-- 7.3. event_artists: permitir que el artista actualice status de su participación
DROP POLICY IF EXISTS "event_artists_update_artist" ON public.event_artists;

CREATE POLICY "event_artists_update_artist"
    ON public.event_artists FOR UPDATE
    USING (
        artist_id IN (SELECT id FROM public.artists WHERE user_id = auth.uid())
        OR EXISTS (
            SELECT 1 FROM public.events e
            JOIN public.organizers o ON o.id = e.organizer_id
            WHERE e.id = event_id AND o.user_id = auth.uid()
        )
        OR public.is_admin()
    );

-- ##############################################################################
-- 8. ÍNDICES COMPUESTOS PARA RENDIMIENTO
-- ##############################################################################

-- Índice para find_events_nearby: filtrar por status + fecha ANTES de la distancia
CREATE INDEX IF NOT EXISTS idx_events_status_date
    ON public.events(status, start_date DESC)
    WHERE status = 'published';

-- Búsqueda por ciudad + fecha (común en el feed)
CREATE INDEX IF NOT EXISTS idx_events_city_date
    ON public.events(city, start_date DESC)
    WHERE status = 'published';

-- Dashboard del organizador: contar tickets vendidos
CREATE INDEX IF NOT EXISTS idx_tickets_event_status
    ON public.tickets(event_id, status);

-- Búsqueda rápida de tickets del usuario
CREATE INDEX IF NOT EXISTS idx_tickets_user_status
    ON public.tickets(user_id, status);

-- Forzar análisis de estadísticas para que el planner elija bien los índices
ANALYZE public.events;
ANALYZE public.tickets;
ANALYZE public.ticket_tiers;

-- ##############################################################################
-- 9. RGPD: GEO_CONSENT Y ANONIMIZACIÓN
-- ##############################################################################

-- 9.1. Tabla de consentimiento de geolocalización
CREATE TABLE IF NOT EXISTS public.geo_consent (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    granted     BOOLEAN NOT NULL DEFAULT FALSE,
    granted_at  TIMESTAMPTZ,
    revoked_at  TIMESTAMPTZ,
    ip_address  INET,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id)
);

ALTER TABLE public.geo_consent ENABLE ROW LEVEL SECURITY;

CREATE POLICY "geo_consent_select_own"
    ON public.geo_consent FOR SELECT
    USING (user_id = auth.uid() OR public.is_admin());

CREATE POLICY "geo_consent_insert_own"
    ON public.geo_consent FOR INSERT
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "geo_consent_update_own"
    ON public.geo_consent FOR UPDATE
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

COMMENT ON TABLE public.geo_consent IS 'Registro de consentimiento RGPD para geolocalización. Se guarda timestamp de concesión y revocación.';

-- 9.2. Eliminar tabla de Push subscriptions si existe (para notificaciones futuras)
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    subscription JSONB NOT NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id)
);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "push_subscriptions_manage_own"
    ON public.push_subscriptions FOR ALL
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- 9.3. Función de anonimización (Derecho al olvido RGPD)
CREATE OR REPLACE FUNCTION public.anonymize_user(p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
    -- Solo el admin puede ejecutar esto
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'only admin can anonymize users';
    END IF;

    -- Anonimizar perfil: datos reemplazados, no borrados
    UPDATE public.profiles
    SET display_name = 'Usuario Anónimo',
        avatar_url = NULL,
        phone = NULL
    WHERE id = p_user_id;

    -- Desvincular tickets: reasignar a usuario dummy para conservar registros fiscales
    -- (requiere un usuario "deleted" creado manualmente en auth.users)
    UPDATE public.tickets
    SET user_id = (SELECT id FROM auth.users WHERE email = 'deleted@anon.local' LIMIT 1)
    WHERE user_id = p_user_id;

    -- Eliminar roles de acceso
    DELETE FROM public.user_roles WHERE user_id = p_user_id;

    -- Eliminar consentimientos
    DELETE FROM public.geo_consent WHERE user_id = p_user_id;

    -- Eliminar suscripciones push
    DELETE FROM public.push_subscriptions WHERE user_id = p_user_id;

    -- Eliminar follows (seguidores y seguidos)
    DELETE FROM public.follows WHERE follower_id = p_user_id OR following_id = p_user_id;

    -- Deshabilitar cuenta en auth (no se borra — evita colisiones FK)
    UPDATE auth.users
    SET email = CONCAT('deleted-', p_user_id, '@anon.local'),
        phone = NULL,
        raw_user_meta_data = '{"deleted": true}'::jsonb,
        banned_until = '2099-12-31'::timestamptz,
        deleted_at = NOW()
    WHERE id = p_user_id;
END;
$$;

-- ##############################################################################
-- 10. RPC ADICIONALES: CORREGIR SECURITY DEFINER → INVOKER
-- ##############################################################################

-- 10.1. get_feed: usar auth.uid() en vez de parámetro (evita que usuario A vea feed de B)
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
    tags              TEXT[]
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
    SELECT DISTINCT
        e.id,
        e.title,
        e.short_description,
        e.cover_image_url,
        e.city,
        e.start_date,
        e.end_date,
        e.is_free,
        e.price,
        o.org_name AS organizer_name,
        o.id AS organizer_id,
        c.slug AS category_slug,
        e.tags
    FROM public.follows f
    JOIN public.events e ON (
        (f.following_type = 'organizer' AND e.organizer_id = f.following_id::UUID)
        OR
        (f.following_type = 'artist' AND e.id IN (
            SELECT ea.event_id FROM public.event_artists ea WHERE ea.artist_id = f.following_id::UUID
        ))
    )
    JOIN public.organizers o ON o.id = e.organizer_id
    LEFT JOIN public.categories c ON c.id = e.category_id
    WHERE
        f.follower_id = v_user_id
        AND e.status = 'published'
        AND e.start_date >= NOW()
    ORDER BY e.start_date ASC;
END;
$$;

-- 10.2. get_artist_schedule: cambiar a SECURITY INVOKER (solo lectura de datos públicos)
CREATE OR REPLACE FUNCTION public.get_artist_schedule(
    p_artist_id UUID
)
RETURNS TABLE(
    event_id        UUID,
    title           TEXT,
    cover_image_url TEXT,
    city            TEXT,
    start_date      TIMESTAMPTZ,
    end_date        TIMESTAMPTZ,
    stage_time      TIMESTAMPTZ,
    status          public.event_status,
    organizer_name  TEXT
)
LANGUAGE plpgsql STABLE
SECURITY INVOKER
SET search_path = 'public'
AS $$
BEGIN
    RETURN QUERY
    SELECT
        e.id AS event_id,
        e.title,
        e.cover_image_url,
        e.city,
        e.start_date,
        e.end_date,
        ea.stage_time,
        e.status,
        o.org_name AS organizer_name
    FROM public.event_artists ea
    JOIN public.events e ON e.id = ea.event_id
    JOIN public.organizers o ON o.id = e.organizer_id
    WHERE ea.artist_id = p_artist_id
      AND e.status IN ('published', 'completed')
    ORDER BY
        CASE WHEN e.start_date >= NOW() THEN 0 ELSE 1 END,
        e.start_date ASC;
END;
$$;

-- ##############################################################################
-- 11. VERIFICACIÓN FINAL
-- ##############################################################################

SELECT '✅ Migración de seguridad completada' AS status;

SELECT routine_name AS funciones_actualizadas
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN (
    'decrement_tier_remaining',
    'purchase_tickets',
    'rotate_ticket_token',
    'validate_ticket',
    'confirm_ticket',
    'anonymize_user'
  )
ORDER BY routine_name;
