-- ============================================================================
-- RedSocial-Eventos — Script de Inicialización de Supabase (MVP)
-- ============================================================================
-- Versión: 1.0.0
-- Descripción: Activa PostGIS, crea tablas, políticas RLS, funciones RPC
--              y triggers para el MVP de la plataforma de eventos locales.
-- Ejecutar en: Supabase SQL Editor (proyecto nuevo)
-- ============================================================================

-- ############################################################################
-- 1. EXTENSIONES
-- ############################################################################

CREATE EXTENSION IF NOT EXISTS "postgis";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";

-- ############################################################################
-- 2. TIPOS ENUMERADOS
-- ############################################################################

CREATE TYPE public.user_role AS ENUM (
    'user',
    'artist',
    'organizer',
    'admin'
);

CREATE TYPE public.event_status AS ENUM (
    'draft',
    'published',
    'cancelled',
    'completed'
);

CREATE TYPE public.ticket_status AS ENUM (
    'pending',
    'confirmed',
    'cancelled',
    'refunded'
);

CREATE TYPE public.organizer_type AS ENUM (
    'company',
    'municipality',
    'association'
);

-- ############################################################################
-- 3. FUNCIONES AUXILIARES (para RLS y triggers)
-- ############################################################################

-- 3.1. Trigger: actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

-- ############################################################################
-- 4. TABLAS
-- ############################################################################

-- 4.1. profiles — extensión de auth.users
CREATE TABLE public.profiles (
    id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    display_name    TEXT,
    avatar_url      TEXT,
    phone           TEXT,
    location        GEOGRAPHY(POINT, 4326),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trigger de actualización automática
CREATE TRIGGER trg_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

-- 4.2. user_roles — asignación de roles
CREATE TABLE public.user_roles (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role        public.user_role NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, role)
);

CREATE INDEX idx_user_roles_user_id ON public.user_roles(user_id);

