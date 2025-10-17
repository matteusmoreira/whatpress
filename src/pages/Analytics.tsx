import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Progress } from '@/components/ui/progress'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { 
  BarChart3, 
  TrendingUp, 
  TrendingDown,
  Users,
  MessageSquare,
  Send,
  CheckCircle,
  Clock,
  Eye,
  Reply,
  Calendar,
  Download,
  Filter,
  RefreshCw,
  Target,
  Zap,
  Globe,
  Smartphone,
  Mail,
  Activity,
  XCircle,
  Loader2,
  FileText,
  PieChart,
  BarChart,
  LineChart as LineChartIcon,
  Settings
} from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  BarChart as RechartsBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  AreaChart,
  Area
} from 'recharts'
import { format, subDays } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { useAnalytics } from '@/hooks/useAnalytics'

export default function Analytics() {
  const {
    metrics,
    messageVolumeData,
    campaignPerformanceData,
    audienceSegmentData,
    responseTimeData,
    filters,
    loading,
    updateFilters,
    exportAnalytics,
    getRealTimeMetrics,
    comparePeriods,
    refreshMetrics
  } = useAnalytics()

  const [selectedMetric, setSelectedMetric] = useState('messages')
  const [exportDialogOpen, setExportDialogOpen] = useState(false)
  const [realTimeData, setRealTimeData] = useState<any>(null)
  const [exportOptions, setExportOptions] = useState({
    format: 'pdf' as 'pdf' | 'excel' | 'csv',
    includeCharts: true,
    includeRawData: false,
    dateRange: {
      start: subDays(new Date(), 30),
      end: new Date()
    }
  })

  // Fetch real-time data periodically
  useEffect(() => {
    const fetchRealTime = async () => {
      const data = await getRealTimeMetrics()
      setRealTimeData(data)
    }

    fetchRealTime()
    const interval = setInterval(fetchRealTime, 30000) // Update every 30 seconds

    return () => clearInterval(interval)
  }, [getRealTimeMetrics])

  const formatChange = (change: number) => {
    const isPositive = change > 0
    return (
      <div className={`flex items-center gap-1 ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
        {isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
        <span className="text-xs font-medium">{Math.abs(change)}%</span>
      </div>
    )
  }

  const handleExport = async () => {
    await exportAnalytics(exportOptions)
    setExportDialogOpen(false)
  }

  const handlePeriodChange = (period: string) => {
    updateFilters({ period: period as any })
  }

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8']

  if (loading && !metrics) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Analytics &amp; Relatórios</h1>
          <p className="text-muted-foreground">
            Acompanhe o desempenho das suas campanhas e métricas de engajamento
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={filters.period} onValueChange={handlePeriodChange}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Últimos 7 dias</SelectItem>
              <SelectItem value="30d">Últimos 30 dias</SelectItem>
              <SelectItem value="90d">Últimos 90 dias</SelectItem>
              <SelectItem value="custom">Personalizado</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={() => setExportDialogOpen(true)}>
            <Download className="mr-2 h-4 w-4" />
            Exportar
          </Button>
          <Button variant="outline" onClick={refreshMetrics} disabled={loading}>
            {loading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            Atualizar
          </Button>
        </div>
      </div>

      {/* Real-time Metrics */}
      {realTimeData && (
        <Card className="border-green-200 bg-green-50/50">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Activity className="h-5 w-5 text-green-600" />
              Métricas em Tempo Real
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-green-600">{realTimeData.messagesLastHour}</p>
                <p className="text-sm text-muted-foreground">Mensagens na última hora</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-blue-600">{realTimeData.activeChats}</p>
                <p className="text-sm text-muted-foreground">Chats ativos</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-purple-600">{realTimeData.responseTime}</p>
                <p className="text-sm text-muted-foreground">Tempo médio de resposta</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-orange-600">{realTimeData.onlineAgents}</p>
                <p className="text-sm text-muted-foreground">Agentes online</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Mensagens Enviadas</CardTitle>
            <Send className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.totalMessages?.toLocaleString() || '0'}</div>
            {metrics?.messagesChange && formatChange(metrics.messagesChange)}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Taxa de Entrega</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.deliveryRate || '0'}%</div>
            {metrics?.deliveryRateChange && formatChange(metrics.deliveryRateChange)}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Taxa de Resposta</CardTitle>
            <Reply className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.responseRate || '0'}%</div>
            {metrics?.responseRateChange && formatChange(metrics.responseRateChange)}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Contatos Ativos</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.activeContacts?.toLocaleString() || '0'}</div>
            {metrics?.activeContactsChange && formatChange(metrics.activeContactsChange)}
          </CardContent>
        </Card>
      </div>

      {/* Charts Section */}
      <Tabs defaultValue="volume" className="space-y-4">
        <TabsList>
          <TabsTrigger value="volume">Volume de Mensagens</TabsTrigger>
          <TabsTrigger value="campaigns">Performance de Campanhas</TabsTrigger>
          <TabsTrigger value="audience">Segmentação de Público</TabsTrigger>
          <TabsTrigger value="response">Tempo de Resposta</TabsTrigger>
        </TabsList>

        <TabsContent value="volume" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Volume de Mensagens por Dia</CardTitle>
              <CardDescription>
                Acompanhe o volume diário de mensagens enviadas e recebidas
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={messageVolumeData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="date" 
                      tickFormatter={(value) => format(new Date(value), 'dd/MM', { locale: ptBR })}
                    />
                    <YAxis />
                    <Tooltip 
                      labelFormatter={(value) => format(new Date(value), 'dd/MM/yyyy', { locale: ptBR })}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="sent" 
                      stackId="1"
                      stroke="#8884d8" 
                      fill="#8884d8" 
                      name="Enviadas"
                    />
                    <Area 
                      type="monotone" 
                      dataKey="received" 
                      stackId="1"
                      stroke="#82ca9d" 
                      fill="#82ca9d" 
                      name="Recebidas"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="campaigns" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Performance das Campanhas</CardTitle>
              <CardDescription>
                Compare o desempenho das suas campanhas ativas
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsBarChart data={campaignPerformanceData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="sent" fill="#8884d8" name="Enviadas" />
                    <Bar dataKey="delivered" fill="#82ca9d" name="Entregues" />
                    <Bar dataKey="opened" fill="#ffc658" name="Abertas" />
                    <Bar dataKey="clicked" fill="#ff7300" name="Clicadas" />
                  </RechartsBarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audience" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Segmentação por Dispositivo</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartsPieChart>
                      <Pie
                        data={audienceSegmentData?.device || []}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {(audienceSegmentData?.device || []).map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </RechartsPieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Segmentação por Localização</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartsPieChart>
                      <Pie
                        data={audienceSegmentData?.location || []}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {(audienceSegmentData?.location || []).map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </RechartsPieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="response" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Tempo de Resposta</CardTitle>
              <CardDescription>
                Acompanhe o tempo médio de resposta ao longo do tempo
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={responseTimeData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="date" 
                      tickFormatter={(value) => format(new Date(value), 'dd/MM', { locale: ptBR })}
                    />
                    <YAxis />
                    <Tooltip 
                      labelFormatter={(value) => format(new Date(value), 'dd/MM/yyyy', { locale: ptBR })}
                      formatter={(value) => [`${value} min`, 'Tempo médio']}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="averageTime" 
                      stroke="#8884d8" 
                      strokeWidth={2}
                      name="Tempo médio (min)"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Campaign Performance Table */}
      <Card>
        <CardHeader>
          <CardTitle>Top Campanhas por Performance</CardTitle>
          <CardDescription>
            Campanhas com melhor desempenho no período selecionado
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {campaignPerformanceData?.slice(0, 5).map((campaign, index) => (
              <div key={campaign.name} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-4">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-semibold">
                    {index + 1}
                  </div>
                  <div>
                    <h4 className="font-medium">{campaign.name}</h4>
                    <p className="text-sm text-muted-foreground">
                      {campaign.sent} mensagens enviadas
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-center">
                    <p className="text-sm font-medium">{((campaign.delivered / campaign.sent) * 100).toFixed(1)}%</p>
                    <p className="text-xs text-muted-foreground">Entrega</p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium">{((campaign.opened / campaign.sent) * 100).toFixed(1)}%</p>
                    <p className="text-xs text-muted-foreground">Abertura</p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium">{((campaign.clicked / campaign.sent) * 100).toFixed(1)}%</p>
                    <p className="text-xs text-muted-foreground">Clique</p>
                  </div>
                  <Badge variant={campaign.status === 'active' ? 'default' : 'secondary'}>
                    {campaign.status === 'active' ? 'Ativa' : 'Pausada'}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Export Dialog */}
      <Dialog open={exportDialogOpen} onOpenChange={setExportDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Exportar Relatório</DialogTitle>
            <DialogDescription>
              Configure as opções de exportação do seu relatório
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="export-format">Formato</Label>
              <Select
                value={exportOptions.format}
                onValueChange={(value) => setExportOptions(prev => ({ ...prev, format: value as any }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pdf">PDF</SelectItem>
                  <SelectItem value="excel">Excel</SelectItem>
                  <SelectItem value="csv">CSV</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3">
              <Label>Incluir</Label>
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="include-charts"
                    checked={exportOptions.includeCharts}
                    onChange={(e) => setExportOptions(prev => ({ 
                      ...prev, 
                      includeCharts: e.target.checked 
                    }))}
                    className="rounded"
                  />
                  <Label htmlFor="include-charts" className="text-sm">Gráficos</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="include-raw-data"
                    checked={exportOptions.includeRawData}
                    onChange={(e) => setExportOptions(prev => ({ 
                      ...prev, 
                      includeRawData: e.target.checked 
                    }))}
                    className="rounded"
                  />
                  <Label htmlFor="include-raw-data" className="text-sm">Dados brutos</Label>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setExportDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleExport}>
              <Download className="mr-2 h-4 w-4" />
              Exportar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}