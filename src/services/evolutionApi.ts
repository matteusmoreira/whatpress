// Serviço para integração com Evolution API
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

  // Normaliza a baseUrl removendo barras à direita para evitar "/"
  private getBaseUrl() {
    return this.config.baseUrl.replace(/\/+$/, '');
  }

  // Retorna o nome da instância codificado para uso em URLs
  private getEncodedInstanceName() {
    return encodeURIComponent(this.config.instanceName);
  }

  // Configurar headers padrão para requisições
  private getHeaders() {
    return {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'apikey': this.config.apiKey,
    };
  }

  // Helper: tenta múltiplos caminhos (com diferentes prefixes) e retorna o primeiro OK
  private async fetchWithFallback(paths: string[], init: RequestInit): Promise<Response> {
    let lastErr: any = null
    for (const p of paths) {
      const url = `${this.getBaseUrl()}${p}`
      try {
        const resp = await fetch(url, init)
        if (resp.ok) return resp
        // Se 404, tenta próximo variant; senão, lança
        if (resp.status !== 404) {
          const text = await resp.text().catch(() => '')
          throw new Error(`HTTP ${resp.status}: ${text || resp.statusText}`)
        }
        lastErr = new Error(`HTTP 404 em ${url}`)
      } catch (e) {
        lastErr = e
      }
    }
    throw lastErr || new Error('Falha na requisição com todos os caminhos')
  }

  // Criar instância do WhatsApp
  async createInstance(): Promise<any> {
    try {
      const response = await this.fetchWithFallback([
        `/instance/create`,
        `/api/instance/create`,
        `/api/v1/instance/create`
      ], {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          instanceName: this.config.instanceName,
          qrcode: true,
          integration: 'WHATSAPP-BAILEYS'
        })
      })

      return await response.json()
    } catch (error) {
      console.error('Erro ao criar instância:', error)
      throw error
    }
  }

  // Conectar instância (gerar QR Code)
  async connectInstance(): Promise<any> {
    try {
      const response = await this.fetchWithFallback([
        `/instance/connect/${this.getEncodedInstanceName()}`,
        `/api/instance/connect/${this.getEncodedInstanceName()}`,
        `/api/v1/instance/connect/${this.getEncodedInstanceName()}`
      ], {
        method: 'GET',
        headers: this.getHeaders(),
      });

      const data = await response.json();
      // Normalizar possíveis formatos v2
      if (data?.qrcode?.base64) {
        return { qrcode: data.qrcode.base64, state: data.state };
      }
      if (typeof data?.qrcode === 'string') {
        return { qrcode: data.qrcode, state: data.state };
      }
      if (data?.pairingCode || data?.code) {
        return { pairingCode: data.pairingCode || data.code, state: data.state };
      }
      return data;
    } catch (error) {
      console.error('Erro ao conectar instância:', error);
      throw error;
    }
  }

  // Verificar status da instância
  async getInstanceStatus(): Promise<any> {
    try {
      const query = `?instanceName=${this.getEncodedInstanceName()}`
      const response = await this.fetchWithFallback([
        `/instance/fetchInstances${query}`,
        `/api/instance/fetchInstances${query}`,
        `/api/v1/instance/fetchInstances${query}`
      ], {
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
      console.error('Erro ao verificar status:', error)
      throw error
    }
  }

  // Obter informações detalhadas da instância
  async getInstanceInfo(): Promise<any> {
    try {
      const query = `?instanceName=${this.getEncodedInstanceName()}`
      const response = await this.fetchWithFallback([
        `/instance/fetchInstances${query}`,
        `/api/instance/fetchInstances${query}`,
        `/api/v1/instance/fetchInstances${query}`
      ], {
        method: 'GET',
        headers: this.getHeaders(),
      });

      const result = await response.json();
      
      // A API pode retornar um array, pegar o primeiro item se for o caso
      if (Array.isArray(result) && result.length > 0) {
        return result[0];
      }
      
      return result;
    } catch (error) {
      console.error('Erro ao obter informações da instância:', error);
      throw error;
    }
  }

  // Enviar mensagem de texto
  async sendTextMessage(to: string, message: string): Promise<any> {
    try {
      const response = await this.fetchWithFallback([
        `/message/sendText/${this.getEncodedInstanceName()}`,
        `/api/message/sendText/${this.getEncodedInstanceName()}`,
        `/api/v1/message/sendText/${this.getEncodedInstanceName()}`
      ], {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          number: to,
          text: message,
          delay: 1000
        })
      });

      return await response.json();
    } catch (error) {
      console.error('Erro ao enviar mensagem:', error);
      throw error;
    }
  }

  // Enviar mensagem com mídia
  async sendMediaMessage(to: string, mediaUrl: string, caption?: string, type: 'image' | 'document' | 'audio' | 'video' = 'image'): Promise<any> {
    try {
      const endpoint = type === 'image' ? 'sendMedia' : 
                     type === 'document' ? 'sendMedia' :
                     type === 'audio' ? 'sendWhatsAppAudio' : 'sendMedia';

      const response = await this.fetchWithFallback([
        `/message/${endpoint}/${this.getEncodedInstanceName()}`,
        `/api/message/${endpoint}/${this.getEncodedInstanceName()}`,
        `/api/v1/message/${endpoint}/${this.getEncodedInstanceName()}`
      ], {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          number: to,
          mediatype: type,
          media: mediaUrl,
          caption: caption || '',
          delay: 1000
        })
      });

      return await response.json();
    } catch (error) {
      console.error('Erro ao enviar mídia:', error);
      throw error;
    }
  }

  // Buscar contatos
  async getContacts(): Promise<WhatsAppContact[]> {
    try {
      const response = await this.fetchWithFallback([
        `/chat/findContacts/${this.getEncodedInstanceName()}`,
        `/api/chat/findContacts/${this.getEncodedInstanceName()}`,
        `/api/v1/chat/findContacts/${this.getEncodedInstanceName()}`
      ], {
        method: 'GET',
        headers: this.getHeaders(),
      });

      const data = await response.json();
      return data.map((contact: any) => ({
        number: contact.id,
        name: contact.pushName || contact.name,
        profilePic: contact.profilePicUrl,
        isGroup: contact.id.includes('@g.us')
      }));
    } catch (error) {
      console.error('Erro ao buscar contatos:', error);
      throw error;
    }
  }

  // Buscar mensagens de uma conversa
  async getMessages(contactNumber: string, limit: number = 50): Promise<WhatsAppMessage[]> {
    try {
      const response = await this.fetchWithFallback([
        `/chat/findMessages/${this.getEncodedInstanceName()}`,
        `/api/chat/findMessages/${this.getEncodedInstanceName()}`,
        `/api/v1/chat/findMessages/${this.getEncodedInstanceName()}`
      ], {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          where: {
            owner: contactNumber
          },
          limit: limit
        })
      });

      const data = await response.json();
      return data.map((msg: any) => ({
        id: msg.key.id,
        from: msg.key.fromMe ? 'me' : msg.key.remoteJid,
        to: msg.key.fromMe ? msg.key.remoteJid : 'me',
        message: msg.message?.conversation || msg.message?.extendedTextMessage?.text || '',
        type: this.getMessageType(msg.message),
        timestamp: msg.messageTimestamp,
        status: msg.status
      }));
    } catch (error) {
      console.error('Erro ao buscar mensagens:', error);
      throw error;
    }
  }

  // Determinar tipo da mensagem
  private getMessageType(message: any): 'text' | 'image' | 'document' | 'audio' | 'video' {
    if (message?.imageMessage) return 'image';
    if (message?.documentMessage) return 'document';
    if (message?.audioMessage) return 'audio';
    if (message?.videoMessage) return 'video';
    return 'text';
  }

  // Deletar instância
  async deleteInstance(): Promise<any> {
    try {
      const response = await this.fetchWithFallback([
        `/instance/delete/${this.getEncodedInstanceName()}`,
        `/api/instance/delete/${this.getEncodedInstanceName()}`,
        `/api/v1/instance/delete/${this.getEncodedInstanceName()}`
      ], {
        method: 'DELETE',
        headers: this.getHeaders(),
      });

      return await response.json();
    } catch (error) {
      console.error('Erro ao deletar instância:', error);
      throw error;
    }
  }

  // Fazer logout da instância
  async logoutInstance(): Promise<any> {
    try {
      const response = await this.fetchWithFallback([
        `/instance/logout/${this.getEncodedInstanceName()}`,
        `/api/instance/logout/${this.getEncodedInstanceName()}`,
        `/api/v1/instance/logout/${this.getEncodedInstanceName()}`
      ], {
        method: 'POST',
        headers: this.getHeaders(),
      });

      return await response.json();
    } catch (error) {
      console.error('Erro ao fazer logout:', error);
      throw error;
    }
  }
  // Configurar webhook para a instância atual
  async setWebhookForInstance(
    url: string,
    options?: { webhook_by_events?: boolean; webhook_base64?: boolean; events?: string[]; enabled?: boolean }
  ): Promise<any> {
    const payload = {
      url,
      webhook_by_events: options?.webhook_by_events ?? false,
      webhook_base64: options?.webhook_base64 ?? true,
      events: options?.events ?? ['QRCODE_UPDATED','CONNECTION_UPDATE','MESSAGES_UPSERT','SEND_MESSAGE'],
      enabled: options?.enabled ?? true,
    }
    try {
      // Primeiro tenta variantes com instanceName no path
      const response = await this.fetchWithFallback([
        `/webhook/set/${this.getEncodedInstanceName()}`,
        `/api/webhook/set/${this.getEncodedInstanceName()}`,
        `/api/v1/webhook/set/${this.getEncodedInstanceName()}`,
      ], {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(payload),
      })

      return await response.json()
    } catch (error) {
      console.warn('Fallback webhook:set sem instanceName no path, tentando enviar no body…', error)
      // Algumas versões da Evolution esperam instanceName no body e não no path
      const bodyPayload = {
        instanceName: this.config.instanceName,
        ...payload,
      }
      const response2 = await this.fetchWithFallback([
        `/webhook/set`,
        `/api/webhook/set`,
        `/api/v1/webhook/set`,
      ], {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(bodyPayload),
      })
      return await response2.json()
    }
  }
}

export const evolutionApi = new EvolutionApiService({
  baseUrl: import.meta.env.VITE_EVOLUTION_API_URL || 'http://localhost:8080',
  apiKey: import.meta.env.VITE_EVOLUTION_API_KEY || 'your-api-key',
  instanceName: import.meta.env.VITE_EVOLUTION_INSTANCE_NAME || 'default-instance'
});