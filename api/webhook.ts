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

function validateHmac(payload: any, signature?: string | string[]): boolean {
  // If a secret is set, require a proper signature to validate HMAC
  if (!WEBHOOK_SECRET) return true
  if (!signature) return false
  const body = typeof payload === 'string' ? payload : JSON.stringify(payload)
  const expected = crypto.createHmac('sha256', WEBHOOK_SECRET).update(body).digest('hex')
  const provided = typeof signature === 'string' ? signature : ''
  return provided === `sha256=${expected}`
}

function isAuthorized(req: VercelRequest, payload: any): boolean {
  // When WEBHOOK_SECRET is configured, allow either:
  // - HMAC via x-hub-signature-256
  // - Bearer token in Authorization header
  // - X-Webhook-Secret header matching the secret
  if (!WEBHOOK_SECRET) return true
  const signature = req.headers['x-hub-signature-256'] as string | undefined
  const authHeader = (req.headers['authorization'] || '') as string
  const bearer = authHeader.startsWith('Bearer ')
    ? authHeader.slice('Bearer '.length)
    : ''
  const xSecret = (req.headers['x-webhook-secret'] || '') as string

  const hmacOk = validateHmac(payload, signature)
  const bearerOk = !!bearer && bearer === WEBHOOK_SECRET
  const headerOk = !!xSecret && xSecret === WEBHOOK_SECRET

  return hmacOk || bearerOk || headerOk
}

async function saveEvent(event: string, instance: string, data: any) {
  if (!supabase) return
  try {
    const { error } = await supabase.from('webhook_events').insert([
      { event, instance, data, created_at: new Date().toISOString() },
    ])
    if (error) {
      console.error('[api/webhook] Failed to insert webhook_event:', error.message)
    }
  } catch (err: any) {
    console.error('[api/webhook] Error inserting webhook_event:', err.message || err)
  }
}

async function saveContact(phoneNumber: string, name: string | undefined, instanceId: string, userId: string) {
  if (!supabase) return

  const { data: existing } = await supabase
    .from('contacts')
    .select('id')
    .eq('phone_number', phoneNumber)
    .eq('instance_id', instanceId)
    .single()

  if (existing) {
    if (name) {
      await supabase
        .from('contacts')
        .update({ name })
        .eq('id', existing.id)
    }
  } else {
    await supabase.from('contacts').insert([
      {
        instance_id: instanceId,
        user_id: userId,
        phone_number: phoneNumber,
        name: name || phoneNumber,
      },
    ])
  }
}

async function saveMessage(messageData: any, instanceName: string) {
  if (!supabase) return

  const { data: instance } = await supabase
    .from('whatsapp_instances')
    .select('id, user_id')
    .eq('api_key', instanceName)
    .single()

  if (!instance) return

  const message = messageData.messages?.[0]
  if (!message) return

  const messageContent = message.message || {}
  let text = ''
  let messageType: 'text' | 'image' | 'video' | 'audio' | 'document' = 'text'

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
      instance_id: instance.id,
      message_id: message.key.id,
      from_number: message.key.remoteJid,
      to_number: message.key.fromMe ? message.key.remoteJid : instanceName,
      content: text,
      message_type: messageType,
      is_from_me: message.key.fromMe,
      timestamp: new Date(message.messageTimestamp * 1000),
      status: 'received',
      metadata: {}
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
  // Allow explicit clearing of QR when qrCode is null, and update when provided
  if (typeof qrCode !== 'undefined') updateData.qr_code = qrCode

  await supabase
    .from('whatsapp_instances')
    .update(updateData)
    .eq('api_key', instanceName)
}

// Map Evolution API states to internal statuses
function mapStateToStatus(state: string): 'connected' | 'connecting' | 'disconnected' | 'error' {
  const connected = new Set(['open', 'online', 'logged', 'authenticated', 'ready'])
  const connecting = new Set(['connecting', 'qr', 'qrcode', 'qrread', 'qridle', 'loadingscreen', 'pairing', 'require_connection', 'qr_updated'])
  const disconnected = new Set(['close', 'closed', 'offline', 'timeout', 'unauthenticated', 'conflict', 'logout'])

  const s = (state || '').toString().toLowerCase().trim()
  if (connected.has(s)) return 'connected'
  if (connecting.has(s)) return 'connecting'
  if (disconnected.has(s)) return 'disconnected'
  return 'error'
}

// Normalize different event name variants from Evolution API
function normalizeEventName(input: any): 'messages.upsert' | 'connection.update' | 'qr.updated' | 'instance.status' | 'unknown' {
  const raw = String(input || '').trim().toLowerCase()
  if (!raw) return 'unknown'
  // Replace separators and normalize qrcode -> qr
  let e = raw.replace(/[-_]/g, '.').replace(/qrcode/g, 'qr')

  // Common variants mapping
  if (e === 'messages.upsert' || e === 'message.upsert' || e === 'messages.updates' || e === 'messages.insert') return 'messages.upsert'
  if (e === 'connection.update' || e === 'connection.state' || e === 'connections.update') return 'connection.update'
  if (e.startsWith('qr.')) return 'qr.updated'
  if (e === 'instance.status' || e === 'instance.update' || e === 'instances.status') return 'instance.status'
  return 'unknown'
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method === 'GET') {
      return res.status(200).json({ ok: true, time: new Date().toISOString() })
    }

    if (req.method === 'OPTIONS') {
      // CORS preflight (some providers may send it)
      res.setHeader('Access-Control-Allow-Origin', '*')
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Webhook-Secret, X-Hub-Signature-256')
      return res.status(200).end()
    }

    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' })
    }

    const payload = req.body

    if (!isAuthorized(req, payload)) {
      return res.status(401).json({ error: 'Unauthorized' })
    }

    const rawEvent = payload?.event
    const instance = payload?.instance

    if (!rawEvent || !instance) {
      return res.status(400).json({ error: 'Invalid payload' })
    }

    // Always persist the original event name for observability
    await saveEvent(String(rawEvent), instance, payload?.data ?? {})

    const event = normalizeEventName(rawEvent)

    switch (event) {
      case 'messages.upsert':
        await saveMessage(payload.data, instance)
        break
      case 'connection.update': {
        const state: string = payload.data?.connection?.state || payload.data?.state || 'connecting'
        const status = mapStateToStatus(state)
        await updateInstanceStatus(instance, status)
        // Preferência do usuário: não limpar QR quando estado for "pairing" ou "require_connection"
        // Mantemos o último QR salvo até que um novo evento 'qr.updated' seja recebido.
        break
      }
      case 'qr.updated': {
        const qr = payload.data?.qr
        const qrDataUri = typeof qr === 'string' && !qr.startsWith('data:image') ? `data:image/png;base64,${qr}` : qr
        await updateInstanceStatus(instance, 'connecting', qrDataUri)
        break
      }
      case 'instance.status': {
        const state: string = payload.data?.status || payload.data?.state || 'connecting'
        const status = mapStateToStatus(state)
        await updateInstanceStatus(instance, status)
        break
      }
      default:
        // Unknown event; we already saved it above for later troubleshooting
        break
    }

    return res.status(200).json({ received: true })
  } catch (err: any) {
    console.error('[api/webhook] Error:', err)
    return res.status(500).json({ error: 'Internal Server Error' })
  }
}