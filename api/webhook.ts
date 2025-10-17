import type { VercelRequest, VercelResponse } from '@vercel/node'
import crypto from 'crypto'
import { createClient } from '@supabase/supabase-js'

// Read env vars from Vercel Environment
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || ''
const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE

// Initialize Supabase service client (server-side only)
const supabase = SUPABASE_URL && SUPABASE_SERVICE_ROLE
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  : null

function validateWebhook(payload: any, signature?: string | string[]): boolean {
  if (!signature || !WEBHOOK_SECRET) return true
  const body = typeof payload === 'string' ? payload : JSON.stringify(payload)
  const expected = crypto.createHmac('sha256', WEBHOOK_SECRET).update(body).digest('hex')
  return signature === `sha256=${expected}`
}

async function saveEvent(event: string, instance: string, data: any) {
  if (!supabase) return
  await supabase.from('webhook_events').insert([
    { event, instance, data, created_at: new Date().toISOString() },
  ])
}

async function saveContact(phoneNumber: string, name: string | undefined, instanceId: string, userId: string) {
  if (!supabase) return

  const { data: existing } = await supabase
    .from('contacts')
    .select('id')
    .eq('phone_number', phoneNumber)
    .eq('whatsapp_instance_id', instanceId)
    .single()

  if (existing) {
    if (name) {
      await supabase
        .from('contacts')
        .update({ name, last_message_at: new Date().toISOString() })
        .eq('id', existing.id)
    }
  } else {
    await supabase.from('contacts').insert([
      {
        whatsapp_instance_id: instanceId,
        user_id: userId,
        phone_number: phoneNumber,
        name: name || phoneNumber,
        last_message_at: new Date().toISOString(),
      },
    ])
  }
}

async function saveMessage(messageData: any, instanceName: string) {
  if (!supabase) return

  const { data: instance } = await supabase
    .from('whatsapp_instances')
    .select('id, user_id')
    .eq('name', instanceName)
    .single()

  if (!instance) return

  const message = messageData.messages?.[0]
  if (!message) return

  const messageContent = message.message || {}
  let text = ''
  let messageType: 'text' | 'image' | 'video' | 'audio' | 'document' = 'text'
  let mediaUrl: string | null = null

  if (messageContent.conversation) {
    text = messageContent.conversation
  } else if (messageContent.extendedTextMessage?.text) {
    text = messageContent.extendedTextMessage.text
  } else if (messageContent.imageMessage) {
    text = messageContent.imageMessage.caption || ''
    messageType = 'image'
  } else if (messageContent.videoMessage) {
    text = messageContent.videoMessage.caption || ''
    messageType = 'video'
  } else if (messageContent.audioMessage) {
    messageType = 'audio'
  } else if (messageContent.documentMessage) {
    text = messageContent.documentMessage.fileName || ''
    messageType = 'document'
  }

  await supabase.from('messages').insert([
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
      status: 'received',
    },
  ])

  if (!message.key.fromMe) {
    await saveContact(message.key.remoteJid, message.pushName, instance.id, instance.user_id)
  }
}

async function updateInstanceStatus(instanceName: string, status: string, qrCode?: string | null) {
  if (!supabase) return

  const updateData: any = {
    status,
    last_activity: new Date().toISOString(),
  }
  if (qrCode) updateData.qr_code = qrCode

  await supabase
    .from('whatsapp_instances')
    .update(updateData)
    .eq('api_key', instanceName)
}

// Map Evolution API states to internal statuses
function mapStateToStatus(state: string): 'connected' | 'connecting' | 'disconnected' | 'error' {
  const connected = new Set(['open', 'online', 'logged', 'authenticated', 'ready'])
  const connecting = new Set(['connecting', 'qr', 'qrRead', 'qrIdle', 'loadingScreen', 'pairing', 'require_connection'])
  const disconnected = new Set(['close', 'offline', 'timeout', 'unauthenticated', 'conflict'])

  if (connected.has(state)) return 'connected'
  if (connecting.has(state)) return 'connecting'
  if (disconnected.has(state)) return 'disconnected'
  return 'error'
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method === 'GET') {
      return res.status(200).json({ ok: true, time: new Date().toISOString() })
    }

    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' })
    }

    const signature = req.headers['x-hub-signature-256'] as string | undefined
    const payload = req.body

    if (!validateWebhook(payload, signature)) {
      return res.status(401).json({ error: 'Invalid signature' })
    }

    const event = payload?.event
    const instance = payload?.instance

    if (!event || !instance) {
      return res.status(400).json({ error: 'Invalid payload' })
    }

    await saveEvent(event, instance, payload?.data ?? {})

    switch (event) {
      case 'messages.upsert':
        await saveMessage(payload.data, instance)
        break
      case 'connection.update': {
        const state: string = payload.data?.connection?.state || 'connecting'
        const status = mapStateToStatus(state)
        await updateInstanceStatus(instance, status)
        break
      }
      case 'qr.updated': {
        const qr = payload.data?.qr
        await updateInstanceStatus(instance, 'connecting', qr)
        break
      }
      case 'instance.status': {
        const state: string = payload.data?.status || 'connecting'
        const status = mapStateToStatus(state)
        await updateInstanceStatus(instance, status)
        break
      }
      default:
        break
    }

    return res.status(200).json({ received: true })
  } catch (err: any) {
    console.error('[api/webhook] Error:', err)
    return res.status(500).json({ error: 'Internal Server Error' })
  }
}