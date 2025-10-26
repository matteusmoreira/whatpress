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
  const { data, error } = await supabase
    .from('users')
    .select('id, email')
    .eq('email', email)
    .limit(1)
  if (error) throw error
  if (!data || data.length === 0) throw new Error('Usuário não encontrado: ' + email)
  return data[0].id
}

async function getPrimaryTenantIdByUser(userId) {
  const { data, error } = await supabase
    .from('user_tenants')
    .select('tenant_id, role')
    .eq('user_id', userId)
    .order('role', { ascending: false })
    .limit(1)
  if (error) throw error
  if (!data || data.length === 0) throw new Error('Usuário não possui tenant associado: ' + userId)
  return data[0].tenant_id
}

async function ensureUserHasTenant(userId) {
  try {
    return await getPrimaryTenantIdByUser(userId)
  } catch (e) {
    // Criar um tenant demo e vincular o usuário
    const tenantName = `Demo Tenant (${userId.slice(0, 8)})`
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .insert({ name: tenantName })
      .select('id')
      .single()
    if (tenantError) throw tenantError

    const { error: linkError } = await supabase
      .from('user_tenants')
      .insert({ user_id: userId, tenant_id: tenant.id, role: 'SUPERADMIN' })
    if (linkError) throw linkError

    console.log('🏢 Tenant demo criado e vinculado ao usuário:', tenant.id)
    return tenant.id
  }
}

async function ensureDemoInstance(userId, tenantId) {
  const apiKey = 'demo-instance'
  const name = 'Demo Instance'
  const webhookUrl = 'http://localhost:3001/webhook'

  // Verificar se já existe
  const { data: existing, error: existError } = await supabase
    .from('whatsapp_instances')
    .select('id, name, status, api_key, tenant_id')
    .eq('api_key', apiKey)
    .limit(1)
  if (existError) throw existError

  if (existing && existing.length > 0) {
    console.log('ℹ️ Instância já existe:', existing[0])
    // Garantir que tenha tenant_id definido
    if (!existing[0].tenant_id) {
      await supabase
        .from('whatsapp_instances')
        .update({ tenant_id: tenantId })
        .eq('id', existing[0].id)
      console.log('🔧 tenant_id atualizado na instância existente')
    }
    return existing[0].id
  }

  // Criar nova instância
  const { data, error } = await supabase
    .from('whatsapp_instances')
    .insert({
      user_id: userId,
      tenant_id: tenantId,
      name,
      status: 'disconnected',
      api_key: apiKey,
      webhook_url: webhookUrl,
      last_activity: new Date().toISOString()
    })
    .select('id')
    .single()

  if (error) throw error

  console.log('✅ Instância criada com sucesso! ID:', data.id)
  return data.id
}

async function main() {
  try {
    const email = process.argv[2] || 'matteusmoreira@gmail.com'
    const userId = await getUserIdByEmail(email)
    const tenantId = await ensureUserHasTenant(userId)
    const instanceId = await ensureDemoInstance(userId, tenantId)
    console.log('🆔 ID da instância demo:', instanceId)
  } catch (err) {
    console.error('❌ Erro:', err.message)
    process.exit(1)
  }
}

main()