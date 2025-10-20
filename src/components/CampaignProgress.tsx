import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { 
  Activity,
  AlertCircle,
  CheckCircle,
  Clock,
  MessageSquare,
  Pause,
  Play,
  RefreshCw,
  Send,
  Square,
  TrendingUp,
  Users,
  Zap
} from 'lucide-react'
import { useCampaignEngine } from '@/hooks/useCampaignEngine'
import { useToast } from '@/hooks/use-toast'

interface CampaignProgressProps {
  campaignId: string
  onPause?: () => void
  onResume?: () => void
  onStop?: () => void
}

interface ProgressMetrics {
  total_contacts: number
  sent_count: number
  delivered_count: number
  read_count: number
  replied_count: number
  failed_count: number
  pending_count: number
  success_rate: number
  delivery_rate: number
  response_rate: number
  avg_response_time: number
  messages_per_minute: number
  estimated_completion: string
  elapsed_time: number
}

interface RealtimeUpdate {
  timestamp: string
  event_type: 'message_sent' | 'message_delivered' | 'message_read' | 'message_failed' | 'contact_replied'
  contact_name: string
  message: string
  instance_id?: string
}

export const CampaignProgress: React.FC<CampaignProgressProps> = ({
  campaignId,
  onPause,
  onResume,
  onStop
}) => {
  const { campaigns, pauseCampaign, resumeCampaign, stopCampaign } = useCampaignEngine()
  const { toast } = useToast()
  
  const [metrics, setMetrics] = useState<ProgressMetrics>({
    total_contacts: 0,
    sent_count: 0,
    delivered_count: 0,
    read_count: 0,
    replied_count: 0,
    failed_count: 0,
    pending_count: 0,
    success_rate: 0,
    delivery_rate: 0,
    response_rate: 0,
    avg_response_time: 0,
    messages_per_minute: 0,
    estimated_completion: '',
    elapsed_time: 0
  })
  
  const [realtimeUpdates, setRealtimeUpdates] = useState<RealtimeUpdate[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const campaign = campaigns.find(c => c.id === campaignId)

  // Simular métricas em tempo real
  const generateMetrics = (): ProgressMetrics => {
    const total = 1000 + Math.floor(Math.random() * 500)
    const sent = Math.floor(Math.random() * total * 0.8)
    const delivered = Math.floor(sent * (0.85 + Math.random() * 0.1))
    const read = Math.floor(delivered * (0.6 + Math.random() * 0.3))
    const replied = Math.floor(read * (0.1 + Math.random() * 0.2))
    const failed = Math.floor(Math.random() * sent * 0.05)
    const pending = total - sent

    return {
      total_contacts: total,
      sent_count: sent,
      delivered_count: delivered,
      read_count: read,
      replied_count: replied,
      failed_count: failed,
      pending_count: pending,
      success_rate: sent > 0 ? ((delivered / sent) * 100) : 0,
      delivery_rate: sent > 0 ? ((delivered / sent) * 100) : 0,
      response_rate: read > 0 ? ((replied / read) * 100) : 0,
      avg_response_time: 15 + Math.random() * 30,
      messages_per_minute: 8 + Math.random() * 12,
      estimated_completion: new Date(Date.now() + (pending * 7500)).toLocaleString('pt-BR'),
      elapsed_time: Math.floor(Math.random() * 7200)
    }
  }

  // Simular atualizações em tempo real
  const generateRealtimeUpdate = (): RealtimeUpdate => {
    const events = [
      { type: 'message_sent', message: 'Mensagem enviada com sucesso' },
      { type: 'message_delivered', message: 'Mensagem entregue' },
      { type: 'message_read', message: 'Mensagem visualizada' },
      { type: 'message_failed', message: 'Falha no envio da mensagem' },
      { type: 'contact_replied', message: 'Contato respondeu à mensagem' }
    ]
    
    const event = events[Math.floor(Math.random() * events.length)]
    const names = ['João Silva', 'Maria Santos', 'Pedro Costa', 'Ana Oliveira', 'Carlos Lima']
    
    return {
      timestamp: new Date().toISOString(),
      event_type: event.type as any,
      contact_name: names[Math.floor(Math.random() * names.length)],
      message: event.message,
      instance_id: `inst_${Math.floor(Math.random() * 3) + 1}`
    }
  }

  const handlePause = async () => {
    if (!campaign) return
    
    setIsLoading(true)
    try {
      await pauseCampaign(campaign.id)
      onPause?.()
      toast({
        title: "Campanha pausada",
        description: "A campanha foi pausada com sucesso"
      })
    } catch (error) {
      toast({
        title: "Erro ao pausar",
        description: "Não foi possível pausar a campanha",
        variant: "destructive"
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleResume = async () => {
    if (!campaign) return
    
    setIsLoading(true)
    try {
      await resumeCampaign(campaign.id)
      onResume?.()
      toast({
        title: "Campanha retomada",
        description: "A campanha foi retomada com sucesso"
      })
    } catch (error) {
      toast({
        title: "Erro ao retomar",
        description: "Não foi possível retomar a campanha",
        variant: "destructive"
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleStop = async () => {
    if (!campaign) return
    
    setIsLoading(true)
    try {
      await stopCampaign(campaign.id)
      onStop?.()
      toast({
        title: "Campanha interrompida",
        description: "A campanha foi interrompida com sucesso"
      })
    } catch (error) {
      toast({
        title: "Erro ao interromper",
        description: "Não foi possível interromper a campanha",
        variant: "destructive"
      })
    } finally {
      setIsLoading(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running':
        return 'bg-green-500'
      case 'paused':
        return 'bg-yellow-500'
      case 'completed':
        return 'bg-blue-500'
      case 'failed':
        return 'bg-red-500'
      default:
        return 'bg-gray-500'
    }
  }

  const getEventIcon = (eventType: string) => {
    switch (eventType) {
      case 'message_sent':
        return <Send className="h-4 w-4 text-blue-600" />
      case 'message_delivered':
        return <CheckCircle className="h-4 w-4 text-green-600" />
      case 'message_read':
        return <MessageSquare className="h-4 w-4 text-purple-600" />
      case 'message_failed':
        return <AlertCircle className="h-4 w-4 text-red-600" />
      case 'contact_replied':
        return <TrendingUp className="h-4 w-4 text-orange-600" />
      default:
        return <Activity className="h-4 w-4 text-gray-600" />
    }
  }

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  useEffect(() => {
    setMetrics(generateMetrics())
    
    // Simular atualizações em tempo real
    const interval = setInterval(() => {
      setMetrics(generateMetrics())
      
      // Adicionar nova atualização ocasionalmente
      if (Math.random() > 0.7) {
        const newUpdate = generateRealtimeUpdate()
        setRealtimeUpdates(prev => [newUpdate, ...prev.slice(0, 19)]) // Manter apenas 20 atualizações
      }
    }, 3000)

    return () => clearInterval(interval)
  }, [campaignId])

  if (!campaign) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <p className="text-muted-foreground">Campanha não encontrada</p>
        </CardContent>
      </Card>
    )
  }

  const progressPercentage = metrics.total_contacts > 0 ? 
    (metrics.sent_count / metrics.total_contacts) * 100 : 0

  return (
    <div className="space-y-6">
      {/* Header com Controles */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${getStatusColor(campaign.status)}`} />
              <div>
                <CardTitle>{campaign.name}</CardTitle>
                <CardDescription className="flex items-center gap-2">
                  <Badge variant="outline">{campaign.status.toUpperCase()}</Badge>
                  <span>•</span>
                  <span>Tempo decorrido: {formatTime(metrics.elapsed_time)}</span>
                </CardDescription>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              {campaign.status === 'running' && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePause}
                  disabled={isLoading}
                >
                  <Pause className="h-4 w-4 mr-2" />
                  Pausar
                </Button>
              )}
              
              {campaign.status === 'paused' && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleResume}
                  disabled={isLoading}
                >
                  <Play className="h-4 w-4 mr-2" />
                  Retomar
                </Button>
              )}
              
              {(campaign.status === 'running' || campaign.status === 'paused') && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleStop}
                  disabled={isLoading}
                >
                  <Square className="h-4 w-4 mr-2" />
                  Parar
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Progresso Geral */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Progresso Geral</span>
              <span className="text-sm text-muted-foreground">
                {metrics.sent_count} de {metrics.total_contacts} contatos
              </span>
            </div>
            <Progress value={progressPercentage} className="h-3" />
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{progressPercentage.toFixed(1)}% concluído</span>
              <span>Previsão: {metrics.estimated_completion}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Métricas Principais */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Send className="h-8 w-8 text-blue-600" />
              <div>
                <p className="text-2xl font-bold">{metrics.sent_count.toLocaleString()}</p>
                <p className="text-sm text-muted-foreground">Mensagens Enviadas</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <CheckCircle className="h-8 w-8 text-green-600" />
              <div>
                <p className="text-2xl font-bold">{metrics.delivered_count.toLocaleString()}</p>
                <p className="text-sm text-muted-foreground">Entregues</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <TrendingUp className="h-8 w-8 text-purple-600" />
              <div>
                <p className="text-2xl font-bold">{metrics.replied_count.toLocaleString()}</p>
                <p className="text-sm text-muted-foreground">Respostas</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-8 w-8 text-red-600" />
              <div>
                <p className="text-2xl font-bold">{metrics.failed_count.toLocaleString()}</p>
                <p className="text-sm text-muted-foreground">Falhas</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Estatísticas Detalhadas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Taxas de Performance
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm">Taxa de Entrega</span>
                <span className="font-medium">{metrics.delivery_rate.toFixed(1)}%</span>
              </div>
              <Progress value={metrics.delivery_rate} className="h-2" />
            </div>
            
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm">Taxa de Resposta</span>
                <span className="font-medium">{metrics.response_rate.toFixed(1)}%</span>
              </div>
              <Progress value={metrics.response_rate} className="h-2" />
            </div>
            
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm">Taxa de Sucesso</span>
                <span className="font-medium">{metrics.success_rate.toFixed(1)}%</span>
              </div>
              <Progress value={metrics.success_rate} className="h-2" />
            </div>

            <Separator />

            <div className="grid grid-cols-2 gap-4 text-center">
              <div>
                <p className="text-lg font-bold text-blue-600">
                  {metrics.messages_per_minute.toFixed(1)}
                </p>
                <p className="text-xs text-muted-foreground">Msg/min</p>
              </div>
              <div>
                <p className="text-lg font-bold text-green-600">
                  {metrics.avg_response_time.toFixed(1)}min
                </p>
                <p className="text-xs text-muted-foreground">Tempo médio de resposta</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Atualizações em Tempo Real */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5" />
              Atividade em Tempo Real
            </CardTitle>
            <CardDescription>
              Últimas atualizações da campanha
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {realtimeUpdates.map((update, index) => (
                <div key={index} className="flex items-center gap-3 p-2 bg-muted/50 rounded-lg">
                  {getEventIcon(update.event_type)}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{update.contact_name}</p>
                    <p className="text-xs text-muted-foreground">{update.message}</p>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(update.timestamp).toLocaleTimeString('pt-BR')}
                  </div>
                </div>
              ))}
              
              {realtimeUpdates.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>Aguardando atualizações...</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}