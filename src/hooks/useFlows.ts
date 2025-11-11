import { useState, useCallback, useEffect } from 'react'
import { useAuth } from './useAuth'
import { useTenant } from './useTenant'
import { useCache } from './useCache'
import { monitorFunction } from '@/lib/monitoring'
import { FlowEngine, Flow, FLOW_TEMPLATES, FLOW_STATUSES } from '@/lib/flows'
import { executeFlow, resumeFlowExecution, cancelFlowExecution } from '@/lib/flowExecution'
import { toast } from 'sonner'

interface UseFlowsOptions {
  enabled?: boolean
  refreshInterval?: number
}

interface UseFlowsReturn {
  flows: Flow[]
  isLoading: boolean
  error: string | null
  createFlow: (flowData: Omit<Flow, 'id' | 'createdAt' | 'updatedAt' | 'version'>) => Promise<Flow | null>
  updateFlow: (flowId: string, updates: Partial<Flow>) => Promise<Flow | null>
  deleteFlow: (flowId: string) => Promise<boolean>
  getFlow: (flowId: string) => Promise<Flow | null>
  executeFlow: (flowId: string, context?: Record<string, any>) => Promise<string | null>
  resumeFlow: (executionId: string) => Promise<boolean>
  cancelFlow: (executionId: string) => Promise<boolean>
  useTemplate: (templateKey: keyof typeof FLOW_TEMPLATES, customData?: Partial<Flow>) => Promise<Flow | null>
  validateFlow: (flow: Flow) => { valid: boolean; errors: string[] }
  importFlow: (flowData: any) => Promise<Flow | null>
  exportFlow: (flowId: string) => Promise<any | null>
  refetch: () => Promise<void>
}

