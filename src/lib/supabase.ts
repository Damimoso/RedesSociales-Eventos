import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY env vars')
}

const MOCK_RPCS = new Set(['get_feed', 'check_streak'])

const supabaseFetch: typeof fetch = async (url, opts) => {
  const urlStr = typeof url === 'string' ? url : url instanceof URL ? url.href : url.url
  for (const rpc of MOCK_RPCS) {
    if (urlStr.includes(`/rpc/${rpc}`)) {
      return new Response('[]', { status: 200, headers: { 'Content-Type': 'application/json' } })
    }
  }
  return fetch(url, opts)
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, { fetch: supabaseFetch } as any)
