# Tomo 4: Pagos Stripe

## 4.1 Arquitectura de Pagos

```
┌─────────────────────────────────────────────────────────┐
│                   FLUJO DE PAGO COMPLETO                 │
└─────────────────────────────────────────────────────────┘

USUARIO                     FRONTEND                   STRIPE
   │                          │                          │
   │  Selecciona entradas     │                          │
   │ ──────────────────────►  │                          │
   │                          │                          │
   │  "Comprar entrada"       │                          │
   │ ──────────────────────►  │                          │
   │                          │                          │
   │                   invoke('create-checkout')          │
   │                          │ ─────────────────────►   │
   │                          │                          │
   │                   Recibe client_secret              │
   │                          │ ◄─────────────────────   │
   │                          │                          │
   │  Ve Embedded Checkout    │                          │
   │ ◄──────────────────────  │                          │
   │                          │                          │
   │  Introduce datos tarjeta │                          │
   │ ───────────────────────────────────────────────►   │
   │                          │                          │
   │  Pago exitoso            │                          │
   │ ◄───────────────────────────────────────────────   │
   │                          │                          │
   │                          │   Webhook:               │
   │                          │   checkout.session        │
   │                          │   .completed              │
   │                          │ ◄─────────────────────   │
   │                          │                          │
   │                          │  Crea ticket + QR        │
   │                          │  Decrementa remaining    │
   │                          │                          │
   │  Redirige a              │                          │
   │  /events/:id?pago=ok     │                          │
   │ ◄──────────────────────  │                          │
```

## 4.2 Stripe Connect

### ¿Qué es Stripe Connect?
Stripe Connect permite que la plataforma procese pagos en nombre de los organizadores. Cada organizador tiene una cuenta vinculada (Express) donde recibe el dinero de sus ventas.

### Onboarding del Organizador

```
Dashboard (Pagos) → "Conectar con Stripe"
  → invoke('create-connect-account')
    → Edge Function crea Account Express (país: ES)
      → Guarda stripe_account_id en organizers
        → Devuelve onboarding URL
          → Organizador completa onboarding en Stripe
            → Webhook account.updated:
              charges_enabled && payouts_enabled
              → stripe_onboarding_complete = true
```

### Flujo sin Stripe Connect (Fallback)
Si el organizador no completa Stripe Connect, puede introducir datos bancarios manualmente (IBAN + BIC/SWIFT) como respaldo. El pago se procesa igualmente y se liquida manualmente.

## 4.3 Embedded Checkout (vs Redirect)

### Cambio de Redirect a Embedded

**Antes (Redirect):**
```typescript
// Edge Function devolvía URL
const session = await stripe.checkout.sessions.create({
  mode: 'payment',
  success_url: `${APP_URL}/events/${event.id}?pago=ok`,
  cancel_url: `${APP_URL}/events/${event.id}`,
})
// Frontend: window.location.href = data.url  ← redirige a Stripe
```

**Ahora (Embedded):**
```typescript
// Edge Function devuelve client_secret
const session = await stripe.checkout.sessions.create({
  ui_mode: 'embedded',
  return_url: `${APP_URL}/events/${event.id}?pago=ok`,
})
// Frontend: monta <EmbeddedCheckout> con client_secret
```

**Ventajas del Embedded Checkout:**
- El usuario nunca abandona la aplicación
- La URL no cambia (mejor UX)
- Stripe maneja la seguridad del iframe (PCI compliance)
- Se integra con `@stripe/react-stripe-js`

### Componentes React para Embedded Checkout

```tsx
import { loadStripe } from '@stripe/stripe-js'
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from '@stripe/react-stripe-js'

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY)

function EventDetail() {
  const [clientSecret, setClientSecret] = useState<string | null>(null)

  const handleBuy = async () => {
    const { data } = await supabase.functions.invoke('create-checkout', {
      body: { tier_id, quantity, user_id }
    })
    setClientSecret(data.client_secret)
  }

  return (
    {clientSecret ? (
      <EmbeddedCheckoutProvider stripe={stripePromise} options={{ clientSecret }}>
        <EmbeddedCheckout />
      </EmbeddedCheckoutProvider>
    ) : (
      <Button onClick={handleBuy}>Comprar entrada</Button>
    )}
  )
}
```

## 4.4 Webhook: stripe-webhook

El webhook escucha dos eventos de Stripe:

### `checkout.session.completed`
```
1. Extrae metadata: event_id, user_id, tier_id, quantity
2. Genera QR code: HMAC-SHA256( event_id:user_id:uuid )
3. Inserta ticket con valid_token y token_expires_at (60s)
4. Llama a RPC decrement_tier_remaining (con FOR UPDATE)
```

### `account.updated`
```
1. Verifica charges_enabled && payouts_enabled
2. Actualiza stripe_onboarding_complete = true en organizers
```

## 4.5 Seguridad en Pagos

- **CSRF:** Stripe verifica la firma del webhook (`stripe-signature` header)
- **Idempotencia:** Cada sesión de checkout tiene un ID único
- **Race conditions:** `decrement_tier_remaining` usa `FOR UPDATE` (bloqueo pesimista)
- **PCI:** Stripe maneja todos los datos de tarjeta; la plataforma nunca los ve
- **Tokens QR:** HMAC-SHA256 con rotación periódica (`rotate_ticket_token`)
- **Expiración:** `token_expires_at` evita reuso de QR antiguos

## 4.6 Precios en Céntimos

Todos los precios se almacenan como enteros en céntimos (`price_cents INTEGER`) para evitar errores de redondeo con floats:

```sql
price_cents INTEGER NOT NULL CHECK (price_cents >= 0)
```

**Conversiones:**
- Frontend: `centsToEur(c) = (c / 100).toFixed(2)`
- Backend: `price_cents = euros * 100`
- Stripe: `unit_amount = price_cents` (Stripe también usa céntimos)

## 4.7 Variables de Entorno

```bash
# Frontend (.env)
VITE_STRIPE_PUBLISHABLE_KEY=pk_live_xxx

# Supabase Secrets (Edge Functions)
STRIPE_SECRET_KEY=sk_live_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
APP_URL=https://redes-sociales-eventos.vercel.app
```