export function useFlows(options: UseFlowsOptions = {}): UseFlowsReturn {
  const { user } = useAuth()
  const { tenant } = useTenant()
  const { get: getFromCache, set: setCache, del: deleteCache } = useCache()
  
  const [flows, setFlows] = useState<Flow[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const tenantId = tenant?.id
  const userId = user?.id

  const engine = tenantId ? new FlowEngine(tenantId) : null

  // Buscar fluxos
  const fetchFlows = useCallback(async () => {
    if (!engine || !options.enabled) return

    setIsLoading(true)
    setError(null)

    try {
      const cacheKey = `flows:${tenantId}:all`
      
      // Tentar obter do cache
      const cached = await getFromCache(cacheKey)
      if (cached) {
        setFlows(cached)
        setIsLoading(false)
        return
      }

      // Buscar do banco
      const flowsData = await engine.listFlows()
      setFlows(flowsData)

      // Cachear por 2 minutos
      await setCache(cacheKey, flowsData, 120)

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao carregar fluxos'
      setError(errorMessage)
      toast.error('Erro ao carregar fluxos')
    } finally {
      setIsLoading(false)
    }
  }, [engine, tenantId, options.enabled, getFromCache, setCache])

  // Criar fluxo
  const createFlow = useCallback(async (flowData: Omit<Flow, 'id' | 'createdAt' | 'updatedAt' | 'version'>): Promise<Flow | null> => {
    if (!engine || !userId) {
      toast.error('Engine ou usuário não disponível')
      return null
    }

    try {
      const newFlow = await engine.createFlow({
        ...flowData,
        tenantId,
        createdBy: userId
      })

      if (newFlow) {
        // Atualizar lista local
        setFlows(prev => [newFlow, ...prev])
        
        // Invalidar cache
        await deleteCache(`flows:${tenantId}:all`)
        
        toast.success('Fluxo criado com sucesso!')
        return newFlow
      }

      return null
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao criar fluxo'
      toast.error(errorMessage)
      return null
    }
  }, [engine, userId, tenantId, deleteCache])

  // Atualizar fluxo
  const updateFlow = useCallback(async (flowId: string, updates: Partial<Flow>): Promise<Flow | null> => {
    if (!engine) {
      toast.error('Engine não disponível')
      return null
    }

    try {
      const updatedFlow = await engine.updateFlow(flowId, updates)

      if (updatedFlow) {
        // Atualizar lista local
        setFlows(prev => prev.map(f => f.id === flowId ? updatedFlow : f))
        
        // Invalidar cache
        await deleteCache(`flows:${tenantId}:all`)
        await deleteCache(`flow:${flowId}`)
        
        toast.success('Fluxo atualizado com sucesso!')
        return updatedFlow
      }

      return null
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao atualizar fluxo'
      toast.error(errorMessage)
      return null
    }
  }, [engine, tenantId, deleteCache])

  // Deletar fluxo
  const deleteFlow = useCallback(async (flowId: string): Promise<boolean> => {
    if (!engine) {
      toast.error('Engine não disponível')
      return false
    }

    try {
      // Implementar soft delete ou verificação de dependências
      const { error } = await engine['supabase']
        .from('flows')
        .update({ status: FLOW_STATUSES.ARCHIVED })
        .eq('id', flowId)
        .eq('tenantId', tenantId)

      if (error) {
        throw error
      }

      // Atualizar lista local
      setFlows(prev => prev.filter(f => f.id !== flowId))
      
      // Invalidar cache
      await deleteCache(`flows:${tenantId}:all`)
      await deleteCache(`flow:${flowId}`)
      
      toast.success('Fluxo removido com sucesso!')
      return true
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao remover fluxo'
      toast.error(errorMessage)
      return false
    }
  }, [engine, tenantId, deleteCache])

  // Obter fluxo específico
  const getFlow = useCallback(async (flowId: string): Promise<Flow | null> => {
    if (!engine) {
      toast.error('Engine não disponível')
      return null
    }

    try {
      const cacheKey = `flow:${flowId}`
      
      // Tentar obter do cache
      const cached = await getFromCache(cacheKey)
      if (cached) {
        return cached
      }

      // Buscar do banco
      const flow = await engine.getFlow(flowId)
      
      if (flow) {
        // Cachear por 5 minutos
        await setCache(cacheKey, flow, 300)
      }

      return flow
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao obter fluxo'
      toast.error(errorMessage)
      return null
    }
  }, [engine, getFromCache, setCache])

  // Executar fluxo
  const executeFlowCallback = useCallback(async (flowId: string, context: Record<string, any> = {}): Promise<string | null> => {
    if (!tenantId) {
      toast.error('Tenant não disponível')
      return null
    }

    try {
      const executionId = await executeFlow(flowId, tenantId, context)
      
      if (executionId) {
        toast.success('Fluxo executado com sucesso!')
        return executionId
      }

      toast.error('Erro ao executar fluxo')
      return null
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao executar fluxo'
      toast.error(errorMessage)
      return null
    }
  }, [tenantId])

  // Retomar execução
  const resumeFlow = useCallback(async (executionId: string): Promise<boolean> => {
    if (!tenantId) {
      toast.error('Tenant não disponível')
      return false
    }

    try {
      const success = await resumeFlowExecution(executionId, tenantId)
      
      if (success) {
        toast.success('Execução retomada com sucesso!')
        return true
      }

      toast.error('Erro ao retomar execução')
      return false
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao retomar execução'
      toast.error(errorMessage)
      return false
    }
  }, [tenantId])

  // Cancelar execução
  const cancelFlow = useCallback(async (executionId: string): Promise<boolean> => {
    if (!tenantId) {
      toast.error('Tenant não disponível')
      return false
    }

    try {
      const success = await cancelFlowExecution(executionId, tenantId)
      
      if (success) {
        toast.success('Execução cancelada com sucesso!')
        return true
      }

      toast.error('Erro ao cancelar execução')
      return false
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao cancelar execução'
      toast.error(errorMessage)
      return false
    }
  }, [tenantId])

  // Usar template
  const useTemplate = useCallback(async (
    templateKey: keyof typeof FLOW_TEMPLATES,
    customData: Partial<Flow> = {}
  ): Promise<Flow | null> => {
    if (!engine || !userId) {
      toast.error('Engine ou usuário não disponível')
      return null
    }

    try {
      const template = FLOW_TEMPLATES[templateKey]
      if (!template) {
        toast.error('Template não encontrado')
        return null
      }

      const flowData: Omit<Flow, 'id' | 'createdAt' | 'updatedAt' | 'version'> = {
        name: customData.name || template.name,
        description: customData.description || template.description,
        nodes: template.nodes,
        edges: template.edges,
        status: FLOW_STATUSES.DRAFT,
        variablesSchema: customData.variablesSchema || {},
        metadata: {
          ...customData.metadata,
          template: true,
          templateId: templateKey
        },
        tenantId,
        createdBy: userId
      }

      return await createFlow(flowData)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao usar template'
      toast.error(errorMessage)
      return null
    }
  }, [engine, userId, tenantId, createFlow])

  // Validar fluxo
  const validateFlow = useCallback((flow: Flow) => {
    if (!engine) {
      return { valid: false, errors: ['Engine não disponível'] }
    }

    return engine.validateFlow(flow)
  }, [engine])

  // Importar fluxo
  const importFlow = useCallback(async (flowData: any): Promise<Flow | null> => {
    if (!engine || !userId) {
      toast.error('Engine ou usuário não disponível')
      return null
    }

    try {
      const importedFlow = await engine.createFlow({
        ...flowData,
        tenantId,
        createdBy: userId,
        status: FLOW_STATUSES.DRAFT
      })

      if (importedFlow) {
        // Atualizar lista local
        setFlows(prev => [importedFlow, ...prev])
        
        // Invalidar cache
        await deleteCache(`flows:${tenantId}:all`)
        
        toast.success('Fluxo importado com sucesso!')
        return importedFlow
      }

      return null
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao importar fluxo'
      toast.error(errorMessage)
      return null
    }
  }, [engine, userId, tenantId, deleteCache])

  // Exportar fluxo
  const exportFlow = useCallback(async (flowId: string): Promise<any | null> => {
    if (!engine) {
      toast.error('Engine não disponível')
      return null
    }

    try {
      const flow = await getFlow(flowId)
      if (!flow) {
        toast.error('Fluxo não encontrado')
        return null
      }

      // Remover campos internos
      const { id, tenantId: tenant, createdAt, updatedAt, ...exportData } = flow
      
      return exportData
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao exportar fluxo'
      toast.error(errorMessage)
      return null
    }
  }, [engine, getFlow])

  // Refetch
  const refetch = useCallback(async () => {
    await fetchFlows()
  }, [fetchFlows])

  // Efeito para buscar fluxos inicialmente
  useEffect(() => {
    if (options.enabled !== false) {
      fetchFlows()
    }
  }, [fetchFlows, options.enabled])

  // Auto-refresh
  useEffect(() => {
    if (options.refreshInterval && options.refreshInterval > 0) {
      const interval = setInterval(() => {
        fetchFlows()
      }, options.refreshInterval)

      return () => clearInterval(interval)
    }
  }, [fetchFlows, options.refreshInterval])

  return {
    flows,
    isLoading,
    error,
    createFlow,
    updateFlow,
    deleteFlow,
    getFlow,
    executeFlow: executeFlowCallback,
    resumeFlow,
    cancelFlow,
    useTemplate,
    validateFlow,
    importFlow,
    exportFlow,
    refetch
  }
}