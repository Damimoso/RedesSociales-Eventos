// Stripe Embedded Checkout — Sin comisiones
//
// POST /functions/v1/create-checkout
// Body: { tier_id, quantity, user_id }
// Response: { client_secret: "cs_..." }
//
// Requires: STRIPE_SECRET_KEY in Supabase secrets

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4'
import Stripe from 'https://esm.sh/stripe@17.7.0?target=deno'

const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY') ?? ''
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const APP_URL = Deno.env.get('APP_URL') ?? ''

const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: '2025-03-31-basil' })
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

serve(async (req) => {
  try {
    const { tier_id, quantity, user_id } = await req.json()

    if (!tier_id || !quantity || !user_id) {
      return new Response(JSON.stringify({ error: 'Faltan campos: tier_id, quantity, user_id' }), { status: 400 })
    }

    const qty = parseInt(quantity, 10)
    if (qty < 1) return new Response(JSON.stringify({ error: 'quantity debe ser > 0' }), { status: 400 })

    // 1. Obtener tier + evento
    const { data: tier, error: tierErr } = await supabase
      .from('ticket_tiers')
      .select('id, price_cents, remaining, name, event:event_id(id, title)')
      .eq('id', tier_id)
      .single()

    if (tierErr || !tier) return new Response(JSON.stringify({ error: 'Tier no encontrado' }), { status: 404 })
    if (tier.remaining < qty) return new Response(JSON.stringify({ error: 'No hay suficientes entradas disponibles' }), { status: 400 })

    const event = tier.event as any

    // 2. Crear sesión de Embedded Checkout (sin comisión)
    const session = await stripe.checkout.sessions.create({
      ui_mode: 'embedded',
      mode: 'payment',
      customer_email: (await supabase.auth.admin.getUserById(user_id)).data.user?.email,
      line_items: [{
        price_data: {
          currency: 'eur',
          product_data: { name: event?.title ?? 'Entrada', description: `Entrada: ${tier.name}` },
          unit_amount: tier.price_cents,
        },
        quantity: qty,
      }],
      metadata: {
        event_id: event.id,
        user_id,
        tier_id,
        quantity: String(qty),
        unit_price_cents: String(tier.price_cents),
      },
      return_url: `${APP_URL}/events/${event.id}?pago=ok`,
    })

    return new Response(JSON.stringify({ client_secret: session.client_secret }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error(err)
    return new Response(JSON.stringify({ error: err.message }), { status: 500 })
  }
})
