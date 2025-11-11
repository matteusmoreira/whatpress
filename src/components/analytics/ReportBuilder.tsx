import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { 
  BarChart3, 
  Download, 
  Filter, 
  Calendar, 
  Users, 
  Mail, 
  TrendingUp,
  Save,
  Plus,
  Trash2,
  Edit,
  Eye
} from 'lucide-react'
import { useAnalytics } from '@/hooks/useAnalytics'
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { format, subDays, startOfDay, endOfDay } from 'date-fns'
import { toast } from 'sonner'

export interface ReportConfig {
  id: string
  name: string
  description: string
  type: 'campaign' | 'engagement' | 'conversion' | 'revenue' | 'custom'
  metrics: string[]
  dimensions: string[]
  filters: ReportFilter[]
  dateRange: DateRange
  chartType: 'bar' | 'line' | 'pie' | 'table'
  schedule?: {
    enabled: boolean
    frequency: 'daily' | 'weekly' | 'monthly'
    recipients: string[]
  }
}

export interface ReportFilter {
  field: string
  operator: 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'contains' | 'not_contains'
  value: string | number | boolean
}

export interface DateRange {
  start: Date
  end: Date
  label: string
}

interface ReportData {
  data: any[]
  summary: Record<string, number>
  total: number
}

const AVAILABLE_METRICS = {
  campaign: [
    { id: 'total_sent', name: 'Total Enviado', type: 'number' },
    { id: 'delivered', name: 'Entregues', type: 'number' },
    { id: 'opened', name: 'Abertas', type: 'number' },
    { id: 'clicked', name: 'Clicadas', type: 'number' },
    { id: 'conversion_rate', name: 'Taxa de Conversão', type: 'percentage' },
    { id: 'bounce_rate', name: 'Taxa de Rejeição', type: 'percentage' },
    { id: 'unsubscribe_rate', name: 'Taxa de Cancelamento', type: 'percentage' }
  ],
  engagement: [
    { id: 'open_rate', name: 'Taxa de Abertura', type: 'percentage' },
    { id: 'click_rate', name: 'Taxa de Clique', type: 'percentage' },
    { id: 'reply_rate', name: 'Taxa de Resposta', type: 'percentage' },
    { id: 'engagement_score', name: 'Score de Engajamento', type: 'number' },
    { id: 'time_spent', name: 'Tempo Médio', type: 'time' }
  ],
  conversion: [
    { id: 'conversions', name: 'Conversões', type: 'number' },
    { id: 'conversion_value', name: 'Valor de Conversão', type: 'currency' },
    { id: 'cost_per_conversion', name: 'Custo por Conversão', type: 'currency' },
    { id: 'roi', name: 'ROI', type: 'percentage' }
  ],
  revenue: [
    { id: 'total_revenue', name: 'Receita Total', type: 'currency' },
    { id: 'average_order_value', name: 'Valor Médio do Pedido', type: 'currency' },
    { id: 'customer_lifetime_value', name: 'Valor de Vida do Cliente', type: 'currency' },
    { id: 'revenue_per_message', name: 'Receita por Mensagem', type: 'currency' }
  ]
}

const AVAILABLE_DIMENSIONS = [
  { id: 'date', name: 'Data', type: 'date' },
  { id: 'campaign', name: 'Campanha', type: 'string' },
  { id: 'channel', name: 'Canal', type: 'string' },
  { id: 'segment', name: 'Segmento', type: 'string' },
  { id: 'device', name: 'Dispositivo', type: 'string' },
  { id: 'location', name: 'Localização', type: 'string' },
  { id: 'flow', name: 'Fluxo', type: 'string' },
  { id: 'user_type', name: 'Tipo de Usuário', type: 'string' }
]

const DATE_RANGES = [
  { label: 'Últimos 7 dias', days: 7 },
  { label: 'Últimos 30 dias', days: 30 },
  { label: 'Últimos 90 dias', days: 90 },
  { label: 'Últimos 6 meses', days: 180 },
  { label: 'Último ano', days: 365 },
  { label: 'Personalizado', days: 0 }
]

