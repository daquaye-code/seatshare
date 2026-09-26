import { createClient } from '@supabase/supabase-js'

// Strip spaces, quotes and invisible characters picked up when pasting
const clean = (v) => (v || '').replace(/[^\x21-\x7E]/g, '').replace(/^["']|["']$/g, '')

const url = clean(import.meta.env.VITE_SUPABASE_URL).replace(/\/+$/, '')
const key = clean(import.meta.env.VITE_SUPABASE_ANON_KEY)

if (!url.startsWith('https://') || !key) {
  console.error('SeatShare: Supabase URL or key is missing or malformed', { url, keyStart: key.slice(0, 15) })
}

export const supabase = createClient(url, key)
