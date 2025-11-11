/**
 * Componente de Upload de Mídia
 * 
 * Interface drag-and-drop para upload de arquivos com:
 * - Preview de arquivos
 * - Barra de progresso
 * - Validação em tempo real
 * - Suporte a múltiplos formatos
 * - Upload assíncrono
 */

import React, { useState, useCallback, useRef, DragEvent, ChangeEvent } from 'react'
import { useDropzone } from 'react-dropzone'
import { Upload, X, File, Image, Video, FileText, Music, AlertCircle, CheckCircle } from 'lucide-react'
import { useMedia } from '@/hooks/useMedia'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

export interface MediaUploadProps {
  category: 'campaign' | 'template' | 'contact' | 'user' | 'system'
  accept?: string[]
  maxSize?: number
  multiple?: boolean
  onUploadComplete?: (files: any[]) => void
  onUploadError?: (error: string) => void
  tags?: string[]
  compress?: boolean
  optimize?: boolean
  generateThumbnail?: boolean
  className?: string
}

interface UploadingFile {
  id: string
  file: File
  progress: number
  status: 'pending' | 'uploading' | 'success' | 'error'
  error?: string
  result?: any
}

const MEDIA_ICONS = {
  image: Image,
  video: Video,
  document: FileText,
  audio: Music,
  file: File
}

const MEDIA_COLORS = {
  image: 'text-green-600 bg-green-50 border-green-200',
  video: 'text-purple-600 bg-purple-50 border-purple-200',
  document: 'text-blue-600 bg-blue-50 border-blue-200',
  audio: 'text-orange-600 bg-orange-50 border-orange-200',
  file: 'text-gray-600 bg-gray-50 border-gray-200'
}

