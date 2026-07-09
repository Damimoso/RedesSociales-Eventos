import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://ntkrsjwpxfubsayxqezd.supabase.co'
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im50a3JzandweGZ1YnNheXhxZXpkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MzU4OTc0NywiZXhwIjoyMDk5MTY1NzQ3fQ.K55HsCNoNejt05_COB9gqY9-mYMK9H5bmrkRSQs-81M'

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