-- 4.3. artists — perfil de artista/creador
CREATE TABLE public.artists (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
    stage_name    TEXT NOT NULL,
    bio           TEXT,
    genre         TEXT[],
    social_links  JSONB,
    website       TEXT,
    is_verified   BOOLEAN NOT NULL DEFAULT FALSE,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_artists_updated_at
    BEFORE UPDATE ON public.artists
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

-- 4.4. organizers — perfil de organizador
CREATE TABLE public.organizers (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
    org_name          TEXT NOT NULL,
    org_type          public.organizer_type NOT NULL,
    description       TEXT,
    address           TEXT,
    website           TEXT,
    tax_id            TEXT,
    is_approved       BOOLEAN NOT NULL DEFAULT FALSE,
    stripe_account_id TEXT,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_organizers_updated_at
    BEFORE UPDATE ON public.organizers
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

-- 4.5. categories — taxonomía de eventos
CREATE TABLE public.categories (
    id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name  TEXT NOT NULL UNIQUE,
    slug  TEXT NOT NULL UNIQUE,
    icon  TEXT,
    color TEXT
);

INSERT INTO public.categories (name, slug, icon, color) VALUES
    ('Concierto',       'concierto',       'music',     '#EF4444'),
    ('Teatro',          'teatro',          'mask',      '#8B5CF6'),
    ('Festival',        'festival',        'sparkles',  '#F59E0B'),
    ('Deportes',        'deportes',        'trophy',    '#10B981'),
    ('Arte',            'arte',            'palette',   '#EC4899'),
    ('Gastronomía',     'gastronomia',     'utensils',  '#F97316'),
    ('Feria',           'feria',           'ferris-wheel', '#06B6D4'),
    ('Taller',          'taller',          'book-open', '#6366F1'),
    ('Fiesta Popular',  'fiesta-popular',  'party-popper', '#14B8A6'),
    ('Cine',            'cine',            'clapperboard', '#A855F7');

-- 4.6. events — tabla principal de eventos
CREATE TABLE public.events (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organizer_id        UUID NOT NULL REFERENCES public.organizers(id) ON DELETE CASCADE,
    title               TEXT NOT NULL,
    description         TEXT,
    short_description   TEXT,
    cover_image_url     TEXT,
    category_id         UUID REFERENCES public.categories(id),
    location            GEOGRAPHY(POINT, 4326) NOT NULL,
    address             TEXT NOT NULL,
    city                TEXT NOT NULL,
    province            TEXT,
    country             TEXT NOT NULL DEFAULT 'España',
    start_date          TIMESTAMPTZ NOT NULL,
    end_date            TIMESTAMPTZ NOT NULL,
    status              public.event_status NOT NULL DEFAULT 'draft',
    max_capacity        INTEGER NOT NULL CHECK (max_capacity > 0),
    remaining_capacity  INTEGER NOT NULL CHECK (remaining_capacity >= 0),
    is_free             BOOLEAN NOT NULL DEFAULT TRUE,
    price               DECIMAL(10,2) CHECK (price >= 0),
    currency            TEXT NOT NULL DEFAULT 'EUR',
    stripe_price_id     TEXT,
    tags                TEXT[],
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT valid_dates CHECK (end_date > start_date),
    CONSTRAINT price_required_if_not_free CHECK (is_free = TRUE OR price IS NOT NULL)
);

-- Índices
CREATE INDEX idx_events_location ON public.events USING GIST (location);
CREATE INDEX idx_events_start_date ON public.events(start_date);
CREATE INDEX idx_events_status ON public.events(status);
CREATE INDEX idx_events_city ON public.events(city);
CREATE INDEX idx_events_organizer ON public.events(organizer_id);

-- Al crear un evento, remaining_capacity = max_capacity
CREATE OR REPLACE FUNCTION public.set_initial_capacity()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.remaining_capacity = NEW.max_capacity;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_events_initial_capacity
    BEFORE INSERT ON public.events
    FOR EACH ROW
    EXECUTE FUNCTION public.set_initial_capacity();

CREATE TRIGGER trg_events_updated_at
    BEFORE UPDATE ON public.events
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

-- 4.7. event_artists — relación eventos ↔ artistas
CREATE TABLE public.event_artists (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id    UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    artist_id   UUID NOT NULL REFERENCES public.artists(id) ON DELETE CASCADE,
    stage_time  TIMESTAMPTZ,
    UNIQUE(event_id, artist_id)
);

CREATE INDEX idx_event_artists_event ON public.event_artists(event_id);
CREATE INDEX idx_event_artists_artist ON public.event_artists(artist_id);

-- 4.8. tickets — entradas vendidas
CREATE TABLE public.tickets (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id            UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    quantity            INTEGER NOT NULL CHECK (quantity > 0),
    unit_price          DECIMAL(10,2) NOT NULL CHECK (unit_price >= 0),
    total_amount        DECIMAL(10,2) NOT NULL CHECK (total_amount >= 0),
    status              public.ticket_status NOT NULL DEFAULT 'pending',
    stripe_session_id   TEXT,
    qr_code             TEXT UNIQUE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tickets_event ON public.tickets(event_id);
CREATE INDEX idx_tickets_user ON public.tickets(user_id);
CREATE INDEX idx_tickets_status ON public.tickets(status);
CREATE INDEX idx_tickets_stripe_session ON public.tickets(stripe_session_id);

CREATE TRIGGER trg_tickets_updated_at
    BEFORE UPDATE ON public.tickets
    FOR EACH ROW
    EXECUTE FUNCTION public.set_updated_at();

-- 4.9. follows — sistema de seguidores
CREATE TABLE public.follows (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    follower_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    following_id    UUID NOT NULL,
    following_type  TEXT NOT NULL CHECK (following_type IN ('artist', 'organizer')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(follower_id, following_id, following_type)
);

CREATE INDEX idx_follows_follower ON public.follows(follower_id);
CREATE INDEX idx_follows_following ON public.follows(following_id, following_type);

-- ############################################################################
-- 5. FUNCIONES AUXILIARES Y TRIGGER DE REGISTRO
-- ############################################################################

-- 5.1. ¿el usuario actual es admin?
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1
        FROM public.user_roles
        WHERE user_id = auth.uid()
          AND role = 'admin'
    );
END;
$$;

-- 5.2. ¿el usuario actual tiene un rol concreto?
CREATE OR REPLACE FUNCTION public.has_role(p_role public.user_role)
RETURNS BOOLEAN
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1
        FROM public.user_roles
        WHERE user_id = auth.uid()
          AND role = p_role
    );
END;
$$;

-- 5.3. Crear perfil automáticamente al registrarse
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
    INSERT INTO public.profiles (id, display_name, avatar_url)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.email),
        NEW.raw_user_meta_data ->> 'avatar_url'
    );

    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'user');

    RETURN NEW;
