import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const url = 'https://qafghfpmjvrfltpprssb.supabase.co'
const anon = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFhZmdoZnBtanZyZmx0cHByc3NiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk5NTg4ODgsImV4cCI6MjA3NTUzNDg4OH0.NUtD9_LM9ekDwFFCnSajECGvKGnYSueh3dO7ZfuXVqs'

const email = 'admin@sistema.com'
const password = 'admin123456'

async function main() {
  const sb = createClient(url, anon)
  const { data, error } = await sb.auth.signInWithPassword({ email, password })
  if (error) {
    console.error('auth error:', error)
    process.exit(1)
  }
  const token = data?.session?.access_token || ''
  const output = { access_token: token, user: data.user }
  fs.writeFileSync('token-superadmin.json', JSON.stringify(output, null, 2))
  console.log('Wrote token-superadmin.json with token and user info')
}

main().catch(err => { console.error(err); process.exit(1) })