import pg from 'pg'
const { Client } = pg
const c = new Client({
  host: 'db.ntkrsjwpxfubsayxqezd.supabase.co',
  port: 5432,
  database: 'postgres',
  user: 'postgres',
  password: 'Escondite-3',
  ssl: { rejectUnauthorized: false },
})
await c.connect()
const r = await c.query("SELECT prosrc FROM pg_proc WHERE proname='check_streak'")
const s = r.rows[0].prosrc
console.log('HAS null guard:', s.includes('v_user_id IS NULL THEN'))
console.log('RETURNS (0,0):', s.includes('current_streak := 0'))
console.log('First 300 chars:', s.substring(0, 300))
await c.end()
