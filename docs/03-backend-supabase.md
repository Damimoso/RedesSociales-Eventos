# Tomo 3: Backend Supabase

## 3.1 Esquema de Base de Datos

### Tablas

```
auth.users                          (gestionada por Supabase Auth)
├── profiles                        (datos públicos del usuario)
│   ├── id UUID [FK → auth.users]
│   ├── display_name TEXT
│   ├── avatar_url TEXT
│   └── phone TEXT
│
├── user_roles                      (roles: user, artist, organizer, admin)
│   ├── user_id UUID [FK → auth.users]
│   └── role TEXT CHECK (user|artist|organizer|admin)
│
├── organizers                      (perfiles de organizador)
│   ├── user_id UUID [FK → auth.users]
│   ├── org_name TEXT
│   ├── org_type TEXT
│   ├── description TEXT
│   ├── is_approved BOOLEAN
│   ├── stripe_account_id TEXT       (de Stripe Connect)
│   ├── stripe_onboarding_complete BOOLEAN
│   ├── bank_holder TEXT             (fallback manual)
│   ├── bank_iban TEXT
│   └── bank_swift TEXT
│
├── artists                         (perfiles de artista)
│   └── user_id UUID [FK → auth.users]
│       └── stage_name, bio, genre, social_links, is_verified
│
├── categories                      (categorías de eventos)
│   └── id UUID, slug TEXT, name TEXT, icon TEXT
│
├── events                          (eventos)
│   ├── id UUID
│   ├── organizer_id UUID [FK → organizers]
│   ├── title, description, short_description
│   ├── cover_image_url TEXT
│   ├── address, city, province, country
│   ├── location GEOGRAPHY(Point, 4326)  ← PostGIS
│   ├── start_date, end_date TIMESTAMPTZ
│   ├── is_free BOOLEAN, price DECIMAL
│   ├── max_capacity, remaining_capacity INTEGER
│   ├── status TEXT (draft|published|completed|cancelled)
│   ├── category_id UUID [FK → categories]
│   ├── tags TEXT[]
│   └── currency TEXT DEFAULT 'EUR'
│
├── event_artists                   (artistas invitados a eventos)
│   └── event_id, artist_id, status (confirmed|pending|rejected)
│
├── ticket_tiers                    (tipos de entrada por evento)
│   ├── event_id UUID [FK → events]
│   ├── name TEXT
│   ├── price_cents INTEGER         ← en céntimos (evita floats)
│   ├── quantity INTEGER            ← total disponible
│   └── remaining INTEGER           ← disponibles ahora
│
├── tickets                         (entradas compradas)
│   ├── event_id UUID [FK → events]
│   ├── user_id UUID [FK → auth.users]
│   ├── tier_id UUID [FK → ticket_tiers]
│   ├── quantity INTEGER
│   ├── unit_price DECIMAL
│   ├── total_amount DECIMAL
│   ├── status TEXT (confirmed|used|cancelled|refunded)
│   ├── qr_code TEXT                ← HMAC-SHA256
│   ├── valid_token TEXT             ← token actual (se rota)
│   ├── token_expires_at TIMESTAMPTZ ← expiración del token
│   ├── used_at TIMESTAMPTZ
│   └── stripe_session_id TEXT
│
├── follows                         (seguir organizadores/artistas)
│   ├── follower_id UUID [FK → auth.users]
│   ├── following_id UUID
│   ├── following_type TEXT (artist|organizer)
│   └── UNIQUE (follower_id, following_id, following_type)
│
├── geo_consent                     (RGPD: consentimiento ubicación)
│   └── user_id, granted, granted_at, expires_at
│
├── push_subscriptions              (notificaciones push)
│   └── user_id, endpoint, keys, created_at
│
├── user_streaks                    (gamificación: rachas)
│   ├── user_id UUID [FK → auth.users]
│   ├── current_streak INTEGER
│   ├── max_streak INTEGER
│   └── last_activity_date DATE
│
├── user_achievements               (gamificación: logros)
│   ├── user_id UUID [FK → auth.users]
│   ├── achievement_key TEXT
│   └── unlocked_at TIMESTAMPTZ
│   └── UNIQUE (user_id, achievement_key)
```

## 3.2 Funciones PL/pgSQL (RPC)

