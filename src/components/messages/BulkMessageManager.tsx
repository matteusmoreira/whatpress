import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Progress } from '@/components/ui/progress'
import { 
  Send, 
  Users, 
  Clock, 
  AlertCircle,
  CheckCircle,
  XCircle,
  RefreshCw,
  Upload,
  Download,
  Filter,
  Play,
  Pause,
  Trash2,
  Eye,
  X
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { format, formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { useBulkMessages } from '@/hooks/useBulkMessages'
import { useTemplates } from '@/hooks/useTemplates'
import { useContacts } from '@/hooks/useContacts'
import { MessagePreview } from './MessagePreview'
import { MediaManager } from '@/components/media/MediaManager'

export interface BulkMessageManagerProps {
  className?: string
  onJobCreated?: (jobId: string) => void
  onJobCompleted?: (jobId: string) => void
}

const CHANNEL_OPTIONS = [
  { value: 'whatsapp', label: 'WhatsApp', icon: '📱' },
  { value: 'email', label: 'E-mail', icon: '📧' },
  { value: 'sms', label: 'SMS', icon: '📨' }
]

const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Baixa', color: 'bg-blue-100 text-blue-800' },
  { value: 'medium', label: 'Média', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'high', label: 'Alta', color: 'bg-red-100 text-red-800' },
  { value: 'urgent', label: 'Urgente', color: 'bg-red-500 text-white' }
]

export function BulkMessageManager({
  className,
  onJobCreated,
  onJobCompleted
}: BulkMessageManagerProps) {
  const [activeTab, setActiveTab] = useState<'create' | 'manage'>('create')
  const [showPreview, setShowPreview] = useState(false)
  const [customPreviewData, setCustomPreviewData] = useState<any | null>(null)
  const [showMediaManager, setShowMediaManager] = useState(false)
  const [selectedMedia, setSelectedMedia] = useState<any[]>([])
  
  // Form state
  const [jobName, setJobName] = useState('')
  const [channel, setChannel] = useState('whatsapp')
  const [message, setMessage] = useState('')
  const [templateId, setTemplateId] = useState('')
  const [priority, setPriority] = useState('medium')
  const [scheduledAt, setScheduledAt] = useState('')
  const [recipientSource, setRecipientSource] = useState<'manual' | 'file' | 'segment'>('manual')
  const [recipients, setRecipients] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [segmentId, setSegmentId] = useState('')

  const {
    jobs,
    isLoading,
    createJob,
    cancelJob,
    getJobProgress,
    getJobStatus
  } = useBulkMessages()

  const { templates } = useTemplates()
  const { segments } = useContacts()

  // Auto-refresh jobs
  useEffect(() => {
    const interval = setInterval(() => {
      // Jobs ativos serão atualizados automaticamente pelo cache
    }, 5000)
    return () => clearInterval(interval)
  }, [])

  const handleCreateJob = async () => {
    if (!jobName.trim()) {
      toast.error('Por favor, insira um nome para o job')
      return
    }

    if (!message.trim() && !templateId) {
      toast.error('Por favor, insira uma mensagem ou selecione um template')
      return
    }

    let recipientList: any[] = []

    // Processar destinatários
    if (recipientSource === 'manual') {
      recipientList = recipients
        .split('\n')
        .map(r => r.trim())
        .filter(r => r)
        .map(r => ({ contact: r }))
    } else if (recipientSource === 'file' && file) {
      // Processar arquivo CSV
      const text = await file.text()
      const lines = text.split('\n').filter(line => line.trim())
      recipientList = lines.map(line => {
        const [contact, ...vars] = line.split(',')
        return { contact: contact.trim(), variables: vars.map(v => v.trim()) }
      })
    } else if (recipientSource === 'segment' && segmentId) {
      recipientList = [{ segmentId }]
    }

    if (recipientList.length === 0) {
      toast.error('Por favor, adicione pelo menos um destinatário')
      return
    }

    try {
      const jobData = {
        name: jobName,
        channel,
        message: templateId ? '' : message,
        templateId: templateId || undefined,
        recipients: recipientList,
        priority,
        scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : undefined,
        totalRecipients: recipientList.length,
        media: selectedMedia.map(m => ({
          url: m.url,
          type: m.type,
          caption: m.name
        }))
      }

      const newJob = await createJob(jobData)
      
      if (newJob) {
        toast.success('Job criado com sucesso!')
        onJobCreated?.(newJob.id)
        setActiveTab('manage')
        
        // Limpar formulário
        setJobName('')
        setMessage('')
        setRecipients('')
        setFile(null)
        setSelectedMedia([])
      }
    } catch (err) {
      toast.error('Erro ao criar job')
    }
  }

  const handleCancelJob = async (jobId: string) => {
    if (confirm('Tem certeza que deseja cancelar este job?')) {
      try {
        await cancelJob(jobId)
        toast.success('Job cancelado com sucesso')
      } catch (err) {
        toast.error('Erro ao cancelar job')
      }
    }
  }

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      pending: { icon: Clock, color: 'bg-yellow-100 text-yellow-800', label: 'Pendente' },
      processing: { icon: RefreshCw, color: 'bg-blue-100 text-blue-800', label: 'Processando' },
      completed: { icon: CheckCircle, color: 'bg-green-100 text-green-800', label: 'Concluído' },
      failed: { icon: XCircle, color: 'bg-red-100 text-red-800', label: 'Falhou' },
      cancelled: { icon: XCircle, color: 'bg-gray-100 text-gray-800', label: 'Cancelado' }
    }[status] || { icon: AlertCircle, color: 'bg-gray-100 text-gray-800', label: status }

    const Icon = statusConfig.icon
    return (
      <Badge className={cn(statusConfig.color, 'flex items-center gap-1')}>
        <Icon className="w-3 h-3" />
        {statusConfig.label}
      </Badge>
    )
  }

  const handleShowJobPreview = (job: any) => {
    const content = job.templateId
      ? templates.find(t => t.id === job.templateId)?.content || job.message || ''
      : job.message || ''
    const subject = job.templateId ? templates.find(t => t.id === job.templateId)?.subject : undefined
    const firstRecipient = Array.isArray(job.recipients) && job.recipients.length > 0
      ? (job.recipients[0].contact || 'Destinatário')
      : 'Destinatário'
    const media = Array.isArray(job.media) ? job.media.map((m: any) => ({ url: m.url, type: m.type, caption: m.caption })) : []
    const data = { content, channel: job.channel, recipient: firstRecipient, subject, variables: {}, media }
    setCustomPreviewData(data)
    setShowPreview(true)
  }

  const previewData = {
    content: templateId 
      ? templates.find(t => t.id === templateId)?.content || message
      : message,
    channel: channel as any,
    recipient: 'Destinatário de Exemplo',
    subject: templateId ? templates.find(t => t.id === templateId)?.subject : undefined,
    variables: { nome: 'João', empresa: 'Minha Empresa' },
    media: selectedMedia
  }

  return (
    <Card className={cn("w-full", className)}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Mensagens em Massa</CardTitle>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant={activeTab === 'create' ? 'default' : 'outline'}
              onClick={() => setActiveTab('create')}
            >
              <Send className="w-4 h-4 mr-1" />
              Criar Job
            </Button>
            <Button
              size="sm"
              variant={activeTab === 'manage' ? 'default' : 'outline'}
              onClick={() => setActiveTab('manage')}
            >
              <Users className="w-4 h-4 mr-1" />
              Gerenciar Jobs
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {activeTab === 'create' ? (
          <div className="space-y-6">
            {/* Informações básicas */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Nome do Job *</label>
                <Input
                  placeholder="Ex: Campanha de Black Friday"
                  value={jobName}
                  onChange={(e) => setJobName(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Canal *</label>
                <Select value={channel} onValueChange={setChannel}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CHANNEL_OPTIONS.map(option => (
                      <SelectItem key={option.value} value={option.value}>
                        <span className="flex items-center gap-2">
                          <span>{option.icon}</span>
                          {option.label}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Template ou mensagem */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Usar Template?</label>
                <Select value={templateId} onValueChange={setTemplateId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um template (opcional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Sem template</SelectItem>
                    {templates.map(template => (
                      <SelectItem key={template.id} value={template.id}>
                        {template.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {!templateId && (
                <div>
                  <label className="block text-sm font-medium mb-2">Mensagem *</label>
                  <Textarea
                    placeholder="Digite sua mensagem..."
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    rows={4}
                  />
                  <div className="text-xs text-gray-500 mt-1">
                    Use { } para variáveis, ex: {nome}, {empresa}
                  </div>
                </div>
              )}
            </div>

            {/* Mídia */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium">Mídia (opcional)</label>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowMediaManager(true)}
                >
                  <Upload className="w-4 h-4 mr-1" />
                  Adicionar Mídia
                </Button>
              </div>
              {selectedMedia.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {selectedMedia.map((media, index) => (
                    <Badge key={index} variant="secondary" className="flex items-center gap-1">
                      {media.name}
                      <X
                        className="w-3 h-3 cursor-pointer"
                        onClick={() => setSelectedMedia(prev => prev.filter((_, i) => i !== index))}
                      />
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            {/* Destinatários */}
            <div className="space-y-4">
              <label className="block text-sm font-medium mb-2">Fonte de Destinatários *</label>
              <Select value={recipientSource} onValueChange={setRecipientSource as any}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">Inserir manualmente</SelectItem>
                  <SelectItem value="file">Upload de arquivo CSV</SelectItem>
                  <SelectItem value="segment">Segmento de contatos</SelectItem>
                </SelectContent>
              </Select>

              {recipientSource === 'manual' && (
                <div>
                  <label className="block text-sm font-medium mb-2">Destinatários (um por linha)</label>
                  <Textarea
                    placeholder="5511999999999\n5511888888888\n..."
                    value={recipients}
                    onChange={(e) => setRecipients(e.target.value)}
                    rows={6}
                  />
                </div>
              )}

              {recipientSource === 'file' && (
                <div>
                  <label className="block text-sm font-medium mb-2">Arquivo CSV</label>
                  <Input
                    type="file"
                    accept=".csv"
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                  />
                  <div className="text-xs text-gray-500 mt-1">
                    Formato: telefone,variavel1,variavel2,...
                  </div>
                </div>
              )}

              {recipientSource === 'segment' && (
                <div>
                  <label className="block text-sm font-medium mb-2">Segmento</label>
                  <Select value={segmentId} onValueChange={setSegmentId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um segmento" />
                    </SelectTrigger>
                    <SelectContent>
                      {segments.map(segment => (
                        <SelectItem key={segment.id} value={segment.id}>
                          {segment.name} ({segment.contactCount} contatos)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            {/* Configurações avançadas */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Prioridade</label>
                <Select value={priority} onValueChange={setPriority}>
                  <SelectContent>
                    {PRIORITY_OPTIONS.map(option => (
                      <SelectItem key={option.value} value={option.value}>
                        <span className={cn(option.color, 'px-2 py-1 rounded text-xs')}>
                          {option.label}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Agendamento (opcional)</label>
                <Input
                  type="datetime-local"
                  value={scheduledAt}
                  onChange={(e) => setScheduledAt(e.target.value)}
                />
              </div>
            </div>

            {/* Preview e ações */}
            <div className="flex items-center justify-between pt-4 border-t">
              <Button
                variant="outline"
                onClick={() => setShowPreview(true)}
                disabled={!message && !templateId}
              >
                <Eye className="w-4 h-4 mr-1" />
                Pré-visualizar
              </Button>
              <Button onClick={handleCreateJob} disabled={isLoading}>
                <Send className="w-4 h-4 mr-1" />
                Criar Job
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Lista de jobs */}
            {jobs.map(job => {
              const progress = getJobProgress(job)
              const status = getJobStatus(job)
              
              return (
                <Card key={job.id} className="border">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h4 className="font-medium">{job.name}</h4>
                          {getStatusBadge(job.status)}
                          <Badge variant="outline">{CHANNEL_OPTIONS.find(c => c.value === job.channel)?.icon} {job.channel}</Badge>
                        </div>
                        
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-600 mb-3">
                          <div>
                            <span className="font-medium">Total:</span> {job.totalRecipients}
                          </div>
                          <div>
                            <span className="font-medium">Processados:</span> {job.processedRecipients}
                          </div>
                          <div>
                            <span className="font-medium">Sucesso:</span> {job.successfulSends}
                          </div>
                          <div>
                            <span className="font-medium">Falhas:</span> {job.failedSends}
                          </div>
                        </div>

                        <div className="mb-3">
                          <div className="flex items-center justify-between text-sm mb-1">
                            <span>Progresso</span>
                            <span>{progress}%</span>
                          </div>
                          <Progress value={progress} className="h-2" />
                        </div>

                        <div className="flex items-center gap-4 text-xs text-gray-500">
                          <span>Criado: {format(new Date(job.createdAt), 'dd/MM/yyyy HH:mm', { locale: ptBR })}</span>
                          {job.scheduledAt && (
                            <span>Agendado: {format(new Date(job.scheduledAt), 'dd/MM/yyyy HH:mm', { locale: ptBR })}</span>
                          )}
                          <Badge className={PRIORITY_OPTIONS.find(p => p.value === job.priority)?.color}>
                            {PRIORITY_OPTIONS.find(p => p.value === job.priority)?.label}
                          </Badge>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {job.status === 'pending' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleCancelJob(job.id)}
                          >
                            <XCircle className="w-4 h-4 mr-1" />
                            Cancelar
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleShowJobPreview(job)}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}

            {jobs.length === 0 && (
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Send className="w-8 h-8 text-gray-400" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  Nenhum job encontrado
                </h3>
                <p className="text-gray-500 mb-4">
                  Crie seu primeiro job de mensagens em massa
                </p>
                <Button onClick={() => setActiveTab('create')}>
                  <Send className="w-4 h-4 mr-2" />
                  Criar Job
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>

      {/* Modal de preview */}
      {showPreview && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Pré-visualização da Mensagem</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setShowPreview(false); setCustomPreviewData(null) }}
              >
                <XCircle className="w-4 h-4" />
              </Button>
            </div>
            <MessagePreview
              data={customPreviewData ?? previewData}
              showActions={false}
            />
          </div>
        </div>
      )}

      {/* Modal de gerenciamento de mídia */}
      {showMediaManager && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-6xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Selecionar Mídia</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowMediaManager(false)}
              >
                <XCircle className="w-4 h-4" />
              </Button>
            </div>
            <MediaManager
              allowMultiple
              selectedMedia={selectedMedia}
              onMediaSelect={(media) => {
                setSelectedMedia(prev => {
                  const exists = prev.some(m => m.id === media.id)
                  if (exists) {
                    return prev.filter(m => m.id !== media.id)
                  } else {
                    return [...prev, media]
                  }
                })
              }}
            />
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" onClick={() => setShowMediaManager(false)}>
                Cancelar
              </Button>
              <Button onClick={() => setShowMediaManager(false)}>
                Confirmar ({selectedMedia.length})
              </Button>
            </div>
          </div>
        </div>
      )}
    </Card>
  )
}
