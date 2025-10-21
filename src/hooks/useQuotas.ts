import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useTenant } from '@/hooks/useTenant';
import { useAuth } from '@/hooks/useAuth';

export interface TenantQuota {
  id: string;
  tenant_id: string;
  max_users: number;
  max_contacts: number;
  max_campaigns: number;
  max_connections: number;
  current_users: number;
  current_contacts: number;
  current_campaigns: number;
  current_connections: number;
  alert_85_enabled: boolean;
  alert_100_enabled: boolean;
  blocked_features: string[];
  updated_at: string;
}

export interface QuotaAlert {
  id: string;
  tenant_id: string;
  alert_type: '85_percent' | '100_percent';
  resource_type: 'users' | 'contacts' | 'campaigns' | 'connections';
  current_usage: number;
  max_limit: number;
  percentage: number;
  message: string;
  acknowledged: boolean;
  acknowledged_by?: string;
  acknowledged_at?: string;
  created_at: string;
}

export interface QuotaUsage {
  resource: 'users' | 'contacts' | 'campaigns' | 'connections';
  current: number;
  max: number;
  percentage: number;
  status: 'safe' | 'warning' | 'critical' | 'blocked';
}

export interface QuotaLimits {
  users: { current: number; max: number; percentage: number };
  contacts: { current: number; max: number; percentage: number };
  campaigns: { current: number; max: number; percentage: number };
  connections: { current: number; max: number; percentage: number };
}

