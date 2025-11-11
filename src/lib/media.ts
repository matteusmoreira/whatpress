/**
 * Sistema de Upload e Processamento de Mídia
 * 
 * Este módulo gerencia:
 * - Upload de arquivos (imagens, vídeos, documentos)
 * - Validação de tipos e tamanhos
 * - Compressão e otimização automática
 * - Integração com CDN e Supabase Storage
 * - Processamento assíncrono via filas
 */

import { supabase } from './supabase'
import { addQueueJob } from './queue'
import { redis } from './redis'
import { monitorFunction } from './monitoring'
import { v4 as uuidv4 } from 'uuid'

// Tipos de mídia suportados
export const MEDIA_TYPES = {
  IMAGE: {
    mimeTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'],
    maxSize: 10 * 1024 * 1024, // 10MB
    extensions: ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg']
  },
  VIDEO: {
    mimeTypes: ['video/mp4', 'video/avi', 'video/mov', 'video/wmv', 'video/webm'],
    maxSize: 100 * 1024 * 1024, // 100MB
    extensions: ['.mp4', '.avi', '.mov', '.wmv', '.webm']
  },
  DOCUMENT: {
    mimeTypes: [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain'
    ],
    maxSize: 50 * 1024 * 1024, // 50MB
    extensions: ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.txt']
  },
  AUDIO: {
    mimeTypes: ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/mp3'],
    maxSize: 20 * 1024 * 1024, // 20MB
    extensions: ['.mp3', '.wav', '.ogg']
  }
} as const

export type MediaType = keyof typeof MEDIA_TYPES
export type MediaCategory = 'campaign' | 'template' | 'contact' | 'user' | 'system'

export interface MediaFile {
  id: string
  filename: string
  originalName: string
  mimeType: string
  size: number
  type: MediaType
  category: MediaCategory
  url: string
  thumbnailUrl?: string
  metadata: {
    width?: number
    height?: number
    duration?: number
    pages?: number
    compressed?: boolean
    optimized?: boolean
    quality?: number
  }
  userId: string
  tenantId: string
  uploadedAt: string
  expiresAt?: string
  tags: string[]
}

export interface UploadOptions {
  category: MediaCategory
  tags?: string[]
  compress?: boolean
  optimize?: boolean
  generateThumbnail?: boolean
  maxWidth?: number
  maxHeight?: number
  quality?: number
  expiresInDays?: number
}

export interface UploadResult {
  success: boolean
  media?: MediaFile
  error?: string
  jobId?: string
}

/**
 * Detecta o tipo de mídia baseado no MIME type
 */
export function detectMediaType(mimeType: string): MediaType | null {
  for (const [type, config] of Object.entries(MEDIA_TYPES)) {
    if (config.mimeTypes.includes(mimeType as any)) {
      return type as MediaType
    }
  }
  return null
}

/**
 * Valida arquivo antes do upload
 */
export function validateFile(file: File, options?: Partial<UploadOptions>): { valid: boolean; error?: string } {
  const mediaType = detectMediaType(file.type)
  
  if (!mediaType) {
    return { valid: false, error: 'Tipo de arquivo não suportado' }
  }

  const config = MEDIA_TYPES[mediaType]
  
  if (file.size > config.maxSize) {
    return { 
      valid: false, 
      error: `Arquivo muito grande. Máximo permitido: ${config.maxSize / (1024 * 1024)}MB` 
    }
  }

  return { valid: true }
}

/**
 * Gera um nome único para o arquivo
 */
export function generateFileName(originalName: string, mediaType: MediaType): string {
  const timestamp = Date.now()
  const randomString = Math.random().toString(36).substring(2, 15)
  const extension = originalName.split('.').pop() || MEDIA_TYPES[mediaType].extensions[0]
  return `${timestamp}-${randomString}.${extension}`
}

/**
 * Faz upload de arquivo para o Supabase Storage
 */
export async function uploadToStorage(
  file: File, 
  path: string,
  options?: { upsert?: boolean; contentType?: string }
): Promise<{ data: any; error: any }> {
  return monitorFunction(
    async () => {
      const { data, error } = await supabase.storage
        .from('media')
        .upload(path, file, {
          upsert: options?.upsert ?? false,
          contentType: options?.contentType || file.type,
          cacheControl: '3600'
        })

      return { data, error }
    },
    {
      functionName: 'uploadToStorage',
      category: 'media',
      metadata: { path, fileSize: file.size, contentType: file.type }
    }
  )()
}

