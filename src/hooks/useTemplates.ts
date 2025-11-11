import { useState, useCallback, useEffect } from 'react'
import { useAuth } from './useAuth'
import { useTenant } from './useTenant'
import { useCache } from './useCache'
import { monitorFunction } from '../lib/monitoring'
import {
  MessageTemplate,
  TemplatePreview,
  TemplateVariable,
  createTemplate,
  listTemplates,
  getTemplateById,
  updateTemplate,
  deleteTemplate,
  approveTemplate,
  processTemplate,
  detectTemplateVariables,
  TEMPLATE_TYPES,
  VARIABLE_TYPES,
  RICH_MEDIA_COMPONENTS
} from '../lib/templates'

export interface UseTemplatesOptions {
  type?: string
  category?: string
  isActive?: boolean
  approved?: boolean
  search?: string
  limit?: number
  offset?: number
}

export interface UseTemplatesReturn {
  templates: MessageTemplate[]
  cachedTemplates: MessageTemplate[]
  cachedTemplate: MessageTemplate | null
  isLoading: boolean
  isLoadingTemplates: boolean
  isLoadingTemplate: boolean
  error: string | null
  
  // Funções principais
  createTemplate: (templateData: Omit<MessageTemplate, 'id' | 'createdAt' | 'updatedAt' | 'usageCount' | 'approved'>) => Promise<MessageTemplate | null>
  updateTemplate: (templateId: string, updates: Partial<MessageTemplate>) => Promise<MessageTemplate | null>
  deleteTemplate: (templateId: string) => Promise<boolean>
  approveTemplate: (templateId: string) => Promise<MessageTemplate | null>
  getTemplateById: (templateId: string) => Promise<MessageTemplate | null>
  
  // Funções de processamento
  processTemplate: (template: MessageTemplate, variables: Record<string, any>) => TemplatePreview
  detectVariables: (content: string) => string[]
  validateVariables: (template: MessageTemplate, variables: Record<string, any>) => { valid: boolean; errors: string[]; warnings: string[] }
  
  // Funções de cache
  refreshTemplates: () => Promise<void>
  invalidateCache: () => Promise<void>
  
  // Constantes
  TEMPLATE_TYPES: typeof TEMPLATE_TYPES
  VARIABLE_TYPES: typeof VARIABLE_TYPES
  RICH_MEDIA_COMPONENTS: typeof RICH_MEDIA_COMPONENTS
}

