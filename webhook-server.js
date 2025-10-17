import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import crypto from 'crypto'
import { createClient } from '@supabase/supabase-js'

const app = express()
const PORT = process.env.PORT || 3001

// Middleware
app.use(cors())
app.use(express.json())

// Webhook secret para validação (opcional)
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || 'your_webhook_secret'

// Supabase Service Role (Backend only)
const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE

let supabaseService = null
if (SUPABASE_URL && SUPABASE_SERVICE_ROLE) {
  try {
    supabaseService = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    console.log('[Supabase] Service client initialized')
  } catch (err) {
    console.error('[Supabase] Failed to initialize service client:', err)
  }
} else {
  console.warn(
    '[Supabase] SUPABASE_URL or SUPABASE_SERVICE_ROLE not set. Webhook events will not be persisted.'
  )
}

// Função para validar webhook (opcional)
function validateWebhook(payload, signature) {
  if (!signature) return true // Se não há assinatura, aceita (para desenvolvimento)

  const expectedSignature = crypto
    .createHmac('sha256', WEBHOOK_SECRET)
    .update(JSON.stringify(payload))
    .digest('hex')

  return signature === `sha256=${expectedSignature}`
}

// Função para salvar evento no webhook_events
async function saveEvent(event, instance, data) {
  if (!supabaseService) return
  try {
    const { error } = await supabaseService.from('webhook_events').insert([
      {
        event,
        instance,
        data,
        created_at: new Date().toISOString(),
      },
    ])
    if (error) {
      console.error('[Supabase] Failed to insert webhook event:', error.message)
    }
  } catch (err) {
    console.error('[Supabase] Error inserting webhook event:', err)
  }
}

// Função para salvar mensagem no banco
async function saveMessage(messageData, instanceName) {
  if (!supabaseService) return

  try {
    // Primeiro, buscar a instância para obter o user_id
    const { data: instance, error: instanceError } = await supabaseService
      .from('whatsapp_instances')
      .select('id, user_id')
      .eq('name', instanceName)
      .single()

    if (instanceError || !instance) {
      console.error('[Supabase] Instance not found:', instanceName)
      return
    }

    // Processar dados da mensagem
    const message = messageData.messages?.[0]
    if (!message) return

    const messageContent = message.message || {}
    let text = ''
    let messageType = 'text'
    let mediaUrl = null

    // Extrair texto da mensagem
    if (messageContent.conversation) {
      text = messageContent.conversation
    } else if (messageContent.extendedTextMessage?.text) {
      text = messageContent.extendedTextMessage.text
    } else if (messageContent.imageMessage) {
      text = messageContent.imageMessage.caption || ''
      messageType = 'image'
      // mediaUrl seria processado aqui se disponível
    } else if (messageContent.videoMessage) {
      text = messageContent.videoMessage.caption || ''
      messageType = 'video'
    } else if (messageContent.audioMessage) {
      messageType = 'audio'
    } else if (messageContent.documentMessage) {
      text = messageContent.documentMessage.fileName || ''
      messageType = 'document'
    }

    // Salvar mensagem
    const { error: messageError } = await supabaseService
      .from('messages')
      .insert([
        {
          whatsapp_instance_id: instance.id,
          user_id: instance.user_id,
          message_id: message.key.id,
          from_number: message.key.remoteJid,
          to_number: message.key.fromMe ? message.key.remoteJid : instanceName,
          content: text,
          message_type: messageType,
          media_url: mediaUrl,
          is_from_me: message.key.fromMe,
          timestamp: new Date(message.messageTimestamp * 1000),
          status: 'received'
        }
      ])

    if (messageError) {
      console.error('[Supabase] Failed to save message:', messageError.message)
    } else {
      console.log('✅ Mensagem salva no banco:', {
        from: message.key.remoteJid,
        type: messageType,
        text: text.substring(0, 50) + (text.length > 50 ? '...' : '')
      })
    }

    // Salvar/atualizar contato se não for mensagem própria
    if (!message.key.fromMe) {
      await saveContact(message.key.remoteJid, message.pushName, instance.id, instance.user_id)
    }

  } catch (err) {
    console.error('[Supabase] Error saving message:', err)
  }
}

