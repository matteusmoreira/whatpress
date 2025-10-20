import { useCallback, useEffect, useRef, useState } from 'react'
import { webhookService } from '@/services/webhookService'
import { isTestEnv } from '@/lib/env'

export interface WebhookMessage {
  id: string
  chatId: string
  from: string
  to: string
  text?: string
  timestamp: number
}

export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error'

export function useWebhook() {
  const [messages, setMessages] = useState<WebhookMessage[]>([])
  const [connectionStatus, setConnectionStatus] = useState<ConnectionState>('disconnected')
  const [qrCode, setQrCode] = useState<string | undefined>()
  const initializedRef = useRef(false)

  const addMessage = useCallback((msg: WebhookMessage) => {
    setMessages(prev => {
      // Evitar duplicados e limitar a 100 mensagens
      const exists = prev.some(m => m.id === msg.id)
      if (exists) return prev
      const next = [msg, ...prev]
      return next.slice(0, 100)
    })
  }, [])

  const clearMessages = useCallback(() => setMessages([]), [])

  useEffect(() => {
    if (initializedRef.current) return

    // Em ambiente de teste, não registrar listeners do webhookService
    if (isTestEnv) return

    initializedRef.current = true

    // Registrar handler de mensagens processadas pelo serviço
    const unsubscribeMessage = webhookService.onMessage(processed => {
      const msg: WebhookMessage = {
        id: processed.id,
        chatId: processed.from,
        from: processed.isFromMe ? 'me' : processed.from,
        to: processed.isFromMe ? processed.from : 'me',
        text: processed.text,
        timestamp: processed.timestamp.getTime()
      }
      addMessage(msg)
    })

    // Registrar handler de conexão (status + QR opcional)
    const unsubscribeConnection = webhookService.onConnection((status, qr) => {
      const mapped = mapStateToStatus(status)
      setConnectionStatus(mapped)
      if (qr && typeof qr === 'string') {
        const dataUri = qr.startsWith('data:image') ? qr : `data:image/png;base64,${qr}`
        setQrCode(dataUri)
      }
      if (mapped === 'connected') {
        setQrCode(undefined)
      }
    })

    // Cleanup
    return () => {
      unsubscribeMessage?.()
      unsubscribeConnection?.()
    }
  }, [addMessage])

  const simulateMessage = useCallback((msg: Partial<WebhookMessage>) => {
    const simulated: WebhookMessage = {
      id: msg.id || `sim-${Date.now()}`,
      chatId: msg.chatId || 'unknown@s.whatsapp.net',
      from: msg.from || 'unknown',
      to: msg.to || 'me',
      text: msg.text || 'Mensagem de teste',
      timestamp: msg.timestamp || Date.now()
    }
    addMessage(simulated)
  }, [addMessage])

  const simulateConnection = useCallback((state: ConnectionState, qr?: string) => {
    setConnectionStatus(state)
    if (qr) setQrCode(qr)
    if (state === 'connected') setQrCode(undefined)
  }, [])

  const isConnected = connectionStatus === 'connected'

  return {
    messages,
    addMessage,
    clearMessages,
    simulateMessage,
    connectionStatus,
    qrCode,
    isConnected,
    simulateConnection
  }
}

function mapStateToStatus(state?: string): ConnectionState {
  const s = (state || '').toLowerCase()
  if (!s) return 'error'
  if (['open','online','logged','authenticated','ready','connected','qr_read_success','success'].includes(s)) return 'connected'
  if (['connecting','qr','qrcode','qr_read','qr_idle','loading_screen','pairing','require_connection','initializing','starting','qr_updated'].includes(s)) return 'connecting'
  if (['close','closed','offline','timeout','unauthenticated','conflict','disconnected','logout','destroyed'].includes(s)) return 'disconnected'
  return 'error'
}