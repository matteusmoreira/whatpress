import { useState, useCallback } from 'react'
import { useAuth } from './useAuth'
import { useToast } from './use-toast'
import { supabase } from '@/lib/supabase'
import { useTenant } from '@/hooks/useTenant'

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
  const [loading, setLoading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const { user } = useAuth()
  const { toast } = useToast()
  const { currentTenant } = useTenant()

  // Enviar mensagem com mídia
  const sendMediaMessage = useCallback(async (
    contactNumber: string,
    message: string,
    mediaFile: MediaFile
  ) => {
    if (!user) throw new Error('Usuário não autenticado')

    try {
      setLoading(true)
      setUploadProgress(0)

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

      // Enviar mensagem via Evolution API
      const endpoint = getMediaEndpoint(mediaFile.type)
      const response = await fetch(`${import.meta.env.VITE_EVOLUTION_API_URL}/message/${endpoint}/${instance.api_key}`, {
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
      })

      if (!response.ok) {
        throw new Error('Falha ao enviar mensagem com mídia')
      }

      // Salvar mensagem no banco
      const { error: messageError } = await supabase
        .from('messages')
        .insert([
          {
            instance_id: instance.id,
            message_id: `media_${Date.now()}`,
            from_number: instance.phone_number || instance.name,
            to_number: contactNumber,
            content: message,
            message_type: mediaFile.type,
            media_url: publicUrl,
            is_from_me: true,
            timestamp: new Date().toISOString(),
            status: 'sent'
          }
        ])

      if (messageError) throw messageError

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
  }, [user, toast, currentTenant?.id])

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

            // Salvar mensagem no banco
            await supabase
              .from('messages')
              .insert([
                {
                  instance_id: instance.id,
                  message_id: `bulk_${Date.now()}_${contact}`,
                  from_number: instance.phone_number || instance.name,
                  to_number: contact,
                  content: bulkData.message,
                  message_type: bulkData.mediaFile?.type || 'text',
                  media_url: mediaUrl,
                  is_from_me: true,
                  timestamp: new Date().toISOString(),
                  status: 'sent'
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

  // Buscar templates rápidos
  const getQuickTemplates = useCallback(async (): Promise<MessageTemplate[]> => {
    if (!user) return []

    try {
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
    } catch (error) {
      console.error('Erro ao buscar templates:', error)
      return []
    }
  }, [user, currentTenant?.id])

  // Buscar mensagens agendadas
  const getScheduledMessages = useCallback(async (): Promise<ScheduledMessage[]> => {
    if (!user) return []

    try {
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
    } catch (error) {
      console.error('Erro ao buscar mensagens agendadas:', error)
      return []
    }
  }, [user, currentTenant?.id])

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
  }, [user, toast, currentTenant?.id])

  return {
    loading,
    uploadProgress,
    sendMediaMessage,
    sendBulkMessages,
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