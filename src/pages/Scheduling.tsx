import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from '@/components/ui/dialog'
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
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
import {
  Calendar as CalendarIcon,
  Clock,
  Plus,
  Search,
  Filter,
  MoreVertical,
  Edit,
  Copy,
  Trash2,
  Eye,
  Play,
  Pause,
  RotateCcw,
  Users,
  MessageSquare,
  Target,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  XCircle,
  Timer,
  Repeat,
  Globe,
  Zap,
  Loader2
} from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { useScheduling, CreateScheduledCampaignData } from '@/hooks/useScheduling'
import { useToast } from '@/hooks/use-toast'

export default function Scheduling() {
  const navigate = useNavigate()
  const { toast } = useToast()
  const {
    campaigns,
    stats,
    loading,
    createScheduledCampaign,
    updateCampaignStatus,
    deleteCampaign,
    duplicateCampaign,
    getUpcomingExecutions
  } = useScheduling()

  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [selectedCampaign, setSelectedCampaign] = useState<any>(null)
  const [showDetailsDialog, setShowDetailsDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [campaignToDelete, setCampaignToDelete] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('Todos')
  const [selectedDate, setSelectedDate] = useState<Date>()
  const [upcomingExecutions, setUpcomingExecutions] = useState<any[]>([])
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  // Form state for creating campaign
  const [formData, setFormData] = useState<CreateScheduledCampaignData>({
    name: '',
    description: '',
    audience_segment: '',
    scheduled_date: new Date(),
    type: 'immediate',
    timezone: 'America/Sao_Paulo',
    priority: 'medium',
    message_content: ''
  })

  useEffect(() => {
    loadUpcomingExecutions()
  }, [campaigns])

  const loadUpcomingExecutions = async () => {
    try {
      const upcoming = await getUpcomingExecutions()
      setUpcomingExecutions(upcoming)
    } catch (error) {
      console.error('Erro ao carregar próximas execuções:', error)
    }
  }

  const statusOptions = ['Todos', 'scheduled', 'running', 'paused', 'completed', 'failed']

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'scheduled': return 'bg-blue-500'
      case 'running': return 'bg-green-500'
      case 'paused': return 'bg-yellow-500'
      case 'completed': return 'bg-gray-500'
      case 'failed': return 'bg-red-500'
      default: return 'bg-gray-500'
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'scheduled': return 'Agendado'
      case 'running': return 'Executando'
      case 'paused': return 'Pausado'
      case 'completed': return 'Concluído'
      case 'failed': return 'Falhou'
      default: return 'Desconhecido'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'scheduled': return <Clock className="h-4 w-4" />
      case 'running': return <Play className="h-4 w-4" />
      case 'paused': return <Pause className="h-4 w-4" />
      case 'completed': return <CheckCircle className="h-4 w-4" />
      case 'failed': return <XCircle className="h-4 w-4" />
      default: return <AlertCircle className="h-4 w-4" />
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-800'
      case 'medium': return 'bg-yellow-100 text-yellow-800'
      case 'low': return 'bg-green-100 text-green-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const filteredCampaigns = campaigns.filter(campaign => {
    const matchesSearch = campaign.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         campaign.description.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = statusFilter === 'Todos' || campaign.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const handleCreateCampaign = async () => {
    try {
      setActionLoading('create')
      await createScheduledCampaign(formData)
      setShowCreateDialog(false)
      setFormData({
        name: '',
        description: '',
        audience_segment: '',
        scheduled_date: new Date(),
        type: 'immediate',
        timezone: 'America/Sao_Paulo',
        priority: 'medium',
        message_content: ''
      })
      toast({
        title: "Campanha criada",
        description: "A campanha foi agendada com sucesso.",
      })
    } catch (error) {
      toast({
        title: "Erro",
        description: "Erro ao criar campanha. Tente novamente.",
        variant: "destructive",
      })
    } finally {
      setActionLoading(null)
    }
  }

  const handleStatusChange = async (campaignId: string, newStatus: any) => {
    try {
      setActionLoading(campaignId)
      await updateCampaignStatus(campaignId, newStatus)
      toast({
        title: "Status atualizado",
        description: "O status da campanha foi alterado com sucesso.",
      })
    } catch (error) {
      toast({
        title: "Erro",
        description: "Erro ao atualizar status. Tente novamente.",
        variant: "destructive",
      })
    } finally {
      setActionLoading(null)
    }
  }

  const handleDeleteCampaign = async () => {
    if (!campaignToDelete) return

    try {
      setActionLoading('delete')
      await deleteCampaign(campaignToDelete)
      setShowDeleteDialog(false)
      setCampaignToDelete(null)
      toast({
        title: "Campanha excluída",
        description: "A campanha foi removida com sucesso.",
      })
    } catch (error) {
      toast({
        title: "Erro",
        description: "Erro ao excluir campanha. Tente novamente.",
        variant: "destructive",
      })
    } finally {
      setActionLoading(null)
    }
  }

  const handleDuplicateCampaign = async (campaignId: string) => {
    try {
      setActionLoading(campaignId)
      await duplicateCampaign(campaignId)
      toast({
        title: "Campanha duplicada",
        description: "A campanha foi duplicada com sucesso.",
      })
    } catch (error) {
      toast({
        title: "Erro",
        description: "Erro ao duplicar campanha. Tente novamente.",
        variant: "destructive",
      })
    } finally {
      setActionLoading(null)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Agendamento de Campanhas</h1>
          <p className="text-muted-foreground">
            Gerencie e agende suas campanhas de WhatsApp
          </p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Nova Campanha
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Agendadas</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total_scheduled}</div>
            <p className="text-xs text-muted-foreground">
              Campanhas programadas
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Em Execução</CardTitle>
            <Play className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.running}</div>
            <p className="text-xs text-muted-foreground">
              Executando agora
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Concluídas Hoje</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.completed_today}</div>
            <p className="text-xs text-muted-foreground">
              Finalizadas hoje
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Taxa de Sucesso</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.success_rate.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground">
              Entregas bem-sucedidas
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Search */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Buscar campanhas..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filtrar por status" />
          </SelectTrigger>
          <SelectContent>
            {statusOptions.map((status) => (
              <SelectItem key={status} value={status}>
                {status === 'Todos' ? 'Todos os Status' : getStatusText(status)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Main Content */}
      <Tabs defaultValue="campaigns" className="space-y-4">
        <TabsList>
          <TabsTrigger value="campaigns">Campanhas</TabsTrigger>
          <TabsTrigger value="upcoming">Próximas Execuções</TabsTrigger>
        </TabsList>

        <TabsContent value="campaigns" className="space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : (
            <div className="grid gap-4">
              {filteredCampaigns.map((campaign) => (
                <Card key={campaign.id}>
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-semibold">{campaign.name}</h3>
                          <Badge 
                            variant="secondary" 
                            className={`${getStatusColor(campaign.status)} text-white`}
                          >
                            {getStatusIcon(campaign.status)}
                            <span className="ml-1">{getStatusText(campaign.status)}</span>
                          </Badge>
                          <Badge 
                            variant="outline" 
                            className={getPriorityColor(campaign.priority)}
                          >
                            {campaign.priority}
                          </Badge>
                          {campaign.type === 'recurring' && (
                            <Badge variant="outline">
                              <Repeat className="h-3 w-3 mr-1" />
                              Recorrente
                            </Badge>
                          )}
                        </div>
                        <p className="text-muted-foreground mb-3">{campaign.description}</p>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <span className="text-muted-foreground">Agendado para:</span>
                            <p className="font-medium">
                              {format(new Date(campaign.scheduled_date), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                            </p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Público:</span>
                            <p className="font-medium">{campaign.audience_segment}</p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Alcance estimado:</span>
                            <p className="font-medium">{campaign.estimated_reach.toLocaleString()}</p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Template:</span>
                            <p className="font-medium">{campaign.template_name || 'Personalizada'}</p>
                          </div>
                        </div>
                        {campaign.sent_count !== undefined && (
                          <div className="mt-3 grid grid-cols-3 gap-4 text-sm">
                            <div>
                              <span className="text-muted-foreground">Enviadas:</span>
                              <p className="font-medium text-blue-600">{campaign.sent_count}</p>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Entregues:</span>
                              <p className="font-medium text-green-600">{campaign.delivered_count}</p>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Falharam:</span>
                              <p className="font-medium text-red-600">{campaign.failed_count}</p>
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center space-x-2">
                        {campaign.status === 'scheduled' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleStatusChange(campaign.id, 'running')}
                            disabled={actionLoading === campaign.id}
                          >
                            {actionLoading === campaign.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Play className="h-4 w-4" />
                            )}
                          </Button>
                        )}
                        {campaign.status === 'running' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleStatusChange(campaign.id, 'paused')}
                            disabled={actionLoading === campaign.id}
                          >
                            {actionLoading === campaign.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Pause className="h-4 w-4" />
                            )}
                          </Button>
                        )}
                        {campaign.status === 'paused' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleStatusChange(campaign.id, 'running')}
                            disabled={actionLoading === campaign.id}
                          >
                            {actionLoading === campaign.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Play className="h-4 w-4" />
                            )}
                          </Button>
                        )}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => {
                                setSelectedCampaign(campaign)
                                setShowDetailsDialog(true)
                              }}
                            >
                              <Eye className="h-4 w-4 mr-2" />
                              Ver Detalhes
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleDuplicateCampaign(campaign.id)}
                              disabled={actionLoading === campaign.id}
                            >
                              <Copy className="h-4 w-4 mr-2" />
                              Duplicar
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => {
                                setCampaignToDelete(campaign.id)
                                setShowDeleteDialog(true)
                              }}
                              className="text-red-600"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Excluir
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
              {filteredCampaigns.length === 0 && (
                <Card>
                  <CardContent className="p-8 text-center">
                    <Clock className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold mb-2">Nenhuma campanha encontrada</h3>
                    <p className="text-muted-foreground">
                      {searchTerm || statusFilter !== 'Todos' 
                        ? 'Tente ajustar os filtros de busca'
                        : 'Crie sua primeira campanha agendada'
                      }
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="upcoming" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Próximas Execuções</CardTitle>
              <CardDescription>
                Campanhas que serão executadas em breve
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {upcomingExecutions.map((campaign) => (
                  <div key={campaign.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <h4 className="font-medium">{campaign.name}</h4>
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(campaign.scheduled_date), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium">{campaign.audience_count} contatos</p>
                      <Badge variant="outline">{campaign.priority}</Badge>
                    </div>
                  </div>
                ))}
                {upcomingExecutions.length === 0 && (
                  <p className="text-center text-muted-foreground py-8">
                    Nenhuma execução programada
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Create Campaign Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Nova Campanha Agendada</DialogTitle>
            <DialogDescription>
              Configure uma nova campanha para envio automático
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome da Campanha</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Ex: Promoção Black Friday"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="priority">Prioridade</Label>
                <Select 
                  value={formData.priority} 
                  onValueChange={(value: any) => setFormData(prev => ({ ...prev, priority: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Baixa</SelectItem>
                    <SelectItem value="medium">Média</SelectItem>
                    <SelectItem value="high">Alta</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="description">Descrição</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Descreva o objetivo da campanha"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="audience">Segmento de Público</Label>
                <Input
                  id="audience"
                  value={formData.audience_segment}
                  onChange={(e) => setFormData(prev => ({ ...prev, audience_segment: e.target.value }))}
                  placeholder="Ex: Clientes VIP"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="type">Tipo de Campanha</Label>
                <Select 
                  value={formData.type} 
                  onValueChange={(value: any) => setFormData(prev => ({ ...prev, type: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="immediate">Única</SelectItem>
                    <SelectItem value="recurring">Recorrente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {formData.type === 'recurring' && (
              <div className="space-y-2">
                <Label htmlFor="pattern">Padrão de Recorrência</Label>
                <Select 
                  value={formData.recurring_pattern || 'daily'} 
                  onValueChange={(value: any) => setFormData(prev => ({ ...prev, recurring_pattern: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Diário</SelectItem>
                    <SelectItem value="weekly">Semanal</SelectItem>
                    <SelectItem value="monthly">Mensal</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="scheduled_date">Data e Hora do Envio</Label>
              <Input
                id="scheduled_date"
                type="datetime-local"
                value={formData.scheduled_date.toISOString().slice(0, 16)}
                onChange={(e) => setFormData(prev => ({ 
                  ...prev, 
                  scheduled_date: new Date(e.target.value) 
                }))}
                min={new Date().toISOString().slice(0, 16)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="message">Mensagem</Label>
              <Textarea
                id="message"
                value={formData.message_content}
                onChange={(e) => setFormData(prev => ({ ...prev, message_content: e.target.value }))}
                placeholder="Digite a mensagem que será enviada"
                rows={4}
              />
            </div>
          </div>
          <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleCreateCampaign}
              disabled={actionLoading === 'create' || !formData.name || !formData.message_content}
            >
              {actionLoading === 'create' ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Criando...
                </>
              ) : (
                'Criar Campanha'
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Campaign Details Dialog */}
      <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Detalhes da Campanha</DialogTitle>
          </DialogHeader>
          {selectedCampaign && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Nome</Label>
                  <p className="font-medium">{selectedCampaign.name}</p>
                </div>
                <div>
                  <Label>Status</Label>
                  <Badge className={`${getStatusColor(selectedCampaign.status)} text-white`}>
                    {getStatusText(selectedCampaign.status)}
                  </Badge>
                </div>
              </div>
              <div>
                <Label>Descrição</Label>
                <p>{selectedCampaign.description}</p>
              </div>
              <div>
                <Label>Mensagem</Label>
                <div className="p-3 bg-muted rounded-md">
                  <p>{selectedCampaign.message_content}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Agendado para</Label>
                  <p>{format(new Date(selectedCampaign.scheduled_date), 'dd/MM/yyyy HH:mm', { locale: ptBR })}</p>
                </div>
                <div>
                  <Label>Público-alvo</Label>
                  <p>{selectedCampaign.audience_segment}</p>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
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
              onClick={handleDeleteCampaign}
              className="bg-red-600 hover:bg-red-700"
              disabled={actionLoading === 'delete'}
            >
              {actionLoading === 'delete' ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Excluindo...
                </>
              ) : (
                'Excluir'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}