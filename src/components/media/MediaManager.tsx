import React, { useState, useMemo, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  Search, 
  Filter, 
  Grid, 
  List, 
  Image, 
  Video, 
  FileText, 
  Download, 
  Trash2, 
  Eye, 
  Copy,
  Upload,
  Calendar,
  Tag,
  X,
  RefreshCw,
  Plus,
  CheckCircle
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { format, formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { useMedia, MediaFile } from '@/hooks/useMedia'
import { MediaUpload } from './MediaUpload'

export interface MediaManagerProps {
  className?: string
  onMediaSelect?: (media: MediaFile) => void
  selectedMedia?: MediaFile[]
  allowMultiple?: boolean
  showUpload?: boolean
  maxFileSize?: number
  allowedTypes?: string[]
}

const MEDIA_TYPES = {
  all: { label: 'Todos', icon: null, color: 'bg-gray-500' },
  image: { label: 'Imagens', icon: Image, color: 'bg-blue-500' },
  video: { label: 'Vídeos', icon: Video, color: 'bg-purple-500' },
  document: { label: 'Documentos', icon: FileText, color: 'bg-orange-500' }
}

const VIEW_MODES = {
  grid: { label: 'Grade', icon: Grid },
  list: { label: 'Lista', icon: List }
}

export function MediaManager({
  className,
  onMediaSelect,
  selectedMedia = [],
  allowMultiple = false,
  showUpload = true,
  maxFileSize,
  allowedTypes
}: MediaManagerProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedType, setSelectedType] = useState<keyof typeof MEDIA_TYPES>('all')
  const [viewMode, setViewMode] = useState<keyof typeof VIEW_MODES>('grid')
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [dateRange, setDateRange] = useState<{ start?: Date; end?: Date }>({})
  const [showFilters, setShowFilters] = useState(false)
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [localSelectedMedia, setLocalSelectedMedia] = useState<MediaFile[]>(selectedMedia)

  const {
    media,
    isLoading,
    error,
    uploadMedia,
    deleteMedia,
    searchMedia,
    refreshMedia
  } = useMedia()

  // Atualizar mídia selecionada quando props mudar
  useEffect(() => {
    setLocalSelectedMedia(selectedMedia)
  }, [selectedMedia])

  // Filtrar mídia
  const filteredMedia = useMemo(() => {
    let filtered = media

    // Filtro por tipo
    if (selectedType !== 'all') {
      filtered = filtered.filter(item => item.type === selectedType)
    }

    // Filtro por busca
    if (searchTerm) {
      filtered = filtered.filter(item =>
        item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.tags?.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase())) ||
        item.category?.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    // Filtro por tags
    if (selectedTags.length > 0) {
      filtered = filtered.filter(item =>
        selectedTags.some(tag => item.tags?.includes(tag))
      )
    }

    // Filtro por data
    if (dateRange.start || dateRange.end) {
      filtered = filtered.filter(item => {
        const itemDate = new Date(item.createdAt)
        if (dateRange.start && itemDate < dateRange.start) return false
        if (dateRange.end && itemDate > dateRange.end) return false
        return true
      })
    }

    return filtered
  }, [media, selectedType, searchTerm, selectedTags, dateRange])

  // Obter todas as tags únicas
  const allTags = useMemo(() => {
    const tags = new Set<string>()
    media.forEach(item => {
      item.tags?.forEach(tag => tags.add(tag))
    })
    return Array.from(tags).sort()
  }, [media])

  const handleMediaSelect = (mediaItem: MediaFile) => {
    if (allowMultiple) {
      const isSelected = localSelectedMedia.some(item => item.id === mediaItem.id)
      if (isSelected) {
        setLocalSelectedMedia(prev => prev.filter(item => item.id !== mediaItem.id))
      } else {
        setLocalSelectedMedia(prev => [...prev, mediaItem])
      }
    } else {
      setLocalSelectedMedia([mediaItem])
      onMediaSelect?.(mediaItem)
    }
  }

  const handleDelete = async (mediaId: string) => {
    if (confirm('Tem certeza que deseja excluir esta mídia?')) {
      try {
        await deleteMedia(mediaId)
        toast.success('Mídia excluída com sucesso')
      } catch (err) {
        toast.error('Erro ao excluir mídia')
      }
    }
  }

  const handleDownload = async (mediaItem: MediaFile) => {
    try {
      const response = await fetch(mediaItem.url)
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = mediaItem.name
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast.success('Mídia baixada com sucesso')
    } catch (err) {
      toast.error('Erro ao baixar mídia')
    }
  }

  const handleCopyUrl = (url: string) => {
    navigator.clipboard.writeText(url)
    toast.success('URL copiada para a área de transferência')
  }

  const clearFilters = () => {
    setSearchTerm('')
    setSelectedType('all')
    setSelectedTags([])
    setDateRange({})
  }

  const renderMediaItem = (item: MediaFile) => {
    const isSelected = localSelectedMedia.some(selected => selected.id === item.id)
    const MediaIcon = MEDIA_TYPES[item.type as keyof typeof MEDIA_TYPES]?.icon || FileText

    if (viewMode === 'grid') {
      return (
        <div
          key={item.id}
          className={cn(
            "relative group cursor-pointer rounded-lg border-2 transition-all",
            isSelected ? "border-blue-500 ring-2 ring-blue-200" : "border-gray-200 hover:border-gray-300"
          )}
          onClick={() => handleMediaSelect(item)}
        >
          <div className="aspect-square relative overflow-hidden rounded-lg">
            {item.type === 'image' ? (
              <img
                src={item.url}
                alt={item.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-gray-100 flex items-center justify-center">
                <MediaIcon className="w-12 h-12 text-gray-400" />
              </div>
            )}
            
            {/* Overlay de ações */}
            <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-50 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  className="bg-white bg-opacity-90 hover:bg-opacity-100"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleDownload(item)
                  }}
                >
                  <Download className="w-4 h-4" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="bg-white bg-opacity-90 hover:bg-opacity-100"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleCopyUrl(item.url)
                  }}
                >
                  <Copy className="w-4 h-4" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="bg-white bg-opacity-90 hover:bg-opacity-100 text-red-600"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleDelete(item.id)
                  }}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Badge de seleção */}
            {isSelected && (
              <div className="absolute top-2 right-2 bg-blue-500 text-white rounded-full p-1">
                <CheckCircle className="w-4 h-4" />
              </div>
            )}
          </div>

          <div className="p-3">
            <h4 className="font-medium text-sm truncate">{item.name}</h4>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="outline" className="text-xs">
                {(item.size / 1024 / 1024).toFixed(1)} MB
              </Badge>
              <span className="text-xs text-gray-500">
                {formatDistanceToNow(new Date(item.createdAt), { locale: ptBR, addSuffix: true })}
              </span>
            </div>
            {item.tags && item.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {item.tags.slice(0, 2).map(tag => (
                  <Badge key={tag} variant="secondary" className="text-xs">
                    {tag}
                  </Badge>
                ))}
                {item.tags.length > 2 && (
                  <Badge variant="secondary" className="text-xs">
                    +{item.tags.length - 2}
                  </Badge>
                )}
              </div>
            )}
          </div>
        </div>
      )
    }

    // Modo lista
    return (
      <div
        key={item.id}
        className={cn(
          "flex items-center gap-4 p-4 rounded-lg border-2 transition-all",
          isSelected ? "border-blue-500 ring-2 ring-blue-200" : "border-gray-200 hover:border-gray-300"
        )}
        onClick={() => handleMediaSelect(item)}
      >
        <div className="w-12 h-12 flex-shrink-0">
          {item.type === 'image' ? (
            <img
              src={item.url}
              alt={item.name}
              className="w-full h-full object-cover rounded-lg"
            />
          ) : (
            <div className="w-full h-full bg-gray-100 rounded-lg flex items-center justify-center">
              <MediaIcon className="w-6 h-6 text-gray-400" />
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <h4 className="font-medium truncate">{item.name}</h4>
          <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
            <span>{(item.size / 1024 / 1024).toFixed(1)} MB</span>
            <span>{format(new Date(item.createdAt), 'dd/MM/yyyy', { locale: ptBR })}</span>
            {item.category && <Badge variant="outline">{item.category}</Badge>}
          </div>
          {item.tags && item.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {item.tags.map(tag => (
                <Badge key={tag} variant="secondary" className="text-xs">
                  {tag}
                </Badge>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation()
              handleDownload(item)
            }}
          >
            <Download className="w-4 h-4" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation()
              handleCopyUrl(item.url)
            }}
          >
            <Copy className="w-4 h-4" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="text-red-600"
            onClick={(e) => {
              e.stopPropagation()
              handleDelete(item.id)
            }}
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>
    )
  }

  return (
    <Card className={cn("w-full", className)}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Gerenciamento de Mídia</CardTitle>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={refreshMedia}
              disabled={isLoading}
            >
              <RefreshCw className={cn("w-4 h-4", isLoading && "animate-spin")} />
            </Button>
            {showUpload && (
              <Button
                size="sm"
                onClick={() => setShowUploadModal(true)}
              >
                <Plus className="w-4 h-4 mr-1" />
                Upload
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Barra de busca e filtros */}
        <div className="flex items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Buscar por nome, tags ou categoria..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Button
            variant="outline"
            onClick={() => setShowFilters(!showFilters)}
            className={cn(showFilters && "bg-gray-100")}
          >
            <Filter className="w-4 h-4 mr-2" />
            Filtros
          </Button>
          <div className="flex items-center gap-1">
            {Object.entries(VIEW_MODES).map(([mode, config]) => {
              const Icon = config.icon
              return (
                <Button
                  key={mode}
                  size="sm"
                  variant={viewMode === mode ? "default" : "outline"}
                  onClick={() => setViewMode(mode as keyof typeof VIEW_MODES)}
                >
                  <Icon className="w-4 h-4" />
                </Button>
              )
            })}
          </div>
        </div>

        {/* Filtros avançados */}
        {showFilters && (
          <div className="p-4 bg-gray-50 rounded-lg space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Filtro por tipo */}
              <div>
                <label className="block text-sm font-medium mb-2">Tipo</label>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(MEDIA_TYPES).map(([type, config]) => {
                    const Icon = config.icon
                    return (
                      <Button
                        key={type}
                        size="sm"
                        variant={selectedType === type ? "default" : "outline"}
                        onClick={() => setSelectedType(type as keyof typeof MEDIA_TYPES)}
                      >
                        {Icon && <Icon className="w-3 h-3 mr-1" />}
                        {config.label}
                      </Button>
                    )
                  })}
                </div>
              </div>

              {/* Filtro por tags */}
              <div>
                <label className="block text-sm font-medium mb-2">Tags</label>
                <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                  {allTags.map(tag => (
                    <Badge
                      key={tag}
                      variant={selectedTags.includes(tag) ? "default" : "outline"}
                      className="cursor-pointer"
                      onClick={() => {
                        setSelectedTags(prev =>
                          prev.includes(tag)
                            ? prev.filter(t => t !== tag)
                            : [...prev, tag]
                        )
                      }}
                    >
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Ações */}
              <div className="flex items-end">
                <Button variant="outline" onClick={clearFilters}>
                  <X className="w-4 h-4 mr-2" />
                  Limpar Filtros
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Status */}
        <div className="flex items-center justify-between text-sm text-gray-600">
          <span>{filteredMedia.length} mídia(s) encontrada(s)</span>
          {localSelectedMedia.length > 0 && (
            <span className="font-medium">
              {localSelectedMedia.length} selecionada(s)
            </span>
          )}
        </div>

        {/* Erro */}
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Grid de mídia */}
        {viewMode === 'grid' ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {filteredMedia.map(renderMediaItem)}
          </div>
        ) : (
          <div className="space-y-2">
            {filteredMedia.map(renderMediaItem)}
          </div>
        )}

        {/* Loading */}
        {isLoading && (
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        )}

        {/* Empty state */}
        {!isLoading && filteredMedia.length === 0 && (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Image className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Nenhuma mídia encontrada
            </h3>
            <p className="text-gray-500 mb-4">
              Tente ajustar seus filtros ou fazer upload de nova mídia
            </p>
            {showUpload && (
              <Button onClick={() => setShowUploadModal(true)}>
                <Upload className="w-4 h-4 mr-2" />
                Fazer Upload
              </Button>
            )}
          </div>
        )}
      </CardContent>

      {/* Modal de upload */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Upload de Mídia</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowUploadModal(false)}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
            <MediaUpload
              maxFileSize={maxFileSize}
              allowedTypes={allowedTypes}
              onUploadComplete={async () => {
                setShowUploadModal(false)
                await refreshMedia()
              }}
            />
          </div>
        </div>
      )}
    </Card>
  )
}