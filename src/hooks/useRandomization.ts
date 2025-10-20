import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useTenant } from './useTenant';
import { useToast } from '@/hooks/use-toast';

export interface RandomizationProfile {
  id: string;
  tenant_id: string;
  name: string;
  description?: string;
  is_active: boolean;
  
  // Delay Randomization
  min_delay_seconds: number;
  max_delay_seconds: number;
  delay_distribution: 'uniform' | 'normal' | 'exponential';
  
  // Template Rotation
  template_rotation_enabled: boolean;
  template_selection_strategy: 'random' | 'sequential' | 'weighted';
  
  // Contact Shuffling
  contact_shuffle_enabled: boolean;
  shuffle_strategy: 'random' | 'priority_based' | 'time_based';
  
  // Human Simulation
  human_simulation_enabled: boolean;
  typing_delay_enabled: boolean;
  read_receipt_delay: boolean;
  online_status_simulation: boolean;
  
  // Anti-Detection
  burst_prevention: boolean;
  max_messages_per_burst: number;
  burst_cooldown_minutes: number;
  
  // Working Hours
  respect_working_hours: boolean;
  working_hours_start: string;
  working_hours_end: string;
  working_days: string[];
  timezone: string;
  
  created_at: string;
  updated_at: string;
}

export interface RandomizationSettings {
  delay: {
    min: number;
    max: number;
    distribution: 'uniform' | 'normal' | 'exponential';
  };
  templates: {
    enabled: boolean;
    strategy: 'random' | 'sequential' | 'weighted';
    weights?: Record<string, number>;
  };
  contacts: {
    shuffle: boolean;
    strategy: 'random' | 'priority_based' | 'time_based';
  };
  humanSimulation: {
    enabled: boolean;
    typingDelay: boolean;
    readReceipt: boolean;
    onlineStatus: boolean;
  };
  antiDetection: {
    burstPrevention: boolean;
    maxPerBurst: number;
    cooldownMinutes: number;
  };
  workingHours: {
    enabled: boolean;
    start: string;
    end: string;
    days: string[];
    timezone: string;
  };
}

interface UseRandomizationReturn {
  profiles: RandomizationProfile[];
  activeProfile: RandomizationProfile | null;
  isLoading: boolean;
  error: string | null;
  
  // Profile Management
  createProfile: (profileData: Partial<RandomizationProfile>) => Promise<RandomizationProfile | null>;
  updateProfile: (id: string, updates: Partial<RandomizationProfile>) => Promise<boolean>;
  deleteProfile: (id: string) => Promise<boolean>;
  setActiveProfile: (id: string) => Promise<boolean>;
  
  // Randomization Logic
  calculateDelay: (profileId?: string) => number;
  selectTemplate: (templates: any[], profileId?: string) => any;
  shuffleContacts: (contacts: any[], profileId?: string) => any[];
  shouldRespectWorkingHours: (profileId?: string) => boolean;
  isWithinWorkingHours: (profileId?: string) => boolean;
  
  // Anti-Detection
  canSendMessage: (profileId?: string) => boolean;
  recordMessageSent: (profileId?: string) => void;
  
  // Utilities
  applyRandomization: (messageData: any, profileId?: string) => any;
  validateProfile: (profile: Partial<RandomizationProfile>) => string[];
  refreshData: () => Promise<void>;
}

