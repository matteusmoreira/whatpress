import 'dotenv/config'
import fs from 'fs'
import path from 'path'
import { createClient } from '@supabase/supabase-js'

function loadToken(jsonPath) {
  try {
    const raw = fs.readFileSync(jsonPath, 'utf-8')
    const data = JSON.parse(raw)
    return data.access_token || data.token || null
  } catch (e) {
    return null
  }
}

function clientForToken(url, anon, token) {
  return createClient(url, anon, {
    global: { headers: token ? { Authorization: `Bearer ${token}` } : {} }
  })
}

async function getUserTenants(supabase) {
  const { data, error } = await supabase.from('user_tenants').select('tenant_id')
  if (error) throw error
  return (data || []).map((r) => r.tenant_id)
}

async function tableTenantIds(supabase, table, extraSelect = '') {
  const selectCols = table === 'tenants' ? ['id'] : ['tenant_id']
  if (extraSelect) selectCols.push(extraSelect)
  const { data, error } = await supabase.from(table).select(selectCols.join(',')).limit(100)
  if (error) throw error
  const rows = data || []
  if (table === 'tenants') return rows.map((r) => ({ ...r, tenant_id: r.id }))
  return rows
}

function assertSubset(rows, allowedTenantIds, tableName) {
  const bad = rows.filter((r) => !allowedTenantIds.includes(r.tenant_id))
  if (bad.length > 0) {
    throw new Error(`RLS VIOLADO: ${tableName} retornou ${bad.length} linhas fora dos tenants permitidos: ${bad.map((b) => b.tenant_id).join(', ')}`)
  }
}

async function runForUser(label, token, url, anon) {
  console.log(`\n=== Validando RLS para ${label} ===`)
  if (!token) {
    console.warn(`Token não encontrado para ${label}. Pulei este usuário.`)
    return
  }
  const supabase = clientForToken(url, anon, token)

  let myTenants
  try {
    myTenants = await getUserTenants(supabase)
    console.log(`${label} tenants:`, myTenants)
    if (myTenants.length === 0) console.warn('Usuário sem tenants. Verifique user_tenants.')
  } catch (e) {
    console.error('Falha ao obter tenants do usuário:', e.message || e)
    return
  }

  const checks = [
    ['campaigns', 'id'],
    ['contacts', 'id'],
    ['message_queue', 'id,status'],
    ['campaign_metrics', 'id'],
    ['campaign_execution_logs', 'id'],
    ['message_templates', 'id'],
    ['whatsapp_instances', 'id'],
    ['tenants', 'id']
  ]

  // Detecta SuperAdmin a partir de associações do próprio usuário
  let isSuperadmin = false
  try {
    const { data } = await supabase
      .from('user_tenants')
      .select('role')
      .eq('role', 'SUPERADMIN')
      .limit(1)
    isSuperadmin = !!(data && data.length > 0)
  } catch (e) {
    // Ignora erro nesta checagem auxiliar
  }

  for (const [table, extra] of checks) {
    try {
      if (isSuperadmin && table === 'tenants') {
        console.log('tenants: Usuário SUPERADMIN pode ver todos os tenants (policy). Pulando checagem de restrição por tenant_id).')
        continue
      }
      const rows = await tableTenantIds(supabase, table, extra)
      assertSubset(rows, myTenants, table)
      console.log(`${table} OK (${rows.length} linhas)`)    
    } catch (e) {
      console.error(`Erro em ${table}:`, e.message || e)
    }
  }

  console.log(`RLS validado (parcial) para ${label}.`)
}

async function main() {
  const url = process.env.SUPABASE_URL
  const anon = process.env.SUPABASE_ANON_KEY
  if (!url || !anon) {
    console.error('Defina SUPABASE_URL e SUPABASE_ANON_KEY no ambiente antes de rodar.')
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