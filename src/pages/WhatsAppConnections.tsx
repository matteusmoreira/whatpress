import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  Smartphone, 
  Plus, 
  Search, 
  QrCode,
  WifiOff,
  MoreHorizontal,
  RefreshCw,
  Trash2,
  Settings,
  AlertCircle,
  CheckCircle,
  Clock,
  Maximize2,
  Activity,
  Heart,
  Send
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Label } from '@/components/ui/label'
import { useEvolutionApi } from '@/hooks/useEvolutionApi'
import { useToast } from '@/hooks/use-toast'
import { WhatsAppInstance } from '@/services/whatsappInstanceService'
import { InstanceHealthMonitor } from '@/components/InstanceHealthMonitor'
import { Textarea } from '@/components/ui/textarea'
import { useQuotas } from '@/hooks/useQuotas'
import { useRateLimit } from '@/hooks/useRateLimit'
import { RateLimitConfigComponent } from "@/components/RateLimitConfig"
import { QuotaAlertsManager } from '@/components/QuotaAlertsManager'
import { GatingBanner } from '@/components/GatingBanner'
import { formatUsageTooltip, formatRelativeTime } from '@/lib/utils'

export default function WhatsAppConnections() {
  const [searchTerm, setSearchTerm] = useState('')
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [newInstanceName, setNewInstanceName] = useState('')
  const [selectedInstance, setSelectedInstance] = useState<WhatsAppInstance | null>(null)
  const [isQRDialogOpen, setIsQRDialogOpen] = useState(false)
  // Estados para exibição de eventos recentes
  const [openEventsInstanceId, setOpenEventsInstanceId] = useState<string | null>(null)
  const [eventsByInstance, setEventsByInstance] = useState<Record<string, any[]>>({})
  const [eventsLoadingId, setEventsLoadingId] = useState<string | null>(null)
  // Estados para envio de mensagem
  const [isSendDialogOpen, setIsSendDialogOpen] = useState(false)
  const [sendToNumber, setSendToNumber] = useState('')
  const [sendText, setSendText] = useState('')
  const [isSending, setIsSending] = useState(false)
  
  const { 
    instances,
    loading, 
    createInstance,
    connect, 
    disconnect, 
    checkConnectionStatus,
    deleteInstance,
    getRecentEvents,
    sendMessage,
  } = useEvolutionApi()
  
  const { toast } = useToast()

  const { canCreateResource, getResourceUsage, loading: quotasLoading, isFeatureBlocked } = useQuotas()
  const canCreateConn = canCreateResource('connections')
  const connectionUsage = getResourceUsage('connections')
  const messagesFeatureBlocked = isFeatureBlocked('messages')

  // Rate limit hooks for sending messages
  const { canSendMessage: canSendRate, getStatus: getRateStatus, isLoading: rateLimitLoading } = useRateLimit()

  // Sempre pegar a versão "ao vivo" da instância selecionada, acompanhando atualizações em tempo real vindas do Supabase/webhook
  const selectedLive = selectedInstance ? (instances.find(i => i.id === selectedInstance.id) ?? selectedInstance) : null
 
  const qrToDisplay = selectedLive?.qr_code
  const hasQR = !!qrToDisplay

  // Rate status for current selected instance
  const sendRateStatus = getRateStatus('instance', selectedLive?.id) || getRateStatus('global')
  // const canSendNow = canSendRate('instance', selectedLive?.id)
  // const remainingSendQuota = getRemainingQuota('instance', selectedLive?.id)

  // Filtrar instâncias baseado no termo de busca
  const filteredInstances = instances.filter(instance =>
    instance.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (instance.phone_number && instance.phone_number.includes(searchTerm))
  )

  const handleCreateInstance = async () => {
    if (!newInstanceName.trim()) {
      toast({
        title: "Nome obrigatório",
        description: "Por favor, digite um nome para a instância.",
        variant: "destructive"
      })
      return
    }

    // Bloqueio por quota de conexões
    if (!canCreateConn) {
      toast({
        title: 'Limite de conexões atingido',
        description: connectionUsage 
          ? `Você já utiliza ${connectionUsage.current} de ${connectionUsage.max} conexões. Exclua uma instância ou faça upgrade do plano.`
          : 'Seu limite de conexões foi atingido. Exclua uma instância ou faça upgrade do plano.',
        variant: 'destructive'
      })
      return
    }

    try {
      await createInstance(newInstanceName.trim())
      setNewInstanceName('')
      setIsCreateDialogOpen(false)
    } catch (error) {
      // Erro já tratado no hook
    }
  }

  const handleConnect = async (instance: WhatsAppInstance) => {
    try {
      setSelectedInstance(instance)
      await connect(instance.id)
      setIsQRDialogOpen(true)
    } catch (error) {
      // Erro já tratado no hook
    }
  }

  const handleDisconnect = async (instance: WhatsAppInstance) => {
    try {
      await disconnect(instance.id)
    } catch (error) {
      // Erro já tratado no hook
    }
  }

  const handleDelete = async (instance: WhatsAppInstance) => {
    if (window.confirm(`Tem certeza que deseja deletar a instância "${instance.name}"?`)) {
      try {
        await deleteInstance(instance.id)
      } catch (error) {
        // Erro já tratado no hook
      }
    }
  }

  const handleRefreshAll = async () => {
    try {
      await Promise.all(instances.map(i => checkConnectionStatus(i.id)))
    } catch (err) {
      console.warn('Falha ao atualizar status das instâncias', err)
    }
  }

  // Eventos recentes por instância
  const handleViewEvents = async (instance: WhatsAppInstance) => {
    if (openEventsInstanceId === instance.id) {
      setOpenEventsInstanceId(null)
      return
    }
    setOpenEventsInstanceId(instance.id)
    setEventsLoadingId(instance.id)
    try {
      const events = await getRecentEvents(instance, 10)
      setEventsByInstance(prev => ({ ...prev, [instance.id]: events }))
    } finally {
      setEventsLoadingId(null)
    }
  }

  const handleRefreshEvents = async (instance: WhatsAppInstance) => {
    setEventsLoadingId(instance.id)
    try {
      const events = await getRecentEvents(instance, 10)
      setEventsByInstance(prev => ({ ...prev, [instance.id]: events }))
    } finally {
      setEventsLoadingId(null)
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'connected':
        return <CheckCircle className="w-4 h-4 text-green-500" />
      case 'connecting':
        return <Clock className="w-4 h-4 text-yellow-500" />
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-500" />
      default:
        return <WifiOff className="w-4 h-4 text-gray-500" />
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'connected':
        return <Badge variant="success">Conectado</Badge>
      case 'connecting':
        return <Badge variant="warning">Conectando</Badge>
      case 'error':
        return <Badge variant="destructive">Erro</Badge>
      default:
        return <Badge variant="secondary">Desconectado</Badge>
    }
  }

  const formatLastActivity = (dateString?: string) => {
    if (!dateString) return 'Nunca'
    
    const date = new Date(dateString)
    const now = new Date()
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60))
    
    if (diffInMinutes < 1) return 'Agora'
    if (diffInMinutes < 60) return `${diffInMinutes}m atrás`
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h atrás`
    return `${Math.floor(diffInMinutes / 1440)}d atrás`
  }

  const handleOpenSendDialog = (instance: WhatsAppInstance) => {
    if (messagesFeatureBlocked) {
      toast({
        title: 'Envio de mensagens indisponível',
        description: 'Seu plano atual não permite o envio de mensagens. Faça upgrade para liberar este recurso.',
        variant: 'destructive'
      })
    }
    setSelectedInstance(instance)
    setSendToNumber(instance.phone_number || '')
    setSendText('')
    setIsSendDialogOpen(true)
  }

  const handleSendMessage = async () => {
    if (!selectedInstance) return
    const toNumber = sendToNumber.trim()
    const text = sendText.trim()

    if (!toNumber || !text) {
      toast({ title: 'Campos obrigatórios', description: 'Informe o número e a mensagem.', variant: 'destructive' })
      return
    }
    if (messagesFeatureBlocked) {
      toast({ title: 'Envio de mensagens indisponível', description: 'Seu plano atual não permite o envio de mensagens. Faça upgrade para liberar este recurso.', variant: 'destructive' })
      return
    }
    if (selectedInstance.status !== 'connected') {
      toast({ title: 'Instância não conectada', description: 'Conecte a instância para enviar mensagens.', variant: 'destructive' })
      return
    }

    // Bloqueio por rate limit (UI nível extra, além do hook)
    const status = getRateStatus('instance', selectedInstance.id) || getRateStatus('global')
    if (!canSendRate('instance', selectedInstance.id) && status) {
      toast({
        title: 'Limite de envio atingido',
        description: status.nextAllowedTime 
          ? `Aguarde até ${status.nextAllowedTime.toLocaleTimeString('pt-BR')} para enviar novamente.`
          : 'Envio temporariamente bloqueado pelas configurações de rate limit.',
        variant: 'destructive'
      })
      return
    }

    try {
      setIsSending(true)
      const sanitizedNumber = toNumber.replace(/\D/g, '')
      const res = await sendMessage(selectedInstance, sanitizedNumber, text)
      if (res?.success) {
        setIsSendDialogOpen(false)
        setSendText('')
        toast({ title: 'Mensagem enviada', description: `Para ${sanitizedNumber}` })
      }
    } catch (e: any) {
      // Erro tratado no hook
    } finally {
      setIsSending(false)
    }
  }

  // Função de cópia de código de pareamento removida por preferência de exibir apenas QR Code

  return (
    <div className="space-y-6">
      <QuotaAlertsManager showCriticalToast usage={connectionUsage} resourceLabel="conexões" />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Conexões WhatsApp</h1>
          <p className="text-muted-foreground">
            Gerencie suas conexões com WhatsApp usando Evolution API
          </p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button disabled={!canCreateConn} title={!canCreateConn ? formatUsageTooltip(connectionUsage?.current, connectionUsage?.max) : undefined}>
              <Plus className="w-4 h-4 mr-2" />
              Nova Conexão
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Criar Nova Instância</DialogTitle>
              <DialogDescription>
                Crie uma nova instância WhatsApp para conectar um número.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="instanceName">Nome da Instância</Label>
                <Input
                  id="instanceName"
                  placeholder="Ex: WhatsApp Principal"
                  value={newInstanceName}
                  onChange={(e) => setNewInstanceName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleCreateInstance()
                    }
                  }}
                />
              </div>
              {/* Banner dentro do diálogo quando bloqueado por quota */}
              <GatingBanner resourceQuotaBlocked={!quotasLoading && !canCreateConn} resourceUsage={connectionUsage} resourceLabel="Conexões" />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleCreateInstance} disabled={loading || !canCreateConn} title={!canCreateConn ? formatUsageTooltip(connectionUsage?.current, connectionUsage?.max) : undefined}>
                {loading ? "Criando..." : "Criar Instância"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Banner de quota bloqueada em nível de página */}
      <GatingBanner resourceQuotaBlocked={!quotasLoading && !canCreateConn} resourceUsage={connectionUsage} resourceLabel="Conexões" messagesFeatureBlocked={messagesFeatureBlocked} rateLimitedNow={Boolean(sendRateStatus?.isLimited)} nextAllowedTime={sendRateStatus?.nextAllowedTime} rateTimeMode="relative" />
      <Tabs defaultValue="instances" className="space-y-4">
        <TabsList>
          <TabsTrigger value="instances">Instâncias</TabsTrigger>
          <TabsTrigger value="health">
            <Heart className="w-4 h-4 mr-2" />
            Health Check
          </TabsTrigger>
          <TabsTrigger value="settings">Configurações</TabsTrigger>
        </TabsList>

        <TabsContent value="instances" className="space-y-4">
          {/* Banner de quota bloqueada */}
          {/* Barra de busca e ações */}
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar conexões..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8"
              />
            </div>
            <Button variant="outline" onClick={handleRefreshAll} disabled={loading}>
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
          </div>

          {/* Lista de instâncias */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredInstances.length === 0 ? (
              <div className="col-span-full">
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <Smartphone className="w-12 h-12 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold mb-2">Nenhuma instância encontrada</h3>
                    <p className="text-muted-foreground text-center mb-4">
                      {searchTerm ? 
                        'Nenhuma instância corresponde à sua busca.' :
                        'Crie sua primeira instância WhatsApp para começar.'
                      }
                    </p>
                    {!searchTerm && (
                      <Button onClick={() => setIsCreateDialogOpen(true)} disabled={!canCreateConn} title={!canCreateConn ? formatUsageTooltip(connectionUsage?.current, connectionUsage?.max) : undefined}>
                        <Plus className="w-4 h-4 mr-2" />
                        Criar Primeira Instância
                      </Button>
                    )}
                  </CardContent>
                </Card>
              </div>
            ) : (
              filteredInstances.map((instance) => (
                <Card key={instance.id} className="relative">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(instance.status)}
                        <CardTitle className="text-lg">{instance.name}</CardTitle>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => checkConnectionStatus(instance.id)}>
                            <RefreshCw className="w-4 h-4 mr-2" />
                            Verificar Status
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDelete(instance)}>
                            <Trash2 className="w-4 h-4 mr-2" />
                            Deletar
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    <div className="space-y-1">
                      {instance.phone_number && (
                        <CardDescription>{instance.phone_number}</CardDescription>
                      )}
                      <div className="flex items-center gap-2">
                        {getStatusBadge(instance.status)}
                        {/* Indicador de Health Status */}
                        <div className="flex items-center gap-1">
                          <div className={`w-2 h-2 rounded-full ${
                            instance.status === 'connected' ? 'bg-green-500' :
                            instance.status === 'connecting' ? 'bg-yellow-500' : 'bg-red-500'
                          }`} />
                          <span className="text-xs text-muted-foreground">
                            {instance.status === 'connected' ? 'Saudável' :
                             instance.status === 'connecting' ? 'Verificando' : 'Offline'}
                          </span>
                        </div>
                        {/* Indicador compacto de Rate Limit */}
                        {(() => {
                          const s = getRateStatus('instance', instance.id);
                          if (!s) return null;
                          return (
                            <div className="flex items-center gap-2 text-xs ml-2">
                              <span className={`inline-flex items-center gap-1 ${s.isLimited ? 'text-red-600' : 'text-emerald-600'}`}>
                                <span className={`w-2 h-2 rounded-full ${s.isLimited ? 'bg-red-500' : 'bg-emerald-500'}`} />
                                {s.isLimited ? 'Rate limit ativo' : 'Rate limit OK'}
                              </span>
                              <span className="text-muted-foreground">
                                Min {s.messagesThisMinute}/{s.minuteLimit} • Hora {s.messagesThisHour}/{s.hourLimit} • Dia {s.messagesThisDay}/{s.dayLimit}
                              </span>
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  </CardHeader>
                  
                  <CardContent className="space-y-4">
                    <div className="text-sm text-muted-foreground">
                      <div className="flex justify-between">
                        <span>Última atividade:</span>
                        <span>{formatLastActivity(instance.last_activity)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Criado em:</span>
                        <span>{new Date(instance.created_at).toLocaleDateString('pt-BR')}</span>
                      </div>
                      {/* Health Check Info */}
                      <div className="flex justify-between">
                        <span>Health Check:</span>
                        <span className="flex items-center gap-1">
                          <Activity className="w-3 h-3" />
                          {instance.status === 'connected' ? 'OK' : 'N/A'}
                        </span>
                      </div>
                    </div>

                    {/* QR Code se estiver conectando */}
                    {instance.status === 'connecting' && (
                      <div className="border rounded-lg p-4 bg-muted/50">
                        <div className="flex items-center gap-4">
                          <div className="w-24 h-24 bg-white rounded-lg flex items-center justify-center">
                            {instance.qr_code ? (
                              <img 
                                src={instance.qr_code} 
                                alt="QR Code" 
                                className="w-20 h-20" 
                                onError={(e) => {
                                  console.error('Erro ao carregar QR Code:', e)
                                  // Tentar recarregar o QR code
                                  checkConnectionStatus(instance.id)
                                }}
                              />
                            ) : (
                              <div className="flex flex-col items-center justify-center text-muted-foreground">
                                <QrCode className="w-8 h-8 mb-1" />
                                <span className="text-xs">Gerando...</span>
                              </div>
                            )}
                          </div>
                          <div className="flex-1">
                            <h4 className="font-medium mb-1">
                              {instance.qr_code ? 'Escaneie o QR Code' : 'Aguardando QR Code'}
                            </h4>
                            <p className="text-sm text-muted-foreground">
                              {instance.qr_code 
                                ? 'Use o WhatsApp do seu celular para escanear'
                                : 'Gerando código de conexão...'
                              }
                            </p>
                          </div>
                          <div className="flex items-center gap-2 ml-auto">
                            {instance.qr_code && (
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => { setSelectedInstance(instance); setIsQRDialogOpen(true); }}
                              >
                                <Maximize2 className="w-4 h-4 mr-2" />
                                Ampliar QR Code
                              </Button>
                            )}
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => checkConnectionStatus(instance.id)}
                              disabled={loading}
                            >
                              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                              {instance.qr_code ? 'Atualizar status' : 'Gerar QR Code'}
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Código de pareamento oculto conforme preferência do usuário */}

                    {/* Botões de ação */}
                    <div className="flex gap-2">
                      {instance.status === 'disconnected' && (
                        <Button 
                          onClick={() => handleConnect(instance)}
                          disabled={loading}
                          className="flex-1"
                        >
                          <QrCode className="w-4 h-4 mr-2" />
                          Conectar
                        </Button>
                      )}
                      
                      {instance.status === 'connecting' && (
                        <Button 
                          onClick={() => handleDisconnect(instance)}
                          variant="outline"
                          disabled={loading}
                          className="flex-1"
                        >
                          <WifiOff className="w-4 h-4 mr-2" />
                          Cancelar
                        </Button>
                      )}
                      
                      {instance.status === 'connected' && (
                        <>
                          <Button 
                            onClick={() => handleDisconnect(instance)}
                            variant="outline"
                            disabled={loading}
                            className="flex-1"
                          >
                            <WifiOff className="w-4 h-4 mr-2" />
                            Desconectar
                          </Button>
                          <Button 
                            onClick={() => handleOpenSendDialog(instance)}
                            disabled={loading || messagesFeatureBlocked || !canSendRate('instance', instance.id)}
                            title={messagesFeatureBlocked ? 'Envio de mensagens indisponível no seu plano' : (!canSendRate('instance', instance.id) ? 'Limite de envio atingido' : undefined)}
                            className="flex-1"
                          >
                            <Send className="w-4 h-4 mr-2" />
                            Enviar Mensagem
                          </Button>
                        </>
                      )}
                      
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleViewEvents(instance)}
                        disabled={eventsLoadingId === instance.id}
                      >
                        {eventsLoadingId === instance.id ? (
                          <RefreshCw className="w-4 h-4 animate-spin" />
                        ) : (
                          <Settings className="w-4 h-4" />
                        )}
                      </Button>
                    </div>

                    {/* Eventos recentes expandidos */}
                    {openEventsInstanceId === instance.id && (
                      <div className="border-t pt-4 space-y-2">
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-medium">Eventos Recentes</h4>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRefreshEvents(instance)}
                            disabled={eventsLoadingId === instance.id}
                          >
                            <RefreshCw className={`w-3 h-3 ${eventsLoadingId === instance.id ? 'animate-spin' : ''}`} />
                          </Button>
                        </div>
                        <div className="space-y-1 max-h-32 overflow-y-auto">
                          {eventsByInstance[instance.id]?.length > 0 ? (
                            eventsByInstance[instance.id].map((event, idx) => (
                              <div key={idx} className="text-xs p-2 bg-muted/50 rounded">
                                <div className="flex justify-between">
                                  <span className="font-medium">{event.type}</span>
                                  <span className="text-muted-foreground">
                                    {new Date(event.timestamp).toLocaleTimeString('pt-BR')}
                                  </span>
                                </div>
                                <p className="text-muted-foreground">{event.message}</p>
                              </div>
                            ))
                          ) : (
                            <p className="text-xs text-muted-foreground text-center py-2">
                              Nenhum evento recente
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        {/* Nova aba de Health Check */}
        <TabsContent value="health" className="space-y-4">
          <InstanceHealthMonitor />
        </TabsContent>

        <TabsContent value="settings" className="space-y-4">
          {/* Quota banner also in settings tab */}
          {!canCreateConn && (
            <div className="rounded-md border border-red-300 bg-red-50 text-red-700 p-3 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 mt-0.5" />
              <div>
                <p className="text-sm font-medium">Limite de conexões atingido</p>
                <p className="text-xs">Você já utiliza {connectionUsage?.current ?? 0} de {connectionUsage?.max ?? 0} conexões. Exclua uma instância ou faça upgrade do plano.</p>
              </div>
            </div>
          )}
          <Card>
            <CardHeader>
              <CardTitle>Configurações da Evolution API</CardTitle>
              <CardDescription>
                Configure as opções globais da Evolution API
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="text-sm text-muted-foreground">
                  <p>• URL da API: {import.meta.env.VITE_EVOLUTION_API_URL || 'Não configurada'}</p>
                  <p>• Webhook Global: {import.meta.env.VITE_WEBHOOK_URL || 'Não configurado'}</p>
                  <p>• Timeout de Conexão: 30 segundos</p>
                  <p>• Health Check: Ativo (30s)</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Configuração de Rate Limit */}
          <RateLimitConfigComponent instanceId={selectedLive?.id ?? undefined} />
        </TabsContent>
      </Tabs>

      {/* Dialog do QR Code / Código de Pareamento */}
      <Dialog open={isQRDialogOpen} onOpenChange={setIsQRDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Conectar WhatsApp</DialogTitle>
            <DialogDescription>
              {hasQR ? 'Escaneie o QR Code com o WhatsApp do seu celular' : 'Aguardando QR Code...'}
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-center p-6">
            {hasQR ? (
              <div className="bg-white p-4 rounded-lg flex items-center justify-center">
                <img 
                  src={qrToDisplay as string} 
                  alt="QR Code WhatsApp" 
                  className="w-64 h-64"
                />
              </div>
            ) : (
              <div className="w-64 h-64 bg-muted rounded-lg flex items-center justify-center">
                <div className="text-center">
                  <QrCode className="w-12 h-12 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Gerando código...</p>
                </div>
              </div>
            )}
          </div>
          <DialogFooter className="sm:justify-start">
            <Button
              variant="outline"
              onClick={() => selectedLive && checkConnectionStatus(selectedLive.id)}
              disabled={loading}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
            <Button variant="outline" onClick={() => setIsQRDialogOpen(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de envio de mensagem */}
      <Dialog open={isSendDialogOpen} onOpenChange={setIsSendDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Enviar mensagem</DialogTitle>
            <DialogDescription>
              Preencha os campos para enviar uma mensagem pela instância selecionada.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* Banner de bloqueio por plano */}
            {messagesFeatureBlocked && (
              <div className="rounded-md border border-yellow-300 bg-yellow-50 text-yellow-700 p-3 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Envio de mensagens indisponível</p>
                  <p className="text-xs">Seu plano atual não permite o envio de mensagens. Faça upgrade para liberar este recurso.</p>
                </div>
              </div>
            )}
            {/* Rate limit banner when blocked */}
            {!rateLimitLoading && sendRateStatus?.isLimited && !messagesFeatureBlocked && (
              <div className="rounded-md border border-yellow-300 bg-yellow-50 text-yellow-700 p-3 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Limite de envio atingido</p>
                  <p className="text-xs">
                    {sendRateStatus.limitType === 'minute' ? 'Limite por minuto atingido.' :
                     sendRateStatus.limitType === 'hour' ? 'Limite por hora atingido.' :
                     sendRateStatus.limitType === 'day' ? 'Limite diário atingido.' :
                     sendRateStatus.limitType === 'burst' ? 'Limite de burst atingido.' :
                     sendRateStatus.limitType === 'cooldown' ? 'Aguardando cooldown.' :
                     sendRateStatus.limitType === 'time_restriction' ? 'Fora do horário permitido.' : 'Envio temporariamente bloqueado.'}
                    {' '}Próximo envio permitido {sendRateStatus.nextAllowedTime ? `às ${sendRateStatus.nextAllowedTime.toLocaleTimeString('pt-BR')}` : 'em breve'}.
                  </p>
                  <p className="text-xs mt-1">
                    Min: {sendRateStatus.messagesThisMinute}/{sendRateStatus.minuteLimit} • Hora: {sendRateStatus.messagesThisHour}/{sendRateStatus.hourLimit} • Dia: {sendRateStatus.messagesThisDay}/{sendRateStatus.dayLimit}
                  </p>
                </div>
              </div>
            )}
            <div>
              <Label htmlFor="toNumber">Número de destino</Label>
              <Input
                id="toNumber"
                placeholder="Ex: 5511999999999"
                value={sendToNumber}
                onChange={(e) => setSendToNumber(e.target.value)}
                disabled={messagesFeatureBlocked}
              />
            </div>
            <div>
              <Label htmlFor="messageText">Mensagem</Label>
              <Textarea
                id="messageText"
                placeholder="Digite sua mensagem..."
                value={sendText}
                onChange={(e) => setSendText(e.target.value)}
                rows={5}
                disabled={messagesFeatureBlocked}
              />
            </div>
            {/* Remaining quota hint */}
            {!rateLimitLoading && sendRateStatus && !messagesFeatureBlocked && (
              <p className="text-xs text-muted-foreground">
                Restante: Min {Math.max(0, sendRateStatus.minuteLimit - sendRateStatus.messagesThisMinute)} • Hora {Math.max(0, sendRateStatus.hourLimit - sendRateStatus.messagesThisHour)} • Dia {Math.max(0, sendRateStatus.dayLimit - sendRateStatus.messagesThisDay)}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSendDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSendMessage} disabled={isSending || messagesFeatureBlocked || !sendToNumber.trim() || !sendText.trim() || (!rateLimitLoading && sendRateStatus?.isLimited)} title={
              messagesFeatureBlocked
                ? 'Envio de mensagens indisponível no seu plano'
                : (!rateLimitLoading && sendRateStatus?.isLimited
                    ? `Limite de envio atingido (liberado ${formatRelativeTime(sendRateStatus?.nextAllowedTime)})`
                    : undefined)
            }>
              {isSending ? (
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Send className="w-4 h-4 mr-2" />
              )}
              {isSending ? 'Enviando...' : 'Enviar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