END;
$$;

-- 5.4. Trigger: al registrarse, crear perfil y asignar rol básico
CREATE OR REPLACE TRIGGER trg_auth_on_signup
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- ############################################################################
-- 6. POLÍTICAS DE SEGURIDAD (ROW LEVEL SECURITY)
-- ############################################################################

-- 6.0. Habilitar RLS en todas las tablas públicas
ALTER TABLE public.profiles      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.artists       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizers    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_artists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tickets       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.follows       ENABLE ROW LEVEL SECURITY;

-- ==========================================================================
-- 6.1. profiles
-- ==========================================================================
CREATE POLICY "profiles_select_authenticated"
    ON public.profiles FOR SELECT
    USING (auth.role() = 'authenticated');

CREATE POLICY "profiles_insert_own"
    ON public.profiles FOR INSERT
    WITH CHECK (id = auth.uid());

CREATE POLICY "profiles_update_own"
    ON public.profiles FOR UPDATE
    USING (id = auth.uid() OR public.is_admin())
    WITH CHECK (id = auth.uid() OR public.is_admin());

CREATE POLICY "profiles_delete_admin"
    ON public.profiles FOR DELETE
    USING (public.is_admin());

-- ==========================================================================
-- 6.2. user_roles
-- ==========================================================================
CREATE POLICY "user_roles_select_own"
    ON public.user_roles FOR SELECT
    USING (user_id = auth.uid() OR public.is_admin());

CREATE POLICY "user_roles_insert_admin"
    ON public.user_roles FOR INSERT
    WITH CHECK (public.is_admin());

CREATE POLICY "user_roles_delete_admin"
    ON public.user_roles FOR DELETE
    USING (public.is_admin());

-- ==========================================================================
-- 6.3. artists
-- ==========================================================================
CREATE POLICY "artists_select_public"
    ON public.artists FOR SELECT
    USING (TRUE);

CREATE POLICY "artists_insert_own"
    ON public.artists FOR INSERT
    WITH CHECK (
        user_id = auth.uid()
        AND public.has_role('artist')
    );

CREATE POLICY "artists_update_own"
    ON public.artists FOR UPDATE
    USING (user_id = auth.uid() OR public.is_admin())
    WITH CHECK (user_id = auth.uid() OR public.is_admin());

CREATE POLICY "artists_delete_admin"
    ON public.artists FOR DELETE
    USING (public.is_admin());

-- ==========================================================================
-- 6.4. organizers
-- ==========================================================================
CREATE POLICY "organizers_select_approved"
    ON public.organizers FOR SELECT
    USING (is_approved = TRUE OR user_id = auth.uid() OR public.is_admin());

CREATE POLICY "organizers_insert_own"
    ON public.organizers FOR INSERT
    WITH CHECK (
        user_id = auth.uid()
        AND public.has_role('organizer')
    );

CREATE POLICY "organizers_update_own"
    ON public.organizers FOR UPDATE
    USING (user_id = auth.uid() OR public.is_admin())
    WITH CHECK (user_id = auth.uid() OR public.is_admin());

CREATE POLICY "organizers_delete_admin"
    ON public.organizers FOR DELETE
    USING (public.is_admin());

-- ==========================================================================
-- 6.5. categories
-- ==========================================================================
CREATE POLICY "categories_select_public"
    ON public.categories FOR SELECT
    USING (TRUE);

CREATE POLICY "categories_insert_admin"
    ON public.categories FOR INSERT
    WITH CHECK (public.is_admin());

CREATE POLICY "categories_update_admin"
    ON public.categories FOR UPDATE
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

CREATE POLICY "categories_delete_admin"
    ON public.categories FOR DELETE
    USING (public.is_admin());

-- ==========================================================================
-- 6.6. events
-- ==========================================================================
CREATE POLICY "events_select_published"
    ON public.events FOR SELECT
    USING (
        status IN ('published', 'completed')
        OR organizer_id IN (
            SELECT id FROM public.organizers WHERE user_id = auth.uid()
        )
        OR public.is_admin()
    );

