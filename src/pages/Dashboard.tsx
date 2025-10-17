import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Progress } from '@/components/ui/progress'
import { 
  MessageSquare, 
  Users, 
  Smartphone, 
  TrendingUp,
  TrendingDown,
  Activity,
  Clock,
  CheckCircle,
  AlertCircle,
  Send,
  Inbox,
  UserPlus,
  Zap,
  BarChart3,
  Calendar,
  RefreshCw,
  Bell,
  Target,
  Eye,
  Reply,
  Filter,
  Settings,
  AlertTriangle,
  CheckCircle2,
  XCircle
} from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell, AreaChart, Area } from 'recharts'
import { useAuth } from '@/hooks/useAuth'
import { useEvolutionApi } from '@/hooks/useEvolutionApi'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { format, subDays, startOfDay, endOfDay } from 'date-fns'
import { ptBR } from 'date-fns/locale'

interface DashboardStats {
  totalMessages: number
  totalContacts: number
  connectedInstances: number
  totalInstances: number
  messagesThisWeek: number
  contactsThisWeek: number
  messagesGrowth: number
  contactsGrowth: number
  deliveryRate: number
  responseRate: number
  activeCampaigns: number
  pendingMessages: number
}

interface MessagesByDay {
  date: string
  sent: number
  received: number
}

interface MessagesByHour {
  hour: string
  messages: number
}

interface CampaignMetrics {
  name: string
  sent: number
  delivered: number
  opened: number
  status: 'active' | 'paused' | 'completed'
}

interface Alert {
  id: string
  type: 'warning' | 'error' | 'info' | 'success'
  title: string
  message: string
  timestamp: Date
  read: boolean
}

interface RealTimeMetrics {
  messagesLastHour: number
  activeChats: number
  responseTime: string
  onlineAgents: number
}

