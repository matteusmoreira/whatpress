import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

// Configuração do Supabase com service role key
const supabaseUrl = process.env.SUPABASE_URL
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error('❌ Erro: SUPABASE_URL ou SUPABASE_SERVICE_ROLE não encontrados no .env')
  process.exit(1)
}

// Cliente Supabase com service role (permite operações admin)
const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function createAdminUser() {
  try {
    console.log('🔄 Criando usuário admin...')
    
    // Dados do usuário admin
    const userData = {
      email: 'matteusmoreira@gmail.com',
      password: '@moreira2025',
      email_confirm: true, // Confirma o email automaticamente
      user_metadata: {
        name: 'Matteus Moreira',
        role: 'admin'
      }
    }

    // Criar usuário usando o service role
    const { data, error } = await supabase.auth.admin.createUser(userData)

    if (error) {
      console.error('❌ Erro ao criar usuário:', error.message)
      return
    }

    console.log('✅ Usuário admin criado com sucesso!')
    console.log('📧 Email:', data.user.email)
    console.log('👤 Nome:', data.user.user_metadata.name)
    console.log('🔑 Role:', data.user.user_metadata.role)
    console.log('🆔 ID:', data.user.id)
    console.log('✉️ Email confirmado:', data.user.email_confirmed_at ? 'Sim' : 'Não')

  } catch (error) {
    console.error('❌ Erro inesperado:', error.message)
  }
}

// Executar a função
createAdminUser()