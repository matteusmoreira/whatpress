import { useState } from 'react'
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
  Shield,
  Activity,
  DollarSign,
  TrendingUp,
  AlertTriangle
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

// Mock data para demonstração
const mockTenants = [
  {
    id: 1,
    name: 'Empresa Alpha',
    domain: 'alpha.whatpress.com',
    plan: 'Enterprise',
    status: 'active',
    users: 45,
    campaigns: 128,
    whatsappConnections: 3,
    monthlyRevenue: 2500,
    createdAt: '2024-01-15',
    lastActivity: '2024-01-20'
  },
  {
    id: 2,
    name: 'Beta Solutions',
    domain: 'beta.whatpress.com',
    plan: 'Professional',
    status: 'active',
    users: 12,
    campaigns: 45,
    whatsappConnections: 1,
    monthlyRevenue: 890,
    createdAt: '2024-01-10',
    lastActivity: '2024-01-19'
  },
  {
    id: 3,
    name: 'Gamma Corp',
    domain: 'gamma.whatpress.com',
    plan: 'Starter',
    status: 'suspended',
    users: 8,
    campaigns: 23,
    whatsappConnections: 1,
    monthlyRevenue: 290,
    createdAt: '2024-01-05',
    lastActivity: '2024-01-18'
  }
]

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

export default function SuperAdmin() {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedTab, setSelectedTab] = useState('overview')

  const filteredTenants = mockTenants.filter(tenant =>
    tenant.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    tenant.domain.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const getStatusBadge = (status: string) => {
    const variants = {
      active: 'bg-green-100 text-green-800 border-green-200',
      suspended: 'bg-red-100 text-red-800 border-red-200',
      pending: 'bg-yellow-100 text-yellow-800 border-yellow-200'
    }
    return variants[status as keyof typeof variants] || variants.active
  }

  const getPlanBadge = (plan: string) => {
    const variants = {
      Enterprise: 'bg-purple-100 text-purple-800 border-purple-200',
      Professional: 'bg-blue-100 text-blue-800 border-blue-200',
      Starter: 'bg-gray-100 text-gray-800 border-gray-200'
    }
    return variants[plan as keyof typeof variants] || variants.Starter
  }

  return (
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
                <p className="text-sm text-muted-foreground">Gerenciamento de Tenants e Sistema</p>
              </div>
            </div>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Novo Tenant
            </Button>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-6 py-6">
        <Tabs value={selectedTab} onValueChange={setSelectedTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Visão Geral</TabsTrigger>
            <TabsTrigger value="tenants">Tenants</TabsTrigger>
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
                  placeholder="Buscar tenants..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Button variant="outline">Filtros</Button>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Novo Tenant
              </Button>
            </div>

            {/* Tenants Table */}
            <Card>
              <CardHeader>
                <CardTitle>Lista de Tenants</CardTitle>
                <CardDescription>Gerencie todos os tenants do sistema</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {filteredTenants.map((tenant) => (
                    <div key={tenant.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                      <div className="flex items-center gap-4">
                        <div className="p-2 bg-primary/10 rounded-lg">
                          <Building2 className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold">{tenant.name}</h3>
                            <Badge className={getPlanBadge(tenant.plan)}>{tenant.plan}</Badge>
                            <Badge className={getStatusBadge(tenant.status)}>{tenant.status}</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">{tenant.domain}</p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-6 text-sm">
                        <div className="text-center">
                          <p className="font-medium">{tenant.users}</p>
                          <p className="text-muted-foreground">Usuários</p>
                        </div>
                        <div className="text-center">
                          <p className="font-medium">{tenant.campaigns}</p>
                          <p className="text-muted-foreground">Campanhas</p>
                        </div>
                        <div className="text-center">
                          <p className="font-medium">R$ {tenant.monthlyRevenue}</p>
                          <p className="text-muted-foreground">Receita/mês</p>
                        </div>
                        
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem>Ver Detalhes</DropdownMenuItem>
                            <DropdownMenuItem>Editar</DropdownMenuItem>
                            <DropdownMenuItem>Configurações</DropdownMenuItem>
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
    </div>
  )
}