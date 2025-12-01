import { useEffect, useMemo, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

export interface Tenant {
  id: string
  name: string
  domain?: string
  plan: 'starter' | 'pro' | 'enterprise'
  status: 'active' | 'suspended'
  created_at: string
  updated_at: string
}

export type TenantRole = 'SUPERADMIN' | 'ADMIN' | 'USER'

export interface UserTenant {
  id: string
  user_id: string
  tenant_id: string
  role: TenantRole
  status: 'active' | 'invited' | 'suspended'
  created_at: string
}

export interface TenantQuota {
  id: string
  tenant_id: string
  max_users: number
  max_instances: number
  max_campaigns: number
  max_messages_per_month: number
  used_messages_current_month: number
  reset_at?: string
  created_at: string
}

const STORAGE_KEY = 'selected_tenant_id'

export function useTenants() {
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [selectedTenantId, setSelectedTenantId] = useState<string | null>(
    typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null
  )

  const selectTenant = useCallback((tenantId: string) => {
    if (typeof window === 'undefined') return
    localStorage.setItem(STORAGE_KEY, tenantId)
    setSelectedTenantId(tenantId)
    try {
      window.dispatchEvent(new CustomEvent('tenant:changed', { detail: tenantId }))
    } catch { }
  }, [])

  const loadMyTenants = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Usuário não autenticado')

      const { data, error } = await supabase
        .from('user_tenants')
        .select(`
          id, role, status, created_at,
          tenants:tenants(*)
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (error) throw error

      const myTenants = (data || []).map((row: any) => row.tenants).filter(Boolean)
      setTenants(myTenants)

      // Auto-select first tenant if none selected
      if (!selectedTenantId && myTenants.length > 0) {
        localStorage.setItem(STORAGE_KEY, myTenants[0].id)
      }

      return myTenants as Tenant[]
    } catch (e: any) {
      console.error('Erro ao carregar tenants:', e)
      setError(e?.message || 'Erro ao carregar tenants')
      return []
    } finally {
      setLoading(false)
    }
  }, [selectedTenantId])

  const createTenant = useCallback(async (name: string, domain?: string, plan: Tenant['plan'] = 'starter') => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Usuário não autenticado')

    const { data: tenant, error } = await supabase
      .from('tenants')
      .insert({ name, domain, plan, status: 'active' })
      .select('*')
      .single()

    if (error) throw error
    let createdTenant = tenant as Tenant | null
    if (!createdTenant) {
      const { data: fetched } = await supabase
        .from('tenants')
        .select('*')
        .eq('name', name)
        .limit(1)
      if (Array.isArray(fetched) && fetched.length > 0) {
        createdTenant = fetched[0] as Tenant
      }
    }
    if (!createdTenant) throw new Error('Falha ao obter empresa criada')

    // Associate current user as SUPERADMIN of this tenant
    const { error: assocError } = await supabase
      .from('user_tenants')
      .insert({ user_id: user.id, tenant_id: createdTenant.id, role: 'SUPERADMIN', status: 'active' })

    if (assocError) {
      console.warn('Tenant criado, mas falha ao associar usuário:', assocError.message)
    }

    // Ensure quotas exist
    await supabase
      .from('tenant_quotas')
      .insert({ tenant_id: createdTenant.id })
      .select('*')

    // Select this tenant
    localStorage.setItem(STORAGE_KEY, createdTenant.id)

    // Refresh list
    await loadMyTenants()

    return createdTenant as Tenant
  }, [loadMyTenants])

  const assignUserToTenant = useCallback(async (userId: string, tenantId: string, role: TenantRole) => {
    const { error } = await supabase
      .from('user_tenants')
      .insert({ user_id: userId, tenant_id: tenantId, role, status: 'active' })

    if (error) throw error
  }, [])

  const getQuotas = useCallback(async (tenantId?: string) => {
    const targetId = tenantId || selectedTenantId
    if (!targetId) throw new Error('Tenant não selecionado')

    const { data, error } = await supabase
      .from('tenant_quotas')
      .select('*')
      .eq('tenant_id', targetId)
      .single()

    if (error) throw error
    return data as TenantQuota
  }, [selectedTenantId])

  const updateQuotas = useCallback(async (tenantId: string, quotas: Partial<TenantQuota>) => {
    const { error } = await supabase
      .from('tenant_quotas')
      .update(quotas)
      .eq('tenant_id', tenantId)

    if (error) throw error
  }, [])

  useEffect(() => {
    loadMyTenants()
  }, [loadMyTenants])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) {
        setSelectedTenantId(e.newValue)
      }
    }
    const onChanged = (e: Event) => {
      try {
        const id = (e as CustomEvent<string>).detail
        setSelectedTenantId(id)
      } catch { }
    }
    window.addEventListener('storage', onStorage)
    window.addEventListener('tenant:changed', onChanged as EventListener)
    return () => {
      window.removeEventListener('storage', onStorage)
      window.removeEventListener('tenant:changed', onChanged as EventListener)
    }
  }, [])

  return {
    tenants,
    selectedTenantId,
    selectTenant,
    loadMyTenants,
    createTenant,
    assignUserToTenant,
    getQuotas,
    updateQuotas,
    loading,
    error,
  }
}
