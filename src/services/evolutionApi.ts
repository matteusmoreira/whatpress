// Serviço para integração com Evolution API - REFATORADO COMPLETAMENTE
export interface EvolutionApiConfig {
  baseUrl: string;
  apiKey: string;
  instanceName: string;
}

export interface WhatsAppMessage {
  id?: string;
  from: string;
  to: string;
  message: string;
  type: 'text' | 'image' | 'document' | 'audio' | 'video';
  timestamp?: number;
  status?: 'pending' | 'sent' | 'delivered' | 'read' | 'failed';
}

export interface WhatsAppContact {
  number: string;
  name?: string;
  profilePic?: string;
  isGroup?: boolean;
}

export class EvolutionApiService {
  private config: EvolutionApiConfig;

  constructor(config: EvolutionApiConfig) {
    this.config = config;
  }

  // Normaliza a baseUrl removendo barras à direita
  private getBaseUrl() {
    return String(this.config.baseUrl || '').replace(/\r?\n/g, '').trim().replace(/\/+$/, '');
  }

  // Retorna o nome da instância codificado para uso em URLs
  private getEncodedInstanceName() {
    const name = String(this.config.instanceName || '').replace(/\r?\n/g, '').trim()
    return encodeURIComponent(name);
  }

  // Configurar headers padrão para requisições
  private getHeaders() {
    const apiKey = String(this.config.apiKey || '').replace(/\r?\n/g, '').trim()
    return {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'apikey': apiKey,
    };
  }

  // Helper simplificado: tenta apenas os endpoints corretos da Evolution API
  private async makeRequest(endpoint: string, init: RequestInit): Promise<Response> {
    const url = `${this.getBaseUrl()}${endpoint}`
    console.log(`🌐 Fazendo requisição para: ${url}`)
    
    try {
      const response = await fetch(url, init)
      console.log(`📡 Resposta: ${response.status} ${response.statusText}`)
      
      if (!response.ok) {
        const text = await response.text().catch(() => '')
        throw new Error(`HTTP ${response.status}: ${text || response.statusText}`)
      }
      
      return response
    } catch (error) {
      console.error(`❌ Erro na requisição para ${url}:`, error)
      throw error
    }
  }

  // Criar instância do WhatsApp
  async createInstance(): Promise<any> {
    try {
      console.log(`🏗️ Criando instância: ${this.config.instanceName}`)
      
      const response = await this.makeRequest('/instance/create', {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          instanceName: this.config.instanceName,
          qrcode: true,
          integration: 'WHATSAPP-BAILEYS'
        })
      })

