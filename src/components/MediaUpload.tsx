import { useState, useRef, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Paperclip,
  Image,
  FileText,
  Mic,
  Video,
  X,
  Upload,
  Loader2
} from 'lucide-react'
import { MediaFile } from '@/hooks/useMessages'

interface MediaUploadProps {
  onMediaSelect: (media: MediaFile) => void
  onRemoveMedia: () => void
  selectedMedia?: MediaFile
  disabled?: boolean
  uploadProgress?: number
}

export function MediaUpload({ 
  onMediaSelect, 
  onRemoveMedia, 
  selectedMedia, 
  disabled = false,
  uploadProgress = 0
}: MediaUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)

  const handleFileSelect = useCallback((file: File) => {
    const mediaType = getMediaType(file.type)
    if (!mediaType) {
      alert('Tipo de arquivo não suportado')
      return
    }

    const mediaFile: MediaFile = {
      file,
      type: mediaType
    }

    // Criar preview para imagens
    if (mediaType === 'image') {
      const reader = new FileReader()
      reader.onload = (e) => {
        mediaFile.preview = e.target?.result as string
        onMediaSelect(mediaFile)
      }
      reader.readAsDataURL(file)
    } else {
      onMediaSelect(mediaFile)
    }
  }, [onMediaSelect])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    
    const files = Array.from(e.dataTransfer.files)
    if (files.length > 0) {
      handleFileSelect(files[0])
    }
  }, [handleFileSelect])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
  }, [])

  const getMediaType = (mimeType: string): MediaFile['type'] | null => {
    if (mimeType.startsWith('image/')) return 'image'
    if (mimeType.startsWith('audio/')) return 'audio'
    if (mimeType.startsWith('video/')) return 'video'
    if (mimeType.includes('pdf') || mimeType.includes('document') || mimeType.includes('text')) return 'document'
    return null
  }

  const getMediaIcon = (type: MediaFile['type']) => {
    switch (type) {
      case 'image': return <Image className="h-4 w-4" />
      case 'document': return <FileText className="h-4 w-4" />
      case 'audio': return <Mic className="h-4 w-4" />
      case 'video': return <Video className="h-4 w-4" />
      default: return <Paperclip className="h-4 w-4" />
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  if (selectedMedia) {
    return (
      <Card className="w-full">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              {getMediaIcon(selectedMedia.type)}
              <div>
                <p className="font-medium">{selectedMedia.file.name}</p>
                <p className="text-sm text-muted-foreground">
                  {formatFileSize(selectedMedia.file.size)} • {selectedMedia.type}
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onRemoveMedia}
              disabled={disabled}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          
          {selectedMedia.preview && (
            <div className="mt-3">
              <img 
                src={selectedMedia.preview} 
                alt="Preview" 
                className="max-w-full h-32 object-cover rounded-md"
              />
            </div>
          )}

          {uploadProgress > 0 && uploadProgress < 100 && (
            <div className="mt-3">
              <div className="flex items-center justify-between text-sm mb-1">
                <span>Enviando...</span>
                <span>{Math.round(uploadProgress)}%</span>
              </div>
              <Progress value={uploadProgress} className="h-2" />
            </div>
          )}
        </CardContent>
      </Card>
    )
  }

  return (
    <div
      className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
        dragOver 
          ? 'border-primary bg-primary/5' 
          : 'border-muted-foreground/25 hover:border-muted-foreground/50'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onClick={() => !disabled && fileInputRef.current?.click()}
    >
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept="image/*,audio/*,video/*,.pdf,.doc,.docx,.txt"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) handleFileSelect(file)
        }}
        disabled={disabled}
      />
      
      <div className="space-y-2">
        <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
        <div>
          <p className="font-medium">Clique para selecionar ou arraste um arquivo</p>
          <p className="text-sm text-muted-foreground">
            Suporta imagens, documentos, áudio e vídeo
          </p>
        </div>
        <div className="flex justify-center space-x-2 mt-3">
          <Badge variant="outline" className="text-xs">
            <Image className="h-3 w-3 mr-1" />
            Imagens
          </Badge>
          <Badge variant="outline" className="text-xs">
            <FileText className="h-3 w-3 mr-1" />
            Documentos
          </Badge>
          <Badge variant="outline" className="text-xs">
            <Mic className="h-3 w-3 mr-1" />
            Áudio
          </Badge>
          <Badge variant="outline" className="text-xs">
            <Video className="h-3 w-3 mr-1" />
            Vídeo
          </Badge>
        </div>
      </div>
    </div>
  )
}

interface BulkMessageDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSend: (data: {
    contacts: string[]
    message: string
    mediaFile?: MediaFile
    scheduledAt?: Date
  }) => void
  loading?: boolean
}

export function BulkMessageDialog({ 
  open, 
  onOpenChange, 
  onSend, 
  loading = false 
}: BulkMessageDialogProps) {
  const [contacts, setContacts] = useState('')
  const [message, setMessage] = useState('')
  const [selectedMedia, setSelectedMedia] = useState<MediaFile>()
  const [scheduledAt, setScheduledAt] = useState('')
  const [sendType, setSendType] = useState<'immediate' | 'scheduled'>('immediate')

  const handleSend = () => {
    const contactList = contacts
      .split('\n')
      .map(c => c.trim())
      .filter(c => c.length > 0)

    if (contactList.length === 0 || !message.trim()) {
      alert('Preencha os contatos e a mensagem')
      return
    }

    onSend({
      contacts: contactList,
      message: message.trim(),
      mediaFile: selectedMedia,
      scheduledAt: sendType === 'scheduled' && scheduledAt 
        ? new Date(scheduledAt) 
        : undefined
    })

    // Reset form
    setContacts('')
    setMessage('')
    setSelectedMedia(undefined)
    setScheduledAt('')
    setSendType('immediate')
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Envio em Massa</DialogTitle>
          <DialogDescription>
            Envie mensagens para múltiplos contatos de uma vez
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Tipo de Envio</Label>
            <Select value={sendType} onValueChange={(value: any) => setSendType(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="immediate">Enviar Agora</SelectItem>
                <SelectItem value="scheduled">Agendar Envio</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {sendType === 'scheduled' && (
            <div className="space-y-2">
              <Label>Data e Hora do Envio</Label>
              <Input
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
                min={new Date().toISOString().slice(0, 16)}
              />
            </div>
          )}

          <div className="space-y-2">
            <Label>Contatos (um por linha)</Label>
            <textarea
              className="w-full h-32 p-3 border rounded-md resize-none"
              placeholder="5511999999999&#10;5511888888888&#10;5511777777777"
              value={contacts}
              onChange={(e) => setContacts(e.target.value)}
            />
            <p className="text-sm text-muted-foreground">
              {contacts.split('\n').filter(c => c.trim()).length} contatos
            </p>
          </div>

          <div className="space-y-2">
            <Label>Mensagem</Label>
            <textarea
              className="w-full h-24 p-3 border rounded-md resize-none"
              placeholder="Digite sua mensagem aqui..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Mídia (opcional)</Label>
            <MediaUpload
              onMediaSelect={setSelectedMedia}
              onRemoveMedia={() => setSelectedMedia(undefined)}
              selectedMedia={selectedMedia}
              disabled={loading}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSend} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                {sendType === 'scheduled' ? 'Agendando...' : 'Enviando...'}
              </>
            ) : (
              sendType === 'scheduled' ? 'Agendar Envio' : 'Enviar Agora'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}