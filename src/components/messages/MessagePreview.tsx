import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  MessageCircle, 
  Mail, 
  Smartphone, 
  Eye, 
  Send, 
  Save, 
  Copy, 
  Download,
  AlertCircle,
  CheckCircle,
  XCircle,
  RefreshCw
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

export interface MessagePreviewData {
  content: string
  channel: 'whatsapp' | 'email' | 'sms'
  recipient?: string
  subject?: string
  templateId?: string
  variables?: Record<string, any>
  media?: Array<{
    url: string
    type: 'image' | 'video' | 'document'
    caption?: string
  }>
  attachments?: Array<{
    name: string
    size: number
    type: string
  }>
}

export interface MessagePreviewProps {
  data: MessagePreviewData
  onSend?: () => Promise<void>
  onSave?: () => Promise<void>
  onCopy?: () => void
  onDownload?: () => void
  onRefresh?: () => void
  isLoading?: boolean
  error?: string | null
  warnings?: string[]
  className?: string
  showActions?: boolean
}

const CHANNEL_CONFIGS = {
  whatsapp: {
    name: 'WhatsApp',
    icon: MessageCircle,
    color: 'bg-green-500',
    maxLength: 4096,
    supportsMedia: true,
    supportsVariables: true
  },
  email: {
    name: 'E-mail',
    icon: Mail,
    color: 'bg-blue-500',
    maxLength: 10000,
    supportsMedia: false,
    supportsVariables: true,
    supportsSubject: true,
    supportsAttachments: true
  },
  sms: {
    name: 'SMS',
    icon: Smartphone,
    color: 'bg-purple-500',
    maxLength: 160,
    supportsMedia: false,
    supportsVariables: true
  }
}

