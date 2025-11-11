import { useState, useEffect, useCallback, useRef } from 'react'
import { cacheUtils, distributedUtils } from '@/lib/redis'
import { monitorCacheOperation } from '@/lib/monitoring'

interface CacheOptions {
  ttl?: number // Time to live in seconds
  staleWhileRevalidate?: boolean // Return stale data while fetching fresh data
  revalidateOnFocus?: boolean // Revalidate when window gains focus
  revalidateOnReconnect?: boolean // Revalidate when network reconnects
  revalidateOnMount?: boolean // Revalidate on component mount
}

interface CacheState<T> {
  data: T | null
  loading: boolean
  error: Error | null
  isValidating: boolean
}

// Hook principal para cache
export function useCache<T>(
  key: string,
  fetcher: () => Promise<T>,
  options: CacheOptions = {}
): CacheState<T> & {
  mutate: (data?: T | ((oldData: T) => T)) => Promise<void>
  refresh: () => Promise<void>
} {
  const {
    ttl = 3600, // 1 hora padrão
    staleWhileRevalidate = false,
    revalidateOnFocus = true,
    revalidateOnReconnect = true,
    revalidateOnMount = true,
  } = options

  const [state, setState] = useState<CacheState<T>>({
    data: null,
    loading: true,
    error: null,
    isValidating: false,
  })

  const fetcherRef = useRef(fetcher)
  const keyRef = useRef(key)

  // Atualizar refs quando props mudam
  useEffect(() => {
    fetcherRef.current = fetcher
    keyRef.current = key
  }, [fetcher, key])

  // Função para buscar dados
  const fetchData = useCallback(async (isBackground = false) => {
    if (!isBackground) {
      setState(prev => ({ ...prev, loading: true, error: null }))
    } else {
      setState(prev => ({ ...prev, isValidating: true }))
    }

    try {
      // Tentar obter do cache primeiro
      const cachedData = await monitorCacheOperation('get', key, async () => {
        return await cacheUtils.get(key)
      })

      if (cachedData !== null) {
        setState(prev => ({
          ...prev,
          data: cachedData,
          loading: false,
          isValidating: false,
        }))

        // Se não for stale-while-revalidate, retornar
        if (!staleWhileRevalidate) {
          return cachedData
        }
      }

      // Buscar dados frescos
      const freshData = await fetcherRef.current()

      // Salvar no cache
      await monitorCacheOperation('set', key, async () => {
        await cacheUtils.setWithTTL(key, freshData, ttl)
      })

      setState(prev => ({
        ...prev,
        data: freshData,
        loading: false,
        isValidating: false,
        error: null,
      }))

      return freshData
    } catch (error) {
      console.error('Error fetching data:', error)
      
      setState(prev => ({
        ...prev,
        loading: false,
        isValidating: false,
        error: error as Error,
      }))

      throw error
    }
  }, [key, staleWhileRevalidate, ttl])

  // Função para mutar dados
  const mutate = useCallback(async (newData?: T | ((oldData: T) => T)) => {
    let dataToSet: T

    if (typeof newData === 'function') {
      dataToSet = (newData as (oldData: T) => T)(state.data as T)
    } else if (newData !== undefined) {
      dataToSet = newData
    } else {
      // Revalidar
      await fetchData()
      return
    }

    // Atualizar estado imediatamente (optimistic update)
    setState(prev => ({ ...prev, data: dataToSet }))

    // Salvar no cache
    try {
      await monitorCacheOperation('set', key, async () => {
        await cacheUtils.setWithTTL(key, dataToSet, ttl)
      })
    } catch (error) {
      console.error('Error updating cache:', error)
      // Reverter em caso de erro
      await fetchData()
    }
  }, [key, ttl, state.data, fetchData])

  // Função para refresh
  const refresh = useCallback(async () => {
    await fetchData()
  }, [fetchData])

  // Efeito para buscar dados no mount
  useEffect(() => {
    if (revalidateOnMount) {
      fetchData()
    }
  }, [fetchData, revalidateOnMount])

  // Efeito para revalidar no focus
  useEffect(() => {
    if (!revalidateOnFocus) return

    const handleFocus = () => {
      fetchData(true) // Background fetch
    }

    window.addEventListener('focus', handleFocus)
    return () => window.removeEventListener('focus', handleFocus)
  }, [fetchData, revalidateOnFocus])

  // Efeito para revalidar na reconexão
  useEffect(() => {
    if (!revalidateOnReconnect) return

    const handleOnline = () => {
      fetchData(true) // Background fetch
    }

    window.addEventListener('online', handleOnline)
    return () => window.removeEventListener('online', handleOnline)
  }, [fetchData, revalidateOnReconnect])

  return {
    ...state,
    mutate,
    refresh,
  }
}

// Hook para gerenciar múltiplas chaves de cache
export function useCacheManager() {
  const clearByPattern = useCallback(async (pattern: string) => {
    try {
      const deletedCount = await cacheUtils.delByPattern(pattern)
      console.log(`Deleted ${deletedCount} cache keys matching pattern: ${pattern}`)
      return deletedCount
    } catch (error) {
      console.error('Error clearing cache by pattern:', error)
      return 0
    }
  }, [])

  const clearByKey = useCallback(async (key: string) => {
    try {
      await monitorCacheOperation('del', key, async () => {
        await cacheUtils.del(key)
      })
      console.log(`Cleared cache key: ${key}`)
    } catch (error) {
      console.error('Error clearing cache key:', error)
    }
  }, [])

  const getCacheStats = useCallback(async () => {
    try {
      return await cacheUtils.getStats()
    } catch (error) {
      console.error('Error getting cache stats:', error)
      return null
    }
  }, [])

  const flushAll = useCallback(async () => {
    try {
      await cacheUtils.flushAll()
      console.log('All cache flushed')
    } catch (error) {
      console.error('Error flushing cache:', error)
    }
  }, [])

  return {
    clearByPattern,
    clearByKey,
    getCacheStats,
    flushAll,
  }
}

