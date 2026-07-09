-- ============================================================================
-- Migración: Sistema de Entradas y Comisiones (MVP)
-- ============================================================================
-- 1. Añade campos bancarios a organizers
-- 2. Crea tabla ticket_tiers (tipos de entrada por evento)
-- 3. Políticas RLS para ticket_tiers
-- 4. RPC get_organizer_sales para histórico de ventas
-- ============================================================================

-- ############################################################################
-- 1. CAMPOS BANCARIOS
-- ############################################################################

ALTER TABLE public.organizers
  ADD COLUMN IF NOT EXISTS bank_holder        TEXT,
  ADD COLUMN IF NOT EXISTS bank_iban          TEXT,
  ADD COLUMN IF NOT EXISTS bank_swift         TEXT,
  ADD COLUMN IF NOT EXISTS onboarding_complete BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.organizers.bank_holder IS 'Nombre del titular de la cuenta';
COMMENT ON COLUMN public.organizers.bank_iban IS 'IBAN / número de cuenta';
COMMENT ON COLUMN public.organizers.bank_swift IS 'Código BIC/SWIFT';
COMMENT ON COLUMN public.organizers.onboarding_complete IS 'Indica si el organizador completó la config. bancaria';

-- ############################################################################
-- 2. TICKET TIERS (tipos de entrada por evento)
-- ############################################################################

CREATE TABLE IF NOT EXISTS public.ticket_tiers (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id    UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    price       DECIMAL(10,2) NOT NULL CHECK (price >= 0),
    quantity    INTEGER NOT NULL CHECK (quantity > 0),
    remaining   INTEGER NOT NULL CHECK (remaining >= 0),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ticket_tiers_event ON public.ticket_tiers(event_id);

-- Auto-set remaining = quantity al insertar
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

-- Cualquiera puede ver tiers de eventos publicados
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

-- El organizador puede crear tiers para sus eventos
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

-- El organizador puede actualizar tiers de sus eventos
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
-- 4. RPC: get_organizer_sales — histórico de ventas con comisiones
-- ############################################################################

CREATE OR REPLACE FUNCTION public.get_organizer_sales(p_organizer_id UUID)
RETURNS TABLE(
    event_id      UUID,
    event_title   TEXT,
    total_tickets BIGINT,
    gross_revenue DECIMAL(12,2),
    platform_fee  DECIMAL(12,2),
    net_revenue   DECIMAL(12,2),
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
        COALESCE(SUM(t.total_amount), 0)::DECIMAL(12,2) AS gross_revenue,
        ROUND(COALESCE(SUM(t.total_amount) * 0.07, 0), 2)::DECIMAL(12,2) AS platform_fee,
        ROUND(COALESCE(SUM(t.total_amount) * 0.93, 0), 2)::DECIMAL(12,2) AS net_revenue,
        e.currency
    FROM public.events e
    LEFT JOIN public.tickets t ON t.event_id = e.id AND t.status = 'confirmed'
    WHERE e.organizer_id = p_organizer_id
    GROUP BY e.id, e.title, e.currency
    ORDER BY MAX(e.start_date) DESC;
END;
$$;

-- ############################################################################
-- 5. Trigger: actualizar remaining_capacity en events al comprar ticket
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
