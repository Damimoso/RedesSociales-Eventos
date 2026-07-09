import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://ntkrsjwpxfubsayxqezd.supabase.co'
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im50a3JzandweGZ1YnNheXhxZXpkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MzU4OTc0NywiZXhwIjoyMDk5MTY1NzQ3fQ.K55HsCNoNejt05_COB9gqY9-mYMK9H5bmrkRSQs-81M'

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const USERS = [
  {
    email: 'usuario@test.com',
    password: 'Test1234!',
    display_name: 'Carlos García',
    role: 'user',
  },
  {
    email: 'artista@test.com',
    password: 'Test1234!',
    display_name: 'Laura Martínez',
    role: 'artist',
    artist: { stage_name: 'Laura Music', bio: 'Cantante y compositora de indie pop', genre: ['Indie', 'Pop'], social_links: { instagram: '@lauramusic', spotify: 'spotify:artist:123' } },
  },
  {
    email: 'organizador@test.com',
    password: 'Test1234!',
    display_name: 'Ana López',
    role: 'organizer',
    organizer: { org_name: 'Ayuntamiento de Madrid', org_type: 'municipality', description: 'Área de Cultura del Ayuntamiento', is_approved: true },
  },
  {
    email: 'admin@test.com',
    password: 'Test1234!',
    display_name: 'Admin Platform',
    role: 'admin',
  },
]

async function seed() {
  for (const u of USERS) {
    console.log(`\n--- ${u.email} ---`)

    const { data: user, error: createErr } = await supabase.auth.admin.createUser({
      email: u.email,
      password: u.password,
      email_confirm: true,
      user_metadata: { full_name: u.display_name },
    })

    if (createErr) {
      if (createErr.message.includes('already exists')) {
        console.log('  ↳ Usuario ya existe, buscando ID...')
        const { data: list } = await supabase.auth.admin.listUsers()
        const existing = list.users.find(x => x.email === u.email)
        if (!existing) { console.error('  ✗ No se pudo recuperar'); continue }
        var userId = existing.id
      } else {
        console.error('  ✗', createErr.message)
        continue
      }
    } else {
      var userId = user.user.id
      console.log('  ✓ Usuario creado:', userId)
    }

    const { error: roleErr } = await supabase.from('user_roles').upsert(
      { user_id: userId, role: u.role },
      { onConflict: 'user_id,role' }
    )
    if (roleErr) console.error('  ✗ Error al asignar rol:', roleErr.message)
    else console.log(`  ✓ Rol "${u.role}" asignado`)

    if (u.artist) {
      const { error: aErr } = await supabase.from('artists').upsert(
        { user_id: userId, ...u.artist },
        { onConflict: 'user_id' }
      )
      if (aErr) console.error('  ✗ Error al crear perfil artista:', aErr.message)
      else console.log('  ✓ Perfil de artista creado')
    }

    if (u.organizer) {
      const { error: oErr } = await supabase.from('organizers').upsert(
        { user_id: userId, ...u.organizer },
        { onConflict: 'user_id' }
      )
      if (oErr) console.error('  ✗ Error al crear perfil organizador:', oErr.message)
      else console.log('  ✓ Perfil de organizador creado')
    }
  }

  console.log('\n✅ Seed completado')
  console.log('\nCredenciales de prueba:')
  console.log('  usuario@test.com   / Test1234!  (rol: user)')
  console.log('  artista@test.com   / Test1234!  (rol: artist)')
  console.log('  organizador@test.com / Test1234! (rol: organizer)')
  console.log('  admin@test.com     / Test1234!  (rol: admin)')
}

seed().catch(console.error)
