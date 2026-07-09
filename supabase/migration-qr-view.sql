-- ==========================================================================
-- Vista: ticket_details — tickets + info del evento para el comprador
-- Solo expone qr_code al dueño del ticket o al organizador del evento.
-- ==========================================================================

CREATE OR REPLACE VIEW public.ticket_details AS
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
    -- El comprador ve sus propios tickets
    t.user_id = auth.uid()
    -- El organizador ve tickets de sus eventos
    OR EXISTS (
        SELECT 1 FROM public.organizers o2
        WHERE o2.id = e.organizer_id AND o2.user_id = auth.uid()
    )
    -- El admin ve todo
    OR public.is_admin();

-- Aseguramos que el acceso a la vista pase por RLS (la WHERE clause filtra)
COMMENT ON VIEW public.ticket_details IS 'Tickets con datos del evento. Filtrado automático por user_id, organizer_id o admin.';