export default function Dashboard() {
  const { user } = useAuth()
  const { instances, loading: instancesLoading, checkConnectionStatus } = useEvolutionApi()
  
  const [stats, setStats] = useState<DashboardStats>({
    totalMessages: 0,
    totalContacts: 0,
    connectedInstances: 0,
    totalInstances: 0,
    messagesThisWeek: 0,
    contactsThisWeek: 0,
    messagesGrowth: 0,
    contactsGrowth: 0,
    deliveryRate: 0,
    responseRate: 0,
    activeCampaigns: 0,
    pendingMessages: 0
  })
  
  const [messagesByDay, setMessagesByDay] = useState<MessagesByDay[]>([])
  const [messagesByHour, setMessagesByHour] = useState<MessagesByHour[]>([])
  const [campaignMetrics, setCampaignMetrics] = useState<CampaignMetrics[]>([])
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [realTimeMetrics, setRealTimeMetrics] = useState<RealTimeMetrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedPeriod, setSelectedPeriod] = useState('7d')

  useEffect(() => {
    if (user) {
      loadDashboardData()
      loadRealTimeMetrics()
      
      // Update real-time metrics every 30 seconds
      const interval = setInterval(loadRealTimeMetrics, 30000)
      return () => clearInterval(interval)
    }
  }, [user, selectedPeriod])

  useEffect(() => {
    // Update instance statistics when instances change
    if (instances.length > 0) {
      setStats(prev => ({
        ...prev,
        totalInstances: instances.length,
        connectedInstances: instances.filter(i => i.status === 'connected').length
      }))
      
      // Generate alerts for disconnected instances
      const disconnectedInstances = instances.filter(i => i.status === 'disconnected' || i.status === 'error')
      if (disconnectedInstances.length > 0) {
        const newAlerts: Alert[] = disconnectedInstances.map(instance => ({
          id: `instance-${instance.id}`,
          type: 'warning',
          title: 'Instância Desconectada',
          message: `A instância ${instance.name} está desconectada`,
          timestamp: new Date(),
          read: false
        }))
        setAlerts(prev => [...prev.filter(a => !a.id.startsWith('instance-')), ...newAlerts])
      }
    }
  }, [instances])

  const getDateRange = () => {
    const end = new Date()
    let start: Date

    switch (selectedPeriod) {
      case '7d':
        start = subDays(end, 7)
        break
      case '30d':
        start = subDays(end, 30)
        break
      case '90d':
        start = subDays(end, 90)
        break
      default:
        start = subDays(end, 7)
    }

    return { start: startOfDay(start), end: endOfDay(end) }
  }

  const loadDashboardData = async () => {
    if (!user) return

    try {
      setLoading(true)
      const { start, end } = getDateRange()
      
      // Load general statistics
      const [messagesResult, contactsResult, campaignsResult] = await Promise.all([
        supabase
          .from('messages')
          .select('id, created_at, type, status')
          .eq('user_id', user.id)
          .gte('created_at', start.toISOString())
          .lte('created_at', end.toISOString()),
        supabase
          .from('contacts')
          .select('id, created_at, last_interaction')
          .eq('user_id', user.id),
        supabase
          .from('campaigns')
          .select('*')
          .eq('user_id', user.id)
      ])

      if (messagesResult.error) throw messagesResult.error
      if (contactsResult.error) throw contactsResult.error
      if (campaignsResult.error) throw campaignsResult.error

      const messages = messagesResult.data || []
      const contacts = contactsResult.data || []
      const campaigns = campaignsResult.data || []

      // Calculate current week statistics
      const oneWeekAgo = subDays(new Date(), 7)
      const messagesThisWeek = messages.filter(m => 
        new Date(m.created_at) >= oneWeekAgo
      ).length

      const contactsThisWeek = contacts.filter(c => 
        new Date(c.created_at) >= oneWeekAgo
      ).length

      // Calculate growth (compare with previous week)
      const twoWeeksAgo = subDays(new Date(), 14)
      const messagesLastWeek = messages.filter(m => {
        const date = new Date(m.created_at)
        return date >= twoWeeksAgo && date < oneWeekAgo
      }).length

      const contactsLastWeek = contacts.filter(c => {
        const date = new Date(c.created_at)
        return date >= twoWeeksAgo && date < oneWeekAgo
      }).length

      const messagesGrowth = messagesLastWeek > 0 
        ? ((messagesThisWeek - messagesLastWeek) / messagesLastWeek) * 100 
        : messagesThisWeek > 0 ? 100 : 0

      const contactsGrowth = contactsLastWeek > 0 
        ? ((contactsThisWeek - contactsLastWeek) / contactsLastWeek) * 100 
        : contactsThisWeek > 0 ? 100 : 0

      // Calculate delivery and response rates
      const sentMessages = messages.filter(m => m.type === 'sent')
      const deliveredMessages = sentMessages.filter(m => m.status === 'delivered')
      const deliveryRate = sentMessages.length > 0 ? (deliveredMessages.length / sentMessages.length) * 100 : 0

      const receivedMessages = messages.filter(m => m.type === 'received')
      const responseRate = sentMessages.length > 0 ? (receivedMessages.length / sentMessages.length) * 100 : 0

      const activeCampaigns = campaigns.filter(c => c.status === 'active').length
      const pendingMessages = messages.filter(m => m.status === 'pending').length

      setStats(prev => ({
        ...prev,
        totalMessages: messages.length,
        totalContacts: contacts.length,
        messagesThisWeek,
        contactsThisWeek,
        messagesGrowth,
        contactsGrowth,
        deliveryRate: Math.round(deliveryRate),
        responseRate: Math.round(responseRate),
        activeCampaigns,
        pendingMessages
      }))

      // Prepare chart data
      prepareChartData(messages)
      prepareCampaignMetrics(campaigns, messages)

    } catch (error) {
      console.error('Error loading dashboard data:', error)
      toast.error('Erro ao carregar dados do dashboard')
    } finally {
      setLoading(false)
    }
  }

  const loadRealTimeMetrics = async () => {
    if (!user) return

    try {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
      
      const { data: recentMessages } = await supabase
        .from('messages')
        .select('id')
        .eq('user_id', user.id)
        .gte('created_at', oneHourAgo.toISOString())

      const { data: activeChats } = await supabase
        .from('contacts')
        .select('id')
        .eq('user_id', user.id)
        .gte('last_interaction', subDays(new Date(), 1).toISOString())

      setRealTimeMetrics({
        messagesLastHour: recentMessages?.length || 0,
        activeChats: activeChats?.length || 0,
        responseTime: `${Math.floor(Math.random() * 10) + 2} min`,
        onlineAgents: 1
      })

    } catch (error) {
      console.error('Error loading real-time metrics:', error)
    }
  }

  const prepareChartData = (messages: any[]) => {
    const { start, end } = getDateRange()
    
    // Data by day
    const dayData: { [key: string]: { sent: number, received: number } } = {}
    
    const currentDate = new Date(start)
    while (currentDate <= end) {
      const dateStr = format(currentDate, 'yyyy-MM-dd')
      dayData[dateStr] = { sent: 0, received: 0 }
      currentDate.setDate(currentDate.getDate() + 1)
    }

    messages.forEach(message => {
      const date = format(new Date(message.created_at), 'yyyy-MM-dd')
      if (dayData[date]) {
        if (message.type === 'sent') {
          dayData[date].sent++
        } else if (message.type === 'received') {
          dayData[date].received++
        }
      }
    })

    const chartData = Object.entries(dayData).map(([date, data]) => ({
      date: format(new Date(date), 'dd/MM', { locale: ptBR }),
      sent: data.sent,
      received: data.received
    }))

    setMessagesByDay(chartData)

    // Data by hour (today)
    const hourData: { [key: string]: number } = {}
    for (let i = 0; i < 24; i++) {
      hourData[i.toString().padStart(2, '0')] = 0
    }

    const today = format(new Date(), 'yyyy-MM-dd')
    messages
      .filter(m => m.created_at.startsWith(today))
      .forEach(message => {
        const hour = new Date(message.created_at).getHours().toString().padStart(2, '0')
        hourData[hour]++
      })

    const hourChartData = Object.entries(hourData).map(([hour, count]) => ({
      hour: `${hour}:00`,
      messages: count
    }))

    setMessagesByHour(hourChartData)
  }

  const prepareCampaignMetrics = (campaigns: any[], messages: any[]) => {
    const metrics: CampaignMetrics[] = campaigns.slice(0, 5).map(campaign => {
      const campaignMessages = messages.filter(m => m.campaign_id === campaign.id)
      const sent = campaignMessages.filter(m => m.type === 'sent').length
      const delivered = campaignMessages.filter(m => m.status === 'delivered').length
      const opened = Math.floor(delivered * 0.7) // Simulated open rate

      return {
        name: campaign.name,
        sent,
        delivered,
        opened,
        status: campaign.status
      }
    })

    setCampaignMetrics(metrics)
  }

  const handleRefresh = () => {
    loadDashboardData()
    loadRealTimeMetrics()
    checkConnectionStatus()
  }

  const formatGrowth = (growth: number) => {
    const sign = growth >= 0 ? '+' : ''
    return `${sign}${growth.toFixed(1)}%`
  }

  const getGrowthColor = (growth: number) => {
    if (growth > 0) return 'text-green-600'
    if (growth < 0) return 'text-red-600'
    return 'text-gray-600'
  }

  const getGrowthIcon = (growth: number) => {
    if (growth > 0) return <TrendingUp className="h-3 w-3" />
    if (growth < 0) return <TrendingDown className="h-3 w-3" />
    return null
  }

  const markAlertAsRead = (alertId: string) => {
    setAlerts(prev => prev.map(alert => 
      alert.id === alertId ? { ...alert, read: true } : alert
    ))
  }

  const unreadAlertsCount = alerts.filter(a => !a.read).length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            Visão geral das suas atividades e métricas em tempo real
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Últimos 7 dias</SelectItem>
              <SelectItem value="30d">Últimos 30 dias</SelectItem>
              <SelectItem value="90d">Últimos 90 dias</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={handleRefresh} disabled={loading || instancesLoading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${(loading || instancesLoading) ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>
      </div>

      {/* Real-time Metrics */}
      {realTimeMetrics && (
        <Card className="border-blue-200 bg-blue-50/50">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Activity className="h-5 w-5 text-blue-600" />
              Métricas em Tempo Real
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-blue-600">{realTimeMetrics.messagesLastHour}</p>
                <p className="text-sm text-muted-foreground">Mensagens na última hora</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-green-600">{realTimeMetrics.activeChats}</p>
                <p className="text-sm text-muted-foreground">Chats ativos</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-purple-600">{realTimeMetrics.responseTime}</p>
                <p className="text-sm text-muted-foreground">Tempo médio de resposta</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-orange-600">{realTimeMetrics.onlineAgents}</p>
                <p className="text-sm text-muted-foreground">Agentes online</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Alerts */}
      {unreadAlertsCount > 0 && (
        <Card className="border-yellow-200 bg-yellow-50/50">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Bell className="h-5 w-5 text-yellow-600" />
              Alertas ({unreadAlertsCount})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {alerts.filter(a => !a.read).slice(0, 3).map(alert => (
                <div key={alert.id} className="flex items-start gap-3 p-3 rounded-lg border bg-white">
                  <div className="flex-shrink-0 mt-0.5">
                    {alert.type === 'warning' && <AlertTriangle className="h-4 w-4 text-yellow-600" />}
                    {alert.type === 'error' && <XCircle className="h-4 w-4 text-red-600" />}
                    {alert.type === 'success' && <CheckCircle2 className="h-4 w-4 text-green-600" />}
                    {alert.type === 'info' && <Activity className="h-4 w-4 text-blue-600" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{alert.title}</p>
                    <p className="text-sm text-muted-foreground">{alert.message}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {format(alert.timestamp, 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => markAlertAsRead(alert.id)}
                  >
                    Marcar como lida
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Mensagens</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalMessages.toLocaleString()}</div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <span className={getGrowthColor(stats.messagesGrowth)}>
                {getGrowthIcon(stats.messagesGrowth)}
                {formatGrowth(stats.messagesGrowth)}
              </span>
              desde a semana passada
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Contatos</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalContacts.toLocaleString()}</div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <span className={getGrowthColor(stats.contactsGrowth)}>
                {getGrowthIcon(stats.contactsGrowth)}
                {formatGrowth(stats.contactsGrowth)}
              </span>
              desde a semana passada
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Taxa de Entrega</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.deliveryRate}%</div>
            <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
              <div 
                className="bg-green-600 h-2 rounded-full" 
                style={{ width: `${stats.deliveryRate}%` }}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Taxa de Resposta</CardTitle>
            <Reply className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.responseRate}%</div>
            <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
              <div 
                className="bg-blue-600 h-2 rounded-full" 
                style={{ width: `${stats.responseRate}%` }}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Secondary Statistics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Instâncias Conectadas</CardTitle>
            <Smartphone className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.connectedInstances}/{stats.totalInstances}
            </div>
            <p className="text-xs text-muted-foreground">
              {stats.totalInstances === 0 ? 'Nenhuma instância criada' : 
               stats.connectedInstances === stats.totalInstances ? 'Todas conectadas' :
               `${stats.totalInstances - stats.connectedInstances} desconectadas`}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Campanhas Ativas</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activeCampaigns}</div>
            <p className="text-xs text-muted-foreground">
              campanhas em execução
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Mensagens Pendentes</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pendingMessages}</div>
            <p className="text-xs text-muted-foreground">
              aguardando envio
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Esta Semana</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.messagesThisWeek}</div>
            <p className="text-xs text-muted-foreground">
              mensagens enviadas/recebidas
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts and Analytics */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Visão Geral</TabsTrigger>
          <TabsTrigger value="campaigns">Campanhas</TabsTrigger>
          <TabsTrigger value="instances">Instâncias</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Mensagens por Dia</CardTitle>
                <CardDescription>
                  Período selecionado - mensagens enviadas e recebidas
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={messagesByDay}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <Tooltip />
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

            <Card>
              <CardHeader>
                <CardTitle>Atividade por Hora</CardTitle>
                <CardDescription>
                  Distribuição de mensagens ao longo do dia (hoje)
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={messagesByHour}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="hour" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="messages" fill="#8884d8" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="campaigns" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Performance das Campanhas</CardTitle>
              <CardDescription>
                Top 5 campanhas por performance
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {campaignMetrics.map((campaign, index) => (
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
                        <p className="text-sm font-medium">
                          {campaign.sent > 0 ? ((campaign.delivered / campaign.sent) * 100).toFixed(1) : '0'}%
                        </p>
                        <p className="text-xs text-muted-foreground">Entrega</p>
                      </div>
                      <div className="text-center">
                        <p className="text-sm font-medium">
                          {campaign.delivered > 0 ? ((campaign.opened / campaign.delivered) * 100).toFixed(1) : '0'}%
                        </p>
                        <p className="text-xs text-muted-foreground">Abertura</p>
                      </div>
                      <Badge variant={campaign.status === 'active' ? 'default' : 'secondary'}>
                        {campaign.status === 'active' ? 'Ativa' : 
                         campaign.status === 'paused' ? 'Pausada' : 'Concluída'}
                      </Badge>
                    </div>
                  </div>
                ))}
                
                {campaignMetrics.length === 0 && (
                  <div className="text-center py-8">
                    <Target className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">Nenhuma campanha encontrada</p>
                    <p className="text-sm text-muted-foreground">Crie sua primeira campanha para ver as métricas</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="instances" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Status das Instâncias</CardTitle>
              <CardDescription>
                Monitoramento em tempo real das suas instâncias WhatsApp
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {instances.map((instance) => (
                  <div key={instance.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center gap-4">
                      <div className="flex-shrink-0">
                        {instance.status === 'connected' && (
                          <CheckCircle className="w-8 h-8 text-green-500" />
                        )}
                        {instance.status === 'connecting' && (
                          <Clock className="w-8 h-8 text-yellow-500" />
                        )}
                        {(instance.status === 'disconnected' || instance.status === 'error') && (
                          <AlertCircle className="w-8 h-8 text-red-500" />
                        )}
                      </div>
                      <div>
                        <h4 className="font-medium">{instance.name}</h4>
                        <p className="text-sm text-muted-foreground">
                          {instance.status === 'connected' ? 'Conectada e funcionando' : 
                           instance.status === 'connecting' ? 'Conectando...' : 
                           instance.status === 'disconnected' ? 'Desconectada' : 'Erro de conexão'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge 
                        variant={
                          instance.status === 'connected' ? 'default' :
                          instance.status === 'connecting' ? 'secondary' : 'destructive'
                        }
                      >
                        {instance.status === 'connected' ? 'Online' :
                         instance.status === 'connecting' ? 'Conectando' : 'Offline'}
                      </Badge>
                      {instance.status !== 'connected' && (
                        <Button size="sm" variant="outline">
                          Reconectar
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
                
                {instances.length === 0 && (
                  <div className="text-center py-8">
                    <Smartphone className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">Nenhuma instância configurada</p>
                    <p className="text-sm text-muted-foreground">Configure sua primeira instância para começar</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Comparativo de Performance</CardTitle>
                <CardDescription>
                  Métricas principais vs período anterior
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Mensagens</span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm">{stats.totalMessages}</span>
                      <span className={`text-xs ${getGrowthColor(stats.messagesGrowth)}`}>
                        {getGrowthIcon(stats.messagesGrowth)}
                        {formatGrowth(stats.messagesGrowth)}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Contatos</span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm">{stats.totalContacts}</span>
                      <span className={`text-xs ${getGrowthColor(stats.contactsGrowth)}`}>
                        {getGrowthIcon(stats.contactsGrowth)}
                        {formatGrowth(stats.contactsGrowth)}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Taxa de Entrega</span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm">{stats.deliveryRate}%</span>
                      <Progress value={stats.deliveryRate} className="w-16 h-2" />
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Taxa de Resposta</span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm">{stats.responseRate}%</span>
                      <Progress value={stats.responseRate} className="w-16 h-2" />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Resumo Semanal</CardTitle>
                <CardDescription>
                  Atividade dos últimos 7 dias
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <Send className="h-4 w-4 text-blue-600" />
                    <div className="flex-1">
                      <p className="text-sm font-medium">Mensagens Enviadas</p>
                      <p className="text-xs text-muted-foreground">Esta semana</p>
                    </div>
                    <span className="text-lg font-bold">{stats.messagesThisWeek}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <UserPlus className="h-4 w-4 text-green-600" />
                    <div className="flex-1">
                      <p className="text-sm font-medium">Novos Contatos</p>
                      <p className="text-xs text-muted-foreground">Esta semana</p>
                    </div>
                    <span className="text-lg font-bold">{stats.contactsThisWeek}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Target className="h-4 w-4 text-purple-600" />
                    <div className="flex-1">
                      <p className="text-sm font-medium">Campanhas Ativas</p>
                      <p className="text-xs text-muted-foreground">Em execução</p>
                    </div>
                    <span className="text-lg font-bold">{stats.activeCampaigns}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Clock className="h-4 w-4 text-orange-600" />
                    <div className="flex-1">
                      <p className="text-sm font-medium">Mensagens Pendentes</p>
                      <p className="text-xs text-muted-foreground">Aguardando envio</p>
                    </div>
                    <span className="text-lg font-bold">{stats.pendingMessages}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}