import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useTenant } from './useTenant';
import { useToast } from '@/hooks/use-toast';
import { useQuotas } from './useQuotas';
import { toast } from 'sonner';
import { useRateLimit } from './useRateLimit';
import { useMultiSession } from './useMultiSession';
import { EvolutionApiService } from '@/services/evolutionApi';

export interface Campaign {
  id: string;
  tenant_id: string;
  name: string;
  description?: string;
  status: 'draft' | 'scheduled' | 'running' | 'paused' | 'completed' | 'cancelled';
  campaign_type: 'simple' | 'intelligent' | 'drip' | 'broadcast';
  multi_session_enabled: boolean;
  multi_session_config?: {
    enabled: boolean;
    load_balancing_strategy: string;
    max_retries: number;
    auto_failover: boolean;
  };
  randomization_enabled: boolean;
  randomization_config?: any;
  rate_limit_per_minute: number;
  rate_limit_config?: any;
  retry_attempts: number;
  retry_delay_minutes: number;
  failover_enabled: boolean;
  priority_level: number;
  execution_strategy: 'sequential' | 'parallel' | 'balanced';
  scheduled_at?: string;
  started_at?: string;
  completed_at?: string;
  created_at: string;
  updated_at: string;
}

export interface CampaignMetrics {
  id: string;
  campaign_id: string;
  total_messages: number;
  messages_sent: number;
  messages_failed: number;
  messages_pending: number;
  success_rate: number;
  active_instances: number;
  avg_response_time: number;
  last_message_at?: string;
  updated_at: string;
}

export interface MessageQueueItem {
  id: string;
  campaign_id: string;
  whatsapp_instance_id: string;
  contact_id: string;
  message_content: any;
  status: 'pending' | 'processing' | 'sent' | 'failed' | 'cancelled';
  priority: number;
  scheduled_at: string;
  sent_at?: string;
  error_message?: string;
  retry_count: number;
  randomization_applied: any;
}

interface UseCampaignEngineReturn {
  campaigns: Campaign[];
  metrics: Record<string, CampaignMetrics>;
  messageQueue: MessageQueueItem[];
  isLoading: boolean;
  error: string | null;
  
  // Campaign Management
  createCampaign: (campaignData: Partial<Campaign>) => Promise<Campaign | null>;
  updateCampaign: (id: string, updates: Partial<Campaign>) => Promise<boolean>;
  deleteCampaign: (id: string) => Promise<boolean>;
  
  // Campaign Execution
  startCampaign: (id: string) => Promise<boolean>;
  pauseCampaign: (id: string) => Promise<boolean>;
  resumeCampaign: (id: string) => Promise<boolean>;
  stopCampaign: (id: string) => Promise<boolean>;
  
  // Queue Management
  addToQueue: (campaignId: string, messages: Partial<MessageQueueItem>[]) => Promise<boolean>;
  processQueue: (campaignId: string) => Promise<boolean>;
  retryFailedMessages: (campaignId: string) => Promise<boolean>;
  
  // Message Sending
  sendMessage: (instanceId: string, contactId: string, message: string, campaignId?: string) => Promise<boolean>;
  
  // Real-time Updates
  subscribeToMetrics: (campaignId: string) => () => void;
  refreshData: () => Promise<void>;
}

