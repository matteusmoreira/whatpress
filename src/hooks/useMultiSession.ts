import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useTenant } from './useTenant';
import { useToast } from '@/hooks/use-toast';
import { isTestEnv } from '@/lib/env';

export interface WhatsAppInstance {
  id: string;
  tenant_id: string;
  name: string;
  phone_number: string;
  status: 'connected' | 'disconnected' | 'connecting' | 'error';
  health_status: 'healthy' | 'warning' | 'critical' | 'offline';
  last_health_check?: string;
  health_check_failures: number;
  rate_limit_per_minute: number;
  current_load: number;
  max_concurrent_messages: number;
  priority_weight: number;
  // Campos opcionais utilizados em componentes/UI legados
  priority?: number;
  failover_enabled?: boolean;
  is_active?: boolean;
  failover_group?: string;
  session_data?: any;
  // Additional legacy UI-compatible optional fields
  messages_sent_today?: number;
  avg_response_time?: number;
  last_seen_at?: string;
  created_at: string;
  updated_at: string;
}

export interface InstanceHealthLog {
  id: string;
  whatsapp_instance_id: string;
  health_status: 'healthy' | 'warning' | 'critical' | 'offline';
  response_time?: number;
  error_message?: string;
  metadata: any;
  timestamp: string;
}

export interface LoadBalancingConfig {
  strategy: 'round_robin' | 'least_loaded' | 'priority_based' | 'random';
  max_retries: number;
  retry_delay: number;
  health_check_interval: number;
  failover_threshold: number;
  // Opcional: compatibilidade com UI que usa failover_enabled
  failover_enabled?: boolean;
  // Campos opcionais para compatibilidade com UI
  auto_scaling_enabled?: boolean;
  load_threshold?: number;
}

interface UseMultiSessionReturn {
  instances: WhatsAppInstance[];
  healthLogs: InstanceHealthLog[];
  loadBalancingConfig: LoadBalancingConfig;
  isLoading: boolean;
  error: string | null;
  
  // Instance Management
  addInstance: (instanceData: Partial<WhatsAppInstance>) => Promise<WhatsAppInstance | null>;
  updateInstance: (id: string, updates: Partial<WhatsAppInstance>) => Promise<boolean>;
  removeInstance: (id: string) => Promise<boolean>;
  
  // Health Monitoring
  checkInstanceHealth: (instanceId: string) => Promise<boolean>;
  checkAllInstancesHealth: () => Promise<void>;
  getHealthHistory: (instanceId: string, hours?: number) => Promise<InstanceHealthLog[]>;
  
  // Load Balancing
  selectBestInstance: (excludeIds?: string[]) => WhatsAppInstance | null;
  distributeLoad: (messageCount: number) => Record<string, number>;
  updateLoadBalancingConfig: (config: Partial<LoadBalancingConfig>) => Promise<boolean>;
  
  // Failover Management
  handleInstanceFailure: (instanceId: string) => Promise<void>;
  redistributeMessages: (failedInstanceId: string) => Promise<boolean>;
  
  // Real-time Updates
  subscribeToHealthUpdates: () => () => void;
  refreshData: () => Promise<void>;
}

