import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error('❌ Erro: SUPABASE_URL/VITE_SUPABASE_URL ou SUPABASE_SERVICE_ROLE não encontrados no .env')
  console.error('Dica: crie um arquivo .env com SUPABASE_URL e SUPABASE_SERVICE_ROLE (service role key).')
  process.exit(1)
}

const [,, emailArg, passwordArg, tenantNameArg] = process.argv

if (!emailArg || !passwordArg) {
  console.error('Uso: node scripts/create-superadmin-user.js <email> <senha> [nome_do_tenant]')
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
    // Atualiza a senha e confirma email
    const { data, error } = await supabase.auth.admin.updateUserById(existing.id, {
      password,
      email_confirm: true
    })
    if (error) throw error
    return data.user
  }
  // Criar novo
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true
  })
  if (error) throw error
  return data.user
}

async function ensureTenant(name) {
  // Tenta encontrar por nome
  let { data: existingByName, error: findErr } = await supabase
    .from('tenants')
    .select('id, name, domain, plan, status')
    .eq('name', name)
    .limit(1)

  if (findErr) throw findErr
  if (existingByName && existingByName.length > 0) return existingByName[0]

  // Cria novo tenant com domain baseado no nome
  const domain = `${slugify(name)}.local`
  const insertPayload = { name, domain, plan: 'enterprise', status: 'active' }

  const { data, error } = await supabase
    .from('tenants')
    .insert(insertPayload)
    .select('id, name, domain, plan, status')
    .single()

  if (error) {
    // Se houve conflito de domínio, tenta recuperar por domínio
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

async function ensureUserTenantRole(userId, tenantId) {
  const { data: existing, error: findErr } = await supabase
    .from('user_tenants')
    .select('id, role, status')
    .eq('user_id', userId)
    .eq('tenant_id', tenantId)
    .limit(1)

  if (findErr) throw findErr

  if (existing && existing.length > 0) {
    const rec = existing[0]
    if (rec.role !== 'SUPERADMIN' || rec.status !== 'active') {
      const { error: updErr } = await supabase
        .from('user_tenants')
        .update({ role: 'SUPERADMIN', status: 'active' })
        .eq('id', rec.id)
      if (updErr) throw updErr
    }
    return
  }

  const { error } = await supabase
    .from('user_tenants')
    .insert({ user_id: userId, tenant_id: tenantId, role: 'SUPERADMIN', status: 'active' })

  if (error) throw error
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
      max_users: 999,
      max_instances: 999,
      max_campaigns: 999,
      max_messages_per_month: 999999
    })
  if (error) throw error
}

async function main() {
  try {
    console.log('🚀 Iniciando criação/garantia de SUPERADMIN...')

    const user = await ensureUser(email, password)
    console.log('✅ Usuário pronto:', user.email)

    const tenant = await ensureTenant(tenantName)
    console.log('✅ Tenant pronto:', tenant.name, `(${tenant.domain})`)

    await ensureUserTenantRole(user.id, tenant.id)
    console.log('✅ Associação como SUPERADMIN OK')

    await ensureTenantQuotas(tenant.id)
    console.log('✅ Quotas do tenant OK')

    console.log('\n🎉 Tudo pronto!')
    console.log('📧 Email:', email)
    console.log('🔑 Senha:', password)
    console.log('🏢 Tenant:', tenant.name)
    console.log('👑 Role: SUPERADMIN')
  } catch (err) {
    console.error('❌ Falha:', err.message || err)
    process.exit(1)
  }
}

main()