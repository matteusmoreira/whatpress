import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error('❌ Erro: SUPABASE_URL/VITE_SUPABASE_URL ou SUPABASE_SERVICE_ROLE não encontrados no .env')
  process.exit(1)
}

const [,, emailArg, passwordArg, roleArg = 'USER', tenantNameArg = 'Sistema Principal'] = process.argv

if (!emailArg || !passwordArg) {
  console.error('Uso: node scripts/create-tenant-user.js <email> <senha> [role=USER|ADMIN|SUPERADMIN] [nome_do_tenant="Sistema Principal"]')
  process.exit(1)
}

const VALID_ROLES = ['USER','ADMIN','SUPERADMIN']
const role = (roleArg || 'USER').toUpperCase()
if (!VALID_ROLES.includes(role)) {
  console.error('❌ Role inválida. Use uma de:', VALID_ROLES.join(', '))
  process.exit(1)
}

const email = emailArg.trim().toLowerCase()
const password = passwordArg
const tenantName = (tenantNameArg && tenantNameArg.trim()) || 'Sistema Principal'

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false }
})

function slugify(str) {
  return String(str)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '')
}

async function findAuthUserByEmail(targetEmail) {
  try {
    let page = 1
    const perPage = 200
    while (page <= 15) {
      const { data, error } = await supabase.auth.admin.listUsers({ page, perPage })
      if (error) throw error
      const user = data.users.find(u => (u.email || '').toLowerCase() === targetEmail)
      if (user) return user
      if (!data.users.length) break
      page++
    }
    return null
  } catch (err) {
    console.error('❌ Erro ao listar usuários:', err.message)
    return null
  }
}

async function ensureUser(email, password) {
  const existing = await findAuthUserByEmail(email)
  if (existing) {
    const { data, error } = await supabase.auth.admin.updateUserById(existing.id, {
      password,
      email_confirm: true
    })
    if (error) throw error
    return data.user
  }
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true
  })
  if (error) throw error
  return data.user
}

async function ensureTenant(name) {
  let { data: existingByName, error: findErr } = await supabase
    .from('tenants')
    .select('id, name, domain, plan, status')
    .eq('name', name)
    .limit(1)
  if (findErr) throw findErr
  if (existingByName && existingByName.length > 0) return existingByName[0]

  const domain = `${slugify(name)}.local`
  const insertPayload = { name, domain, plan: 'starter', status: 'active' }

  const { data, error } = await supabase
    .from('tenants')
    .insert(insertPayload)
    .select('id, name, domain, plan, status')
    .single()

  if (error) {
    const { data: byDomain } = await supabase
      .from('tenants')
      .select('id, name, domain, plan, status')
      .eq('domain', domain)
      .limit(1)
    if (byDomain && byDomain.length > 0) return byDomain[0]
    throw error
  }

  return data
}

async function ensureTenantQuotas(tenantId) {
  const { data: existing, error: findErr } = await supabase
    .from('tenant_quotas')
    .select('id')
    .eq('tenant_id', tenantId)
    .limit(1)

  if (findErr) throw findErr
  if (existing && existing.length > 0) return

  const { error } = await supabase
    .from('tenant_quotas')
    .insert({
      tenant_id: tenantId,
      max_users: 10,
      max_instances: 3,
      max_campaigns: 50,
      max_messages_per_month: 50000
    })
  if (error) throw error
}

async function ensureUserTenantRole(userId, tenantId, role) {
  const { data: existing, error: findErr } = await supabase
    .from('user_tenants')
    .select('id, role, status')
    .eq('user_id', userId)
    .eq('tenant_id', tenantId)
    .limit(1)
  if (findErr) throw findErr

  if (existing && existing.length > 0) {
    const rec = existing[0]
    if (rec.role !== role || rec.status !== 'active') {
      const { error: updErr } = await supabase
        .from('user_tenants')
        .update({ role, status: 'active' })
        .eq('id', rec.id)
      if (updErr) throw updErr
    }
    return
  }

  const { error } = await supabase
    .from('user_tenants')
    .insert({ user_id: userId, tenant_id: tenantId, role, status: 'active' })
  if (error) throw error
}

async function main() {
  try {
    console.log('🚀 Criando/garantindo usuário do tenant...')
    const user = await ensureUser(email, password)
    console.log('✅ Usuário pronto:', user.email)

    const tenant = await ensureTenant(tenantName)
    console.log('✅ Tenant pronto:', tenant.name, `(${tenant.domain})`)

    await ensureTenantQuotas(tenant.id)
    console.log('✅ Quotas OK')

    await ensureUserTenantRole(user.id, tenant.id, role)
    console.log(`✅ Associação ${role} OK`)

    console.log('\n🎉 Tudo pronto!')
    console.log('📧 Email:', email)
    console.log('🔑 Senha:', password)
    console.log('🏢 Tenant:', tenant.name)
    console.log('👤 Role:', role)
  } catch (err) {
    console.error('❌ Falha:', err.message || err)
    process.exit(1)
  }
}

main()