export const useQuotas = () => {
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const [quota, setQuota] = useState<TenantQuota | null>(null);
  const [alerts, setAlerts] = useState<QuotaAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Calcular status baseado na porcentagem
  const getQuotaStatus = (percentage: number): QuotaUsage['status'] => {
    if (percentage >= 100) return 'blocked';
    if (percentage >= 85) return 'critical';
    if (percentage >= 70) return 'warning';
    return 'safe';
  };

  // Calcular porcentagem de uso
  const calculatePercentage = (current: number, max: number): number => {
    if (max === 0) return 0;
    return Math.round((current / max) * 100);
  };

  // Obter dados de quota do tenant atual
  const fetchQuota = useCallback(async () => {
    if (!user || !currentTenant?.id) {
      setQuota(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { data, error: quotaError } = await supabase
        .from('tenant_quotas')
        .select('*')
        .eq('tenant_id', currentTenant.id)
        .single();

      if (quotaError) {
        if (quotaError.code === 'PGRST116') {
          // Quota não existe, criar uma padrão
          const { data: newQuota, error: createError } = await supabase
            .from('tenant_quotas')
            .insert({
              tenant_id: currentTenant.id,
              max_users: 5,
              max_contacts: 1000,
              max_campaigns: 10,
              max_connections: 2,
              current_users: 0,
              current_contacts: 0,
              current_campaigns: 0,
              current_connections: 0,
              alert_85_enabled: true,
              alert_100_enabled: true,
              blocked_features: []
            })
            .select()
            .single();

          if (createError) throw createError;
          setQuota(newQuota);
        } else {
          throw quotaError;
        }
      } else {
        setQuota(data);
      }
    } catch (err) {
      console.error('Erro ao buscar quotas:', err);
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  }, [user, currentTenant?.id]);

  // Obter alertas de quota
  const fetchAlerts = useCallback(async () => {
    if (!user || !currentTenant?.id) {
      setAlerts([]);
      return;
    }

    try {
      const { data, error: alertsError } = await supabase
        .from('quota_alerts')
        .select('*')
        .eq('tenant_id', currentTenant.id)
        .eq('acknowledged', false)
        .order('created_at', { ascending: false })
        .limit(10);

      if (alertsError) throw alertsError;
      setAlerts(data || []);
    } catch (err) {
      console.error('Erro ao buscar alertas:', err);
    }
  }, [user, currentTenant?.id]);

  // Atualizar contadores de quota manualmente
  const refreshQuotaCounters = useCallback(async () => {
    if (!currentTenant?.id) return;

    try {
      const { error } = await supabase.rpc('update_tenant_quota_counters', {
        tenant_uuid: currentTenant.id
      });

      if (error) throw error;
      
      // Recarregar dados após atualização
      await fetchQuota();
      await fetchAlerts();
    } catch (err) {
      console.error('Erro ao atualizar contadores:', err);
      setError(err instanceof Error ? err.message : 'Erro ao atualizar contadores');
    }
  }, [currentTenant?.id, fetchQuota, fetchAlerts]);

  // Marcar alerta como reconhecido
  const acknowledgeAlert = useCallback(async (alertId: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('quota_alerts')
        .update({
          acknowledged: true,
          acknowledged_by: user.id,
          acknowledged_at: new Date().toISOString()
        })
        .eq('id', alertId);

      if (error) throw error;
      
      // Atualizar lista de alertas
      setAlerts(prev => prev.filter(alert => alert.id !== alertId));
    } catch (err) {
      console.error('Erro ao reconhecer alerta:', err);
    }
  }, [user]);

  // Verificar se uma funcionalidade está bloqueada
  const isFeatureBlocked = useCallback((feature: string): boolean => {
    if (!quota) return false;
    return quota.blocked_features.includes(feature);
  }, [quota]);

  // Verificar se pode criar novo recurso
  const canCreateResource = useCallback((resourceType: 'users' | 'contacts' | 'campaigns' | 'connections'): boolean => {
    if (!quota) return false;

    switch (resourceType) {
      case 'users':
        return quota.current_users < quota.max_users;
      case 'contacts':
        return quota.current_contacts < quota.max_contacts;
      case 'campaigns':
        return quota.current_campaigns < quota.max_campaigns;
      case 'connections':
        return quota.current_connections < quota.max_connections;
      default:
        return false;
    }
  }, [quota]);

  // Obter limites formatados
  const getQuotaLimits = useCallback((): QuotaLimits | null => {
    if (!quota) return null;

    return {
      users: {
        current: quota.current_users,
        max: quota.max_users,
        percentage: calculatePercentage(quota.current_users, quota.max_users)
      },
      contacts: {
        current: quota.current_contacts,
        max: quota.max_contacts,
        percentage: calculatePercentage(quota.current_contacts, quota.max_contacts)
      },
      campaigns: {
        current: quota.current_campaigns,
        max: quota.max_campaigns,
        percentage: calculatePercentage(quota.current_campaigns, quota.max_campaigns)
      },
      connections: {
        current: quota.current_connections,
        max: quota.max_connections,
        percentage: calculatePercentage(quota.current_connections, quota.max_connections)
      }
    };
  }, [quota]);

  // Obter uso detalhado por recurso
  const getResourceUsage = useCallback((resourceType: 'users' | 'contacts' | 'campaigns' | 'connections'): QuotaUsage | null => {
    if (!quota) return null;

    let current: number, max: number;

    switch (resourceType) {
      case 'users':
        current = quota.current_users;
        max = quota.max_users;
        break;
      case 'contacts':
        current = quota.current_contacts;
        max = quota.max_contacts;
        break;
      case 'campaigns':
        current = quota.current_campaigns;
        max = quota.max_campaigns;
        break;
      case 'connections':
        current = quota.current_connections;
        max = quota.max_connections;
        break;
      default:
        return null;
    }

    const percentage = calculatePercentage(current, max);
    const status = getQuotaStatus(percentage);

    return {
      resource: resourceType,
      current,
      max,
      percentage,
      status
    };
  }, [quota]);

  // Atualizar limites de quota (apenas ADMIN/SUPERADMIN)
  const updateQuotaLimits = useCallback(async (updates: Partial<Pick<TenantQuota, 'max_users' | 'max_contacts' | 'max_campaigns' | 'max_connections'>>) => {
    if (!currentTenant?.id) return;

    try {
      const { error } = await supabase
        .from('tenant_quotas')
        .update(updates)
        .eq('tenant_id', currentTenant.id);

      if (error) throw error;
      
      // Recarregar dados
      await fetchQuota();
    } catch (err) {
      console.error('Erro ao atualizar limites:', err);
      throw err;
    }
  }, [currentTenant?.id, fetchQuota]);

  // Efeitos
  useEffect(() => {
    fetchQuota();
  }, [fetchQuota]);

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  // Subscription para atualizações em tempo real
  useEffect(() => {
    if (!currentTenant?.id) return;

    const quotaSubscription = supabase
      .channel('quota-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tenant_quotas',
          filter: `tenant_id=eq.${currentTenant.id}`
        },
        () => {
          fetchQuota();
        }
      )
      .subscribe();

    const alertsSubscription = supabase
      .channel('quota-alerts')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
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
      quotaSubscription.unsubscribe();
      alertsSubscription.unsubscribe();
    };
  }, [currentTenant?.id, fetchQuota, fetchAlerts]);

  return {
    // Estados
    quota,
    alerts,
    loading,
    error,

    // Funções de consulta
    getQuotaLimits,
    getResourceUsage,
    canCreateResource,
    isFeatureBlocked,

    // Ações
    refreshQuotaCounters,
    acknowledgeAlert,
    updateQuotaLimits,

    // Utilitários
    calculatePercentage,
    getQuotaStatus
  };
};