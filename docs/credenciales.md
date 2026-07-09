# Credenciales del Proyecto

> **⚠️ IMPORTANTE:** Este archivo contiene credenciales reales.  
> No compartir externamente. Mantener actualizado.

---

## 1. Supabase

### Proyecto

| Campo | Valor |
|-------|-------|
| **URL** | `https://ntkrsjwpxfubsayxqezd.supabase.co` |
| **Project Ref** | `ntkrsjwpxfubsayxqezd` |
| **Región** | EU-West (Frankfurt) |

### Conexión a Base de Datos

| Campo | Valor |
|-------|-------|
| **Host** | `db.ntkrsjwpxfubsayxqezd.supabase.co` |
| **Puerto** | `5432` |
| **Base de datos** | `postgres` |
| **Usuario** | `postgres` |
| **Password** | `Escondite-3` |
| **Connection String** | `postgresql://postgres:Escondite-3@db.ntkrsjwpxfubsayxqezd.supabase.co:5432/postgres` |

### API Keys

| Key | Valor |
|-----|-------|
| **Anon Key** | `(configurada como VITE_SUPABASE_ANON_KEY en .env local y en Vercel)` |
| **Service Role Key** | `eyJ...` (ver en scripts/seed-roles.mjs o en Supabase Dashboard) |

### Personal Access Token (Supabase CLI)

| Campo | Valor |
|-------|-------|
| **Token** | `sbp_xxx` (regenerar en https://supabase.com/dashboard/account/tokens) |
| **Uso** | `npx supabase functions deploy` y `npx supabase secrets set` |

---

## 2. Usuarios de Prueba

| Email | Contraseña | Rol | Descripción |
|-------|-----------|-----|-------------|
| `usuario@test.com` | `Test1234!` | `user` | Usuario normal, puede comprar entradas |
| `artista@test.com` | `Test1234!` | `artist` | Artista (stage_name: Laura Music) |
| `organizador@test.com` | `Test1234!` | `organizer` | Organizador (Ayuntamiento de Madrid) |
| `admin@test.com` | `Test1234!` | `admin` | Administrador, acceso total |

Seed: `node scripts/seed-roles.mjs`

---

## 3. Stripe

| Campo | Valor | Estado |
|-------|-------|--------|
| **STRIPE_SECRET_KEY** | `sk_test_placeholder_reemplazar` | ⚠️ Placeholder |
| **STRIPE_WEBHOOK_SECRET** | `whsec_placeholder_reemplazar` | ⚠️ Placeholder |
| **APP_URL** | `https://redes-sociales-eventos.vercel.app` | ✅ Configurado |

> **Pendiente:** Reemplazar los placeholders con claves reales desde el Dashboard de Stripe.

Comandos para actualizar:
```bash
npx supabase secrets set --project-ref ntkrsjwpxfubsayxqezd \
  STRIPE_SECRET_KEY="sk_live_xxx" \
  STRIPE_WEBHOOK_SECRET="whsec_xxx"
```

---

## 4. Frontend (Vercel)

| Campo | Valor |
|-------|-------|
| **URL Producción** | `https://redes-sociales-eventos.vercel.app` |
| **Framework** | Vite + React |
| **Build Command** | `npm run build` |
| **Output Dir** | `dist/` |

### Variables de Entorno en Vercel

| Variable | Valor |
|----------|-------|
| `VITE_SUPABASE_URL` | `https://ntkrsjwpxfubsayxqezd.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | (anon key del proyecto) |
| `VITE_STRIPE_PUBLISHABLE_KEY` | (stripe publishable key) |

---

## 5. Enlaces Rápidos

| Recurso | URL |
|---------|-----|
| **App en producción** | https://redes-sociales-eventos.vercel.app |
| **Supabase Dashboard** | https://supabase.com/dashboard/project/ntkrsjwpxfubsayxqezd |
| **Supabase SQL Editor** | https://supabase.com/dashboard/project/ntkrsjwpxfubsayxqezd/sql/new |
| **Supabase Edge Functions** | https://supabase.com/dashboard/project/ntkrsjwpxfubsayxqezd/functions |
| **Repositorio GitHub** | https://github.com/Damimoso/RedesSociales-Eventos |
| **Stripe Dashboard** | https://dashboard.stripe.com |
| **Vercel Dashboard** | https://vercel.com/damimoso/redes-sociales-eventos |

---

## 6. Configuración Local (.env)

Archivo `.env` en la raíz del proyecto:

```env
VITE_SUPABASE_URL=https://ntkrsjwpxfubsayxqezd.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-key>
VITE_STRIPE_PUBLISHABLE_KEY=<stripe-publishable-key>
```
