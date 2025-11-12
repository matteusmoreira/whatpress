import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  Activity,
  BarChart3,
  CheckCircle,
  Clock,
  MessageSquare,
  Send,
  TrendingUp,
  Users,
  Zap,
  AlertTriangle,
  Heart,
  Network,
  Gauge,
  Eye,
  Database
} from 'lucide-react'
import { useCampaigns } from '@/hooks/useCampaigns'
import { useCampaignEngine } from '@/hooks/useCampaignEngine'
import { useMultiSession } from '@/hooks/useMultiSession'
import { useRandomization } from '@/hooks/useRandomization'
import { useRateLimit } from '@/hooks/useRateLimit'
import { useQuotas } from '@/hooks/useQuotas'
import { CampaignProgress } from '@/components/CampaignProgress'
import { InstanceHealthMonitor } from '@/components/InstanceHealthMonitor'
import { QuotaProgressGrid, QuotaProgressCompact } from '@/components/ui/quota-progress'
import { useRoleContext } from '@/contexts/RoleContext'
// import { useTenant } from '@/hooks/useTenant' // Removido: troca de tenant agora é global via Header
import { RoleGuard } from '@/components/ui/role-guard'
import { Shield, User, Crown, Settings } from 'lucide-react'
import { MultiSessionManager } from '@/components/MultiSessionManager'
import { Shuffle } from 'lucide-react'
import { SecurityIndicator } from '@/components/security-indicator'
import { PerformanceMonitor } from '@/components/PerformanceMonitor'

interface DashboardMetrics {
  total_campaigns: number
  active_campaigns: number
  total_messages_sent: number
  total_contacts: number
  success_rate: number
  response_rate: number
  instances_online: number
  total_instances: number
  avg_response_time: number
  messages_per_minute: number
}

interface RealtimeActivity {
  id: string
  type: 'campaign_started' | 'message_sent' | 'message_delivered' | 'contact_replied' | 'instance_connected' | 'instance_disconnected'
  campaign_name?: string
  instance_name?: string
  contact_name?: string
  message: string
  timestamp: string
}

