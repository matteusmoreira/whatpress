import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { 
  Activity,
  AlertTriangle,
  CheckCircle,
  Clock,
  Cpu,
  Globe,
  Heart,
  MessageSquare,
  Network,
  RefreshCw,
  Server,
  Signal,
  Wifi,
  WifiOff,
  Zap
} from 'lucide-react'
import { useMultiSession } from '@/hooks/useMultiSession'
import { useToast } from '@/hooks/use-toast'

interface HealthMetric {
  id: string
  name: string
  value: number
  unit: string
  status: 'healthy' | 'warning' | 'critical'
  trend: 'up' | 'down' | 'stable'
}

interface InstanceHealth {
  instance_id: string
  status: 'online' | 'offline' | 'connecting' | 'error'
  last_ping: string
  response_time: number
  cpu_usage: number
  memory_usage: number
  messages_sent: number
  messages_failed: number
  uptime: number
  connection_quality: number
  error_rate: number
  metrics: HealthMetric[]
}

export const InstanceHealthMonitor: React.FC = () => {
  const { instances, healthLogs, checkAllInstancesHealth } = useMultiSession()
  const { toast } = useToast()
  
  const [healthData, setHealthData] = useState<InstanceHealth[]>([])
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [autoRefresh, setAutoRefresh] = useState(true)

  // Simular dados de health check (em produção, viria da API)
  const generateHealthData = (): InstanceHealth[] => {
    return instances.map(instance => ({
      instance_id: instance.id,
      status: instance.status === 'connected' ? 'online' : 
              instance.status === 'disconnected' ? 'offline' : 
              instance.status === 'error' ? 'error' : 'connecting',
      last_ping: new Date().toISOString(),
      response_time: Math.random() * 500 + 50,
      cpu_usage: Math.random() * 80 + 10,
      memory_usage: Math.random() * 70 + 20,
      messages_sent: Math.floor(Math.random() * 1000),
      messages_failed: Math.floor(Math.random() * 50),
      uptime: Math.random() * 86400,
      connection_quality: Math.random() * 100,
      error_rate: Math.random() * 10,
      metrics: [
        {
          id: 'response_time',
          name: 'Tempo de Resposta',
          value: Math.random() * 500 + 50,
          unit: 'ms',
          status: Math.random() > 0.7 ? 'warning' : 'healthy',
          trend: Math.random() > 0.5 ? 'up' : 'down'
        },
        {
          id: 'throughput',
          name: 'Taxa de Envio',
          value: Math.random() * 100,
          unit: 'msg/min',
          status: 'healthy',
          trend: 'stable'
        },
        {
          id: 'success_rate',
          name: 'Taxa de Sucesso',
          value: 95 + Math.random() * 5,
          unit: '%',
          status: 'healthy',
          trend: 'up'
        }
      ]
    }))
  }

  const handleRefresh = async () => {
    setIsRefreshing(true)
    try {
      await checkAllInstancesHealth()
      setHealthData(generateHealthData())
      toast({
        title: "Status atualizado",
        description: "Health check das instâncias atualizado com sucesso"
      })
    } catch (error) {
      toast({
        title: "Erro ao atualizar",
        description: "Não foi possível atualizar o status das instâncias",
        variant: "destructive"
      })
    } finally {
      setIsRefreshing(false)
    }
  }

  const getHealthStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="h-4 w-4 text-green-600" />
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-600" />
      case 'critical':
        return <AlertTriangle className="h-4 w-4 text-red-600" />
      case 'offline':
        return <WifiOff className="h-4 w-4 text-gray-600" />
      default:
        return <Globe className="h-4 w-4 text-gray-600" />
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'online':
        return <CheckCircle className="h-4 w-4 text-green-600" />
      case 'offline':
        return <WifiOff className="h-4 w-4 text-red-600" />
      case 'connecting':
        return <RefreshCw className="h-4 w-4 text-yellow-600 animate-spin" />
      case 'error':
        return <AlertTriangle className="h-4 w-4 text-red-600" />
      default:
        return <Globe className="h-4 w-4 text-gray-600" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online':
        return 'bg-green-500'
      case 'offline':
        return 'bg-red-500'
      case 'connecting':
        return 'bg-yellow-500'
      case 'error':
        return 'bg-red-500'
      default:
        return 'bg-gray-500'
    }
  }

  const getMetricStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'text-green-600'
      case 'warning':
        return 'text-yellow-600'
      case 'critical':
        return 'text-red-600'
      default:
        return 'text-gray-600'
    }
  }

  const formatUptime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    return `${hours}h ${minutes}m`
  }

  const getOverallHealth = () => {
    const onlineInstances = healthData.filter(h => h.status === 'online').length
    const totalInstances = healthData.length
    
    if (totalInstances === 0) return { status: 'warning', percentage: 0 }
    
    const percentage = (onlineInstances / totalInstances) * 100
    
    if (percentage >= 80) return { status: 'healthy', percentage }
    if (percentage >= 60) return { status: 'warning', percentage }
    return { status: 'critical', percentage }
  }

  useEffect(() => {
    setHealthData(generateHealthData())
  }, [instances])

  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(() => {
        setHealthData(generateHealthData())
      }, 30000) // Atualizar a cada 30 segundos

      return () => clearInterval(interval)
    }
  }, [autoRefresh])

  const overallHealth = getOverallHealth()

  return (
    <div className="space-y-6">
      {/* Header com Status Geral */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Monitor de Saúde das Instâncias
              </CardTitle>
              <CardDescription>
                Monitoramento em tempo real do status e performance das instâncias WhatsApp
              </CardDescription>
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setAutoRefresh(!autoRefresh)}
              >
                <Zap className={`h-4 w-4 mr-2 ${autoRefresh ? 'text-green-600' : 'text-gray-400'}`} />
                Auto-refresh {autoRefresh ? 'ON' : 'OFF'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                disabled={isRefreshing}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
                Atualizar
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Status Geral */}
            <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${
                overallHealth.status === 'healthy' ? 'bg-green-500' :
                overallHealth.status === 'warning' ? 'bg-yellow-500' : 'bg-red-500'
              }`} />
              <div>
                <p className="text-sm font-medium">Status Geral</p>
                <p className="text-xs text-muted-foreground">
                  {overallHealth.percentage.toFixed(0)}% Operacional
                </p>
              </div>
            </div>

            {/* Instâncias Online */}
            <div className="flex items-center gap-3">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <div>
                <p className="text-sm font-medium">
                  {healthData.filter(h => h.status === 'online').length} Online
                </p>
                <p className="text-xs text-muted-foreground">
                  de {healthData.length} instâncias
                </p>
              </div>
            </div>

            {/* Tempo de Resposta Médio */}
            <div className="flex items-center gap-3">
              <Clock className="h-5 w-5 text-blue-600" />
              <div>
                <p className="text-sm font-medium">
                  {healthData.length > 0 ? 
                    Math.round(healthData.reduce((acc, h) => acc + h.response_time, 0) / healthData.length) : 0}ms
                </p>
                <p className="text-xs text-muted-foreground">Tempo médio</p>
              </div>
            </div>

            {/* Taxa de Erro */}
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-orange-600" />
              <div>
                <p className="text-sm font-medium">
                  {healthData.length > 0 ? 
                    (healthData.reduce((acc, h) => acc + h.error_rate, 0) / healthData.length).toFixed(1) : 0}%
                </p>
                <p className="text-xs text-muted-foreground">Taxa de erro</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lista de Instâncias */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {healthData.map((health) => {
          const instance = instances.find(i => i.id === health.instance_id)
          if (!instance) return null

          return (
            <Card key={health.instance_id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {getStatusIcon(health.status)}
                    <div>
                      <CardTitle className="text-lg">{instance.name}</CardTitle>
                      <CardDescription className="flex items-center gap-2">
                        <span>ID: {instance.id.slice(0, 8)}</span>
                        <Badge variant="outline" className="text-xs">
                          {health.status.toUpperCase()}
                        </Badge>
                      </CardDescription>
                    </div>
                  </div>
                  <div className={`w-3 h-3 rounded-full ${getStatusColor(health.status)}`} />
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Métricas Principais */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">CPU</span>
                      <span className="font-medium">{health.cpu_usage.toFixed(1)}%</span>
                    </div>
                    <Progress value={health.cpu_usage} className="h-2" />
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Memória</span>
                      <span className="font-medium">{health.memory_usage.toFixed(1)}%</span>
                    </div>
                    <Progress value={health.memory_usage} className="h-2" />
                  </div>
                </div>

                <Separator />

                {/* Estatísticas de Mensagens */}
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-2xl font-bold text-green-600">{health.messages_sent}</p>
                    <p className="text-xs text-muted-foreground">Enviadas</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-red-600">{health.messages_failed}</p>
                    <p className="text-xs text-muted-foreground">Falharam</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-blue-600">
                      {health.messages_sent > 0 ? 
                        ((health.messages_sent / (health.messages_sent + health.messages_failed)) * 100).toFixed(1) : 0}%
                    </p>
                    <p className="text-xs text-muted-foreground">Taxa de Sucesso</p>
                  </div>
                </div>

                <Separator />

                {/* Métricas Detalhadas */}
                <div className="space-y-3">
                  <h4 className="text-sm font-medium">Métricas de Performance</h4>
                  {health.metrics.map((metric) => (
                    <div key={metric.id} className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">{metric.name}</span>
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-medium ${getMetricStatusColor(metric.status)}`}>
                          {metric.value.toFixed(metric.unit === 'ms' ? 0 : 1)}{metric.unit}
                        </span>
                        <div className={`w-2 h-2 rounded-full ${
                          metric.trend === 'up' ? 'bg-green-500' :
                          metric.trend === 'down' ? 'bg-red-500' : 'bg-gray-500'
                        }`} />
                      </div>
                    </div>
                  ))}
                </div>

                {/* Informações Adicionais */}
                <div className="pt-2 border-t">
                  <div className="grid grid-cols-2 gap-4 text-xs text-muted-foreground">
                    <div>
                      <span>Uptime: {formatUptime(health.uptime)}</span>
                    </div>
                    <div>
                      <span>Última verificação: {new Date(health.last_ping).toLocaleTimeString('pt-BR')}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Logs de Health Check */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="h-5 w-5" />
            Logs de Health Check
          </CardTitle>
          <CardDescription>
            Histórico recente de verificações de saúde das instâncias
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 max-h-64 overflow-y-auto">
            {healthLogs.slice(0, 10).map((log, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-3">
                  {getHealthStatusIcon(log.health_status)}
                  <div>
                    <p className="text-sm font-medium">
                      {instances.find(i => i.id === log.whatsapp_instance_id)?.name || 'Instância Desconhecida'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {log.error_message || 'Verificação realizada'}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">
                    {new Date(log.timestamp).toLocaleString('pt-BR')}
                  </p>
                  {log.response_time && (
                    <p className="text-xs font-medium">{log.response_time}ms</p>
                  )}
                </div>
              </div>
            ))}
            
            {healthLogs.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>Nenhum log de health check disponível</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}