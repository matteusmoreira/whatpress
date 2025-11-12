/**
 * Hook para gerenciamento de mídia
 * 
 * Gerencia upload, listagem, busca e exclusão de arquivos de mídia
 * com suporte a cache, validação e processamento assíncrono
 */

import { useState, useCallback, useEffect } from 'react'
import { useAuth } from './useAuth'
import { useTenant } from './useTenant'
import { useCache } from './useCache'
import { monitorFunction } from '@/lib/monitoring'
import { 
  processMediaUpload, 
  listMedia, 
  deleteMedia, 
  updateMediaMetadata,
  searchMediaByTags,
  getMediaById,
  generateUploadUrl,
  completeUpload,
  type MediaFile,
  type MediaType,
  type MediaCategory,
  type UploadOptions,
  type UploadResult
} from '@/lib/media'

export interface UseMediaOptions {
  category?: MediaCategory
  type?: MediaType
  tags?: string[]
  search?: string
  limit?: number
  autoRefresh?: boolean
  refreshInterval?: number
}

export interface UseMediaReturn {
  // Estado
  media: MediaFile[]
  loading: boolean
  error: string | null
  uploading: boolean
  uploadProgress: number
  
  // Cache
  cachedMedia: MediaFile[] | null
  isLoadingMedia: boolean
  
  // Ações
  uploadFile: (file: File, options: UploadOptions) => Promise<UploadResult>
  deleteFile: (mediaId: string) => Promise<boolean>
  updateMetadata: (mediaId: string, metadata: Partial<MediaFile['metadata']>) => Promise<MediaFile | null>
  refreshMedia: () => Promise<void>
  searchByTags: (tags: string[]) => Promise<MediaFile[]>
  getMedia: (mediaId: string) => Promise<MediaFile | null>
  
  // Upload assíncrono
  startUpload: (file: File, options: UploadOptions) => Promise<{ token: string; url: string } | null>
  finishUpload: (token: string, options: UploadOptions) => Promise<UploadResult>
  
  // Filtros
  setCategory: (category: MediaCategory | undefined) => void
  setType: (type: MediaType | undefined) => void
  setSearch: (search: string) => void
  setTags: (tags: string[]) => void
}

