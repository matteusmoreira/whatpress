import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useTenant } from '@/hooks/useTenant';
import { toast } from 'sonner';

export interface QuotaUsage {
  users: { used: number; max: number; percentage: number };
  contacts: { used: number; max: number; percentage: number };
  campaigns: { used: number; max: number; percentage: number };
  messages: { used: number; max: number; percentage: number };
  connections: { used: number; max: number; percentage: number };
  templates: { used: number; max: number; percentage: number };
  automations: { used: number; max: number; percentage: number };
}

export interface QuotaAlert {
  id: string;
  quota_type: string;
  threshold_percentage: number;
  current_usage: number;
  max_limit: number;
  alert_message: string;
  is_read: boolean;
  created_at: string;
  expires_at: string;
}

export interface TenantQuota {
  id: string;
  tenant_id: string;
  max_users: number;
  max_contacts: number;
  used_contacts: number;
  max_campaigns: number;
  max_messages_per_month: number;
  max_monthly_messages: number;
  used_messages_current_month: number;
  current_monthly_messages?: number;
  max_whatsapp_connections: number;
  used_whatsapp_connections: number;
  current_whatsapp_connections?: number;
  max_message_templates: number;
  used_message_templates: number;
  current_message_templates?: number;
  max_automations: number;
  used_automations: number;
  current_automations?: number;
  current_users?: number;
  current_contacts?: number;
  quota_alerts_enabled: boolean;
  alert_threshold_85: boolean;
  alert_threshold_100: boolean;
  is_blocked: boolean;
  blocked_reason: string | null;
  blocked_at: string | null;
  created_at: string;
}