/**
 * Registra mídia no banco de dados
 */
export async function registerMedia(
  mediaData: Omit<MediaFile, 'id' | 'uploadedAt'>
): Promise<MediaFile> {
  return monitorFunction(
    async () => {
      const mediaFile: MediaFile = {
        ...mediaData,
        id: uuidv4(),
        uploadedAt: new Date().toISOString()
      }

      const { data, error } = await supabase
        .from('media_files')
        .insert(mediaFile)
        .select()
        .single()

      if (error) {
        throw new Error(`Erro ao registrar mídia: ${error.message}`)
      }

      return data
    },
    {
      functionName: 'registerMedia',
      category: 'database',
      metadata: { 
        filename: mediaData.filename,
        type: mediaData.type,
        category: mediaData.category,
        size: mediaData.size
      }
    }
  )()
}

/**
 * Processa upload de mídia com validação e otimização
 */
export async function processMediaUpload(
  file: File,
  userId: string,
  tenantId: string,
  options: UploadOptions
): Promise<UploadResult> {
  return monitorFunction(
    async () => {
      try {
        // Validar arquivo
        const validation = validateFile(file, options)
        if (!validation.valid) {
          return { success: false, error: validation.error }
        }

        const mediaType = detectMediaType(file.type)!
        const fileName = generateFileName(file.name, mediaType)
        const storagePath = `${tenantId}/${options.category}/${fileName}`

        // Fazer upload para o storage
        const { data: uploadData, error: uploadError } = await uploadToStorage(
          file,
          storagePath,
          { contentType: file.type }
        )

        if (uploadError) {
          throw new Error(`Erro no upload: ${uploadError.message}`)
        }

        // Obter URL pública
        const { data: { publicUrl } } = supabase.storage
          .from('media')
          .getPublicUrl(storagePath)

        // Preparar dados da mídia
        const mediaFile: Omit<MediaFile, 'id' | 'uploadedAt'> = {
          filename: fileName,
          originalName: file.name,
          mimeType: file.type,
          size: file.size,
          type: mediaType,
          category: options.category,
          url: publicUrl,
          metadata: {
            quality: options.quality || 80
          },
          userId,
          tenantId,
          tags: options.tags || [],
          expiresAt: options.expiresInDays 
            ? new Date(Date.now() + options.expiresInDays * 24 * 60 * 60 * 1000).toISOString()
            : undefined
        }

        // Registrar no banco de dados
        const media = await registerMedia(mediaFile)

        // Adicionar trabalhos de processamento à fila se necessário
        const jobs = []

        if (options.compress && mediaType === 'IMAGE') {
          jobs.push(addQueueJob('media', 'compress', {
            mediaId: media.id,
            maxWidth: options.maxWidth,
            maxHeight: options.maxHeight,
            quality: options.quality
          }))
        }

        if (options.optimize && mediaType === 'IMAGE') {
          jobs.push(addQueueJob('media', 'optimize', {
            mediaId: media.id,
            format: 'webp'
          }))
        }

        if (options.generateThumbnail && mediaType === 'VIDEO') {
          jobs.push(addQueueJob('media', 'generateThumbnail', {
            mediaId: media.id
          }))
        }

        // Adicionar ao cache
        await redis.setex(
          `media:${media.id}`,
          3600, // 1 hora
          JSON.stringify(media)
        )

        return {
          success: true,
          media,
          jobId: jobs.length > 0 ? jobs[0].id : undefined
        }

      } catch (error) {
        console.error('Erro no processamento de mídia:', error)
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Erro desconhecido'
        }
      }
    },
    {
      functionName: 'processMediaUpload',
      category: 'media',
      metadata: { 
        filename: file.name,
        size: file.size,
        type: detectMediaType(file.type),
        category: options.category,
        userId,
        tenantId
      }
    }
  )()
}

/**
 * Obtém mídia por ID
 */