// Hook para monitoramento de performance
export function usePerformanceMonitoring(componentName: string) {
  const transactionRef = useRef<any>(null)

  useEffect(() => {
    // Iniciar transação de performance
    transactionRef.current = Sentry.startTransaction({
      name: `component.${componentName}`,
      op: 'component',
    })

    return () => {
      // Finalizar transação quando componente desmontar
      if (transactionRef.current) {
        transactionRef.current.finish()
      }
    }
  }, [componentName])

  const startSpan = useCallback((name: string, operation: string) => {
    if (transactionRef.current) {
      return transactionRef.current.startChild({
        name,
        op: operation,
      })
    }
    return null
  }, [])

  return {
    startSpan,
  }
}

// Hook para funções com debounce e cache
export function useDebouncedCache<T>(
  key: string,
  fetcher: () => Promise<T>,
  delay = 500,
  options: CacheOptions = {}
) {
  const [debouncedKey, setDebouncedKey] = useState(key)
  const timeoutRef = useRef<NodeJS.Timeout>()

  const debouncedFetch = useCallback((newKey: string) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }

    timeoutRef.current = setTimeout(() => {
      setDebouncedKey(newKey)
    }, delay)
  }, [delay])

  useEffect(() => {
    debouncedFetch(key)
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [key, debouncedFetch])

  return useCache(debouncedKey, fetcher, options)
}

// Hook para paginação com cache
export function useCachedPagination<T>(
  baseKey: string,
  fetcher: (page: number, limit: number) => Promise<{ items: T[]; total: number }>,
  page = 1,
  limit = 10,
  options: CacheOptions = {}
) {
  const [currentPage, setCurrentPage] = useState(page)
  const key = `${baseKey}:page:${currentPage}:limit:${limit}`

  const fetcherWithPagination = useCallback(async () => {
    return await fetcher(currentPage, limit)
  }, [fetcher, currentPage, limit])

  const cacheResult = useCache(key, fetcherWithPagination, options)

  return {
    ...cacheResult,
    page: currentPage,
    limit,
    setPage: setCurrentPage,
    total: cacheResult.data?.total || 0,
    items: cacheResult.data?.items || [],
  }
}

// Hook para rate limiting com Redis
export function useRateLimit(key: string, limit: number, window = 60) {
  const [count, setCount] = useState(0)
  const [isLimited, setIsLimited] = useState(false)
  const [resetTime, setResetTime] = useState<Date | null>(null)

  const checkRateLimit = useCallback(async () => {
    try {
      const current = await distributedUtils.incrementRequest(key, window)
      const isWithinLimit = current <= limit
      
      setCount(current)
      setIsLimited(!isWithinLimit)
      
      // Calcular tempo de reset
      const windowStart = Math.floor(Date.now() / (window * 1000)) * (window * 1000)
      const resetAt = new Date(windowStart + (window * 1000))
      setResetTime(resetAt)
      
      return {
        allowed: isWithinLimit,
        current,
        limit,
        remaining: Math.max(0, limit - current),
        resetTime: resetAt,
      }
    } catch (error) {
      console.error('Error checking rate limit:', error)
      // Em caso de erro, permitir (fail open)
      return {
        allowed: true,
        current: 0,
        limit,
        remaining: limit,
        resetTime: null,
      }
    }
  }, [key, limit, window])

  useEffect(() => {
    checkRateLimit()
  }, [checkRateLimit])

  return {
    count,
    isLimited,
    resetTime,
    checkRateLimit,
  }
}

// Hook para lock distribuído
export function useDistributedLock(key: string, ttl = 30000) {
  const [isLocked, setIsLocked] = useState(false)
  const [isAcquiring, setIsAcquiring] = useState(false)

  const acquireLock = useCallback(async () => {
    setIsAcquiring(true)
    try {
      const acquired = await distributedUtils.acquireLock(key, ttl)
      setIsLocked(acquired)
      return acquired
    } catch (error) {
      console.error('Error acquiring lock:', error)
      setIsLocked(false)
      return false
    } finally {
      setIsAcquiring(false)
    }
  }, [key, ttl])

  const releaseLock = useCallback(async () => {
    try {
      await distributedUtils.releaseLock(key)
      setIsLocked(false)
    } catch (error) {
      console.error('Error releasing lock:', error)
    }
  }, [key])

  useEffect(() => {
    return () => {
      // Liberar lock quando componente desmontar
      if (isLocked) {
        releaseLock()
      }
    }
  }, [isLocked, releaseLock])

  return {
    isLocked,
    isAcquiring,
    acquireLock,
    releaseLock,
  }
}

export default {
  useCache,
  useCacheManager,
  usePerformanceMonitoring,
  useDebouncedCache,
  useCachedPagination,
  useRateLimit,
  useDistributedLock,
}