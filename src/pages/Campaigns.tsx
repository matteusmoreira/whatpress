import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Progress } from '@/components/ui/progress'
import { 
  Send, 
  Plus, 
  Search, 
  Filter,
  Play,
  Pause,
  Square,
  MoreHorizontal,
  Calendar,
  Users,
  MessageSquare,
  TrendingUp,
  Clock,
  CheckCircle,
  AlertCircle,
  Eye,
  Edit,
  Copy,
  Trash2,
  BarChart3,
  Zap,
  Loader2,
  Settings,
  Activity,
  Gauge,
  Shuffle,
  Network
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useCampaigns } from '@/hooks/useCampaigns'
import { useCampaignEngine } from '@/hooks/useCampaignEngine'
import { CampaignEngine } from '@/components/CampaignEngine'
import { MultiSessionManager } from '@/components/MultiSessionManager'
import { RandomizationSettings } from '@/components/RandomizationSettings'
import { RateLimitConfigComponent } from '@/components/RateLimitConfig'

export default function Campaigns() {
  const navigate = useNavigate()
  const { 
    campaigns, 
    stats, 
    loading, 
    deleteCampaign,
    duplicateCampaign 
  } = useCampaigns()
  
  const { metrics, startCampaign, pauseCampaign, resumeCampaign, stopCampaign } = useCampaignEngine()
  
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterType, setFilterType] = useState('all')
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [campaignToDelete, setCampaignToDelete] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const filteredCampaigns = campaigns.filter(campaign => {
    const matchesSearch = campaign.name.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = filterStatus === 'all' || campaign.status === filterStatus
    // Note: Removemos o filtro por tipo já que não temos esse campo no schema atual
    
    return matchesSearch && matchesStatus
  })

  const getStatusBadge = (status: string) => {
    const variants = {
      running: 'bg-green-100 text-green-800 border-green-200',
      scheduled: 'bg-blue-100 text-blue-800 border-blue-200',
      paused: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      completed: 'bg-gray-100 text-gray-800 border-gray-200',
      draft: 'bg-purple-100 text-purple-800 border-purple-200',
      cancelled: 'bg-red-100 text-red-800 border-red-200'
    }
    return variants[status as keyof typeof variants] || variants.draft
  }

  const getStatusText = (status: string) => {
    const texts = {
      running: 'Ativa',
      scheduled: 'Agendada',
      paused: 'Pausada',
      completed: 'Concluída',
      draft: 'Rascunho',
      cancelled: 'Cancelada'
    }
    return texts[status as keyof typeof texts] || 'Desconhecido'
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running':
        return <Play className="h-4 w-4 text-green-600" />
      case 'paused':
        return <Pause className="h-4 w-4 text-yellow-600" />
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-gray-600" />
      case 'scheduled':
        return <Clock className="h-4 w-4 text-blue-600" />
      case 'cancelled':
        return <Square className="h-4 w-4 text-red-600" />
      default:
        return <AlertCircle className="h-4 w-4 text-purple-600" />
    }
  }

  const handleAction = async (action: () => Promise<any>, campaignId: string) => {
    try {
      setActionLoading(campaignId)
      await action()
    } catch (error) {
      console.error('Erro na ação:', error)
    } finally {
      setActionLoading(null)
    }
  }

  const handleDelete = async () => {
    if (!campaignToDelete) return
    
    try {
      setActionLoading(campaignToDelete)
      await deleteCampaign(campaignToDelete)
      setDeleteDialogOpen(false)
      setCampaignToDelete(null)
    } catch (error) {
      console.error('Erro ao excluir campanha:', error)
    } finally {
      setActionLoading(null)
    }
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Não agendada'
    return new Date(dateString).toLocaleString('pt-BR')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Campanhas Inteligentes</h1>
          <p className="text-muted-foreground">Sistema avançado de campanhas com multi-sessão e randomização</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" className="gap-2" onClick={() => navigate('/dashboard/analytics')}>
            <BarChart3 className="h-4 w-4" />
            Relatórios
          </Button>
          <Button className="gap-2" onClick={() => navigate('/dashboard/campaigns/create')}>
            <Plus className="h-4 w-4" />
            Nova Campanha
          </Button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Campanhas Ativas</p>
                <p className="text-2xl font-bold text-foreground">{stats?.active_campaigns || 0}</p>
                <p className="text-sm text-green-600">+{stats?.total_campaigns || 0} total</p>
              </div>
              <div className="p-3 rounded-lg bg-primary/10">
                <Send className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Mensagens Enviadas</p>
                <p className="text-2xl font-bold text-foreground">
                  {stats?.total_messages_sent ? 
                    stats.total_messages_sent > 1000 ? 
                      `${(stats.total_messages_sent / 1000).toFixed(1)}K` : 
                      stats.total_messages_sent 
                    : '0'}
                </p>
                <p className="text-sm text-green-600">Este mês</p>
              </div>
              <div className="p-3 rounded-lg bg-primary/10">
                <MessageSquare className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Taxa de Entrega</p>
                <p className="text-2xl font-bold text-foreground">{stats?.delivery_rate || 0}%</p>
                <p className="text-sm text-green-600">Últimos 30 dias</p>
              </div>
              <div className="p-3 rounded-lg bg-primary/10">
                <CheckCircle className="h-6 w-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Taxa de Resposta</p>
                <p className="text-2xl font-bold text-foreground">{stats?.response_rate || 0}%</p>
                <p className="text-sm text-green-600">Últimos 30 dias</p>
              </div>
              <div className="p-3 rounded-lg bg-primary/10">
                <TrendingUp className="h-6 w-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="campaigns" className="space-y-6">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="campaigns" className="flex items-center gap-2">
            <Send className="h-4 w-4" />
            Campanhas
          </TabsTrigger>
          <TabsTrigger value="engine" className="flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Motor
          </TabsTrigger>
          <TabsTrigger value="sessions" className="flex items-center gap-2">
            <Network className="h-4 w-4" />
            Multi-Sessão
          </TabsTrigger>
          <TabsTrigger value="randomization" className="flex items-center gap-2">
            <Shuffle className="h-4 w-4" />
            Randomização
          </TabsTrigger>
          <TabsTrigger value="ratelimit" className="flex items-center gap-2">
            <Gauge className="h-4 w-4" />
            Rate Limit
          </TabsTrigger>
          <TabsTrigger value="automation" className="flex items-center gap-2">
            <Zap className="h-4 w-4" />
            Automação
          </TabsTrigger>
        </TabsList>

        <TabsContent value="campaigns" className="space-y-6">
          {/* Filters and Search */}
          <Card>
            <CardContent className="p-6">
              <div className="flex flex-col lg:flex-row gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar campanhas..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="w-full lg:w-48">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os Status</SelectItem>
                    <SelectItem value="running">Ativa</SelectItem>
                    <SelectItem value="scheduled">Agendada</SelectItem>
                    <SelectItem value="paused">Pausada</SelectItem>
                    <SelectItem value="completed">Concluída</SelectItem>
                    <SelectItem value="draft">Rascunho</SelectItem>
                    <SelectItem value="cancelled">Cancelada</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="outline" className="gap-2">
                  <Filter className="h-4 w-4" />
                  Filtros
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Campaigns List */}
          <div className="space-y-4">
            {filteredCampaigns.length === 0 ? (
              <Card>
                <CardContent className="p-12 text-center">
                  <Send className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Nenhuma campanha encontrada</h3>
                  <p className="text-muted-foreground mb-4">
                    {searchTerm || filterStatus !== 'all' 
                      ? 'Tente ajustar os filtros de busca' 
                      : 'Crie sua primeira campanha para começar'}
                  </p>
                  {!searchTerm && filterStatus === 'all' && (
                    <Button onClick={() => navigate('/dashboard/campaigns/create')}>
                      <Plus className="h-4 w-4 mr-2" />
                      Criar Primeira Campanha
                    </Button>
                  )}
                </CardContent>
              </Card>
            ) : (
              filteredCampaigns.map((campaign) => (
                <Card key={campaign.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          {getStatusIcon(campaign.status)}
                          <h3 className="text-lg font-semibold text-foreground">{campaign.name}</h3>
                          <Badge className={getStatusBadge(campaign.status)}>
                            {getStatusText(campaign.status)}
                          </Badge>
                        </div>
                        {campaign.description && (
                          <p className="text-sm text-muted-foreground mb-3">
                            {campaign.description}
                          </p>
                        )}
                        <div className="flex items-center gap-6 text-sm text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Calendar className="h-4 w-4" />
                            Agendada: {formatDate(campaign.scheduled_at)}
                          </div>
                          <div className="flex items-center gap-1">
                            <Users className="h-4 w-4" />
                            {campaign.total_contacts || 0} contatos
                          </div>
                        </div>
                      </div>
                      
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" disabled={actionLoading === campaign.id}>
                            {actionLoading === campaign.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <MoreHorizontal className="h-4 w-4" />
                            )}
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem className="gap-2">
                            <Eye className="h-4 w-4" />
                            Ver Detalhes
                          </DropdownMenuItem>
                          <DropdownMenuItem className="gap-2">
                            <Edit className="h-4 w-4" />
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            className="gap-2"
                            onClick={() => handleAction(() => duplicateCampaign(campaign), campaign.id)}
                          >
                            <Copy className="h-4 w-4" />
                            Duplicar
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {campaign.status === 'running' && (
                            <DropdownMenuItem 
                              className="gap-2"
                              onClick={() => handleAction(() => pauseCampaign(campaign.id), campaign.id)}
                            >
                              <Pause className="h-4 w-4" />
                              Pausar
                            </DropdownMenuItem>
                          )}
                          {campaign.status === 'paused' && (
                            <DropdownMenuItem 
                              className="gap-2"
                              onClick={() => handleAction(() => resumeCampaign(campaign.id), campaign.id)}
                            >
                              <Play className="h-4 w-4" />
                              Retomar
                            </DropdownMenuItem>
                          )}
                          {(campaign.status === 'scheduled' || campaign.status === 'draft') && (
                            <DropdownMenuItem 
                              className="gap-2"
                              onClick={() => handleAction(() => startCampaign(campaign.id), campaign.id)}
                            >
                              <Play className="h-4 w-4" />
                              Iniciar
                            </DropdownMenuItem>
                          )}
                          {campaign.status === 'running' && (
                            <DropdownMenuItem 
                              className="gap-2 text-red-600"
                              onClick={() => handleAction(() => stopCampaign(campaign.id), campaign.id)}
                            >
                              <Square className="h-4 w-4" />
                              Parar
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem 
                            className="gap-2 text-red-600"
                            onClick={() => {
                              setCampaignToDelete(campaign.id)
                              setDeleteDialogOpen(true)
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                            Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    {/* Progress Bar for Running Campaigns */}
                    {campaign.status === 'running' && (
                      <div className="mt-4">
                        <div className="flex justify-between text-sm text-muted-foreground mb-2">
                          <span>Progresso</span>
                          <span>{metrics[campaign.id]?.messages_sent || 0} / {metrics[campaign.id]?.total_messages || 0}</span>
                        </div>
                        <Progress 
                          value={campaign.total_contacts ? 
                            ((metrics[campaign.id]?.messages_sent || 0) / (metrics[campaign.id]?.total_messages || 1)) * 100 : 0
                          } 
                          className="h-2" 
                        />
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="engine" className="space-y-6">
          <CampaignEngine />
        </TabsContent>

        <TabsContent value="sessions" className="space-y-6">
          <MultiSessionManager />
        </TabsContent>

        <TabsContent value="randomization" className="space-y-6">
          <RandomizationSettings />
        </TabsContent>

        <TabsContent value="ratelimit" className="space-y-6">
          <RateLimitConfigComponent />
        </TabsContent>

        <TabsContent value="automation" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5" />
                Automação Avançada
              </CardTitle>
              <CardDescription>
                Configure regras de automação inteligente para suas campanhas
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12">
                <Settings className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">Funcionalidade em Desenvolvimento</h3>
                <p className="text-muted-foreground">
                  Sistema de automação avançada será implementado em breve
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta campanha? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700"
              disabled={!!actionLoading}
            >
              {actionLoading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}