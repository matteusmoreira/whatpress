const { createClient } = require('@supabase/supabase-js')
require('dotenv').config()

// Configuração do Supabase
const supabaseUrl = process.env.SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Variáveis de ambiente SUPABASE_URL e SUPABASE_SERVICE_ROLE são obrigatórias')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function createSuperAdmin() {
  try {
    console.log('🚀 Criando usuário SuperAdmin...')
    
    // 1. Criar usuário
    const { data: user, error: userError } = await supabase.auth.admin.createUser({
      email: 'admin@sistema.com',
      password: 'admin123456',
      email_confirm: true
    })

    if (userError) {
      console.error('❌ Erro ao criar usuário:', userError)
      return
    }

    console.log('✅ Usuário criado:', user.user.email)

    // 2. Criar tenant principal
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .insert({
        name: 'Sistema Principal',
        domain: 'sistema.com',
        plan: 'enterprise',
        status: 'active'
      })
      .select()
      .single()

    if (tenantError) {
      console.error('❌ Erro ao criar tenant:', tenantError)
      return
    }

    console.log('✅ Tenant criado:', tenant.name)

    // 3. Associar usuário como SUPERADMIN
    const { error: assocError } = await supabase
      .from('user_tenants')
      .insert({
        user_id: user.user.id,
        tenant_id: tenant.id,
        role: 'SUPERADMIN',
        status: 'active'
      })

    if (assocError) {
      console.error('❌ Erro ao associar usuário:', assocError)
      return
    }

    console.log('✅ Usuário associado como SUPERADMIN')

    // 4. Criar quotas para o tenant
    const { error: quotaError } = await supabase
      .from('tenant_quotas')
      .insert({
        tenant_id: tenant.id,
        max_users: 999,
        max_instances: 999,
        max_campaigns: 999,
        max_messages_per_month: 999999
      })

    if (quotaError) {
      console.error('❌ Erro ao criar quotas:', quotaError)
      return
    }

    console.log('✅ Quotas criadas')

    console.log('\n🎉 SuperAdmin criado com sucesso!')
    console.log('📧 Email: admin@sistema.com')
    console.log('🔑 Senha: admin123456')
    console.log('🏢 Tenant: Sistema Principal')
    console.log('👑 Role: SUPERADMIN')

  } catch (error) {
    console.error('❌ Erro geral:', error)
  }
}

createSuperAdmin()