export function MessagePreview({
  data,
  onSend,
  onSave,
  onCopy,
  onDownload,
  onRefresh,
  isLoading = false,
  error = null,
  warnings = [],
  className,
  showActions = true
}: MessagePreviewProps) {
  const [processedContent, setProcessedContent] = useState('')
  const [processedSubject, setProcessedSubject] = useState('')
  const [characterCount, setCharacterCount] = useState(0)
  const [isNearLimit, setIsNearLimit] = useState(false)

  const channelConfig = CHANNEL_CONFIGS[data.channel]
  const Icon = channelConfig.icon

  // Processar variáveis no conteúdo
  useEffect(() => {
    let content = data.content
    let subject = data.subject || ''

    if (data.variables) {
      Object.entries(data.variables).forEach(([key, value]) => {
        const placeholder = `{{${key}}}`
        content = content.replace(new RegExp(placeholder, 'g'), String(value))
        subject = subject.replace(new RegExp(placeholder, 'g'), String(value))
      })
    }

    setProcessedContent(content)
    setProcessedSubject(subject)
    setCharacterCount(content.length)
    setIsNearLimit(content.length > channelConfig.maxLength * 0.9)
  }, [data.content, data.subject, data.variables, channelConfig.maxLength])

  const handleCopy = () => {
    if (onCopy) {
      onCopy()
    } else {
      navigator.clipboard.writeText(processedContent)
      toast.success('Conteúdo copiado para a área de transferência')
    }
  }

  const handleDownload = () => {
    if (onDownload) {
      onDownload()
    } else {
      const content = data.subject 
        ? `Assunto: ${data.subject}\n\n${processedContent}`
        : processedContent

      const blob = new Blob([content], { type: 'text/plain' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `mensagem-${data.channel}-${new Date().toISOString()}.txt`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast.success('Mensagem baixada com sucesso')
    }
  }

  const handleSend = async () => {
    if (onSend) {
      try {
        await onSend()
        toast.success('Mensagem enviada com sucesso')
      } catch (err) {
        toast.error('Erro ao enviar mensagem')
      }
    }
  }

  const handleSave = async () => {
    if (onSave) {
      try {
        await onSave()
        toast.success('Mensagem salva com sucesso')
      } catch (err) {
        toast.error('Erro ao salvar mensagem')
      }
    }
  }

  const renderWhatsAppPreview = () => (
    <div className="bg-gray-50 p-4 rounded-lg">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 max-w-sm mx-auto">
        <div className="bg-green-500 text-white p-3 rounded-t-lg">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center">
              <MessageCircle className="w-4 h-4" />
            </div>
            <div>
              <p className="text-sm font-medium">{data.recipient || 'Destinatário'}</p>
              <p className="text-xs opacity-90">Online</p>
            </div>
          </div>
        </div>
        
        <div className="p-4 space-y-3">
          <div className="bg-gray-100 rounded-lg p-3 max-w-[80%]">
            <p className="text-sm text-gray-800 whitespace-pre-wrap">{processedContent}</p>
          </div>
          
          {data.media && data.media.map((media, index) => (
            <div key={index} className="space-y-2">
              {media.type === 'image' && (
                <img 
                  src={media.url} 
                  alt="Imagem" 
                  className="rounded-lg max-w-[200px]"
                />
              )}
              {media.type === 'video' && (
                <video 
                  src={media.url} 
                  controls 
                  className="rounded-lg max-w-[200px]"
                />
              )}
              {media.caption && (
                <p className="text-xs text-gray-600">{media.caption}</p>
              )}
            </div>
          ))}
        </div>
        
        <div className="p-3 border-t border-gray-200">
          <div className="flex items-center gap-2 text-gray-400">
            <span className="text-xs">Digite uma mensagem...</span>
          </div>
        </div>
      </div>
    </div>
  )

  const renderEmailPreview = () => (
    <div className="bg-gray-50 p-4 rounded-lg">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 max-w-2xl mx-auto">
        <div className="border-b border-gray-200 p-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-600">Para:</span>
              <span className="text-sm text-gray-800">{data.recipient || 'destinatario@email.com'}</span>
            </div>
            {processedSubject && (
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-600">Assunto:</span>
                <span className="text-sm text-gray-800">{processedSubject}</span>
              </div>
            )}
          </div>
        </div>
        
        <div className="p-6">
          <div className="prose prose-sm max-w-none">
            <div className="text-gray-800 whitespace-pre-wrap">{processedContent}</div>
          </div>
          
          {data.attachments && data.attachments.length > 0 && (
            <div className="mt-6 pt-4 border-t border-gray-200">
              <p className="text-sm font-medium text-gray-600 mb-2">Anexos:</p>
              <div className="space-y-2">
                {data.attachments.map((attachment, index) => (
                  <div key={index} className="flex items-center gap-2 p-2 bg-gray-50 rounded">
                    <div className="w-4 h-4 bg-gray-400 rounded" />
                    <span className="text-sm text-gray-700">{attachment.name}</span>
                    <span className="text-xs text-gray-500">({(attachment.size / 1024).toFixed(1)} KB)</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )

  const renderSMSPreview = () => (
    <div className="bg-gray-50 p-4 rounded-lg">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 max-w-xs mx-auto">
        <div className="bg-purple-500 text-white p-3 rounded-t-lg">
          <div className="flex items-center gap-2">
            <Smartphone className="w-4 h-4" />
            <span className="text-sm font-medium">Mensagem de Texto</span>
          </div>
        </div>
        
        <div className="p-4">
          <div className="bg-gray-100 rounded-lg p-3">
            <p className="text-sm text-gray-800 whitespace-pre-wrap">{processedContent}</p>
          </div>
          <p className="text-xs text-gray-500 mt-2">Para: {data.recipient || '+55 11 91234-5678'}</p>
        </div>
      </div>
    </div>
  )

  return (
    <Card className={cn("w-full", className)}>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={cn("w-10 h-10 rounded-full flex items-center justify-center", channelConfig.color)}>
              <Icon className="w-5 h-5 text-white" />
            </div>
            <div>
              <CardTitle className="text-lg">Pré-visualização - {channelConfig.name}</CardTitle>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="outline" className="text-xs">
                  {characterCount}/{channelConfig.maxLength} caracteres
                </Badge>
                {isNearLimit && (
                  <Badge variant="destructive" className="text-xs">
                    Próximo ao limite
                  </Badge>
                )}
              </div>
            </div>
          </div>
          
          {onRefresh && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onRefresh}
              disabled={isLoading}
            >
              <RefreshCw className={cn("w-4 h-4", isLoading && "animate-spin")} />
            </Button>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Preview do canal */}
        <div>
          {data.channel === 'whatsapp' && renderWhatsAppPreview()}
          {data.channel === 'email' && renderEmailPreview()}
          {data.channel === 'sms' && renderSMSPreview()}
        </div>

        {/* Erros e avisos */}
        {error && (
          <Alert variant="destructive">
            <XCircle className="w-4 h-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {warnings.length > 0 && (
          <Alert>
            <AlertCircle className="w-4 h-4" />
            <AlertDescription>
              <ul className="list-disc pl-4 space-y-1">
                {warnings.map((warning, index) => (
                  <li key={index} className="text-sm">{warning}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        {/* Ações */}
        {showActions && (
          <div className="flex items-center gap-2 pt-4 border-t">
            {onSend && (
              <Button 
                onClick={handleSend} 
                disabled={isLoading || !!error}
                className="flex items-center gap-2"
              >
                <Send className="w-4 h-4" />
                Enviar
              </Button>
            )}
            
            {onSave && (
              <Button 
                variant="outline" 
                onClick={handleSave} 
                disabled={isLoading}
                className="flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                Salvar
              </Button>
            )}
            
            <Button 
              variant="outline" 
              onClick={handleCopy} 
              disabled={isLoading}
              className="flex items-center gap-2"
            >
              <Copy className="w-4 h-4" />
              Copiar
            </Button>
            
            <Button 
              variant="outline" 
              onClick={handleDownload} 
              disabled={isLoading}
              className="flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Baixar
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}