export const useCampaignEngine = (): UseCampaignEngineReturn => {
  const { currentTenant } = useTenant();
  const { toast: toastHook } = useToast();
  const { canPerformAction, updateQuotaUsage, getUpgradeMessage } = useQuotas();
  const { instances, selectBestInstance } = useMultiSession();
  const { canSendMessage, recordMessageSent, getNextAllowedTime } = useRateLimit();
  
  // Avoid auto side-effects when running under Vitest to prevent act() timeouts
  const isTestEnv = typeof import.meta !== 'undefined' && Boolean((import.meta as any)?.vitest || ((import.meta as any)?.env?.MODE === 'test'));
  
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [metrics, setMetrics] = useState<Record<string, CampaignMetrics>>({});
  const [messageQueue, setMessageQueue] = useState<MessageQueueItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validateEvolutionEnv = useCallback((): boolean => {
    const url = import.meta.env.VITE_EVOLUTION_API_URL;
    const key = import.meta.env.VITE_EVOLUTION_API_KEY;
    if (!url || !key) {
      toast.error('Configuração da Evolution API ausente. Defina VITE_EVOLUTION_API_URL e VITE_EVOLUTION_API_KEY no .env');
      return false;
    }
    return true;
  }, []);
  // Fetch campaigns
  const fetchCampaigns = useCallback(async () => {
    if (!currentTenant?.id) return;

    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('campaigns')
        .select('*')
        .eq('tenant_id', currentTenant.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCampaigns(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar campanhas');
      toastHook({
        title: "Erro",
        description: "Falha ao carregar campanhas",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  }, [currentTenant?.id, toastHook]);

  // Fetch metrics
  const fetchMetrics = useCallback(async () => {
    if (!currentTenant?.id) return;

    try {
      const { data, error } = await supabase
        .from('campaign_metrics')
        .select('*')
        .eq('tenant_id', currentTenant.id);

      if (error) throw error;
      
      const metricsMap = (data || []).reduce((acc, metric) => {
        acc[metric.campaign_id] = metric;
        return acc;
      }, {} as Record<string, CampaignMetrics>);
      
      setMetrics(metricsMap);
    } catch (err) {
      console.error('Erro ao carregar métricas:', err);
    }
  }, [currentTenant?.id]);

  // Fetch message queue
  const fetchMessageQueue = useCallback(async () => {
    if (!currentTenant?.id) return;

    try {
      const { data, error } = await supabase
        .from('message_queue')
        .select('*')
        .eq('tenant_id', currentTenant.id)
        .order('priority', { ascending: false })
        .order('scheduled_at', { ascending: true })
        .limit(100);

      if (error) throw error;
      setMessageQueue(data || []);
    } catch (err) {
      console.error('Erro ao carregar fila de mensagens:', err);
    }
  }, [currentTenant?.id]);

  // Verificar quotas antes de iniciar campanha
  const checkQuotasBeforeStart = useCallback(async (campaign: Campaign): Promise<boolean> => {
    // Verificar quota de campanhas ativas
    if (!canPerformAction('campaigns')) {
      toast.error(getUpgradeMessage('campaigns'));
      return false;
    }

    // Verificar quota de mensagens mensais
    if (!canPerformAction('messages')) {
      toast.error(getUpgradeMessage('messages'));
      return false;
    }

    // Verificar quota de conexões WhatsApp se multi-sessão habilitada
    if (campaign.multi_session_config?.enabled && !canPerformAction('connections')) {
      toast.error(getUpgradeMessage('connections'));
      return false;
    }

    return true;
  }, [canPerformAction, getUpgradeMessage]);

  // Create campaign
  const createCampaign = useCallback(async (campaignData: Partial<Campaign>): Promise<Campaign | null> => {
    if (!currentTenant?.id) return null;

    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('campaigns')
        .insert({
          ...campaignData,
          tenant_id: currentTenant.id,
          status: 'draft'
        })
        .select()
        .single();

      if (error) throw error;

      setCampaigns(prev => [data, ...prev]);
      toastHook({
        title: "Sucesso",
        description: "Campanha criada com sucesso"
      });

      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar campanha');
      toastHook({
        title: "Erro",
        description: "Falha ao criar campanha",
        variant: "destructive"
      });
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [currentTenant?.id, toastHook]);

  // Update campaign
  const updateCampaign = useCallback(async (id: string, updates: Partial<Campaign>): Promise<boolean> => {
    try {
      setIsLoading(true);
      const { error } = await supabase
        .from('campaigns')
        .update(updates)
        .eq('id', id)
        .eq('tenant_id', currentTenant?.id);

      if (error) throw error;

      setCampaigns(prev => prev.map(campaign => 
        campaign.id === id ? { ...campaign, ...updates } : campaign
      ));

      toastHook({
        title: "Sucesso",
        description: "Campanha atualizada com sucesso"
      });

      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao atualizar campanha');
      toastHook({
        title: "Erro",
        description: "Falha ao atualizar campanha",
        variant: "destructive"
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [currentTenant?.id, toastHook]);

  // Delete campaign
  const deleteCampaign = useCallback(async (id: string): Promise<boolean> => {
    try {
      setIsLoading(true);
      const { error } = await supabase
        .from('campaigns')
        .delete()
        .eq('id', id)
        .eq('tenant_id', currentTenant?.id);

      if (error) throw error;

      setCampaigns(prev => prev.filter(campaign => campaign.id !== id));
      toastHook({
        title: "Sucesso",
        description: "Campanha excluída com sucesso"
      });

      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao excluir campanha');
      toastHook({
        title: "Erro",
        description: "Falha ao excluir campanha",
        variant: "destructive"
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [currentTenant?.id, toastHook]);









  // Process queue (simplified - real processing would be done by backend)
  const processQueue = useCallback(async (campaignId: string): Promise<boolean> => {
    if (!currentTenant?.id) return false;

    try {
      // Buscar mensagens pendentes e já agendadas para o horário atual
      const { data: pendingItems, error: fetchError } = await supabase
        .from('message_queue')
        .select('*')
        .eq('tenant_id', currentTenant.id)
        .eq('campaign_id', campaignId)
        .eq('status', 'pending')
        .lte('scheduled_at', new Date().toISOString())
        .order('priority', { ascending: false })
        .order('scheduled_at', { ascending: true })
        .limit(20);

      if (fetchError) throw fetchError;
      if (!pendingItems || pendingItems.length === 0) {
        return true;
      }

      for (const item of pendingItems) {
        try {
          // Marcar como processing
          await supabase
            .from('message_queue')
            .update({ status: 'processing' })
            .eq('id', item.id);

          // Selecionar instância
          let chosenInstance = instances.find(i => i.id === item.whatsapp_instance_id) || null;
          if (!chosenInstance || chosenInstance.status !== 'connected' || chosenInstance.health_status !== 'healthy') {
            const alternative = selectBestInstance(chosenInstance ? [chosenInstance.id] : []);
            if (!alternative) {
              await supabase
                .from('message_queue')
                .update({ status: 'failed', error_message: 'Nenhuma instância disponível', retry_count: (item.retry_count ?? 0) + 1 })
                .eq('id', item.id);
              continue;
            }
            chosenInstance = alternative;
            await supabase
              .from('message_queue')
              .update({ whatsapp_instance_id: chosenInstance.id })
              .eq('id', item.id);
          }

          // Validar configuração Evolution API
          if (!validateEvolutionEnv()) {
            await supabase
              .from('message_queue')
              .update({ status: 'failed', error_message: 'Configuração Evolution API ausente' })
              .eq('id', item.id);
            continue;
          }

          // Verificar quota de mensagens antes de prosseguir
          if (!canPerformAction('messages')) {
            await supabase
              .from('message_queue')
              .update({ status: 'failed', error_message: getUpgradeMessage('messages') })
              .eq('id', item.id);
            toast.error(getUpgradeMessage('messages'));
            continue;
          }

           // Validar rate limit (global, campanha, instância)
           const blockedScopes: Array<'global' | 'campaign' | 'instance'> = [];
           if (!canSendMessage('global')) blockedScopes.push('global');
           if (!canSendMessage('campaign', item.campaign_id)) blockedScopes.push('campaign');
           if (!canSendMessage('instance', chosenInstance.id)) blockedScopes.push('instance');

           if (blockedScopes.length > 0) {
             const nextTimes = blockedScopes
               .map(scope => getNextAllowedTime(scope, scope === 'campaign' ? item.campaign_id : scope === 'instance' ? chosenInstance!.id : undefined))
               .filter(Boolean) as Date[];
             const nextAllowed = nextTimes.length > 0
               ? new Date(Math.min(...nextTimes.map(d => d.getTime())))
               : new Date(Date.now() + 60000);

             await supabase
               .from('message_queue')
               .update({ status: 'pending', scheduled_at: nextAllowed.toISOString() })
               .eq('id', item.id);

             continue;
           }

           // Enviar via Evolution API
           const evolution = new EvolutionApiService({
             baseUrl: import.meta.env.VITE_EVOLUTION_API_URL || 'http://localhost:8080',
             apiKey: import.meta.env.VITE_EVOLUTION_API_KEY || 'your-api-key',
             instanceName: chosenInstance.name,
           });

          const textPayload = typeof item.message_content === 'string'
            ? item.message_content
            : (item.message_content?.text ?? JSON.stringify(item.message_content));

          // Resolve recipient phone number from contacts if contact_id is a UUID
          let recipientNumber = item.contact_id;
          try {
            const { data: contactRow } = await supabase
              .from('contacts')
              .select('phone_number')
              .eq('id', item.contact_id)
              .limit(1)
              .single();
            if (contactRow?.phone_number) {
              recipientNumber = contactRow.phone_number;
            }
          } catch (lookupErr) {
            console.warn('Falha ao resolver número do contato, usando contact_id como fallback:', lookupErr);
          }

          await evolution.sendTextMessage(recipientNumber, textPayload);

          // Atualizações pós-envio
          await supabase
            .from('message_queue')
            .update({ status: 'sent', sent_at: new Date().toISOString() })
            .eq('id', item.id);

          recordMessageSent('global', undefined, true);
          recordMessageSent('campaign', item.campaign_id, true);
          recordMessageSent('instance', chosenInstance.id, true);

          // Atualizar métricas simples (incrementar sent)
          const { data: metricRow } = await supabase
            .from('campaign_metrics')
            .select('id, messages_sent')
            .eq('campaign_id', item.campaign_id)
            .limit(1)
            .single();
          if (metricRow?.id) {
            await supabase
              .from('campaign_metrics')
              .update({
                messages_sent: (metricRow.messages_sent ?? 0) + 1,
                last_message_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              })
              .eq('id', metricRow.id);
          }

          await updateQuotaUsage('messages', 1);
        } catch (err: any) {
          console.error('Erro ao enviar item da fila:', err);
          const retryCount = (item.retry_count ?? 0) + 1;
          const campaign = campaigns.find(c => c.id === item.campaign_id);
          const shouldRetry = (campaign?.retry_attempts ?? 0) >= retryCount;
          const nextSchedule = new Date(Date.now() + ((campaign?.retry_delay_minutes ?? 5) * 60000)).toISOString();

          await supabase
            .from('message_queue')
            .update({
              status: shouldRetry ? 'pending' : 'failed',
              retry_count: retryCount,
              error_message: err?.message || 'Falha ao enviar',
              scheduled_at: shouldRetry ? nextSchedule : item.scheduled_at
            })
            .eq('id', item.id);

          // Atualizar métricas de falha
          const { data: metricRowFail } = await supabase
            .from('campaign_metrics')
            .select('id, messages_failed')
            .eq('campaign_id', item.campaign_id)
            .limit(1)
            .single();
          if (metricRowFail?.id) {
            await supabase
              .from('campaign_metrics')
              .update({
                messages_failed: (metricRowFail.messages_failed ?? 0) + 1,
                last_message_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              })
              .eq('id', metricRowFail.id);
          }

          recordMessageSent('global', undefined, false);
          recordMessageSent('campaign', item.campaign_id, false);
          // chosenInstance pode ser null em erro anterior; não registrar neste caso
        }
      }

      await fetchMessageQueue();
      await fetchMetrics();
      return true;
    } catch (err) {
      console.error('Erro ao processar fila:', err);
      return false;
    }
  }, [currentTenant?.id, instances, selectBestInstance, canSendMessage, getNextAllowedTime, recordMessageSent, campaigns, fetchMessageQueue, fetchMetrics, updateQuotaUsage]);
  // Start campaign
  const startCampaign = useCallback(async (campaignId: string): Promise<boolean> => {
    try {
      const campaign = campaigns.find(c => c.id === campaignId);
      if (!campaign) {
        toast.error('Campanha não encontrada');
        return false;
      }

      // Validar configuração Evolution API antes de iniciar
      if (!validateEvolutionEnv()) {
        return false;
      }

      // Verificar quotas antes de iniciar
      const canStart = await checkQuotasBeforeStart(campaign);
      if (!canStart) return false;

      setIsLoading(true);

      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) return false;

      const res = await fetch(`/api/campaigns/${campaignId}/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json?.error || 'Falha ao iniciar campanha');
      }

      await updateQuotaUsage('campaigns', 1);
      toast.success('Campanha iniciada com sucesso!');
      return true;
    } catch (error) {
      console.error('Erro ao iniciar campanha:', error);
      toast.error('Erro ao iniciar campanha');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [campaigns, checkQuotasBeforeStart, updateQuotaUsage]);

  // Pause campaign
  const pauseCampaign = useCallback(async (id: string): Promise<boolean> => {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) return false;
    try {
      const res = await fetch(`/api/campaigns/${id}/pause`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Falha ao pausar campanha');
      return true;
    } catch (e) {
      console.error('Erro ao pausar campanha:', e);
      return false;
    }
  }, []);

  // Resume campaign
  const resumeCampaign = useCallback(async (id: string): Promise<boolean> => {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) return false;
    try {
      const res = await fetch(`/api/campaigns/${id}/resume`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Falha ao retomar campanha');
      return true;
    } catch (e) {
      console.error('Erro ao retomar campanha:', e);
      return false;
    }
  }, []);

  // Stop campaign
  const stopCampaign = useCallback(async (id: string): Promise<boolean> => {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) return false;
    try {
      const res = await fetch(`/api/campaigns/${id}/stop`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Falha ao finalizar campanha');
      return true;
    } catch (e) {
      console.error('Erro ao finalizar campanha:', e);
      return false;
    }
  }, []);

  // Add messages to queue
  const addToQueue = useCallback(async (campaignId: string, messages: Partial<MessageQueueItem>[]): Promise<boolean> => {
    if (!currentTenant?.id) return false;

    try {
      const queueItems = messages.map(msg => ({
        ...msg,
        campaign_id: campaignId,
        tenant_id: currentTenant.id,
        status: 'pending' as const,
        retry_count: 0,
        scheduled_at: msg.scheduled_at || new Date().toISOString()
      }));

      const { error } = await supabase
        .from('message_queue')
        .insert(queueItems);

      if (error) throw error;

      await fetchMessageQueue();
      return true;
    } catch (err) {
      console.error('Erro ao adicionar mensagens à fila:', err);
      return false;
    }
  }, [currentTenant?.id, fetchMessageQueue]);


  // Send message with quota check
  const sendMessage = useCallback(async (
    instanceId: string,
    contactId: string,
    message: string,
    campaignId?: string
  ): Promise<boolean> => {
    try {
      // Validar configuração Evolution API antes de enviar
      if (!validateEvolutionEnv()) {
        return false;
      }
      // Verificar quota de mensagens antes de enviar
      if (!canPerformAction('messages')) {
        toast.error(getUpgradeMessage('messages'));
        return false;
      }

      // Escolher instância
      let chosenInstance = instances.find(i => i.id === instanceId) || selectBestInstance(instanceId ? [instanceId] : []);
      if (!chosenInstance) {
        toast.error('Nenhuma instância disponível para envio');
        return false;
      }
      if (chosenInstance.status !== 'connected' || chosenInstance.health_status !== 'healthy') {
        const alt = selectBestInstance([chosenInstance.id]);
        if (!alt) {
          toast.error('Instância indisponível e sem alternativa');
          return false;
        }
        chosenInstance = alt;
      }

      // Rate limit
      if (!canSendMessage('global') || (campaignId && !canSendMessage('campaign', campaignId)) || !canSendMessage('instance', chosenInstance.id)) {
        const nextTimes = [
          getNextAllowedTime('global'),
          campaignId ? getNextAllowedTime('campaign', campaignId) : null,
          getNextAllowedTime('instance', chosenInstance.id)
        ].filter(Boolean) as Date[];
        const nextAllowed = nextTimes.length > 0 ? new Date(Math.min(...nextTimes.map(d => d.getTime()))) : null;
        toast.error(`Rate limit atingido. Próximo envio ${nextAllowed ? `em ${nextAllowed.toLocaleTimeString()}` : 'em breve'}.`);
        return false;
      }

      // Envio real
      const evolution = new EvolutionApiService({
        baseUrl: import.meta.env.VITE_EVOLUTION_API_URL || 'http://localhost:8080',
        apiKey: import.meta.env.VITE_EVOLUTION_API_KEY || 'your-api-key',
        instanceName: chosenInstance.name,
      });
      await evolution.sendTextMessage(contactId, message);

      // Atualizações pós-envio
      recordMessageSent('global', undefined, true);
      if (campaignId) recordMessageSent('campaign', campaignId, true);
      recordMessageSent('instance', chosenInstance.id, true);
      await updateQuotaUsage('messages', 1);

      return true;
    } catch (error) {
      console.error('Erro ao enviar mensagem:', error);
      recordMessageSent('global', undefined, false);
      if (campaignId) recordMessageSent('campaign', campaignId, false);
      recordMessageSent('instance', instanceId, false);
      return false;
    }
  }, [canPerformAction, getUpgradeMessage, updateQuotaUsage, instances, selectBestInstance, canSendMessage, getNextAllowedTime, recordMessageSent]);

  // Retry failed messages
  const retryFailedMessages = useCallback(async (campaignId: string): Promise<boolean> => {
    try {
      // Buscar mensagens falhadas
      const { data: failedMessages, error: fetchError } = await supabase
        .from('message_queue')
        .select('id, retry_count')
        .eq('campaign_id', campaignId)
        .eq('status', 'failed');

      if (fetchError) throw fetchError;

      // Atualizar cada mensagem individualmente: voltar para 'pending', incrementar retry_count e reagendar
      if (failedMessages && failedMessages.length > 0) {
        for (const msg of failedMessages) {
          const { error: updateError } = await supabase
            .from('message_queue')
            .update({
              status: 'pending',
              retry_count: (msg.retry_count ?? 0) + 1,
              scheduled_at: new Date().toISOString()
            })
            .eq('id', msg.id);

          if (updateError) throw updateError;
        }
      }

      await fetchMessageQueue();
      toastHook({
        title: "Sucesso",
        description: "Mensagens falhadas reagendadas para reenvio"
      });

      return true;
    } catch (err) {
      console.error('Erro ao reagendar mensagens:', err);
      toastHook({
        title: "Erro",
        description: "Falha ao reagendar mensagens",
        variant: "destructive"
      });
      return false;
    }
  }, [fetchMessageQueue, toastHook]);

  // Subscribe to real-time metrics
  const subscribeToMetrics = useCallback((campaignId: string) => {
    // In test environment, skip creating real-time subscriptions to avoid lingering async listeners
    if (isTestEnv) {
      return () => {};
    }

    const subscription = supabase
      .channel(`campaign_metrics_${campaignId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'campaign_metrics',
        filter: `campaign_id=eq.${campaignId}`
      }, (payload) => {
        if (payload.new) {
          setMetrics(prev => ({
            ...prev,
            [campaignId]: payload.new as CampaignMetrics
          }));
        }
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Refresh all data
  const refreshData = useCallback(async () => {
    await Promise.all([
      fetchCampaigns(),
      fetchMetrics(),
      fetchMessageQueue()
    ]);
  }, [fetchCampaigns, fetchMetrics, fetchMessageQueue]);

  // Initial load
  useEffect(() => {
    if (!isTestEnv && currentTenant?.id) {
      refreshData();
    }
  }, [isTestEnv, currentTenant?.id, refreshData]);

  return {
    campaigns,
    metrics,
    messageQueue,
    isLoading,
    error,
    createCampaign,
    updateCampaign,
    deleteCampaign,
    startCampaign,
    pauseCampaign,
    resumeCampaign,
    stopCampaign,
    addToQueue,
    processQueue,
    retryFailedMessages,
    sendMessage,
    subscribeToMetrics,
    refreshData
  };
};