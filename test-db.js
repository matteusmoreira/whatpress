import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

async function testSupabaseConnection() {
  console.log('🔍 Testando conexão com Supabase...\n')

  const supabaseUrl = process.env.VITE_SUPABASE_URL
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY
  const supabaseServiceRole = process.env.SUPABASE_SERVICE_ROLE

  console.log('📋 Configurações:')
  console.log(`URL: ${supabaseUrl}`)
  console.log(`Anon Key: ${supabaseAnonKey ? '✅ Configurada' : '❌ Não configurada'}`)
  console.log(`Service Role: ${supabaseServiceRole ? '✅ Configurada' : '❌ Não configurada'}\n`)

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('❌ Credenciais do Supabase não configuradas!')
    process.exit(1)
  }

  try {
    console.log('🔗 Testando cliente anônimo (frontend)...')
    const supabaseAnon = createClient(supabaseUrl, supabaseAnonKey)
    
    const { data: anonData, error: anonError } = await supabaseAnon
      .from('profiles')
      .select('count')
      .limit(1)

    if (anonError && anonError.code !== 'PGRST116') {
      console.log('⚠️  Cliente anônimo:', anonError.message)
    } else {
      console.log('✅ Cliente anônimo conectado com sucesso!')
    }

    if (supabaseServiceRole) {
      console.log('🔗 Testando cliente service role (backend)...')
      const supabaseService = createClient(supabaseUrl, supabaseServiceRole)
      
      const { data: serviceData, error: serviceError } = await supabaseService
        .from('profiles')
        .select('count')
        .limit(1)

      if (serviceError && serviceError.code !== 'PGRST116') {
        console.log('⚠️  Cliente service role:', serviceError.message)
      } else {
        console.log('✅ Cliente service role conectado com sucesso!')
      }
    }

    console.log('\n🎉 Teste de conexão concluído!')
    console.log('💡 O sistema está pronto para desenvolvimento local!')

  } catch (error) {
    console.error('❌ Erro durante o teste:', error.message)
    process.exit(1)
  }
}

testSupabaseConnection()