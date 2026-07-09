# Tomo 2: Frontend

## 2.1 Routing

Definido en `src/App.tsx` con `<BrowserRouter>`:

| Ruta | Componente | Descripción |
|------|------------|-------------|
| `/` | `Home` | Landing page con feed de eventos cercanos u OnboardingMockup |
| `/login` | `Login` | Autenticación email/password + Google OAuth |
| `/register` | `Register` | Registro email/password + Google OAuth |
| `/events` | `Events` | Explorador de eventos con mapa y filtro por radio |
| `/events/:id` | `EventDetail` | Detalle del evento, selección de entradas, Embedded Checkout |
| `/events/new` | `CreateEventWizard` | Wizard 3 pasos para crear evento |
| `/profile` | `Profile` | Perfil, logros, racha, entradas del usuario |
| `/tickets` | `MyTickets` | Lista de entradas compradas con QR expandible |
| `/dashboard` | `Dashboard` | Panel del organizador con 5 pestañas |

Todas las rutas comparten `<Layout />` (Header + Outlet + footer).

## 2.2 Páginas Principales

### Home (`src/pages/Home.tsx`)
- Usuario logueado: muestra eventos cercanos vía `find_events_nearby` RPC y feed de seguidos vía `get_feed` RPC
- Usuario no logueado: muestra `OnboardingMockup` con 3 pantallas de bienvenida
- Streak badge en el header del perfil

### EventDetail (`src/pages/EventDetail.tsx`)
- Muestra información completa del evento (imagen, fecha, ubicación, descripción)
- Lista de ticket tiers con selector radio y contador de cantidad
- Botón "Comprar" → invoca `create-checkout` Edge Function
- Al recibir `client_secret`, monta `<EmbeddedCheckout>` de Stripe
- Al regresar de pago exitoso (`?pago=ok`), muestra banner con enlace a /tickets
- Incluye `FollowButton` para seguir al organizador

### CreateEventWizard (`src/pages/CreateEventWizard.tsx`)
- Wizard de 3 pasos con stepper visual:
  - **Paso 1**: Información básica (título, descripción, categoría, capacidad, tags)
  - **Paso 2**: Fecha y ubicación (date picker + LocationPicker con MapLibre)
  - **Paso 3**: Entradas (ticket tiers dinámicos) + toggle draft/publish
- Crea evento y ticket tiers en una transacción, redirige a `/events/:id?creado=ok`

### Dashboard (`src/pages/Dashboard.tsx`)
- 5 pestañas: Eventos, Entradas, Validar QR, Pagos, Ventas
- **Eventos**: lista de eventos creados con estado (draft/published)
- **Entradas**: formulario para crear ticket tiers por evento + lista de tiers existentes
- **Validar QR**: componente `QrValidator` (escáner de cámara)
- **Pagos**: onboarding Stripe Connect + formulario IBAN manual de respaldo
- **Ventas**: tabla de ingresos por evento (sin comisión)
- Guard: si el usuario no es organizador, muestra botón "Solicitar ser organizador"

### MyTickets (`src/pages/MyTickets.tsx`)
- Consulta la vista `ticket_details` que filtra por `auth.uid()`
- Cada ticket se muestra con QR dinámico (generado con librería `qrcode`)
- QR expandible al hacer clic
- Muestra datos del evento: título, fecha, ubicación

### Profile (`src/pages/Profile.tsx`)
- Datos del perfil (nombre, email, teléfono)
- Enlace a "Mis Entradas"
- `StreakBadge` (racha de días)
- `AchievementGrid` (logros desbloqueados)
- Roles del usuario

## 2.3 Componentes Reutilizables

### UI (`src/components/ui/`)
- **Button** — variantes: primary, secondary, outline, ghost, danger; sizes: sm, md, lg; soporta loading
- **LoadingSpinner** — spinner SVG animado, con tamaño configurable

### Layout (`src/components/layout/`)
- **Header** — logo, navegación principal, avatar de usuario, streak badge
- **Layout** — wrapper con Header + Outlet + footer consistente

### Events (`src/components/events/`)
- **FollowButton** — botón seguir/dejar de seguir (insert/delete en tabla `follows`)
  - Props: `followingId`, `followingType` ('artist' | 'organizer')
  - Consulta el estado al montar, toggle con un clic

### Gamification (`src/components/gamification/`)
- **StreakBadge** — 🔥 + contador con tier (Explorador/Paseante/Festivalero/Leyenda)
- **AchievementGrid** — grid 3×3 de logros coleccionables (6 desbloqueables + 3 bloqueados)
- **OnboardingMockup** — 3 pantallas para usuarios no logueados

### Organizer (`src/components/organizer/`)
- **QrValidator** — escáner QR con cámara (WebRTC via html5-qrcode)
  - Llama a `validate_ticket` RPC con el token escaneado
  - Muestra resultado: ✅ VÁLIDA, ❌ INVÁLIDA, ⏰ EXPIRADA, 🔄 YA USADA

## 2.4 Hooks

### `useEvents` (`src/hooks/useEvents.ts`)
- Obtiene eventos cercanos vía RPC `find_events_nearby`
- Parámetros: latitud, longitud, radio en km
- Retorna: lista de eventos con distancia, loading, error

### `useStreak` (`src/hooks/useStreak.ts`)
- Llama a RPC `check_streak` al montar el componente
- Retorna: current_streak, max_streak, checked_today, loading

## 2.5 Estilos

### Paleta de Colores (CSS Variables en `src/index.css`)

| Variable | Valor | Uso |
|----------|-------|-----|
| `--bg-primary` | `#0F0F1A` | Fondo principal |
| `--bg-secondary` | `#1A1A2E` | Tarjetas, contenedores |
| `--bg-tertiary` | `#232346` | Hover, elementos secundarios |
| `--text-primary` | `#F1F1F6` | Texto principal |
| `--text-secondary` | `#8B8BA7` | Texto secundario |
| `--accent-primary` | `#7C5CFC` | Color principal (botones, enlaces) |
| `--accent-secondary` | `#FF6B9D` | Color de acento (danger, alerts) |
| `--success` | `#34D399` | Éxito, validado |
| `--border` | `rgba(124,92,252,0.1)` | Bordes sutiles |

### Animaciones
- `fadeIn` — entrada suave desde abajo
- `slideUp` — deslizamiento hacia arriba

## 2.6 PWA

Configurado con `vite-plugin-pwa`:
- Service worker generado automáticamente (GenerateSW mode)
- Precache de 11 entradas (~2 MB)
- Manifest con nombre, íconos y tema `#0F0F1A`
- Registro automático en `main.tsx`
