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

  if (error) {
    console.error('❌ Erro ao buscar usuário:', error.message)
    process.exit(1)
  }

  if (!data || data.length === 0) {
    console.error('❌ Usuário não encontrado em public.users:', email)
    process.exit(1)
  }

  console.log('✅ Usuário encontrado:', data[0])
  return data[0].id
}

const email = process.argv[2] || 'matteusmoreira@gmail.com'
getUserIdByEmail(email).then((id) => {
  console.log('🆔 ID do usuário:', id)
}).catch((err) => {
  console.error('❌ Erro inesperado:', err)
  process.exit(1)
})