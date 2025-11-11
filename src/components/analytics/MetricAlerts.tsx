import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { AlertTriangle, TrendingUp, TrendingDown, Bell, Settings, X } from 'lucide-react'
import { useAnalytics } from '@/hooks/useAnalytics'
import { toast } from 'sonner'

export interface MetricAlert {
  id: string
  name: string
  description: string
  metric: string
  threshold: number
  operator: 'greater' | 'less' | 'equals'
  currentValue: number
  status: 'active' | 'resolved' | 'dismissed'
  severity: 'low' | 'medium' | 'high' | 'critical'
  createdAt: Date
  triggeredAt?: Date
  recommendations: string[]
}

interface MetricAlertsProps {
  className?: string
}

export function MetricAlerts({ className }: MetricAlertsProps) {
  const [alerts, setAlerts] = useState<MetricAlert[]>([])
  const [isConfigOpen, setIsConfigOpen] = useState(false)
  const [newAlert, setNewAlert] = useState({
    name: '',
    metric: '',
    threshold: 0,
    operator: 'greater' as 'greater' | 'less' | 'equals',
    severity: 'medium' as 'low' | 'medium' | 'high' | 'critical'
  })

  const { setupMetricAlerts } = useAnalytics()
  const [isLoading, setIsLoading] = useState(false)

  // Alertas pré-configurados
  const defaultAlerts = [
    {
      id: '1',
      name: 'Taxa de Abertura Baixa',
      description: 'Taxa de abertura das campanhas está abaixo do esperado',
      metric: 'openRate',
      threshold: 15,
      operator: 'less' as const,
      currentValue: 12,
      status: 'active' as const,
      severity: 'medium' as const,
      createdAt: new Date(),
      triggeredAt: new Date(),
      recommendations: [
        'Revisar linhas de assunto das campanhas',
        'Segmentar melhor a audiência',
        'Testar horários de envio diferentes'
      ]
    },
    {
      id: '2',
      name: 'Taxa de Rejeição Alta',
      description: 'Muitos usuários estão se desinscrevendo',
      metric: 'unsubscribeRate',
      threshold: 2,
      operator: 'greater' as const,
      currentValue: 3.5,
      status: 'active' as const,
      severity: 'high' as const,
      createdAt: new Date(),
      triggeredAt: new Date(),
      recommendations: [
        'Reduzir frequência de envios',
        'Melhorar relevância do conteúdo',
        'Implementar preferências de frequência'
      ]
    },
    {
      id: '3',
      name: 'Crescimento de Contatos',
      description: 'Bom crescimento na base de contatos',
      metric: 'contactGrowth',
      threshold: 10,
      operator: 'greater' as const,
      currentValue: 15,
      status: 'resolved' as const,
      severity: 'low' as const,
      createdAt: new Date(Date.now() - 86400000),
      triggeredAt: new Date(Date.now() - 86400000),
      recommendations: [
        'Manter estratégias atuais',
        'Aproveitar para campanhas de onboarding'
      ]
    }
  ]

  useEffect(() => {
    setAlerts(defaultAlerts)
    
    // Configurar alertas automáticos
    setupMetricAlerts([
      { metric: 'openRate', threshold: 15, operator: 'less', message: 'Taxa de abertura baixa' },
      { metric: 'clickRate', threshold: 2, operator: 'less', message: 'Taxa de cliques baixa' },
      { metric: 'unsubscribeRate', threshold: 2, operator: 'greater', message: 'Taxa de rejeição alta' },
      { metric: 'bounceRate', threshold: 5, operator: 'greater', message: 'Taxa de bounce alta' }
    ])
  }, [])

  const dismissAlert = (alertId: string) => {
    setAlerts(prev => prev.map(alert => 
      alert.id === alertId ? { ...alert, status: 'dismissed' } : alert
    ))
    toast.success('Alerta descartado')
  }

  const resolveAlert = (alertId: string) => {
    setAlerts(prev => prev.map(alert => 
      alert.id === alertId ? { ...alert, status: 'resolved' } : alert
    ))
    toast.success('Alerta marcado como resolvido')
  }

  const addCustomAlert = () => {
    if (!newAlert.name || !newAlert.metric) {
      toast.error('Preencha todos os campos obrigatórios')
      return
    }

    const alert: MetricAlert = {
      id: Date.now().toString(),
      name: newAlert.name,
      description: `Alerta personalizado para ${newAlert.metric}`,
      metric: newAlert.metric,
      threshold: newAlert.threshold,
      operator: newAlert.operator,
      currentValue: 0,
      status: 'active',
      severity: newAlert.severity,
      createdAt: new Date(),
      recommendations: ['Monitorar métrica regularmente', 'Ajustar threshold conforme necessário']
    }

    setAlerts(prev => [alert, ...prev])
    setNewAlert({ name: '', metric: '', threshold: 0, operator: 'greater', severity: 'medium' })
    setIsConfigOpen(false)
    toast.success('Alerta personalizado adicionado')
  }

  const activeAlerts = alerts.filter(alert => alert.status === 'active')
  const otherAlerts = alerts.filter(alert => alert.status !== 'active')

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-100 text-red-800 border-red-200'
      case 'high': return 'bg-orange-100 text-orange-800 border-orange-200'
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'low': return 'bg-blue-100 text-blue-800 border-blue-200'
      default: return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
      case 'high':
        return <AlertTriangle className="h-4 w-4" />
      case 'medium':
        return <TrendingDown className="h-4 w-4" />
      case 'low':
        return <TrendingUp className="h-4 w-4" />
      default:
        return <Bell className="h-4 w-4" />
    }
  }

  if (isLoading) {
    return (
      <Card className={className}>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className={className}>
      {/* Alertas Ativos */}
      {activeAlerts.length > 0 && (
        <Card className="mb-6 border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle className="flex items-center text-red-800">
              <AlertTriangle className="h-5 w-5 mr-2" />
              Alertas Ativos ({activeAlerts.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {activeAlerts.map(alert => (
                <div key={alert.id} className="p-4 bg-white rounded-lg border border-red-200">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center">
                      {getSeverityIcon(alert.severity)}
                      <h4 className="ml-2 font-semibold">{alert.name}</h4>
                    </div>
                    <Badge className={getSeverityColor(alert.severity)}>
                      {alert.severity.toUpperCase()}
                    </Badge>
                  </div>
                  
                  <p className="text-sm text-gray-600 mb-3">{alert.description}</p>
                  
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-sm">
                      <span className="font-medium">Valor atual:</span> {alert.currentValue}
                      <span className="mx-2">|</span>
                      <span className="font-medium">Threshold:</span> {alert.threshold}
                    </div>
                    <div className="text-xs text-gray-500">
                      Disparado em: {alert.triggeredAt?.toLocaleDateString()}
                    </div>
                  </div>

                  {alert.recommendations.length > 0 && (
                    <div className="mb-3">
                      <p className="text-sm font-medium mb-1">Recomendações:</p>
                      <ul className="text-sm text-gray-600 space-y-1">
                        {alert.recommendations.map((rec, index) => (
                          <li key={index} className="flex items-start">
                            <span className="mr-2">•</span>
                            {rec}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => resolveAlert(alert.id)}
                    >
                      Marcar como Resolvido
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => dismissAlert(alert.id)}
                    >
                      <X className="h-4 w-4 mr-1" />
                      Descartar
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Configuração de Alertas */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center">
              <Bell className="h-5 w-5 mr-2" />
              Configuração de Alertas
            </span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsConfigOpen(!isConfigOpen)}
            >
              <Settings className="h-4 w-4 mr-1" />
              {isConfigOpen ? 'Fechar' : 'Configurar'}
            </Button>
          </CardTitle>
        </CardHeader>
        
        {isConfigOpen && (
          <CardContent>
            <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Nome do Alerta</label>
                  <input
                    type="text"
                    value={newAlert.name}
                    onChange={(e) => setNewAlert(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Ex: Taxa de Conversão Alta"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-1">Métrica</label>
                  <select
                    value={newAlert.metric}
                    onChange={(e) => setNewAlert(prev => ({ ...prev, metric: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Selecione uma métrica</option>
                    <option value="openRate">Taxa de Abertura</option>
                    <option value="clickRate">Taxa de Cliques</option>
                    <option value="conversionRate">Taxa de Conversão</option>
                    <option value="unsubscribeRate">Taxa de Rejeição</option>
                    <option value="bounceRate">Taxa de Bounce</option>
                    <option value="contactGrowth">Crescimento de Contatos</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-1">Operador</label>
                  <select
                    value={newAlert.operator}
                    onChange={(e) => setNewAlert(prev => ({ ...prev, operator: e.target.value as any }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="greater">Maior que</option>
                    <option value="less">Menor que</option>
                    <option value="equals">Igual a</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-1">Valor Limite</label>
                  <input
                    type="number"
                    value={newAlert.threshold}
                    onChange={(e) => setNewAlert(prev => ({ ...prev, threshold: Number(e.target.value) }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Ex: 15"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-1">Severidade</label>
                  <select
                    value={newAlert.severity}
                    onChange={(e) => setNewAlert(prev => ({ ...prev, severity: e.target.value as any }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="low">Baixa</option>
                    <option value="medium">Média</option>
                    <option value="high">Alta</option>
                    <option value="critical">Crítica</option>
                  </select>
                </div>
              </div>
              
              <Button onClick={addCustomAlert} className="w-full md:w-auto">
                Adicionar Alerta Personalizado
              </Button>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Histórico de Alertas */}
      {otherAlerts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Histórico de Alertas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {otherAlerts.map(alert => (
                <div key={alert.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center">
                    {getSeverityIcon(alert.severity)}
                    <div className="ml-3">
                      <p className="font-medium">{alert.name}</p>
                      <p className="text-sm text-gray-600">
                        {alert.status === 'resolved' ? 'Resolvido' : 'Descartado'} em {alert.createdAt.toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <Badge 
                    variant={alert.status === 'resolved' ? 'default' : 'secondary'}
                  >
                    {alert.status === 'resolved' ? 'Resolvido' : 'Descartado'}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}