CREATE POLICY "events_insert_own"
    ON public.events FOR INSERT
    WITH CHECK (
        organizer_id IN (
            SELECT id FROM public.organizers WHERE user_id = auth.uid()
        )
        OR public.is_admin()
    );

CREATE POLICY "events_update_own"
    ON public.events FOR UPDATE
    USING (
        organizer_id IN (
            SELECT id FROM public.organizers WHERE user_id = auth.uid()
        )
        OR public.is_admin()
    )
    WITH CHECK (
        organizer_id IN (
            SELECT id FROM public.organizers WHERE user_id = auth.uid()
        )
        OR public.is_admin()
    );

CREATE POLICY "events_delete_own"
    ON public.events FOR DELETE
    USING (
        organizer_id IN (
            SELECT id FROM public.organizers WHERE user_id = auth.uid()
        )
        OR public.is_admin()
    );

-- ==========================================================================
-- 6.7. event_artists
-- ==========================================================================
CREATE POLICY "event_artists_select_public"
    ON public.event_artists FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.events e
            WHERE e.id = event_id
              AND (e.status IN ('published', 'completed')
                   OR e.organizer_id IN (
                       SELECT id FROM public.organizers WHERE user_id = auth.uid()
                   )
                   OR public.is_admin())
        )
    );

CREATE POLICY "event_artists_insert_own"
    ON public.event_artists FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.events e
            JOIN public.organizers o ON o.id = e.organizer_id
            WHERE e.id = event_id
              AND (o.user_id = auth.uid() OR public.is_admin())
        )
    );

CREATE POLICY "event_artists_update_own"
    ON public.event_artists FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.events e
            JOIN public.organizers o ON o.id = e.organizer_id
            WHERE e.id = event_id
              AND (o.user_id = auth.uid() OR public.is_admin())
        )
    );

CREATE POLICY "event_artists_delete_own"
    ON public.event_artists FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.events e
            JOIN public.organizers o ON o.id = e.organizer_id
            WHERE e.id = event_id
              AND (o.user_id = auth.uid() OR public.is_admin())
        )
    );

-- ==========================================================================
-- 6.8. tickets
-- ==========================================================================
CREATE POLICY "tickets_select_own"
    ON public.tickets FOR SELECT
    USING (
        user_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM public.events e
            JOIN public.organizers o ON o.id = e.organizer_id
            WHERE e.id = event_id
              AND (o.user_id = auth.uid() OR public.is_admin())
        )
    );

CREATE POLICY "tickets_insert_service"
    ON public.tickets FOR INSERT
    WITH CHECK (
        -- Solo administradores o funciones SECURITY DEFINER pueden insertar
        public.is_admin()
        -- En producción, esto lo hace la Edge Function con service_role
    );

CREATE POLICY "tickets_update_admin"
    ON public.tickets FOR UPDATE
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- ==========================================================================
-- 6.9. follows
-- ==========================================================================
CREATE POLICY "follows_select_authenticated"
    ON public.follows FOR SELECT
    USING (auth.role() = 'authenticated');

CREATE POLICY "follows_insert_own"
    ON public.follows FOR INSERT
    WITH CHECK (follower_id = auth.uid());

CREATE POLICY "follows_delete_own"
    ON public.follows FOR DELETE
    USING (follower_id = auth.uid());

-- ############################################################################
-- 7. FUNCIONES RPC (Remote Procedure Calls)
-- ############################################################################

-- Aseguramos que el tipo GEOGRAPHY (PostGIS) sea visible durante la creación
SET search_path TO public, extensions;

-- ==========================================================================
-- 7.1. find_events_nearby — búsqueda geolocalizada por radio
-- ==========================================================================
CREATE OR REPLACE FUNCTION public.find_events_nearby(
    lat       DOUBLE PRECISION,
    lng       DOUBLE PRECISION,
    radius_km DOUBLE PRECISION DEFAULT 25
)
RETURNS TABLE(
    id                 UUID,
    title              TEXT,
    short_description  TEXT,
    cover_image_url    TEXT,
    city               TEXT,
    province           TEXT,
    start_date         TIMESTAMPTZ,
    end_date           TIMESTAMPTZ,
    is_free            BOOLEAN,
    price              DECIMAL(10,2),
    currency           TEXT,
    max_capacity       INTEGER,
    remaining_capacity INTEGER,
    distance_km        DOUBLE PRECISION,
    organizer_name     TEXT,
    category_name      TEXT,
    category_slug      TEXT,
    tags               TEXT[]
)
LANGUAGE plpgsql STABLE
SECURITY DEFINER
SET search_path = 'public, extensions'
AS $$
DECLARE
    origin GEOGRAPHY;
