# Tomo 7: Despliegue y Operaciones

## 7.1 Entornos

| Entorno | Frontend | Backend | Base de Datos |
|---------|----------|---------|---------------|
| **Producción** | Vercel | Supabase Edge Functions | Supabase PostgreSQL |
| **Desarrollo** | Vite (localhost) | Supabase Edge Functions | Supabase (misma instancia) |

## 7.2 Frontend (Vercel)

### Despliegue Automático

El repositorio está conectado a Vercel. Cada push a `main` despliega automáticamente:

```bash
# Build command
npm run build

# Output directory
dist/

# Framework preset
Vite
```

### Variables de Entorno en Vercel

```
VITE_SUPABASE_URL=https://ntkrsjwpxfubsayxqezd.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
VITE_STRIPE_PUBLISHABLE_KEY=pk_live_xxx
```

### Configuración PWA

- Service worker generado por `vite-plugin-pwa` en modo `generateSW`
- Precache de ~11 archivos (componentes, CSS, imágenes)
- Estrategia: Network-first para API, Cache-first para assets
- Manifest con nombre, íconos (192px, 512px) y tema oscuro

## 7.3 Backend (Supabase)

### Migraciones de Base de Datos

Las migraciones se ejecutan desde el panel SQL Editor de Supabase:

```bash
# Opcional: usar psql directo
psql "postgresql://postgres:password@db.PROJECT.supabase.co:5432/postgres" \
  -f migration-file.sql
```

**Orden de ejecución obligatorio:**

```
1. init.sql
2. update-rpc-find_events_nearby.sql
3. migration-ticketing.sql
4. migration-security-fix.sql
5. migration-gamification.sql
6. migration-qr-view.sql
```

### Edge Functions

Despliegue manual desde CLI:

```bash
# Configurar acceso
export SUPABASE_ACCESS_TOKEN=sbp_xxx

# Desplegar funciones
npx supabase functions deploy create-checkout \
  --project-ref ntkrsjwpxfubsayxqezd

npx supabase functions deploy create-connect-account \
  --project-ref ntkrsjwpxfubsayxqezd

npx supabase functions deploy stripe-webhook \
  --project-ref ntkrsjwpxfubsayxqezd
```

### Secrets de Edge Functions

```bash
# Configurar secrets (requiere SUPABASE_ACCESS_TOKEN)
npx supabase secrets set \
  --project-ref ntkrsjwpxfubsayxqezd \
  STRIPE_SECRET_KEY=sk_live_xxx \
  STRIPE_WEBHOOK_SECRET=whsec_xxx \
  APP_URL=https://redes-sociales-eventos.vercel.app
```

Los secrets `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` se inyectan automáticamente.

## 7.4 Stripe

### Configuración de Webhook

1. Ir a Stripe Dashboard → Developers → Webhooks
2. Añadir endpoint: `https://ntkrsjwpxfubsayxqezd.supabase.co/functions/v1/stripe-webhook`
3. Escuchar eventos:
   - `checkout.session.completed`
   - `account.updated`
4. Copiar el `Signing secret` y configurarlo como `STRIPE_WEBHOOK_SECRET`

### Stripe Connect

1. Configurar la aplicación Connect en Stripe Dashboard
2. Tipo de cuenta: Express (onboarding simplificado)
3. País: España (ES)
4. La URL de retorno tras onboarding: `https://redes-sociales-eventos.vercel.app/dashboard?stripe=success`

## 7.5 Usuarios de Prueba

| Email | Contraseña | Rol |
|-------|-----------|-----|
| usuario@test.com | Test1234! | user |
| artista@test.com | Test1234! | artist |
| organizador@test.com | Test1234! | organizer |
| admin@test.com | Test1234! | admin |

### Seed de Roles

```bash
node scripts/seed-roles.mjs
```

Requiere `SERVICE_ROLE_KEY` configurada en el script (ya incluida).

## 7.6 Comandos Útiles

```bash
# Desarrollo
npm run dev          # Iniciar servidor de desarrollo (Vite)
npm run build        # Build de producción
npm run preview      # Vista previa del build
npm run lint         # TypeScript check

# Supabase CLI
npx supabase functions deploy <name> --project-ref <ref>
npx supabase functions list --project-ref <ref>
npx supabase secrets set --project-ref <ref> KEY=value
npx supabase db push --db-url <connection-string>

# Conexión a base de datos
psql "postgresql://postgres:password@db.PROJECT.supabase.co:5432/postgres"
```

## 7.7 Troubleshooting

### Error: "Cannot change return type of existing function"
**Causa:** Se cambió el tipo de retorno de una función PL/pgSQL.
**Solución:** Hacer DROP FUNCTION primero y luego CREATE OR REPLACE.

### Error: "Policy already exists"
**Causa:** Se intentó crear una política RLS que ya existe.
**Solución:** Usar `DROP POLICY IF EXISTS` antes de `CREATE POLICY`.

### Error: "relation does not exist" en ANALYZE
**Causa:** Se ejecutó ANALYZE sobre una tabla que aún no existe.
**Solución:** Ejecutar las migraciones en el orden correcto.

### Error: "SECURITY syntax error"
**Causa:** Se usó `SECURITY INVOKER` como palabra clave directa en una vista.
**Solución:** Usar `WITH (security_invoker = true)` en su lugar:

```sql
-- Incorrecto (PostgreSQL < 17 no soporta)
CREATE VIEW v SECURITY INVOKER AS ...

-- Correcto
CREATE VIEW v WITH (security_invoker = true) AS ...
```

### Webhook: "No signature"
**Causa:** Stripe no puede verificar la firma del webhook.
**Solución:** Verificar que `STRIPE_WEBHOOK_SECRET` está configurado correctamente en los secrets de Supabase y coincide con el del Dashboard de Stripe.

### Embedded Checkout no carga
**Causa:** `VITE_STRIPE_PUBLISHABLE_KEY` no está configurada o es incorrecta.
**Solución:** Verificar `.env` local y variables de entorno en Vercel.

### QR Scanner: "Permission denied"
**Causa:** El navegador bloqueó el acceso a la cámara.
**Solución:** El usuario debe conceder permiso de cámara en la configuración del navegador. HTTPS es obligatorio para WebRTC.
