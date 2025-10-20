import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error('❌ Erro: SUPABASE_URL ou SUPABASE_SERVICE_ROLE não encontrados no .env')
  process.exit(1)
}

const [,, emailArg, newPasswordArg] = process.argv

if (!emailArg || !newPasswordArg) {
  console.error('Uso: node scripts/set-user-password.js <email> <nova_senha>')
  process.exit(1)
}

const email = emailArg.trim().toLowerCase()
const newPassword = newPasswordArg

// Cliente Supabase com service role
const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false }
})

async function findUserIdByEmail(targetEmail) {
  try {
    let page = 1
    const perPage = 200
    while (page <= 10) { // limitar a 10 páginas por segurança
      const { data, error } = await supabase.auth.admin.listUsers({ page, perPage })
      if (error) throw error
      const user = data.users.find(u => (u.email || '').toLowerCase() === targetEmail)
      if (user) return user.id
      if (!data.users.length) break
      page++
    }
    return null
  } catch (err) {
    console.error('❌ Erro ao listar usuários:', err.message)
    return null
  }
}

async function run() {
  console.log('🔄 Procurando usuário...', email)
  const userId = await findUserIdByEmail(email)
  if (!userId) {
    console.error('❌ Usuário não encontrado pelo email informado.')
    process.exit(1)
  }

  console.log('🆔 ID do usuário:', userId)
  console.log('🔐 Atualizando senha...')
  const { data, error } = await supabase.auth.admin.updateUserById(userId, {
    password: newPassword,
    email_confirm: true
  })

  if (error) {
    console.error('❌ Erro ao atualizar senha:', error.message)
    process.exit(1)
  }

  console.log('✅ Senha atualizada com sucesso para', data.user.email)
}

run()