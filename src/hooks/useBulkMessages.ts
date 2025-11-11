import { useState, useCallback, useEffect } from 'react'
import { useAuth } from './useAuth'
import { useTenant } from './useTenant'
import { useCache } from './useCache'
import { monitorFunction } from '../lib/monitoring'
import {
  BulkMessageJob,
  BulkMessageRecipient,
  createBulkMessageJob,
  listBulkMessageJobs,
  cancelBulkMessageJob,
  MESSAGE_PRIORITIES,
  MESSAGE_STATUS
} from '../lib/bulkMessages'

export interface UseBulkMessagesOptions {
  status?: string
  channel?: string
  limit?: number
  offset?: number
}

export interface UseBulkMessagesReturn {
  jobs: BulkMessageJob[]
  cachedJobs: BulkMessageJob[]
  isLoading: boolean
  isLoadingJobs: boolean
  error: string | null
  
  // Funções principais
  createJob: (jobData: Omit<BulkMessageJob, 'id' | 'createdAt' | 'updatedAt' | 'status' | 'processedRecipients' | 'successfulSends' | 'failedSends' | 'retryCount'>) => Promise<BulkMessageJob | null>
  cancelJob: (jobId: string) => Promise<boolean>
  getJobProgress: (job: BulkMessageJob) => number
  getJobStatus: (job: BulkMessageJob) => string
  
  // Funções de cache
  refreshJobs: () => Promise<void>
  invalidateCache: () => Promise<void>
  
  // Constantes
  MESSAGE_PRIORITIES: typeof MESSAGE_PRIORITIES
  MESSAGE_STATUS: typeof MESSAGE_STATUS
}

export function useBulkMessages(options?: UseBulkMessagesOptions): UseBulkMessagesReturn {
  const { user } = useAuth()
  const { tenantId } = useTenant()
  const [jobs, setJobs] = useState<BulkMessageJob[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingJobs, setIsLoadingJobs] = useState(false)

  // Cache
  const {
    data: cachedJobs,
    isLoading: isLoadingCachedJobs,
    mutate: mutateJobs
  } = useCache<BulkMessageJob[]>(
    tenantId ? `bulk-jobs:${tenantId}:${JSON.stringify(options || {})}` : null,
    async () => {
      if (!tenantId) return []
      return listBulkMessageJobs(tenantId, options)
    },
    {
      ttl: 60, // 1 minuto - atualização frequente para jobs
      staleWhileRevalidate: true
    }
  )

  // Atualizar jobs quando cache mudar
  useEffect(() => {
    if (cachedJobs !== undefined) {
      setJobs(cachedJobs)
    }
  }, [cachedJobs])

  // Criar job
  const handleCreateJob = useCallback(async (
    jobData: Omit<BulkMessageJob, 'id' | 'createdAt' | 'updatedAt' | 'status' | 'processedRecipients' | 'successfulSends' | 'failedSends' | 'retryCount'>
  ): Promise<BulkMessageJob | null> => {
    if (!user?.id || !tenantId) {
      setError('Usuário ou tenant não encontrado')
      return null
    }

    return monitorFunction(
      async () => {
        setIsLoading(true)
        setError(null)

        try {
          const newJob = await createBulkMessageJob(jobData)

          // Atualizar cache
          await mutateJobs()

          return newJob
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Erro ao criar job')
          return null
        } finally {
          setIsLoading(false)
        }
      },
      {
        functionName: 'createBulkMessageJob',
        category: 'bulk_messages',
        metadata: {
          userId: user.id,
          tenantId,
          jobName: jobData.name,
          channel: jobData.channel,
          provider: jobData.provider,
          totalRecipients: jobData.totalRecipients,
          priority: jobData.priority
        }
      }
    )()
  }, [user?.id, tenantId, mutateJobs])

  // Cancelar job
  const handleCancelJob = useCallback(async (
    jobId: string
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
          const success = await cancelBulkMessageJob(jobId, tenantId)

          if (success) {
            // Atualizar cache
            await mutateJobs()
          }

          return success
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Erro ao cancelar job')
          return false
        } finally {
          setIsLoading(false)
        }
      },
      {
        functionName: 'cancelBulkMessageJob',
        category: 'bulk_messages',
        metadata: {
          userId: user?.id,
          tenantId,
          jobId
        }
      }
    )()
  }, [tenantId, user?.id, mutateJobs])

  // Obter progresso do job
  const getJobProgress = useCallback((job: BulkMessageJob): number => {
    if (job.totalRecipients === 0) return 0
    return Math.round((job.processedRecipients / job.totalRecipients) * 100)
  }, [])

  // Obter status do job
  const getJobStatus = useCallback((job: BulkMessageJob): string => {
    switch (job.status) {
      case MESSAGE_STATUS.PENDING:
        return job.scheduledAt && new Date(job.scheduledAt) > new Date() 
          ? 'Agendado' 
          : 'Pendente'
      case MESSAGE_STATUS.SENT:
        return 'Enviando'
      case MESSAGE_STATUS.DELIVERED:
        return 'Entregue'
      case MESSAGE_STATUS.FAILED:
        return 'Falhou'
      case MESSAGE_STATUS.RETRY:
        return 'Tentando novamente'
      case MESSAGE_STATUS.CANCELLED:
        return 'Cancelado'
      default:
        return job.status
    }
  }, [])

  // Refresh jobs
  const refreshJobs = useCallback(async () => {
    await mutateJobs()
  }, [mutateJobs])

  // Invalidar cache
  const invalidateCache = useCallback(async () => {
    if (tenantId) {
      await mutateJobs(undefined, { revalidate: true })
    }
  }, [tenantId, mutateJobs])

  return {
    jobs,
    cachedJobs: cachedJobs || [],
    isLoading: isLoading || isLoadingCachedJobs,
    isLoadingJobs: isLoadingJobs || isLoadingCachedJobs,
    error,
    
    // Funções principais
    createJob: handleCreateJob,
    cancelJob: handleCancelJob,
    getJobProgress,
    getJobStatus,
    
    // Funções de cache
    refreshJobs,
    invalidateCache,
    
    // Constantes
    MESSAGE_PRIORITIES,
    MESSAGE_STATUS
  }
}