export default function Dashboard() {
  const { campaigns } = useCampaigns()
  const { campaigns: engineCampaigns } = useCampaignEngine()
  const { instances } = useMultiSession()
  const { profiles: randomizationProfiles } = useRandomization()
  const { configs: rateLimitConfigs } = useRateLimit()
  const { quotaUsage, loading: quotasLoading, error: quotasError } = useQuotas()
  const { 
    currentRole, 
    isSuperAdmin, 
    isAdmin, 
    isUser, 
    isLoading,
    userTenants,
    checkPermission
  } = useRoleContext()
  // Seletor de tenant é global via Header; switchTenant removido do Dashboard
  
  const [metrics, setMetrics] = useState<DashboardMetrics>({
    total_campaigns: 0,
    active_campaigns: 0,
    total_messages_sent: 0,
    total_contacts: 0,
    success_rate: 0,
    response_rate: 0,
    instances_online: 0,
    total_instances: 0,
    avg_response_time: 0,
    messages_per_minute: 0
  })
  
  const [realtimeActivity, setRealtimeActivity] = useState<RealtimeActivity[]>([])
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null)
  // Removido: estado local do seletor de tenant (seletor agora é global no Header)

  // Simular métricas do dashboard
  const generateMetrics = (): DashboardMetrics => {
    const activeCampaigns = campaigns.filter(c => c.status === 'running').length
    const onlineInstances = instances.filter(i => i.status === 'connected').length
    
    return {
      total_campaigns: campaigns.length,
      active_campaigns: activeCampaigns,
      total_messages_sent: Math.floor(Math.random() * 50000) + 10000,
      total_contacts: Math.floor(Math.random() * 20000) + 5000,
      success_rate: 85 + Math.random() * 10,
      response_rate: 15 + Math.random() * 20,
      instances_online: onlineInstances,
      total_instances: instances.length,
      avg_response_time: 12 + Math.random() * 8,
      messages_per_minute: 25 + Math.random() * 15
    }
  }

  // Simular atividade em tempo real
  const generateRealtimeActivity = (): RealtimeActivity => {
    const activities = [
      {
        type: 'campaign_started',
        message: 'Nova campanha iniciada',
        campaign_name: campaigns[Math.floor(Math.random() * campaigns.length)]?.name || 'Campanha Teste'
      },
      {
        type: 'message_sent',
        message: 'Mensagem enviada com sucesso',
        campaign_name: campaigns[Math.floor(Math.random() * campaigns.length)]?.name || 'Campanha Teste',
        contact_name: ['João Silva', 'Maria Santos', 'Pedro Costa'][Math.floor(Math.random() * 3)]
      },
      {
        type: 'message_delivered',
        message: 'Mensagem entregue',
        contact_name: ['Ana Oliveira', 'Carlos Lima', 'Lucia Ferreira'][Math.floor(Math.random() * 3)]
      },
      {
        type: 'contact_replied',
        message: 'Contato respondeu à mensagem',
        contact_name: ['Roberto Silva', 'Fernanda Costa', 'Miguel Santos'][Math.floor(Math.random() * 3)]
      },
      {
        type: 'instance_connected',
        message: 'Instância conectada com sucesso',
        instance_name: instances[Math.floor(Math.random() * instances.length)]?.name || 'Instância Principal'
      }
    ]
    
    const activity = activities[Math.floor(Math.random() * activities.length)]
    
    return {
      id: Math.random().toString(36).substr(2, 9),
      type: activity.type as any,
      campaign_name: activity.campaign_name,
      instance_name: activity.instance_name,
      contact_name: activity.contact_name,
      message: activity.message,
      timestamp: new Date().toISOString()
    }
  }

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'campaign_started':
        return <Zap className="h-4 w-4 text-blue-600" />
      case 'message_sent':
        return <Send className="h-4 w-4 text-green-600" />
      case 'message_delivered':
        return <CheckCircle className="h-4 w-4 text-green-600" />
      case 'contact_replied':
        return <MessageSquare className="h-4 w-4 text-purple-600" />
      case 'instance_connected':
        return <Network className="h-4 w-4 text-blue-600" />
      case 'instance_disconnected':
        return <AlertTriangle className="h-4 w-4 text-red-600" />
      default:
        return <Activity className="h-4 w-4 text-gray-600" />
    }
  }

  const getHealthStatus = () => {
    const onlinePercentage = metrics.total_instances > 0 ? 
      (metrics.instances_online / metrics.total_instances) * 100 : 0
    
    if (onlinePercentage >= 80) return { status: 'Saudável', color: 'text-green-600', bg: 'bg-green-500' }
    if (onlinePercentage >= 60) return { status: 'Atenção', color: 'text-yellow-600', bg: 'bg-yellow-500' }
    return { status: 'Crítico', color: 'text-red-600', bg: 'bg-red-500' }
  }

  useEffect(() => {
    setMetrics(generateMetrics())
    
    // Simular atividade em tempo real
    const interval = setInterval(() => {
      setMetrics(generateMetrics())
      
      // Adicionar nova atividade ocasionalmente
      if (Math.random() > 0.6) {
        const newActivity = generateRealtimeActivity()
        setRealtimeActivity(prev => [newActivity, ...prev.slice(0, 19)]) // Manter apenas 20 atividades
      }
    }, 5000)

    return () => clearInterval(interval)
  }, [campaigns, instances])

  const healthStatus = getHealthStatus()
  const runningCampaigns = Array.isArray(campaigns) ? campaigns.filter(c => c.status === 'running') : []

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard Inteligente</h1>
        <p className="text-muted-foreground">
          Monitoramento em tempo real das campanhas e instâncias WhatsApp
        </p>
      </div>

      {/* Seção de Roles - FASE 1 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Sistema de Roles (Fase 1)
          </CardTitle>
          <CardDescription>
            Validação do sistema de permissões e roles
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Status do usuário atual */}
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center gap-3">
                {isSuperAdmin && <Crown className="h-5 w-5 text-yellow-500" />}
                {isAdmin && !isSuperAdmin && <Settings className="h-5 w-5 text-blue-500" />}
                {isUser && !isAdmin && !isSuperAdmin && <User className="h-5 w-5 text-green-500" />}
                <div>
                  <p className="font-medium">Role Atual</p>
                  <p className="text-sm text-muted-foreground">
                    {isLoading ? 'Carregando...' : currentRole || 'Não definido'}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                {isSuperAdmin && <Badge variant="destructive">SUPERADMIN</Badge>}
                {isAdmin && <Badge variant="default">ADMIN</Badge>}
                {isUser && <Badge variant="secondary">USER</Badge>}
              </div>
            </div>

            {/* Seletor de Tenant movido para o Header para evitar duplicidade */}

            {/* Testes de permissões por role */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Teste SUPERADMIN */}
              <RoleGuard requiredRole="SUPERADMIN" showFallback={false}>
                <div className="p-3 border border-yellow-200 rounded-lg bg-yellow-50 dark:bg-yellow-950">
                  <div className="flex items-center gap-2 mb-2">
                    <Crown className="h-4 w-4 text-yellow-600" />
                    <span className="font-medium text-yellow-800 dark:text-yellow-200">SUPERADMIN</span>
                  </div>
                  <p className="text-sm text-yellow-700 dark:text-yellow-300">
                    ✅ Acesso total ao sistema
                  </p>
                </div>
              </RoleGuard>

              {/* Teste ADMIN */}
              <RoleGuard requiredRole="ADMIN" showFallback={false}>
                <div className="p-3 border border-blue-200 rounded-lg bg-blue-50 dark:bg-blue-950">
                  <div className="flex items-center gap-2 mb-2">
                    <Settings className="h-4 w-4 text-blue-600" />
                    <span className="font-medium text-blue-800 dark:text-blue-200">ADMIN</span>
                  </div>
                  <p className="text-sm text-blue-700 dark:text-blue-300">
                    ✅ Gerenciamento do tenant
                  </p>
                </div>
              </RoleGuard>

              {/* Teste USER */}
              <RoleGuard requiredRole="USER" showFallback={false}>
                <div className="p-3 border border-green-200 rounded-lg bg-green-50 dark:bg-green-950">
                  <div className="flex items-center gap-2 mb-2">
                    <User className="h-4 w-4 text-green-600" />
                    <span className="font-medium text-green-800 dark:text-green-200">USER</span>
                  </div>
                  <p className="text-sm text-green-700 dark:text-green-300">
                    ✅ Acesso básico
                  </p>
                </div>
              </RoleGuard>
            </div>

            {/* Lista de tenants do usuário */}
            {userTenants && userTenants.length > 0 && (
              <div>
                <h4 className="font-medium mb-2">Tenants do Usuário:</h4>
                <div className="space-y-2">
                  {userTenants.map((role, index) => (
                    <div key={index} className="flex items-center justify-between p-2 border rounded">
                      <div>
                        <p className="font-medium">{role.tenant_name}</p>
                        <p className="text-sm text-muted-foreground">Plano: {role.tenant_plan}</p>
                      </div>
                      <Badge variant={
                        role.user_role === 'SUPERADMIN' ? 'destructive' :
                        role.user_role === 'ADMIN' ? 'default' : 'secondary'
                      }>
                        {role.user_role}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Seção de Quotas - FASE 1 */}
      {quotaUsage && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Status das Quotas (Fase 1)
            </CardTitle>
            <CardDescription>
              Monitoramento dos limites de recursos do seu tenant
            </CardDescription>
          </CardHeader>
          <CardContent>
            <QuotaProgressCompact 
              quota={{
                max_users: quotaUsage.users.max,
                max_contacts: quotaUsage.contacts.max,
                max_campaigns: quotaUsage.connections.max,
                max_connections: quotaUsage.templates.max,
                current_users: quotaUsage.users.used,
                current_contacts: quotaUsage.contacts.used,
                current_campaigns: quotaUsage.connections.used,
                current_connections: quotaUsage.templates.used,
                alert_threshold_warning: 85,
                alert_threshold_critical: 95
              }}
            />
          </CardContent>
        </Card>
      )}

      {/* Indicador de Segurança */}
      <SecurityIndicator />

      {/* Seção de Instâncias */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Network className="h-5 w-5" />
            Instâncias WhatsApp
          </CardTitle>
          <CardDescription>
            Monitoramento de conexões e status das instâncias
          </CardDescription>
        </CardHeader>
        <CardContent>
          <InstanceHealthMonitor instances={instances} />
        </CardContent>
      </Card>

      {/* Seção de Campanhas Ativas */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Campanhas Ativas
          </CardTitle>
          <CardDescription>
            Status em tempo real das campanhas em execução
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {runningCampaigns.length === 0 ? (
              <p className="text-muted-foreground">Nenhuma campanha ativa no momento.</p>
            ) : (
              runningCampaigns.map(campaign => (
                <CampaignProgress key={campaign.id} campaign={campaign} />
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Simulador de Fluxo */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Gauge className="h-5 w-5" />
            Simulador de Fluxo em Tempo Real
          </CardTitle>
          <CardDescription>
            Monitoramento de execução de mensagens
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="overview" className="w-full">
            <TabsList>
              <TabsTrigger value="overview" className="flex items-center gap-2">
                <Eye className="h-4 w-4" /> Visão geral
              </TabsTrigger>
              <TabsTrigger value="details" className="flex items-center gap-2">
                <Users className="h-4 w-4" /> Detalhes
              </TabsTrigger>
              <TabsTrigger value="randomization" className="flex items-center gap-2">
                <Shuffle className="h-4 w-4" /> Randomização
              </TabsTrigger>
              <TabsTrigger value="performance" className="flex items-center gap-2">
                <Gauge className="h-4 w-4" /> Performance
              </TabsTrigger>
            </TabsList>
            <TabsContent value="overview" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Heart className="h-5 w-5" />
                      Saúde do Sistema
                    </CardTitle>
                    <CardDescription>
                      Status das instâncias e desempenho geral
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        {getActivityIcon('instance_connected')}
                        <span className={`font-medium ${healthStatus.color}`}>{healthStatus.status}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-gray-600" />
                        <span className="text-sm text-muted-foreground">Tempo médio de resposta: {metrics.avg_response_time.toFixed(1)}s</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Activity className="h-4 w-4 text-gray-600" />
                        <span className="text-sm text-muted-foreground">Mensagens por minuto: {metrics.messages_per_minute.toFixed(0)}</span>
                      </div>
                    </div>
                    <div className="mt-4">
                      <Progress value={Math.min(100, (metrics.success_rate))} className="h-2" />
                      <div className="flex justify-between text-xs text-muted-foreground mt-1">
                        <span>Taxa de sucesso: {metrics.success_rate.toFixed(1)}%</span>
                        <span>Taxa de resposta: {metrics.response_rate.toFixed(1)}%</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <TrendingUp className="h-5 w-5" />
                      Métricas
                    </CardTitle>
                    <CardDescription>
                      Visão geral das campanhas e contatos
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Campanhas ativas</p>
                        <p className="text-2xl font-bold">{metrics.active_campaigns}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Instâncias online</p>
                        <p className="text-2xl font-bold">{metrics.instances_online}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Contatos</p>
                        <p className="text-2xl font-bold">{metrics.total_contacts}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Mensagens enviadas</p>
                        <p className="text-2xl font-bold">{metrics.total_messages_sent}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Gauge className="h-5 w-5" />
                      Instâncias
                    </CardTitle>
                    <CardDescription>
                      Status das conexões
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span>Online</span>
                        <Badge variant="secondary">{metrics.instances_online}/{metrics.total_instances}</Badge>
                      </div>
                      <div className="flex justify-between">
                        <span>Tempo médio de resposta</span>
                        <Badge variant="secondary">{metrics.avg_response_time.toFixed(1)}s</Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
              <div>
                <h4 className="font-medium mb-2">Atividade em tempo real</h4>
                <div className="space-y-2">
                  {realtimeActivity.map((activity) => (
                    <div key={activity.id} className="flex items-center justify-between p-2 border rounded">
                      <div className="flex items-center gap-2">
                        {getActivityIcon(activity.type)}
                        <p className="text-sm">{activity.message}</p>
                      </div>
                      <p className="text-xs text-muted-foreground">{new Date(activity.timestamp).toLocaleTimeString()}</p>
                    </div>
                  ))}
                </div>
              </div>
            </TabsContent>
            <TabsContent value="performance" className="space-y-4">
              <PerformanceMonitor />
            </TabsContent>
            <TabsContent value="details">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <MessageSquare className="h-5 w-5" />
                      Campanhas
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {Array.isArray(campaigns) && campaigns.map(c => (
                        <div key={c.id} className="flex items-center justify-between p-2 border rounded">
                          <div>
                            <p className="font-medium">{c.name}</p>
                            <p className="text-xs text-muted-foreground">Status: {c.status}</p>
                          </div>
                          <Badge>{c.status === 'running' ? 'Ativa' : 'Pausada'}</Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Users className="h-5 w-5" />
                      Instâncias
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {Array.isArray(instances) && instances.map(i => (
                        <div key={i.id} className="flex items-center justify-between p-2 border rounded">
                          <div>
                            <p className="font-medium">{i.name}</p>
                            <p className="text-xs text-muted-foreground">Status: {i.status}</p>
                          </div>
                          <Badge>{i.status === 'connected' ? 'Conectada' : 'Desconectada'}</Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
            <TabsContent value="randomization">
              <div className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Shuffle className="h-5 w-5" />
                      Perfis de Randomização
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {Array.isArray(randomizationProfiles) && randomizationProfiles.map(p => (
                        <div key={p.id} className="flex items-center justify-between p-2 border rounded">
                          <div>
                            <p className="font-medium">{p.name}</p>
                            <p className="text-xs text-muted-foreground">Ativo: {p.active ? 'Sim' : 'Não'}</p>
                          </div>
                          <Badge>{p.active ? 'Ativo' : 'Inativo'}</Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Settings className="h-5 w-5" />
                      Configurações de Rate Limit
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {Array.isArray(rateLimitConfigs) && rateLimitConfigs.map(c => (
                        <div key={c.id} className="flex items-center justify-between p-2 border rounded">
                          <div>
                            <p className="font-medium">{c.name}</p>
                            <p className="text-xs text-muted-foreground">Limite: {c.limit}/min</p>
                          </div>
                          <Badge>{c.active ? 'Ativa' : 'Inativa'}</Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Gestor de múltiplas sessões */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Network className="h-5 w-5" />
            Gestor de Múltiplas Sessões
          </CardTitle>
          <CardDescription>
            Conecte e gerencie várias instâncias simultaneamente
          </CardDescription>
        </CardHeader>
        <CardContent>
          <MultiSessionManager />
        </CardContent>
      </Card>
    </div>
  )
}
