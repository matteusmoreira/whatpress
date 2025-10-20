import { supabase } from '@/lib/supabase'
import { EvolutionApiService } from './evolutionApi'

export interface WhatsAppInstance {
  id: string
  user_id: string
  tenant_id?: string
  name: string
  phone_number?: string
  status: 'disconnected' | 'connecting' | 'connected' | 'error'
  qr_code?: string
  webhook_url?: string
  api_key?: string
  last_activity?: string
  created_at: string
  updated_at: string
}

export interface CreateInstanceData {
  name: string
  webhook_url?: string
}

export class WhatsAppInstanceService {
  // Criar nova instância no banco e na Evolution API
  async createInstance(data: CreateInstanceData, tenantId?: string): Promise<WhatsAppInstance> {
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (userError || !user) {
        throw new Error('Usuário não autenticado')
      }

      // Usar exatamente o nome informado no sistema como nome técnico da instância
      // Sem slug, sem uppercase, sem fallback – garantir apenas trim
      const instanceName = (data.name || '').trim()
      if (!instanceName) {
        throw new Error('Nome da instância inválido')
      }
      
      // Criar instância no banco de dados primeiro
      const insertPayload: any = {
        name: data.name,
        status: 'disconnected',
        webhook_url: data.webhook_url || import.meta.env.VITE_WEBHOOK_URL || ((typeof window !== 'undefined' && window.location.hostname === 'localhost') ? 'http://localhost:3001/webhook' : `${window.location.origin}/api/webhook`),
        api_key: instanceName,
        ...(tenantId ? { tenant_id: tenantId } : { user_id: user.id })
      }

      const { data: instance, error: dbError } = await supabase
        .from('whatsapp_instances')
        .insert(insertPayload)
        .select()
        .single()

      if (dbError) {
        throw new Error(`Erro ao criar instância no banco: ${dbError.message}`)
      }

      // Criar instância na Evolution API
      const evolutionService = new EvolutionApiService({
        baseUrl: import.meta.env.VITE_EVOLUTION_API_URL || 'http://localhost:8080',
        apiKey: import.meta.env.VITE_EVOLUTION_API_KEY || 'your-api-key',
        instanceName: instanceName
      })

      try {
        const creation = await evolutionService.createInstance()
        console.log('Instância criada na Evolution API:', instanceName)
        // Se a criação já retornou QR Code, salvar e ajustar status
        const qrBase64 = creation?.qrcode?.base64 || (typeof creation?.qrcode === 'string' ? creation.qrcode : undefined)
        if (qrBase64) {
          const dataUri = qrBase64.startsWith('data:image') ? qrBase64 : `data:image/png;base64,${qrBase64}`
          await this.updateInstance(instance.id, {
            status: 'connecting',
            qr_code: dataUri
          })
        }
      } catch (evolutionError: any) {
        console.error('Erro ao criar instância na Evolution API:', evolutionError?.message || evolutionError)
        // Não falhar completamente, apenas logar o erro
      }

      return instance
    } catch (error) {
      console.error('Erro ao criar instância:', error)
      throw error
    }
  }

  // Listar instâncias do usuário/tenant
  async getUserInstances(tenantId?: string): Promise<WhatsAppInstance[]> {
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (userError || !user) {
        throw new Error('Usuário não autenticado')
      }

      let instancesResp: any[] = []
      const { data: instances, error } = await supabase
        .from('whatsapp_instances')
        .select('*')
        .eq(tenantId ? 'tenant_id' : 'user_id', tenantId ?? user.id)
        .order('created_at', { ascending: false })

      if (error) {
        if (tenantId) {
          const fallback = await supabase
            .from('whatsapp_instances')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
          if (fallback.error) throw new Error(`Erro ao buscar instâncias: ${fallback.error.message}`)
          instancesResp = fallback.data || []
        } else {
          throw new Error(`Erro ao buscar instâncias: ${error.message}`)
        }
      } else {
        instancesResp = instances || []
      }

      // Garantir tipagem correta do status mapeando para o union type
      const normalized = (instancesResp || []).map(i => ({
        ...i,
        status: this.mapEvolutionStatus((i as any).status || 'unknown')
      })) as WhatsAppInstance[]

      return normalized
    } catch (error) {
      console.error('Erro ao buscar instâncias:', error)
      throw error
    }
  }

  // Conectar instância (gerar QR Code)
  async connectInstance(instanceId: string, tenantId?: string): Promise<{ qrCode?: string; status: WhatsAppInstance['status'] }> {
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (userError || !user) {
        throw new Error('Usuário não autenticado')
      }

      // Buscar instância no banco
      const { data: instance, error: dbError } = await supabase
        .from('whatsapp_instances')
        .select('*')
        .eq('id', instanceId)
        .eq(tenantId ? 'tenant_id' : 'user_id', tenantId ?? user.id)
        .single()

      if (dbError || !instance) {
        throw new Error('Instância não encontrada')
      }

      // Atualizar status para connecting
      await this.updateInstanceStatus(instanceId, 'connecting')

      // Conectar na Evolution API
      const evolutionService = new EvolutionApiService({
        baseUrl: import.meta.env.VITE_EVOLUTION_API_URL || 'http://localhost:8080',
        apiKey: import.meta.env.VITE_EVOLUTION_API_KEY || 'your-api-key',
        instanceName: instance.api_key || instance.name
      })

      try {
        const result = await evolutionService.connectInstance()
        
        // Normalizar QR code se presente
        const qrBase64 = (typeof result?.qrcode === 'string' ? result.qrcode : (result?.qrcode?.base64 ?? undefined))
        if (qrBase64) {
          const dataUri = qrBase64.startsWith('data:image') ? qrBase64 : `data:image/png;base64,${qrBase64}`
          await this.updateInstance(instanceId, {
            status: 'connecting',
            qr_code: dataUri
          })

          return { qrCode: dataUri, status: 'connecting' }
        }

        const status = this.mapEvolutionStatus(result?.state)
        await this.updateInstanceStatus(instanceId, status)
        return { status }
      } catch (evolutionError: any) {
        console.error('Erro ao conectar instância na Evolution API:', evolutionError)
        // Se 404: tentar criar a instância na Evolution e reconectar
        const is404 = String(evolutionError?.message || '').includes('404') || evolutionError?.status === 404
        if (is404) {
          console.log('Instância não existe na Evolution. Tentando criar e reconectar...')
          try {
            await evolutionService.createInstance()
            const retry = await evolutionService.connectInstance()
            const qrBase64 = (typeof retry?.qrcode === 'string' ? retry.qrcode : (retry?.qrcode?.base64 ?? undefined))
            if (qrBase64) {
              const dataUri = qrBase64.startsWith('data:image') ? qrBase64 : `data:image/png;base64,${qrBase64}`
              await this.updateInstance(instanceId, { status: 'connecting', qr_code: dataUri })
              return { qrCode: dataUri, status: 'connecting' }
            }
            const status = this.mapEvolutionStatus(retry?.state)
            await this.updateInstanceStatus(instanceId, status)
            return { status }
          } catch (retryErr) {
            console.error('Falha ao criar/reconectar instância na Evolution:', retryErr)
          }
        }
        await this.updateInstanceStatus(instanceId, 'error')
        return { status: 'error' }
      }
    } catch (error) {
      console.error('Erro ao conectar instância:', error)
      throw error
    }
  }

  // Verificar status da instância
  async checkInstanceStatus(instanceId: string, tenantId?: string): Promise<WhatsAppInstance['status']> {
    try {
      console.log(`🔍 Verificando status da instância: ${instanceId}`)
      
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (userError || !user) {
        throw new Error('Usuário não autenticado')
      }

      // Buscar instância no banco
      const { data: instance, error: dbError } = await supabase
        .from('whatsapp_instances')
        .select('*')
        .eq('id', instanceId)
        .eq(tenantId ? 'tenant_id' : 'user_id', tenantId ?? user.id)
        .single()

      if (dbError || !instance) {
        console.error('❌ Instância não encontrada no banco:', dbError?.message)
        throw new Error('Instância não encontrada')
      }

      console.log(`📱 Instância encontrada: ${instance.name} (${instance.api_key})`)
      console.log(`📊 Status atual no banco: ${instance.status}`)

      // Verificar status na Evolution API
      const evolutionService = new EvolutionApiService({
        baseUrl: import.meta.env.VITE_EVOLUTION_API_URL || 'http://localhost:8080',
        apiKey: import.meta.env.VITE_EVOLUTION_API_KEY || 'your-api-key',
        instanceName: instance.api_key || instance.name
      })

      try {
        console.log(`🔗 Consultando Evolution API para instância: ${instance.api_key || instance.name}`)
        const result = await evolutionService.getInstanceStatus()
        console.log('📡 Resposta da Evolution API:', JSON.stringify(result, null, 2))
        
        // Extrair o estado da resposta da Evolution API
        let evolutionState = result?.state || result?.instance?.state || result?.connectionState || 'unknown'
        
        // Se a resposta tem uma estrutura diferente, tentar outras propriedades
        if (!evolutionState || evolutionState === 'unknown') {
          evolutionState = result?.status || result?.connection?.state || result?.data?.state || 'unknown'
        }
        
        console.log(`🎯 Estado extraído da Evolution API: ${evolutionState}`)
        
        const mappedStatus = this.mapEvolutionStatus(evolutionState)
        console.log(`🔄 Status mapeado: ${evolutionState} → ${mappedStatus}`)
        
        // Se o status mudou, atualizar no banco
        if (mappedStatus !== (instance as any).status) {
          console.log(`✅ Atualizando status no banco: ${(instance as any).status} → ${mappedStatus}`)
          await this.updateInstanceStatus(instanceId, mappedStatus)
          
          // Se conectou com sucesso, limpar QR code e tentar obter número do telefone
          if (mappedStatus === 'connected') {
            console.log('📞 Instância conectada! Tentando obter informações do telefone...')
            try {
              const phoneInfo = await evolutionService.getInstanceInfo()
              const phoneNumber = phoneInfo?.instance?.owner || phoneInfo?.owner || phoneInfo?.number
              if (phoneNumber) {
                console.log(`📱 Número do telefone obtido: ${phoneNumber}`)
                await this.updateInstance(instanceId, { 
                  phone_number: phoneNumber,
                  qr_code: undefined // Limpar QR code quando conectado
                })
              }
            } catch (phoneError) {
              console.warn('⚠️ Não foi possível obter informações do telefone:', phoneError)
            }
          }
        } else {
          console.log('ℹ️ Status não mudou, mantendo atual')
        }
        
        return mappedStatus
      } catch (evolutionError: any) {
        console.error('❌ Erro ao verificar status na Evolution API:', evolutionError)
        console.error('📋 Detalhes do erro:', {
          message: evolutionError.message,
          status: evolutionError.status,
          response: evolutionError.response
        })
        
        // Se o erro for 404, a instância pode não existir na Evolution API
        if (evolutionError.message?.includes('404') || evolutionError.status === 404) {
          console.log('🔄 Instância não encontrada na Evolution API, marcando como desconectada')
          await this.updateInstanceStatus(instanceId, 'disconnected')
          return 'disconnected'
        }
        
        // Para outros erros, marcar como erro apenas se não estiver conectada
        if ((instance as any).status !== 'connected') {
          await this.updateInstanceStatus(instanceId, 'error')
          return 'error'
        }
        
        // Se estava conectada, manter o status
        return (instance as any).status as WhatsAppInstance['status']
      }
    } catch (error) {
      console.error('💥 Erro geral ao verificar status:', error)
      throw error
    }
  }

  // Desconectar instância (logout na Evolution e atualizar banco)
  async disconnectInstance(instanceId: string, tenantId?: string): Promise<void> {
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      throw new Error('Usuário não autenticado')
    }

    const { data: instance, error: dbError } = await supabase
      .from('whatsapp_instances')
      .select('*')
      .eq('id', instanceId)
      .eq(tenantId ? 'tenant_id' : 'user_id', tenantId ?? user.id)
      .single()

    if (dbError || !instance) {
      throw new Error('Instância não encontrada')
    }

    const evolutionService = new EvolutionApiService({
      baseUrl: import.meta.env.VITE_EVOLUTION_API_URL || 'http://localhost:8080',
      apiKey: import.meta.env.VITE_EVOLUTION_API_KEY || 'your-api-key',
      instanceName: instance.api_key || instance.name
    })

    try {
      await evolutionService.logoutInstance()
    } catch (e) {
      console.warn('Falha ao fazer logout na Evolution API, continuando desconexão local:', e)
    }

    await this.updateInstance(instanceId, { status: 'disconnected', qr_code: null, last_activity: new Date().toISOString() })
  }

  // Excluir instância (Evolution API + Banco)
  async deleteInstance(instanceId: string, tenantId?: string): Promise<void> {
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      throw new Error('Usuário não autenticado')
    }

    const { data: instance, error: dbError } = await supabase
      .from('whatsapp_instances')
      .select('*')
      .eq('id', instanceId)
      .eq(tenantId ? 'tenant_id' : 'user_id', tenantId ?? user.id)
      .single()

    if (dbError || !instance) {
      throw new Error('Instância não encontrada')
    }

    const evolutionService = new EvolutionApiService({
      baseUrl: import.meta.env.VITE_EVOLUTION_API_URL || 'http://localhost:8080',
      apiKey: import.meta.env.VITE_EVOLUTION_API_KEY || 'your-api-key',
      instanceName: instance.api_key || instance.name
    })

    try {
      await evolutionService.deleteInstance()
    } catch (e) {
      console.warn('Falha ao deletar instância na Evolution API, removendo apenas do banco:', e)
    }

    const { error } = await supabase
      .from('whatsapp_instances')
      .delete()
      .eq('id', instanceId)
      .eq(tenantId ? 'tenant_id' : 'user_id', tenantId ?? user.id)

    if (error) {
      throw new Error(`Erro ao excluir instância do banco: ${error.message}`)
    }
  }

  // Atualizar dados da instância
  private async updateInstance(instanceId: string, updates: Partial<WhatsAppInstance>): Promise<void> {
    const { error } = await supabase
      .from('whatsapp_instances')
      .update(updates)
      .eq('id', instanceId)

    if (error) {
      console.error('Erro ao atualizar instância:', error.message)
    }
  }

  // Atualizar status
  private async updateInstanceStatus(instanceId: string, status: WhatsAppInstance['status'] | string): Promise<void> {
    const mappedStatus = this.mapEvolutionStatus(status)
    await this.updateInstance(instanceId, { status: mappedStatus, last_activity: new Date().toISOString() })
  }

  // Mapear status Evolution para nosso status interno
  private mapEvolutionStatus(evolutionStatus: string): WhatsAppInstance['status'] {
    console.log(`🗺️ Mapeando status: "${evolutionStatus}"`)
    
    if (!evolutionStatus || evolutionStatus === 'unknown') {
      console.log('❓ Status desconhecido, retornando error')
      return 'error'
    }

    // Normalizar o status para lowercase para comparação
    const normalizedStatus = evolutionStatus.toLowerCase().trim()
    
    // Estados que indicam conexão estabelecida
    const connectedStates = new Set([
      'open', 
      'online', 
      'logged', 
      'authenticated', 
      'ready',
      'connected',
      'qr_read_success',
      'success'
    ])
    
    // Estados que indicam processo de conexão em andamento
    const connectingStates = new Set([
      'connecting', 
      'qr', 
      'qrcode',
      'qr_read', 
      'qr_idle', 
      'loading_screen', 
      'pairing', 
      'require_connection',
      'initializing',
      'starting',
      'qr_updated'
    ])
    
    // Estados que indicam desconexão
    const disconnectedStates = new Set([
      'close', 
      'closed',
      'offline', 
      'timeout', 
      'unauthenticated', 
      'conflict',
      'disconnected',
      'logout',
      'destroyed'
    ])

    // Estados de erro explícitos
    const errorStates = new Set([
      'error',
      'fail',
      'failed'
    ])

    if (connectedStates.has(normalizedStatus)) {
      console.log('✅ Status mapeado para: connected')
      return 'connected'
    }
    
    if (connectingStates.has(normalizedStatus)) {
      console.log('🔄 Status mapeado para: connecting')
      return 'connecting'
    }
    
    if (disconnectedStates.has(normalizedStatus)) {
      console.log('❌ Status mapeado para: disconnected')
      return 'disconnected'
    }

    if (errorStates.has(normalizedStatus)) {
      console.log('⛔ Status mapeado para: error')
      return 'error'
    }
    
    // Se não reconheceu o status, logar para debug e retornar error
    console.warn(`⚠️ Status não reconhecido: "${evolutionStatus}" (normalizado: "${normalizedStatus}"), retornando error`)
    return 'error'
  }

  // Atualizações vindas do webhook
  async handleQRCodeUpdate(instanceName: string, qrCode: string): Promise<void> {
    const { data: instance } = await supabase
      .from('whatsapp_instances')
      .select('id')
      .eq('api_key', instanceName)
      .single()

    if (instance?.id) {
      await this.updateInstance(instance.id, { status: 'connecting', qr_code: qrCode })
    }
  }

  async handleConnectionEstablished(instanceName: string, phoneNumber?: string): Promise<void> {
    const { data: instance } = await supabase
      .from('whatsapp_instances')
      .select('id')
      .eq('api_key', instanceName)
      .single()

    if (instance?.id) {
      await this.updateInstance(instance.id, { status: 'connected', qr_code: null, phone_number: phoneNumber })
    }
  }
}

export const whatsappInstanceService = new WhatsAppInstanceService()