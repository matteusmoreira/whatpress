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
import { QuotaGrid, QuotaCompact } from '@/components/ui/quota-progress'
import { useRoles } from '@/hooks/useRoles'
import { RoleGuard } from '@/components/ui/role-guard'
import { Shield, User, Crown, Settings } from 'lucide-react'
import { MultiSessionManager } from '@/components/MultiSessionManager'
import { Shuffle } from 'lucide-react'

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
    loading: rolesLoading, 
    userRoles,
    checkPermission 
  } = useRoles()
  
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
  const runningCampaigns = campaigns.filter(c => c.status === 'running')

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
                    {rolesLoading ? 'Carregando...' : currentRole || 'Não definido'}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                {isSuperAdmin && <Badge variant="destructive">SUPERADMIN</Badge>}
                {isAdmin && <Badge variant="default">ADMIN</Badge>}
                {isUser && <Badge variant="secondary">USER</Badge>}
              </div>
            </div>

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
            {userRoles.length > 0 && (
              <div>
                <h4 className="font-medium mb-2">Tenants do Usuário:</h4>
                <div className="space-y-2">
                  {userRoles.map((role, index) => (
                    <div key={index} className="flex items-center justify-between p-2 border rounded">
                      <div>
                        <p className="font-medium">{role.tenantName}</p>
                        <p className="text-sm text-muted-foreground">Plano: {role.tenantPlan}</p>
                      </div>
                      <Badge variant={
                        role.userRole === 'SUPERADMIN' ? 'destructive' :
                        role.userRole === 'ADMIN' ? 'default' : 'secondary'
                      }>
                        {role.userRole}
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
            <QuotaCompact 
              quotas={{
                max_users: quotaUsage.users.max,
                max_contacts: quotaUsage.contacts.max,
                max_whatsapp_connections: quotaUsage.connections.max,
                max_message_templates: quotaUsage.templates.max,
                max_automations: quotaUsage.automations.max,
                max_monthly_messages: quotaUsage.messages.max,
                current_users: quotaUsage.users.used,
                current_contacts: quotaUsage.contacts.used,
                current_whatsapp_connections: quotaUsage.connections.used,
                current_message_templates: quotaUsage.templates.used,
                current_automations: quotaUsage.automations.used,
                current_monthly_messages: quotaUsage.messages.used,
              }}
            />
          </CardContent>
        </Card>
      )}

      {/* Métricas Principais */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <BarChart3 className="h-8 w-8 text-blue-600" />
              <div>
                <p className="text-2xl font-bold">{metrics.total_campaigns}</p>
                <p className="text-sm text-muted-foreground">Total de Campanhas</p>
                <Badge variant="outline" className="mt-1">
                  {metrics.active_campaigns} ativas
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Send className="h-8 w-8 text-green-600" />
              <div>
                <p className="text-2xl font-bold">{metrics.total_messages_sent.toLocaleString()}</p>
                <p className="text-sm text-muted-foreground">Mensagens Enviadas</p>
                <Badge variant="outline" className="mt-1">
                  {metrics.messages_per_minute.toFixed(1)}/min
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Users className="h-8 w-8 text-purple-600" />
              <div>
                <p className="text-2xl font-bold">{metrics.total_contacts.toLocaleString()}</p>
                <p className="text-sm text-muted-foreground">Contatos Alcançados</p>
                <Badge variant="outline" className="mt-1">
                  {metrics.response_rate.toFixed(1)}% resposta
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Heart className="h-8 w-8 text-red-600" />
              <div>
                <p className="text-2xl font-bold">{metrics.instances_online}/{metrics.total_instances}</p>
                <p className="text-sm text-muted-foreground">Instâncias Online</p>
                <Badge variant="outline" className={`mt-1 ${healthStatus.color}`}>
                  {healthStatus.status}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Status Geral do Sistema */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Gauge className="h-5 w-5" />
            Status do Sistema
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Performance Geral */}
            <div className="space-y-3">
              <h4 className="font-medium">Performance Geral</h4>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>Taxa de Sucesso</span>
                  <span className="font-medium">{metrics.success_rate.toFixed(1)}%</span>
                </div>
                <Progress value={metrics.success_rate} className="h-2" />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span>Taxa de Resposta</span>
                  <span className="font-medium">{metrics.response_rate.toFixed(1)}%</span>
                </div>
                <Progress value={metrics.response_rate} className="h-2" />
              </div>
            </div>

            {/* Configurações Ativas */}
            <div className="space-y-3">
              <h4 className="font-medium">Configurações Ativas</h4>
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span>Perfis de Randomização</span>
                  <Badge variant="outline">{randomizationProfiles.length}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span>Configurações Rate Limit</span>
                  <Badge variant="outline">{rateLimitConfigs.length}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span>Multi-Sessão</span>
                  <Badge variant={instances.length > 1 ? "default" : "secondary"}>
                    {instances.length > 1 ? 'Ativo' : 'Inativo'}
                  </Badge>
                </div>
              </div>
            </div>

            {/* Métricas de Tempo */}
            <div className="space-y-3">
              <h4 className="font-medium">Métricas de Tempo</h4>
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span>Tempo Médio de Resposta</span>
                  <span className="font-medium">{metrics.avg_response_time.toFixed(1)}min</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Velocidade de Envio</span>
                  <span className="font-medium">{metrics.messages_per_minute.toFixed(1)} msg/min</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Uptime do Sistema</span>
                  <span className="font-medium text-green-600">99.8%</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Seção Motor de Campanhas - FASE 2 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Motor de Campanhas Avançado (Fase 2)
          </CardTitle>
          <CardDescription>
            Sistema inteligente de campanhas com multi-sessão e randomização
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Status das campanhas do engine */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 border rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Activity className="h-4 w-4 text-blue-500" />
                  <span className="font-medium">Campanhas Engine</span>
                </div>
                <p className="text-2xl font-bold">{engineCampaigns.length}</p>
                <p className="text-sm text-muted-foreground">
                  {engineCampaigns.filter(c => c.status === 'running').length} ativas
                </p>
              </div>

              <div className="p-4 border rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Network className="h-4 w-4 text-green-500" />
                  <span className="font-medium">Multi-Sessão</span>
                </div>
                <p className="text-2xl font-bold">{instances.length}</p>
                <p className="text-sm text-muted-foreground">
                  {instances.filter(i => i.status === 'connected').length} conectadas
                </p>
              </div>

              <div className="p-4 border rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Shuffle className="h-4 w-4 text-purple-500" />
                  <span className="font-medium">Randomização</span>
                </div>
                <p className="text-2xl font-bold">{randomizationProfiles.length}</p>
                <p className="text-sm text-muted-foreground">
                  perfis ativos
                </p>
              </div>
            </div>

            {/* Funcionalidades da Fase 2 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <h4 className="font-medium">Funcionalidades Ativas</h4>
                <div className="space-y-2">
                  <div className="flex items-center justify-between p-2 border rounded">
                    <span className="text-sm">Motor de Campanhas</span>
                    <Badge variant="default">✅ Ativo</Badge>
                  </div>
                  <div className="flex items-center justify-between p-2 border rounded">
                    <span className="text-sm">Multi-Sessão com Failover</span>
                    <Badge variant={instances.length > 1 ? "default" : "secondary"}>
                      {instances.length > 1 ? '✅ Ativo' : '⚠️ Inativo'}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between p-2 border rounded">
                    <span className="text-sm">Randomização Inteligente</span>
                    <Badge variant={randomizationProfiles.length > 0 ? "default" : "secondary"}>
                      {randomizationProfiles.length > 0 ? '✅ Ativo' : '⚠️ Inativo'}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between p-2 border rounded">
                    <span className="text-sm">Rate Limiting Adaptativo</span>
                    <Badge variant={rateLimitConfigs.length > 0 ? "default" : "secondary"}>
                      {rateLimitConfigs.length > 0 ? '✅ Ativo' : '⚠️ Inativo'}
                    </Badge>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="font-medium">Métricas do Engine</h4>
                <div className="space-y-2">
                  {engineCampaigns.length > 0 ? (
                    engineCampaigns.slice(0, 3).map((campaign, index) => (
                      <div key={index} className="flex items-center justify-between p-2 border rounded">
                        <div>
                          <p className="text-sm font-medium">{campaign.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {campaign.campaign_type} • {campaign.status}
                          </p>
                        </div>
                        <div className="flex gap-1">
                          {campaign.multi_session_enabled && (
                            <Badge variant="outline" className="text-xs">Multi</Badge>
                          )}
                          {campaign.randomization_enabled && (
                            <Badge variant="outline" className="text-xs">Random</Badge>
                          )}
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Nenhuma campanha do engine encontrada
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Seção Multi-Sessão com Failover - FASE 2 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Network className="h-5 w-5" />
            Sistema Multi-Sessão com Failover (Fase 2)
          </CardTitle>
          <CardDescription>
            Gerenciamento inteligente de múltiplas instâncias WhatsApp com failover automático
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Status das instâncias */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="p-4 border rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Network className="h-4 w-4 text-blue-500" />
                  <span className="font-medium">Total Instâncias</span>
                </div>
                <p className="text-2xl font-bold">{instances.length}</p>
                <p className="text-sm text-muted-foreground">configuradas</p>
              </div>

              <div className="p-4 border rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span className="font-medium">Conectadas</span>
                </div>
                <p className="text-2xl font-bold text-green-600">
                  {instances.filter(i => i.status === 'connected').length}
                </p>
                <p className="text-sm text-muted-foreground">online</p>
              </div>

              <div className="p-4 border rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="h-4 w-4 text-yellow-500" />
                  <span className="font-medium">Desconectadas</span>
                </div>
                <p className="text-2xl font-bold text-yellow-600">
                  {instances.filter(i => i.status === 'disconnected').length}
                </p>
                <p className="text-sm text-muted-foreground">offline</p>
              </div>

              <div className="p-4 border rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Heart className="h-4 w-4 text-red-500" />
                  <span className="font-medium">Failover</span>
                </div>
                <p className="text-2xl font-bold">
                  {instances.filter(i => i.failover_enabled).length}
                </p>
                <p className="text-sm text-muted-foreground">habilitado</p>
              </div>
            </div>

            {/* Lista de instâncias */}
            <div className="space-y-3">
              <h4 className="font-medium">Status das Instâncias</h4>
              {instances.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {instances.slice(0, 6).map((instance, index) => (
                    <div key={index} className="p-3 border rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${
                            instance.status === 'connected' ? 'bg-green-500' :
                            instance.status === 'connecting' ? 'bg-yellow-500' : 'bg-red-500'
                          }`} />
                          <span className="font-medium">{instance.name}</span>
                        </div>
                        <div className="flex gap-1">
                          {instance.failover_enabled && (
                            <Badge variant="outline" className="text-xs">Failover</Badge>
                          )}
                          <Badge variant={
                            instance.status === 'connected' ? 'default' :
                            instance.status === 'connecting' ? 'secondary' : 'destructive'
                          } className="text-xs">
                            {instance.status}
                          </Badge>
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground space-y-1">
                        <div className="flex justify-between">
                          <span>Load:</span>
                          <span>{instance.current_load || 0}%</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Prioridade:</span>
                          <span>{instance.priority || 1}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Última verificação:</span>
                          <span>{instance.last_health_check ? 
                            new Date(instance.last_health_check).toLocaleTimeString('pt-BR') : 
                            'N/A'
                          }</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Network className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>Nenhuma instância configurada</p>
                  <p className="text-sm">Configure instâncias WhatsApp para habilitar multi-sessão</p>
                </div>
              )}
            </div>

            {/* Componente MultiSessionManager */}
            <div className="border-t pt-4">
              <h4 className="font-medium mb-3">Gerenciador Multi-Sessão</h4>
              <MultiSessionManager />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs para diferentes visualizações */}
      <Tabs defaultValue="campaigns" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="campaigns">
            <BarChart3 className="w-4 h-4 mr-2" />
            Campanhas
          </TabsTrigger>
          <TabsTrigger value="health">
            <Heart className="w-4 h-4 mr-2" />
            Health Monitor
          </TabsTrigger>
          <TabsTrigger value="activity">
            <Activity className="w-4 h-4 mr-2" />
            Atividade
          </TabsTrigger>
          <TabsTrigger value="analytics">
            <TrendingUp className="w-4 h-4 mr-2" />
            Analytics
          </TabsTrigger>
        </TabsList>

        {/* Campanhas Ativas */}
        <TabsContent value="campaigns" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Lista de Campanhas Ativas */}
            <Card>
              <CardHeader>
                <CardTitle>Campanhas em Execução</CardTitle>
                <CardDescription>
                  {runningCampaigns.length} campanhas ativas no momento
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {runningCampaigns.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <BarChart3 className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p>Nenhuma campanha ativa</p>
                    </div>
                  ) : (
                    runningCampaigns.map((campaign) => (
                      <div 
                        key={campaign.id} 
                        className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                          selectedCampaignId === campaign.id ? 'bg-primary/10 border-primary' : 'hover:bg-muted/50'
                        }`}
                        onClick={() => setSelectedCampaignId(
                          selectedCampaignId === campaign.id ? null : campaign.id
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="font-medium">{campaign.name}</h4>
                            <p className="text-sm text-muted-foreground">
                              {metrics.total_messages_sent || 0} mensagens enviadas
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">
                              {metrics.success_rate.toFixed(0)}%
                            </Badge>
                            <Button variant="ghost" size="sm">
                              <Eye className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                        <Progress 
                          value={metrics.success_rate} 
                          className="mt-2 h-2" 
                        />
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Progresso Detalhado da Campanha Selecionada */}
            <Card>
              <CardHeader>
                <CardTitle>Progresso Detalhado</CardTitle>
                <CardDescription>
                  {selectedCampaignId ? 'Monitoramento em tempo real' : 'Selecione uma campanha para ver detalhes'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {selectedCampaignId ? (
                  <CampaignProgress campaignId={selectedCampaignId} />
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>Selecione uma campanha para ver o progresso detalhado</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Health Monitor */}
        <TabsContent value="health" className="space-y-4">
          <InstanceHealthMonitor />
        </TabsContent>

        {/* Atividade em Tempo Real */}
        <TabsContent value="activity" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Atividade em Tempo Real
              </CardTitle>
              <CardDescription>
                Últimas atividades do sistema
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {realtimeActivity.map((activity) => (
                  <div key={activity.id} className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                    {getActivityIcon(activity.type)}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{activity.message}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        {activity.campaign_name && <span>Campanha: {activity.campaign_name}</span>}
                        {activity.instance_name && <span>Instância: {activity.instance_name}</span>}
                        {activity.contact_name && <span>Contato: {activity.contact_name}</span>}
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(activity.timestamp).toLocaleTimeString('pt-BR')}
                    </div>
                  </div>
                ))}
                
                {realtimeActivity.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>Aguardando atividades...</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Analytics */}
        <TabsContent value="analytics" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Estatísticas Gerais</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-center">
                  <div>
                    <p className="text-2xl font-bold text-blue-600">{metrics.total_messages_sent.toLocaleString()}</p>
                    <p className="text-sm text-muted-foreground">Mensagens Enviadas</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-green-600">{metrics.success_rate.toFixed(1)}%</p>
                    <p className="text-sm text-muted-foreground">Taxa de Sucesso</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-purple-600">{metrics.total_contacts.toLocaleString()}</p>
                    <p className="text-sm text-muted-foreground">Contatos Alcançados</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-orange-600">{metrics.response_rate.toFixed(1)}%</p>
                    <p className="text-sm text-muted-foreground">Taxa de Resposta</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Performance do Sistema</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span>Instâncias Online</span>
                      <span>{metrics.instances_online}/{metrics.total_instances}</span>
                    </div>
                    <Progress 
                      value={metrics.total_instances > 0 ? (metrics.instances_online / metrics.total_instances) * 100 : 0} 
                      className="h-2" 
                    />
                  </div>
                  
                  <div>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span>Campanhas Ativas</span>
                      <span>{metrics.active_campaigns}/{metrics.total_campaigns}</span>
                    </div>
                    <Progress 
                      value={metrics.total_campaigns > 0 ? (metrics.active_campaigns / metrics.total_campaigns) * 100 : 0} 
                      className="h-2" 
                    />
                  </div>
                  
                  <div className="pt-2 border-t">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Tempo Médio de Resposta</span>
                        <p className="font-medium">{metrics.avg_response_time.toFixed(1)} min</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Velocidade de Envio</span>
                        <p className="font-medium">{metrics.messages_per_minute.toFixed(1)} msg/min</p>
                      </div>
                    </div>
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