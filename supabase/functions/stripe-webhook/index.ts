// Stripe Webhook — Maneja eventos de Stripe Connect
//
// Eventos manejados:
//   - account.updated: marca onboarding_complete = true
//   - checkout.session.completed: confirma la compra de entradas
//
// Uso: Configurar en Stripe Dashboard > Webhooks > Endpoint:
//   POST https://PROJECT.supabase.co/functions/v1/stripe-webhook
//
// Requiere: STRIPE_WEBHOOK_SECRET en secrets de Supabase

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4'
import Stripe from 'https://esm.sh/stripe@17.7.0?target=deno'

const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY') ?? ''
const STRIPE_WEBHOOK_SECRET = Deno.env.get('STRIPE_WEBHOOK_SECRET') ?? ''
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: '2025-03-31-basil' })
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

serve(async (req) => {
  try {
    const sig = req.headers.get('stripe-signature')
    if (!sig) return new Response('No signature', { status: 400 })

    const body = await req.text()
    const event = stripe.webhooks.constructEvent(body, sig, STRIPE_WEBHOOK_SECRET)

    switch (event.type) {
      // ── El organizador completó el onboarding en Stripe ──
      case 'account.updated': {
        const account = event.data.object
        if (account.charges_enabled && account.payouts_enabled) {
          await supabase
            .from('organizers')
            .update({ stripe_onboarding_complete: true })
            .eq('stripe_account_id', account.id)
        }
        break
      }

      // ── El cliente pagó la entrada ──
      case 'checkout.session.completed': {
        const session = event.data.object
        const metadata = session.metadata || {}

        if (metadata.event_id && metadata.user_id && metadata.tier_id && metadata.quantity) {
          const unitPriceCents = session.amount_total! / parseInt(metadata.quantity)
          const qrCode = crypto.randomUUID().replace(/-/g, '').slice(0, 20).toUpperCase()

          const { error } = await supabase.from('tickets').insert({
            event_id: metadata.event_id,
            user_id: metadata.user_id,
            quantity: parseInt(metadata.quantity),
            unit_price: unitPriceCents / 100,
            total_amount: session.amount_total! / 100,
            status: 'confirmed',
            stripe_session_id: session.id,
            qr_code: qrCode,
          })

          if (error) console.error('Error insertando ticket:', error)

          // Decrementar remaining del ticket_tier
          await supabase.rpc('decrement_tier_remaining', {
            p_tier_id: metadata.tier_id,
            p_quantity: parseInt(metadata.quantity),
          })
        }
        break
      }
    }

    return new Response('ok', { status: 200 })
  } catch (err) {
    console.error(err)
    return new Response(err.message, { status: 400 })
  }
})
