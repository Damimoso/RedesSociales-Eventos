import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('Faltan VITE_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const USERS = [
  { email: 'usuario@test.com', role: 'user' },
  { email: 'artista@test.com', role: 'artist', artist: { stage_name: 'Laura Music', bio: 'Cantante y compositora de indie pop', genre: ['Indie', 'Pop'], social_links: { instagram: '@lauramusic' }, is_verified: true } },
  { email: 'organizador@test.com', role: 'organizer', organizer: { org_name: 'Ayuntamiento de Madrid', org_type: 'municipality', description: 'Área de Cultura', is_approved: true } },
  { email: 'admin@test.com', role: 'admin' },
]

async function run() {
  const { data: { users } } = await supabase.auth.admin.listUsers()

  for (const u of USERS) {
    const user = users.find(x => x.email === u.email)
    if (!user) { console.log(`✗ ${u.email} no encontrado`); continue }

    const uid = user.id
    console.log(`\n--- ${u.email} (${uid}) ---`)

    const { error: roleErr } = await supabase.from('user_roles').upsert(
      { user_id: uid, role: u.role },
      { onConflict: 'user_id,role' }
    )
    console.log(roleErr ? `✗ Rol: ${roleErr.message}` : `✓ Rol: ${u.role}`)

    if (u.artist) {
      const { error: aErr } = await supabase.from('artists').upsert(
        { user_id: uid, ...u.artist },
        { onConflict: 'user_id' }
      )
      console.log(aErr ? `✗ Artista: ${aErr.message}` : '✓ Perfil artista creado')
    }

    if (u.organizer) {
      const { error: oErr } = await supabase.from('organizers').upsert(
        { user_id: uid, ...u.organizer },
        { onConflict: 'user_id' }
      )
      console.log(oErr ? `✗ Organizador: ${oErr.message}` : '✓ Perfil organizador creado')
    }
  }

  console.log('\n✅ Roles asignados')
  console.log('  usuario@test.com   / Test1234!  → user')
  console.log('  artista@test.com   / Test1234!  → artist')
  console.log('  organizador@test.com / Test1234! → organizer')
  console.log('  admin@test.com     / Test1234!  → admin')
}

run().catch(console.error)
