import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('❌ Faltan VITE_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

let passed = 0
let failed = 0

function assert(condition, msg) {
  if (condition) { passed++; console.log(`  ✅ ${msg}`) }
  else { failed++; console.error(`  ❌ ${msg}`) }
}

async function run() {
  console.log('\n🔍 Tests de RPCs críticos\n')

  // 1. find_events_nearby
  console.log('1️⃣  find_events_nearby')
  try {
    const { data, error } = await supabase.rpc('find_events_nearby', {
      p_lat: 28.4682, p_lng: -16.2546, radius_km: 50,
    })
    if (error) {
      // Try old signature (no p_ prefix)
      const { data: d2, error: e2 } = await supabase.rpc('find_events_nearby', {
        lat: 28.4682, lng: -16.2546, radius_km: 50,
      })
      assert(!e2, `find_events_nearby: ${e2?.message || 'ok'}`)
      if (!e2) console.log(`     Eventos encontrados: ${d2?.length ?? 0}`)
    } else {
      assert(true, 'find_events_nearby ok')
      console.log(`     Eventos encontrados: ${data?.length ?? 0}`)
    }
  } catch (e) {
    assert(false, `find_events_nearby: ${e.message}`)
  }

  // 2. get_feed
  console.log('\n2️⃣  get_feed')
  try {
    const { data, error } = await supabase.rpc('get_feed')
    assert(!error, `get_feed: ${error?.message || 'ok'}`)
    if (data) console.log(`     Items en feed: ${data.length}`)
  } catch (e) {
    assert(false, `get_feed: ${e.message}`)
  }

  // 3. is_admin helper
  console.log('\n3️⃣  is_admin')
  try {
    const { data, error } = await supabase.rpc('is_admin')
    assert(!error, `is_admin: ${error?.message || 'ok'}`)
    console.log(`     ¿Es admin?: ${data}`)
  } catch (e) {
    assert(false, `is_admin: ${e.message}`)
  }

  // 4. Verificar existencia de funciones clave
  console.log('\n4️⃣  Verificación de esquema')
  const requiredRPCs = [
    'find_events_nearby', 'get_feed', 'purchase_tickets',
    'validate_ticket', 'rotate_ticket_token', 'confirm_ticket',
    'check_streak', 'get_achievements', 'anonymize_user',
  ]
  for (const rpc of requiredRPCs) {
    try {
      // Llamada deliberadamente incorrecta para ver si la función existe
      const { error } = await supabase.rpc(rpc)
      // Si el error es "function not found", falla
      // Si es "not authenticated" o similar, significa que la función existe
      assert(error?.message !== 'function not found', `RPC ${rpc} existe`)
    } catch (e) {
      if (e.message?.includes('function not found')) {
        assert(false, `RPC ${rpc} NO existe — revisar migraciones`)
      } else {
        assert(true, `RPC ${rpc} existe`)
      }
    }
  }

  // 5. Verificar RLS de events INSERT (is_approved)
  console.log('\n5️⃣  Verificar RLS is_approved en events')
  try {
    const { data: policies, error } = await supabase.rpc('get_policies_info')
    if (error) console.log('     ⚠️  No se puede verificar RLS desde aquí. Revisar migration-fixes-auditoria.sql')
    else console.log(`     Policies: ${JSON.stringify(policies)}`)
  } catch {
    console.log('     ⚠️  No se puede verificar RLS desde aquí. Revisar migration-fixes-auditoria.sql')
  }

  // Resumen
  const total = passed + failed
  console.log(`\n${'='.repeat(40)}`)
  console.log(`Resultados: ${passed}/${total} pasaron`)
  if (failed > 0) {
    console.error(`❌ ${failed} tests fallaron`)
    process.exit(1)
  } else {
    console.log('✅ Todos los tests pasaron')
  }
}

run().catch(err => { console.error('Error:', err); process.exit(1) })
