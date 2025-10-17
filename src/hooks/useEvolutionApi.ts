import { useState, useEffect, useCallback } from 'react';
import { whatsappInstanceService, WhatsAppInstance } from '@/services/whatsappInstanceService';
import { evolutionApi, WhatsAppMessage, WhatsAppContact } from '@/services/evolutionApi';
import { useToast } from '@/hooks/use-toast';

export interface ConnectionStatus {
  isConnected: boolean;
  qrCode?: string;
  status: 'disconnected' | 'connecting' | 'connected' | 'error';
  error?: string;
}

export function useEvolutionApi() {
  const [instances, setInstances] = useState<WhatsAppInstance[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>({
    isConnected: false,
    status: 'disconnected'
  });
  const [contacts, setContacts] = useState<WhatsAppContact[]>([]);
  const [messages, setMessages] = useState<WhatsAppMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  // Carregar instâncias do usuário
  const loadInstances = useCallback(async () => {
    try {
      setLoading(true);
      const userInstances = await whatsappInstanceService.getUserInstances();
      setInstances(userInstances);
      
      // Se há instâncias, verificar status da primeira
      if (userInstances.length > 0) {
        const firstInstance = userInstances[0];
        setConnectionStatus({
          isConnected: firstInstance.status === 'connected',
          status: firstInstance.status,
          qrCode: firstInstance.qr_code || undefined
        });
      }
    } catch (error: any) {
      console.error('Erro ao carregar instâncias:', error);
      toast({
        title: "Erro ao carregar instâncias",
        description: error.message || "Erro desconhecido",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  // Criar nova instância
  const createInstance = useCallback(async (name: string) => {
    try {
      setLoading(true);
      const newInstance = await whatsappInstanceService.createInstance({ name });
      
      // Recarregar lista de instâncias
      await loadInstances();
      
      toast({
        title: "Instância criada com sucesso!",
        description: `A instância "${name}" foi criada.`,
      });
      
      return newInstance;
    } catch (error: any) {
      console.error('Erro ao criar instância:', error);
      toast({
        title: "Erro ao criar instância",
        description: error.message || "Erro desconhecido",
        variant: "destructive"
      });
      throw error;
    } finally {
      setLoading(false);
    }
  }, [loadInstances, toast]);

  // Conectar instância
  const connect = useCallback(async (instanceId?: string) => {
    try {
      setLoading(true);
      
      // Se não especificou ID, usar a primeira instância
      const targetInstanceId = instanceId || instances[0]?.id;
      if (!targetInstanceId) {
        throw new Error('Nenhuma instância disponível');
      }

      const result = await whatsappInstanceService.connectInstance(targetInstanceId);
      
      setConnectionStatus({
        isConnected: result.status === 'connected',
        status: result.status as any,
        qrCode: result.qrCode
      });

      // Recarregar instâncias para atualizar status
      await loadInstances();

      if (result.qrCode) {
        toast({
          title: "QR Code gerado",
          description: "Escaneie o QR Code com seu WhatsApp para conectar.",
        });
      } else if (result.status === 'connected') {
        toast({
          title: "Conectado com sucesso!",
          description: "Sua instância WhatsApp está conectada.",
        });
      }
    } catch (error: any) {
      console.error('Erro ao conectar:', error);
      try {
        // Mesmo em caso de erro inicial, validar o status real da instância
        const targetInstanceId = instanceId || instances[0]?.id;
        if (targetInstanceId) {
          const status = await whatsappInstanceService.checkInstanceStatus(targetInstanceId);
          setConnectionStatus({
            isConnected: status === 'connected',
            status: status as any,
            error: status === 'error' ? error.message : undefined
          });

          if (status === 'connected') {
            toast({
              title: "Conectado com sucesso!",
              description: "Sua instância WhatsApp está conectada.",
            });
          } else if (status === 'connecting') {
            toast({
              title: "Conexão em andamento",
              description: "Aguardando confirmação do WhatsApp. Assim que conectar, o status será atualizado.",
            });
          } else {
            toast({
              title: "Erro ao conectar",
              description: error.message || "Erro desconhecido",
              variant: "destructive"
            });
          }
        } else {
          setConnectionStatus({
            isConnected: false,
            status: 'error',
            error: error.message
          });
          toast({
            title: "Erro ao conectar",
            description: error.message || "Erro desconhecido",
            variant: "destructive"
          });
        }
      } catch (statusError: any) {
        setConnectionStatus({
          isConnected: false,
          status: 'error',
          error: error.message
        });
        toast({
          title: "Erro ao conectar",
          description: error.message || "Erro desconhecido",
          variant: "destructive"
        });
      }
    } finally {
      setLoading(false);
    }
  }, [instances, loadInstances, toast]);

  // Desconectar instância
  const disconnect = useCallback(async (instanceId?: string) => {
    try {
      setLoading(true);
      
      const targetInstanceId = instanceId || instances[0]?.id;
      if (!targetInstanceId) {
        throw new Error('Nenhuma instância disponível');
      }

      await whatsappInstanceService.disconnectInstance(targetInstanceId);
      
      setConnectionStatus({
        isConnected: false,
        status: 'disconnected'
      });

      // Recarregar instâncias
      await loadInstances();

      toast({
        title: "Desconectado com sucesso",
        description: "Instância WhatsApp foi desconectada.",
      });
    } catch (error: any) {
      console.error('Erro ao desconectar:', error);
      toast({
        title: "Erro ao desconectar",
        description: error.message || "Erro desconhecido",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  }, [instances, loadInstances, toast]);

  // Verificar status de conexão
  const checkConnectionStatus = useCallback(async (instanceId?: string) => {
    try {
      setLoading(true);
      
      const targetInstanceId = instanceId || instances[0]?.id;
      if (!targetInstanceId) {
        return;
      }

      const status = await whatsappInstanceService.checkInstanceStatus(targetInstanceId);
      
      setConnectionStatus({
        isConnected: status === 'connected',
        status: status as any
      });

      // Recarregar instâncias
      await loadInstances();
    } catch (error: any) {
      console.error('Erro ao verificar status:', error);
      setConnectionStatus({
        isConnected: false,
        status: 'error',
        error: error.message
      });
    } finally {
      setLoading(false);
    }
  }, [instances, loadInstances]);

  // Deletar instância
  const deleteInstance = useCallback(async (instanceId: string) => {
    try {
      setLoading(true);
      await whatsappInstanceService.deleteInstance(instanceId);
      
      // Recarregar instâncias
      await loadInstances();
      
      toast({
        title: "Instância deletada",
        description: "A instância foi removida com sucesso.",
      });
    } catch (error: any) {
      console.error('Erro ao deletar instância:', error);
      toast({
        title: "Erro ao deletar instância",
        description: error.message || "Erro desconhecido",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  }, [loadInstances, toast]);

  // Buscar contatos (usando Evolution API diretamente)
  const fetchContacts = useCallback(async () => {
    try {
      setLoading(true);
      
      // Usar a instância conectada (ou a primeira disponível)
      const targetInstance = instances.find(i => i.status === 'connected') || instances[0];
      if (!targetInstance) {
        throw new Error('Nenhuma instância disponível para buscar contatos');
      }

      const service = new EvolutionApiService({
        baseUrl: import.meta.env.VITE_EVOLUTION_API_URL || 'http://localhost:8080',
        apiKey: import.meta.env.VITE_EVOLUTION_API_KEY || 'your-api-key',
        instanceName: targetInstance.api_key || targetInstance.name
      });

      const contactsList = await service.getContacts();
      setContacts(contactsList);
    } catch (error: any) {
      console.error('Erro ao buscar contatos:', error);
      toast({
        title: "Erro ao buscar contatos",
        description: error.message || "Erro desconhecido",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  }, [instances, toast]);

  // Buscar mensagens (usando Evolution API diretamente)
  const fetchMessages = useCallback(async (contactNumber: string) => {
    try {
      setLoading(true);
      
      // Usar a instância conectada (ou a primeira disponível)
      const targetInstance = instances.find(i => i.status === 'connected') || instances[0];
      if (!targetInstance) {
        throw new Error('Nenhuma instância disponível para buscar mensagens');
      }

      const service = new EvolutionApiService({
        baseUrl: import.meta.env.VITE_EVOLUTION_API_URL || 'http://localhost:8080',
        apiKey: import.meta.env.VITE_EVOLUTION_API_KEY || 'your-api-key',
        instanceName: targetInstance.api_key || targetInstance.name
      });

      const messagesList = await service.getMessages(contactNumber);
      setMessages(messagesList);
    } catch (error: any) {
      console.error('Erro ao buscar mensagens:', error);
      toast({
        title: "Erro ao buscar mensagens",
        description: error.message || "Erro desconhecido",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  }, [instances, toast]);

  // Enviar mensagem
  const sendMessage = useCallback(async (to: string, message: string) => {
    try {
      setLoading(true);
      
      const targetInstance = instances.find(i => i.status === 'connected') || instances[0];
      if (!targetInstance) {
        throw new Error('Nenhuma instância disponível para enviar mensagens');
      }

      const service = new EvolutionApiService({
        baseUrl: import.meta.env.VITE_EVOLUTION_API_URL || 'http://localhost:8080',
        apiKey: import.meta.env.VITE_EVOLUTION_API_KEY || 'your-api-key',
        instanceName: targetInstance.api_key || targetInstance.name
      });

      await service.sendTextMessage(to, message);
      
      toast({
        title: "Mensagem enviada",
        description: "Sua mensagem foi enviada com sucesso.",
      });
    } catch (error: any) {
      console.error('Erro ao enviar mensagem:', error);
      toast({
        title: "Erro ao enviar mensagem",
        description: error.message || "Erro desconhecido",
        variant: "destructive"
      });
      throw error;
    } finally {
      setLoading(false);
    }
  }, [instances, toast]);

  // Carregar instâncias ao montar o componente
  useEffect(() => {
    loadInstances();
  }, [loadInstances]);

  // Polling para atualizar status das instâncias (a cada 30 segundos)
  useEffect(() => {
    const interval = setInterval(() => {
      if (instances.length > 0 && !loading) {
        checkConnectionStatus();
      }
    }, 30000); // 30 segundos

    return () => clearInterval(interval);
  }, [instances, loading, checkConnectionStatus]);

  return {
    // Estados
    instances,
    connectionStatus,
    contacts,
    messages,
    loading,
    
    // Ações de instância
    createInstance,
    connect,
    disconnect,
    checkConnectionStatus,
    deleteInstance,
    loadInstances,
    
    // Ações de mensagens e contatos
    fetchContacts,
    fetchMessages,
    sendMessage
  };
}