| Función | Descripción |
|---------|-------------|
| `is_admin()` | Retorna TRUE si el usuario actual tiene rol admin |
| `find_events_nearby(p_lat, p_lng, p_radius_km)` | Eventos publicados dentro del radio, ordenados por distancia |
| `get_feed()` | Feed de eventos de organizadores seguidos (usa `auth.uid()`) |
| `get_artist_schedule(p_artist_id)` | Próximos eventos de un artista |
| `purchase_tickets(p_event_id, p_tier_id, p_quantity, p_unit_price, p_total_amount, p_stripe_session_id)` | Crea ticket + decrementa remaining (atómico) |
| `decrement_tier_remaining(p_tier_id, p_quantity)` | Decrementa `remaining` de un tier con FOR UPDATE (bloqueo pesimista) |
| `rotate_ticket_token(p_ticket_id)` | Renueva `valid_token` con nuevo HMAC-SHA256 y actualiza `token_expires_at` |
| `validate_ticket(p_token)` | Valida un token QR: existente? → expirado? → ya usado? → marca usado |
| `confirm_ticket(...)` | Crea ticket desde webhook con datos validados |
| `anonymize_user(p_user_id)` | RGPD: anonimiza datos personales del usuario |
| `check_streak()` | Actualiza y retorna la racha actual del usuario |
| `unlock_achievement(p_achievement_key)` | Desbloquea un logro para el usuario |
| `get_achievements()` | Retorna todos los logros del usuario |
| `get_organizer_sales(p_organizer_id)` | Historial de ventas (sin comisión) |

## 3.3 Vistas

### `ticket_details`
Vista con `SECURITY INVOKER` que expone tickets con datos del evento. Filtra automáticamente:
- El propio usuario ve sus entradas
- El organizador ve las entradas de sus eventos
- El admin ve todas

```sql
CREATE VIEW public.ticket_details
WITH (security_invoker = true)
AS
SELECT t.*, e.title AS event_title, e.cover_image_url,
       e.city, e.address, e.start_date, e.end_date,
       o.org_name AS organizer_name
FROM tickets t
JOIN events e ON e.id = t.event_id
JOIN organizers o ON o.id = e.organizer_id
WHERE t.user_id = auth.uid()
   OR EXISTS (SELECT 1 FROM organizers o2
              WHERE o2.id = e.organizer_id AND o2.user_id = auth.uid())
   OR is_admin();
```

## 3.4 Políticas RLS

Cada tabla tiene políticas RLS que restringen el acceso según el rol del usuario:

| Tabla | Operación | Política |
|-------|-----------|----------|
| `profiles` | SELECT | Solo el propio usuario o admin |
| `profiles` | INSERT | Solo el propio usuario |
| `profiles` | UPDATE | Solo el propio usuario |
| `organizers` | SELECT | Público (ver nombre) |
| `organizers` | UPDATE | Solo el propio organizador o admin |
| `events` | SELECT | Publicados/completados visible para todos; drafts solo para el organizador |
| `events` | INSERT | Solo organizadores |
| `events` | UPDATE | Solo el organizador del evento o admin |
| `ticket_tiers` | SELECT | Eventos publicados/completados visible para todos |
| `ticket_tiers` | INSERT | Solo el organizador del evento |
| `ticket_tiers` | UPDATE | Solo el organizador del evento |
| `tickets` | INSERT | Solo el propio usuario (`user_id = auth.uid()`) |
| `tickets` | SELECT | Solo el propio usuario |
| `tickets` | UPDATE | Solo el organizador del evento (cambiar status a 'used') |
| `follows` | SELECT | Cualquier usuario autenticado |
| `follows` | INSERT | Solo el propio usuario (`follower_id = auth.uid()`) |
| `follows` | DELETE | Solo el propio usuario |
| `geo_consent` | SELECT/INSERT/UPDATE | Solo el propio usuario |

## 3.5 Migraciones

### Orden de ejecución:

```
1. init.sql              → Esquema inicial (tablas base, RLS, funciones originales)
2. update-rpc-find_events_nearby.sql → Actualización RPC geoespacial
3. migration-ticketing.sql  → ticket_tiers, Stripe Connect, triggers
4. migration-security-fix.sql → 11 secciones de seguridad, race conditions, RGPD
5. migration-gamification.sql → user_streaks, user_achievements
6. migration-qr-view.sql   → Vista ticket_details
```

### Archivos de migración:

| Archivo | Líneas | Contenido |
|---------|--------|-----------|
| `init.sql` | ~700 | Esquema completo inicial |
| `update-rpc-find_events_nearby.sql` | ~50 | RPC con PostGIS |
| `migration-ticketing.sql` | 172 | ticket_tiers, get_organizer_sales, triggers |
| `migration-security-fix.sql` | 682 | Race conditions, políticas, índices, RGPD |
| `migration-gamification.sql` | ~200 | Rachas y logros |
| `migration-qr-view.sql` | ~20 | Vista ticket_details |

## 3.6 Edge Functions

### create-checkout
- **Ruta:** `POST /functions/v1/create-checkout`
- **Body:** `{ tier_id, quantity, user_id }`
- **Respuesta:** `{ client_secret }`
- Crea una Stripe Checkout Session en modo embedded (sin comisión)

### create-connect-account
- **Ruta:** `POST /functions/v1/create-connect-account`
- **Body:** `{ organizer_id, email, org_name }`
- **Respuesta:** `{ url }` (enlace de onboarding Stripe Express)

### stripe-webhook
- **Ruta:** `POST /functions/v1/stripe-webhook`
- **Eventos:** `checkout.session.completed`, `account.updated`
- Crea tickets con QR (HMAC-SHA256) y decrementa remaining
- Marca onboarding_complete cuando el organizador completa Stripe
