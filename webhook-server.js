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
      .eq('api_key', instanceName)
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
          instance_id: instance.id,
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
      .eq('instance_id', instanceId)
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
            instance_id: instanceId,
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

    // Autorização flexível: HMAC, Authorization Bearer, X-Webhook-Secret, segredo no body
    const authHeader = req.headers['authorization'] || ''
    const bearer = typeof authHeader === 'string' && authHeader.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : ''
    const xSecret = (req.headers['x-webhook-secret'] || '')
    const bodySecret = (payload?.secret || payload?.webhook_secret || '')

    const authorized =
      !WEBHOOK_SECRET ||
      validateWebhook(payload, signature) ||
      (typeof xSecret === 'string' && xSecret === WEBHOOK_SECRET) ||
      (typeof bearer === 'string' && bearer === WEBHOOK_SECRET) ||
      (typeof bodySecret === 'string' && bodySecret === WEBHOOK_SECRET)

    if (!authorized) {
      console.log('❌ Webhook authorization failed')
      return res.status(401).json({ error: 'Unauthorized' })
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

// Helper para registrar ações (local dev)
async function logAction(actorUserId, tenantId, action, resource, resourceId = null, details = null) {
  try {
    await supabaseService.rpc('log_user_action', {
      p_user_id: actorUserId,
      p_tenant_id: tenantId,
      p_action: action,
      p_resource: resource,
      p_resource_id: resourceId,
      p_details: details,
    })
  } catch (e) {
    console.warn('[api/roles] Failed to log action', e)
  }
}

// Roles management API (local dev)
app.post('/api/roles', async (req, res) => {
  try {
    const authHeader = req.headers['authorization'] || ''
    const token = typeof authHeader === 'string' && authHeader.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : ''
    if (!token) return res.status(401).json({ error: 'Missing Authorization Bearer token' })
    if (!supabaseService) return res.status(500).json({ error: 'Supabase not configured' })

    const { data: userData, error: userError } = await supabaseService.auth.getUser(token)
    if (userError || !userData?.user?.id) return res.status(401).json({ error: 'Invalid or expired token' })
    const actorUserId = userData.user.id

    const { action } = req.body || {}
    if (!action) return res.status(400).json({ error: 'Missing action' })

    // Helper to check scope
    async function getScope(tenantId) {
      let isSuperAdmin = false
      let isTenantAdmin = false
      try {
        const { data: isSuper } = await supabaseService.rpc('is_superadmin', { user_id: actorUserId })
        isSuperAdmin = !!isSuper
      } catch {}
      if (tenantId) {
        try {
          const { data: isAdmin } = await supabaseService.rpc('is_tenant_admin', { tenant_id: tenantId, user_id: actorUserId })
          isTenantAdmin = !!isAdmin
        } catch {}
      }
      return { isSuperAdmin, isTenantAdmin }
    }

    if (action === 'list_users') {
      const { tenantId } = req.body || {}
      if (!tenantId) return res.status(400).json({ error: 'Missing tenantId' })
      const scope = await getScope(tenantId)
      if (!scope.isSuperAdmin && !scope.isTenantAdmin) {
        return res.status(403).json({ error: 'Forbidden: requires SUPERADMIN or tenant ADMIN' })
      }

      const { data: associations, error: assocsError } = await supabaseService
        .from('user_tenants')
        .select('user_id, role, created_at')
        .eq('tenant_id', tenantId)

      if (assocsError) return res.status(500).json({ error: assocsError.message })

      const userIds = (associations || []).map(r => r.user_id)
      let usersMap = {}
      if (userIds.length) {
        const { data: userRows, error: usersError } = await supabaseService
          .from('users')
          .select('id, email, name')
          .in('id', userIds)
        if (usersError) return res.status(500).json({ error: usersError.message })
        usersMap = Object.fromEntries((userRows || []).map(u => [u.id, u]))
      }

      const users = (associations || []).map(row => ({
        user_id: row.user_id,
        email: usersMap[row.user_id]?.email || '',
        full_name: usersMap[row.user_id]?.name || null,
        role: row.role,
        created_at: row.created_at,
        last_sign_in_at: null,
      }))

      return res.status(200).json({ users })
    }

    if (action === 'list_permissions') {
      const { data, error } = await supabaseService
        .from('role_permissions')
        .select('*')
        .order('role', { ascending: true })
        .order('resource', { ascending: true })
        .order('action', { ascending: true })
      if (error) return res.status(500).json({ error: error.message })
      return res.status(200).json({ ok: true, permissions: data || [] })
    }

    if (action === 'update_role') {
      const { tenantId, userId, newRole } = req.body || {}
      if (!tenantId || !userId || !newRole) return res.status(400).json({ error: 'Missing tenantId, userId or newRole' })
      if (!['ADMIN', 'USER'].includes(newRole)) return res.status(400).json({ error: 'Invalid newRole' })
      const scope = await getScope(tenantId)
      if (!scope.isSuperAdmin && !scope.isTenantAdmin) return res.status(403).json({ error: 'Forbidden: requires SUPERADMIN or tenant ADMIN' })

      const { error } = await supabaseService
        .from('user_tenants')
        .update({ role: newRole })
        .eq('tenant_id', tenantId)
        .eq('user_id', userId)
      if (error) return res.status(500).json({ error: error.message })
      await logAction(actorUserId, tenantId, 'update_user_role', 'users', userId, { new_role: newRole })
      return res.status(200).json({ ok: true })
    }

    if (action === 'remove') {
      const { tenantId, userId } = req.body || {}
      if (!tenantId || !userId) return res.status(400).json({ error: 'Missing tenantId or userId' })
      const scope = await getScope(tenantId)
      if (!scope.isSuperAdmin && !scope.isTenantAdmin) return res.status(403).json({ error: 'Forbidden: requires SUPERADMIN or tenant ADMIN' })

      const { error } = await supabaseService
        .from('user_tenants')
        .delete()
        .eq('tenant_id', tenantId)
        .eq('user_id', userId)
      if (error) return res.status(500).json({ error: error.message })
      await logAction(actorUserId, tenantId, 'remove_user', 'users', userId, {})
      return res.status(200).json({ ok: true })
    }

    if (action === 'invite') {
      const { tenantId, email, role } = req.body || {}
      if (!tenantId || !email || !role) return res.status(400).json({ error: 'Missing tenantId, email or role' })
      if (!['ADMIN', 'USER'].includes(role)) return res.status(400).json({ error: 'Invalid role' })
      const scope = await getScope(tenantId)
      if (!scope.isSuperAdmin && !scope.isTenantAdmin) return res.status(403).json({ error: 'Forbidden: requires SUPERADMIN or tenant ADMIN' })

      let userId = null
      // Primeiro tenta encontrar o usuário por email
      const { data: userRow, error: userRowError } = await supabaseService
        .from('users')
        .select('id')
        .eq('email', email)
        .limit(1)
      if (userRowError) return res.status(500).json({ error: userRowError.message })

      if (Array.isArray(userRow) && userRow.length > 0) {
        userId = userRow[0].id
      } else {
        // Se não existir, cria o usuário no Auth usando Service Role (paridade com api/roles.ts)
        try {
          const { data: created, error: createError } = await supabaseService.auth.admin.createUser({
            email,
            password: Math.random().toString(36).slice(2, 18) + 'Aa1!',
            email_confirm: true,
          })
          if (createError || !created?.user?.id) {
            return res.status(500).json({ error: createError?.message || 'Failed to create user for invitation' })
          }
          userId = created.user.id
        } catch (e) {
          return res.status(500).json({ error: e?.message || 'Failed to create user for invitation' })
        }
      }

      const { error } = await supabaseService
        .from('user_tenants')
        .insert({ tenant_id: tenantId, user_id: userId, role })
      if (error) return res.status(500).json({ error: error.message })
      await logAction(actorUserId, tenantId, 'invite_user', 'users', userId, { email, role })
      return res.status(200).json({ ok: true, userId })
    }

    if (action === 'update_permission') {
      const { permissionId, allowed } = req.body || {}
      if (!permissionId || typeof allowed !== 'boolean') return res.status(400).json({ error: 'Missing permissionId or allowed' })

      let isSuperAdmin = false
      try {
        const { data: isSuper } = await supabaseService.rpc('is_superadmin', { user_id: actorUserId })
        isSuperAdmin = !!isSuper
      } catch {}
      if (!isSuperAdmin) return res.status(403).json({ error: 'Only SUPERADMIN can update global role permissions' })

      const { error } = await supabaseService
        .from('role_permissions')
        .update({ allowed })
        .eq('id', permissionId)
      if (error) return res.status(500).json({ error: error.message })
      await logAction(actorUserId, null, 'update_permission', 'permissions', permissionId, { allowed })
      return res.status(200).json({ ok: true })
    }

    if (action === 'list_user_actions') {
      const { tenantId, limit, userId, action: actionFilter, resource, since } = req.body || {}
      if (!tenantId) return res.status(400).json({ error: 'Missing tenantId' })
      const scope = await getScope(tenantId)
      if (!scope.isSuperAdmin && !scope.isTenantAdmin) {
        return res.status(403).json({ error: 'Forbidden: requires SUPERADMIN or tenant ADMIN' })
      }

      const lim = Number.isFinite(Number(limit)) ? Math.max(1, Math.min(200, Number(limit))) : 50

      let query = supabaseService
        .from('user_actions_log')
        .select('*')
        .eq('tenant_id', tenantId)

      if (userId) query = query.eq('user_id', userId)
      if (actionFilter) query = query.eq('action', actionFilter)
      if (resource) query = query.eq('resource', resource)
      if (since) query = query.gte('created_at', since)

      const { data, error } = await query
        .order('created_at', { ascending: false })
        .limit(lim)
      if (error) return res.status(500).json({ error: error.message })

      const userIds = Array.from(new Set((data || []).map(a => a.user_id).filter(Boolean)))
      let emailById = {}
      if (userIds.length > 0) {
        const { data: userRows, error: usersError } = await supabaseService
          .from('users')
          .select('id, email')
          .in('id', userIds)
        if (usersError) return res.status(500).json({ error: usersError.message })
        emailById = Object.fromEntries((userRows || []).map(u => [u.id, u.email]))
      }

      const actions = (data || []).map(item => ({
        id: item.id,
        user_id: item.user_id,
        user_email: emailById[item.user_id] || '',
        action: item.action,
        resource: item.resource,
        resource_id: item.resource_id,
        details: item.details,
        created_at: item.created_at,
      }))

      return res.status(200).json({ ok: true, actions })
    }

    return res.status(400).json({ error: 'Unknown action' })
  } catch (err) {
    console.error('[api/roles] error:', err)
    return res.status(500).json({ error: err?.message || 'Unexpected error' })
  }
})

// Endpoint de health check
// Duplicate /api/roles route removed. Logic consolidated in single handler above.

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