import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Progress } from '@/components/ui/progress'
import { Switch } from '@/components/ui/switch'
import { 
  Zap, 
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
  Clock,
  CheckCircle,
  AlertCircle,
  Eye,
  Edit,
  Copy,
  Trash2,
  Settings,
  ArrowRight,
  ArrowDown,
  Timer,
  Target,
  Workflow,
  Bot,
  Send,
  Reply,
  UserPlus,
  Tag,
  GitBranch,
  Repeat,
  Loader2,
  Save,
  X,
  TestTube
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
import { useAutomations } from '@/hooks/useAutomations'
import type { Automation, AutomationTrigger, AutomationAction, AutomationCondition } from '@/hooks/useAutomations'
import FlowBuilder from '@/components/FlowBuilder'
// add auth import
import { useAuth } from '@/hooks/useAuth'
// add evolution api + toast imports
import { useEvolutionApi } from '@/hooks/useEvolutionApi'
import { toast } from 'sonner'

const TRIGGER_TYPES = [
  {
    id: 'keyword',
    name: 'Palavra-chave',
    description: 'Acionado quando uma palavra-chave específica é recebida',
    icon: MessageSquare,
    color: 'text-blue-600',
    bgColor: 'bg-blue-100'
  },
  {
    id: 'schedule',
    name: 'Agendamento',
    description: 'Acionado em horários específicos',
    icon: Clock,
    color: 'text-green-600',
    bgColor: 'bg-green-100'
  },
  {
    id: 'event',
    name: 'Evento',
    description: 'Acionado por eventos do sistema',
    icon: Target,
    color: 'text-purple-600',
    bgColor: 'bg-purple-100'
  },
  {
    id: 'webhook',
    name: 'Webhook',
    description: 'Acionado por chamadas externas',
    icon: GitBranch,
    color: 'text-orange-600',
    bgColor: 'bg-orange-100'
  }
]

const ACTION_TYPES = [
  {
    id: 'send_message',
    name: 'Enviar Mensagem',
    description: 'Envia uma mensagem para o contato',
    icon: Send,
    color: 'text-blue-600'
  },
  {
    id: 'add_tag',
    name: 'Adicionar Tag',
    description: 'Adiciona uma tag ao contato',
    icon: Tag,
    color: 'text-green-600'
  },
  {
    id: 'remove_tag',
    name: 'Remover Tag',
    description: 'Remove uma tag do contato',
    icon: X,
    color: 'text-red-600'
  },
  {
    id: 'update_contact',
    name: 'Atualizar Contato',
    description: 'Atualiza informações do contato',
    icon: UserPlus,
    color: 'text-purple-600'
  },
  {
    id: 'delay',
    name: 'Aguardar',
    description: 'Adiciona um delay antes da próxima ação',
    icon: Timer,
    color: 'text-orange-600'
  },
  {
    id: 'webhook',
    name: 'Webhook',
    description: 'Chama um webhook externo',
    icon: GitBranch,
    color: 'text-gray-600'
  }
]

export default function Automation() {
  const navigate = useNavigate()
  const {
    automations,
    stats,
    loading,
    createAutomation,
    updateAutomation,
    deleteAutomation,
    toggleAutomationStatus,
    duplicateAutomation,
    testAutomation,
    getActiveAutomations,
    getInactiveAutomations,
    searchAutomations,
    getAutomationsByTrigger
  } = useAutomations()

  const { isAuthenticated } = useAuth()
  const { instances, sendMessage, loading: evoLoading } = useEvolutionApi()

  const [searchTerm, setSearchTerm] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterTrigger, setFilterTrigger] = useState('all')
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [selectedAutomation, setSelectedAutomation] = useState<Automation | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  // Test dialog states
  const [testDialogOpen, setTestDialogOpen] = useState(false)
  const [testPhone, setTestPhone] = useState('')
  const [selectedInstanceId, setSelectedInstanceId] = useState<string | null>(null)
  const [testing, setTesting] = useState(false)
  const connectedInstances = instances.filter(i => i.status === 'connected')

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    is_active: true,
    trigger: {
      type: 'keyword' as const,
      config: {}
    } as AutomationTrigger,
    conditions: [] as AutomationCondition[],
    actions: [] as AutomationAction[]
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Demo mode for unauthenticated users
  const [demoAutomations] = useState<Automation[]>([
    {
      id: 'demo-1',
      name: "Cupom por palavra-chave",
      description: "Responde 'promo' com um cupom de desconto",
      is_active: true,
      trigger: { type: 'keyword', config: { keywords: ['promo'] } },
      conditions: [],
      actions: [
        { type: 'send_message', config: { message: { content: "Aqui está seu cupom: PROMO10" } } }
      ],
      stats: { triggered_count: 58, success_count: 55, error_count: 3 },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      created_by: 'demo'
    },
    {
      id: 'demo-2',
      name: "Mensagem diária de bom dia",
      description: "Envia uma mensagem diária às 09:00",
      is_active: true,
      trigger: { type: 'schedule', config: { schedule: { type: 'daily', time: '09:00' } } },
      conditions: [],
      actions: [
        { type: 'send_message', config: { message: { content: "Bom dia! ☀️ Tenha um ótimo dia!" } } }
      ],
      stats: { triggered_count: 12, success_count: 12, error_count: 0 },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      created_by: 'demo'
    }
  ])

  const displayedAutomations = (isAuthenticated ? automations : demoAutomations).filter(automation => {
    const matchesSearch = searchTerm === '' || 
      automation.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      automation.description?.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesStatus = filterStatus === 'all' || 
      (filterStatus === 'active' && automation.is_active) ||
      (filterStatus === 'inactive' && !automation.is_active)
    
    const matchesTrigger = filterTrigger === 'all' || automation.trigger.type === filterTrigger
    
    return matchesSearch && matchesStatus && matchesTrigger
  })

  const demoStats = (() => {
    const total = demoAutomations.length
    const active = demoAutomations.filter(a => a.is_active).length
    const totalTriggered = demoAutomations.reduce((sum, a) => sum + (a.stats.triggered_count || 0), 0)
    const totalSuccess = demoAutomations.reduce((sum, a) => sum + (a.stats.success_count || 0), 0)
    const successRate = totalTriggered > 0 ? Math.round((totalSuccess / totalTriggered) * 100) : 0
    let mostName = 'Nenhuma'
    let maxCount = 0
    demoAutomations.forEach(a => {
      if ((a.stats.triggered_count || 0) > maxCount) {
        maxCount = a.stats.triggered_count || 0
        mostName = a.name
      }
    })
    return {
      total_automations: total,
      active_automations: active,
      triggered_today: 0,
      success_rate: successRate,
      most_triggered: { name: mostName, count: maxCount }
    }
  })()

  const totalAutomationsDisplay = isAuthenticated ? (stats?.total_automations || 0) : demoStats.total_automations
  const activeAutomationsDisplay = isAuthenticated ? (stats?.active_automations || 0) : demoStats.active_automations
  const triggeredTodayDisplay = isAuthenticated ? (stats?.triggered_today || 0) : demoStats.triggered_today
  const successRateDisplay = isAuthenticated ? (stats?.success_rate || 0) : demoStats.success_rate
  const mostNameDisplay = isAuthenticated ? (stats?.most_triggered?.name || 'Nenhuma') : (demoStats.most_triggered?.name || 'Nenhuma')
  const mostCountDisplay = isAuthenticated ? (stats?.most_triggered?.count || 0) : (demoStats.most_triggered?.count || 0)

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      is_active: true,
      trigger: {
        type: 'keyword',
        config: {}
      },
      conditions: [],
      actions: []
    })
    setErrors({})
  }

  const validateForm = () => {
    const newErrors: Record<string, string> = {}
    
    if (!formData.name.trim()) {
      newErrors.name = 'Nome da automação é obrigatório'
    }
    
    if (formData.actions.length === 0) {
      newErrors.actions = 'Pelo menos uma ação é obrigatória'
    }
    
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleCreate = async () => {
    if (!validateForm()) return
    
    try {
      setActionLoading('create')
      await createAutomation(formData)
      setCreateDialogOpen(false)
      resetForm()
    } catch (error) {
      console.error('Erro ao criar automação:', error)
    } finally {
      setActionLoading(null)
    }
  }

  const handleEdit = async () => {
    if (!validateForm() || !selectedAutomation) return
    
    try {
      setActionLoading('edit')
      await updateAutomation(selectedAutomation.id, formData)
      setEditDialogOpen(false)
      setSelectedAutomation(null)
      resetForm()
    } catch (error) {
      console.error('Erro ao editar automação:', error)
    } finally {
      setActionLoading(null)
    }
  }

  const handleDelete = async () => {
    if (!selectedAutomation) return
    
    try {
      setActionLoading('delete')
      await deleteAutomation(selectedAutomation.id)
      setDeleteDialogOpen(false)
      setSelectedAutomation(null)
    } catch (error) {
      console.error('Erro ao excluir automação:', error)
    } finally {
      setActionLoading(null)
    }
  }

  const handleToggleStatus = async (automation: Automation) => {
    try {
      setActionLoading(automation.id)
      await toggleAutomationStatus(automation.id)
    } catch (error) {
      console.error('Erro ao alterar status:', error)
    } finally {
      setActionLoading(null)
    }
  }

  const handleDuplicate = async (automation: Automation) => {
    try {
      setActionLoading(automation.id)
      await duplicateAutomation(automation)
    } catch (error) {
      console.error('Erro ao duplicar automação:', error)
    } finally {
      setActionLoading(null)
    }
  }

  const handleTest = async (automation: Automation) => {
    // Em ambiente real, abrir diálogo de teste para escolher instância e número
    if (isAuthenticated) {
      setSelectedAutomation(automation)
      setTestDialogOpen(true)
      setSelectedInstanceId(connectedInstances[0]?.id || null)
      return
    }
    // Fallback de simulação para não autenticados
    try {
      setActionLoading(automation.id)
      await testAutomation(automation.id)
    } catch (error) {
      console.error('Erro ao testar automação:', error)
    } finally {
      setActionLoading(null)
    }
  }

  const handleRunTest = async () => {
    if (!selectedAutomation) return
    if (!isAuthenticated) {
      toast.warning('Faça login para testar em ambiente real')
      return
    }
    if (!selectedInstanceId) {
      toast.error('Selecione uma instância conectada')
      return
    }
    const phoneDigits = testPhone.replace(/\D/g, '')
    if (!phoneDigits || phoneDigits.length < 10) {
      toast.error('Informe um número válido com DDI/DDD')
      return
    }

    const instance = instances.find(i => i.id === selectedInstanceId)
    if (!instance || instance.status !== 'connected') {
      toast.error('Instância não conectada')
      return
    }

    setTesting(true)
    try {
      const messageAction = selectedAutomation.actions.find(a => a.type === 'send_message')
      const text = messageAction?.config?.message?.content || `Teste da automação: ${selectedAutomation.name}`
      const res = await sendMessage(instance, phoneDigits, text)
      if (res?.success) {
        toast.success('Teste enviado via WhatsApp')
        setTestDialogOpen(false)
        setTestPhone('')
        setSelectedInstanceId(null)
      } else {
        toast.error('Não foi possível enviar o teste')
      }
    } catch (error) {
      console.error('Erro ao executar teste:', error)
      toast.error('Erro ao executar teste')
    } finally {
      setTesting(false)
    }
  }

  const openEditDialog = (automation: Automation) => {
    setSelectedAutomation(automation)
    setFormData({
      name: automation.name,
      description: automation.description || '',
      is_active: automation.is_active,
      trigger: automation.trigger,
      conditions: automation.conditions || [],
      actions: automation.actions
    })
    setEditDialogOpen(true)
  }

  const openDeleteDialog = (automation: Automation) => {
    setSelectedAutomation(automation)
    setDeleteDialogOpen(true)
  }

  const addAction = () => {
    setFormData(prev => ({
      ...prev,
      actions: [...prev.actions, {
        type: 'send_message',
        config: {}
      }]
    }))
  }

  const removeAction = (index: number) => {
    setFormData(prev => ({
      ...prev,
      actions: prev.actions.filter((_, i) => i !== index)
    }))
  }

  const updateAction = (index: number, action: AutomationAction) => {
    setFormData(prev => ({
      ...prev,
      actions: prev.actions.map((a, i) => i === index ? action : a)
    }))
  }

  const getTriggerIcon = (type: string) => {
    const trigger = TRIGGER_TYPES.find(t => t.id === type)
    return trigger ? trigger.icon : MessageSquare
  }

  const getStatusColor = (isActive: boolean) => {
    return isActive ? 'text-green-600' : 'text-gray-400'
  }

  const getStatusBadge = (isActive: boolean) => {
    return isActive ? 'default' : 'secondary'
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
          <h1 className="text-3xl font-bold text-foreground">Automações</h1>
          <p className="text-muted-foreground">Crie fluxos automatizados para engajar seus contatos</p>
        </div>
        <Button className="gap-2" onClick={() => isAuthenticated && setCreateDialogOpen(true)} disabled={!isAuthenticated} title={!isAuthenticated ? 'Faça login para criar automações' : undefined}>
          <Plus className="h-4 w-4" />
          Nova Automação
        </Button>
      </div>

      {!isAuthenticated && (
        <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
          Modo demonstração: faça login para criar, salvar e ativar automações. Você pode testar as automações de exemplo.
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Automações</p>
                <p className="text-2xl font-bold text-foreground">{totalAutomationsDisplay}</p>
                <p className="text-sm text-green-600">{activeAutomationsDisplay} ativas</p>
              </div>
              <div className="p-3 rounded-lg bg-primary/10">
                <Zap className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Acionadas Hoje</p>
                <p className="text-2xl font-bold text-foreground">{triggeredTodayDisplay}</p>
                <p className="text-sm text-green-600">Execuções</p>
              </div>
              <div className="p-3 rounded-lg bg-primary/10">
                <Target className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Taxa de Sucesso</p>
                <p className="text-2xl font-bold text-foreground">{successRateDisplay}%</p>
                <p className="text-sm text-green-600">Média geral</p>
              </div>
              <div className="p-3 rounded-lg bg-primary/10">
                <CheckCircle className="h-6 w-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Mais Acionada</p>
                <p className="text-2xl font-bold text-foreground">{mostCountDisplay}</p>
                <p className="text-sm text-green-600 truncate">{mostNameDisplay}</p>
              </div>
              <div className="p-3 rounded-lg bg-primary/10">
                <Bot className="h-6 w-6 text-yellow-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Search */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar automações..."
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
                <SelectItem value="active">Ativo</SelectItem>
                <SelectItem value="inactive">Inativo</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterTrigger} onValueChange={setFilterTrigger}>
              <SelectTrigger className="w-full lg:w-48">
                <SelectValue placeholder="Trigger" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Triggers</SelectItem>
                {TRIGGER_TYPES.map(trigger => (
                  <SelectItem key={trigger.id} value={trigger.id}>{trigger.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Automations Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {displayedAutomations.length === 0 ? (
          <div className="col-span-full">
            <Card>
              <CardContent className="p-12 text-center">
                <Bot className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">Nenhuma automação encontrada</h3>
                <p className="text-muted-foreground mb-4">
                  {searchTerm || filterStatus !== 'all' || filterTrigger !== 'all'
                    ? 'Tente ajustar os filtros de busca'
                    : 'Crie sua primeira automação para começar'}
                </p>
                {!searchTerm && filterStatus === 'all' && filterTrigger === 'all' && (
                  <Button onClick={() => isAuthenticated && setCreateDialogOpen(true)} disabled={!isAuthenticated} title={!isAuthenticated ? 'Faça login para criar automações' : undefined}>
                    <Plus className="h-4 w-4 mr-2" />
                    Criar Primeira Automação
                  </Button>
                )}
              </CardContent>
            </Card>
          </div>
        ) : (
          displayedAutomations.map((automation) => {
            const TriggerIcon = getTriggerIcon(automation.trigger.type)
            
            return (
              <Card key={automation.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <TriggerIcon className="h-4 w-4 text-muted-foreground" />
                        <CardTitle className="text-lg">{automation.name}</CardTitle>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={getStatusBadge(automation.is_active)}>
                          {automation.is_active ? 'Ativo' : 'Inativo'}
                        </Badge>
                        <Badge variant="outline">
                          {TRIGGER_TYPES.find(t => t.id === automation.trigger.type)?.name || automation.trigger.type}
                        </Badge>
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" disabled={actionLoading === automation.id}>
                          {actionLoading === automation.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <MoreHorizontal className="h-4 w-4" />
                          )}
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleTest(automation)}>
                          <TestTube className="h-4 w-4 mr-2" />
                          Testar
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => openEditDialog(automation)}>
                          <Edit className="h-4 w-4 mr-2" />
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleDuplicate(automation)}>
                          <Copy className="h-4 w-4 mr-2" />
                          Duplicar
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => handleToggleStatus(automation)}>
                          {automation.is_active ? (
                            <>
                              <Pause className="h-4 w-4 mr-2" />
                              Pausar
                            </>
                          ) : (
                            <>
                              <Play className="h-4 w-4 mr-2" />
                              Ativar
                            </>
                          )}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                          onClick={() => openDeleteDialog(automation)}
                          className="text-red-600"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardHeader>
                <CardContent>
                  {automation.description && (
                    <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                      {automation.description}
                    </p>
                  )}
                  
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Ações:</span>
                      <span className="font-medium">{automation.actions.length}</span>
                    </div>
                    
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Execuções:</span>
                      <span className="font-medium">{automation.stats.triggered_count}</span>
                    </div>
                    
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Sucessos:</span>
                      <span className="font-medium text-green-600">{automation.stats.success_count}</span>
                    </div>
                    
                    {automation.stats.error_count > 0 && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Erros:</span>
                        <span className="font-medium text-red-600">{automation.stats.error_count}</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })
        )}
      </div>

      {/* Test Automation Dialog (real environment) */}
      <Dialog open={testDialogOpen} onOpenChange={setTestDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Testar Automação</DialogTitle>
            <DialogDescription>
              Selecione uma instância conectada e informe um número de WhatsApp para enviar uma mensagem de teste.
            </DialogDescription>
          </DialogHeader>

          {connectedInstances.length === 0 ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Nenhuma instância do WhatsApp está conectada. Conecte uma instância para testar em ambiente real.
              </p>
              <Button variant="default" onClick={() => { setTestDialogOpen(false); navigate('/whatsapp-integration') }}>
                Conectar Instância
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Instância</Label>
                <Select value={selectedInstanceId ?? ''} onValueChange={(val) => setSelectedInstanceId(val)}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selecione a instância" />
                  </SelectTrigger>
                  <SelectContent>
                    {connectedInstances.map(inst => (
                      <SelectItem key={inst.id} value={inst.id}>
                        {inst.name} ({inst.phone_number || 'sem número'})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Número para teste (com DDI/DDD)</Label>
                <Input value={testPhone} onChange={(e) => setTestPhone(e.target.value)} placeholder="Ex.: 5599999999999" />
              </div>

              <div className="space-y-2">
                <Label>Mensagem</Label>
                <div className="p-3 rounded-md border text-sm text-muted-foreground">
                  {(selectedAutomation?.actions.find(a => a.type === 'send_message')?.config?.message?.content) || `Teste da automação: ${selectedAutomation?.name || ''}`}
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setTestDialogOpen(false)} disabled={testing}>Cancelar</Button>
                <Button onClick={handleRunTest} disabled={testing || !selectedInstanceId || !testPhone} className="gap-2">
                  {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <TestTube className="h-4 w-4" />}
                  Executar Teste
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Create Automation Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Criar Nova Automação</DialogTitle>
            <DialogDescription>
              Configure triggers e ações para automatizar suas interações
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6">
            {/* Basic Info */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome da Automação *</Label>
                <Input
                  id="name"
                  placeholder="Ex: Sequência de Boas-vindas"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  className={errors.name ? 'border-red-500' : ''}
                />
                {errors.name && (
                  <p className="text-sm text-red-600">{errors.name}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="trigger-type">Tipo de Trigger *</Label>
                <Select 
                  value={formData.trigger.type} 
                  onValueChange={(value) => setFormData(prev => ({ 
                    ...prev, 
                    trigger: { type: value as any, config: {} }
                  }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um trigger" />
                  </SelectTrigger>
                  <SelectContent>
                    {TRIGGER_TYPES.map(trigger => (
                      <SelectItem key={trigger.id} value={trigger.id}>
                        <div className="flex items-center gap-2">
                          <trigger.icon className="h-4 w-4" />
                          {trigger.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Descrição</Label>
              <Textarea
                id="description"
                placeholder="Descreva o objetivo desta automação..."
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                rows={3}
              />
            </div>

            {/* Trigger Configuration */}
            {formData.trigger.type === 'keyword' && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Configuração do Trigger</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <Label>Palavras-chave (separadas por vírgula)</Label>
                    <Input
                      placeholder="Ex: oi, olá, menu, ajuda"
                      onChange={(e) => {
                        const keywords = e.target.value.split(',').map(k => k.trim()).filter(k => k)
                        setFormData(prev => ({
                          ...prev,
                          trigger: {
                            ...prev.trigger,
                            config: { keywords }
                          }
                        }))
                      }}
                    />
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Actions */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">Ações</CardTitle>
                  <Button variant="outline" size="sm" onClick={addAction}>
                    <Plus className="h-4 w-4 mr-2" />
                    Adicionar Ação
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {formData.actions.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Bot className="h-8 w-8 mx-auto mb-2" />
                    <p>Nenhuma ação configurada</p>
                    <p className="text-sm">Clique em "Adicionar Ação" para começar</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {formData.actions.map((action, index) => (
                      <Card key={index} className="border-dashed">
                        <CardContent className="p-4">
                          <div className="flex items-start gap-4">
                            <div className="flex-1 space-y-4">
                              <div className="flex items-center justify-between">
                                <Label>Tipo de Ação</Label>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => removeAction(index)}
                                  className="text-red-600 hover:text-red-700"
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                              <Select
                                value={action.type}
                                onValueChange={(value) => updateAction(index, { ...action, type: value as any })}
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {ACTION_TYPES.map(actionType => (
                                    <SelectItem key={actionType.id} value={actionType.id}>
                                      <div className="flex items-center gap-2">
                                        <actionType.icon className="h-4 w-4" />
                                        {actionType.name}
                                      </div>
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>

                              {/* Action-specific configuration */}
                              {action.type === 'send_message' && (
                                <div className="space-y-2">
                                  <Label>Mensagem</Label>
                                  <Textarea
                                    placeholder="Digite a mensagem a ser enviada..."
                                    value={action.config.message?.content || ''}
                                    onChange={(e) => updateAction(index, {
                                      ...action,
                                      config: {
                                        ...action.config,
                                        message: { content: e.target.value }
                                      }
                                    })}
                                    rows={3}
                                  />
                                </div>
                              )}

                              {(action.type === 'add_tag' || action.type === 'remove_tag') && (
                                <div className="space-y-2">
                                  <Label>Tags (separadas por vírgula)</Label>
                                  <Input
                                    placeholder="Ex: cliente, vip, interessado"
                                    onChange={(e) => {
                                      const tags = e.target.value.split(',').map(t => t.trim()).filter(t => t)
                                      updateAction(index, {
                                        ...action,
                                        config: { ...action.config, tags }
                                      })
                                    }}
                                  />
                                </div>
                              )}

                              {action.type === 'delay' && (
                                <div className="grid grid-cols-2 gap-2">
                                  <div className="space-y-2">
                                    <Label>Quantidade</Label>
                                    <Input
                                      type="number"
                                      placeholder="1"
                                      onChange={(e) => updateAction(index, {
                                        ...action,
                                        config: {
                                          ...action.config,
                                          delay: {
                                            ...action.config.delay,
                                            amount: parseInt(e.target.value) || 1
                                          }
                                        }
                                      })}
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <Label>Unidade</Label>
                                    <Select
                                      value={action.config.delay?.unit || 'minutes'}
                                      onValueChange={(value) => updateAction(index, {
                                        ...action,
                                        config: {
                                          ...action.config,
                                          delay: {
                                            ...action.config.delay,
                                            unit: value as any
                                          }
                                        }
                                      })}
                                    >
                                      <SelectTrigger>
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="minutes">Minutos</SelectItem>
                                        <SelectItem value="hours">Horas</SelectItem>
                                        <SelectItem value="days">Dias</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
                {errors.actions && (
                  <p className="text-sm text-red-600 mt-2">{errors.actions}</p>
                )}
              </CardContent>
            </Card>

            <div className="flex items-center space-x-2">
              <Switch
                id="is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_active: checked }))}
              />
              <Label htmlFor="is_active">Automação ativa</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setCreateDialogOpen(false); resetForm(); }}>
              Cancelar
            </Button>
            <Button onClick={handleCreate} disabled={actionLoading === 'create'}>
              {actionLoading === 'create' ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Criando...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Criar Automação
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Automation Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Automação</DialogTitle>
            <DialogDescription>
              Faça alterações na sua automação
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6">
            {/* Same form as create, but with edit data */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">Nome da Automação *</Label>
                <Input
                  id="edit-name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  className={errors.name ? 'border-red-500' : ''}
                />
                {errors.name && (
                  <p className="text-sm text-red-600">{errors.name}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-trigger-type">Tipo de Trigger *</Label>
                <Select 
                  value={formData.trigger.type} 
                  onValueChange={(value) => setFormData(prev => ({ 
                    ...prev, 
                    trigger: { type: value as any, config: {} }
                  }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TRIGGER_TYPES.map(trigger => (
                      <SelectItem key={trigger.id} value={trigger.id}>
                        <div className="flex items-center gap-2">
                          <trigger.icon className="h-4 w-4" />
                          {trigger.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-description">Descrição</Label>
              <Textarea
                id="edit-description"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                rows={3}
              />
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="edit-is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_active: checked }))}
              />
              <Label htmlFor="edit-is_active">Automação ativa</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setEditDialogOpen(false); setSelectedAutomation(null); resetForm(); }}>
              Cancelar
            </Button>
            <Button onClick={handleEdit} disabled={actionLoading === 'edit'}>
              {actionLoading === 'edit' ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Salvando...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Salvar Alterações
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a automação "{selectedAutomation?.name}"? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete}
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