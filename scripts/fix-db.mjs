import pkg from 'pg'
const { Pool } = pkg

const pool = new Pool({
  host: 'db.ntkrsjwpxfubsayxqezd.supabase.co',
  port: 5432,
  database: 'postgres',
  user: 'postgres',
  password: 'Escondite-3',
  ssl: { rejectUnauthorized: false },
})

const SQL = `

-- ============================================================
-- 1. DROP funciones viejas con firmas incorrectas
-- ============================================================
DROP FUNCTION IF EXISTS public.find_events_nearby(lat DOUBLE PRECISION, lng DOUBLE PRECISION, radius_km DOUBLE PRECISION);

-- ============================================================
-- 2. find_events_nearby — con filtros + SECURITY DEFINER
-- ============================================================
CREATE OR REPLACE FUNCTION public.find_events_nearby(
    p_lat          DOUBLE PRECISION,
    p_lng          DOUBLE PRECISION,
    radius_km      DOUBLE PRECISION DEFAULT 25,
    p_category     TEXT DEFAULT NULL,
    p_city         TEXT DEFAULT NULL,
    p_date_from    TIMESTAMPTZ DEFAULT NULL,
    p_date_to      TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE(id UUID, title TEXT, short_description TEXT, cover_image_url TEXT,
    city TEXT, province TEXT, start_date TIMESTAMPTZ, end_date TIMESTAMPTZ,
    is_free BOOLEAN, price DECIMAL(10,2), currency TEXT,
    max_capacity INTEGER, remaining_capacity INTEGER,
    distance_km DOUBLE PRECISION, lat DOUBLE PRECISION, lng DOUBLE PRECISION,
    organizer_name TEXT, category_name TEXT, category_slug TEXT, tags TEXT[])
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = 'public, extensions' AS $$
BEGIN
    IF p_lat < -90 OR p_lat > 90 THEN
        RAISE EXCEPTION 'invalid latitude value: %', p_lat USING HINT = 'Latitude must be between -90 and 90';
    END IF;
    IF p_lng < -180 OR p_lng > 180 THEN
        RAISE EXCEPTION 'invalid longitude value: %', p_lng USING HINT = 'Longitude must be between -180 and 180';
    END IF;
    IF radius_km <= 0 THEN
        RAISE EXCEPTION 'radius must be positive, got: %', radius_km USING HINT = 'Provide a radius greater than 0';
    END IF;
    RETURN QUERY
    SELECT e.id, e.title, e.short_description, e.cover_image_url, e.city, e.province,
           e.start_date, e.end_date, e.is_free, e.price, e.currency, e.max_capacity, e.remaining_capacity,
           ROUND((ST_Distance(e.location, ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::GEOGRAPHY) / 1000)::NUMERIC, 2)::DOUBLE PRECISION AS distance_km,
           ST_Y(e.location::GEOMETRY) AS lat, ST_X(e.location::GEOMETRY) AS lng,
           o.org_name AS organizer_name, c.name AS category_name, c.slug AS category_slug, e.tags
    FROM public.events e
    JOIN public.organizers o ON o.id = e.organizer_id
    LEFT JOIN public.categories c ON c.id = e.category_id
    WHERE e.status = 'published'
      AND ST_DWithin(e.location, ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::GEOGRAPHY, radius_km * 1000)
      AND e.start_date >= NOW()
      AND (p_category IS NULL OR c.slug = p_category)
      AND (p_city IS NULL OR LOWER(e.city) = LOWER(p_city))
      AND (p_date_from IS NULL OR e.start_date >= p_date_from)
      AND (p_date_to IS NULL OR e.start_date <= p_date_to)
    ORDER BY distance_km ASC;
END;
$$;

-- ============================================================
-- 3. get_artist_invitations — SECURITY DEFINER (no necesita auth)
-- ============================================================
DROP FUNCTION IF EXISTS public.get_artist_invitations(UUID);
CREATE OR REPLACE FUNCTION public.get_artist_invitations(p_artist_id UUID)
RETURNS TABLE(id UUID, event_id UUID, event_title TEXT, event_city TEXT,
    start_date TIMESTAMPTZ, stage_time TIMESTAMPTZ, status TEXT,
    organizer_name TEXT, created_at TIMESTAMPTZ)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = 'public' AS $$
BEGIN
    RETURN QUERY
    SELECT ea.id, e.id, e.title, e.city, e.start_date, ea.stage_time,
           ea.status, o.org_name, ea.created_at
    FROM public.event_artists ea
    JOIN public.events e ON e.id = ea.event_id
    JOIN public.organizers o ON o.id = e.organizer_id
    WHERE ea.artist_id = p_artist_id AND e.status = 'published'
    ORDER BY CASE WHEN ea.status = 'pending' THEN 0 ELSE 1 END, e.start_date ASC;
END;
$$;

-- ============================================================
-- 4. get_artist_schedule — SECURITY DEFINER
-- ============================================================
DROP FUNCTION IF EXISTS public.get_artist_schedule(UUID);
CREATE OR REPLACE FUNCTION public.get_artist_schedule(p_artist_id UUID)
RETURNS TABLE(event_id UUID, title TEXT, cover_image_url TEXT, city TEXT,
    start_date TIMESTAMPTZ, end_date TIMESTAMPTZ, stage_time TIMESTAMPTZ,
    status TEXT, organizer_name TEXT)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = 'public' AS $$
BEGIN
    RETURN QUERY
    SELECT e.id, e.title, e.cover_image_url, e.city, e.start_date, e.end_date,
           ea.stage_time, e.status::TEXT, o.org_name
    FROM public.event_artists ea
    JOIN public.events e ON e.id = ea.event_id
    JOIN public.organizers o ON o.id = e.organizer_id
    WHERE ea.artist_id = p_artist_id AND ea.status = 'accepted'
      AND e.status IN ('published', 'completed')
    ORDER BY CASE WHEN e.start_date >= NOW() THEN 0 ELSE 1 END, e.start_date ASC;
END;
$$;

-- ============================================================
-- 5. respond_artist_invitation — SECURITY INVOKER (necesita auth.uid())
-- ============================================================
DROP FUNCTION IF EXISTS public.respond_artist_invitation(UUID, BOOLEAN);
CREATE OR REPLACE FUNCTION public.respond_artist_invitation(
    p_invitation_id UUID, p_accept BOOLEAN)
RETURNS TEXT LANGUAGE plpgsql SECURITY INVOKER SET search_path = 'public' AS $$
DECLARE v_artist_id UUID; v_user_id UUID := auth.uid();
BEGIN
    IF v_user_id IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
    SELECT ea.artist_id INTO v_artist_id
    FROM public.event_artists ea
    JOIN public.artists a ON a.id = ea.artist_id
    WHERE ea.id = p_invitation_id AND a.user_id = v_user_id;
    IF v_artist_id IS NULL THEN RAISE EXCEPTION 'invitation not found or not yours'; END IF;
    UPDATE public.event_artists
    SET status = CASE WHEN p_accept THEN 'accepted' ELSE 'rejected' END
    WHERE id = p_invitation_id;
    RETURN CASE WHEN p_accept THEN 'accepted' ELSE 'rejected' END;
END;
$$;

-- ============================================================
-- 6. Verificación
-- ============================================================
SELECT '✅ Fix complete' AS status;

`

async function main() {
  const client = await pool.connect()
  try {
    console.log('🔌 Connected to DB. Executing fixes...')
    await client.query(SQL)
    console.log('✅ All fixes applied successfully')
  } catch (err) {
    console.error('❌ Error:', err.message)
    process.exit(1)
  } finally {
    client.release()
    await pool.end()
  }
}

main()
