// Seed: Fiestas tradicionales españolas como eventos
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://ntkrsjwpxfubsayxqezd.supabase.co'
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im50a3JzandweGZ1YnNheXhxZXpkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MzU4OTc0NywiZXhwIjoyMDk5MTY1NzQ3fQ.K55HsCNoNejt05_COB9gqY9-mYMK9H5bmrkRSQs-81M'

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// Map category slugs to IDs
const CATEGORIES = {
  concierto: null, teatro: null, festival: null, deportes: null,
  arte: null, gastronomia: null, feria: null, taller: null,
  'fiesta-popular': null, cine: null,
}

const EVENTS = [
  // ───────────── INVIERNO ─────────────
  {
    title: 'Carnavales de Santa Cruz de Tenerife',
    description: 'Los carnavales más espectaculares de España, declarados Fiesta de Interés Turístico Internacional. Famosos por sus impresionantes reinas con trajes gigantescos, ritmo caribeño, murgas y comparsas. Una explosión de color, música y fantasía que transforma la ciudad durante semanas.',
    short_description: 'Espectacular carnaval con reinas, trajes gigantescos y ritmo caribeño.',
    city: 'Santa Cruz de Tenerife', province: 'Santa Cruz de Tenerife',
    lat: 28.4682, lng: -16.2546,
    start_date: '2027-02-10T20:00:00Z', end_date: '2027-02-21T23:59:00Z',
    category_slug: 'fiesta-popular', tags: ['carnaval', 'música', 'disfraces', 'tradición'],
  },
  {
    title: 'Carnavales de Cádiz',
    description: 'Famosos mundialmente por el ingenio, la ironía y la crítica social de sus chirigotas y comparsas. Las calles se llenan de humor, sátira y disfraces originales. El concurso oficial del Gran Teatro Falla es el epicentro de la fiesta.',
    short_description: 'Ingenio, sátira y chirigotas en las calles de Cádiz.',
    city: 'Cádiz', province: 'Cádiz',
    lat: 36.5271, lng: -6.2886,
    start_date: '2027-02-17T20:00:00Z', end_date: '2027-02-28T23:59:00Z',
    category_slug: 'fiesta-popular', tags: ['carnaval', 'chirigotas', 'humor', 'tradición'],
  },
  {
    title: 'Las Fallas de Valencia',
    description: 'Monumentos artísticos satíricos de cartón piedra que se plantan en las calles de Valencia. Incluye mascletás (espectáculos pirotécnicos sonoros), ofrendas de flores a la Virgen, y culmina con la Cremà: la quema espectacular de todos los monumentos. Una experiencia única de arte efímero, pólvora y tradición.',
    short_description: 'Monumentos satíricos, mascletás y la espectacular Cremà.',
    city: 'Valencia', province: 'Valencia',
    lat: 39.4699, lng: -0.3763,
    start_date: '2027-03-15T10:00:00Z', end_date: '2027-03-19T23:59:00Z',
    category_slug: 'fiesta-popular', tags: ['fallas', 'pirotecnia', 'arte-efímero', 'tradición'],
    max_capacity: 50000,
  },
  // ───────────── PRIMAVERA ─────────────
  {
    title: 'Semana Santa de Sevilla',
    description: 'La Semana Santa más famosa de España. Pasos procesionales con imágenes barrocas de incalculable valor artístico recorren las calles del centro. Saetas, nazarenos, palios y el canto de la Macarena crean una atmósfera de profunda emoción y arte barroco andaluz.',
    short_description: 'Pasos barrocos, nazarenos y saetas en las calles de Sevilla.',
    city: 'Sevilla', province: 'Sevilla',
    lat: 37.3891, lng: -5.9845,
    start_date: '2027-03-28T10:00:00Z', end_date: '2027-04-04T23:59:00Z',
    category_slug: 'fiesta-popular', tags: ['semana-santa', 'procesiones', 'barroco', 'tradición'],
    max_capacity: 100000,
  },
  {
    title: 'Semana Santa de Valladolid',
    description: 'Conocida por su sobriedad, realismo histórico y la impresionante calidad escultórica de sus pasos procesionales. La procesión general del Viernes Santo es una de las más impresionantes de España, con imaginería de los grandes maestros castellanos.',
    short_description: 'Sobriedad histórica y pasos escultóricos únicos.',
    city: 'Valladolid', province: 'Valladolid',
    lat: 41.6523, lng: -4.7245,
    start_date: '2027-03-28T10:00:00Z', end_date: '2027-04-04T23:59:00Z',
    category_slug: 'fiesta-popular', tags: ['semana-santa', 'procesiones', 'escultura', 'tradición'],
  },
  {
    title: 'Feria de Abril de Sevilla',
    description: 'Una ciudad efímera de casetas, farolillos y albero se levanta en el Real de la Feria. Trajes de flamenca, sevillanas, rebujito, paseos de caballos y ambiente festivo durante toda la semana. La noche se llena de luz y música en las casetas familiares y de peñas.',
    short_description: 'Casetas, flamenca, sevillanas y ambiente festivo único.',
    city: 'Sevilla', province: 'Sevilla',
    lat: 37.3725, lng: -5.9877,
    start_date: '2027-04-26T12:00:00Z', end_date: '2027-05-02T23:59:00Z',
    category_slug: 'feria', tags: ['feria', 'flamenca', 'sevillanas', 'casetas'],
    max_capacity: 80000,
  },
  {
    title: 'Festival de los Patios de Córdoba',
    description: 'Festival declarado Patrimonio Cultural Inmaterial de la Humanidad por la UNESCO. Los vecinos abren sus patios privados decorados con miles de macetas de flores, creando un espectáculo de color, aroma y arquitectura popular andaluza. Concurso incluido.',
    short_description: 'Patios decorados con flores, Patrimonio de la UNESCO.',
    city: 'Córdoba', province: 'Córdoba',
    lat: 37.8882, lng: -4.7794,
    start_date: '2027-05-04T10:00:00Z', end_date: '2027-05-18T22:00:00Z',
    category_slug: 'arte', tags: ['patios', 'flores', 'arte-popular', 'unesco'],
  },
  {
    title: 'Romería del Rocío — Almonte',
    description: 'La mayor romería de España. Miles de peregrinos (hermandades) cruzan el Parque de Doñana a pie, a caballo o en carreta para venerar a la Virgen del Rocío. Ambiente de devoción, cantes, trajes de flamenca y vivencia única de la religiosidad popular andaluza.',
    short_description: 'La mayor romería de España cruzando Doñana.',
    city: 'Almonte', province: 'Huelva',
    lat: 37.2648, lng: -6.5165,
    start_date: '2027-05-22T08:00:00Z', end_date: '2027-05-25T23:59:00Z',
    category_slug: 'feria', tags: ['romería', 'doñana', 'devoción', 'tradición'],
    max_capacity: 100000,
  },
  {
    title: 'Hogueras de San Juan — Alicante',
    description: 'Celebración del solsticio de verano con monumentos artísticos de madera y cartón (hogueras) que se queman en una noche mágica. Verbena, música, y la tradición de saltar las olas del mar a medianoche para purificarse. Las playas se llenan de hogueras en toda la costa.',
    short_description: 'Solsticio de verano con hogueras y baños de medianoche.',
    city: 'Alicante', province: 'Alicante',
    lat: 38.3452, lng: -0.4810,
    start_date: '2027-06-20T20:00:00Z', end_date: '2027-06-24T23:59:00Z',
    category_slug: 'fiesta-popular', tags: ['hogueras', 'san-juan', 'solsticio', 'playa'],
    max_capacity: 30000,
  },
  // ───────────── VERANO ─────────────
  {
    title: 'San Fermín — Pamplona',
    description: 'Famosos mundialmente por los encierros matutinos, donde los mozos corren delante de los toros por el casco antiguo de Pamplona. Además de los encierros, hay gigantes y cabezudos, la procesión del santo, conciertos y un ambiente festivo ininterrumpido. "¡Viva San Fermín!"',
    short_description: 'Los famosos encierros y la fiesta más internacional de España.',
    city: 'Pamplona', province: 'Navarra',
    lat: 42.8125, lng: -1.6458,
    start_date: '2027-07-06T08:00:00Z', end_date: '2027-07-14T23:59:00Z',
    category_slug: 'fiesta-popular', tags: ['san-fermín', 'encierros', 'toro', 'tradición'],
    max_capacity: 60000,
  },
  {
    title: 'Descenso Internacional del Sella',
    description: 'Fiesta piragüística masiva que une Arriondas y Ribadesella recorriendo 20 km del río Sella. Miles de piragüistas de todos los países participan en un ambiente deportivo y festivo único. La música de gaitas y el paisaje asturiano acompañan la travesía.',
    short_description: 'Miles de piragüistas recorriendo el río Sella en Asturias.',
    city: 'Arriondas', province: 'Asturias',
    lat: 43.3860, lng: -5.1893,
    start_date: '2027-08-07T10:00:00Z', end_date: '2027-08-07T20:00:00Z',
    category_slug: 'deportes', tags: ['piragüismo', 'sella', 'deporte', 'asturias'],
    max_capacity: 20000,
  },
  {
    title: 'La Tomatina de Buñol',
    description: 'La batalla campal de tomates más famosa del mundo. El último miércoles de agosto, el pueblo de Buñol se llena de toneladas de tomates maduros para una guerra fraternal sin igual. Reglas: aplastar el tomate antes de lanzarlo y no usar otros objetos.',
    short_description: 'Batalla de tomates gigante en las calles de Buñol.',
    city: 'Buñol', province: 'Valencia',
    lat: 39.4199, lng: -0.7923,
    start_date: '2027-08-25T10:00:00Z', end_date: '2027-08-25T14:00:00Z',
    category_slug: 'fiesta-popular', tags: ['tomatina', 'batalla', 'tomates', 'diversión'],
    max_capacity: 25000,
  },
  {
    title: 'Feria de Málaga',
    description: 'Gran fiesta veraniega dividida en dos ambientes: el centro histórico (día) con calles engalanadas, pasacalles y vino dulce; y el real de la feria en Cortijo de Torres (noche) con casetas, atracciones, flamenca y conciertos. Una semana de bullicio y alegría.',
    short_description: 'Feria de día en el centro y de noche en Cortijo de Torres.',
    city: 'Málaga', province: 'Málaga',
    lat: 36.7213, lng: -4.4214,
    start_date: '2027-08-13T12:00:00Z', end_date: '2027-08-20T23:59:00Z',
    category_slug: 'feria', tags: ['feria', 'flamenca', 'verano', 'málaga'],
    max_capacity: 50000,
  },
  // ───────────── OTOÑO ─────────────
  {
    title: 'Fiestas del Pilar — Zaragoza',
    description: 'Las fiestas mayores de Zaragoza en honor a la Virgen del Pilar. Destaca la Ofrenda de Flores, donde miles de personas vestidas con trajes regionales llenan la Plaza del Pilar con un manto floral gigante. También hay conciertos, procesiones de gigantes y cabezudos, y la tradicional Ofrenda de Frutos.',
    short_description: 'Ofrenda de Flores masiva y ambiente festivo en Zaragoza.',
    city: 'Zaragoza', province: 'Zaragoza',
    lat: 41.6488, lng: -0.8891,
    start_date: '2027-10-09T10:00:00Z', end_date: '2027-10-17T23:59:00Z',
    category_slug: 'fiesta-popular', tags: ['pilar', 'ofrenda-flores', 'tradición', 'zaragoza'],
    max_capacity: 70000,
  },
  {
    title: 'San Froilán — Lugo',
    description: 'Fiestas tradicionales con desfiles de carros engalanados, pendones, música tradicional y la mejor gastronomía gallega. El pulpo á feira es el plato estrella, con las pulpeiras sirviendo kilómetros de pulpo. Ambiente rural y festivo en la ciudad amurallada.',
    short_description: 'Carros engalanados, pendones y pulpo á feira en Lugo.',
    city: 'Lugo', province: 'Lugo',
    lat: 43.0097, lng: -7.5567,
    start_date: '2027-10-04T12:00:00Z', end_date: '2027-10-12T23:59:00Z',
    category_slug: 'feria', tags: ['san-froilán', 'pulpo', 'gastronomía', 'tradición'],
  },
  // ───────────── TRADICIONES REGIONALES ─────────────
  {
    title: 'Fiesta de la Mercè — Barcelona',
    description: 'La fiesta mayor de Barcelona con los impresionantes Castells (torres humanas), correfocs (diablos y fuego), gigantes y bestias de fuego. La plaza Sant Jaume se llena de cultura popular catalana, conciertos y actividades para toda la familia.',
    short_description: 'Castells, correfocs y cultura popular catalana.',
    city: 'Barcelona', province: 'Barcelona',
    lat: 41.3874, lng: 2.1686,
    start_date: '2027-09-20T10:00:00Z', end_date: '2027-09-24T23:59:00Z',
    category_slug: 'fiesta-popular', tags: ['mercè', 'castells', 'correfocs', 'cataluña'],
    max_capacity: 80000,
  },
  {
    title: 'Fiesta del Apóstol Santiago',
    description: 'El 25 de julio se celebra al patrón de España y de Galicia en Santiago de Compostela. Espectáculo de fuegos artificiales sobre la fachada de la Catedral, la Ofrenda Nacional al Apóstol, y la oportunidad de ver la meta de los peregrinos del Camino de Santiago.',
    short_description: 'Fuegos artificiales en la Catedral y meta del Camino.',
    city: 'Santiago de Compostela', province: 'A Coruña',
    lat: 42.8782, lng: -8.5448,
    start_date: '2027-07-20T10:00:00Z', end_date: '2027-07-31T23:59:00Z',
    category_slug: 'feria', tags: ['santiago', 'apóstol', 'catedral', 'camino-santiago'],
    max_capacity: 60000,
  },
  {
    title: 'Semana Grande / Aste Nagusia — Bilbao',
    description: 'La gran fiesta de Bilbao con fuegos artificiales cada noche, deporte rural vasco (aizkolaris, harrijasotzailes), conciertos, txosnas (casetas) y la tradicional bajada del txupín. Nueve días de cultura vasca, música y diversión.',
    short_description: 'Fuegos artificiales, deporte rural y cultura vasca.',
    city: 'Bilbao', province: 'Vizcaya',
    lat: 43.2630, lng: -2.9350,
    start_date: '2027-08-19T10:00:00Z', end_date: '2027-08-27T23:59:00Z',
    category_slug: 'feria', tags: ['aste-nagusia', 'fuegos', 'deporte-rural', 'país-vasco'],
    max_capacity: 50000,
  },
  {
    title: 'El Entierro de la Sardina — Murcia',
    description: 'Desfile satírico que cierra las fiestas de primavera de Murcia. Una comitiva fúnebre burlesca despide a la sardina entre llantos fingidos, disfraces irónicos y lanzamiento de juguetes y caramelos. Una tradición única que mezcla crítica social, humor y folclore.',
    short_description: 'Desfile satírico que entierra la sardina con humor.',
    city: 'Murcia', province: 'Murcia',
    lat: 37.9922, lng: -1.1307,
    start_date: '2027-04-10T18:00:00Z', end_date: '2027-04-10T23:59:00Z',
    category_slug: 'fiesta-popular', tags: ['entierro-sardina', 'sátira', 'humor', 'murcia'],
    max_capacity: 20000,
  },
]

