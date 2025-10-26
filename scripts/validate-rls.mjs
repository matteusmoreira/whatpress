import fs from 'fs'
import path from 'path'
import { createClient } from '@supabase/supabase-js'

function loadToken(jsonPath) {
  try {
    const raw = fs.readFileSync(jsonPath, 'utf-8')
    const data = JSON.parse(raw)
    // common formats: { access_token } or { token }
    return data.access_token || data.token || null
  } catch (e) {
    return null
  }
}

function clientForToken(url, anon, token) {
  return createClient(url, anon, {
    global: {
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    }
  })
}

async function getUserTenants(supabase) {
  const { data, error } = await supabase
    .from('user_tenants')
    .select('tenant_id')
  if (error) throw error
  return (data || []).map((r) => r.tenant_id)
}

async function tableTenantIds(supabase, table, extraSelect = '') {
  const select = ['tenant_id']
  if (extraSelect) select.push(extraSelect)
  const { data, error } = await supabase
    .from(table)
    .select(select.join(','))
    .limit(100)
  if (error) throw error
  return data || []
}

function assertSubset(rows, allowedTenantIds, tableName) {
  const bad = rows.filter((r) => !allowedTenantIds.includes(r.tenant_id))
  if (bad.length > 0) {
    throw new Error(`RLS VIOLADO: ${tableName} retornou ${bad.length} linhas fora dos tenants permitidos: ${bad.map(b => b.tenant_id).join(', ')}`)
  }
}

async function runForUser(label, token, url, anon) {
  console.log(`\n=== Validando RLS para ${label} ===`)
  if (!token) {
    console.warn(`Token não encontrado para ${label}. Pulei este usuário.`)
    return
  }
  const supabase = clientForToken(url, anon, token)

  const myTenants = await getUserTenants(supabase)
  console.log(`${label} tenants:`, myTenants)
  if (myTenants.length === 0) {
    console.warn('Usuário sem tenants. Verifique user_tenants.')
  }

  const campaigns = await tableTenantIds(supabase, 'campaigns', 'id')
  assertSubset(campaigns, myTenants, 'campaigns')
  console.log(`campaigns OK (${campaigns.length} linhas)`)

  const contacts = await tableTenantIds(supabase, 'contacts', 'id')
  assertSubset(contacts, myTenants, 'contacts')
  console.log(`contacts OK (${contacts.length} linhas)`)

  const queue = await tableTenantIds(supabase, 'message_queue', 'id,status')
  assertSubset(queue, myTenants, 'message_queue')
  console.log(`message_queue OK (${queue.length} linhas)`)

  const metrics = await tableTenantIds(supabase, 'campaign_metrics', 'id')
  assertSubset(metrics, myTenants, 'campaign_metrics')
  console.log(`campaign_metrics OK (${metrics.length} linhas)`)

  const logs = await tableTenantIds(supabase, 'campaign_execution_logs', 'id')
  assertSubset(logs, myTenants, 'campaign_execution_logs')
  console.log(`campaign_execution_logs OK (${logs.length} linhas)`)

  const templates = await tableTenantIds(supabase, 'message_templates', 'id')
  assertSubset(templates, myTenants, 'message_templates')
  console.log(`message_templates OK (${templates.length} linhas)`)

  const instances = await tableTenantIds(supabase, 'whatsapp_instances', 'id')
  assertSubset(instances, myTenants, 'whatsapp_instances')
  console.log(`whatsapp_instances OK (${instances.length} linhas)`)

  // Detecta SUPERADMIN e pula validação restritiva de tenants
  let isSuperadmin = false
  try {
    const { data } = await supabase
      .from('user_tenants')
      .select('role')
      .eq('role', 'SUPERADMIN')
      .limit(1)
    isSuperadmin = !!(data && data.length > 0)
  } catch (_) {}

  // Tenants tem coluna id (não tenant_id). Normaliza para validar.
  const { data: tenantsData, error: tenantsErr } = await supabase
    .from('tenants')
    .select('id')
    .limit(100)
  if (tenantsErr) throw tenantsErr
  const tenants = (tenantsData || []).map((r) => ({ tenant_id: r.id }))

  if (isSuperadmin) {
    console.log('tenants: Usuário SUPERADMIN pode ver todos os tenants (policy). Pulando checagem de restrição por tenant_id).')
  } else {
    assertSubset(tenants, myTenants, 'tenants')
    console.log(`tenants OK (${tenants.length} linhas)`)
  }

  console.log(`RLS validado para ${label}. Nenhuma fuga de dados entre tenants detectada.`)
}

async function main() {
  const url = process.env.SUPABASE_URL
  const anon = process.env.SUPABASE_ANON_KEY
  if (!url || !anon) {
    console.error('Defina SUPABASE_URL e SUPABASE_ANON_KEY no ambiente antes de rodar.');
    process.exit(1)
  }

  const root = process.cwd()
  const adminTokenPath = path.join(root, 'token-admin.json')
  const superTokenPath = path.join(root, 'token-superadmin.json')

  const adminToken = loadToken(adminTokenPath)
  const superToken = loadToken(superTokenPath)

  await runForUser('Admin', adminToken, url, anon)
  await runForUser('SuperAdmin', superToken, url, anon)

  console.log('\nValidação concluída.')
}

main().catch((e) => {
  console.error('Falha na validação de RLS:', e)
  process.exit(1)
})