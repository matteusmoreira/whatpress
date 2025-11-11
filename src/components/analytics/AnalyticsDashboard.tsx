import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { MetricAlerts } from './MetricAlerts'
import { 
  TrendingUp, 
  TrendingDown, 
  Users, 
  Mail, 
  MessageSquare, 
  DollarSign,
  Target,
  BarChart3,
  Calendar,
  Download,
  Filter,
  RefreshCw,
  Eye,
  MousePointer,
  Reply
} from 'lucide-react'
import { useAnalytics, CampaignMetrics, ContactMetrics, FlowMetrics } from '@/hooks/useAnalytics'
import { LineChart, Line, AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { format, subDays, startOfDay, endOfDay } from 'date-fns'
import { toast } from 'sonner'

interface DateRange {
  start: Date
  end: Date
  label: string
}

const DATE_RANGES: DateRange[] = [
  { start: subDays(new Date(), 7), end: new Date(), label: 'Últimos 7 dias' },
  { start: subDays(new Date(), 30), end: new Date(), label: 'Últimos 30 dias' },
  { start: subDays(new Date(), 90), end: new Date(), label: 'Últimos 90 dias' },
  { start: subDays(new Date(), 365), end: new Date(), label: 'Último ano' }
]

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8']

export function AnalyticsDashboard() {
  const { 
    getCampaignMetrics, 
    getContactMetrics, 
    getFlowMetrics,
    getTimeSeriesData,
    getUsageStats,
    predictEngagement,
    predictConversion,
    predictChurn,
    exportToExcel,
    exportToCSV,
    exportToPDF,
    subscribeToRealTimeMetrics,
    isLoading,
    error 
  } = useAnalytics()

  const [dateRange, setDateRange] = useState<DateRange>(DATE_RANGES[1])
  const [compareRange, setCompareRange] = useState<DateRange>({
    start: subDays(new Date(), 60),
    end: subDays(new Date(), 30),
    label: 'Período Anterior'
  })
  const [showComparison, setShowComparison] = useState(false)
  const [campaignMetrics, setCampaignMetrics] = useState<CampaignMetrics | null>(null)
  const [contactMetrics, setContactMetrics] = useState<ContactMetrics | null>(null)
  const [flowMetrics, setFlowMetrics] = useState<FlowMetrics | null>(null)
  const [messageChartData, setMessageChartData] = useState<any[]>([])
  const [engagementChartData, setEngagementChartData] = useState<any[]>([])
  const [channelChartData, setChannelChartData] = useState<any[]>([])
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [predictions, setPredictions] = useState({
    engagement: null as any,
    conversion: null as any,
    churn: null as any
  })
  const [realTimeData, setRealTimeData] = useState<any[]>([])

  // Carregar dados
  useEffect(() => {
    loadData()
  }, [dateRange])

  // Configurar WebSocket para dados em tempo real
  useEffect(() => {
    const unsubscribe = subscribeToRealTimeMetrics((newData) => {
      setRealTimeData(prev => [...prev, newData].slice(-100)) // Manter últimos 100 eventos
    })

    return () => {
      if (unsubscribe) unsubscribe()
    }
  }, [subscribeToRealTimeMetrics])

  const loadData = async () => {
    try {
      setIsRefreshing(true)

      // Carregar métricas principais
      const [campaignData, contactData, flowData, messageData, engagementData] = await Promise.all([
        getCampaignMetrics(dateRange),
        getContactMetrics(dateRange),
        getFlowMetrics(dateRange),
        getTimeSeriesData('messages', dateRange, 'day'),
        getTimeSeriesData('engagement', dateRange, 'day')
      ])

      setCampaignMetrics(campaignData)
      setContactMetrics(contactData)
      setFlowMetrics(flowData)
      setMessageChartData(messageData)
      setEngagementChartData(engagementData)

      // Dados mock para gráfico de canais
      setChannelChartData([
        { name: 'WhatsApp', value: 450, color: '#25D366' },
        { name: 'Email', value: 300, color: '#EA4335' },
        { name: 'SMS', value: 150, color: '#34A853' }
      ])

      // Carregar análises preditivas
      await loadPredictiveAnalytics(campaignData, engagementData)

    } catch (error) {
      toast.error('Erro ao carregar dados do dashboard')
      console.error('Erro ao carregar dados:', error)
    } finally {
      setIsRefreshing(false)
    }
  }

  const loadPredictiveAnalytics = async (campaignData: any, engagementData: any) => {
    try {
      const [engagementPrediction, conversionPrediction, churnPrediction] = await Promise.all([
        predictEngagement(campaignData),
        predictConversion(campaignData),
        predictChurn({ totalContacts: contactMetrics?.totalContacts || 0, activeContacts: contactMetrics?.activeContacts || 0 })
      ])

      setPredictions({
        engagement: engagementPrediction,
        conversion: conversionPrediction,
        churn: churnPrediction
      })
    } catch (error) {
      console.error('Erro ao carregar análises preditivas:', error)
    }
  }

  const handleRefresh = () => {
    loadData()
  }

  const handleExport = async (format: 'excel' | 'csv' | 'pdf') => {
    const data = [
      {
        'Métrica': 'Campanhas Ativas',
        'Valor': campaignMetrics?.totalCampaigns || 0,
        'Período': `${dateRange.start.toLocaleDateString()} - ${dateRange.end.toLocaleDateString()}`
      },
      {
        'Métrica': 'Taxa de Abertura',
        'Valor': `${campaignMetrics?.openRate || 0}%`,
        'Período': `${dateRange.start.toLocaleDateString()} - ${dateRange.end.toLocaleDateString()}`
      },
      {
        'Métrica': 'Taxa de Cliques',
        'Valor': `${campaignMetrics?.clickRate || 0}%`,
        'Período': `${dateRange.start.toLocaleDateString()} - ${dateRange.end.toLocaleDateString()}`
      },
      {
        'Métrica': 'Contatos Totais',
        'Valor': contactMetrics?.totalContacts || 0,
        'Período': `${dateRange.start.toLocaleDateString()} - ${dateRange.end.toLocaleDateString()}`
      },
      {
        'Métrica': 'Receita Total',
        'Valor': `R$ ${revenueMetrics?.totalRevenue || 0}`,
        'Período': `${dateRange.start.toLocaleDateString()} - ${dateRange.end.toLocaleDateString()}`
      }
    ]

    const filename = `relatorio-analytics-${new Date().toISOString().split('T')[0]}`

    switch (format) {
      case 'excel':
        await exportToExcel(data, filename)
        break
      case 'csv':
        await exportToCSV(data, filename)
        break
      case 'pdf':
        await exportToPDF(data, ['Métrica', 'Valor', 'Período'], filename, 'Relatório de Analytics')
        break
    }
  }  toast.success('Dashboard atualizado')
  }

  const handleExport = (format: 'pdf' | 'excel' | 'csv') => {
    toast.success(`Exportando relatório em ${format.toUpperCase()}...`)
    // Implementar exportação real
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <p className="text-red-600 mb-4">Erro ao carregar dashboard</p>
          <Button onClick={handleRefresh} variant="outline">
            <RefreshCw className="w-4 h-4 mr-2" />
            Tentar Novamente
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Analytics Dashboard</h1>
          <p className="text-gray-600 mt-1">
            Acompanhe o desempenho das suas campanhas e métricas de engajamento
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Download className="w-4 h-4 mr-2" />
                Exportar
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => handleExport('excel')}>
                <FileSpreadsheet className="w-4 h-4 mr-2" />
                Exportar Excel
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport('csv')}>
                <FileText className="w-4 h-4 mr-2" />
                Exportar CSV
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport('pdf')}>
                <FileText className="w-4 h-4 mr-2" />
                Exportar PDF
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowComparison(!showComparison)}
            className={showComparison ? 'bg-blue-100' : ''}
          >
            <BarChart3 className="w-4 h-4 mr-2" />
            Comparar Períodos
          </Button>
          
          <select
            value={DATE_RANGES.findIndex(range => range.label === dateRange.label)}
            onChange={(e) => setDateRange(DATE_RANGES[parseInt(e.target.value)])}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm"
          >
            {DATE_RANGES.map((range, index) => (
              <option key={index} value={index}>
                {range.label}
              </option>
            ))}
          </select>
          
          <Button variant="outline" size="sm">
            <Filter className="w-4 h-4 mr-2" />
            Filtros
          </Button>
          
          <Button variant="outline" size="sm">
            <Download className="w-4 h-4 mr-2" />
            Exportar
          </Button>
        </div>
      </div>

      {/* Cards de Métricas Principais */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Mensagens Enviadas"
          value={campaignMetrics?.totalSent || 0}
          change={12.5}
          trend="up"
          icon={Mail}
          color="blue"
          loading={isLoading}
        />
        
        <MetricCard
          title="Taxa de Entrega"
          value={campaignMetrics ? (campaignMetrics.delivered / campaignMetrics.totalSent * 100) : 0}
          change={2.1}
          trend="up"
          icon={Target}
          color="green"
          unit="%"
          loading={isLoading}
        />
        
        <MetricCard
          title="Taxa de Abertura"
          value={campaignMetrics ? (campaignMetrics.opened / campaignMetrics.totalSent * 100) : 0}
          change={-1.2}
          trend="down"
          icon={Eye}
          color="purple"
          unit="%"
          loading={isLoading}
        />
        
        <MetricCard
          title="Taxa de Cliques"
          value={campaignMetrics ? campaignMetrics.conversionRate : 0}
          change={5.8}
          trend="up"
          icon={MousePointer}
          color="orange"
          unit="%"
          loading={isLoading}
        />
      </div>

      {/* Gráficos Principais */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Visão Geral</TabsTrigger>
          <TabsTrigger value="campaigns">Campanhas</TabsTrigger>
          <TabsTrigger value="engagement">Engajamento</TabsTrigger>
          <TabsTrigger value="channels">Canais</TabsTrigger>
          <TabsTrigger value="flows">Fluxos</TabsTrigger>
          <TabsTrigger value="alerts">Alertas</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Volume de Mensagens</CardTitle>
                <CardDescription>Mensagens enviadas por dia</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={messageChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Area type="monotone" dataKey="value" stroke="#3B82F6" fill="#3B82F6" fillOpacity={0.3} />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Engajamento</CardTitle>
                <CardDescription>Taxas de engajamento ao longo do tempo</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={engagementChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Line type="monotone" dataKey="value" stroke="#10B981" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Contatos</CardTitle>
                <CardDescription>Resumo de contatos</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Total</span>
                    <span className="font-semibold">{contactMetrics?.totalContacts || 0}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Ativos</span>
                    <span className="font-semibold text-green-600">{contactMetrics?.activeContacts || 0}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Novos</span>
                    <span className="font-semibold text-blue-600">{contactMetrics?.newContacts || 0}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Crescimento</span>
                    <span className="font-semibold text-purple-600">{contactMetrics?.growthRate.toFixed(1) || 0}%</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Fluxos</CardTitle>
                <CardDescription>Resumo de fluxos de automação</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Total</span>
                    <span className="font-semibold">{flowMetrics?.totalFlows || 0}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Ativos</span>
                    <span className="font-semibold text-green-600">{flowMetrics?.activeFlows || 0}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Execuções</span>
                    <span className="font-semibold text-blue-600">{flowMetrics?.totalExecutions || 0}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600">Sucesso</span>
                    <span className="font-semibold text-purple-600">
                      {flowMetrics && flowMetrics.totalExecutions > 0 
                        ? ((flowMetrics.successfulExecutions / flowMetrics.totalExecutions) * 100).toFixed(1)
                        : 0}%
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Canais</CardTitle>
                <CardDescription>Distribuição por canal</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={channelChartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {channelChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div className="mt-4 space-y-2">
                  {channelChartData.map((item, index) => (
                    <div key={index} className="flex items-center justify-between text-sm">
                      <div className="flex items-center">
                        <div 
                          className="w-3 h-3 rounded-full mr-2" 
                          style={{ backgroundColor: item.color }}
                        />
                        <span>{item.name}</span>
                      </div>
                      <span className="font-medium">{item.value}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

        {/* Análises Preditivas */}
        {predictions.engagement && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <TrendingUp className="h-5 w-5 mr-2 text-green-600" />
                  Previsão de Engajamento
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  {predictions.engagement.confidence.toFixed(1)}%
                </div>
                <p className="text-sm text-gray-600">
                  {predictions.engagement.prediction === 'high' ? 'Alto engajamento esperado' : 
                   predictions.engagement.prediction === 'medium' ? 'Engajamento médio esperado' :
                   'Baixo engajamento esperado'}
                </p>
                <div className="mt-2">
                  <p className="text-xs text-gray-500">
                    Fatores principais:
                  </p>
                  {predictions.engagement.factors.slice(0, 2).map((factor, index) => (
                    <div key={index} className="text-xs text-gray-600">
                      • {factor.name}: {factor.impact}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Target className="h-5 w-5 mr-2 text-blue-600" />
                  Previsão de Conversão
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-600">
                  {predictions.conversion.confidence.toFixed(1)}%
                </div>
                <p className="text-sm text-gray-600">
                  Taxa de conversão esperada: {predictions.conversion.prediction}%
                </p>
                <div className="mt-2">
                  <p className="text-xs text-gray-500">
                    Recomendações:
                  </p>
                  {predictions.conversion.recommendations?.slice(0, 2).map((rec, index) => (
                    <div key={index} className="text-xs text-gray-600">
                      • {rec}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Users className="h-5 w-5 mr-2 text-red-600" />
                  Previsão de Churn
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">
                  {predictions.churn.confidence.toFixed(1)}%
                </div>
                <p className="text-sm text-gray-600">
                  Risco de churn: {predictions.churn.prediction}
                </p>
                <div className="mt-2">
                  <p className="text-xs text-gray-500">
                    Ações recomendadas:
                  </p>
                  {predictions.churn.recommendations?.slice(0, 2).map((rec, index) => (
                    <div key={index} className="text-xs text-gray-600">
                      • {rec}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Dados em Tempo Real */}
        {realTimeData.length > 0 && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center">
                <Radio className="h-5 w-5 mr-2 text-green-500" />
                Eventos em Tempo Real
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {realTimeData.slice(-10).reverse().map((event, index) => (
                  <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                    <div className="flex items-center">
                      <div className={`w-2 h-2 rounded-full mr-2 ${
                        event.event_type === 'message_sent' ? 'bg-blue-500' :
                        event.event_type === 'message_opened' ? 'bg-green-500' :
                        event.event_type === 'link_clicked' ? 'bg-yellow-500' :
                        'bg-gray-500'
                      }`} />
                      <span className="text-sm font-medium">{event.event_name}</span>
                    </div>
                    <div className="text-xs text-gray-500">
                      {new Date(event.timestamp).toLocaleTimeString()}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
          </div>
        </TabsContent>

        <TabsContent value="campaigns" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Desempenho das Campanhas</CardTitle>
              <CardDescription>Comparativo de campanhas recentes</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={[
                  { name: 'Campanha 1', sent: 400, delivered: 380, opened: 250, clicked: 120 },
                  { name: 'Campanha 2', sent: 300, delivered: 290, opened: 180, clicked: 80 },
                  { name: 'Campanha 3', sent: 500, delivered: 480, opened: 320, clicked: 150 },
                  { name: 'Campanha 4', sent: 200, delivered: 195, opened: 120, clicked: 45 }
                ]}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="sent" fill="#3B82F6" name="Enviadas" />
                  <Bar dataKey="delivered" fill="#10B981" name="Entregues" />
                  <Bar dataKey="opened" fill="#F59E0B" name="Abertas" />
                  <Bar dataKey="clicked" fill="#EF4444" name="Clicadas" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="engagement" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Taxas de Engajamento</CardTitle>
                <CardDescription>Evolução das taxas ao longo do tempo</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={[
                    { date: '2024-01', openRate: 25, clickRate: 8, replyRate: 3 },
                    { date: '2024-02', openRate: 28, clickRate: 9, replyRate: 3.5 },
                    { date: '2024-03', openRate: 32, clickRate: 11, replyRate: 4 },
                    { date: '2024-04', openRate: 30, clickRate: 10, replyRate: 3.8 },
                    { date: '2024-05', openRate: 35, clickRate: 12, replyRate: 4.5 },
                    { date: '2024-06', openRate: 38, clickRate: 14, replyRate: 5 }
                  ]}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="openRate" stroke="#3B82F6" name="Taxa de Abertura" />
                    <Line type="monotone" dataKey="clickRate" stroke="#10B981" name="Taxa de Clique" />
                    <Line type="monotone" dataKey="replyRate" stroke="#F59E0B" name="Taxa de Resposta" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Score de Engajamento</CardTitle>
                <CardDescription>Métrica geral de engajamento</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center">
                  <div className="text-6xl font-bold text-blue-600 mb-2">
                    {campaignMetrics ? campaignMetrics.engagementScore.toFixed(0) : 0}
                  </div>
                  <div className="text-gray-600 mb-4">Score de Engajamento</div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-blue-600 h-2 rounded-full" 
                      style={{ width: `${campaignMetrics ? campaignMetrics.engagementScore : 0}%` }}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="channels" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-green-500 rounded" />
                  WhatsApp
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Enviadas</span>
                    <span className="font-semibold">450</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Entregues</span>
                    <span className="font-semibold text-green-600">432</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Lidas</span>
                    <span className="font-semibold text-blue-600">315</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Respondidas</span>
                    <span className="font-semibold text-purple-600">89</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-red-500 rounded" />
                  Email
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Enviadas</span>
                    <span className="font-semibold">300</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Entregues</span>
                    <span className="font-semibold text-green-600">285</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Abertas</span>
                    <span className="font-semibold text-blue-600">195</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Clicadas</span>
                    <span className="font-semibold text-purple-600">67</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-green-600 rounded" />
                  SMS
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Enviadas</span>
                    <span className="font-semibold">150</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Entregues</span>
                    <span className="font-semibold text-green-600">147</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Falhadas</span>
                    <span className="font-semibold text-red-600">3</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Taxa de Entrega</span>
                    <span className="font-semibold text-purple-600">98%</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="flows" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Top Fluxos por Execuções</CardTitle>
              <CardDescription>Fluxos mais executados recentemente</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {flowMetrics?.topFlows.map((flow, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <div className="font-semibold">{flow.name}</div>
                      <div className="text-sm text-gray-600">
                        {flow.executions} execuções • {flow.successRate}% sucesso
                      </div>
                    </div>
                    <Badge variant={flow.successRate >= 80 ? 'success' : flow.successRate >= 60 ? 'warning' : 'destructive'}>
                      {flow.successRate}%
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="alerts" className="space-y-4">
          <MetricAlerts />
        </TabsContent>
      </Tabs>
    </div>
  )
}

// Componente de Card de Métrica
interface MetricCardProps {
  title: string
  value: number
  change?: number
  trend?: 'up' | 'down' | 'stable'
  icon: React.ElementType
  color?: 'blue' | 'green' | 'purple' | 'orange' | 'red'
  unit?: string
  loading?: boolean
}

function MetricCard({ title, value, change, trend, icon: Icon, color = 'blue', unit = '', loading }: MetricCardProps) {
  const colorClasses = {
    blue: 'bg-blue-100 text-blue-600',
    green: 'bg-green-100 text-green-600',
    purple: 'bg-purple-100 text-purple-600',
    orange: 'bg-orange-100 text-orange-600',
    red: 'bg-red-100 text-red-600'
  }

  const formatValue = (val: number) => {
    if (unit === '%') {
      return `${val.toFixed(1)}%`
    }
    return val.toLocaleString('pt-BR')
  }

  if (loading) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">{title}</CardTitle>
          <div className={`p-2 rounded-lg ${colorClasses[color]}`}>
            <Icon className="w-4 h-4" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-3/4 mb-2" />
            <div className="h-4 bg-gray-200 rounded w-1/2" />
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <div className={`p-2 rounded-lg ${colorClasses[color]}`}>
          <Icon className="w-4 h-4" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{formatValue(value)}</div>
        {change !== undefined && (
          <div className="flex items-center mt-1">
            {trend === 'up' && <TrendingUp className="w-4 h-4 text-green-600 mr-1" />}
            {trend === 'down' && <TrendingDown className="w-4 h-4 text-red-600 mr-1" />}
            <span className={`text-xs ${trend === 'up' ? 'text-green-600' : trend === 'down' ? 'text-red-600' : 'text-gray-600'}`}>
              {change > 0 ? '+' : ''}{change.toFixed(1)}%
            </span>
            <span className="text-xs text-gray-500 ml-1">vs período anterior</span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}