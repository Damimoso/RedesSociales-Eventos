-- ============================================================================
-- Migración: Sistema de Entradas + Stripe Connect + Comisiones
-- ============================================================================
-- 1. Ticket tiers con price_cents (INTEGER, operaciones en céntimos)
-- 2. Stripe Connect: onboarding_complete en organizers
-- 3. RLS para ticket_tiers
-- 4. RPC get_organizer_sales
-- 5. Trigger: decrementar remaining de event + tier al comprar
-- ============================================================================

-- ############################################################################
-- 1. STRIPE CONNECT — campo para tracking del onboarding
-- ############################################################################

ALTER TABLE public.organizers
  ADD COLUMN IF NOT EXISTS stripe_onboarding_complete BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.organizers.stripe_onboarding_complete
  IS 'Indica si el organizador completó el onboarding de Stripe Connect';

-- ############################################################################
-- 2. TICKET TIERS — tipos de entrada por evento (precio en CÉNTIMOS)
-- ############################################################################

CREATE TABLE IF NOT EXISTS public.ticket_tiers (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id    UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
    quantity    INTEGER NOT NULL CHECK (quantity > 0),
    remaining   INTEGER NOT NULL CHECK (remaining >= 0),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ticket_tiers_event ON public.ticket_tiers(event_id);

-- Auto-set remaining = quantity
CREATE OR REPLACE FUNCTION public.set_tier_remaining()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.remaining = NEW.quantity;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ticket_tiers_remaining ON public.ticket_tiers;
CREATE TRIGGER trg_ticket_tiers_remaining
    BEFORE INSERT ON public.ticket_tiers
    FOR EACH ROW
    EXECUTE FUNCTION public.set_tier_remaining();

-- ############################################################################
-- 3. RLS para TICKET TIERS
-- ############################################################################

ALTER TABLE public.ticket_tiers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ticket_tiers_select_public"
    ON public.ticket_tiers FOR SELECT
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

CREATE POLICY "ticket_tiers_insert_own"
    ON public.ticket_tiers FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.events e
            JOIN public.organizers o ON o.id = e.organizer_id
            WHERE e.id = event_id
              AND (o.user_id = auth.uid() OR public.is_admin())
        )
    );

CREATE POLICY "ticket_tiers_update_own"
    ON public.ticket_tiers FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.events e
            JOIN public.organizers o ON o.id = e.organizer_id
            WHERE e.id = event_id
              AND (o.user_id = auth.uid() OR public.is_admin())
        )
    );

-- ############################################################################
-- 4. RPC: get_organizer_sales — histórico con comisión 7%
--           TODO: usar price_cents de ticket_tiers + total_amount en cents
-- ############################################################################

CREATE OR REPLACE FUNCTION public.get_organizer_sales(p_organizer_id UUID)
RETURNS TABLE(
    event_id      UUID,
    event_title   TEXT,
    total_tickets BIGINT,
    gross_cents   BIGINT,
    fee_cents     BIGINT,
    net_cents     BIGINT,
    currency      TEXT
)
LANGUAGE plpgsql
SET search_path = 'public, extensions'
AS $$
BEGIN
    RETURN QUERY
    SELECT
        e.id,
        e.title,
        COUNT(t.id)::BIGINT AS total_tickets,
        COALESCE(SUM(t.total_amount * 100)::BIGINT, 0) AS gross_cents,
        ROUND(COALESCE(SUM(t.total_amount * 100) * 0.07, 0))::BIGINT AS fee_cents,
        ROUND(COALESCE(SUM(t.total_amount * 100) * 0.93, 0))::BIGINT AS net_cents,
        e.currency
    FROM public.events e
    LEFT JOIN public.tickets t ON t.event_id = e.id AND t.status = 'confirmed'
    WHERE e.organizer_id = p_organizer_id
    GROUP BY e.id, e.title, e.currency
    ORDER BY MAX(e.start_date) DESC;
END;
$$;

-- ############################################################################
-- 5. Trigger: decrementar remaining_capacity + tier.remaining al comprar
-- ############################################################################

CREATE OR REPLACE FUNCTION public.decrement_event_capacity()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = 'public, extensions'
AS $$
BEGIN
    UPDATE public.events
    SET remaining_capacity = remaining_capacity - NEW.quantity
    WHERE id = NEW.event_id;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_tickets_decrement_capacity ON public.tickets;
CREATE TRIGGER trg_tickets_decrement_capacity
    AFTER INSERT ON public.tickets
    FOR EACH ROW
    EXECUTE FUNCTION public.decrement_event_capacity();

-- ############################################################################
-- 6. RPC: decrementar remaining de un ticket_tier tras compra
-- ############################################################################

CREATE OR REPLACE FUNCTION public.decrement_tier_remaining(
    p_tier_id  UUID,
    p_quantity INTEGER
)
RETURNS VOID
LANGUAGE plpgsql
SET search_path = 'public, extensions'
AS $$
BEGIN
    UPDATE public.ticket_tiers
    SET remaining = remaining - p_quantity
    WHERE id = p_tier_id;
END;
$$;
