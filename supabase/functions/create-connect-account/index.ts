// Stripe Connect Express — Crea cuenta conectada y devuelve URL de onboarding
//
// Uso:
//   POST /functions/v1/create-connect-account
//   { organizer_id: "uuid", email: "org@test.com", org_name: "Mi Empresa" }
//
// Requiere: SUPABASE_SERVICE_ROLE_KEY y STRIPE_SECRET_KEY en secrets

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4'
import Stripe from 'https://esm.sh/stripe@17.7.0?target=deno'

const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY') ?? ''
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const APP_URL = Deno.env.get('APP_URL') ?? 'https://redes-sociales-eventos.vercel.app'

const stripe = new Stripe(STRIPE_SECRET_KEY, { apiVersion: '2025-03-31-basil' })
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

serve(async (req) => {
  try {
    const { organizer_id, email, org_name } = await req.json()

    if (!organizer_id || !email || !org_name) {
      return new Response(JSON.stringify({ error: 'Faltan campos: organizer_id, email, org_name' }), { status: 400 })
    }

    // 1. Crear cuenta Express en Stripe Connect
    const account = await stripe.accounts.create({
      type: 'express',
      country: 'ES',
      email,
      business_type: 'individual',
      business_profile: { name: org_name, url: APP_URL },
      capabilities: { transfers: { requested: true } },
    })

    // 2. Guardar stripe_account_id en la DB
    const { error: dbError } = await supabase
      .from('organizers')
      .update({ stripe_account_id: account.id, stripe_onboarding_complete: false })
      .eq('id', organizer_id)

    if (dbError) throw dbError

    // 3. Crear link de onboarding
    const link = await stripe.accountLinks.create({
      account: account.id,
      refresh_url: `${APP_URL}/dashboard`,
      return_url: `${APP_URL}/dashboard?stripe=success`,
      type: 'account_onboarding',
    })

    return new Response(JSON.stringify({ url: link.url }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error(err)
    return new Response(JSON.stringify({ error: err.message }), { status: 500 })
  }
})