// Função para salvar/atualizar contato
async function saveContact(phoneNumber, name, instanceId, userId) {
  if (!supabaseService) return

  try {
    // Verificar se contato já existe
    const { data: existingContact } = await supabaseService
      .from('contacts')
      .select('id')
      .eq('phone_number', phoneNumber)
      .eq('whatsapp_instance_id', instanceId)
      .single()

    if (existingContact) {
      // Atualizar nome se fornecido
      if (name) {
        await supabaseService
          .from('contacts')
          .update({ 
            name: name,
            last_message_at: new Date().toISOString()
          })
          .eq('id', existingContact.id)
      }
    } else {
      // Criar novo contato
      const { error } = await supabaseService
        .from('contacts')
        .insert([
          {
            whatsapp_instance_id: instanceId,
            user_id: userId,
            phone_number: phoneNumber,
            name: name || phoneNumber,
            last_message_at: new Date().toISOString()
          }
        ])

      if (error) {
        console.error('[Supabase] Failed to save contact:', error.message)
      } else {
        console.log('✅ Contato salvo:', { phone: phoneNumber, name })
      }
    }
  } catch (err) {
    console.error('[Supabase] Error saving contact:', err)
  }
}

// Função para atualizar status da instância
async function updateInstanceStatus(instanceName, status, qrCode = null) {
  if (!supabaseService) return

  try {
    const updateData = {
      status: status,
      last_activity: new Date().toISOString()
    }

    if (qrCode) {
      updateData.qr_code = qrCode
    }

    const { error } = await supabaseService
      .from('whatsapp_instances')
      .update(updateData)
      .eq('api_key', instanceName)

    if (error) {
      console.error('[Supabase] Failed to update instance status:', error.message)
    } else {
      console.log('✅ Status da instância atualizado:', { instance: instanceName, status })
    }
  } catch (err) {
    console.error('[Supabase] Error updating instance status:', err)
  }
}

