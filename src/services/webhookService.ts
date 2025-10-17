// Serviço para gerenciar webhooks da Evolution API
export interface WebhookMessage {
  key: {
    remoteJid: string;
    fromMe: boolean;
    id: string;
  };
  message: {
    conversation?: string;
    extendedTextMessage?: {
      text: string;
    };
    imageMessage?: {
      caption?: string;
      url: string;
      mimetype: string;
    };
    audioMessage?: {
      url: string;
      mimetype: string;
    };
    documentMessage?: {
      caption?: string;
      url: string;
      mimetype: string;
      fileName: string;
    };
  };
  messageTimestamp: number;
  pushName?: string;
  status?: string;
}

export interface WebhookEvent {
  event: 'messages.upsert' | 'connection.update' | 'qr.updated' | 'instance.status';
  instance: string;
  data: {
    messages?: WebhookMessage[];
    qr?: string;
    connection?: {
      state: 'open' | 'close' | 'connecting';
      lastDisconnect?: {
        error?: any;
        date?: Date;
      };
    };
    status?: 'open' | 'close' | 'connecting';
  };
}

export interface ProcessedMessage {
  id: string;
  from: string;
  fromName?: string;
  text: string;
  type: 'text' | 'image' | 'audio' | 'document';
  timestamp: Date;
  isFromMe: boolean;
  mediaUrl?: string;
  fileName?: string;
  caption?: string;
}

class WebhookService {
  private messageHandlers: ((message: ProcessedMessage) => void)[] = [];
  private connectionHandlers: ((status: string, qr?: string) => void)[] = [];

  // Processar evento do webhook
  processWebhookEvent(event: WebhookEvent): void {
    console.log('Processando evento webhook:', event);

    switch (event.event) {
      case 'messages.upsert':
        this.handleMessages(event.data.messages || []);
        break;
      
      case 'connection.update':
        this.handleConnectionUpdate(event.data.connection);
        break;
      
      case 'qr.updated':
        this.handleQRUpdate(event.data.qr);
        break;
      
      case 'instance.status':
        this.handleInstanceStatus(event.data.status);
        break;
    }
  }

  // Processar mensagens recebidas
  private handleMessages(messages: WebhookMessage[]): void {
    messages.forEach(msg => {
      const processedMessage = this.processMessage(msg);
      if (processedMessage) {
        this.notifyMessageHandlers(processedMessage);
      }
    });
  }

  // Processar uma mensagem individual
  private processMessage(msg: WebhookMessage): ProcessedMessage | null {
    try {
      const messageContent = msg.message;
      let text = '';
      let type: ProcessedMessage['type'] = 'text';
      let mediaUrl: string | undefined;
      let fileName: string | undefined;
      let caption: string | undefined;

      // Extrair conteúdo baseado no tipo de mensagem
      if (messageContent.conversation) {
        text = messageContent.conversation;
        type = 'text';
      } else if (messageContent.extendedTextMessage) {
        text = messageContent.extendedTextMessage.text;
        type = 'text';
      } else if (messageContent.imageMessage) {
        text = messageContent.imageMessage.caption || '';
        caption = messageContent.imageMessage.caption;
        mediaUrl = messageContent.imageMessage.url;
        type = 'image';
      } else if (messageContent.audioMessage) {
        text = '[Áudio]';
        mediaUrl = messageContent.audioMessage.url;
        type = 'audio';
      } else if (messageContent.documentMessage) {
        text = messageContent.documentMessage.caption || messageContent.documentMessage.fileName;
        caption = messageContent.documentMessage.caption;
        mediaUrl = messageContent.documentMessage.url;
        fileName = messageContent.documentMessage.fileName;
        type = 'document';
      } else {
        // Tipo de mensagem não suportado
        return null;
      }

      return {
        id: msg.key.id,
        from: msg.key.remoteJid,
        fromName: msg.pushName,
        text,
        type,
        timestamp: new Date(msg.messageTimestamp * 1000),
        isFromMe: msg.key.fromMe,
        mediaUrl,
        fileName,
        caption
      };
    } catch (error) {
      console.error('Erro ao processar mensagem:', error);
      return null;
    }
  }

  // Lidar com atualizações de conexão
  private handleConnectionUpdate(connection: any): void {
    if (connection?.state) {
      this.notifyConnectionHandlers(connection.state);
    }
  }

  // Lidar com atualizações de QR Code
  private handleQRUpdate(qr?: string): void {
    if (qr) {
      this.notifyConnectionHandlers('qr', qr);
    }
  }

  // Lidar com status da instância
  private handleInstanceStatus(status?: string): void {
    if (status) {
      this.notifyConnectionHandlers(status);
    }
  }

  // Notificar handlers de mensagem
  private notifyMessageHandlers(message: ProcessedMessage): void {
    this.messageHandlers.forEach(handler => {
      try {
        handler(message);
      } catch (error) {
        console.error('Erro ao executar handler de mensagem:', error);
      }
    });
  }

  // Notificar handlers de conexão
  private notifyConnectionHandlers(status: string, qr?: string): void {
    this.connectionHandlers.forEach(handler => {
      try {
        handler(status, qr);
      } catch (error) {
        console.error('Erro ao executar handler de conexão:', error);
      }
    });
  }

  // Registrar handler para mensagens
  onMessage(handler: (message: ProcessedMessage) => void): () => void {
    this.messageHandlers.push(handler);
    
    // Retornar função para remover o handler
    return () => {
      const index = this.messageHandlers.indexOf(handler);
      if (index > -1) {
        this.messageHandlers.splice(index, 1);
      }
    };
  }

  // Registrar handler para conexão
  onConnection(handler: (status: string, qr?: string) => void): () => void {
    this.connectionHandlers.push(handler);
    
    // Retornar função para remover o handler
    return () => {
      const index = this.connectionHandlers.indexOf(handler);
      if (index > -1) {
        this.connectionHandlers.splice(index, 1);
      }
    };
  }

  // Simular recebimento de webhook (para desenvolvimento)
  simulateWebhook(event: WebhookEvent): void {
    console.log('Simulando webhook:', event);
    this.processWebhookEvent(event);
  }

  // Validar estrutura do webhook
  validateWebhookEvent(data: any): data is WebhookEvent {
    return (
      data &&
      typeof data.event === 'string' &&
      typeof data.instance === 'string' &&
      data.data &&
      typeof data.data === 'object'
    );
  }
}

// Instância singleton do serviço
export const webhookService = new WebhookService();

// Função para configurar webhook endpoint (simulação)
export const setupWebhookEndpoint = (port: number = 3001) => {
  console.log(`Webhook endpoint configurado na porta ${port}`);
  console.log(`URL do webhook: http://localhost:${port}/webhook`);
  
  // Em um ambiente real, você configuraria um servidor Express aqui
  // Exemplo:
  /*
  const express = require('express');
  const app = express();
  
  app.use(express.json());
  
  app.post('/webhook', (req, res) => {
    const event = req.body;
    
    if (webhookService.validateWebhookEvent(event)) {
      webhookService.processWebhookEvent(event);
      res.status(200).json({ success: true });
    } else {
      res.status(400).json({ error: 'Invalid webhook event' });
    }
  });
  
  app.listen(port, () => {
    console.log(`Webhook server running on port ${port}`);
  });
  */
};

export default WebhookService;