BEGIN
    -- Validación de parámetros
    IF lat < -90 OR lat > 90 THEN
        RAISE EXCEPTION 'invalid latitude value: %', lat
            USING HINT = 'Latitude must be between -90 and 90';
    END IF;

    IF lng < -180 OR lng > 180 THEN
        RAISE EXCEPTION 'invalid longitude value: %', lng
            USING HINT = 'Longitude must be between -180 and 180';
    END IF;

    IF radius_km <= 0 THEN
        RAISE EXCEPTION 'radius must be positive, got: %', radius_km
            USING HINT = 'Provide a radius greater than 0';
    END IF;

    origin := ST_SetSRID(ST_MakePoint(lng, lat), 4326)::GEOGRAPHY;

    RETURN QUERY
    SELECT
        e.id,
        e.title,
        e.short_description,
        e.cover_image_url,
        e.city,
        e.province,
        e.start_date,
        e.end_date,
        e.is_free,
        e.price,
        e.currency,
        e.max_capacity,
        e.remaining_capacity,
        ROUND((ST_Distance(e.location, origin) / 1000)::NUMERIC, 2)::DOUBLE PRECISION AS distance_km,
        o.org_name AS organizer_name,
        c.name AS category_name,
        c.slug AS category_slug,
        e.tags
    FROM public.events e
    JOIN public.organizers o ON o.id = e.organizer_id
    LEFT JOIN public.categories c ON c.id = e.category_id
    WHERE
        e.status = 'published'
        AND ST_DWithin(e.location, origin, radius_km * 1000)
        AND e.start_date >= NOW()
    ORDER BY distance_km ASC;
END;
$$;

-- ==========================================================================
-- 7.2. get_feed — feed de eventos de cuentas seguidas
-- ==========================================================================
CREATE OR REPLACE FUNCTION public.get_feed(
    p_user_id UUID
)
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
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
    IF p_user_id IS NULL THEN
        RAISE EXCEPTION 'user_id is required';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_user_id) THEN
        RAISE EXCEPTION 'user not found: %', p_user_id;
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
        f.follower_id = p_user_id
        AND e.status = 'published'
        AND e.start_date >= NOW()
    ORDER BY e.start_date ASC;
END;
$$;