export const useQuotas = () => {
  const { currentTenant } = useTenant();
  const [quotas, setQuotas] = useState<TenantQuota | null>(null);
  const [quotaUsage, setQuotaUsage] = useState<QuotaUsage | null>(null);
  const [alerts, setAlerts] = useState<QuotaAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Calcular percentual de uso
  const calculatePercentage = useCallback((used: number, max: number): number => {
    if (max === 0 || max === null) return 0;
    return Math.round((used / max) * 100);
  }, []);

  // Verificar se quota foi excedida
  const isQuotaExceeded = useCallback((used: number, max: number): boolean => {
    if (max === null || max === 0) return false;
    return used >= max;
  }, []);

  // Buscar quotas do tenant atual
  const fetchQuotas = useCallback(async () => {
    if (!currentTenant?.id) return;

    try {
      setLoading(true);
      setError(null);

      const { data: quotaData, error: quotaError } = await supabase
        .from('tenant_quotas')
        .select('*')
        .eq('tenant_id', currentTenant.id)
        .single();

      if (quotaError) throw quotaError;

      setQuotas(quotaData);

      // Calcular uso atual de usuários
      const { count: usersCount } = await supabase
        .from('user_tenants')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', currentTenant.id)
        .eq('status', 'active');

      // Calcular uso atual de campanhas
      const { count: campaignsCount } = await supabase
        .from('campaigns')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', currentTenant.id);

      // Montar objeto de uso
      const usage: QuotaUsage = {
        users: {
          used: usersCount || 0,
          max: quotaData.max_users,
          percentage: calculatePercentage(usersCount || 0, quotaData.max_users)
        },
        contacts: {
          used: quotaData.used_contacts,
          max: quotaData.max_contacts,
          percentage: calculatePercentage(quotaData.used_contacts, quotaData.max_contacts)
        },
        campaigns: {
          used: campaignsCount || 0,
          max: quotaData.max_campaigns,
          percentage: calculatePercentage(campaignsCount || 0, quotaData.max_campaigns)
        },
        messages: {
          used: quotaData.used_messages_current_month,
          max: quotaData.max_messages_per_month,
          percentage: calculatePercentage(quotaData.used_messages_current_month, quotaData.max_messages_per_month)
        },
        connections: {
          used: quotaData.used_whatsapp_connections,
          max: quotaData.max_whatsapp_connections,
          percentage: calculatePercentage(quotaData.used_whatsapp_connections, quotaData.max_whatsapp_connections)
        },
        templates: {
          used: quotaData.used_message_templates,
          max: quotaData.max_message_templates,
          percentage: calculatePercentage(quotaData.used_message_templates, quotaData.max_message_templates)
        },
        automations: {
          used: quotaData.used_automations,
          max: quotaData.max_automations,
          percentage: calculatePercentage(quotaData.used_automations, quotaData.max_automations)
        }
      };

      setQuotaUsage(usage);

    } catch (err) {
      console.error('Erro ao buscar quotas:', err);
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  }, [currentTenant?.id, calculatePercentage]);

  // Buscar alertas ativos
  const fetchAlerts = useCallback(async () => {
    if (!currentTenant?.id) return;

    try {
      const { data: alertsData, error: alertsError } = await supabase
        .from('quota_alerts')
        .select('*')
        .eq('tenant_id', currentTenant.id)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false });

      if (alertsError) throw alertsError;

      setAlerts(alertsData || []);

      // Mostrar alertas não lidos como toast
      alertsData?.forEach(alert => {
        if (!alert.is_read) {
          if (alert.threshold_percentage === 100) {
            toast.error(alert.alert_message, {
              duration: 10000,
              action: {
                label: 'Fazer Upgrade',
                onClick: () => {
                  // Redirecionar para página de planos
                  window.location.href = '/settings/billing';
                }
              }
            });
          } else {
            toast.warning(alert.alert_message, {
              duration: 8000,
              action: {
                label: 'Ver Detalhes',
                onClick: () => {
                  // Redirecionar para página de quotas
                  window.location.href = '/settings/quotas';
                }
              }
            });
          }
        }
      });

    } catch (err) {
      console.error('Erro ao buscar alertas:', err);
    }
  }, [currentTenant?.id]);

  // Marcar alerta como lido
  const markAlertAsRead = useCallback(async (alertId: string) => {
    try {
      const { error } = await supabase
        .from('quota_alerts')
        .update({ is_read: true })
        .eq('id', alertId);

      if (error) throw error;

      setAlerts(prev => prev.map(alert => 
        alert.id === alertId ? { ...alert, is_read: true } : alert
      ));

    } catch (err) {
      console.error('Erro ao marcar alerta como lido:', err);
    }
  }, []);

  // Verificar se pode executar ação baseado na quota
  const canPerformAction = useCallback((quotaType: keyof QuotaUsage): boolean => {
    if (!quotaUsage || !quotas) return false;
    
    const usage = quotaUsage[quotaType];
    return !isQuotaExceeded(usage.used, usage.max);
  }, [quotaUsage, quotas, isQuotaExceeded]);

  // Atualizar uso de quota
  const updateQuotaUsage = useCallback(async (
    quotaType: 'contacts' | 'connections' | 'templates' | 'automations' | 'messages' | 'campaigns',
    increment: number = 1
  ): Promise<boolean> => {
    if (!currentTenant?.id) return false;

    try {
      const { data, error } = await supabase.rpc('update_quota_usage', {
        p_tenant_id: currentTenant.id,
        p_quota_type: quotaType,
        p_increment: increment
      });

      if (error) throw error;

      // Recarregar quotas após atualização
      await fetchQuotas();
      await fetchAlerts();

      return data; // Retorna true se não excedeu o limite
    } catch (err) {
      console.error('Erro ao atualizar quota:', err);
      toast.error('Erro ao atualizar quota');
      return false;
    }
  }, [currentTenant?.id, fetchQuotas, fetchAlerts]);

  // Obter mensagem de upgrade amigável
  const getUpgradeMessage = useCallback((quotaType: keyof QuotaUsage): string => {
    const quotaNames = {
      users: 'usuários',
      contacts: 'contatos',
      campaigns: 'campanhas',
      messages: 'mensagens',
      connections: 'conexões WhatsApp',
      templates: 'templates de mensagem',
      automations: 'automações'
    };

    return `Você atingiu o limite de ${quotaNames[quotaType]}. Faça upgrade do seu plano para continuar usando esta funcionalidade.`;
  }, []);

  // Verificar se tenant está bloqueado
  const isBlocked = quotas?.is_blocked || false;

  // Contar alertas não lidos
  const unreadAlertsCount = alerts.filter(alert => !alert.is_read).length;

  // Efeitos
  useEffect(() => {
    if (currentTenant?.id) {
      fetchQuotas();
      fetchAlerts();
    }
  }, [currentTenant?.id, fetchQuotas, fetchAlerts]);

  // Subscription para mudanças em tempo real
  useEffect(() => {
    if (!currentTenant?.id) return;

    const quotasSubscription = supabase
      .channel('quota_changes')
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'tenant_quotas',
          filter: `tenant_id=eq.${currentTenant.id}`
        }, 
        () => {
          fetchQuotas();
        }
      )
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'quota_alerts',
          filter: `tenant_id=eq.${currentTenant.id}`
        }, 
        () => {
          fetchAlerts();
        }
      )
      .subscribe();

    return () => {
      quotasSubscription.unsubscribe();
    };
  }, [currentTenant?.id, fetchQuotas, fetchAlerts]);

  return {
    // Estados
    quotas,
    quotaUsage,
    alerts,
    loading,
    error,
    isBlocked,
    unreadAlertsCount,

    // Funções
    fetchQuotas,
    fetchAlerts,
    markAlertAsRead,
    canPerformAction,
    updateQuotaUsage,
    getUpgradeMessage,
    calculatePercentage,
    isQuotaExceeded,

    // Helpers
    refresh: () => {
      fetchQuotas();
      fetchAlerts();
    }
  };
};