export function ReportBuilder() {
  const { getCampaignMetrics, getTimeSeriesData } = useAnalytics()
  
  const [configs, setConfigs] = useState<ReportConfig[]>([])
  const [selectedConfig, setSelectedConfig] = useState<ReportConfig | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [reportData, setReportData] = useState<ReportData | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [showConfigDialog, setShowConfigDialog] = useState(false)

  // Form state
  const [formData, setFormData] = useState<Partial<ReportConfig>>({
    name: '',
    description: '',
    type: 'campaign',
    metrics: [],
    dimensions: [],
    filters: [],
    dateRange: {
      start: subDays(new Date(), 30),
      end: new Date(),
      label: 'Últimos 30 dias'
    },
    chartType: 'bar'
  })

  useEffect(() => {
    // Carregar configurações salvas
    loadSavedConfigs()
  }, [])

  useEffect(() => {
    if (selectedConfig) {
      generateReport(selectedConfig)
    }
  }, [selectedConfig])

  const loadSavedConfigs = async () => {
    try {
      // Mock: carregar configurações salvas
      const mockConfigs: ReportConfig[] = [
        {
          id: '1',
          name: 'Desempenho de Campanhas',
          description: 'Análise geral do desempenho das campanhas',
          type: 'campaign',
          metrics: ['total_sent', 'delivered', 'opened', 'clicked', 'conversion_rate'],
          dimensions: ['date', 'campaign', 'channel'],
          filters: [],
          dateRange: DATE_RANGES[1],
          chartType: 'bar'
        },
        {
          id: '2',
          name: 'Análise de Engajamento',
          description: 'Métricas de engajamento por canal',
          type: 'engagement',
          metrics: ['open_rate', 'click_rate', 'reply_rate', 'engagement_score'],
          dimensions: ['date', 'channel', 'segment'],
          filters: [],
          dateRange: DATE_RANGES[1],
          chartType: 'line'
        },
        {
          id: '3',
          name: 'Relatório de Conversão',
          description: 'Análise de conversões e ROI',
          type: 'conversion',
          metrics: ['conversions', 'conversion_value', 'cost_per_conversion', 'roi'],
          dimensions: ['date', 'campaign', 'segment'],
          filters: [],
          dateRange: DATE_RANGES[2],
          chartType: 'bar'
        }
      ]
      setConfigs(mockConfigs)
    } catch (error) {
      toast.error('Erro ao carregar configurações')
    }
  }

  const generateReport = async (config: ReportConfig) => {
    setIsLoading(true)
    try {
      // Mock: gerar dados do relatório
      const mockData: ReportData = {
        data: generateMockData(config),
        summary: generateMockSummary(config),
        total: Math.floor(Math.random() * 10000) + 1000
      }
      
      setReportData(mockData)
      toast.success('Relatório gerado com sucesso')
    } catch (error) {
      toast.error('Erro ao gerar relatório')
      console.error('Erro ao gerar relatório:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const generateMockData = (config: ReportConfig) => {
    const data = []
    const days = Math.ceil((config.dateRange.end.getTime() - config.dateRange.start.getTime()) / (1000 * 60 * 60 * 24))
    
    for (let i = 0; i < Math.min(days, 30); i++) {
      const date = new Date(config.dateRange.start)
      date.setDate(date.getDate() + i)
      
      const item: any = {
        date: format(date, 'yyyy-MM-dd'),
        label: format(date, 'dd/MM')
      }
      
      // Adicionar métricas
      config.metrics.forEach(metric => {
        if (metric.includes('rate') || metric.includes('roi')) {
          item[metric] = Math.random() * 50 + 10 // Percentagens
        } else if (metric.includes('value') || metric.includes('revenue')) {
          item[metric] = Math.random() * 1000 + 100 // Valores monetários
        } else {
          item[metric] = Math.floor(Math.random() * 1000) + 100 // Números
        }
      })
      
      // Adicionar dimensões
      config.dimensions.forEach(dimension => {
        if (dimension === 'channel') {
          item[dimension] = ['WhatsApp', 'Email', 'SMS'][Math.floor(Math.random() * 3)]
        } else if (dimension === 'campaign') {
          item[dimension] = `Campanha ${Math.floor(Math.random() * 10) + 1}`
        } else if (dimension === 'segment') {
          item[dimension] = ['Novo', 'Ativo', 'Inativo'][Math.floor(Math.random() * 3)]
        }
      })
      
      data.push(item)
    }
    
    return data
  }

  const generateMockSummary = (config: ReportConfig) => {
    const summary: Record<string, number> = {}
    
    config.metrics.forEach(metric => {
      if (metric.includes('rate') || metric.includes('roi')) {
        summary[metric] = Math.random() * 30 + 10
      } else if (metric.includes('value') || metric.includes('revenue')) {
        summary[metric] = Math.random() * 5000 + 1000
      } else {
        summary[metric] = Math.floor(Math.random() * 10000) + 1000
      }
    })
    
    return summary
  }

  const handleSaveConfig = async () => {
    if (!formData.name || !formData.metrics?.length) {
      toast.error('Nome e métricas são obrigatórios')
      return
    }
    
    try {
      const newConfig: ReportConfig = {
        id: isEditing && selectedConfig ? selectedConfig.id : Date.now().toString(),
        name: formData.name!,
        description: formData.description || '',
        type: formData.type || 'campaign',
        metrics: formData.metrics || [],
        dimensions: formData.dimensions || [],
        filters: formData.filters || [],
        dateRange: formData.dateRange || DATE_RANGES[1],
        chartType: formData.chartType || 'bar'
      }
      
      if (isEditing && selectedConfig) {
        setConfigs(configs.map(c => c.id === selectedConfig.id ? newConfig : c))
      } else {
        setConfigs([...configs, newConfig])
      }
      
      setShowConfigDialog(false)
      setIsEditing(false)
      toast.success('Configuração salva com sucesso')
    } catch (error) {
      toast.error('Erro ao salvar configuração')
    }
  }

  const handleDeleteConfig = async (configId: string) => {
    if (confirm('Tem certeza que deseja excluir esta configuração?')) {
      setConfigs(configs.filter(c => c.id !== configId))
      if (selectedConfig?.id === configId) {
        setSelectedConfig(null)
        setReportData(null)
      }
      toast.success('Configuração excluída com sucesso')
    }
  }

  const handleExport = (format: 'pdf' | 'excel' | 'csv') => {
    if (!reportData) {
      toast.error('Nenhum relatório para exportar')
      return
    }
    
    toast.success(`Exportando relatório em ${format.toUpperCase()}...`)
    // Implementar exportação real
  }

  const openConfigDialog = (config?: ReportConfig) => {
    if (config) {
      setFormData(config)
      setIsEditing(true)
    } else {
      setFormData({
        name: '',
        description: '',
        type: 'campaign',
        metrics: [],
        dimensions: [],
        filters: [],
        dateRange: DATE_RANGES[1],
        chartType: 'bar'
      })
      setIsEditing(false)
    }
    setShowConfigDialog(true)
  }

  const renderChart = () => {
    if (!reportData || !reportData.data.length) return null
    
    const { chartType, metrics, dimensions } = selectedConfig!
    const data = reportData.data
    
    switch (chartType) {
      case 'bar':
        return (
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey={dimensions[0] || 'date'} />
              <YAxis />
              <Tooltip />
              <Legend />
              {metrics.map((metric, index) => (
                <Bar key={metric} dataKey={metric} fill={COLORS[index % COLORS.length]} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        )
        
      case 'line':
        return (
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey={dimensions[0] || 'date'} />
              <YAxis />
              <Tooltip />
              <Legend />
              {metrics.map((metric, index) => (
                <Line key={metric} type="monotone" dataKey={metric} stroke={COLORS[index % COLORS.length]} strokeWidth={2} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )
        
      case 'pie':
        const pieData = data.slice(0, 5).map((item, index) => ({
          name: item[dimensions[0] || 'date'],
          value: item[metrics[0]]
        }))
        return (
          <ResponsiveContainer width="100%" height={400}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                outerRadius={120}
                fill="#8884d8"
                dataKey="value"
              >
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        )
        
      default:
        return (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {dimensions.map(dim => (
                    <th key={dim} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {dim}
                    </th>
                  ))}
                  {metrics.map(metric => (
                    <th key={metric} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {metric}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {data.slice(0, 10).map((row, index) => (
                  <tr key={index}>
                    {dimensions.map(dim => (
                      <td key={dim} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {row[dim]}
                      </td>
                    ))}
                    {metrics.map(metric => (
                      <td key={metric} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {typeof row[metric] === 'number' ? row[metric].toFixed(2) : row[metric]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
    }
  }

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8']

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Construtor de Relatórios</h1>
          <p className="text-gray-600 mt-1">
            Crie relatórios personalizados com métricas e dimensões específicas
          </p>
        </div>
        
        <Button onClick={() => openConfigDialog()}>
          <Plus className="w-4 h-4 mr-2" />
          Novo Relatório
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Lista de Configurações */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle>Relatórios Salvos</CardTitle>
              <CardDescription>Clique para visualizar</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {configs.map(config => (
                  <div
                    key={config.id}
                    className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                      selectedConfig?.id === config.id ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
                    }`}
                    onClick={() => setSelectedConfig(config)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="font-medium text-sm">{config.name}</div>
                        <div className="text-xs text-gray-600 mt-1">{config.description}</div>
                        <Badge variant="outline" className="mt-1 text-xs">
                          {config.type}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-1 ml-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            openConfigDialog(config)
                          }}
                        >
                          <Edit className="w-3 h-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDeleteConfig(config.id)
                          }}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
                
                {configs.length === 0 && (
                  <div className="text-center text-gray-500 py-8">
                    <BarChart3 className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Nenhum relatório salvo</p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-2"
                      onClick={() => openConfigDialog()}
                    >
                      Criar Primeiro
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Área de Visualização */}
        <div className="lg:col-span-3">
          {selectedConfig ? (
            <div className="space-y-4">
              {/* Cabeçalho do Relatório */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>{selectedConfig.name}</CardTitle>
                      <CardDescription>{selectedConfig.description}</CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">
                        {selectedConfig.dateRange.label}
                      </Badge>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => generateReport(selectedConfig)}
                        disabled={isLoading}
                      >
                        <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                        Atualizar
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleExport('pdf')}
                      >
                        <Download className="w-4 h-4 mr-2" />
                        Exportar
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {Object.entries(reportData?.summary || {}).map(([key, value]) => (
                      <div key={key} className="text-center">
                        <div className="text-2xl font-bold text-gray-900">
                          {typeof value === 'number' ? value.toFixed(1) : value}
                        </div>
                        <div className="text-sm text-gray-600 capitalize">
                          {key.replace(/_/g, ' ')}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Gráfico */}
              <Card>
                <CardHeader>
                  <CardTitle>Visualização</CardTitle>
                  <CardDescription>Dados do relatório</CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <div className="flex items-center justify-center h-64">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
                    </div>
                  ) : (
                    renderChart()
                  )}
                </CardContent>
              </Card>

              {/* Tabela de Dados */}
              <Card>
                <CardHeader>
                  <CardTitle>Dados Detalhados</CardTitle>
                  <CardDescription>Primeiros 10 registros</CardDescription>
                </CardHeader>
                <CardContent>
                  {reportData && renderChart()}
                </CardContent>
              </Card>
            </div>
          ) : (
            <Card>
              <CardContent className="flex items-center justify-center h-64">
                <div className="text-center text-gray-500">
                  <BarChart3 className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <h3 className="text-lg font-medium mb-2">Selecione um relatório</h3>
                  <p className="text-sm">Escolha um relatório salvo ou crie um novo</p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Diálogo de Configuração */}
      {showConfigDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">
                {isEditing ? 'Editar Relatório' : 'Novo Relatório'}
              </h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowConfigDialog(false)}
              >
                ×
              </Button>
            </div>

            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Nome do Relatório</Label>
                <Input
                  id="name"
                  value={formData.name || ''}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ex: Desempenho de Campanhas"
                />
              </div>

              <div>
                <Label htmlFor="description">Descrição</Label>
                <Input
                  id="description"
                  value={formData.description || ''}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Descrição do relatório"
                />
              </div>

              <div>
                <Label htmlFor="type">Tipo de Relatório</Label>
                <Select
                  value={formData.type}
                  onValueChange={(value) => setFormData({ ...formData, type: value as any })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="campaign">Campanhas</SelectItem>
                    <SelectItem value="engagement">Engajamento</SelectItem>
                    <SelectItem value="conversion">Conversão</SelectItem>
                    <SelectItem value="revenue">Receita</SelectItem>
                    <SelectItem value="custom">Personalizado</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Métricas</Label>
                <div className="space-y-2 max-h-32 overflow-y-auto border rounded-md p-2">
                  {AVAILABLE_METRICS[formData.type as keyof typeof AVAILABLE_METRICS]?.map(metric => (
                    <div key={metric.id} className="flex items-center">
                      <Checkbox
                        id={metric.id}
                        checked={formData.metrics?.includes(metric.id) || false}
                        onCheckedChange={(checked) => {
                          const metrics = formData.metrics || []
                          if (checked) {
                            setFormData({ ...formData, metrics: [...metrics, metric.id] })
                          } else {
                            setFormData({ ...formData, metrics: metrics.filter(m => m !== metric.id) })
                          }
                        }}
                      />
                      <Label htmlFor={metric.id} className="ml-2 text-sm">
                        {metric.name}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <Label>Dimensões</Label>
                <div className="space-y-2 max-h-32 overflow-y-auto border rounded-md p-2">
                  {AVAILABLE_DIMENSIONS.map(dimension => (
                    <div key={dimension.id} className="flex items-center">
                      <Checkbox
                        id={dimension.id}
                        checked={formData.dimensions?.includes(dimension.id) || false}
                        onCheckedChange={(checked) => {
                          const dimensions = formData.dimensions || []
                          if (checked) {
                            setFormData({ ...formData, dimensions: [...dimensions, dimension.id] })
                          } else {
                            setFormData({ ...formData, dimensions: dimensions.filter(d => d !== dimension.id) })
                          }
                        }}
                      />
                      <Label htmlFor={dimension.id} className="ml-2 text-sm">
                        {dimension.name}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <Label>Período</Label>
                <Select
                  value={DATE_RANGES.findIndex(range => range.label === formData.dateRange?.label)?.toString() || '1'}
                  onValueChange={(value) => {
                    const range = DATE_RANGES[parseInt(value)]
                    setFormData({
                      ...formData,
                      dateRange: {
                        start: subDays(new Date(), range.days),
                        end: new Date(),
                        label: range.label
                      }
                    })
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DATE_RANGES.map((range, index) => (
                      <SelectItem key={index} value={index.toString()}>
                        {range.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Tipo de Gráfico</Label>
                <Select
                  value={formData.chartType}
                  onValueChange={(value) => setFormData({ ...formData, chartType: value as any })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bar">Gráfico de Barras</SelectItem>
                    <SelectItem value="line">Gráfico de Linhas</SelectItem>
                    <SelectItem value="pie">Gráfico de Pizza</SelectItem>
                    <SelectItem value="table">Tabela</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <Button
                variant="outline"
                onClick={() => setShowConfigDialog(false)}
              >
                Cancelar
              </Button>
              <Button onClick={handleSaveConfig}>
                <Save className="w-4 h-4 mr-2" />
                Salvar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}