-- ==========================================================================
-- 7.3. reserve_capacity — reserva atómica de aforo (transaccional)
-- ==========================================================================
CREATE OR REPLACE FUNCTION public.reserve_capacity(
    p_event_id UUID,
    p_quantity INTEGER
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
    v_event public.events%ROWTYPE;
BEGIN
    IF p_quantity <= 0 THEN
        RAISE EXCEPTION 'quantity must be positive, got: %', p_quantity;
    END IF;

    -- Bloqueo pesimista de la fila para evitar race conditions
    SELECT * INTO v_event
    FROM public.events
    WHERE id = p_event_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'event not found: %', p_event_id;
    END IF;

    IF v_event.status != 'published' THEN
        RAISE EXCEPTION 'event is not published, current status: %', v_event.status;
    END IF;

    IF v_event.remaining_capacity < p_quantity THEN
        RETURN FALSE;
    END IF;

    UPDATE public.events
    SET remaining_capacity = remaining_capacity - p_quantity
    WHERE id = p_event_id;

    RETURN TRUE;
END;
$$;

-- ==========================================================================
-- 7.4. confirm_ticket — confirma la compra tras pago exitoso
-- ==========================================================================
CREATE OR REPLACE FUNCTION public.confirm_ticket(
    p_event_id          UUID,
    p_user_id           UUID,
    p_quantity          INTEGER,
    p_unit_price        DECIMAL,
    p_total_amount      DECIMAL,
    p_stripe_session_id TEXT
)
RETURNS UUID  -- ID del ticket creado
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
    v_ticket_id UUID;
    v_qr_code   TEXT;
BEGIN
    -- Verificar que la sesión de Stripe no esté duplicada
    IF EXISTS (SELECT 1 FROM public.tickets WHERE stripe_session_id = p_stripe_session_id) THEN
        RAISE EXCEPTION 'duplicate stripe session: %', p_stripe_session_id;
    END IF;

    -- Verificar que el evento existe
    IF NOT EXISTS (SELECT 1 FROM public.events WHERE id = p_event_id) THEN
        RAISE EXCEPTION 'event not found: %', p_event_id;
    END IF;

    -- Generar QR único: SHA-256 de event_id + user_id + random UUID
    v_qr_code := ENCODE(
        HMAC(
            CONCAT(p_event_id::TEXT, p_user_id::TEXT, gen_random_uuid()::TEXT),
            gen_random_uuid()::TEXT,
            'SHA256'
        ),
        'hex'
    );

    INSERT INTO public.tickets (
        event_id, user_id, quantity, unit_price,
        total_amount, status, stripe_session_id, qr_code
    ) VALUES (
        p_event_id, p_user_id, p_quantity, p_unit_price,
        p_total_amount, 'confirmed', p_stripe_session_id, v_qr_code
    )
    RETURNING id INTO v_ticket_id;

    RETURN v_ticket_id;
END;
$$;

-- ==========================================================================
-- 7.5. get_artist_schedule — itinerario de un artista
-- ==========================================================================
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
SECURITY DEFINER
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
        CASE WHEN e.start_date >= NOW() THEN 0 ELSE 1 END,  -- futuros primero
        e.start_date ASC;
END;
$$;

-- ==========================================================================
-- 7.6. get_event_tickets_organizer — entradas vendidas (solo organizador)
-- ==========================================================================
CREATE OR REPLACE FUNCTION public.get_event_tickets_organizer(
    p_event_id          UUID,
    p_organizer_user_id UUID
)
RETURNS TABLE(
    ticket_id    UUID,
    user_id      UUID,
    user_name    TEXT,
    quantity     INTEGER,
    total_amount DECIMAL,
    status       public.ticket_status,
    qr_code      TEXT,
    purchased_at TIMESTAMPTZ
)
LANGUAGE plpgsql STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
    -- Verificar que el usuario es el organizador del evento o admin
    IF NOT (
        EXISTS (
            SELECT 1 FROM public.events e
            JOIN public.organizers o ON o.id = e.organizer_id
            WHERE e.id = p_event_id AND o.user_id = p_organizer_user_id
        )
        OR public.is_admin()
    ) THEN
        RAISE EXCEPTION 'not authorized to view tickets for this event';
    END IF;

    RETURN QUERY
    SELECT
        t.id AS ticket_id,
        t.user_id,
        p.display_name AS user_name,
        t.quantity,
        t.total_amount,
        t.status,
        t.qr_code,
        t.created_at AS purchased_at
    FROM public.tickets t
    LEFT JOIN public.profiles p ON p.id = t.user_id
    WHERE t.event_id = p_event_id
    ORDER BY t.created_at DESC;
END;
$$;

-- ############################################################################
-- 8. ÍNDICES ADICIONALES Y AJUSTES
-- ############################################################################

-- Índice para búsqueda de texto completo (títulos y descripciones)
CREATE INDEX idx_events_fulltext ON public.events
    USING GIN (to_tsvector('spanish', COALESCE(title, '') || ' ' || COALESCE(short_description, '')));

-- Función de búsqueda por texto (opcional, descomentar si se necesita)
-- CREATE OR REPLACE FUNCTION public.search_events(p_query TEXT)
-- RETURNS SETOF public.events
-- LANGUAGE sql STABLE
-- SECURITY DEFINER
-- SET search_path = 'public'
-- AS $$
--     SELECT *
--     FROM public.events
--     WHERE
--         status = 'published'
--         AND to_tsvector('spanish', COALESCE(title, '') || ' ' || COALESCE(short_description, ''))
--             @@ plainto_tsquery('spanish', p_query)
--     ORDER BY start_date ASC;
-- $$;

-- ############################################################################
-- 9. VERIFICACIÓN FINAL
-- ############################################################################

-- Mostrar resumen de tablas creadas
SELECT '✅ Instalación completada' AS status;

SELECT table_name, table_type
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_type = 'BASE TABLE'
ORDER BY table_name;

SELECT routine_name AS rpc_functions
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_type = 'FUNCTION'
ORDER BY routine_name;