export async function getMediaById(
  mediaId: string,
  userId: string,
  tenantId: string
): Promise<MediaFile | null> {
  return monitorFunction(
    async () => {
      // Verificar cache primeiro
      const cached = await redis.get(`media:${mediaId}`)
      if (cached) {
        return JSON.parse(cached)
      }

      // Buscar no banco de dados
      const { data, error } = await supabase
        .from('media_files')
        .select('*')
        .eq('id', mediaId)
        .eq('tenantId', tenantId)
        .single()

      if (error || !data) {
        return null
      }

      // Verificar permissão
      if (data.userId !== userId && data.category !== 'system') {
        return null
      }

      // Armazenar em cache
      await redis.setex(`media:${mediaId}`, 3600, JSON.stringify(data))

      return data
    },
    {
      functionName: 'getMediaById',
      category: 'database',
      metadata: { mediaId, userId, tenantId }
    }
  )()
}

/**
 * Lista mídias do tenant
 */
export async function listMedia(
  tenantId: string,
  userId: string,
  options?: {
    category?: MediaCategory
    type?: MediaType
    tags?: string[]
    search?: string
    limit?: number
    offset?: number
  }
): Promise<MediaFile[]> {
  return monitorFunction(
    async () => {
      let query = supabase
        .from('media_files')
        .select('*')
        .eq('tenantId', tenantId)

      // Filtros
      if (options?.category) {
        query = query.eq('category', options.category)
      }

      if (options?.type) {
        query = query.eq('type', options.type)
      }

      if (options?.tags && options.tags.length > 0) {
        query = query.contains('tags', options.tags)
      }

      if (options?.search) {
        query = query.or(`originalName.ilike.%${options.search}%,filename.ilike.%${options.search}%`)
      }

      // Limitar acessos (usuários só veem suas próprias mídias ou mídias do sistema)
      if (userId) {
        query = query.or(`userId.eq.${userId},category.eq.system`)
      }

      // Paginação
      const limit = options?.limit || 50
      const offset = options?.offset || 0
      query = query.range(offset, offset + limit - 1)

      // Ordenação
      query = query.order('uploadedAt', { ascending: false })

      const { data, error } = await query

      if (error) {
        throw new Error(`Erro ao listar mídias: ${error.message}`)
      }

      return data || []
    },
    {
      functionName: 'listMedia',
      category: 'database',
      metadata: { 
        tenantId, 
        userId, 
        category: options?.category,
        type: options?.type,
        search: options?.search,
        limit: options?.limit,
        offset: options?.offset
      }
    }
  )()
}

/**
 * Remove mídia
 */
export async function deleteMedia(
  mediaId: string,
  userId: string,
  tenantId: string
): Promise<boolean> {
  return monitorFunction(
    async () => {
      // Obter mídia para verificar permissões
      const media = await getMediaById(mediaId, userId, tenantId)
      if (!media) {
        return false
      }

      // Verificar permissão
      if (media.userId !== userId && media.category !== 'system') {
        return false
      }

      // Remover do storage
      const storagePath = `${tenantId}/${media.category}/${media.filename}`
      const { error: storageError } = await supabase.storage
        .from('media')
        .remove([storagePath])

      if (storageError) {
        console.error('Erro ao remover do storage:', storageError)
      }

      // Remover do banco de dados
      const { error: dbError } = await supabase
        .from('media_files')
        .delete()
        .eq('id', mediaId)
        .eq('tenantId', tenantId)

      if (dbError) {
        throw new Error(`Erro ao remover mídia: ${dbError.message}`)
      }

      // Remover do cache
      await redis.del(`media:${mediaId}`)

      return true
    },
    {
      functionName: 'deleteMedia',
      category: 'media',
      metadata: { mediaId, userId, tenantId }
    }
  )()
}

/**
 * Atualiza metadados da mídia
 */
export async function updateMediaMetadata(
  mediaId: string,
  userId: string,
  tenantId: string,
  metadata: Partial<MediaFile['metadata']>
): Promise<MediaFile | null> {
  return monitorFunction(
    async () => {
      // Verificar permissão
      const media = await getMediaById(mediaId, userId, tenantId)
      if (!media || media.userId !== userId) {
        return null
      }

      const { data, error } = await supabase
        .from('media_files')
        .update({ metadata: { ...media.metadata, ...metadata } })
        .eq('id', mediaId)
        .eq('tenantId', tenantId)
        .select()
        .single()

      if (error) {
        throw new Error(`Erro ao atualizar metadados: ${error.message}`)
      }

      // Atualizar cache
      await redis.setex(`media:${mediaId}`, 3600, JSON.stringify(data))

      return data
    },
    {
      functionName: 'updateMediaMetadata',
      category: 'database',
      metadata: { mediaId, userId, tenantId, metadata }
    }
  )()
}

