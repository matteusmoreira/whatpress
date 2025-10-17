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

  // Configurar headers padrão para requisições
  private getHeaders() {
    return {
      'Content-Type': 'application/json',
      'apikey': this.config.apiKey,
    };
  }

  // Criar instância do WhatsApp
  async createInstance(): Promise<any> {
    try {
      const defaultWebhook = (typeof window !== 'undefined' && window.location.hostname === 'localhost')
        ? 'http://localhost:3001/api/webhook'
        : `${window.location.origin}/api/webhook`;
      const webhookUrl = import.meta.env.VITE_WEBHOOK_URL || defaultWebhook;

      const response = await fetch(`${this.getBaseUrl()}/instance/create`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          instanceName: this.config.instanceName,
          integration: 'WHATSAPP-BAILEYS',
          qrcode: true,
          markMessagesRead: true,
          delayMessage: 1000,
          presenceUpdate: true,
          webhook: {
            url: webhookUrl,
            byEvents: true,
            base64: false,
            headers: {
              'Content-Type': 'application/json'
            },
            events: [
              'messages.upsert',
              'connection.update',
              'qr.updated',
              'instance.status'
            ]
          }
        })
      });

      if (!response.ok) {
        throw new Error(`Erro ao criar instância: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Erro ao criar instância:', error);
      throw error;
    }
  }

  // Conectar instância (gerar QR Code)
  async connectInstance(): Promise<any> {
    try {
      const response = await fetch(`${this.getBaseUrl()}/instance/connect/${this.config.instanceName}`, {
        method: 'GET',
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        throw new Error(`Erro ao conectar instância: ${response.statusText}`);
      }

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
      const response = await fetch(`${this.getBaseUrl()}/instance/connectionState/${this.config.instanceName}`, {
        method: 'GET',
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        throw new Error(`Erro ao verificar status: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Erro ao verificar status:', error);
      throw error;
    }
  }

  // Enviar mensagem de texto
  async sendTextMessage(to: string, message: string): Promise<any> {
    try {
      const response = await fetch(`${this.getBaseUrl()}/message/sendText/${this.config.instanceName}`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          number: to,
          text: message,
          delay: 1000
        })
      });

      if (!response.ok) {
        throw new Error(`Erro ao enviar mensagem: ${response.statusText}`);
      }

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

      const response = await fetch(`${this.getBaseUrl()}/message/${endpoint}/${this.config.instanceName}`, {
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

      if (!response.ok) {
        throw new Error(`Erro ao enviar mídia: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Erro ao enviar mídia:', error);
      throw error;
    }
  }

  // Buscar contatos
  async getContacts(): Promise<WhatsAppContact[]> {
    try {
      const response = await fetch(`${this.getBaseUrl()}/chat/findContacts/${this.config.instanceName}`, {
        method: 'GET',
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        throw new Error(`Erro ao buscar contatos: ${response.statusText}`);
      }

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
      const response = await fetch(`${this.getBaseUrl()}/chat/findMessages/${this.config.instanceName}`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          where: {
            owner: contactNumber
          },
          limit: limit
        })
      });

      if (!response.ok) {
        throw new Error(`Erro ao buscar mensagens: ${response.statusText}`);
      }

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
      const response = await fetch(`${this.getBaseUrl()}/instance/delete/${this.config.instanceName}`, {
        method: 'DELETE',
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        throw new Error(`Erro ao deletar instância: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Erro ao deletar instância:', error);
      throw error;
    }
  }

  // Fazer logout da instância
  async logoutInstance(): Promise<any> {
    try {
      const response = await fetch(`${this.getBaseUrl()}/instance/logout/${this.config.instanceName}`, {
        method: 'POST',
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        throw new Error(`Erro ao fazer logout: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Erro ao fazer logout:', error);
      throw error;
    }
  }
}

export const evolutionApi = new EvolutionApiService({
  baseUrl: import.meta.env.VITE_EVOLUTION_API_URL || 'http://localhost:8080',
  apiKey: import.meta.env.VITE_EVOLUTION_API_KEY || 'your-api-key',
  instanceName: import.meta.env.VITE_EVOLUTION_INSTANCE_NAME || 'default-instance'
});