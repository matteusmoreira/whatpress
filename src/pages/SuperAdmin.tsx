import { useState, useCallback, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Building2,
  Users,
  Settings,
  Plus,
  Search,
  MoreHorizontal,
  Crown,
  Activity,
  DollarSign,
  TrendingUp,
  AlertTriangle,
  Gauge,
  Edit,
  RefreshCw
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
// select não utilizado
import { useTenants } from '@/hooks/useTenants'
import { useTenant } from '@/hooks/useTenant'
import { useNavigate } from 'react-router-dom'
// useQuotas não utilizado
import { QuotaProgressGrid } from '@/components/ui/quota-progress'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog'
import { SuperAdminOnly } from '@/components/RoleGuard'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { Resources, Actions } from '@/constants/permissions'
import { useRoleContext } from '@/contexts/useRoleContext'

const mockStats = [
  {
    title: 'Total de Tenants',
    value: '156',
    change: '+12%',
    icon: Building2,
    color: 'text-primary'
  },
  {
    title: 'Receita Mensal',
    value: 'R$ 89.450',
    change: '+23%',
    icon: DollarSign,
    color: 'text-green-600'
  },
  {
    title: 'Usuários Ativos',
    value: '2.847',
    change: '+8%',
    icon: Users,
    color: 'text-blue-600'
  },
  {
    title: 'Campanhas Ativas',
    value: '1.234',
    change: '+15%',
    icon: Activity,
    color: 'text-purple-600'
  }
]

interface TenantQuotaData {
  tenant_id: string
  tenant_name: string
  plan: string
  status: string
  quotas: any
  usage_percentage: number
  alerts_count: number
}

interface QuotaEditForm {
  max_users: number
  max_contacts: number
  max_connections: number
  max_message_templates: number
  max_automations: number
  max_messages_per_month: number
}

export default function SuperAdmin() {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedTab, setSelectedTab] = useState('overview')
  const [tenantsQuotaData, setTenantsQuotaData] = useState<TenantQuotaData[]>([])
  const [quotasLoading, setQuotasLoading] = useState(false)
  const [selectedTenantForQuota, setSelectedTenantForQuota] = useState<string | null>(null)
  const [quotaEditForm, setQuotaEditForm] = useState<QuotaEditForm>({
    max_users: 0,
    max_contacts: 0,
    max_connections: 0,
    max_message_templates: 0,
    max_automations: 0,
    max_messages_per_month: 0
  })
  const [isQuotaDialogOpen, setIsQuotaDialogOpen] = useState(false)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [createName, setCreateName] = useState('')
  const [createDomain, setCreateDomain] = useState('')
  const [creating, setCreating] = useState(false)

  const { tenants, selectedTenantId, createTenant, loading } = useTenants()
  const { switchTenant } = useTenant()
  const navigate = useNavigate()
  const { logAction } = useRoleContext()

  // Carregar dados de quotas de todos os tenants
  const loadTenantsQuotaData = useCallback(async () => {
    setQuotasLoading(true)
    try {
      const { data: quotasData, error: quotasError } = await supabase
        .from('tenant_quotas')
        .select(`
          *,
          tenants!inner(id, name, plan, status)
        `)

      if (quotasError) throw quotasError

      const { data: alertsData, error: alertsError } = await supabase
        .from('quota_alerts')
        .select('tenant_id, id')
        .eq('acknowledged', false)

      if (alertsError) throw alertsError

      const alertsCount = alertsData?.reduce((acc: Record<string, number>, alert) => {
        acc[alert.tenant_id] = (acc[alert.tenant_id] || 0) + 1
        return acc
      }, {}) || {}

      const processedData: TenantQuotaData[] = quotasData?.map((quota: any) => {
        const totalUsage = (
          (quota.current_users / Math.max(quota.max_users, 1)) +
          (quota.current_contacts / Math.max(quota.max_contacts, 1)) +
          (quota.current_connections / Math.max(quota.max_connections, 1)) +
          (quota.current_message_templates / Math.max(quota.max_message_templates, 1)) +
          (quota.current_automations / Math.max(quota.max_automations, 1)) +
          (quota.used_messages_current_month / Math.max(quota.max_messages_per_month, 1))
        ) / 6 * 100

        return {
          tenant_id: quota.tenant_id,
          tenant_name: quota.tenants.name,
          plan: quota.tenants.plan,
          status: quota.tenants.status,
          quotas: quota,
          usage_percentage: Math.round(totalUsage),
          alerts_count: alertsCount[quota.tenant_id] || 0
        }
      }) || []

      setTenantsQuotaData(processedData)
      // Auditoria cliente: visualizar quotas
      logAction(Actions.VIEW_QUOTAS, Resources.QUOTAS, { tenants: processedData.length, source: 'SuperAdmin' }).catch(() => { })
    } catch (error: any) {
      console.error('Erro ao carregar dados de quotas:', error)
      toast.error('Erro ao carregar dados de quotas')
      // Auditoria cliente: erro ao visualizar quotas
      logAction(Actions.VIEW_QUOTAS, Resources.QUOTAS, { result: 'error', error: error?.message || 'unknown' }).catch(() => { })
    } finally {
      setQuotasLoading(false)
    }
  }, [logAction])

  // Atualizar quotas de um tenant
  const updateTenantQuotas = useCallback(async (tenantId: string, quotas: QuotaEditForm) => {
    try {
      const { error } = await supabase
        .from('tenant_quotas')
        .update(quotas)
        .eq('tenant_id', tenantId)

      if (error) throw error

      // Auditoria cliente: atualizar quotas
      logAction(Actions.UPDATE_QUOTAS, Resources.QUOTAS, { tenantId, quotas, result: 'success' }).catch(() => { })

      toast.success('Quotas atualizadas com sucesso!')
      setIsQuotaDialogOpen(false)
      loadTenantsQuotaData()
    } catch (error: any) {
      console.error('Erro ao atualizar quotas:', error)
      toast.error('Erro ao atualizar quotas')
      // Auditoria cliente: erro ao atualizar quotas
      logAction(Actions.UPDATE_QUOTAS, Resources.QUOTAS, { tenantId, quotas, result: 'error', error: error?.message || 'unknown' }).catch(() => { })
    }
  }, [loadTenantsQuotaData, logAction])

  // Abrir dialog de edição de quotas
  const openQuotaEditDialog = useCallback(async (tenantId: string) => {
    const tenantData = tenantsQuotaData.find(t => t.tenant_id === tenantId)
    if (!tenantData) return

    setQuotaEditForm({
      max_users: tenantData.quotas.max_users,
      max_contacts: tenantData.quotas.max_contacts,
      max_connections: tenantData.quotas.max_connections,
      max_message_templates: tenantData.quotas.max_message_templates,
      max_automations: tenantData.quotas.max_automations,
      max_messages_per_month: tenantData.quotas.max_messages_per_month
    })
    setSelectedTenantForQuota(tenantId)
    setIsQuotaDialogOpen(true)
  }, [tenantsQuotaData])

  // Aplicar plano padrão
  const applyDefaultPlan = useCallback(async (tenantId: string, plan: 'starter' | 'pro' | 'enterprise') => {
    const defaultQuotas = {
      starter: {
        max_users: 2,
        max_contacts: 1000,
        max_connections: 1,
        max_message_templates: 10,
        max_automations: 5,
        max_messages_per_month: 5000
      },
      pro: {
        max_users: 10,
        max_contacts: 10000,
        max_connections: 5,
        max_message_templates: 50,
        max_automations: 25,
        max_messages_per_month: 50000
      },
      enterprise: {
        max_users: -1, // Ilimitado
        max_contacts: -1,
        max_connections: -1,
        max_message_templates: -1,
        max_automations: -1,
        max_messages_per_month: -1
      }
    }

    try {
      // Auditoria cliente: aplicar plano padrão (override quotas)
      logAction(Actions.OVERRIDE_QUOTAS, Resources.QUOTAS, { tenantId, plan, quotas: defaultQuotas[plan], stage: 'attempt' }).catch(() => { })
      await updateTenantQuotas(tenantId, defaultQuotas[plan])
      logAction(Actions.OVERRIDE_QUOTAS, Resources.QUOTAS, { tenantId, plan, result: 'success' }).catch(() => { })
    } catch (error: any) {
      console.error('Erro ao aplicar plano padrão:', error)
      toast.error('Erro ao aplicar plano padrão')
      logAction(Actions.OVERRIDE_QUOTAS, Resources.QUOTAS, { tenantId, plan, result: 'error', error: error?.message || 'unknown' }).catch(() => { })
    }
  }, [updateTenantQuotas, logAction])

  const deleteTenantQuotas = useCallback(async (tenantId: string) => {
    try {
      logAction(Actions.RESET_QUOTAS, Resources.QUOTAS, { tenantId, stage: 'attempt' }).catch(() => { })
      const { error } = await supabase
        .from('tenant_quotas')
        .delete()
        .eq('tenant_id', tenantId)
      if (error) throw error
      toast.success('Quotas excluídas com sucesso')
      logAction(Actions.RESET_QUOTAS, Resources.QUOTAS, { tenantId, result: 'success' }).catch(() => { })
      loadTenantsQuotaData()
    } catch (error: any) {
      console.error('Erro ao excluir quotas:', error)
      toast.error('Erro ao excluir quotas')
      logAction(Actions.RESET_QUOTAS, Resources.QUOTAS, { tenantId, result: 'error', error: error?.message || 'unknown' }).catch(() => { })
    }
  }, [loadTenantsQuotaData, logAction])

  useEffect(() => {
    loadTenantsQuotaData()
  }, [loadTenantsQuotaData])

  const filteredTenants = (tenants || []).filter((tenant: any) =>
    (tenant?.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (tenant?.domain || '').toLowerCase().includes(searchTerm.toLowerCase())
  )

  const filteredQuotaData = tenantsQuotaData.filter(data =>
    data.tenant_name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const handleCreateTenant = useCallback(async () => {
    setCreateDialogOpen(true)
  }, [])

  const submitCreateTenant = useCallback(async () => {
    if (!createName.trim()) return
    setCreating(true)
    try {
      await createTenant(createName.trim(), createDomain.trim() || undefined)
      toast.success('Empresa criada com sucesso')
      setCreateDialogOpen(false)
      setCreateName('')
      setCreateDomain('')
    } catch (e: any) {
      toast.error(e?.message || 'Erro ao criar empresa')
    } finally {
      setCreating(false)
    }
  }, [createName, createDomain, createTenant])

  const getStatusBadge = (status: string) => {
    const variants = {
      active: 'bg-green-100 text-green-800 border-green-200',
      suspended: 'bg-red-100 text-red-800 border-red-200',
      pending: 'bg-yellow-100 text-yellow-800 border-yellow-200'
    }
    return variants[status as keyof typeof variants] || variants.active
  }

  const getPlanBadge = (plan: string) => {
    const normalized = (plan || '').toLowerCase()
    const variants: Record<string, string> = {
      enterprise: 'bg-purple-100 text-purple-800 border-purple-200',
      pro: 'bg-blue-100 text-blue-800 border-blue-200',
      professional: 'bg-blue-100 text-blue-800 border-blue-200',
      starter: 'bg-gray-100 text-gray-800 border-gray-200'
    }
    return variants[normalized] || variants.starter
  }

  return (
    <SuperAdminOnly>
      <div className="min-h-screen bg-background">
        {/* Header */}
        <div className="border-b bg-card">
          <div className="container mx-auto px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Crown className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-foreground">SuperAdmin</h1>
                  <p className="text-sm text-muted-foreground">Gerenciamento de Empresas e Sistema</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" onClick={loadTenantsQuotaData} disabled={quotasLoading}>
                  <RefreshCw className={`h-4 w-4 mr-2 ${quotasLoading ? 'animate-spin' : ''}`} />
                  Atualizar
                </Button>
                <Button className="gap-2" onClick={handleCreateTenant} disabled={loading}>
                  <Plus className="h-4 w-4" />
                  Nova Empresa
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div className="container mx-auto px-6 py-6">
          <Tabs value={selectedTab} onValueChange={setSelectedTab} className="space-y-6">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="overview">Visão Geral</TabsTrigger>
              <TabsTrigger value="tenants">Empresas</TabsTrigger>
              <TabsTrigger value="quotas">Quotas</TabsTrigger>
              <TabsTrigger value="billing">Faturamento</TabsTrigger>
              <TabsTrigger value="settings">Configurações</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-6">
              {/* Stats Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {mockStats.map((stat, index) => (
                  <Card key={index} className="relative overflow-hidden">
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-muted-foreground">{stat.title}</p>
                          <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                          <p className="text-sm text-green-600 flex items-center gap-1 mt-1">
                            <TrendingUp className="h-3 w-3" />
                            {stat.change}
                          </p>
                        </div>
                        <div className={`p-3 rounded-lg bg-primary/10`}>
                          <stat.icon className={`h-6 w-6 ${stat.color}`} />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Recent Activity */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Atividade Recente</CardTitle>
                    <CardDescription>Últimas ações no sistema</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {[
                      { action: 'Novo tenant criado', tenant: 'Delta Corp', time: '2 min atrás' },
                      { action: 'Plano atualizado', tenant: 'Alpha Empresa', time: '15 min atrás' },
                      { action: 'Pagamento processado', tenant: 'Beta Solutions', time: '1h atrás' },
                      { action: 'Tenant suspenso', tenant: 'Gamma Corp', time: '2h atrás' }
                    ].map((activity, index) => (
                      <div key={index} className="flex items-center justify-between py-2">
                        <div>
                          <p className="text-sm font-medium">{activity.action}</p>
                          <p className="text-xs text-muted-foreground">{activity.tenant}</p>
                        </div>
                        <p className="text-xs text-muted-foreground">{activity.time}</p>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Alertas do Sistema</CardTitle>
                    <CardDescription>Itens que precisam de atenção</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {[
                      { type: 'warning', message: '3 tenants próximos do limite de quota', priority: 'Alta' },
                      { type: 'info', message: '12 pagamentos pendentes', priority: 'Média' },
                      { type: 'error', message: '1 tenant com falha na conexão WhatsApp', priority: 'Crítica' },
                      { type: 'success', message: 'Backup do sistema concluído', priority: 'Baixa' }
                    ].map((alert, index) => (
                      <div key={index} className="flex items-start gap-3 py-2">
                        <AlertTriangle className="h-4 w-4 text-yellow-500 mt-0.5" />
                        <div className="flex-1">
                          <p className="text-sm font-medium">{alert.message}</p>
                          <p className="text-xs text-muted-foreground">Prioridade: {alert.priority}</p>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="tenants" className="space-y-6">
              {/* Search and Filters */}
              <div className="flex items-center gap-4">
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar empresas..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Button variant="outline">Filtros</Button>
                <Button onClick={handleCreateTenant} disabled={loading}>
                  <Plus className="h-4 w-4 mr-2" />
                  Nova Empresa
                </Button>
              </div>

              {/* Tenants Table */}
              <Card>
                <CardHeader>
                  <CardTitle>Lista de Empresas</CardTitle>
                  <CardDescription>Gerencie todas as empresas do sistema</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {filteredTenants.map((tenant: any) => (
                      <div key={tenant.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                        <div className="flex items-center gap-4">
                          <div className="p-2 bg-primary/10 rounded-lg">
                            <Building2 className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="font-semibold">{tenant.name}</h3>
                              {selectedTenantId === tenant.id && (
                                <Badge variant="outline" className="border-primary text-primary">Selecionado</Badge>
                              )}
                              <Badge className={getPlanBadge(tenant.plan)}>
                                {(() => {
                                  const p = String(tenant?.plan || 'starter')
                                  return p.charAt(0).toUpperCase() + p.slice(1)
                                })()}
                              </Badge>
                              <Badge className={getStatusBadge(tenant.status)}>{tenant.status}</Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">{tenant.domain || '—'}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-6 text-sm">
                          <div className="text-center">
                            <p className="font-medium">—</p>
                            <p className="text-muted-foreground">Usuários</p>
                          </div>
                          <div className="text-center">
                            <p className="font-medium">—</p>
                            <p className="text-muted-foreground">Campanhas</p>
                          </div>
                          <div className="text-center">
                            <p className="font-medium">—</p>
                            <p className="text-muted-foreground">Receita/mês</p>
                          </div>

                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => navigate(`/superadmin/tenant/${tenant.id}`)}>Ver Detalhes</DropdownMenuItem>
                              <DropdownMenuItem onClick={() => navigate(`/superadmin/tenant/${tenant.id}`)}>Editar</DropdownMenuItem>
                              <DropdownMenuItem onClick={() => navigate(`/superadmin/tenant/${tenant.id}?tab=settings`)}>Configurações</DropdownMenuItem>
                              <DropdownMenuItem onClick={async () => { await switchTenant(tenant.id); navigate('/dashboard') }}>Selecionar contexto</DropdownMenuItem>
                              <DropdownMenuItem className="text-red-600">Suspender</DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="quotas" className="space-y-6">
              {/* Search and Filters */}
              <div className="flex items-center gap-4">
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar tenants..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Button variant="outline" onClick={loadTenantsQuotaData} disabled={quotasLoading}>
                  <RefreshCw className={`h-4 w-4 mr-2 ${quotasLoading ? 'animate-spin' : ''}`} />
                  Atualizar
                </Button>
              </div>

              {/* Quotas Overview */}
              <Card>
                <CardHeader>
                  <CardTitle>Gerenciamento de Quotas</CardTitle>
                  <CardDescription>Monitore e ajuste os limites de recursos das empresas</CardDescription>
                </CardHeader>
                <CardContent>
                  {quotasLoading ? (
                    <div className="text-center py-12">
                      <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground mx-auto mb-4" />
                      <p className="text-muted-foreground">Carregando dados de quotas...</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {filteredQuotaData.map((tenantData) => (
                        <div key={tenantData.tenant_id} className="p-4 border rounded-lg space-y-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="p-2 bg-primary/10 rounded-lg">
                                <Gauge className="h-5 w-5 text-primary" />
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <h3 className="font-semibold">{tenantData.tenant_name}</h3>
                                  <Badge className={getPlanBadge(tenantData.plan)}>
                                    {tenantData.plan.charAt(0).toUpperCase() + tenantData.plan.slice(1)}
                                  </Badge>
                                  <Badge className={getStatusBadge(tenantData.status)}>
                                    {tenantData.status}
                                  </Badge>
                                  {tenantData.alerts_count > 0 && (
                                    <Badge variant="destructive">
                                      {tenantData.alerts_count} alertas
                                    </Badge>
                                  )}
                                </div>
                                <p className="text-sm text-muted-foreground">
                                  Uso geral: {tenantData.usage_percentage}%
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="outline" size="sm">
                                    Aplicar Plano
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent>
                                  <DropdownMenuItem onClick={() => applyDefaultPlan(tenantData.tenant_id, 'starter')}>
                                    Starter
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => applyDefaultPlan(tenantData.tenant_id, 'pro')}>
                                    Pro
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => applyDefaultPlan(tenantData.tenant_id, 'enterprise')}>
                                    Enterprise
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>

                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => openQuotaEditDialog(tenantData.tenant_id)}
                              >
                                <Edit className="h-4 w-4 mr-2" />
                                Editar
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="destructive" size="sm">
                                    Excluir Quotas
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Isso removerá as quotas desta empresa. Você pode recriá-las aplicando um plano padrão depois.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => deleteTenantQuotas(tenantData.tenant_id)}>Excluir</AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </div>

                          {/* Quota Progress Grid */}
                          <QuotaProgressGrid quota={tenantData.quotas} />
                        </div>
                      ))}

                      {filteredQuotaData.length === 0 && (
                        <div className="text-center py-12">
                          <Gauge className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                          <h3 className="text-lg font-semibold mb-2">Nenhum tenant encontrado</h3>
                          <p className="text-muted-foreground">Tente ajustar os filtros de busca</p>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="billing" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Faturamento e Receita</CardTitle>
                  <CardDescription>Visão geral financeira do sistema</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-12">
                    <DollarSign className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2">Módulo de Faturamento</h3>
                    <p className="text-muted-foreground">Em desenvolvimento...</p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="settings" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Configurações do Sistema</CardTitle>
                  <CardDescription>Configurações globais e White Label</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-12">
                    <Settings className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2">Configurações Avançadas</h3>
                    <p className="text-muted-foreground">Em desenvolvimento...</p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Dialog para editar quotas */}
        <Dialog open={isQuotaDialogOpen} onOpenChange={setIsQuotaDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Editar Quotas do Tenant</DialogTitle>
              <DialogDescription>
                Ajuste os limites de recursos para este tenant. Use -1 para ilimitado.
              </DialogDescription>
            </DialogHeader>

            <div className="grid grid-cols-2 gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="max_users">Máximo de Usuários</Label>
                <Input
                  id="max_users"
                  type="number"
                  value={quotaEditForm.max_users}
                  onChange={(e) => setQuotaEditForm(prev => ({
                    ...prev,
                    max_users: parseInt(e.target.value) || 0
                  }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="max_contacts">Máximo de Contatos</Label>
                <Input
                  id="max_contacts"
                  type="number"
                  value={quotaEditForm.max_contacts}
                  onChange={(e) => setQuotaEditForm(prev => ({
                    ...prev,
                    max_contacts: parseInt(e.target.value) || 0
                  }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="max_connections">Conexões WhatsApp</Label>
                <Input
                  id="max_connections"
                  type="number"
                  value={quotaEditForm.max_connections}
                  onChange={(e) => setQuotaEditForm(prev => ({
                    ...prev,
                    max_connections: parseInt(e.target.value) || 0
                  }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="max_message_templates">Templates de Mensagem</Label>
                <Input
                  id="max_message_templates"
                  type="number"
                  value={quotaEditForm.max_message_templates}
                  onChange={(e) => setQuotaEditForm(prev => ({
                    ...prev,
                    max_message_templates: parseInt(e.target.value) || 0
                  }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="max_automations">Máximo de Automações</Label>
                <Input
                  id="max_automations"
                  type="number"
                  value={quotaEditForm.max_automations}
                  onChange={(e) => setQuotaEditForm(prev => ({
                    ...prev,
                    max_automations: parseInt(e.target.value) || 0
                  }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="max_messages_per_month">Mensagens por Mês</Label>
                <Input
                  id="max_messages_per_month"
                  type="number"
                  value={quotaEditForm.max_messages_per_month}
                  onChange={(e) => setQuotaEditForm(prev => ({
                    ...prev,
                    max_messages_per_month: parseInt(e.target.value) || 0
                  }))}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsQuotaDialogOpen(false)}>
                Cancelar
              </Button>
              <Button
                onClick={() => selectedTenantForQuota && updateTenantQuotas(selectedTenantForQuota, quotaEditForm)}
              >
                Salvar Alterações
              </Button>
            </div>
          </DialogContent>
        </Dialog>
        {/* Dialog para criar empresa */}
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Criar Empresa</DialogTitle>
              <DialogDescription>Defina o nome e, opcionalmente, o domínio</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="create-igreja-nome">Nome</Label>
                <Input id="create-empresa-nome" value={createName} onChange={(e) => setCreateName(e.target.value)} placeholder="Ex.: Empresa Central" />
              </div>
              <div>
                <Label htmlFor="create-empresa-dominio">Domínio (opcional)</Label>
                <Input id="create-empresa-dominio" value={createDomain} onChange={(e) => setCreateDomain(e.target.value)} placeholder="Ex.: central.local" />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setCreateDialogOpen(false)} disabled={creating}>Cancelar</Button>
              <Button onClick={submitCreateTenant} disabled={!createName || creating}>Criar</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </SuperAdminOnly>
  )
}