export function MediaUpload({
  category,
  accept = ['*/*'],
  maxSize = 100 * 1024 * 1024, // 100MB default
  multiple = true,
  onUploadComplete,
  onUploadError,
  tags = [],
  compress = true,
  optimize = true,
  generateThumbnail = true,
  className
}: MediaUploadProps) {
  const { uploadFile, uploading, uploadProgress } = useMedia()
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([])
  const [isDragOver, setIsDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  /**
   * Detecta o tipo de mídia baseado no arquivo
   */
  const getFileType = useCallback((file: File): keyof typeof MEDIA_ICONS => {
    const mimeType = file.type.toLowerCase()
    
    if (mimeType.startsWith('image/')) return 'image'
    if (mimeType.startsWith('video/')) return 'video'
    if (mimeType.startsWith('audio/')) return 'audio'
    if (mimeType.includes('pdf') || mimeType.includes('document')) return 'document'
    return 'file'
  }, [])

  /**
   * Valida arquivo antes do upload
   */
  const validateFile = useCallback((file: File): { valid: boolean; error?: string } => {
    if (file.size > maxSize) {
      return { 
        valid: false, 
        error: `Arquivo muito grande. Máximo: ${(maxSize / (1024 * 1024)).toFixed(0)}MB` 
      }
    }

    // Verificar tipos aceitos
    if (accept.length > 0 && !accept.includes('*/*')) {
      const isAccepted = accept.some(type => {
        if (type.includes('*')) {
          const [mainType] = file.type.split('/')
          return type.startsWith(mainType)
        }
        return file.type === type
      })

      if (!isAccepted) {
        return { 
          valid: false, 
          error: `Tipo de arquivo não aceito: ${file.type}` 
        }
      }
    }

    return { valid: true }
  }, [accept, maxSize])

  /**
   * Processa upload de arquivo individual
   */
  const processFileUpload = useCallback(async (
    uploadingFile: UploadingFile
  ): Promise<void> => {
    const validation = validateFile(uploadingFile.file)
    
    if (!validation.valid) {
      setUploadingFiles(prev => 
        prev.map(f => 
          f.id === uploadingFile.id 
            ? { ...f, status: 'error', error: validation.error }
            : f
        )
      )
      onUploadError?.(validation.error!)
      return
    }

    setUploadingFiles(prev => 
      prev.map(f => 
        f.id === uploadingFile.id 
          ? { ...f, status: 'uploading', progress: 0 }
          : f
      )
    )

    try {
      const result = await uploadFile(uploadingFile.file, {
        category,
        tags,
        compress,
        optimize,
        generateThumbnail
      })

      if (result.success) {
        setUploadingFiles(prev => 
          prev.map(f => 
            f.id === uploadingFile.id 
              ? { ...f, status: 'success', progress: 100, result: result.media }
              : f
          )
        )
        
        toast.success(`Arquivo ${uploadingFile.file.name} enviado com sucesso!`)
      } else {
        setUploadingFiles(prev => 
          prev.map(f => 
            f.id === uploadingFile.id 
              ? { ...f, status: 'error', error: result.error }
              : f
          )
        )
        
        toast.error(`Erro ao enviar ${uploadingFile.file.name}: ${result.error}`)
        onUploadError?.(result.error!)
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido'
      
      setUploadingFiles(prev => 
        prev.map(f => 
          f.id === uploadingFile.id 
            ? { ...f, status: 'error', error: errorMessage }
            : f
        )
      )
      
      toast.error(`Erro ao enviar ${uploadingFile.file.name}: ${errorMessage}`)
      onUploadError?.(errorMessage)
    }
  }, [uploadFile, category, tags, compress, optimize, generateThumbnail, validateFile, onUploadError])

  /**
   * Processa múltiplos arquivos
   */
  const processFiles = useCallback(async (files: File[]): Promise<void> => {
    const newFiles: UploadingFile[] = files.map(file => ({
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      file,
      progress: 0,
      status: 'pending'
    }))

    setUploadingFiles(prev => [...prev, ...newFiles])

    // Processar arquivos em paralelo (limitado a 3 simultâneos)
    const batchSize = 3
    for (let i = 0; i < newFiles.length; i += batchSize) {
      const batch = newFiles.slice(i, i + batchSize)
      await Promise.all(batch.map(file => processFileUpload(file)))
    }

    // Notificar conclusão
    const successfulUploads = newFiles.filter(f => f.status === 'success')
    if (successfulUploads.length > 0) {
      onUploadComplete?.(successfulUploads.map(f => f.result))
    }
  }, [processFileUpload, onUploadComplete])

  /**
   * Manipula eventos de drag and drop
   */
  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragOver(false)
  }, [])

  const handleDrop = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragOver(false)
    
    const files = Array.from(e.dataTransfer.files)
    if (files.length > 0) {
      processFiles(files)
    }
  }, [processFiles])

  /**
   * Manipula seleção de arquivo via input
   */
  const handleFileSelect = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length > 0) {
      processFiles(files)
    }
    
    // Limpar input para permitir re-upload do mesmo arquivo
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }, [processFiles])

  /**
   * Remove arquivo da lista de upload
   */
  const removeFile = useCallback((fileId: string) => {
    setUploadingFiles(prev => prev.filter(f => f.id !== fileId))
  }, [])

  /**
   * Abre seletor de arquivos
   */
  const openFileSelector = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  return (
    <div className={cn('w-full', className)}>
      {/* Área de upload */}
      <div
        className={cn(
          'border-2 border-dashed rounded-lg p-8 text-center transition-all duration-200',
          'hover:border-blue-400 hover:bg-blue-50',
          isDragOver && 'border-blue-500 bg-blue-50',
          uploading && 'opacity-50 pointer-events-none'
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div className="flex flex-col items-center space-y-4">
          <div className="p-3 bg-blue-100 rounded-full">
            <Upload className="w-8 h-8 text-blue-600" />
          </div>
          
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Arraste arquivos aqui ou clique para selecionar
            </h3>
            <p className="text-sm text-gray-500">
              Suporta múltiplos formatos. Máximo: {(maxSize / (1024 * 1024)).toFixed(0)}MB por arquivo
            </p>
          </div>

          <button
            onClick={openFileSelector}
            disabled={uploading}
            className={cn(
              'px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700',
              'transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed'
            )}
          >
            {uploading ? 'Enviando...' : 'Selecionar Arquivos'}
          </button>
        </div>

        {/* Barra de progresso global */}
        {uploading && uploadingFiles.length > 0 && (
          <div className="mt-4">
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
            <p className="text-sm text-gray-600 mt-2">
              Enviando arquivos... {uploadProgress}%
            </p>
          </div>
        )}
      </div>

      {/* Input oculto */}
      <input
        ref={fileInputRef}
        type="file"
        multiple={multiple}
        accept={accept.join(',')}
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* Lista de arquivos em upload */}
      {uploadingFiles.length > 0 && (
        <div className="mt-6 space-y-2">
          <h4 className="text-sm font-medium text-gray-900 mb-3">
            Arquivos em processamento ({uploadingFiles.length})
          </h4>
          
          {uploadingFiles.map((uploadingFile) => {
            const Icon = MEDIA_ICONS[getFileType(uploadingFile.file)]
            const colorClass = MEDIA_COLORS[getFileType(uploadingFile.file)]
            
            return (
              <div
                key={uploadingFile.id}
                className={cn(
                  'flex items-center justify-between p-3 rounded-lg border',
                  colorClass
                )}
              >
                <div className="flex items-center space-x-3 flex-1">
                  <Icon className="w-5 h-5" />
                  
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {uploadingFile.file.name}
                    </p>
                    <p className="text-xs text-gray-500">
                      {(uploadingFile.file.size / 1024 / 1024).toFixed(1)} MB
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  {/* Status */}
                  {uploadingFile.status === 'uploading' && (
                    <div className="flex items-center space-x-2">
                      <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                      <span className="text-xs text-blue-600">
                        {uploadingFile.progress}%
                      </span>
                    </div>
                  )}
                  
                  {uploadingFile.status === 'success' && (
                    <CheckCircle className="w-5 h-5 text-green-600" />
                  )}
                  
                  {uploadingFile.status === 'error' && (
                    <div className="flex items-center space-x-1">
                      <AlertCircle className="w-5 h-5 text-red-600" />
                      <span className="text-xs text-red-600 max-w-32 truncate">
                        {uploadingFile.error}
                      </span>
                    </div>
                  )}

                  {/* Botão remover */}
                  {(uploadingFile.status === 'pending' || uploadingFile.status === 'error') && (
                    <button
                      onClick={() => removeFile(uploadingFile.id)}
                      className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Informações de tipos suportados */}
      <div className="mt-4 text-xs text-gray-500">
        <p className="font-medium mb-1">Formatos suportados:</p>
        <div className="grid grid-cols-2 gap-1">
          <div>• Imagens: JPG, PNG, GIF, WebP, SVG</div>
          <div>• Vídeos: MP4, AVI, MOV, WebM</div>
          <div>• Documentos: PDF, DOC, XLS, TXT</div>
          <div>• Áudio: MP3, WAV, OGG</div>
        </div>
      </div>
    </div>
  )
}