// Endpoint principal do webhook
app.post('/webhook', async (req, res) => {
  try {
    const signature = req.headers['x-hub-signature-256']
    const payload = req.body

    // Validar webhook (opcional)
    if (!validateWebhook(payload, signature)) {
      console.log('❌ Webhook signature validation failed')
      return res.status(401).json({ error: 'Invalid signature' })
    }

    console.log('📨 Webhook recebido:', {
      timestamp: new Date().toISOString(),
      event: payload.event,
      instance: payload.instance,
    })

    // Processar diferentes tipos de eventos
    switch (payload.event) {
      case 'messages.upsert':
        await handleNewMessage(payload.data, payload.instance)
        break

      case 'connection.update':
        await handleConnectionUpdate(payload.data, payload.instance)
        break

      case 'qr.updated':
        await handleQRUpdate(payload.data, payload.instance)
        break

      case 'instance.status':
        await handleInstanceStatus(payload.data, payload.instance)
        break

      default:
        console.log('🔄 Evento não processado:', payload.event)
    }

    // Persistir evento no Supabase (se configurado)
    await saveEvent(payload.event, payload.instance, payload.data)

    // Responder com sucesso
    res.status(200).json({
      success: true,
      message: 'Webhook processado com sucesso',
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('❌ Erro ao processar webhook:', error)
    res.status(500).json({
      error: 'Erro interno do servidor',
      message: error.message,
    })
  }
})

// Handlers para diferentes tipos de eventos
async function handleNewMessage(data, instanceName) {
  console.log('💬 Nova mensagem:', {
    from: data.messages?.[0]?.key?.remoteJid,
    instance: instanceName,
    timestamp: data.messages?.[0]?.messageTimestamp,
  })

  // Salvar mensagem no banco
  await saveMessage(data, instanceName)
}

async function handleConnectionUpdate(data, instanceName) {
  console.log('🔗 Atualização de conexão:', {
    state: data.state,
    instance: instanceName,
  })

  // Mapear estados da Evolution API para nossos status (mais robusto)
  const rawState = (data.state || '').toString().toLowerCase()
  let status = 'disconnected'

  const connectedStates = ['open', 'connected', 'online', 'logged', 'authenticated', 'ready']
  const connectingStates = ['connecting', 'qr', 'qrcode', 'pairing', 'scan_qr', 'scanqr', 'waiting', 'loading']
  const disconnectedStates = ['close', 'closed', 'disconnected', 'logout', 'stopped', 'failed']

  if (connectedStates.includes(rawState)) {
    status = 'connected'
  } else if (connectingStates.includes(rawState)) {
    status = 'connecting'
  } else if (disconnectedStates.includes(rawState)) {
    status = 'disconnected'
  }

  // Atualizar status no banco
  await updateInstanceStatus(instanceName, status)
}

async function handleQRUpdate(data, instanceName) {
  console.log('📱 QR Code atualizado:', {
    qr: data.qr ? 'QR Code disponível' : 'QR Code removido',
    instance: instanceName,
  })

  // Atualizar QR code e status no banco
  await updateInstanceStatus(instanceName, 'connecting', data.qr)
}

async function handleInstanceStatus(data, instanceName) {
  console.log('📊 Status da instância:', {
    status: data.status,
    instance: instanceName,
  })

  // Mapear status de instância (mais robusto)
  const rawStatus = (data.status || '').toString().toLowerCase()
  let status = 'disconnected'

  const connectedStates = ['open', 'connected', 'online', 'logged', 'authenticated', 'ready']
  const connectingStates = ['connecting', 'qr', 'qrcode', 'pairing', 'scan_qr', 'scanqr', 'waiting', 'loading']
  const disconnectedStates = ['close', 'closed', 'disconnected', 'logout', 'stopped', 'failed']

  if (connectedStates.includes(rawStatus)) {
    status = 'connected'
  } else if (connectingStates.includes(rawStatus)) {
    status = 'connecting'
  } else if (disconnectedStates.includes(rawStatus)) {
    status = 'disconnected'
  }

  // Atualizar status no banco
  await updateInstanceStatus(instanceName, status)
}

// Endpoint de health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    supabase: supabaseService ? 'connected' : 'not configured'
  })
})

// Endpoint para testar webhook
app.post('/test-webhook', async (req, res) => {
  console.log('🧪 Teste de webhook:', req.body)
  await saveEvent('test-webhook', 'local', req.body)
  res.json({
    message: 'Webhook de teste recebido',
    data: req.body,
  })
})

// Endpoint para simular mensagem (desenvolvimento)
app.post('/simulate-message', async (req, res) => {
  const { instance, from, text, type = 'text' } = req.body

  const simulatedData = {
    messages: [{
      key: {
        remoteJid: from,
        fromMe: false,
        id: `sim_${Date.now()}`
      },
      message: {
        conversation: text
      },
      messageTimestamp: Math.floor(Date.now() / 1000),
      pushName: from.split('@')[0]
    }]
  }

  await handleNewMessage(simulatedData, instance)
  
  res.json({
    message: 'Mensagem simulada processada',
    data: simulatedData
  })
})

// Middleware de erro global
app.use((error, req, res, next) => {
  console.error('❌ Erro não tratado:', error)
  res.status(500).json({
    error: 'Erro interno do servidor',
    message: error.message,
  })
})

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`🚀 Servidor webhook rodando na porta ${PORT}`)
  console.log(`📡 Endpoint webhook: http://localhost:${PORT}/webhook`)
  console.log(`🏥 Health check: http://localhost:${PORT}/health`)
  console.log(`🧪 Teste webhook: http://localhost:${PORT}/test-webhook`)
  console.log(`📱 Simular mensagem: http://localhost:${PORT}/simulate-message`)
})

export default app