export function useMedia(options: UseMediaOptions = {}): UseMediaReturn {
  const { user } = useAuth()
  const { tenant } = useTenant()
  
  // Estado local
  const [media, setMedia] = useState<MediaFile[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  
  // Filtros
  const [category, setCategory] = useState<MediaCategory | undefined>(options.category)
  const [type, setType] = useState<MediaType | undefined>(options.type)
  const [search, setSearch] = useState<string>(options.search || '')
  const [tags, setTags] = useState<string[]>(options.tags || [])
  
  // Cache
  const cacheKey = tenant?.id ? `media:${tenant.id}:${category || 'all'}:${type || 'all'}:${search}:${tags.join(',')}` : null
  const { data: cachedMedia, isLoading: isLoadingMedia, mutate: mutateMedia } = useCache<MediaFile[]>(
    cacheKey,
    async () => {
      if (!tenant?.id || !user?.id) return []
      return listMedia(tenant.id, user.id, {
        category,
        type,
        tags,
        search,
        limit: options.limit || 50
      })
    },
    {
      ttl: 300, // 5 minutos
      staleWhileRevalidate: 600, // 10 minutos
      enabled: !!tenant?.id && !!user?.id
    }
  )

  // Atualizar estado quando cache mudar
  useEffect(() => {
    if (cachedMedia) {
      setMedia(cachedMedia)
    }
  }, [cachedMedia])

  /**
   * Upload de arquivo
   */
  const uploadFile = useCallback(async (
    file: File, 
    uploadOptions: UploadOptions
  ): Promise<UploadResult> => {
    if (!user?.id || !tenant?.id) {
      return { success: false, error: 'Usuário ou tenant não encontrado' }
    }

    return monitorFunction(
      async () => {
        setUploading(true)
        setUploadProgress(0)
        setError(null)

        try {
          // Simular progresso
          const progressInterval = setInterval(() => {
            setUploadProgress(prev => Math.min(prev + 10, 90))
          }, 200)

          const result = await processMediaUpload(
            file,
            user.id,
            tenant.id,
            uploadOptions
          )

          clearInterval(progressInterval)
          setUploadProgress(100)

          if (result.success && result.media) {
            await mutateMedia()
          }

          // Resetar progresso após um tempo
          setTimeout(() => {
            setUploading(false)
            setUploadProgress(0)
          }, 1000)

          return result
        } catch (error) {
          clearInterval(progressInterval)
          setUploading(false)
          setUploadProgress(0)
          setError(error instanceof Error ? error.message : 'Erro no upload')
          
          return { 
            success: false, 
            error: error instanceof Error ? error.message : 'Erro no upload' 
          }
        }
      },
      {
        functionName: 'uploadFile',
        category: 'media',
        metadata: { 
          filename: file.name,
          size: file.size,
          category: uploadOptions.category,
          userId: user.id,
          tenantId: tenant.id
        }
      }
    )()
  }, [user?.id, tenant?.id, mutateMedia])

  /**
   * Inicia upload assíncrono
   */
  const startUpload = useCallback(async (
    file: File,
    uploadOptions: UploadOptions
  ): Promise<{ token: string; url: string } | null> => {
    if (!tenant?.id) {
      return null
    }

    return monitorFunction(
      async () => {
        const result = await generateUploadUrl(
          tenant.id,
          file.name,
          file.type
        )

        return result
      },
      {
        functionName: 'startUpload',
        category: 'media',
        metadata: {
          filename: file.name,
          size: file.size,
          tenantId: tenant.id
        }
      }
    )()
  }, [tenant?.id])

  /**
   * Finaliza upload assíncrono
   */
  const finishUpload = useCallback(async (
    token: string,
    uploadOptions: UploadOptions
  ): Promise<UploadResult> => {
    if (!user?.id) {
      return { success: false, error: 'Usuário não encontrado' }
    }

    return monitorFunction(
      async () => {
        const result = await completeUpload(token, user.id, uploadOptions)

        if (result.success) {
          await mutateMedia()
        }

        return result
      },
      {
        functionName: 'finishUpload',
        category: 'media',
        metadata: { token, userId: user.id, category: uploadOptions.category }
      }
    )()
  }, [user?.id, mutateMedia])

  /**
   * Deleta arquivo
   */
  const deleteFile = useCallback(async (
    mediaId: string
  ): Promise<boolean> => {
    if (!user?.id || !tenant?.id) {
      return false
    }

    return monitorFunction(
      async () => {
        const success = await deleteMedia(mediaId, user.id, tenant.id)
        
        if (success) {
          await mutateMedia()
        }

        return success
      },
      {
        functionName: 'deleteFile',
        category: 'media',
        metadata: { mediaId, userId: user.id, tenantId: tenant.id }
      }
    )()
  }, [user?.id, tenant?.id, mutateMedia])

  /**
   * Atualiza metadados
   */
  const updateMetadata = useCallback(async (
    mediaId: string,
    metadata: Partial<MediaFile['metadata']>
  ): Promise<MediaFile | null> => {
    if (!user?.id || !tenant?.id) {
      return null
    }

    return monitorFunction(
      async () => {
        const updated = await updateMediaMetadata(
          mediaId,
          user.id,
          tenant.id,
          metadata
        )

        if (updated) {
          await mutateMedia()
        }

        return updated
      },
      {
        functionName: 'updateMetadata',
        category: 'media',
        metadata: { mediaId, userId: user.id, tenantId: tenant.id, metadata }
      }
    )()
  }, [user?.id, tenant?.id, mutateMedia])

  /**
   * Busca por tags
   */
  const searchByTags = useCallback(async (
    searchTags: string[]
  ): Promise<MediaFile[]> => {
    if (!tenant?.id) {
      return []
    }

    return monitorFunction(
      async () => {
        return searchMediaByTags(tenant.id, searchTags, user?.id)
      },
      {
        functionName: 'searchByTags',
        category: 'media',
        metadata: { 
          tags: searchTags,
          tenantId: tenant.id,
          userId: user?.id
        }
      }
    )()
  }, [tenant?.id, user?.id])

  /**
   * Obtém mídia específica
   */
  const getMedia = useCallback(async (
    mediaId: string
  ): Promise<MediaFile | null> => {
    if (!user?.id || !tenant?.id) {
      return null
    }

    return monitorFunction(
      async () => {
        return getMediaById(mediaId, user.id, tenant.id)
      },
      {
        functionName: 'getMedia',
        category: 'media',
        metadata: { mediaId, userId: user.id, tenantId: tenant.id }
      }
    )()
  }, [user?.id, tenant?.id])

  /**
   * Atualiza lista de mídias
   */
  const refreshMedia = useCallback(async (): Promise<void> => {
    await mutateMedia()
  }, [mutateMedia])

  // Auto-refresh
  useEffect(() => {
    if (options.autoRefresh && options.refreshInterval) {
      const interval = setInterval(refreshMedia, options.refreshInterval)
      return () => clearInterval(interval)
    }
  }, [options.autoRefresh, options.refreshInterval, refreshMedia])

  return {
    media,
    loading,
    error,
    uploading,
    uploadProgress,
    cachedMedia,
    isLoadingMedia,
    uploadFile,
    deleteFile,
    updateMetadata,
    refreshMedia,
    searchByTags,
    getMedia,
    startUpload,
    finishUpload,
    setCategory,
    setType,
    setSearch,
    setTags
  }
}