/**
 * Busca mídias por tags
 */
export async function searchMediaByTags(
  tenantId: string,
  tags: string[],
  userId?: string
): Promise<MediaFile[]> {
  return monitorFunction(
    async () => {
      let query = supabase
        .from('media_files')
        .select('*')
        .eq('tenantId', tenantId)
        .contains('tags', tags)

      if (userId) {
        query = query.or(`userId.eq.${userId},category.eq.system`)
      }

      const { data, error } = await query

      if (error) {
        throw new Error(`Erro ao buscar por tags: ${error.message}`)
      }

      return data || []
    },
    {
      functionName: 'searchMediaByTags',
      category: 'database',
      metadata: { tenantId, tags, userId }
    }
  )()
}

/**
 * Gera URL assinada para upload direto
 */
export async function generateUploadUrl(
  tenantId: string,
  fileName: string,
  contentType: string
): Promise<{ url: string; token: string } | null> {
  return monitorFunction(
    async () => {
      const path = `${tenantId}/temp/${fileName}`
      const token = uuidv4()
      
      // Criar URL assinada válida por 1 hora
      const { data, error } = await supabase.storage
        .from('media')
        .createSignedUploadUrl(path, { upsert: true })

      if (error) {
        throw new Error(`Erro ao gerar URL: ${error.message}`)
      }

      // Armazenar token no Redis com validade de 1 hora
      await redis.setex(
        `upload_token:${token}`,
        3600,
        JSON.stringify({ 
          path, 
          contentType, 
          tenantId,
          createdAt: new Date().toISOString()
        })
      )

      return {
        url: data.signedUploadUrl,
        token
      }
    },
    {
      functionName: 'generateUploadUrl',
      category: 'media',
      metadata: { tenantId, fileName, contentType }
    }
  )()
}

/**
 * Completa upload via URL assinada
 */
export async function completeUpload(
  token: string,
  userId: string,
  options: UploadOptions
): Promise<UploadResult> {
  return monitorFunction(
    async () => {
      // Verificar token
      const tokenData = await redis.get(`upload_token:${token}`)
      if (!tokenData) {
        return { success: false, error: 'Token inválido ou expirado' }
      }

      const { path, contentType, tenantId } = JSON.parse(tokenData)

      // Obter URL pública
      const { data: { publicUrl } } = supabase.storage
        .from('media')
        .getPublicUrl(path)

      // Detectar tipo de mídia
      const mediaType = detectMediaType(contentType)
      if (!mediaType) {
        return { success: false, error: 'Tipo de arquivo não suportado' }
      }

      // Obter informações do arquivo
      const { data: fileData, error: fileError } = await supabase.storage
        .from('media')
        .getStat(path)

      if (fileError) {
        return { success: false, error: 'Erro ao obter informações do arquivo' }
      }

      // Registrar mídia no banco de dados
      const mediaFile: Omit<MediaFile, 'id' | 'uploadedAt'> = {
        filename: path.split('/').pop()!,
        originalName: path.split('/').pop()!,
        mimeType: contentType,
        size: fileData.size,
        type: mediaType,
        category: options.category,
        url: publicUrl,
        metadata: {
          quality: options.quality || 80
        },
        userId,
        tenantId,
        tags: options.tags || [],
        expiresAt: options.expiresInDays 
          ? new Date(Date.now() + options.expiresInDays * 24 * 60 * 60 * 1000).toISOString()
          : undefined
      }

      const media = await registerMedia(mediaFile)

      // Limpar token
      await redis.del(`upload_token:${token}`)

      // Mover arquivo para localização final
      const finalPath = path.replace('/temp/', `/${options.category}/`)
      const { error: moveError } = await supabase.storage
        .from('media')
        .move(path, finalPath)

      if (moveError) {
        console.error('Erro ao mover arquivo:', moveError)
      }

      return {
        success: true,
        media
      }

    },
    {
      functionName: 'completeUpload',
      category: 'media',
      metadata: { token, userId, category: options.category }
    }
  )()
}