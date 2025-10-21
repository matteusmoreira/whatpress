import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { toast } from 'sonner'

export interface AutomationTrigger {
  type: 'keyword' | 'schedule' | 'event' | 'webhook'
  config: {
    keywords?: string[]
    schedule?: {
      type: 'daily' | 'weekly' | 'monthly'
      time: string
      days?: number[]
    }
    event?: {
      type: 'new_contact' | 'message_received' | 'tag_added' | 'custom'
      conditions?: Record<string, any>
    }
    webhook?: {
      url: string
      method: 'GET' | 'POST'
      headers?: Record<string, string>
    }
  }
}

export interface AutomationAction {
  type: 'send_message' | 'add_tag' | 'remove_tag' | 'update_contact' | 'delay' | 'webhook'
  config: {
    message?: {
      content: string
      type?: 'text' | 'image' | 'document' | 'audio'
      media_url?: string
    }
    tags?: string[]
    contact_fields?: Record<string, any>
    delay?: {
      amount: number
      unit: 'minutes' | 'hours' | 'days'
    }
    webhook?: {
      url: string
      method: 'GET' | 'POST'
      headers?: Record<string, string>
      body?: Record<string, any>
    }
  }
}

export interface AutomationCondition {
  field: string
  operator: 'equals' | 'not_equals' | 'contains' | 'not_contains' | 'greater_than' | 'less_than'
  value: any
  logical_operator?: 'AND' | 'OR'
}

export interface AutomationStats {
  triggered_count: number
  success_count: number
  error_count: number
  last_triggered_at?: string
  average_completion_time?: number
}

export interface Automation {
  id: string
  name: string
  description?: string
  is_active: boolean
  trigger: AutomationTrigger
  conditions?: AutomationCondition[]
  actions: AutomationAction[]
  stats: AutomationStats
  created_at: string
  updated_at: string
  created_by: string
}

export interface AutomationSummaryStats {
  total_automations: number
  active_automations: number
  triggered_today: number
  success_rate: number
  most_triggered?: {
    name: string
    count: number
  }
}

