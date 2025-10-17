import { supabase } from '@/lib/supabase'
import { evolutionApi, EvolutionApiService } from './evolutionApi'

export interface WhatsAppInstance {
  id: string
  user_id: string
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
  async createInstance(data: CreateInstanceData): Promise<WhatsAppInstance> {
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (userError || !user) {
        throw new Error('Usuário não autenticado')
      }

      // Gerar nome único e legível para a instância na Evolution API, baseado no nome escolhido
      const slug = data.name
        .toLowerCase()
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '') // remove acentos
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '')
        .slice(0, 24) // evita nomes muito longos
      const instanceName = `${slug || 'instance'}-${user.id.slice(0, 8)}-${Date.now()}`
      
      // Criar instância no banco de dados primeiro
      const { data: instance, error: dbError } = await supabase
        .from('whatsapp_instances')
        .insert({
          user_id: user.id,
          name: data.name,
          status: 'disconnected',
          webhook_url: data.webhook_url || import.meta.env.VITE_WEBHOOK_URL || ((typeof window !== 'undefined' && window.location.hostname === 'localhost') ? 'http://localhost:3001/webhook' : `${window.location.origin}/webhook`),
          api_key: instanceName // Usar o nome da instância como chave técnica (igual ao mostrado na Evolution)
        })
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
      } catch (evolutionError) {
        console.error('Erro ao criar instância na Evolution API:', evolutionError)
        // Não falhar completamente, apenas logar o erro
      }

      return instance
    } catch (error) {
      console.error('Erro ao criar instância:', error)
      throw error
    }
  }

  // Listar instâncias do usuário
  async getUserInstances(): Promise<WhatsAppInstance[]> {
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (userError || !user) {
        throw new Error('Usuário não autenticado')
      }

      const { data: instances, error } = await supabase
        .from('whatsapp_instances')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (error) {
        throw new Error(`Erro ao buscar instâncias: ${error.message}`)
      }

      return instances || []
    } catch (error) {
      console.error('Erro ao buscar instâncias:', error)
      throw error
    }
  }

  // Conectar instância (gerar QR Code)
  async connectInstance(instanceId: string): Promise<{ qrCode?: string; status: string }> {
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
        .eq('user_id', user.id)
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
        instanceName: instance.api_key || `instance_${user.id}_${instanceId}`
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
      } catch (evolutionError) {
        console.error('Erro ao conectar instância na Evolution API:', evolutionError)
        await this.updateInstanceStatus(instanceId, 'error')
        return { status: 'error' }
      }
    } catch (error) {
      console.error('Erro ao conectar instância:', error)
      throw error
    }
  }

  // Verificar status da instância
  async checkInstanceStatus(instanceId: string): Promise<string> {
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
        .eq('user_id', user.id)
        .single()

      if (dbError || !instance) {
        throw new Error('Instância não encontrada')
      }

      // Verificar status na Evolution API
      const evolutionService = new EvolutionApiService({
        baseUrl: import.meta.env.VITE_EVOLUTION_API_URL || 'http://localhost:8080',
        apiKey: import.meta.env.VITE_EVOLUTION_API_KEY || 'your-api-key',
        instanceName: instance.api_key || `instance_${user.id}_${instanceId}`
      })

      try {
        const result = await evolutionService.getInstanceStatus()
        const status = this.mapEvolutionStatus(result.state)
        
        // Atualizar status no banco
        await this.updateInstanceStatus(instanceId, status)
        
        return status
      } catch (evolutionError) {
        console.error('Erro ao verificar status na Evolution API:', evolutionError)
        await this.updateInstanceStatus(instanceId, 'error')
        return 'error'
      }
    } catch (error) {
      console.error('Erro ao verificar status:', error)
      throw error
    }
  }

  // Desconectar instância
  async disconnectInstance(instanceId: string): Promise<void> {
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
        .eq('user_id', user.id)
        .single()

      if (dbError || !instance) {
        throw new Error('Instância não encontrada')
      }

      // Fazer logout na Evolution API
      const evolutionService = new EvolutionApiService({
        baseUrl: import.meta.env.VITE_EVOLUTION_API_URL || 'http://localhost:8080',
        apiKey: import.meta.env.VITE_EVOLUTION_API_KEY || 'your-api-key',
        instanceName: instance.api_key || `instance_${user.id}_${instanceId}`
      })

      try {
        await evolutionService.logoutInstance()
      } catch (evolutionError) {
        console.error('Erro ao desconectar na Evolution API:', evolutionError)
      }

      // Atualizar status no banco
      await this.updateInstance(instanceId, {
        status: 'disconnected',
        qr_code: null,
        phone_number: null
      })
    } catch (error) {
      console.error('Erro ao desconectar instância:', error)
      throw error
    }
  }

  // Deletar instância
  async deleteInstance(instanceId: string): Promise<void> {
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
        .eq('user_id', user.id)
        .single()

      if (dbError || !instance) {
        throw new Error('Instância não encontrada')
      }

      // Deletar na Evolution API
      const evolutionService = new EvolutionApiService({
        baseUrl: import.meta.env.VITE_EVOLUTION_API_URL || 'http://localhost:8080',
        apiKey: import.meta.env.VITE_EVOLUTION_API_KEY || 'your-api-key',
        instanceName: instance.api_key || `instance_${user.id}_${instanceId}`
      })

      try {
        await evolutionService.deleteInstance()
      } catch (evolutionError) {
        console.error('Erro ao deletar na Evolution API:', evolutionError)
      }

      // Deletar do banco de dados
      const { error: deleteError } = await supabase
        .from('whatsapp_instances')
        .delete()
        .eq('id', instanceId)
        .eq('user_id', user.id)

      if (deleteError) {
        throw new Error(`Erro ao deletar instância no banco: ${deleteError.message}`)
      }
    } catch (error) {
      console.error('Erro ao deletar instância:', error)
      throw error
    }
  }

  // Atualizar instância
  private async updateInstance(instanceId: string, updates: Partial<WhatsAppInstance>): Promise<void> {
    const { error } = await supabase
      .from('whatsapp_instances')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', instanceId)

    if (error) {
      throw new Error(`Erro ao atualizar instância: ${error.message}`)
    }
  }

  // Atualizar apenas o status
  private async updateInstanceStatus(instanceId: string, status: string): Promise<void> {
    await this.updateInstance(instanceId, { 
      status: status as any,
      last_activity: new Date().toISOString()
    })
  }

  // Mapear status da Evolution API para nosso formato
  private mapEvolutionStatus(evolutionStatus: string): 'disconnected' | 'connecting' | 'connected' | 'error' {
    switch (evolutionStatus?.toLowerCase()) {
      case 'open':
      case 'connected':
        return 'connected'
      case 'connecting':
      case 'qr':
        return 'connecting'
      case 'close':
      case 'closed':
      case 'disconnected':
        return 'disconnected'
      default:
        return 'error'
    }
  }

  // Processar webhook de QR Code atualizado
  async handleQRCodeUpdate(instanceName: string, qrCode: string): Promise<void> {
    try {
      // Encontrar instância pelo api_key (instanceName)
      const { data: instance, error } = await supabase
        .from('whatsapp_instances')
        .select('*')
        .eq('api_key', instanceName)
        .single()

      if (error || !instance) {
        console.error('Instância não encontrada para QR Code:', instanceName)
        return
      }

      // Atualizar QR Code no banco
      await this.updateInstance(instance.id, {
        qr_code: qrCode,
        status: 'connecting'
      })

      console.log('QR Code atualizado para instância:', instanceName)
    } catch (error) {
      console.error('Erro ao processar QR Code:', error)
    }
  }

  // Processar webhook de conexão estabelecida
  async handleConnectionEstablished(instanceName: string, phoneNumber?: string): Promise<void> {
    try {
      // Encontrar instância pelo api_key (instanceName)
      const { data: instance, error } = await supabase
        .from('whatsapp_instances')
        .select('*')
        .eq('api_key', instanceName)
        .single()

      if (error || !instance) {
        console.error('Instância não encontrada para conexão:', instanceName)
        return
      }

      // Atualizar status e limpar QR Code
      await this.updateInstance(instance.id, {
        status: 'connected',
        phone_number: phoneNumber,
        qr_code: null,
        last_activity: new Date().toISOString()
      })

      console.log('Conexão estabelecida para instância:', instanceName)
    } catch (error) {
      console.error('Erro ao processar conexão:', error)
    }
  }
}

// Instância do serviço
export const whatsappInstanceService = new WhatsAppInstanceService()