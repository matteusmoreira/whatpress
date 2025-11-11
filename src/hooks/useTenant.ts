import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';

export interface Tenant {
  id: string;
  name: string;
  domain?: string;
  plan: 'starter' | 'pro' | 'enterprise';
  status: 'active' | 'suspended';
  created_at: string;
  updated_at: string;
}

export interface UseTenantReturn {
  currentTenant: Tenant | null;
  tenants: Tenant[];
  loading: boolean;
  error: string | null;
  switchTenant: (tenantId: string) => Promise<void>;
  refreshTenants: () => Promise<void>;
}

const STORAGE_KEY = 'selected_tenant_id';

export const useTenant = (): UseTenantReturn => {
  const { user } = useAuth();
  const [currentTenant, setCurrentTenant] = useState<Tenant | null>(null);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Buscar tenants do usuário com fallback robusto
  const fetchTenants = useCallback(async () => {
    if (!user?.id) {
      setTenants([]);
      setCurrentTenant(null);
      setLoading(false);
      return;
    }

    try {
      setError(null);

      // 1) Tentativa principal: join via PostgREST (user_tenants -> tenants)
      const { data: userTenants, error: userTenantsError } = await supabase
        .from('user_tenants')
        .select(`
          tenant_id,
          role,
          tenants (
            id,
            name,
            domain,
            plan,
            status,
            created_at,
            updated_at
          )
        `)
        .eq('user_id', user.id);

      let tenantsData: Tenant[] = [];

      if (!userTenantsError && userTenants) {
        tenantsData = (userTenants
          ?.map(ut => ut.tenants)
          .filter(Boolean) as Tenant[]) || [];
      } else {
        // 2) Fallback: buscar apenas os IDs em user_tenants e depois buscar na tabela tenants com in()
        console.warn('Join user_tenants -> tenants falhou, aplicando fallback de duas etapas:', userTenantsError);

        const { data: utIds, error: utIdsError } = await supabase
          .from('user_tenants')
          .select('tenant_id')
          .eq('user_id', user.id);

        if (utIdsError) {
          console.error('Fallback etapa 1 (IDs) falhou:', utIdsError);
          tenantsData = [];
        } else {
          const tenantIds = (utIds || []).map((r: { tenant_id: string }) => r.tenant_id).filter(Boolean);

          if (tenantIds.length > 0) {
            const { data: tenantsRows, error: tenantsError } = await supabase
              .from('tenants')
              .select('id, name, domain, plan, status, created_at, updated_at')
              .in('id', tenantIds);

            if (tenantsError) {
              console.error('Fallback etapa 2 (fetch tenants) falhou:', tenantsError);
              tenantsData = [];
            } else {
              tenantsData = tenantsRows || [];
            }
          } else {
            tenantsData = [];
          }
        }
      }

      setTenants(tenantsData);

      // Definir tenant atual
      const savedTenantId = localStorage.getItem(STORAGE_KEY);
      let selectedTenant: Tenant | null = null;

      if (savedTenantId) {
        selectedTenant = tenantsData.find(t => t.id === savedTenantId) || null;
      }

      // Se não encontrou o tenant salvo ou não há tenant salvo, usar o primeiro
      if (!selectedTenant && tenantsData.length > 0) {
        selectedTenant = tenantsData[0] || null;
        if (selectedTenant?.id) {
          localStorage.setItem(STORAGE_KEY, selectedTenant.id);
        }
      }

      setCurrentTenant(selectedTenant || null);

    } catch (err) {
      console.error('Erro ao buscar tenants:', err);
      // Degradação segura: não propagar erro, apenas sinalizar e liberar UI
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
      setTenants([]);
      setCurrentTenant(null);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  // Trocar tenant atual
  const switchTenant = useCallback(async (tenantId: string) => {
    const tenant = tenants.find(t => t.id === tenantId);
    if (!tenant) {
      throw new Error('Tenant não encontrado');
    }

    setCurrentTenant(tenant);
    localStorage.setItem(STORAGE_KEY, tenantId);
    if (typeof window !== 'undefined') {
      try {
        window.dispatchEvent(new CustomEvent('tenant:changed', { detail: tenantId }));
      } catch {}
    }
  }, [tenants]);

  // Recarregar tenants
  const refreshTenants = useCallback(async () => {
    setLoading(true);
    await fetchTenants();
  }, [fetchTenants]);

  // Carregar tenants quando o usuário mudar
  useEffect(() => {
    fetchTenants();
  }, [fetchTenants]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) {
        const id = e.newValue || '';
        const found = tenants.find(t => t.id === id) || null;
        setCurrentTenant(found);
      }
    };
    const onChanged = (e: Event) => {
      try {
        const id = (e as CustomEvent<string>).detail;
        const found = tenants.find(t => t.id === id) || null;
        setCurrentTenant(found);
      } catch {}
    };
    window.addEventListener('storage', onStorage);
    window.addEventListener('tenant:changed', onChanged as EventListener);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('tenant:changed', onChanged as EventListener);
    };
  }, [tenants]);

  return {
    currentTenant,
    tenants,
    loading,
    error,
    switchTenant,
    refreshTenants
  };
};