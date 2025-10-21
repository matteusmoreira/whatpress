import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error('❌ Erro: SUPABASE_URL/VITE_SUPABASE_URL ou SUPABASE_SERVICE_ROLE não encontrados')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey)

async function getUserIdByEmail(email) {
  let page = 1
  const perPage = 1000
  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage })
    if (error) throw error
    const found = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase())
    if (found) return found.id
    if (!data.users || data.users.length < perPage) break
    page += 1
  }
  throw new Error('Usuário não encontrado: ' + email)
}

async function listUserTenants(email) {
  const userId = await getUserIdByEmail(email)

  const { data, error } = await supabase
    .from('user_tenants')
    .select('tenant_id, role, tenants ( id, name, plan )')
    .eq('user_id', userId)

  if (error) throw error

  if (!data || data.length === 0) {
    console.log('ℹ️ Usuário não possui tenants associados')
    return []
  }

  const result = data.map((row) => ({
    tenant_id: row.tenant_id,
    role: row.role,
    name: row.tenants?.name || '—',
    plan: row.tenants?.plan || '—'
  }))

  console.table(result)
  return result
}

const email = process.argv[2] || 'superadmin@local.test'
listUserTenants(email)
  .then(() => process.exit(0))
  .catch((err) => { console.error('❌ Erro:', err.message); process.exit(1) })