export const useRandomization = (): UseRandomizationReturn => {
  const { currentTenant } = useTenant();
  const { toast } = useToast();
  
  const [profiles, setProfiles] = useState<RandomizationProfile[]>([]);
  const [activeProfile, setActiveProfileState] = useState<RandomizationProfile | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Track message bursts for anti-detection
  const [messageBursts, setMessageBursts] = useState<Record<string, { count: number; lastReset: number }>>({});

  // Fetch profiles
  const fetchProfiles = useCallback(async () => {
    if (!currentTenant?.id) return;

    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('randomization_profiles')
        .select('*')
        .eq('tenant_id', currentTenant.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      setProfiles(data || []);
      
      // Set active profile
      const active = data?.find(p => p.is_active);
      setActiveProfileState(active || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar perfis de randomização');
      toast({
        title: "Erro",
        description: "Falha ao carregar perfis de randomização",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  }, [currentTenant?.id, toast]);

  // Create profile
  const createProfile = useCallback(async (profileData: Partial<RandomizationProfile>): Promise<RandomizationProfile | null> => {
    if (!currentTenant?.id) return null;

    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('randomization_profiles')
        .insert({
          ...profileData,
          tenant_id: currentTenant.id,
          is_active: false // New profiles start inactive
        })
        .select()
        .single();

      if (error) throw error;

      setProfiles(prev => [data, ...prev]);
      toast({
        title: "Sucesso",
        description: "Perfil de randomização criado com sucesso"
      });

      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar perfil');
      toast({
        title: "Erro",
        description: "Falha ao criar perfil de randomização",
        variant: "destructive"
      });
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [currentTenant?.id, toast]);

  // Update profile
  const updateProfile = useCallback(async (id: string, updates: Partial<RandomizationProfile>): Promise<boolean> => {
    try {
      setIsLoading(true);
      const { error } = await supabase
        .from('randomization_profiles')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .eq('tenant_id', currentTenant?.id);

      if (error) throw error;

      setProfiles(prev => prev.map(profile => 
        profile.id === id ? { ...profile, ...updates } : profile
      ));

      // Update active profile if it's the one being updated
      if (activeProfile?.id === id) {
        setActiveProfileState(prev => prev ? { ...prev, ...updates } : null);
      }

      toast({
        title: "Sucesso",
        description: "Perfil atualizado com sucesso"
      });

      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao atualizar perfil');
      toast({
        title: "Erro",
        description: "Falha ao atualizar perfil",
        variant: "destructive"
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [currentTenant?.id, activeProfile?.id, toast]);

  // Delete profile
  const deleteProfile = useCallback(async (id: string): Promise<boolean> => {
    try {
      setIsLoading(true);
      const { error } = await supabase
        .from('randomization_profiles')
        .delete()
        .eq('id', id)
        .eq('tenant_id', currentTenant?.id);

      if (error) throw error;

      setProfiles(prev => prev.filter(profile => profile.id !== id));
      
      // Clear active profile if it was deleted
      if (activeProfile?.id === id) {
        setActiveProfileState(null);
      }

      toast({
        title: "Sucesso",
        description: "Perfil excluído com sucesso"
      });

      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao excluir perfil');
      toast({
        title: "Erro",
        description: "Falha ao excluir perfil",
        variant: "destructive"
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [currentTenant?.id, activeProfile?.id, toast]);

  // Set active profile
  const setActiveProfile = useCallback(async (id: string): Promise<boolean> => {
    try {
      // Deactivate all profiles first
      const { error: deactivateError } = await supabase
        .from('randomization_profiles')
        .update({ is_active: false })
        .eq('tenant_id', currentTenant?.id);

      if (deactivateError) throw deactivateError;

      // Activate selected profile
      const { error: activateError } = await supabase
        .from('randomization_profiles')
        .update({ is_active: true })
        .eq('id', id)
        .eq('tenant_id', currentTenant?.id);

      if (activateError) throw activateError;

      // Update local state
      setProfiles(prev => prev.map(profile => ({
        ...profile,
        is_active: profile.id === id
      })));

      const newActiveProfile = profiles.find(p => p.id === id);
      setActiveProfileState(newActiveProfile || null);

      toast({
        title: "Sucesso",
        description: "Perfil ativo alterado com sucesso"
      });

      return true;
    } catch (err) {
      toast({
        title: "Erro",
        description: "Falha ao alterar perfil ativo",
        variant: "destructive"
      });
      return false;
    }
  }, [currentTenant?.id, profiles, toast]);

  // Calculate delay based on profile settings
  const calculateDelay = useCallback((profileId?: string): number => {
    const profile = profileId ? 
      profiles.find(p => p.id === profileId) : 
      activeProfile;

    if (!profile) return 1000; // Default 1 second

    const { min_delay_seconds, max_delay_seconds, delay_distribution } = profile;
    const minMs = min_delay_seconds * 1000;
    const maxMs = max_delay_seconds * 1000;

    switch (delay_distribution) {
      case 'uniform':
        return Math.random() * (maxMs - minMs) + minMs;
      
      case 'normal':
        // Box-Muller transform for normal distribution
        const u1 = Math.random();
        const u2 = Math.random();
        const z0 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
        const mean = (minMs + maxMs) / 2;
        const stdDev = (maxMs - minMs) / 6; // 99.7% within range
        return Math.max(minMs, Math.min(maxMs, mean + z0 * stdDev));
      
      case 'exponential':
        const lambda = 1 / ((minMs + maxMs) / 2);
        return Math.max(minMs, Math.min(maxMs, -Math.log(Math.random()) / lambda));
      
      default:
        return Math.random() * (maxMs - minMs) + minMs;
    }
  }, [profiles, activeProfile]);

  // Select template based on strategy
  const selectTemplate = useCallback((templates: any[], profileId?: string): any => {
    if (!templates || templates.length === 0) return null;
    if (templates.length === 1) return templates[0];

    const profile = profileId ? 
      profiles.find(p => p.id === profileId) : 
      activeProfile;

    if (!profile || !profile.template_rotation_enabled) {
      return templates[0]; // Return first template if rotation disabled
    }

    switch (profile.template_selection_strategy) {
      case 'random':
        return templates[Math.floor(Math.random() * templates.length)];
      
      case 'sequential':
        // Simple sequential selection (would need state management for real implementation)
        const index = Date.now() % templates.length;
        return templates[index];
      
      case 'weighted':
        // Weighted selection (would need weights configuration)
        return templates[Math.floor(Math.random() * templates.length)];
      
      default:
        return templates[Math.floor(Math.random() * templates.length)];
    }
  }, [profiles, activeProfile]);

  // Shuffle contacts based on strategy
  const shuffleContacts = useCallback((contacts: any[], profileId?: string): any[] => {
    if (!contacts || contacts.length <= 1) return contacts;

    const profile = profileId ? 
      profiles.find(p => p.id === profileId) : 
      activeProfile;

    if (!profile || !profile.contact_shuffle_enabled) {
      return contacts; // Return original order if shuffle disabled
    }

    const shuffled = [...contacts];

    switch (profile.shuffle_strategy) {
      case 'random':
        // Fisher-Yates shuffle
        for (let i = shuffled.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        break;
      
      case 'priority_based':
        // Sort by priority (assuming contacts have a priority field)
        shuffled.sort((a, b) => (b.priority || 0) - (a.priority || 0));
        break;
      
      case 'time_based':
        // Sort by last contact time or creation time
        shuffled.sort((a, b) => {
          const timeA = new Date(a.last_contact || a.created_at).getTime();
          const timeB = new Date(b.last_contact || b.created_at).getTime();
          return timeA - timeB; // Oldest first
        });
        break;
    }

    return shuffled;
  }, [profiles, activeProfile]);

  // Check if should respect working hours
  const shouldRespectWorkingHours = useCallback((profileId?: string): boolean => {
    const profile = profileId ? 
      profiles.find(p => p.id === profileId) : 
      activeProfile;

    return profile?.respect_working_hours || false;
  }, [profiles, activeProfile]);

  // Check if within working hours
  const isWithinWorkingHours = useCallback((profileId?: string): boolean => {
    const profile = profileId ? 
      profiles.find(p => p.id === profileId) : 
      activeProfile;

    if (!profile || !profile.respect_working_hours) return true;

    const now = new Date();
    const currentDay = now.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
    
    // Check if current day is a working day
    if (!profile.working_days.includes(currentDay)) return false;

    // Check if current time is within working hours
    const currentTime = now.toTimeString().slice(0, 5); // HH:MM format
    return currentTime >= profile.working_hours_start && currentTime <= profile.working_hours_end;
  }, [profiles, activeProfile]);

  // Check if can send message (anti-detection)
  const canSendMessage = useCallback((profileId?: string): boolean => {
    const profile = profileId ? 
      profiles.find(p => p.id === profileId) : 
      activeProfile;

    if (!profile || !profile.burst_prevention) return true;

    const burstKey = profileId || 'default';
    const burst = messageBursts[burstKey];
    
    if (!burst) return true;

    const now = Date.now();
    const cooldownMs = profile.burst_cooldown_minutes * 60 * 1000;
    
    // Reset burst count if cooldown period has passed
    if (now - burst.lastReset > cooldownMs) {
      setMessageBursts(prev => ({
        ...prev,
        [burstKey]: { count: 0, lastReset: now }
      }));
      return true;
    }

    return burst.count < profile.max_messages_per_burst;
  }, [profiles, activeProfile, messageBursts]);

  // Record message sent (for anti-detection)
  const recordMessageSent = useCallback((profileId?: string) => {
    const profile = profileId ? 
      profiles.find(p => p.id === profileId) : 
      activeProfile;

    if (!profile || !profile.burst_prevention) return;

    const burstKey = profileId || 'default';
    const now = Date.now();
    
    setMessageBursts(prev => {
      const current = prev[burstKey] || { count: 0, lastReset: now };
      return {
        ...prev,
        [burstKey]: {
          count: current.count + 1,
          lastReset: current.lastReset
        }
      };
    });
  }, [profiles, activeProfile]);

  // Apply randomization to message data
  const applyRandomization = useCallback((messageData: any, profileId?: string): any => {
    const profile = profileId ? 
      profiles.find(p => p.id === profileId) : 
      activeProfile;

    if (!profile) return messageData;

    const randomized = { ...messageData };

    // Apply delay
    randomized.delay = calculateDelay(profileId);

    // Apply human simulation
    if (profile.human_simulation_enabled) {
      randomized.humanSimulation = {
        typingDelay: profile.typing_delay_enabled,
        readReceipt: profile.read_receipt_delay,
        onlineStatus: profile.online_status_simulation
      };
    }

    // Add randomization metadata
    randomized.randomization = {
      profileId: profile.id,
      appliedAt: new Date().toISOString(),
      settings: {
        delay: randomized.delay,
        humanSimulation: randomized.humanSimulation
      }
    };

    return randomized;
  }, [profiles, activeProfile, calculateDelay]);

  // Validate profile data
  const validateProfile = useCallback((profile: Partial<RandomizationProfile>): string[] => {
    const errors: string[] = [];

    if (!profile.name?.trim()) {
      errors.push('Nome é obrigatório');
    }

    if (profile.min_delay_seconds !== undefined && profile.max_delay_seconds !== undefined) {
      if (profile.min_delay_seconds < 0) {
        errors.push('Delay mínimo deve ser maior ou igual a 0');
      }
      if (profile.max_delay_seconds < profile.min_delay_seconds) {
        errors.push('Delay máximo deve ser maior que o mínimo');
      }
    }

    if (profile.max_messages_per_burst !== undefined && profile.max_messages_per_burst < 1) {
      errors.push('Máximo de mensagens por rajada deve ser maior que 0');
    }

    if (profile.burst_cooldown_minutes !== undefined && profile.burst_cooldown_minutes < 1) {
      errors.push('Tempo de cooldown deve ser maior que 0');
    }

    if (profile.working_hours_start && profile.working_hours_end) {
      if (profile.working_hours_start >= profile.working_hours_end) {
        errors.push('Horário de início deve ser anterior ao horário de fim');
      }
    }

    return errors;
  }, []);

  // Refresh data
  const refreshData = useCallback(async () => {
    await fetchProfiles();
  }, [fetchProfiles]);

  // Initial load
  useEffect(() => {
    if (currentTenant?.id) {
      refreshData();
    }
  }, [currentTenant?.id, refreshData]);

  return {
    profiles,
    activeProfile,
    isLoading,
    error,
    createProfile,
    updateProfile,
    deleteProfile,
    setActiveProfile,
    calculateDelay,
    selectTemplate,
    shuffleContacts,
    shouldRespectWorkingHours,
    isWithinWorkingHours,
    canSendMessage,
    recordMessageSent,
    applyRandomization,
    validateProfile,
    refreshData
  };
};