-- Pega esto en Supabase Dashboard > SQL Editor
-- Añade filtros opcionales de categoría, ciudad y rango de fecha a find_events_nearby

CREATE OR REPLACE FUNCTION public.find_events_nearby(
    lat            DOUBLE PRECISION,
    lng            DOUBLE PRECISION,
    radius_km      DOUBLE PRECISION DEFAULT 25,
    p_category     TEXT DEFAULT NULL,
    p_city         TEXT DEFAULT NULL,
    p_date_from    TIMESTAMPTZ DEFAULT NULL,
    p_date_to      TIMESTAMPTZ DEFAULT NULL
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
    lat                DOUBLE PRECISION,
    lng                DOUBLE PRECISION,
    organizer_name     TEXT,
    category_name      TEXT,
    category_slug      TEXT,
    tags               TEXT[]
)
LANGUAGE plpgsql STABLE
SECURITY INVOKER
SET search_path = 'public, extensions'
AS $$
BEGIN
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
        ROUND((ST_Distance(e.location, ST_SetSRID(ST_MakePoint(lng, lat), 4326)::GEOGRAPHY) / 1000)::NUMERIC, 2)::DOUBLE PRECISION AS distance_km,
        ST_Y(e.location::GEOMETRY) AS lat,
        ST_X(e.location::GEOMETRY) AS lng,
        o.org_name AS organizer_name,
        c.name AS category_name,
        c.slug AS category_slug,
        e.tags
    FROM public.events e
    JOIN public.organizers o ON o.id = e.organizer_id
    LEFT JOIN public.categories c ON c.id = e.category_id
    WHERE
        e.status = 'published'
        AND ST_DWithin(e.location, ST_SetSRID(ST_MakePoint(lng, lat), 4326)::GEOGRAPHY, radius_km * 1000)
        AND e.start_date >= NOW()
        AND (p_category IS NULL OR c.slug = p_category)
        AND (p_city IS NULL OR LOWER(e.city) = LOWER(p_city))
        AND (p_date_from IS NULL OR e.start_date >= p_date_from)
        AND (p_date_to IS NULL OR e.start_date <= p_date_to)
    ORDER BY distance_km ASC;
END;
$$;