async function main() {
  console.log('🔌 Conectando...')

  // 1. Get admin user
  const { data: { users }, error: uErr } = await supabase.auth.admin.listUsers()
  if (uErr) { console.error('❌ Error obteniendo usuarios:', uErr.message); return }
  const admin = users.find(u => u.email === 'admin@test.com')
  if (!admin) { console.error('❌ admin@test.com no encontrado'); return }
  console.log(`✓ Admin: ${admin.id}`)

  // 2. Get or create organizer for admin
  let organizerId
  const { data: existingOrg } = await supabase.from('organizers').select('id').eq('user_id', admin.id).single()
  if (existingOrg) {
    organizerId = existingOrg.id
    console.log(`✓ Organizador existente: ${organizerId}`)
  } else {
    const { data: newOrg, error: orgErr } = await supabase.from('organizers').insert({
      user_id: admin.id, org_name: 'Plataforma de Eventos Culturales',
      org_type: 'company', description: 'Catálogo oficial de fiestas tradicionales españolas',
      is_approved: true,
    }).select('id').single()
    if (orgErr) { console.error('❌ Error creando organizador:', orgErr.message); return }
    organizerId = newOrg.id
    console.log(`✓ Organizador creado: ${organizerId}`)
  }

  // 3. Get category IDs
  const { data: cats } = await supabase.from('categories').select('id, slug')
  if (!cats) { console.error('❌ No se pudieron obtener categorías'); return }
  const catMap = {}
  for (const c of cats) catMap[c.slug] = c.id
  console.log(`✓ ${cats.length} categorías cargadas`)

  // 4. Insert events
  let created = 0
  for (const ev of EVENTS) {
    const category_id = catMap[ev.category_slug]
    if (!category_id) { console.warn(`⚠️ Categoría "${ev.category_slug}" no encontrada para "${ev.title}"`); continue }

    // Check if event already exists (by title to avoid duplicates)
    const { data: existing } = await supabase.from('events').select('id').eq('title', ev.title).maybeSingle()
    if (existing) { console.log(`  ↳ "${ev.title}" ya existe (${existing.id})`); created++; continue }

    const { error: insErr } = await supabase.from('events').insert({
      organizer_id: organizerId,
      title: ev.title,
      description: ev.description,
      short_description: ev.short_description,
      city: ev.city,
      province: ev.province,
      country: 'España',
      address: `${ev.city}, ${ev.province}`,
      location: `POINT(${ev.lng} ${ev.lat})`,
      start_date: ev.start_date,
      end_date: ev.end_date,
      category_id,
      status: 'published',
      max_capacity: ev.max_capacity ?? 10000,
      remaining_capacity: ev.max_capacity ?? 10000,
      is_free: true,
      currency: 'EUR',
      tags: ev.tags,
    })
    if (insErr) { console.error(`❌ "${ev.title}": ${insErr.message}`) }
    else { console.log(`✅ "${ev.title}" creado`); created++ }
  }

  console.log(`\n✅ Proceso completado: ${created}/${EVENTS.length} eventos creados`)
}

main().catch(console.error)
