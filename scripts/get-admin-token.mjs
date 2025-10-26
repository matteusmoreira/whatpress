import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const anon = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY

const email = process.env.ADMIN_EMAIL || 'admin-normal@local.test'
const password = process.env.ADMIN_PASSWORD || 'admin123'

async function main() {
  if (!url || !anon) {
    console.error('❌ SUPABASE_URL/ANON_KEY não definidos no .env')
    process.exit(1)
  }
  const sb = createClient(url, anon)
  const { data, error } = await sb.auth.signInWithPassword({ email, password })
  if (error) {
    console.error('auth error:', error)
    process.exit(1)
  }
  const token = data?.session?.access_token || ''
  const output = { access_token: token, user: data.user }
  fs.writeFileSync('token-admin.json', JSON.stringify(output, null, 2))
  console.log('Wrote token-admin.json for', email)
}

main().catch(err => { console.error(err); process.exit(1) })