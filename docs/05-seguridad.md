# Tomo 5: Seguridad

## 5.1 Resumen de Auditoría

Se realizó una auditoría de seguridad exhaustiva en 5 ejes:

| Eje | Hallazgos | Severidad |
|-----|-----------|-----------|
| **RLS** | Políticas faltantes, SECURITY DEFINER sin supervisión | 🔴 Alta |
| **Race Conditions** | `decrement_tier_remaining` sin bloqueo, `purchase_tickets` no atómico | 🔴 Alta |
| **PostGIS** | Sin índices, `find_events_nearby` con seq scan | 🟡 Media |
| **RGPD** | Sin consentimiento de ubicación, sin anonimización | 🟡 Media |
| **PWA** | Service worker cachea datos sensibles | 🟢 Baja |

## 5.2 RLS (Row Level Security)

### Principios aplicados

1. **Mínimo privilegio:** Cada tabla tiene políticas específicas para SELECT, INSERT, UPDATE y DELETE
2. **SECURITY INVOKER vs DEFINER:** Las funciones de solo consulta (`get_feed`, `get_artist_schedule`, `find_events_nearby`, `validate_ticket`) usan `SECURITY INVOKER` para que hereden los permisos del usuario autenticado
3. **auth.uid()** vs parámetros: Las funciones seguras obtienen el usuario de `auth.uid()` en lugar de aceptarlo como parámetro (evita suplantación)

### Políticas por Tabla

```sql
-- tickets: solo INSERT del propio usuario
CREATE POLICY "tickets_insert_own" ON public.tickets FOR INSERT
  WITH CHECK (user_id = auth.uid() OR is_admin());

-- tickets: UPDATE solo del organizador del evento
CREATE POLICY "tickets_update_organizer" ON public.tickets FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM events e
      JOIN organizers o ON o.id = e.organizer_id
      WHERE e.id = event_id AND o.user_id = auth.uid())
    OR is_admin()
  );

-- events: SELECT filtra por status + organizador
CREATE POLICY "events_select_public" ON public.events FOR SELECT
  USING (
    status IN ('published', 'completed')
    OR organizer_id IN (SELECT id FROM organizers WHERE user_id = auth.uid())
    OR is_admin()
  );
```

### Función is_admin()

```sql
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  );
$$;
```

## 5.3 Race Conditions

### Problema Original
Cuando dos usuarios compran la última entrada simultáneamente, ambos podían leer `remaining > 0` y ejecutar la compra, resultando en sobreventa (overselling).

### Solución: Bloqueo Pesimista (FOR UPDATE)

```sql
CREATE OR REPLACE FUNCTION public.decrement_tier_remaining(
    p_tier_id UUID, p_quantity INTEGER
)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE v_remaining INTEGER;
BEGIN
    -- Bloqueo pesimista: esta fila queda bloqueada
    -- hasta que termine la transacción
    SELECT remaining INTO v_remaining
    FROM public.ticket_tiers
    WHERE id = p_tier_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'tier not found: %', p_tier_id;
    END IF;

    IF v_remaining < p_quantity THEN
        RETURN FALSE;  -- No hay stock, no lanza error
    END IF;

    UPDATE public.ticket_tiers
    SET remaining = remaining - p_quantity
    WHERE id = p_tier_id;

    RETURN TRUE;
END;
$$;
```

**¿Cómo funciona?**
1. `SELECT ... FOR UPDATE` bloquea la fila del tier
2. Si otra transacción intenta leer la misma fila, espera
3. Se verifica `remaining` después de adquirir el bloqueo
4. Se decrementa dentro de la misma transacción
5. La fila se desbloquea al hacer COMMIT o ROLLBACK

### Función purchase_tickets (Atómica)