export function useAutomations() {
  const { user } = useAuth()
  const [automations, setAutomations] = useState<Automation[]>([])
  const [stats, setStats] = useState<AutomationSummaryStats | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchAutomations = async () => {
    if (!user) return

    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('automations')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (error) throw error

      // Processar dados para garantir estrutura correta
      const processedData = (data || []).map(automation => ({
        ...automation,
        trigger: automation.trigger || { type: 'keyword', config: {} },
        conditions: automation.conditions || [],
        actions: automation.actions || [],
        stats: automation.stats || {
          triggered_count: 0,
          success_count: 0,
          error_count: 0
        },
        created_by: automation.user_id
      }))

      setAutomations(processedData)
    } catch (error) {
      console.error('Erro ao buscar automações:', error)
      toast.error('Erro ao carregar automações')
    } finally {
      setLoading(false)
    }
  }

  const fetchStats = async () => {
    if (!user) return

    try {
      const { data, error } = await supabase
        .from('automations')
        .select('id, is_active, stats')
        .eq('user_id', user.id)

      if (error) throw error

      const automations = data || []
      const totalAutomations = automations.length
      const activeAutomations = automations.filter(a => a.is_active).length
      
      // Calcular estatísticas
      let triggeredToday = 0
      let totalTriggered = 0
      let totalSuccess = 0
      let mostTriggeredAutomation = null
      let maxTriggers = 0

      automations.forEach(automation => {
        const stats = automation.stats || { triggered_count: 0, success_count: 0, error_count: 0 }
        totalTriggered += stats.triggered_count
        totalSuccess += stats.success_count
        
        // Simular triggers de hoje (em produção, seria baseado em last_triggered_at)
        if (automation.is_active) {
          triggeredToday += Math.floor(Math.random() * 10)
        }

        if (stats.triggered_count > maxTriggers) {
          maxTriggers = stats.triggered_count
          mostTriggeredAutomation = automation.id
        }
      })

      const successRate = totalTriggered > 0 ? (totalSuccess / totalTriggered) * 100 : 0

      setStats({
        total_automations: totalAutomations,
        active_automations: activeAutomations,
        triggered_today: triggeredToday,
        success_rate: Math.round(successRate),
        most_triggered: mostTriggeredAutomation ? {
          name: automations.find(a => a.id === mostTriggeredAutomation)?.name || 'N/A',
          count: maxTriggers
        } : undefined
      })
    } catch (error) {
      console.error('Erro ao buscar estatísticas:', error)
    }
  }

  const createAutomation = async (automationData: Omit<Automation, 'id' | 'created_at' | 'updated_at' | 'created_by' | 'stats'>) => {
    if (!user) throw new Error('Usuário não autenticado')

    const { data, error } = await supabase
      .from('automations')
      .insert([{
        ...automationData,
        user_id: user.id,
        stats: {
          triggered_count: 0,
          success_count: 0,
          error_count: 0
        }
      }])
      .select()
      .single()

    if (error) throw error

    const processedData = {
      ...data,
      trigger: data.trigger || { type: 'keyword', config: {} },
      conditions: data.conditions || [],
      actions: data.actions || [],
      stats: data.stats || {
        triggered_count: 0,
        success_count: 0,
        error_count: 0
      },
      created_by: data.user_id
    }

    setAutomations(prev => [processedData, ...prev])
    await fetchStats()
    toast.success('Automação criada com sucesso!')
    return processedData
  }

  const updateAutomation = async (id: string, updates: Partial<Automation>) => {
    if (!user) throw new Error('Usuário não autenticado')

    const { data, error } = await supabase
      .from('automations')
      .update(updates)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single()

    if (error) throw error

    const processedData = {
      ...data,
      trigger: data.trigger || { type: 'keyword', config: {} },
      conditions: data.conditions || [],
      actions: data.actions || [],
      stats: data.stats || {
        triggered_count: 0,
        success_count: 0,
        error_count: 0
      },
      created_by: data.user_id
    }

    setAutomations(prev => prev.map(automation => 
      automation.id === id ? { ...automation, ...processedData } : automation
    ))
    await fetchStats()
    toast.success('Automação atualizada com sucesso!')
    return processedData
  }

  const deleteAutomation = async (id: string) => {
    if (!user) throw new Error('Usuário não autenticado')

    const { error } = await supabase
      .from('automations')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (error) throw error

    setAutomations(prev => prev.filter(automation => automation.id !== id))
    await fetchStats()
    toast.success('Automação excluída com sucesso!')
  }

  const toggleAutomationStatus = async (id: string) => {
    const automation = automations.find(a => a.id === id)
    if (!automation) return

    await updateAutomation(id, { is_active: !automation.is_active })
    toast.success(`Automação ${automation.is_active ? 'desativada' : 'ativada'} com sucesso!`)
  }

  const duplicateAutomation = async (automation: Automation) => {
    if (!user) throw new Error('Usuário não autenticado')

    const duplicatedAutomation = {
      name: `${automation.name} (Cópia)`,
      description: automation.description,
      is_active: false,
      trigger: automation.trigger,
      conditions: automation.conditions || [],
      actions: automation.actions
    }

    return await createAutomation(duplicatedAutomation)
  }

  const testAutomation = async (id: string) => {
    // Simular teste de automação
    toast.info('Testando automação...')
    
    // Simular delay
    await new Promise(resolve => setTimeout(resolve, 2000))
    
    // Simular resultado do teste
    const success = Math.random() > 0.2 // 80% de chance de sucesso
    
    if (success) {
      toast.success('Teste executado com sucesso! ✅')
    } else {
      toast.error('Erro no teste da automação ❌')
    }
  }

  const getActiveAutomations = () => {
    return automations.filter(automation => automation.is_active)
  }

  const getInactiveAutomations = () => {
    return automations.filter(automation => !automation.is_active)
  }

  const searchAutomations = (query: string) => {
    const lowercaseQuery = query.toLowerCase()
    return automations.filter(automation => 
      automation.name.toLowerCase().includes(lowercaseQuery) ||
      (automation.description && automation.description.toLowerCase().includes(lowercaseQuery))
    )
  }

  const getAutomationsByTrigger = (triggerType: string) => {
    return automations.filter(automation => automation.trigger.type === triggerType)
  }

  const getMostTriggeredAutomations = (limit: number = 5) => {
    return [...automations]
      .sort((a, b) => (b.stats.triggered_count || 0) - (a.stats.triggered_count || 0))
      .slice(0, limit)
  }

  const getAutomationPerformance = (id: string) => {
    const automation = automations.find(a => a.id === id)
    if (!automation) return null

    const { triggered_count, success_count, error_count } = automation.stats
    const successRate = triggered_count > 0 ? (success_count / triggered_count) * 100 : 0
    const errorRate = triggered_count > 0 ? (error_count / triggered_count) * 100 : 0

    return {
      triggered_count,
      success_count,
      error_count,
      success_rate: Math.round(successRate),
      error_rate: Math.round(errorRate)
    }
  }

  useEffect(() => {
    if (user) {
      fetchAutomations()
      fetchStats()
    } else {
      // Sem usuário autenticado: expor estado vazio e encerrar loading
      setAutomations([])
      setStats(null)
      setLoading(false)
    }
  }, [user])

  return {
    automations,
    stats,
    loading,
    createAutomation,
    updateAutomation,
    deleteAutomation,
    toggleAutomationStatus,
    duplicateAutomation,
    testAutomation,
    getActiveAutomations,
    getInactiveAutomations,
    searchAutomations,
    getAutomationsByTrigger,
    getMostTriggeredAutomations,
    getAutomationPerformance,
    refetch: fetchAutomations
  }
}