export function useTemplates(options?: UseTemplatesOptions): UseTemplatesReturn {
  const { user } = useAuth()
  const { tenantId } = useTenant()
  const [templates, setTemplates] = useState<MessageTemplate[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(false)
  const [isLoadingTemplate, setIsLoadingTemplate] = useState(false)

  // Cache
  const {
    data: cachedTemplates,
    isLoading: isLoadingCachedTemplates,
    mutate: mutateTemplates
  } = useCache<MessageTemplate[]>(
    tenantId ? `templates:${tenantId}:${JSON.stringify(options || {})}` : null,
    async () => {
      if (!tenantId) return []
      return listTemplates(tenantId, options)
    },
    {
      ttl: 300, // 5 minutos
      staleWhileRevalidate: true
    }
  )

  const {
    data: cachedTemplate,
    isLoading: isLoadingCachedTemplate,
    mutate: mutateTemplate
  } = useCache<MessageTemplate | null>(
    null, // Será definido dinamicamente
    async () => null,
    {
      ttl: 600, // 10 minutos
      staleWhileRevalidate: true
    }
  )

  // Atualizar templates quando cache mudar
  useEffect(() => {
    if (cachedTemplates !== undefined) {
      setTemplates(cachedTemplates)
    }
  }, [cachedTemplates])

  // Criar template
  const handleCreateTemplate = useCallback(async (
    templateData: Omit<MessageTemplate, 'id' | 'createdAt' | 'updatedAt' | 'usageCount' | 'approved'>
  ): Promise<MessageTemplate | null> => {
    if (!user?.id || !tenantId) {
      setError('Usuário ou tenant não encontrado')
      return null
    }

    return monitorFunction(
      async () => {
        setIsLoading(true)
        setError(null)

        try {
          const newTemplate = await createTemplate({
            ...templateData,
            createdBy: user.id,
            tenantId
          })

          // Atualizar cache
          await mutateTemplates()

          return newTemplate
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Erro ao criar template')
          return null
        } finally {
          setIsLoading(false)
        }
      },
      {
        functionName: 'createTemplate',
        category: 'templates',
        metadata: {
          userId: user.id,
          tenantId,
          templateName: templateData.name,
          templateType: templateData.type
        }
      }
    )()
  }, [user?.id, tenantId, mutateTemplates])

  // Atualizar template
  const handleUpdateTemplate = useCallback(async (
    templateId: string,
    updates: Partial<MessageTemplate>
  ): Promise<MessageTemplate | null> => {
    if (!tenantId) {
      setError('Tenant não encontrado')
      return null
    }

    return monitorFunction(
      async () => {
        setIsLoading(true)
        setError(null)

        try {
          const updatedTemplate = await updateTemplate(templateId, tenantId, updates)

          // Atualizar cache
          await mutateTemplates()

          return updatedTemplate
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Erro ao atualizar template')
          return null
        } finally {
          setIsLoading(false)
        }
      },
      {
        functionName: 'updateTemplate',
        category: 'templates',
        metadata: {
          userId: user?.id,
          tenantId,
          templateId,
          updates: Object.keys(updates)
        }
      }
    )()
  }, [tenantId, user?.id, mutateTemplates])

  // Deletar template
  const handleDeleteTemplate = useCallback(async (
    templateId: string
  ): Promise<boolean> => {
    if (!tenantId) {
      setError('Tenant não encontrado')
      return false
    }

    return monitorFunction(
      async () => {
        setIsLoading(true)
        setError(null)

        try {
          const success = await deleteTemplate(templateId, tenantId)

          if (success) {
            // Atualizar cache
            await mutateTemplates()
          }

          return success
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Erro ao deletar template')
          return false
        } finally {
          setIsLoading(false)
        }
      },
      {
        functionName: 'deleteTemplate',
        category: 'templates',
        metadata: {
          userId: user?.id,
          tenantId,
          templateId
        }
      }
    )()
  }, [tenantId, user?.id, mutateTemplates])

  // Aprovar template
  const handleApproveTemplate = useCallback(async (
    templateId: string
  ): Promise<MessageTemplate | null> => {
    if (!user?.id || !tenantId) {
      setError('Usuário ou tenant não encontrado')
      return null
    }

    return monitorFunction(
      async () => {
        setIsLoading(true)
        setError(null)

        try {
          const approvedTemplate = await approveTemplate(templateId, tenantId, user.id)

          // Atualizar cache
          await mutateTemplates()

          return approvedTemplate
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Erro ao aprovar template')
          return null
        } finally {
          setIsLoading(false)
        }
      },
      {
        functionName: 'approveTemplate',
        category: 'templates',
        metadata: {
          userId: user.id,
          tenantId,
          templateId
        }
      }
    )()
  }, [user?.id, tenantId, mutateTemplates])

  // Obter template por ID
  const handleGetTemplateById = useCallback(async (
    templateId: string
  ): Promise<MessageTemplate | null> => {
    if (!tenantId) {
      setError('Tenant não encontrado')
      return null
    }

    return monitorFunction(
      async () => {
        setIsLoadingTemplate(true)
        setError(null)

        try {
          const template = await getTemplateById(templateId, tenantId)
          return template
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Erro ao obter template')
          return null
        } finally {
          setIsLoadingTemplate(false)
        }
      },
      {
        functionName: 'getTemplateById',
        category: 'templates',
        metadata: {
          userId: user?.id,
          tenantId,
          templateId
        }
      }
    )()
  }, [tenantId, user?.id])

  // Processar template
  const handleProcessTemplate = useCallback(
    (template: MessageTemplate, variables: Record<string, any>): TemplatePreview => {
      return monitorFunction(
        () => processTemplate(template, variables),
        {
          functionName: 'processTemplate',
          category: 'templates',
          metadata: {
            userId: user?.id,
            tenantId,
            templateId: template.id,
            templateName: template.name,
            variables: Object.keys(variables)
          }
        }
      )()
    },
    [user?.id, tenantId]
  )

  // Detectar variáveis
  const handleDetectVariables = useCallback(
    (content: string): string[] => {
      return monitorFunction(
        () => detectTemplateVariables(content),
        {
          functionName: 'detectTemplateVariables',
          category: 'templates',
          metadata: {
            userId: user?.id,
            tenantId,
            contentLength: content.length
          }
        }
      )()
    },
    [user?.id, tenantId]
  )

  // Validar variáveis
  const handleValidateVariables = useCallback(
    (template: MessageTemplate, variables: Record<string, any>) => {
      return monitorFunction(
        () => validateTemplateVariables(template, variables),
        {
          functionName: 'validateTemplateVariables',
          category: 'templates',
          metadata: {
            userId: user?.id,
            tenantId,
            templateId: template.id,
            templateName: template.name,
            variables: Object.keys(variables)
          }
        }
      )()
    },
    [user?.id, tenantId]
  )

  // Refresh templates
  const refreshTemplates = useCallback(async () => {
    await mutateTemplates()
  }, [mutateTemplates])

  // Invalidar cache
  const invalidateCache = useCallback(async () => {
    if (tenantId) {
      // Invalidar cache de templates do tenant
      await mutateTemplates(undefined, { revalidate: true })
    }
  }, [tenantId, mutateTemplates])

  return {
    templates,
    cachedTemplates: cachedTemplates || [],
    cachedTemplate,
    isLoading: isLoading || isLoadingCachedTemplates,
    isLoadingTemplates: isLoadingTemplates || isLoadingCachedTemplates,
    isLoadingTemplate: isLoadingTemplate || isLoadingCachedTemplate,
    error,
    
    // Funções principais
    createTemplate: handleCreateTemplate,
    updateTemplate: handleUpdateTemplate,
    deleteTemplate: handleDeleteTemplate,
    approveTemplate: handleApproveTemplate,
    getTemplateById: handleGetTemplateById,
    
    // Funções de processamento
    processTemplate: handleProcessTemplate,
    detectVariables: handleDetectVariables,
    validateVariables: handleValidateVariables,
    
    // Funções de cache
    refreshTemplates,
    invalidateCache,
    
    // Constantes
    TEMPLATE_TYPES,
    VARIABLE_TYPES,
    RICH_MEDIA_COMPONENTS
  }
}