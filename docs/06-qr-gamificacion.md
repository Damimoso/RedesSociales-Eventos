# Tomo 6: QR y Gamificación

## 6.1 Sistema de Validación QR

### Arquitectura

```
ORGANIZADOR                     FRONTEND                        SUPABASE
    │                              │                              │
    │  Abre Dashboard > Validar QR │                              │
    │ ──────────────────────────►  │                              │
    │                              │                              │
    │  "Escanear QR"               │                              │
    │ ──────────────────────────►  │                              │
    │                              │                              │
    │  Html5Qrcode.start()         │                              │
    │  (cámara: facingMode:        │                              │
    │   "environment")             │                              │
    │                              │                              │
    │  Usuario muestra su QR       │                              │
    │ ◄──────────────────────────  │                              │
    │                              │                              │
    │  Código escaneado            │                              │
    │ ──────────────────────────►  │                              │
    │                              │                              │
    │                   rpc('validate_ticket', { p_token })       │
    │                              │ ──────────────────────────►  │
    │                              │                              │
    │                              │  Verifica:                   │
    │                              │  - Token existe?             │
    │                              │  - Organizador autorizado?   │
    │                              │  - Token expirado?           │
    │                              │  - Ya usado?                 │
    │                              │                              │
    │                              │  Si todo OK:                 │
    │                              │  UPDATE status='used'        │
    │                              │  RETURN 'VALID'              │
    │                              │                              │
    │  Muestra resultado           │                              │
    │  ✅ / ❌ / ⏰ / 🔄           │                              │
    │ ◄──────────────────────────  │                              │
```

### Componente QrValidator

**Archivo:** `src/components/organizer/QrValidator.tsx`

**Tecnología:** `html5-qrcode` (WebRTC)

```tsx
// Iniciar escáner
const scanner = new Html5Qrcode('qr-scanner')
await scanner.start(
  { facingMode: 'environment' },     // Cámara trasera
  { fps: 10, qrbox: { width: 250, height: 250 } },
  async (decodedText) => {
    // decodedText = token QR escaneado
    const { data } = await supabase.rpc('validate_ticket', {
      p_token: decodedText,
    })
    // data[0] = { result, ticket_id, event_title, user_name }
    setResult({ status: data[0].result, ...data[0] })
  }
)
```

### Función validate_ticket (PL/pgSQL)

```sql
CREATE OR REPLACE FUNCTION public.validate_ticket(p_token TEXT)
RETURNS TABLE(result TEXT, ticket_id UUID, event_title TEXT, user_name TEXT)
LANGUAGE plpgsql SECURITY INVOKER
SET search_path = 'public'
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_ticket  RECORD;
BEGIN
    -- 1. Buscar ticket por valid_token
    SELECT t.*, e.title, p.display_name
    INTO v_ticket
    FROM tickets t
    JOIN events e ON e.id = t.event_id
    JOIN organizers o ON o.id = e.organizer_id
    LEFT JOIN profiles p ON p.id = t.user_id
    WHERE t.valid_token = p_token;

    IF NOT FOUND THEN
        result := 'INVALID'; RETURN NEXT; RETURN;
    END IF;

    -- 2. Verificar que quien escanea es el organizador
    IF NOT EXISTS (
        SELECT 1 FROM organizers
        WHERE user_id = v_user_id
        AND id = (SELECT organizer_id FROM events WHERE id = v_ticket.event_id)
    ) AND NOT is_admin() THEN
        result := 'UNAUTHORIZED'; RETURN NEXT; RETURN;
    END IF;

    -- 3. Verificar expiración
    IF v_ticket.token_expires_at < NOW() THEN
        result := 'EXPIRED'; RETURN NEXT; RETURN;
    END IF;

    -- 4. Verificar no usado
    IF v_ticket.status = 'used' THEN
        result := 'ALREADY_USED'; RETURN NEXT; RETURN;
    END IF;

    -- 5. ¡VALIDADO! Marcar como usado
    UPDATE tickets SET status = 'used', used_at = NOW()
    WHERE id = v_ticket.id;

    result := 'VALID';
    ticket_id := v_ticket.id;
    event_title := v_ticket.title;
    user_name := v_ticket.display_name;
    RETURN NEXT;
END;
$$;
```

### Rotación de Tokens

```sql
CREATE OR REPLACE FUNCTION public.rotate_ticket_token(p_ticket_id UUID)
RETURNS TEXT
LANGUAGE plpgsql SECURITY INVOKER
SET search_path = 'public'
AS $$
DECLARE v_new_token TEXT;
BEGIN
    v_new_token := encode(
        hmac(
            p_ticket_id::TEXT || NOW()::TEXT || gen_random_uuid()::TEXT,
            gen_random_uuid()::TEXT,
            'sha256'
        ),
        'hex'
    );

    UPDATE tickets
    SET valid_token = v_new_token,
        token_expires_at = NOW() + INTERVAL '5 minutes'
    WHERE id = p_ticket_id;

    RETURN v_new_token;
END;
$$;
```

### Generación de QR en Webhook (stripe-webhook)

