import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.SUPABASE_URL
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error('❌ Erro: SUPABASE_URL ou SUPABASE_SERVICE_ROLE não encontrados no .env')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey)

async function setStatus(apiKey, status) {
  try {
    console.log(`🔄 Atualizando status da instância ${apiKey} para '${status}'...`)
    const { data, error } = await supabase
      .from('whatsapp_instances')
      .update({ status, last_activity: new Date().toISOString() })
      .eq('api_key', apiKey)
      .select('id, name, status')

    if (error) throw error
    if (!data || data.length === 0) {
      console.log('⚠️ Nenhuma instância atualizada (verifique api_key).')
      process.exit(1)
    }

    console.log('✅ Status atualizado com sucesso:', data[0])
  } catch (err) {
    console.error('❌ Erro ao atualizar status:', err.message)
    process.exit(1)
  }
}

const apiKey = process.argv[2] || 'demo-instance'
const status = process.argv[3] || 'disconnected'
setStatus(apiKey, status)