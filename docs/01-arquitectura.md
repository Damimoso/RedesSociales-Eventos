# Tomo 1: Arquitectura General

## 1.1 Estructura del Proyecto

```
RedSocial-Eventos/
├── src/                          # Frontend React
│   ├── components/               # Componentes reutilizables
│   │   ├── events/               #   Relacionados con eventos
│   │   ├── gamification/         #   Rachas, logros, onboarding
│   │   ├── layout/               #   Header, Layout, footer
│   │   ├── organizer/            #   QR Validator
│   │   └── ui/                   #   Button, LoadingSpinner
│   ├── contexts/                 # AuthContext (React Context)
│   ├── hooks/                    # useEvents, useStreak
│   ├── lib/                      # supabase client
│   ├── pages/                    # Páginas (cada una es una ruta)
│   ├── App.tsx                   # Router principal
│   ├── index.css                 # Variables CSS (paleta oscura)
│   └── main.tsx                  # Entry point
├── supabase/
│   ├── functions/                # Edge Functions (Deno)
│   │   ├── create-checkout/      #   Stripe Embedded Checkout
│   │   ├── create-connect-account/ # Stripe Connect onboarding
│   │   └── stripe-webhook/       #   Webhook de Stripe
│   └── *.sql                     # Migraciones de base de datos
├── public/                       # Assets estáticos
├── scripts/                      # Seed scripts
├── docs/                         # Documentación (este tomo)
├── dist/                         # Build de producción
├── package.json
├── vite.config.ts
└── tsconfig.json
```

## 1.2 Stack Tecnológico Detallado

### Frontend
- **React 19** con **TypeScript 5.8** — tipado fuerte en toda la app
- **Vite 6** — build tool ultrarrápido con HMR
- **TailwindCSS 4** — utilidades CSS, sin componentes predefinidos
- **React Router v7** — routing SPA con `<BrowserRouter>`
- **MapLibre GL JS** — mapas vectoriales para ubicación de eventos
- **html5-qrcode** — escáner QR por cámara (WebRTC)
- **qrcode** — generación de códigos QR en canvas

### Backend (Supabase)
- **PostgreSQL 17 + PostGIS** — base de datos relacional con extensión geoespacial
- **Auth** — autenticación por email/password y Google OAuth
- **Storage** — almacenamiento de imágenes (cover, avatar)
- **Edge Functions (Deno)** — lógica serverless para Stripe
- **RLS (Row Level Security)** — control de acceso a nivel de fila

### Pagos
- **Stripe Connect** — split de pagos entre plataforma y organizadores
- **Embedded Checkout** — iframe de pago sin redirección a Stripe
- **Webhooks** — eventos `checkout.session.completed` y `account.updated`

## 1.3 Flujo de Datos Principal

### Compra de Entradas
```
Usuario → EventDetail → selecciona tier + cantidad
  → handleBuy() → supabase.functions.invoke('create-checkout')
    → Edge Function crea Stripe Checkout Session (ui_mode: embedded)
      → devuelve client_secret
        → Frontend monta <EmbeddedCheckout>
          → Usuario paga en iframe de Stripe
            → Stripe llama al webhook (stripe-webhook)
              → Webhook crea ticket en DB con QR + valid_token
                → Usuario redirigido a /events/:id?pago=ok
                  → Usuario ve enlace a /tickets con su QR
```

### Validación QR en Puerta
```
Organizador → Dashboard (pestaña Validar QR)
  → startScanning() → Html5Qrcode.start()
    → Cámara escanea código QR
      → supabase.rpc('validate_ticket', { p_token })
        → Función SQL verifica: token existe? → no expirado? → no usado?
          → Si válido: UPDATE status='used', RETURN 'VALID'
            → Frontend muestra ✅ Entrada válida
```

## 1.4 Decisiones Técnicas

| Decisión | Alternativa | Motivo |
|----------|-------------|--------|
| **Supabase** vs Firebase | Firebase | PostgreSQL nativo + PostGIS + RLS potente |
| **Stripe Connect** vs pago directo | Pago directo | Permite que cada organizador gestione sus cobros |
| **Embedded Checkout** vs redirect | Stripe Checkout redirect | Mejor UX (no abandona la app) |
| **RLS** vs middleware API | Middleware API | Seguridad a nivel de base de datos, imposible de saltar |
| **Edge Functions** vs Vercel Functions | Vercel Functions | Integración nativa con Supabase, mismos secrets |
| **SECURITY INVOKER** vs DEFINER | SECURITY DEFINER | Evita escalada de privilegios no deseada |
| **FOR UPDATE SKIP LOCKED** vs optimista | Optimista | Previene race conditions en venta de entradas |
| **MapLibre** vs Google Maps | Google Maps | Open source, sin límites de uso ni API key |