```typescript
// HMAC-SHA256 del contenido del ticket
const encoder = new TextEncoder()
const keyData = crypto.getRandomValues(new Uint8Array(32))
const msgData = encoder.encode(
  `${metadata.event_id}:${metadata.user_id}:${crypto.randomUUID()}`
)
const cryptoKey = await crypto.subtle.importKey(
  'raw', keyData, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
)
const sig = await crypto.subtle.sign('HMAC', cryptoKey, msgData)
const qrCode = Array.from(new Uint8Array(sig))
  .map(b => b.toString(16).padStart(2, '0'))
  .join('')
```

## 6.2 Gamificación

### Rachas (Streaks)

**Tabla:** `user_streaks`

| Columna | Tipo | Descripción |
|---------|------|-------------|
| user_id | UUID | FK → auth.users |
| current_streak | INTEGER | Rachas actual (días consecutivos) |
| max_streak | INTEGER | Máxima racha histórica |
| last_activity_date | DATE | Última actividad registrada |

**Función check_streak:**

```sql
CREATE OR REPLACE FUNCTION public.check_streak()
RETURNS TABLE(current_streak INTEGER, max_streak INTEGER, checked_today BOOLEAN)
LANGUAGE plpgsql SECURITY INVOKER
SET search_path = 'public'
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_row user_streaks%ROWTYPE;
BEGIN
    -- Upsert: crea fila si no existe
    INSERT INTO user_streaks (user_id, current_streak, max_streak, last_activity_date)
    VALUES (v_user_id, 1, 1, CURRENT_DATE)
    ON CONFLICT (user_id) DO UPDATE SET
        current_streak = CASE
            WHEN user_streaks.last_activity_date = CURRENT_DATE - 1
                THEN user_streaks.current_streak + 1
            WHEN user_streaks.last_activity_date = CURRENT_DATE
                THEN user_streaks.current_streak
            ELSE 1
        END,
        max_streak = GREATEST(
            user_streaks.max_streak,
            CASE
                WHEN user_streaks.last_activity_date = CURRENT_DATE - 1
                    THEN user_streaks.current_streak + 1
                ELSE 1
            END
        ),
        last_activity_date = CURRENT_DATE
    RETURNING * INTO v_row;

    current_streak := v_row.current_streak;
    max_streak := v_row.max_streak;
    checked_today := v_row.last_activity_date = CURRENT_DATE;
    RETURN NEXT;
END;
$$;
```

**Tiers de racha en el frontend:**

| Días | Tier | Badge |
|------|------|-------|
| 1-6 | Explorador | 🔥 |
| 7-13 | Paseante | 🔥🔥 |
| 14-29 | Festivalero | 🔥🔥🔥 |
| 30+ | Leyenda | 🔥🔥🔥🔥 |

### Logros (Achievements)

**Tabla:** `user_achievements`

| Columna | Tipo | Descripción |
|---------|------|-------------|
| user_id | UUID | FK → auth.users |
| achievement_key | TEXT | Identificador del logro |
| unlocked_at | TIMESTAMPTZ | Cuándo se desbloqueó |

**Logros disponibles (grid 3×3):**

| # | Key | Nombre | Descripción |
|---|-----|--------|-------------|
| 1 | `first_event` | Primer Evento | Asististe a tu primer evento |
| 2 | `first_purchase` | Primera Compra | Compraste tu primera entrada |
| 3 | `streak_7` | Una Semana | Mantuviste una racha de 7 días |
| 4 | `streak_30` | Todo un Mes | Llegaste a 30 días de racha |
| 5 | `explorer` | Explorador | Visitaste 3 ciudades diferentes para eventos |
| 6 | `social` | Social | Seguiste a 5 organizadores |
| 7-9 | (bloqueados) | ??? | Próximamente |

**Función unlock_achievement:**

```sql
CREATE OR REPLACE FUNCTION public.unlock_achievement(p_achievement_key TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY INVOKER
SET search_path = 'public'
AS $$
BEGIN
    INSERT INTO user_achievements (user_id, achievement_key)
    VALUES (auth.uid(), p_achievement_key)
    ON CONFLICT (user_id, achievement_key) DO NOTHING;
    RETURN FOUND;
END;
$$;
```

### Onboarding (Para Usuarios No Logueados)

**Componente:** `OnboardingMockup`

3 pantallas que se muestran al usuario no autenticado en la página principal:

1. **"Descubre Eventos"** — Busca eventos cerca de ti con el mapa interactivo
2. **"Compra Entradas"** — Pago seguro con Stripe, recibe tu QR
3. **"Organiza tus Eventos"** — Crea y gestiona eventos desde el dashboard

Transición automática cada 5 segundos o con clic en indicadores. Incluye CTA para registrarse o iniciar sesión.

### Hook useStreak

**Archivo:** `src/hooks/useStreak.ts`

```typescript
function useStreak() {
  const [streak, setStreak] = useState({ current: 0, max: 0, checkedToday: false })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.rpc('check_streak').then(({ data }) => {
      if (data?.[0]) setStreak({
        current: data[0].current_streak,
        max: data[0].max_streak,
        checkedToday: data[0].checked_today,
      })
      setLoading(false)
    })
  }, [])

  return { ...streak, loading }
}
```
