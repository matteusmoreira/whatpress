import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { whatsappInstanceService, WhatsAppInstance } from '@/services/whatsappInstanceService'
import { EvolutionApiService } from '@/services/evolutionApi'
import { useToast } from '@/hooks/use-toast'
import { supabase } from '@/lib/supabase'
import { isTestEnv } from '@/lib/env'
import { useTenant } from '@/hooks/useTenant'

export function useEvolutionApi() {
  const { toast } = useToast()
  const { currentTenant } = useTenant()
  const [instances, setInstances] = useState<WhatsAppInstance[]>([])
  const [loading, setLoading] = useState(false)
  const [contacts, setContacts] = useState<any[]>([])
  const [messages, setMessages] = useState<any[]>([])
  const realtimeChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)
  const pollingIntervalRef = useRef<number | null>(null)
  // Guarda códigos de pareamento por instância (não persistido no banco)
  const [pairingCodes, setPairingCodes] = useState<Record<string, string | undefined>>({})

  const loadInstances = useCallback(async () => {
    setLoading(true)
    try {
      const data = await whatsappInstanceService.getUserInstances(currentTenant?.id)
      setInstances(data)
    } catch (error: any) {
      console.error('Erro ao carregar instâncias:', error)
      toast({
        title: 'Erro ao carregar instâncias',
        description: error?.message || 'Tente novamente mais tarde',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }, [toast, currentTenant?.id])

  const createInstance = useCallback(async (name: string, webhookUrl?: string) => {
    try {
      const instance = await whatsappInstanceService.createInstance({ name, webhook_url: webhookUrl }, currentTenant?.id)
      setInstances(prev => [instance, ...prev])
      toast({ title: 'Instância criada', description: `A instância "${instance.name}" foi criada.` })
      return instance
    } catch (error: any) {
      toast({ title: 'Erro ao criar instância', description: error?.message, variant: 'destructive' })
      throw error
    }
  }, [toast, currentTenant?.id])

  const connect = useCallback(async (instanceId: string) => {
    try {
      const { qrCode, pairingCode, status } = await whatsappInstanceService.connectInstance(instanceId, currentTenant?.id)
      setInstances(prev => prev.map(i => i.id === instanceId ? { ...i, status, qr_code: qrCode ?? i.qr_code } : i))
      // Não exibir nem priorizar código de pareamento; aguardar QR via webhook/supabase
      if (qrCode) {
        toast({ title: 'QR Code disponível', description: 'Abra o QR Code para conectar seu WhatsApp.' })
      } else {
        toast({ title: 'Aguardando QR Code...', description: `Status atual: ${status}` })
      }
      return { qrCode, pairingCode, status }
    } catch (error: any) {
      toast({ title: 'Erro ao conectar instância', description: error?.message, variant: 'destructive' })
      throw error
    }
  }, [toast, currentTenant?.id])

  const disconnect = useCallback(async (instanceId: string) => {
    try {
      await whatsappInstanceService.disconnectInstance(instanceId, currentTenant?.id)
      setInstances(prev => prev.map(i => i.id === instanceId ? { ...i, status: 'disconnected' } : i))
      // Limpa código de pareamento local quando desconectar
      setPairingCodes(prev => { const next = { ...prev }; delete next[instanceId]; return next })
      toast({ title: 'Instância desconectada' })
    } catch (error: any) {
      toast({ title: 'Erro ao desconectar', description: error?.message, variant: 'destructive' })
    }
  }, [toast, currentTenant?.id])

  const checkConnectionStatus = useCallback(async (instanceId: string): Promise<WhatsAppInstance['status']> => {
    try {
      const status = await whatsappInstanceService.checkInstanceStatus(instanceId, currentTenant?.id)
      setInstances(prev => prev.map(i => i.id === instanceId ? { ...i, status } : i))
      if (status === 'connected') {
        // Limpa código de pareamento quando conecta
        setPairingCodes(prev => { const next = { ...prev }; delete next[instanceId]; return next })
        toast({ title: 'Instância conectada', description: 'Seu WhatsApp foi conectado com sucesso.' })
      }
      return status as WhatsAppInstance['status']
    } catch (error: any) {
      toast({ title: 'Erro ao verificar status', description: error?.message, variant: 'destructive' })
      return 'error' as WhatsAppInstance['status']
    }
  }, [toast, currentTenant?.id])

  const deleteInstance = useCallback(async (instanceId: string) => {
    try {
      await whatsappInstanceService.deleteInstance(instanceId, currentTenant?.id)
      setInstances(prev => prev.filter(i => i.id !== instanceId))
      // Limpa código de pareamento local quando deletar
      setPairingCodes(prev => { const next = { ...prev }; delete next[instanceId]; return next })
      toast({ title: 'Instância excluída' })
    } catch (error: any) {
      toast({ title: 'Erro ao excluir instância', description: error?.message, variant: 'destructive' })
    }
  }, [toast, currentTenant?.id])

  const fetchContacts = useCallback(async (targetInstance: WhatsAppInstance) => {
    try {
      const instanceName = targetInstance.api_key || targetInstance.name
      const evolutionApi = new EvolutionApiService({
        baseUrl: import.meta.env.VITE_EVOLUTION_API_URL || 'http://localhost:8080',
        apiKey: import.meta.env.VITE_EVOLUTION_API_KEY || 'your-api-key',
        instanceName
      })
      const data = await evolutionApi.getContacts()
      setContacts(data || [])
      return data || []
    } catch (error: any) {
      toast({ title: 'Erro ao buscar contatos', description: error?.message, variant: 'destructive' })
      return []
    }
  }, [toast])

  const fetchMessages = useCallback(async (targetInstance: WhatsAppInstance, contactNumber: string) => {
    try {
      const instanceName = targetInstance.api_key || targetInstance.name
      const evolutionApi = new EvolutionApiService({
        baseUrl: import.meta.env.VITE_EVOLUTION_API_URL || 'http://localhost:8080',
        apiKey: import.meta.env.VITE_EVOLUTION_API_KEY || 'your-api-key',
        instanceName
      })
      const data = await evolutionApi.getMessages(contactNumber)
      setMessages(data || [])
      return data || []
    } catch (error: any) {
      toast({ title: 'Erro ao buscar mensagens', description: error?.message, variant: 'destructive' })
      return []
    }
  }, [toast])

  const sendMessage = useCallback(async (targetInstance: WhatsAppInstance, toNumber: string, text: string) => {
    try {
      if (targetInstance.status !== 'connected') {
        toast({ title: 'Instância não conectada', description: 'Conecte a instância antes de enviar mensagens.', variant: 'destructive' })
        return { success: false }
      }
      const instanceName = targetInstance.api_key || targetInstance.name
      const evolutionApi = new EvolutionApiService({
        baseUrl: import.meta.env.VITE_EVOLUTION_API_URL || 'http://localhost:8080',
        apiKey: import.meta.env.VITE_EVOLUTION_API_KEY || 'your-api-key',
        instanceName
      })
      await evolutionApi.sendTextMessage(toNumber, text)
      toast({ title: 'Mensagem enviada' })
      return { success: true }
    } catch (error: any) {
      toast({ title: 'Erro ao enviar mensagem', description: error?.message, variant: 'destructive' })
      return { success: false }
    }
  }, [toast])

  // Adiciona função para buscar eventos recentes de uma instância
  // Retorna últimos N eventos da tabela webhook_events, filtrando por nome da instância (api_key ou name)
  // Uso: getRecentEvents(instance, 10)
  const getRecentEvents = useCallback(async (targetInstance: WhatsAppInstance, limit: number = 10) => {
    try {
      const instanceName = targetInstance?.api_key || targetInstance?.name
      if (!instanceName) return []
      const { data, error } = await supabase
        .from('webhook_events')
        .select('*')
        .eq('instance', instanceName)
        .order('created_at', { ascending: false })
        .limit(limit)

      if (error) {
        console.error('[Supabase] Erro ao buscar eventos recentes:', error.message)
        return []
      }
      return data || []
    } catch (e) {
      console.error('[Supabase] Exceção ao buscar eventos recentes:', e)
      return []
    }
  }, [])

  // Realtime subscription: atualizar instâncias quando webhook atualizar o banco
  useEffect(() => {
    if (isTestEnv) {
      // Em ambiente de teste, evitamos criar canais realtime para prevenir atualizações fora do act()
      return () => {
        if (realtimeChannelRef.current) {
          try { realtimeChannelRef.current.unsubscribe() } catch {}
          realtimeChannelRef.current = null
        }
      }
    }

    let mounted = true
    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      // Cancelar canal anterior se existir
      if (realtimeChannelRef.current) {
        try { await realtimeChannelRef.current.unsubscribe() } catch {}
        realtimeChannelRef.current = null
      }
      const channel = supabase.channel('realtime:whatsapp_instances')
      const filterKey = currentTenant?.id ? 'tenant_id' : 'user_id'
      const filterValue = currentTenant?.id ?? user.id
      channel.on('postgres_changes', { event: '*', schema: 'public', table: 'whatsapp_instances', filter: `${filterKey}=eq.${filterValue}` }, payload => {
        if (!mounted) return
        setInstances(prev => {
          const newRow = payload.new as WhatsAppInstance
          const oldRow = payload.old as WhatsAppInstance
          switch (payload.eventType) {
            case 'INSERT':
              if (prev.find(i => i.id === newRow.id)) return prev
              return [newRow, ...prev]
            case 'UPDATE':
              // Se status mudou para conectado/desconectado/erro, limpar código de pareamento local
              if ((payload.new as any)?.status && (payload.new as any)?.status !== (payload.old as any)?.status) {
                const newStatus = (payload.new as any)?.status
                if (newStatus === 'connected' || newStatus === 'disconnected' || newStatus === 'error') {
                  setPairingCodes(prev => { const next = { ...prev }; delete next[newRow.id]; return next })
                }
              }
              return prev.map(i => i.id === newRow.id ? { ...i, ...newRow } : i)
            case 'DELETE':
              return prev.filter(i => i.id !== oldRow.id)
            default:
              return prev
          }
        })
        // Toasters úteis para mudanças de status
        const newStatus = (payload.new as any)?.status
        const oldStatus = (payload.old as any)?.status
        if (newStatus && newStatus !== oldStatus) {
          if (newStatus === 'connected') {
            toast({ title: 'Instância conectada', description: 'Webhook atualizou o status para conectado.' })
          } else if (newStatus === 'connecting') {
            toast({ title: 'Instância em conexão', description: 'Aguardando leitura do QR Code.' })
          } else if (newStatus === 'disconnected') {
            toast({ title: 'Instância desconectada' })
          } else if (newStatus === 'error') {
            toast({ title: 'Erro na instância', description: 'Verifique os logs.', variant: 'destructive' })
          }
        }
      })
      await channel.subscribe()
      realtimeChannelRef.current = channel
    })()
    return () => {
      mounted = false
      if (realtimeChannelRef.current) {
        try { realtimeChannelRef.current.unsubscribe() } catch {}
        realtimeChannelRef.current = null
      }
    }
  }, [toast, currentTenant?.id])

  // Fallback polling: checar status a cada 15s para instâncias "connecting"
  useEffect(() => {
    if (isTestEnv) {
      // Evitar timers em ambiente de teste
      return () => {
        if (pollingIntervalRef.current) {
          window.clearInterval(pollingIntervalRef.current)
          pollingIntervalRef.current = null
        }
      }
    }

    const hasConnecting = instances.some(i => i.status === 'connecting')
    if (pollingIntervalRef.current) {
      window.clearInterval(pollingIntervalRef.current)
      pollingIntervalRef.current = null
    }
    if (hasConnecting) {
      const intervalId = window.setInterval(() => {
        instances.filter(i => i.status === 'connecting').forEach(i => {
          checkConnectionStatus(i.id).catch(() => {})
        })
      }, 15000)
      pollingIntervalRef.current = intervalId
    }
    return () => {
      if (pollingIntervalRef.current) {
        window.clearInterval(pollingIntervalRef.current)
        pollingIntervalRef.current = null
      }
    }
  }, [instances, checkConnectionStatus])

  useEffect(() => {
    if (isTestEnv) return
    loadInstances()
  }, [loadInstances])

  return {
    instances,
    loading,
    contacts,
    messages,
    pairingCodes,
    loadInstances,
    createInstance,
    connect,
    disconnect,
    checkConnectionStatus,
    deleteInstance,
    fetchContacts,
    fetchMessages,
    sendMessage,
    getRecentEvents,
  }
}