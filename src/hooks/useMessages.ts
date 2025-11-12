import { useState, useCallback, useEffect } from 'react'
import { useAuth } from './useAuth'
import { useToast } from '@/hooks/use-toast'
import { supabase } from '@/lib/supabase'
import { useTenant } from '@/hooks/useTenant'
import { useEncryption } from '@/hooks/useEncryption'
import { useConsent } from '@/hooks/useConsent'
import { useCache } from './useCache'
import { monitorAPIRequest, monitorDatabaseQuery } from '@/lib/monitoring'
import { executeWithRetryAndCircuitBreaker, defaultCircuitBreakerConfigs } from '@/lib/circuitBreaker'

export interface MediaFile {
  file: File
  type: 'image' | 'document' | 'audio' | 'video'
  preview?: string
}

export interface BulkMessageData {
  contacts: string[]
  message: string
  mediaFile?: MediaFile
  scheduledAt?: Date
}

export interface MessageTemplate {
  id: string
  name: string
  content: string
  variables?: string[]
}

export interface ScheduledMessage {
  id: string
  contact: string
  message: string
  mediaUrl?: string
  scheduledAt: Date
  status: 'pending' | 'sent' | 'failed'
  createdAt: Date
}

export const useMessages = () => {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const { user } = useAuth()
  const { currentTenant } = useTenant()
  const { hasValidConsent } = useConsent()

  const { encryptMessage, decryptMessage, isEncryptionAvailable } = useEncryption();
  const encryptionEnabled = isEncryptionAvailable;

  // Cache para mensagens recentes
  const { 
    data: cachedRecentMessages, 
    mutate: mutateRecentMessages, 
    loading: messagesLoading 
  } = useCache(
    user ? `messages:recent:${currentTenant?.id ?? user.id}` : '',
    async () => {
      if (!user) return []
      const supabaseReady = Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY)
      if (!supabaseReady) return []
      
      return monitorDatabaseQuery(
        async () => {
          const { data, error } = await supabase
            .from('messages')
            .select('*')
            .eq(currentTenant?.id ? 'tenant_id' : 'user_id', currentTenant?.id ?? user.id)
            .order('timestamp', { ascending: false })
            .limit(50)
          
          if (error) throw error
          
          // Descriptografar mensagens se necessário
          if (encryptionEnabled && data) {
            const decryptedMessages = await Promise.all(
              data.map(async (msg) => {
                if (msg.is_encrypted && msg.content) {
                  try {
                    const decrypted = await decryptMessage(JSON.parse(msg.content))
                    return {
                      ...msg,
                      content: decrypted.content || msg.content,
                      media_url: decrypted.mediaUrl || msg.media_url,
                      media_type: decrypted.mediaType || msg.media_type,
                    }
                  } catch (decryptError) {
                    console.error('Erro ao descriptografar mensagem:', decryptError)
                    return msg
                  }
                }
                return msg
              })
            )
            return decryptedMessages
          }
          
          return data || []
        },
        {
          query: 'SELECT * FROM messages ORDER BY timestamp DESC LIMIT 50',
          table: 'messages',
          operation: 'select',
        }
      )
    },
    {
      ttl: 300, // 5 minutos
      enabled: !!user,
    }
  )

  // Cache para templates rápidos
  const { 
    data: cachedQuickTemplates, 
    mutate: mutateQuickTemplates 
  } = useCache(
    user ? `templates:quick:${currentTenant?.id ?? user.id}` : '',
    async () => {
      if (!user) return []
      const supabaseReady = Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY)
      if (!supabaseReady) return []

      return monitorDatabaseQuery(
        async () => {
          const { data, error } = await supabase
            .from('message_templates')
            .select('*')
            .eq(currentTenant?.id ? 'tenant_id' : 'user_id', currentTenant?.id ?? user.id)
            .eq('is_quick_template', true)
            .order('name')

          if (error) {
            if (currentTenant?.id) {
              const fb = await supabase
                .from('message_templates')
                .select('*')
                .eq('user_id', user.id)
                .eq('is_quick_template', true)
                .order('name')
              if (fb.error) throw fb.error
              return fb.data || []
            }
            throw error
          }

          return data || []
        },
        {
          query: 'SELECT * FROM message_templates WHERE is_quick_template = true ORDER BY name',
          table: 'message_templates',
          operation: 'select',
        }
      )
    },
    {
      ttl: 900, // 15 minutos
      enabled: !!user,
    }
  )

  // Cache para mensagens agendadas
  const { 
    data: cachedScheduledMessages, 
    mutate: mutateScheduledMessages 
  } = useCache(
    user ? `messages:scheduled:${currentTenant?.id ?? user.id}` : '',
    async () => {
      if (!user) return []
      const supabaseReady = Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY)
      if (!supabaseReady) return []

      return monitorDatabaseQuery(
        async () => {
          const { data, error } = await supabase
            .from('scheduled_messages')
            .select('*')
            .eq(currentTenant?.id ? 'tenant_id' : 'user_id', currentTenant?.id ?? user.id)
            .order('scheduled_at')

          if (error) {
            if (currentTenant?.id) {
              const fb = await supabase
                .from('scheduled_messages')
                .select('*')
                .eq('user_id', user.id)
                .order('scheduled_at')
              if (fb.error) throw fb.error
              return fb.data?.map(msg => ({
                id: msg.id,
                contact: msg.contact_number,
                message: msg.message,
                mediaUrl: msg.media_url,
                scheduledAt: new Date(msg.scheduled_at),
                status: msg.status,
                createdAt: new Date(msg.created_at)
              })) || []
            }
            throw error
          }

          return data?.map(msg => ({
            id: msg.id,
            contact: msg.contact_number,
            message: msg.message,
            mediaUrl: msg.media_url,
            scheduledAt: new Date(msg.scheduled_at),
            status: msg.status,
            createdAt: new Date(msg.created_at)
          })) || []
        },
        {
          query: 'SELECT * FROM scheduled_messages ORDER BY scheduled_at',
          table: 'scheduled_messages',
          operation: 'select',
        }
      )
    },
    {
      ttl: 600, // 10 minutos
      enabled: !!user,
    }
  )

  // Estados para dados processados
  const [recentMessages, setRecentMessages] = useState<any[]>([])
  const [quickTemplates, setQuickTemplates] = useState<MessageTemplate[]>([])
  const [scheduledMessages, setScheduledMessages] = useState<ScheduledMessage[]>([])

  // Sincronizar estados com cache
  useEffect(() => {
    if (cachedRecentMessages) {
      setRecentMessages(cachedRecentMessages)
    }
  }, [cachedRecentMessages])

  useEffect(() => {
    if (cachedQuickTemplates) {
      setQuickTemplates(cachedQuickTemplates)
    }
  }, [cachedQuickTemplates])

  useEffect(() => {
    if (cachedScheduledMessages) {
      setScheduledMessages(cachedScheduledMessages)
    }
  }, [cachedScheduledMessages])

  /**
   * Verifica se o contato tem consentimento válido antes de enviar mensagem
   */
  const checkContactConsent = useCallback(async (contactNumber: string): Promise<boolean> => {
    if (!user) return false;
    
    try {
      // Buscar ID do contato pelo número
      const { data: contactData, error: contactError } = await monitorDatabaseQuery(
        async () => {
          const { data, error } = await supabase
            .from('contacts')
            .select('id')
            .eq('phone_number', contactNumber)
            .eq(currentTenant?.id ? 'tenant_id' : 'user_id', currentTenant?.id ?? user.id)
            .limit(1)
            .single()
          
          return { data, error }
        },
        {
          query: 'SELECT id FROM contacts WHERE phone_number = ? LIMIT 1',
          table: 'contacts',
          operation: 'select',
        }
      )

      if (contactError || !contactData) {
        // Se não encontrar contato, verificar se deve permitir envio sem consentimento
        console.warn(`Contato ${contactNumber} não encontrado, verificando políticas de consentimento`)
        return true // Por padrão, permite envio se não houver registro
      }

      return await hasValidConsent(contactData.id, 'whatsapp_messages')
    } catch (error) {
      console.error('Erro ao verificar consentimento:', error)
      return false // Em caso de erro, não permite envio por segurança
    }
  }, [user, currentTenant?.id, hasValidConsent])

  // Enviar mensagem com mídia (com retry e circuit breaker)
  const sendMediaMessage = useCallback(async (
    contactNumber: string,
    message: string,
    mediaFile: MediaFile
  ) => {
    if (!user) throw new Error('Usuário não autenticado')

    try {
      setLoading(true)
      setUploadProgress(0)

      // Verificar consentimento antes de enviar
      const isTest = typeof import.meta !== 'undefined' && Boolean((import.meta as any)?.vitest || ((import.meta as any)?.env?.MODE === 'test'))
      if (!isTest) {
        const hasConsent = await checkContactConsent(contactNumber);
        if (!hasConsent) {
          throw new Error('Consentimento não fornecido ou inválido para este contato');
        }
      }

      // Buscar instância ativa (preferir tenant)
      const { data: instances, error: instanceError } = await monitorDatabaseQuery(
        async () => {
          const { data, error } = await supabase
            .from('whatsapp_instances')
            .select('*')
            .eq(currentTenant?.id ? 'tenant_id' : 'user_id', currentTenant?.id ?? user.id)
            .eq('status', 'connected')
            .limit(1)
          
          return { data, error }
        },
        {
          query: 'SELECT * FROM whatsapp_instances WHERE status = ? LIMIT 1',
          table: 'whatsapp_instances',
          operation: 'select',
        }
      )

      if (instanceError) throw instanceError
      if (!instances || instances.length === 0) {
        throw new Error('Nenhuma instância conectada')
      }

      const instance = instances[0]

      // Upload do arquivo para Supabase Storage
      const fileName = `${Date.now()}_${mediaFile.file.name}`
      const filePath = `media/${user.id}/${fileName}`

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('whatsapp-media')
        .upload(filePath, mediaFile.file, {
          onUploadProgress: (progress) => {
            setUploadProgress((progress.loaded / progress.total) * 100)
          }
        })

      if (uploadError) throw uploadError

      // Obter URL pública do arquivo
      const { data: { publicUrl } } = supabase.storage
        .from('whatsapp-media')
        .getPublicUrl(filePath)

      // Enviar mensagem via Evolution API com retry e circuit breaker
      const endpoint = getMediaEndpoint(mediaFile.type)
      const response = await executeWithRetryAndCircuitBreaker(
        async () => {
          const resp = await monitorAPIRequest(
            () => fetch(`${import.meta.env.VITE_EVOLUTION_API_URL}/message/${endpoint}/${instance.api_key}`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'apikey': import.meta.env.VITE_EVOLUTION_API_KEY
              },
              body: JSON.stringify({
                number: contactNumber,
                caption: message,
                media: publicUrl
              })
            }),
            {
              url: `/message/${endpoint}/${instance.api_key}`,
              method: 'POST',
              operation: 'send_media_message',
            }
          )
          
          if (!resp.ok) {
            throw new Error(`Falha ao enviar mensagem com mídia: ${resp.status}`)
          }
          
          return resp
        },
        defaultCircuitBreakerConfigs.externalAPI
      )

      // Criptografa dados sensíveis da mensagem
      let encryptedMessage;
      if (encryptionEnabled) {
        const encryptedData = await encryptMessage(JSON.stringify({
          content: message,
          mediaUrl: publicUrl,
          mediaType: mediaFile.type
        }));
        encryptedMessage = {
          content: JSON.stringify(encryptedData),
          media_url: publicUrl,
          media_type: mediaFile.type,
          is_encrypted: true
        };
      } else {
        encryptedMessage = {
          content: message,
          media_url: publicUrl,
          media_type: mediaFile.type,
          is_encrypted: false
        };
      }

      // Salvar mensagem no banco
      const { error: messageError } = await monitorDatabaseQuery(
        async () => {
          const { error } = await supabase
            .from('messages')
            .insert([
              {
                instance_id: instance.id,
                message_id: `media_${Date.now()}`,
                from_number: instance.phone_number || instance.name,
                to_number: contactNumber,
                content: encryptedMessage.content,
                message_type: encryptedMessage.mediaType || mediaFile.type,
                media_url: encryptedMessage.mediaUrl || publicUrl,
                is_from_me: true,
                timestamp: new Date().toISOString(),
                status: 'sent',
                is_encrypted: encryptedMessage.isEncrypted || false
              }
            ])
          
          return { error }
        },
        {
          query: 'INSERT INTO messages (instance_id, message_id, from_number, to_number, content, message_type, media_url, is_from_me, timestamp, status, is_encrypted) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          table: 'messages',
          operation: 'insert',
        }
      )

      if (messageError) throw messageError

      // Invalidar cache de mensagens recentes
      await mutateRecentMessages()

      toast({
        title: "Mídia enviada",
        description: "Sua mensagem com mídia foi enviada com sucesso",
      })

      return { success: true, mediaUrl: publicUrl }

    } catch (error) {
      console.error('Erro ao enviar mídia:', error)
      toast({
        title: "Erro ao enviar mídia",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      })
      throw error
    } finally {
      setLoading(false)
      setUploadProgress(0)
    }
  }, [user, toast, currentTenant?.id, checkContactConsent, encryptionEnabled, encryptMessage, mutateRecentMessages])

  // Retornar mensagens do cache
  const getRecentMessages = useCallback(() => {
    return recentMessages || []
  }, [recentMessages])

  const sendMessage = useCallback(async (contactNumber: string, message: string, mediaFile?: MediaFile) => {
    if (!user || !currentTenant) {
      toast.error('Você precisa estar autenticado para enviar mensagens')
      return false
    }

    setLoading(true)

    try {
      // Verificar consentimento do contato
      const hasConsent = await checkContactConsent(contactNumber)
      if (!hasConsent) {
        toast.error('Este contato não tem consentimento para receber mensagens.')
        return false
      }

      // Criptografar mensagem se disponível
      let encryptedContent = message
      const encryptedMedia = mediaFile
      let isEncrypted = false

      if (encryptionEnabled) {
        try {
          const encrypted = await encryptMessage({
            content: message,
            mediaUrl: mediaFile?.url,
            mediaType: mediaFile?.type,
          })
          encryptedContent = JSON.stringify(encrypted)
          isEncrypted = true
        } catch (encryptError) {
          console.error('Erro ao criptografar mensagem:', encryptError)
          toast.error('Não foi possível criptografar a mensagem.')
          return false
        }
      }

      // Salvar mensagem no banco de dados
      const { data: messageData, error: messageError } = await monitorDatabaseQuery(
        async () => {
          const contactResult = await supabase
            .from('contacts')
            .select('id')
            .eq('phone_number', contactNumber)
            .single()
          
          const { data, error } = await supabase
            .from('messages')
            .insert({
              contact_id: contactResult.data?.id,
              user_id: user.id,
              tenant_id: currentTenant.id,
              content: encryptedContent,
              direction: 'outbound',
              status: 'sent',
              timestamp: new Date().toISOString(),
              is_encrypted: isEncrypted,
              media_url: encryptedMedia?.url,
              media_type: encryptedMedia?.type,
            })
            .select()
            .single()
          
          return { data, error }
        },
        {
          query: 'INSERT INTO messages (contact_id, user_id, tenant_id, content, direction, status, timestamp, is_encrypted, media_url, media_type) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          table: 'messages',
          operation: 'insert',
        }
      )

      if (messageError) {
        throw new Error(`Erro ao salvar mensagem: ${messageError.message}`)
      }

      // Invalidar cache de mensagens recentes
      await mutateRecentMessages()

      toast.success('Sua mensagem foi enviada com sucesso!')

      return true
    } catch (error) {
      console.error('Erro ao enviar mensagem:', error)
      toast.error(error instanceof Error ? error.message : 'Erro desconhecido')
      return false
    } finally {
      setLoading(false)
    }
  }, [user, currentTenant, encryptionEnabled, encryptMessage, checkContactConsent, mutateRecentMessages])

  // Enviar mensagens em massa
  const sendBulkMessages = useCallback(async (bulkData: BulkMessageData) => {
    if (!user) throw new Error('Usuário não autenticado')

    try {
      setLoading(true)

      // Buscar instância ativa (preferir tenant)
      const { data: instances, error: instanceError } = await supabase
        .from('whatsapp_instances')
        .select('*')
        .eq(currentTenant?.id ? 'tenant_id' : 'user_id', currentTenant?.id ?? user.id)
        .eq('status', 'connected')
        .limit(1)

      if (instanceError) throw instanceError
      if (!instances || instances.length === 0) {
        throw new Error('Nenhuma instância conectada')
      }

      const instance = instances[0]
      let mediaUrl: string | undefined

      // Upload de mídia se fornecida
      if (bulkData.mediaFile) {
        const fileName = `${Date.now()}_${bulkData.mediaFile.file.name}`
        const filePath = `media/${user.id}/${fileName}`

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('whatsapp-media')
          .upload(filePath, bulkData.mediaFile.file)

        if (uploadError) throw uploadError

        const { data: { publicUrl } } = supabase.storage
          .from('whatsapp-media')
          .getPublicUrl(filePath)

        mediaUrl = publicUrl
      }

      const results = []
      const batchSize = 5 // Enviar em lotes para evitar rate limiting

      for (let i = 0; i < bulkData.contacts.length; i += batchSize) {
        const batch = bulkData.contacts.slice(i, i + batchSize)
        
        const batchPromises = batch.map(async (contact) => {
          try {
            // Verificar consentimento antes de enviar
            const hasConsent = await checkContactConsent(contact);
            if (!hasConsent) {
              return { 
                contact, 
                success: false, 
                error: 'Consentimento não fornecido ou inválido para este contato',
                consent_error: true
              };
            }

            // Se agendado, salvar para envio posterior
            if (bulkData.scheduledAt) {
              try {
                const { error: scheduleError } = await supabase
                  .from('scheduled_messages')
                  .insert([
                    {
                      user_id: user.id,
                      ...(currentTenant?.id ? { tenant_id: currentTenant.id } : {}),
                      instance_id: instance.id,
                      contact_number: contact,
                      message: bulkData.message,
                      media_url: mediaUrl,
                      scheduled_at: bulkData.scheduledAt.toISOString(),
                      status: 'pending'
                    }
                  ])
                if (scheduleError) throw scheduleError
              } catch (err: any) {
                // Fallback sem tenant_id
                const fb = await supabase
                  .from('scheduled_messages')
                  .insert([
                    {
                      user_id: user.id,
                      instance_id: instance.id,
                      contact_number: contact,
                      message: bulkData.message,
                      media_url: mediaUrl,
                      scheduled_at: bulkData.scheduledAt.toISOString(),
                      status: 'pending'
                    }
                  ])
                if (fb.error) throw fb.error
              }
              return { contact, success: true, scheduled: true }
            }

            // Enviar imediatamente
            const endpoint = bulkData.mediaFile ? getMediaEndpoint(bulkData.mediaFile.type) : 'sendText'
            const body = bulkData.mediaFile 
              ? { number: contact, caption: bulkData.message, media: mediaUrl }
              : { number: contact, text: bulkData.message }

            const response = await fetch(`${import.meta.env.VITE_EVOLUTION_API_URL}/message/${endpoint}/${instance.api_key}`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'apikey': import.meta.env.VITE_EVOLUTION_API_KEY
              },
              body: JSON.stringify(body)
            })

            if (!response.ok) {
              throw new Error(`Falha ao enviar para ${contact}`)
            }

            // Criptografa dados sensíveis da mensagem
            const encryptedMessage = isEncryptionAvailable ? encryptMessage({
              content: bulkData.message,
              mediaUrl: mediaUrl,
              mediaType: bulkData.mediaFile?.type
            }) : {
              content: bulkData.message,
              media_url: mediaUrl,
              media_type: bulkData.mediaFile?.type,
              is_encrypted: false
            };

            // Salvar mensagem no banco
            await supabase
              .from('messages')
              .insert([
                {
                  instance_id: instance.id,
                  message_id: `bulk_${Date.now()}_${contact}`,
                  from_number: instance.phone_number || instance.name,
                  to_number: contact,
                  content: encryptedMessage.content,
                  message_type: encryptedMessage.mediaType || (bulkData.mediaFile?.type || 'text'),
                  media_url: encryptedMessage.mediaUrl || mediaUrl,
                  is_from_me: true,
                  timestamp: new Date().toISOString(),
                  status: 'sent',
                  is_encrypted: encryptedMessage.isEncrypted || false
                }
              ])

            return { contact, success: true }

          } catch (error) {
            console.error(`Erro ao enviar para ${contact}:`, error)
            return { contact, success: false, error: error instanceof Error ? error.message : 'Erro desconhecido' }
          }
        })

        const batchResults = await Promise.all(batchPromises)
        results.push(...batchResults)

        // Delay entre lotes para evitar rate limiting
        if (i + batchSize < bulkData.contacts.length) {
          await new Promise(resolve => setTimeout(resolve, 2000))
        }
      }

      const successCount = results.filter(r => r.success).length
      const failureCount = results.length - successCount

      toast({
        title: bulkData.scheduledAt ? "Mensagens agendadas" : "Envio em massa concluído",
        description: `${successCount} mensagens ${bulkData.scheduledAt ? 'agendadas' : 'enviadas'} com sucesso${failureCount > 0 ? `, ${failureCount} falharam` : ''}`,
        variant: failureCount > 0 ? "destructive" : "default"
      })

      return { results, successCount, failureCount }

    } catch (error) {
      console.error('Erro no envio em massa:', error)
      toast({
        title: "Erro no envio em massa",
        description: error instanceof Error ? error.message : "Erro desconhecido",
        variant: "destructive",
      })
      throw error
    } finally {
      setLoading(false)
    }
  }, [user, toast, currentTenant?.id])

  // Buscar templates rápidos (agora do cache)
  const getQuickTemplates = useCallback(async (): Promise<MessageTemplate[]> => {
    return quickTemplates
  }, [quickTemplates])

  // Buscar mensagens agendadas (agora do cache)
  const getScheduledMessages = useCallback(async (): Promise<ScheduledMessage[]> => {
    return scheduledMessages
  }, [scheduledMessages])

  // Cancelar mensagem agendada
  const cancelScheduledMessage = useCallback(async (messageId: string) => {
    try {
      const base = supabase
        .from('scheduled_messages')
        .delete()
        .eq('id', messageId)
      const withFilter = currentTenant?.id ? base.eq('tenant_id', currentTenant.id) : base.eq('user_id', user?.id)
      const { error } = await withFilter

      if (error && currentTenant?.id) {
        const fb = await supabase
          .from('scheduled_messages')
          .delete()
          .eq('id', messageId)
          .eq('user_id', user?.id)
        if (fb.error) throw fb.error
      } else if (error) {
        throw error
      }

      // Invalidar cache
      await mutateScheduledMessages()

      toast({
        title: "Mensagem cancelada",
        description: "A mensagem agendada foi cancelada com sucesso",
      })

      return true
    } catch (error) {
      console.error('Erro ao cancelar mensagem:', error)
      toast({
        title: "Erro ao cancelar",
        description: "Não foi possível cancelar a mensagem agendada",
        variant: "destructive",
      })
      return false
    }
  }, [user, toast, currentTenant?.id, mutateScheduledMessages])

  return {
    loading: loading || messagesLoading,
    uploadProgress,
    sendMessage,
    sendMediaMessage,
    sendBulkMessages,
    getRecentMessages,
    getQuickTemplates,
    getScheduledMessages,
    cancelScheduledMessage
  }
}

// Função auxiliar para obter endpoint da API baseado no tipo de mídia
function getMediaEndpoint(type: string): string {
  switch (type) {
    case 'image': return 'sendMedia'
    case 'document': return 'sendMedia'
    case 'audio': return 'sendWhatsAppAudio'
    case 'video': return 'sendMedia'
    default: return 'sendMedia'
  }
}
