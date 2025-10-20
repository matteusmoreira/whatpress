import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const url = process.env.SUPABASE_URL
const serviceRole = process.env.SUPABASE_SERVICE_ROLE

if (!url || !serviceRole) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE')
  process.exit(1)
}

const supabase = createClient(url, serviceRole)

async function run() {
  console.log('🔄 Inserindo evento de teste para demo-instance...')
  const payload = {
    event: 'messages.upsert',
    instance: 'demo-instance',
    data: {
      message: 'Mensagem simulada pelo script',
      from: '5511999999999@s.whatsapp.net',
      to: 'demo-instance',
      timestamp: Date.now()
    },
    created_at: new Date().toISOString()
  }

  const { data, error } = await supabase
    .from('webhook_events')
    .insert([payload])
    .select('*')

  if (error) {
    console.error('❌ Erro ao inserir evento:', error.message)
    process.exit(1)
  }

  console.log('✅ Evento inserido:', data[0])
}

run().catch(err => { console.error(err); process.exit(1) })