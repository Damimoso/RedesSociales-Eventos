# RedSocial-Eventos — Documentación Técnica

```text
Plataforma de venta de entradas y gestión de eventos con
pagos integrados, validación QR y gamificación.
```

## Índice de Tomos

| Tomo | Descripción |
|------|-------------|
| **[Tomo 1 — Arquitectura General](./01-arquitectura.md)** | Stack, estructura del proyecto, flujo de datos, decisiones técnicas |
| **[Tomo 2 — Frontend](./02-frontend.md)** | Componentes, páginas, routing, hooks, estilos, PWA |
| **[Tomo 3 — Backend Supabase](./03-backend-supabase.md)** | Base de datos, esquema, RLS, funciones PL/pgSQL, migraciones |
| **[Tomo 4 — Pagos Stripe](./04-pagos-stripe.md)** | Stripe Connect, Embedded Checkout, webhooks, ciclo de pago completo |
| **[Tomo 5 — Seguridad](./05-seguridad.md)** | RLS, race conditions, PostGIS, RGPD, anonimización |
| **[Tomo 6 — QR y Gamificación](./06-qr-gamificacion.md)** | Validación QR con cámara, rachas, logros, onboarding |
| **[Tomo 7 — Despliegue](./07-despliegue.md)** | Vercel, Supabase, Edge Functions, variables de entorno |

## Resumen del Proyecto

**RedSocial-Eventos** es una plataforma full-stack para la creación, descubrimiento y venta de entradas para eventos. Los organizadores pueden crear eventos con múltiples tipos de entrada, los usuarios pueden comprar entradas con pago integrado vía Stripe, y la validación en puerta se realiza mediante códigos QR escaneados con la cámara del dispositivo.

### Stack Tecnológico

| Capa | Tecnología |
|------|------------|
| Frontend | React 19, Vite 6, TypeScript 5.8, TailwindCSS 4 |
| Backend | Supabase (PostgreSQL 17 + PostGIS, Auth, Storage, Edge Functions) |
| Pagos | Stripe Connect + Embedded Checkout |
| Mapas | MapLibre GL JS |
| PWA | vite-plugin-pwa (service worker + manifest) |
| Despliegue | Vercel (frontend), Supabase (backend + Edge Functions) |

### Enlaces

- **Producción:** https://redes-sociales-eventos.vercel.app
- **Supabase:** https://ntkrsjwpxfubsayxqezd.supabase.co
- **Repositorio:** https://github.com/Damimoso/RedesSociales-Eventos