export const useMultiSession = (): UseMultiSessionReturn => {
  const { currentTenant } = useTenant();
  const { toast } = useToast();
  
  const [instances, setInstances] = useState<WhatsAppInstance[]>([]);
  const [healthLogs, setHealthLogs] = useState<InstanceHealthLog[]>([]);
  const [loadBalancingConfig, setLoadBalancingConfig] = useState<LoadBalancingConfig>({
    strategy: 'least_loaded',
    max_retries: 3,
    retry_delay: 5000,
    health_check_interval: 30000,
    failover_threshold: 3,
    failover_enabled: true,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch instances
  const fetchInstances = useCallback(async () => {
    if (!currentTenant?.id) return;

    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('whatsapp_instances')
        .select('*')
        .eq('tenant_id', currentTenant.id)
        .order('priority_weight', { ascending: false });

      if (error) throw error;
      // Mapear compatibilidade: preencher priority e is_active se ausentes
      const normalized = (data || []).map((inst: any) => ({
        ...inst,
        priority: typeof inst.priority === 'number' ? inst.priority : (inst.priority_weight ?? 1),
        is_active: typeof inst.is_active === 'boolean' ? inst.is_active : (inst.status !== 'disconnected' && inst.status !== 'error'),
      })) as WhatsAppInstance[];
      setInstances(normalized);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar instâncias');
      toast({
        title: "Erro",
        description: "Falha ao carregar instâncias WhatsApp",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  }, [currentTenant?.id, toast]);

  // Fetch health logs
  const fetchHealthLogs = useCallback(async () => {
    if (!currentTenant?.id) return;

    try {
      const { data, error } = await supabase
        .from('instance_health_logs')
        .select('*')
        .eq('tenant_id', currentTenant.id)
        .gte('timestamp', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .order('timestamp', { ascending: false })
        .limit(100);

      if (error) throw error;
      setHealthLogs(data || []);
    } catch (err) {
      console.error('Erro ao carregar logs de saúde:', err);
    }
  }, [currentTenant?.id]);

  // Add instance
  const addInstance = useCallback(async (instanceData: Partial<WhatsAppInstance>): Promise<WhatsAppInstance | null> => {
    if (!currentTenant?.id) return null;

    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('whatsapp_instances')
        .insert({
          ...instanceData,
          tenant_id: currentTenant.id,
          health_status: 'offline',
          health_check_failures: 0,
          current_load: 0,
          rate_limit_per_minute: instanceData.rate_limit_per_minute || 30,
          max_concurrent_messages: instanceData.max_concurrent_messages || 10,
          priority_weight: (instanceData.priority_weight ?? instanceData.priority ?? 1)
        })
        .select()
        .single();

      if (error) throw error;

      const normalized: WhatsAppInstance = {
        ...data,
        priority: typeof data.priority === 'number' ? data.priority : (data.priority_weight ?? 1),
        is_active: typeof data.is_active === 'boolean' ? data.is_active : (data.status !== 'disconnected' && data.status !== 'error'),
      };

      setInstances(prev => [...prev, normalized]);
      toast({
        title: "Sucesso",
        description: "Instância WhatsApp adicionada com sucesso"
      });

      return normalized;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao adicionar instância');
      toast({
        title: "Erro",
        description: "Falha ao adicionar instância WhatsApp",
        variant: "destructive"
      });
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [currentTenant?.id, toast]);

  // Update instance
  const updateInstance = useCallback(async (id: string, updates: Partial<WhatsAppInstance>): Promise<boolean> => {
    try {
      setIsLoading(true);
      const { error } = await supabase
        .from('whatsapp_instances')
        .update({
          ...updates,
          // Se o UI enviar priority, manter compatível com priority_weight
          priority_weight: (updates.priority_weight ?? updates.priority ?? undefined),
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .eq('tenant_id', currentTenant?.id);

      if (error) throw error;

      setInstances(prev => prev.map(instance => 
        instance.id === id ? { ...instance, ...updates, priority: updates.priority ?? instance.priority } : instance
      ));

      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao atualizar instância');
      toast({
        title: "Erro",
        description: "Falha ao atualizar instância",
        variant: "destructive"
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [currentTenant?.id, toast]);

  // Remove instance
  const removeInstance = useCallback(async (id: string): Promise<boolean> => {
    try {
      setIsLoading(true);
      const { error } = await supabase
        .from('whatsapp_instances')
        .delete()
        .eq('id', id)
        .eq('tenant_id', currentTenant?.id);

      if (error) throw error;

      setInstances(prev => prev.filter(instance => instance.id !== id));
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao remover instância');
      toast({
        title: "Erro",
        description: "Falha ao remover instância",
        variant: "destructive"
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [currentTenant?.id, toast]);

  // Health check de uma instância (mock simplificado)
  const checkInstanceHealth = useCallback(async (instanceId: string): Promise<boolean> => {
    try {
      const instance = instances.find(i => i.id === instanceId)
      if (!instance) return false
      
      // Simular atualização de saúde
      const isHealthy = Math.random() > 0.2
      const updated: Pick<WhatsAppInstance, 'health_status' | 'last_health_check' | 'health_check_failures'> = {
        health_status: isHealthy ? 'healthy' : 'warning',
        last_health_check: new Date().toISOString(),
        health_check_failures: isHealthy ? 0 : (instance.health_check_failures + 1)
      }
      
      await supabase
        .from('whatsapp_instances')
        .update(updated)
        .eq('id', instanceId)
        .eq('tenant_id', currentTenant?.id)
      
      setInstances(prev => prev.map(i => i.id === instanceId ? { ...i, ...updated } : i))
      return true
    } catch (err) {
      console.error('Erro ao verificar saúde da instância:', err)
      return false
    }
  }, [instances, currentTenant?.id])

  const checkAllInstancesHealth = useCallback(async () => {
    await Promise.all(instances.map(i => checkInstanceHealth(i.id)))
  }, [instances, checkInstanceHealth])

  const getHealthHistory = useCallback(async (instanceId: string, hours = 24): Promise<InstanceHealthLog[]> => {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString()
    const { data } = await supabase
      .from('instance_health_logs')
      .select('*')
      .eq('whatsapp_instance_id', instanceId)
      .gte('timestamp', since)
      .order('timestamp', { ascending: false })
    return data || []
  }, [])

  // Selecionar melhor instância
  const selectBestInstance = useCallback((excludeIds: string[] = []): WhatsAppInstance | null => {
    const available = instances.filter(i => 
      !excludeIds.includes(i.id) && 
      i.status === 'connected' && 
      i.health_status === 'healthy'
    )

    if (available.length === 0) return null

    switch (loadBalancingConfig.strategy) {
      case 'least_loaded':
        return available.reduce((best, curr) => curr.current_load < best.current_load ? curr : best)
      case 'priority_based':
        return available.sort((a, b) => (b.priority ?? b.priority_weight) - (a.priority ?? a.priority_weight))[0]
      case 'round_robin':
        return available[Math.floor(Math.random() * available.length)] // simplificado
      case 'random':
      default:
        return available[Math.floor(Math.random() * available.length)]
    }
  }, [instances, loadBalancingConfig])

  const distributeLoad = useCallback((messageCount: number): Record<string, number> => {
    const available = instances.filter(i => i.status === 'connected')
    if (available.length === 0) return {}

    const distribution: Record<string, number> = {}

    switch (loadBalancingConfig.strategy) {
      case 'least_loaded':
        const sortedByLoad = [...available].sort((a, b) => a.current_load - b.current_load)
        for (let i = 0; i < messageCount; i++) {
          const target = sortedByLoad[i % sortedByLoad.length]
          distribution[target.id] = (distribution[target.id] || 0) + 1
        }
        break
      case 'priority_based':
        const sortedByPriority = [...available].sort((a, b) => (b.priority ?? b.priority_weight) - (a.priority ?? a.priority_weight))
        for (let i = 0; i < messageCount; i++) {
          const target = sortedByPriority[i % sortedByPriority.length]
          distribution[target.id] = (distribution[target.id] || 0) + 1
        }
        break
      case 'round_robin':
      default:
        for (let i = 0; i < messageCount; i++) {
          const target = available[i % available.length]
          distribution[target.id] = (distribution[target.id] || 0) + 1
        }
        break
    }

    return distribution
  }, [instances, loadBalancingConfig])

  const updateLoadBalancingConfig = useCallback(async (config: Partial<LoadBalancingConfig>): Promise<boolean> => {
    try {
      setLoadBalancingConfig(prev => ({ ...prev, ...config }))
      return true
    } catch (err) {
      console.error('Erro ao atualizar configuração de balanceamento:', err)
      return false
    }
  }, [])

  const handleInstanceFailure = useCallback(async (instanceId: string) => {
    // Simular lógica de failover
    const instance = instances.find(i => i.id === instanceId)
    if (!instance) return

    await supabase
      .from('whatsapp_instances')
      .update({ status: 'error' })
      .eq('id', instanceId)
      .eq('tenant_id', currentTenant?.id)

    setInstances(prev => prev.map(i => i.id === instanceId ? { ...i, status: 'error' } : i))
    
    // Redistribuir mensagens
    await redistributeMessages(instanceId)
  }, [instances, currentTenant?.id])

  const redistributeMessages = useCallback(async (failedInstanceId: string): Promise<boolean> => {
    try {
      // Simulação de redistribuição
      const available = instances.filter(i => i.id !== failedInstanceId && i.status === 'connected')
      if (available.length === 0) return false

      const distribution = distributeLoad(available.length * 2)
      console.log('Redistribuição calculada:', distribution)
      return true
    } catch (err) {
      console.error('Erro ao redistribuir mensagens:', err)
      return false
    }
  }, [instances, distributeLoad])

  const subscribeToHealthUpdates = useCallback(() => {
    if (isTestEnv) {
      // Evitar inscrições em tempo real nos testes
      return () => {}
    }
    const channel = supabase
      .channel('whatsapp_instances_health')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'whatsapp_instances' }, payload => {
        const updated = payload.new as Partial<WhatsAppInstance>
        setInstances(prev => prev.map(i => i.id === updated.id ? { ...i, ...updated } : i))
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  const refreshData = useCallback(async () => {
    await Promise.all([fetchInstances(), fetchHealthLogs()])
  }, [fetchInstances, fetchHealthLogs])

  useEffect(() => {
    refreshData()
    const unsubscribe = subscribeToHealthUpdates()
    return () => unsubscribe()
  }, [refreshData, subscribeToHealthUpdates])

  return {
    instances,
    healthLogs,
    loadBalancingConfig,
    isLoading,
    error,
    addInstance,
    updateInstance,
    removeInstance,
    checkInstanceHealth,
    checkAllInstancesHealth,
    getHealthHistory,
    selectBestInstance,
    distributeLoad,
    updateLoadBalancingConfig,
    handleInstanceFailure,
    redistributeMessages,
    subscribeToHealthUpdates,
    refreshData
  }
}