```sql
CREATE OR REPLACE FUNCTION public.purchase_tickets(
    p_event_id UUID, p_tier_id UUID, p_quantity INTEGER,
    p_unit_price DECIMAL, p_total_amount DECIMAL,
    p_stripe_session_id TEXT
)
RETURNS UUID  -- retorna el ID del ticket creado
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE v_ticket_id UUID;
BEGIN
    -- Decrementar stock (con FOR UPDATE)
    IF NOT public.decrement_tier_remaining(p_tier_id, p_quantity) THEN
        RAISE EXCEPTION 'No hay suficientes entradas disponibles';
    END IF;

    -- Crear ticket
    INSERT INTO public.tickets
        (event_id, user_id, quantity, unit_price,
         total_amount, status, stripe_session_id)
    VALUES
        (p_event_id, auth.uid(), p_quantity, p_unit_price,
         p_total_amount, 'confirmed', p_stripe_session_id)
    RETURNING id INTO v_ticket_id;

    RETURN v_ticket_id;
END;
$$;
```

## 5.4 Índices PostGIS

Para evitar escaneos secuenciales en consultas geoespaciales:

```sql
-- Índice espacial (PostGIS GIST)
CREATE INDEX idx_events_location ON public.events USING GIST (location);

-- Índice compuesto: status + fecha (filtra antes de ordenar por distancia)
CREATE INDEX IF NOT EXISTS idx_events_status_date
    ON public.events(status, start_date DESC)
    WHERE status = 'published';

-- Búsqueda por ciudad + fecha
CREATE INDEX IF NOT EXISTS idx_events_city_date
    ON public.events(city, start_date DESC)
    WHERE status = 'published';

-- Dashboard del organizador: tickets por evento
CREATE INDEX IF NOT EXISTS idx_tickets_event_status
    ON public.tickets(event_id, status);

-- Tickets del usuario
CREATE INDEX IF NOT EXISTS idx_tickets_user_status
    ON public.tickets(user_id, status);

-- Búsqueda por token QR
CREATE INDEX IF NOT EXISTS idx_tickets_valid_token
    ON public.tickets(valid_token);
```

## 5.5 RGPD

### Consentimiento de Geolocalización

```sql
CREATE TABLE public.geo_consent (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    granted     BOOLEAN NOT NULL DEFAULT FALSE,
    granted_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at  TIMESTAMPTZ,
    ip_address  INET,
    user_agent  TEXT
);
```

- RLS: solo el propio usuario puede ver/modificar su consentimiento
- `expires_at` permite renovación periódica del consentimiento
- Se registra IP y user-agent para auditoría

### Anonimización de Usuario

```sql
CREATE OR REPLACE FUNCTION public.anonymize_user(p_user_id UUID)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
    -- Anonimizar profile
    UPDATE public.profiles
    SET display_name = 'Usuario Anónimo',
        avatar_url = NULL,
        phone = NULL
    WHERE id = p_user_id;

    -- Eliminar consentimientos
    DELETE FROM public.geo_consent WHERE user_id = p_user_id;

    -- Eliminar suscripciones push
    DELETE FROM public.push_subscriptions WHERE user_id = p_user_id;
END;
$$;
```

Uso: cuando un usuario solicita la baja, se llama a `anonymize_user(su_id)` en lugar de borrar los datos (se mantienen las entradas compradas para integridad fiscal, pero sin datos personales).

### Push Subscriptions

```sql
CREATE TABLE public.push_subscriptions (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    endpoint    TEXT NOT NULL,
    keys        JSONB NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

- RLS: solo el propio usuario puede gestionar sus suscripciones
- Se usa para notificaciones push vía Service Worker

## 5.6 Buenas Prácticas Aplicadas

- **search_path seguro:** Todas las funciones usan `SET search_path = 'public'` para evitar ataques de path traversal
- **SECURITY INVOKER por defecto:** Las funciones que acceden a datos del usuario usan `SECURITY INVOKER`
- **SECURITY DEFINER solo cuando es necesario:** Funciones como `decrement_tier_remaining` que necesitan modificar tablas que el usuario no debería modificar directamente
- **Columnas inmutables:** Las políticas evitan que el usuario modifique columnas financieras (`unit_price`, `total_amount`, `quantity`)
- **Tokens con expiración:** Los QR tienen `token_expires_at` para limitar ventana de ataque
- **Rotación de tokens:** `rotate_ticket_token` permite renovar el token periódicamente
