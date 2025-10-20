import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useTenant } from './useTenant';
import { useToast } from '@/hooks/use-toast';
import { isTestEnv } from '@/lib/env';

export interface RateLimitConfig {
  id: string;
  tenant_id: string;
  name: string;
  description?: string;
  is_active: boolean;
  scope: 'global' | 'instance' | 'campaign';
  target_id?: string; // instance_id or campaign_id for scoped limits
  
  // Base rate limits
  messages_per_minute: number;
  messages_per_hour: number;
  messages_per_day: number;
  
  // Burst control
  burst_limit: number;
  burst_window_seconds: number;
  
  // Cooldown configuration
  cooldown_after_limit: boolean;
  cooldown_duration_minutes: number;
  
  // Time-based restrictions
  allowed_hours_start: string;
  allowed_hours_end: string;
  allowed_days: string[];
  timezone: string;
  
  // Adaptive rate limiting configuration
  adaptive_rate_limiting: boolean;
  success_rate_threshold: number;
  rate_increase_factor: number;
  rate_decrease_factor: number;
  
  // Optional UI-only fields used by RateLimitConfig component
  priority_multiplier?: number;
  adaptive_rate_enabled?: boolean;
  adaptive_rate_factor?: number;
  adaptive_rate_recovery_minutes?: number;
  // UI-only aliases used in the component editor
  time_window_start?: string;
  time_window_end?: string;
  cooldown_after_burst_minutes?: number;

  created_at: string;
  updated_at: string;
}

export interface RateLimitStatus {
  configId: string;
  scope: string;
  targetId?: string;
  
  // Message counters
  messagesThisMinute: number;
  messagesThisHour: number;
  messagesThisDay: number;
  
  // Limits
  minuteLimit: number;
  hourLimit: number;
  dayLimit: number;
  
  // Status
  isLimited: boolean;
  limitType?: 'minute' | 'hour' | 'day' | 'burst' | 'cooldown' | 'time_restriction';
  nextAllowedTime?: Date;
  
  // Burst tracking
  burstCount: number;
  burstLimit: number;
  burstWindowEnd?: Date;
  
  // Cooldown tracking
  inCooldown: boolean;
  cooldownEnd?: Date;
  
  // Adaptive rate limiting state
  successRate: number;
  adaptiveMultiplier: number;
}

interface UseRateLimitReturn {
  configs: RateLimitConfig[];
  activeConfigs: RateLimitConfig[];
  rateLimitStatus: Record<string, RateLimitStatus>;
  // Legacy array format for UI component compatibility
  rateLimitStatuses: Array<{
    id: string;
    config_id: string;
    instance_id?: string;
    is_blocked: boolean;
    messages_sent_minute: number;
    messages_sent_hour: number;
    messages_sent_day: number;
    minute_limit: number;
    hour_limit: number;
    day_limit: number;
    next_allowed_time?: Date | null;
  }>;
  isLoading: boolean;
  error: string | null;
  
  // CRUD
  createConfig: (configData: Partial<RateLimitConfig>) => Promise<RateLimitConfig | null>;
  updateConfig: (id: string, updates: Partial<RateLimitConfig>) => Promise<boolean>;
  deleteConfig: (id: string) => Promise<boolean>;
  activateConfig: (id: string) => Promise<boolean>;
  deactivateConfig: (id: string) => Promise<boolean>;
  
  // Runtime
  canSendMessage: (scope: string, targetId?: string) => boolean;
  recordMessageSent: (scope: string, targetId?: string, success?: boolean) => Promise<void>;
  getRemainingQuota: (scope: string, targetId?: string) => { minute: number; hour: number; day: number };
  getNextAllowedTime: (scope: string, targetId?: string) => Date | null;
  
  // Status helpers
  getStatus: (scope: string, targetId?: string) => RateLimitStatus | null;
  refreshStatus: () => Promise<void>;
  
  // Validation + utils
  validateConfig: (config: Partial<RateLimitConfig>) => string[];
  calculateAdaptiveRate: (configId: string, successRate: number) => number;
  isWithinAllowedHours: (configId: string) => boolean;
  refreshData: () => Promise<void>;
}

