import { useState, useEffect, useCallback } from 'react';
import { webhookService, ProcessedMessage, WebhookEvent } from '@/services/webhookService';

export interface UseWebhookReturn {
  messages: ProcessedMessage[];
  connectionStatus: string;
  qrCode?: string;
  isConnected: boolean;
  addMessage: (message: ProcessedMessage) => void;
  clearMessages: () => void;
  simulateMessage: (text: string, from: string) => void;
  simulateConnection: (status: string, qr?: string) => void;
}

export const useWebhook = (): UseWebhookReturn => {
  const [messages, setMessages] = useState<ProcessedMessage[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<string>('disconnected');
  const [qrCode, setQrCode] = useState<string | undefined>();

  // Handler para novas mensagens
  const handleNewMessage = useCallback((message: ProcessedMessage) => {
    setMessages(prev => {
      // Evitar duplicatas
      const exists = prev.some(msg => msg.id === message.id);
      if (exists) return prev;
      
      // Adicionar nova mensagem e manter apenas as últimas 100
      const updated = [...prev, message].slice(-100);
      return updated.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    });
  }, []);

  // Handler para mudanças de conexão
  const handleConnectionChange = useCallback((status: string, qr?: string) => {
    setConnectionStatus(status);
    
    if (qr) {
      setQrCode(qr);
    } else if (status === 'open') {
      setQrCode(undefined);
    }
  }, []);

  // Configurar listeners do webhook
  useEffect(() => {
    const unsubscribeMessage = webhookService.onMessage(handleNewMessage);
    const unsubscribeConnection = webhookService.onConnection(handleConnectionChange);

    return () => {
      unsubscribeMessage();
      unsubscribeConnection();
    };
  }, [handleNewMessage, handleConnectionChange]);

  // Adicionar mensagem manualmente
  const addMessage = useCallback((message: ProcessedMessage) => {
    handleNewMessage(message);
  }, [handleNewMessage]);

  // Limpar mensagens
  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  // Simular recebimento de mensagem (para desenvolvimento)
  const simulateMessage = useCallback((text: string, from: string) => {
    const simulatedMessage: ProcessedMessage = {
      id: `sim_${Date.now()}_${Math.random()}`,
      from,
      fromName: from.includes('@') ? from.split('@')[0] : from,
      text,
      type: 'text',
      timestamp: new Date(),
      isFromMe: false
    };

    const webhookEvent: WebhookEvent = {
      event: 'messages.upsert',
      instance: 'default-instance',
      data: {
        messages: [{
          key: {
            remoteJid: from,
            fromMe: false,
            id: simulatedMessage.id
          },
          message: {
            conversation: text
          },
          messageTimestamp: Math.floor(simulatedMessage.timestamp.getTime() / 1000),
          pushName: simulatedMessage.fromName
        }]
      }
    };

    webhookService.simulateWebhook(webhookEvent);
  }, []);

  // Simular mudança de conexão (para desenvolvimento)
  const simulateConnection = useCallback((status: string, qr?: string) => {
    let webhookEvent: WebhookEvent;

    if (qr) {
      webhookEvent = {
        event: 'qr.updated',
        instance: 'default-instance',
        data: { qr }
      };
    } else {
      webhookEvent = {
        event: 'connection.update',
        instance: 'default-instance',
        data: {
          connection: {
            state: status as any
          }
        }
      };
    }

    webhookService.simulateWebhook(webhookEvent);
  }, []);

  const isConnected = connectionStatus === 'open' || connectionStatus === 'connected';

  return {
    messages,
    connectionStatus,
    qrCode,
    isConnected,
    addMessage,
    clearMessages,
    simulateMessage,
    simulateConnection
  };
};

export default useWebhook;