      const result = await response.json()
      console.log('✅ Instância criada:', JSON.stringify(result, null, 2))
      return result
    } catch (error) {
      console.error('❌ Erro ao criar instância:', error)
      throw error
    }
  }

  // Conectar instância e obter QR Code com polling inteligente
  async connectInstance(): Promise<any> {
    try {
      console.log(`🔗 Conectando instância: ${this.config.instanceName}`)
      
      // Primeiro, tentar conectar
      const response = await this.makeRequest(`/instance/connect/${this.getEncodedInstanceName()}`, {
        method: 'GET',
        headers: this.getHeaders(),
      });

      const data = await response.json();
      console.log('📡 Resposta inicial da conexão:', JSON.stringify(data, null, 2))
      
      // Implementar polling inteligente para obter QR code
      return await this.pollForQRCode();
    } catch (error) {
      console.error('❌ Erro ao conectar instância:', error);
      
      // Se der erro 404, tentar criar a instância primeiro
      if (error.message?.includes('404')) {
        console.log('🔄 Tentando criar instância primeiro...')
        try {
          await this.createInstance()
          console.log('✅ Instância criada, tentando conectar novamente...')
          
          const retryResponse = await this.makeRequest(`/instance/connect/${this.getEncodedInstanceName()}`, {
            method: 'GET',
            headers: this.getHeaders(),
          });
          
          const retryData = await retryResponse.json();
          console.log('📡 Resposta após criar instância:', JSON.stringify(retryData, null, 2))
          
          return await this.pollForQRCode();
        } catch (createError) {
          console.error('❌ Falha ao criar e conectar instância:', createError)
          throw createError
        }
      }
      
      throw error;
    }
  }

  // Polling inteligente para obter QR code
  private async pollForQRCode(): Promise<any> {
    console.log('🔄 Iniciando polling para obter QR code...')
    
    const maxAttempts = 30 // 1 minuto (2 segundos * 30)
    let attempts = 0
    
    while (attempts < maxAttempts) {
      attempts++
      console.log(`🔄 Tentativa ${attempts}/${maxAttempts} para obter QR code...`)
      
      try {
        // Verificar status da instância
        const statusData = await this.getInstanceStatus()
        console.log(`📊 Status atual (tentativa ${attempts}):`, JSON.stringify(statusData, null, 2))
        
        // Verificar se já está conectado
        if (statusData?.state === 'open' || statusData?.info?.connectionStatus === 'open') {
          console.log('✅ Instância já conectada!')
          return { state: 'open', connected: true }
        }
        
        // Tentar obter QR code via endpoint específico
        try {
          const qrResponse = await this.makeRequest(`/instance/connect/${this.getEncodedInstanceName()}`, {
            method: 'GET',
            headers: this.getHeaders(),
          });
          
          const qrData = await qrResponse.json();
          console.log(`📱 Dados QR (tentativa ${attempts}):`, JSON.stringify(qrData, null, 2))
          
          // Extrair QR code de diferentes formatos possíveis
          const qrcode = this.extractQRCode(qrData)
          
          if (qrcode) {
            console.log(`✅ QR code obtido na tentativa ${attempts}!`)
            return { 
              qrcode, 
              state: qrData?.state || 'connecting',
              raw: qrData 
            };
          }
        } catch (qrError) {
          console.warn(`⚠️ Erro ao obter QR code na tentativa ${attempts}:`, qrError)
        }
        
        // Aguardar 2 segundos antes da próxima tentativa
        if (attempts < maxAttempts) {
          console.log('⏳ Aguardando 2 segundos...')
          await new Promise(resolve => setTimeout(resolve, 2000))
        }
        
      } catch (error) {
        console.warn(`⚠️ Erro no polling ${attempts}:`, error)
        
        // Se for erro 404, a instância pode não existir mais
        if (error.message?.includes('404')) {
          console.log('🔄 Instância não encontrada, tentando recriar...')
          try {
            await this.createInstance()
            console.log('✅ Instância recriada')
          } catch (recreateError) {
            console.error('❌ Falha ao recriar instância:', recreateError)
          }
        }
        
        // Aguardar antes da próxima tentativa
        if (attempts < maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, 2000))
        }
      }
    }
    
    console.error('❌ QR code não foi gerado após todas as tentativas')
    throw new Error('QR code não foi gerado. Tente novamente.')
  }

  // Extrair QR code de diferentes formatos
  private extractQRCode(data: any): string | null {
    // Verificar diferentes formatos de QR code
    if (data?.qrcode?.base64) {
      console.log('🎯 QR code encontrado em data.qrcode.base64')
      return this.formatQRCode(data.qrcode.base64)
    }
    
    if (typeof data?.qrcode === 'string') {
      console.log('🎯 QR code encontrado em data.qrcode (string)')
      return this.formatQRCode(data.qrcode)
    }
    
    if (data?.qr) {
      console.log('🎯 QR code encontrado em data.qr')
      return this.formatQRCode(data.qr)
    }
    
    if (data?.data?.qrcode) {
      console.log('🎯 QR code encontrado em data.data.qrcode')
      return this.formatQRCode(data.data.qrcode)
    }
    
    if (data?.data?.qr) {
      console.log('🎯 QR code encontrado em data.data.qr')
      return this.formatQRCode(data.data.qr)
    }
    
    if (data?.base64) {
      console.log('🎯 QR code encontrado em data.base64')
      return this.formatQRCode(data.base64)
    }
    
    console.log('❌ QR code não encontrado na resposta')
    return null
  }

  // Formatar QR code para base64 se necessário
  private formatQRCode(qrcode: string): string {
    if (!qrcode) return null
    
    if (qrcode.startsWith('data:image/')) {
      return qrcode
    }
    
    return `data:image/png;base64,${qrcode}`
  }

  // Verificar status da instância
  async getInstanceStatus(): Promise<any> {
    try {
      const query = `?instanceName=${this.getEncodedInstanceName()}`
      const response = await this.makeRequest(`/instance/fetchInstances${query}`, {
        method: 'GET',
        headers: this.getHeaders(),
      })

      const data = await response.json()
      const info = Array.isArray(data) && data.length > 0 ? data[0] : data
      const connectionStatus = info?.connectionStatus || info?.status || 'unknown'

      return {
        state: connectionStatus,
        status: info?.status,
        instanceName: info?.instanceName,
        info,
      }
    } catch (error) {
      console.error('❌ Erro ao verificar status:', error)
      throw error
    }
  }

  // Obter informações detalhadas da instância
  async getInstanceInfo(): Promise<any> {
    try {
      const query = `?instanceName=${this.getEncodedInstanceName()}`
      const response = await this.makeRequest(`/instance/fetchInstances${query}`, {
        method: 'GET',
        headers: this.getHeaders(),
      })

      const data = await response.json()
      return Array.isArray(data) && data.length > 0 ? data[0] : data
    } catch (error) {
      console.error('❌ Erro ao obter informações da instância:', error)
      throw error
    }
  }

  // Enviar mensagem de texto
  async sendTextMessage(to: string, message: string): Promise<any> {
    try {
      const response = await this.makeRequest(`/message/sendText/${this.getEncodedInstanceName()}`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          number: to,
          text: message
        })
      })

      return await response.json()
    } catch (error) {
      console.error('❌ Erro ao enviar mensagem:', error)
      throw error
    }
  }

  // Enviar mídia
  async sendMediaMessage(to: string, mediaUrl: string, caption?: string, type: 'image' | 'document' | 'audio' | 'video' = 'image'): Promise<any> {
    try {
      const response = await this.makeRequest(`/message/sendMedia/${this.getEncodedInstanceName()}`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          number: to,
          mediatype: type,
          media: mediaUrl,
          caption: caption || ''
        })
      })

      return await response.json()
    } catch (error) {
      console.error('❌ Erro ao enviar mídia:', error)
      throw error
    }
  }

  // Obter contatos
  async getContacts(): Promise<WhatsAppContact[]> {
    try {
      const response = await this.makeRequest(`/chat/findContacts/${this.getEncodedInstanceName()}`, {
        method: 'GET',
        headers: this.getHeaders(),
      })

      const data = await response.json()
      return Array.isArray(data) ? data.map(contact => ({
        number: contact.id || contact.number,
        name: contact.name || contact.pushName,
        profilePic: contact.profilePicUrl,
        isGroup: contact.id?.includes('@g.us') || false
      })) : []
    } catch (error) {
      console.error('❌ Erro ao obter contatos:', error)
      return []
    }
  }

  // Obter mensagens
  async getMessages(contactNumber: string, limit: number = 50): Promise<WhatsAppMessage[]> {
    try {
      const response = await this.makeRequest(`/chat/findMessages/${this.getEncodedInstanceName()}`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          where: {
            key: {
              remoteJid: contactNumber
            }
          },
          limit
        })
      })

      const data = await response.json()
      return Array.isArray(data) ? data.map(msg => ({
        id: msg.key?.id,
        from: msg.key?.remoteJid,
        to: msg.key?.remoteJid,
        message: msg.message?.conversation || msg.message?.extendedTextMessage?.text || '',
        type: this.getMessageType(msg),
        timestamp: msg.messageTimestamp,
        status: msg.status
      })) : []
    } catch (error) {
      console.error('❌ Erro ao obter mensagens:', error)
      return []
    }
  }

  private getMessageType(message: any): 'text' | 'image' | 'document' | 'audio' | 'video' {
    if (message.message?.imageMessage) return 'image'
    if (message.message?.documentMessage) return 'document'
    if (message.message?.audioMessage) return 'audio'
    if (message.message?.videoMessage) return 'video'
    return 'text'
  }

  // Deletar instância
  async deleteInstance(): Promise<any> {
    try {
      console.log(`🗑️ Deletando instância: ${this.config.instanceName}`)
      
      const response = await this.makeRequest(`/instance/delete/${this.getEncodedInstanceName()}`, {
        method: 'DELETE',
        headers: this.getHeaders(),
      })

      const result = await response.json()
      console.log('✅ Instância deletada:', result)
      return result
    } catch (error) {
      console.error('❌ Erro ao deletar instância:', error)
      throw error
    }
  }

  // Logout da instância (com tratamento de erro 404)
  async logoutInstance(): Promise<any> {
    try {
      console.log(`🚪 Fazendo logout da instância: ${this.config.instanceName}`)
      
      const response = await this.makeRequest(`/instance/logout/${this.getEncodedInstanceName()}`, {
        method: 'DELETE',
        headers: this.getHeaders(),
      })

      const result = await response.json()
      console.log('✅ Logout realizado:', result)
      return result
    } catch (error) {
      // Se for 404, a instância já não existe - não é um erro crítico
      if (error.message?.includes('404')) {
        console.log('ℹ️ Instância já não existe (404) - logout considerado bem-sucedido')
        return { success: true, message: 'Instância já desconectada' }
      }
      
      console.error('❌ Erro ao fazer logout:', error)
      throw error
    }
  }

  // Configurar webhook (com tratamento de erro melhorado)
  async setWebhookForInstance(
    url: string,
    options?: { webhook_by_events?: boolean; webhook_base64?: boolean; events?: string[]; enabled?: boolean }
  ): Promise<any> {
    try {
      console.log(`🔗 Configurando webhook para: ${this.config.instanceName}`)
      console.log(`📡 URL do webhook: ${url}`)
      
      const response = await this.makeRequest(`/webhook/set/${this.getEncodedInstanceName()}`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          url,
          enabled: options?.enabled ?? true,
          events: options?.events || [
            'APPLICATION_STARTUP',
            'QRCODE_UPDATED',
            'CONNECTION_UPDATE',
            'MESSAGES_UPSERT',
            'MESSAGES_UPDATE',
            'PRESENCE_UPDATE',
            'CHATS_UPSERT',
            'CHATS_UPDATE',
            'CHATS_DELETE',
            'CONTACTS_UPSERT',
            'CONTACTS_UPDATE'
          ],
          webhook_by_events: options?.webhook_by_events ?? false,
          webhook_base64: options?.webhook_base64 ?? false
        })
      })

      const result = await response.json()
      console.log('✅ Webhook configurado:', result)
      return result
    } catch (error) {
      // Webhook não é crítico - apenas avisar
      console.warn('⚠️ Falha ao configurar webhook (não crítico):', error)
      return { success: false, error: error.message }
    }
  }
}

export const evolutionApi = new EvolutionApiService({
  baseUrl: String(import.meta.env.VITE_EVOLUTION_API_URL || 'http://localhost:8080').replace(/\r?\n/g, '').trim(),
  apiKey: String(import.meta.env.VITE_EVOLUTION_API_KEY || 'your-api-key').replace(/\r?\n/g, '').trim(),
  instanceName: String(import.meta.env.VITE_EVOLUTION_INSTANCE_NAME || 'default-instance').replace(/\r?\n/g, '').trim()
})