export const useRateLimit = (): UseRateLimitReturn => {
  const { currentTenant } = useTenant();
  const { toast } = useToast();
  
  const [configs, setConfigs] = useState<RateLimitConfig[]>([]);
  const [activeConfigs, setActiveConfigs] = useState<RateLimitConfig[]>([]);
  const [rateLimitStatus, setRateLimitStatus] = useState<Record<string, RateLimitStatus>>({});
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  
  // Local message counters per scope/target (minute/hour/day)
  const [messageCounts, setMessageCounts] = useState<Record<string, {
    minute: { count: number; resetAt: Date };
    hour: { count: number; resetAt: Date };
    day: { count: number; resetAt: Date };
    burst: { count: number; windowEnd: Date };
    cooldown?: { until: Date };
    successRate?: number;
  }>>({});
  
  const getKey = useCallback((scope: string, targetId?: string) => `${scope}:${targetId || 'global'}`, []);
  
  const fetchConfigs = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const { data, error } = await supabase
        .from('rate_limit_configs')
        .select('*')
        .eq('tenant_id', currentTenant?.id || '');
      
      if (error) throw error;
      const configs = (data || []) as RateLimitConfig[];
      setConfigs(configs);
      setActiveConfigs(configs.filter(c => c.is_active));
    } catch (err: any) {
      console.error('Erro ao buscar configs de rate limit:', err);
      setError(err?.message || 'Erro ao buscar configurações');
      toast({ title: 'Erro ao carregar rate limit', description: err?.message || 'Falha ao buscar configurações', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  }, [currentTenant?.id, toast]);
  
  const refreshStatus = useCallback(async () => {
    // Simulated status recompute based on local counters and active configs
    const next: Record<string, RateLimitStatus> = {};
    Object.keys(messageCounts).forEach(key => {
      const [scope, targetId] = key.split(':');
      const counters = messageCounts[key];
      const config = activeConfigs.find(c => c.scope === scope && (c.target_id || 'global') === (targetId || 'global'));
      
      const minuteLimit = config?.messages_per_minute || 0;
      const hourLimit = config?.messages_per_hour || 0;
      const dayLimit = config?.messages_per_day || 0;
      
      let isLimited = false;
      let limitType: RateLimitStatus['limitType'];
      let nextAllowedTime: Date | undefined;
      
      // Cooldown check
      const inCooldown = !!counters.cooldown && counters.cooldown.until > new Date();
      
      if (inCooldown) {
        isLimited = true;
        limitType = 'cooldown';
        nextAllowedTime = counters.cooldown!.until;
      } else if (config && config.allowed_hours_start && config.allowed_hours_end) {
        const nowStr = new Date().toTimeString().slice(0, 5);
        if (nowStr < config.allowed_hours_start || nowStr > config.allowed_hours_end) {
          isLimited = true;
          limitType = 'time_restriction';
        }
      }
      
      // Burst window
      const now = new Date();
      if (counters.burst.windowEnd < now) {
        counters.burst = { count: 0, windowEnd: new Date(now.getTime() + (config?.burst_window_seconds || 60) * 1000) };
      }
      
      if (!isLimited && config) {
        if (counters.minute.count >= (config.messages_per_minute || 0)) {
          isLimited = true;
          limitType = 'minute';
          nextAllowedTime = counters.minute.resetAt;
        } else if (counters.hour.count >= (config.messages_per_hour || 0)) {
          isLimited = true;
          limitType = 'hour';
          nextAllowedTime = counters.hour.resetAt;
        } else if (counters.day.count >= (config.messages_per_day || 0)) {
          isLimited = true;
          limitType = 'day';
          nextAllowedTime = counters.day.resetAt;
        } else if (counters.burst.count >= (config.burst_limit || 0)) {
          isLimited = true;
          limitType = 'burst';
          nextAllowedTime = counters.burst.windowEnd;
          
          if (config.cooldown_after_limit) {
            const until = new Date(now.getTime() + (config.cooldown_duration_minutes || 1) * 60000);
            counters.cooldown = { until };
          }
        }
      }
      
      next[key] = {
        configId: config?.id || '',
        scope,
        targetId: targetId !== 'global' ? targetId : undefined,
        messagesThisMinute: counters.minute.count,
        messagesThisHour: counters.hour.count,
        messagesThisDay: counters.day.count,
        minuteLimit,
        hourLimit,
        dayLimit,
        isLimited,
        limitType,
        nextAllowedTime,
        burstCount: counters.burst.count,
        burstLimit: config?.burst_limit || 0,
        burstWindowEnd: counters.burst.windowEnd,
        inCooldown,
        cooldownEnd: counters.cooldown?.until,
        successRate: counters.successRate || 1,
        adaptiveMultiplier: 1
      };
    });
    setRateLimitStatus(next);
  }, [messageCounts, activeConfigs]);
  
  const canSendMessage = useCallback((scope: string, targetId?: string) => {
    const key = getKey(scope, targetId);
    const status = rateLimitStatus[key];
    if (!status) return true;
    return !status.isLimited;
  }, [rateLimitStatus, getKey]);
  
  const recordMessageSent = useCallback(async (scope: string, targetId?: string, success: boolean = true) => {
    const key = getKey(scope, targetId);
    const counters = messageCounts[key] || {
      minute: { count: 0, resetAt: new Date(new Date().getTime() + 60000) },
      hour: { count: 0, resetAt: new Date(new Date().getTime() + 3600000) },
      day: { count: 0, resetAt: new Date(new Date().setHours(23, 59, 59, 999)) },
      burst: { count: 0, windowEnd: new Date(new Date().getTime() + 60000) },
    };
    
    counters.minute.count += 1;
    counters.hour.count += 1;
    counters.day.count += 1;
    counters.burst.count += 1;
    counters.successRate = (counters.successRate || 1) * (success ? 1.01 : 0.99);
    
    setMessageCounts(prev => ({ ...prev, [key]: counters }));
    await refreshStatus();
  }, [messageCounts, refreshStatus, getKey]);
  
  const resetExpiredCounters = useCallback((key: string) => {
    const counters = messageCounts[key];
    if (!counters) return;
    const now = new Date();
    
    if (now > counters.minute.resetAt) counters.minute = { count: 0, resetAt: new Date(now.getTime() + 60000) };
    if (now > counters.hour.resetAt) counters.hour = { count: 0, resetAt: new Date(now.getTime() + 3600000) };
    if (now > counters.day.resetAt) counters.day = { count: 0, resetAt: new Date(now.setHours(23, 59, 59, 999)) };
    if (now > counters.burst.windowEnd) counters.burst = { count: 0, windowEnd: new Date(now.getTime() + 60000) };
  }, [messageCounts]);
  
  const getRemainingQuota = useCallback((scope: string, targetId?: string) => {
    const key = getKey(scope, targetId);
    const status = rateLimitStatus[key];
    if (!status) return { minute: Infinity, hour: Infinity, day: Infinity };
    return {
      minute: Math.max(0, status.minuteLimit - status.messagesThisMinute),
      hour: Math.max(0, status.hourLimit - status.messagesThisHour),
      day: Math.max(0, status.dayLimit - status.messagesThisDay),
    };
  }, [rateLimitStatus, getKey]);
  
  const getNextAllowedTime = useCallback((scope: string, targetId?: string) => {
    const key = getKey(scope, targetId);
    const status = rateLimitStatus[key];
    if (!status) return null;
    return status.nextAllowedTime || null;
  }, [rateLimitStatus, getKey]);
  
  const getStatus = useCallback((scope: string, targetId?: string) => {
    const key = getKey(scope, targetId);
    return rateLimitStatus[key] || null;
  }, [rateLimitStatus, getKey]);
  
  const activateConfig = useCallback(async (id: string) => {
    try {
      const { error } = await supabase.from('rate_limit_configs').update({ is_active: true }).eq('id', id);
      if (error) throw error;
      await fetchConfigs();
      return true;
    } catch (err) {
      console.error('Erro ao ativar config:', err);
      toast({ title: 'Erro ao ativar config', description: (err as any)?.message || 'Falha ao ativar', variant: 'destructive' });
      return false;
    }
  }, [fetchConfigs, toast]);
  
  const deactivateConfig = useCallback(async (id: string) => {
    try {
      const { error } = await supabase.from('rate_limit_configs').update({ is_active: false }).eq('id', id);
      if (error) throw error;
      await fetchConfigs();
      return true;
    } catch (err) {
      console.error('Erro ao desativar config:', err);
      toast({ title: 'Erro ao desativar config', description: (err as any)?.message || 'Falha ao desativar', variant: 'destructive' });
      return false;
    }
  }, [fetchConfigs, toast]);
  
  // Sanitize input to only known DB columns (ignore UI-only fields)
  const mapToDbFields = useCallback((config: Partial<RateLimitConfig>) => ({
    name: config.name,
    description: config.description,
    is_active: config.is_active,
    scope: config.scope,
    target_id: config.target_id,
    messages_per_minute: config.messages_per_minute,
    messages_per_hour: config.messages_per_hour,
    messages_per_day: config.messages_per_day,
    burst_limit: config.burst_limit,
    burst_window_seconds: config.burst_window_seconds,
    cooldown_after_limit: config.cooldown_after_limit,
    cooldown_duration_minutes: config.cooldown_duration_minutes,
    allowed_hours_start: config.allowed_hours_start,
    allowed_hours_end: config.allowed_hours_end,
    allowed_days: config.allowed_days,
    timezone: config.timezone,
    adaptive_rate_limiting: config.adaptive_rate_limiting,
    success_rate_threshold: config.success_rate_threshold,
    rate_increase_factor: config.rate_increase_factor,
    rate_decrease_factor: config.rate_decrease_factor,
  }), []);
  
  const validateConfig = useCallback((config: Partial<RateLimitConfig>): string[] => {
    const errors: string[] = [];
    // Required fields
    if (!config.name || String(config.name).trim().length === 0) {
      errors.push('Nome da configuração é obrigatório');
    }
    if (!config.scope) {
      errors.push('Escopo é obrigatório');
    }
    if (config.scope && config.scope !== 'global' && !config.target_id) {
      errors.push('É necessário definir target_id para escopos de instância ou campanha');
    }
    // Numeric validations
    const mustBeNonNegative = [
      { key: 'messages_per_minute', val: config.messages_per_minute },
      { key: 'messages_per_hour', val: config.messages_per_hour },
      { key: 'messages_per_day', val: config.messages_per_day },
      { key: 'burst_limit', val: config.burst_limit },
      { key: 'burst_window_seconds', val: config.burst_window_seconds },
      { key: 'cooldown_duration_minutes', val: config.cooldown_duration_minutes },
      { key: 'success_rate_threshold', val: config.success_rate_threshold },
      { key: 'rate_increase_factor', val: config.rate_increase_factor },
      { key: 'rate_decrease_factor', val: config.rate_decrease_factor },
    ];
    mustBeNonNegative.forEach(({ key, val }) => {
      if (val !== undefined && val !== null) {
        const num = Number(val);
        if (!Number.isFinite(num) || num < 0) {
          errors.push(`Campo ${key} deve ser um número não negativo`);
        }
      }
    });
    // Allowed hours format
    const timeRegex = /^\d{2}:\d{2}$/;
    if (config.allowed_hours_start && !timeRegex.test(String(config.allowed_hours_start))) {
      errors.push('Formato de hora inicial inválido (use HH:MM)');
    }
    if (config.allowed_hours_end && !timeRegex.test(String(config.allowed_hours_end))) {
      errors.push('Formato de hora final inválido (use HH:MM)');
    }
    if (config.allowed_hours_start && config.allowed_hours_end) {
      // simple lexical comparison works for HH:MM
      if (String(config.allowed_hours_start) > String(config.allowed_hours_end)) {
        errors.push('Hora inicial deve ser menor ou igual à hora final');
      }
    }
    // Allowed days array
    if (config.allowed_days && !Array.isArray(config.allowed_days)) {
      errors.push('Dias permitidos deve ser uma lista');
    }
    return errors;
  }, []);
  
  const createConfig = useCallback(async (configData: Partial<RateLimitConfig>) => {
    const errors = validateConfig(configData);
    if (errors.length) {
      toast({ title: 'Configuração inválida', description: errors.join('\n'), variant: 'destructive' });
      return null;
    }
    try {
      const { data, error } = await supabase
        .from('rate_limit_configs')
        .insert([{ ...mapToDbFields(configData), tenant_id: currentTenant?.id }])
        .select('*')
        .single();
      if (error) throw error;
      await fetchConfigs();
      return data as RateLimitConfig;
    } catch (err) {
      console.error('Erro ao criar config:', err);
      toast({ title: 'Erro ao criar config', description: (err as any)?.message || 'Falha ao criar', variant: 'destructive' });
      return null;
    }
  }, [currentTenant?.id, fetchConfigs, validateConfig, toast, mapToDbFields]);
  
  const updateConfig = useCallback(async (id: string, updates: Partial<RateLimitConfig>) => {
    const errors = validateConfig(updates);
    if (errors.length) {
      toast({ title: 'Atualização inválida', description: errors.join('\n'), variant: 'destructive' });
      return false;
    }
    try {
      const { error } = await supabase.from('rate_limit_configs').update(mapToDbFields(updates)).eq('id', id);
      if (error) throw error;
      await fetchConfigs();
      return true;
    } catch (err) {
      console.error('Erro ao atualizar config:', err);
      toast({ title: 'Erro ao atualizar config', description: (err as any)?.message || 'Falha ao atualizar', variant: 'destructive' });
      return false;
    }
  }, [fetchConfigs, validateConfig, toast, mapToDbFields]);
  
  const deleteConfig = useCallback(async (id: string) => {
    try {
      const { error } = await supabase.from('rate_limit_configs').delete().eq('id', id);
      if (error) throw error;
      await fetchConfigs();
      return true;
    } catch (err) {
      console.error('Erro ao excluir config:', err);
      toast({ title: 'Erro ao excluir config', description: (err as any)?.message || 'Falha ao excluir', variant: 'destructive' });
      return false;
    }
  }, [fetchConfigs, toast]);
  
  // Calculate adaptive rate
  const calculateAdaptiveRate = useCallback((configId: string, successRate: number): number => {
    const config = configs.find(c => c.id === configId);
    if (!config || !config.adaptive_rate_limiting) return 1;

    if (successRate >= config.success_rate_threshold) {
      return Math.min(2, 1 + config.rate_increase_factor);
    } else {
      return Math.max(0.1, 1 - config.rate_decrease_factor);
    }
  }, [configs]);
  
  // Check if within allowed hours
  const isWithinAllowedHours = useCallback((configId: string): boolean => {
    const config = configs.find(c => c.id === configId);
    if (!config) return true;

    const now = new Date();
    const currentDay = now.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
    
    // Check if current day is allowed
    if (config.allowed_days.length > 0 && !config.allowed_days.includes(currentDay)) {
      return false;
    }

    // Check if current time is within allowed hours
    if (config.allowed_hours_start && config.allowed_hours_end) {
      const currentTime = now.toTimeString().slice(0, 5); // HH:MM format
      return currentTime >= config.allowed_hours_start && currentTime <= config.allowed_hours_end;
    }

    return true;
  }, [configs]);
  
  // Refresh data
  const refreshData = useCallback(async () => {
    await fetchConfigs();
  }, [fetchConfigs]);

  // Build legacy array for UI compatibility
  const rateLimitStatuses = Object.entries(rateLimitStatus).map(([key, s]) => ({
    id: key,
    config_id: s.configId,
    instance_id: s.targetId,
    is_blocked: s.isLimited,
    messages_sent_minute: s.messagesThisMinute,
    messages_sent_hour: s.messagesThisHour,
    messages_sent_day: s.messagesThisDay,
    minute_limit: s.minuteLimit,
    hour_limit: s.hourLimit,
    day_limit: s.dayLimit,
    next_allowed_time: s.nextAllowedTime || null,
  }));

  // Cleanup expired counters periodically (skip in tests)
  useEffect(() => {
    if (isTestEnv) return; // avoid timers during tests

    const interval = setInterval(() => {
      Object.keys(messageCounts).forEach(key => {
        resetExpiredCounters(key);
      });
    }, 60000); // Check every minute

    return () => clearInterval(interval);
  }, [messageCounts, resetExpiredCounters]);

  // Initial load (skip in tests)
  useEffect(() => {
    if (isTestEnv) return;
    if (currentTenant?.id) {
      refreshData();
    }
  }, [currentTenant?.id, refreshData]);

  return {
    configs,
    activeConfigs,
    rateLimitStatus,
    rateLimitStatuses,
    isLoading,
    error,
    createConfig,
    updateConfig,
    deleteConfig,
    activateConfig,
    deactivateConfig,
    canSendMessage,
    recordMessageSent,
    getRemainingQuota,
    getNextAllowedTime,
    getStatus,
    refreshStatus,
    validateConfig,
    calculateAdaptiveRate,
    isWithinAllowedHours,
    refreshData
  };
};