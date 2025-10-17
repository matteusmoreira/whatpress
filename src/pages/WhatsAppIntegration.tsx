import { useState } from 'react'
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
import { Progress } from '@/components/ui/progress'
import { Switch } from '@/components/ui/switch'
import {
  MessageSquare,
  Smartphone,
  Settings,
  CheckCircle,
  AlertCircle,
  Clock,
  Zap,
  Shield,
  Globe,
  Key,
  Webhook,
  Database,
  Activity,
  Users,
  BarChart3,
  RefreshCw,
  Plus,
  Edit,
  Trash2,
  Copy,
  Eye,
  EyeOff,
  Download,
  Upload,
  Link,
  Unlink
} from 'lucide-react'

// Mock data para demonstração
const mockInstances = [
  {
    id: '1',
    name: 'Instância Principal',
    phoneNumber: '+55 11 99999-9999',
    status: 'connected',
    qrCode: null,
    lastActivity: '2024-01-15 14:30',
    messagesCount: 1250,
    webhookUrl: 'https://api.exemplo.com/webhook/whatsapp',
    apiKey: 'wa_live_abc123...',
    businessAccountId: 'BA123456789',
    appId: 'APP987654321'
  },
  {
    id: '2',
    name: 'Instância Teste',
    phoneNumber: '+55 11 88888-8888',
    status: 'disconnected',
    qrCode: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
    lastActivity: '2024-01-14 09:15',
    messagesCount: 45,
    webhookUrl: 'https://api.exemplo.com/webhook/test',
    apiKey: 'wa_test_xyz789...',
    businessAccountId: 'BA987654321',
    appId: 'APP123456789'
  }
]

const mockWebhooks = [
  {
    id: '1',
    name: 'Webhook Principal',
    url: 'https://api.exemplo.com/webhook/messages',
    events: ['message', 'status', 'delivery'],
    status: 'active',
    lastTrigger: '2024-01-15 14:25',
    successRate: 98.5
  },
  {
    id: '2',
    name: 'Webhook Backup',
    url: 'https://backup.exemplo.com/webhook',
    events: ['message'],
    status: 'inactive',
    lastTrigger: '2024-01-10 11:30',
    successRate: 95.2
  }
]

export default function WhatsAppIntegration() {
  const navigate = useNavigate()
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showWebhookDialog, setShowWebhookDialog] = useState(false)
  const [showApiKeyDialog, setShowApiKeyDialog] = useState(false)
  const [selectedInstance, setSelectedInstance] = useState<string>('')
  const [showApiKey, setShowApiKey] = useState<{[key: string]: boolean}>({})
  const [newInstance, setNewInstance] = useState({
    name: '',
    phoneNumber: '',
    businessAccountId: '',
    appId: '',
    accessToken: ''
  })
  const [newWebhook, setNewWebhook] = useState({
    name: '',
    url: '',
    events: [] as string[],
    secret: ''
  })

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'connected': return 'bg-green-500'
      case 'connecting': return 'bg-yellow-500'
      case 'disconnected': return 'bg-red-500'
      default: return 'bg-gray-500'
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'connected': return 'Conectado'
      case 'connecting': return 'Conectando'
      case 'disconnected': return 'Desconectado'
      default: return 'Desconhecido'
    }
  }

  const toggleApiKeyVisibility = (instanceId: string) => {
    setShowApiKey(prev => ({
      ...prev,
      [instanceId]: !prev[instanceId]
    }))
  }

  const handleCreateInstance = () => {
    console.log('Criando nova instância:', newInstance)
    setShowCreateDialog(false)
    setNewInstance({
      name: '',
      phoneNumber: '',
      businessAccountId: '',
      appId: '',
      accessToken: ''
    })
  }

  const handleCreateWebhook = () => {
    console.log('Criando novo webhook:', newWebhook)
    setShowWebhookDialog(false)
    setNewWebhook({
      name: '',
      url: '',
      events: [],
      secret: ''
    })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Integração WhatsApp</h1>
          <p className="text-muted-foreground">
            Gerencie suas conexões e configurações do WhatsApp Business API
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" className="gap-2">
            <Download className="h-4 w-4" />
            Exportar Config
          </Button>
          <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Nova Instância
              </Button>
            </DialogTrigger>
          </Dialog>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Instâncias Ativas</CardTitle>
            <Smartphone className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">1</div>
            <p className="text-xs text-muted-foreground">
              +0% em relação ao mês passado
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Mensagens Hoje</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">1,295</div>
            <p className="text-xs text-muted-foreground">
              +12% em relação a ontem
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Taxa de Entrega</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">98.5%</div>
            <p className="text-xs text-muted-foreground">
              +0.2% em relação a ontem
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Webhooks Ativos</CardTitle>
            <Webhook className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">1</div>
            <p className="text-xs text-muted-foreground">
              100% de disponibilidade
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs defaultValue="instances" className="space-y-4">
        <TabsList>
          <TabsTrigger value="instances">Instâncias</TabsTrigger>
          <TabsTrigger value="webhooks">Webhooks</TabsTrigger>
          <TabsTrigger value="api-keys">Chaves API</TabsTrigger>
          <TabsTrigger value="settings">Configurações</TabsTrigger>
        </TabsList>

        {/* Instâncias Tab */}
        <TabsContent value="instances" className="space-y-4">
          <div className="grid gap-4">
            {mockInstances.map((instance) => (
              <Card key={instance.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-3 h-3 rounded-full ${getStatusColor(instance.status)}`} />
                      <div>
                        <CardTitle className="text-lg">{instance.name}</CardTitle>
                        <CardDescription>{instance.phoneNumber}</CardDescription>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={instance.status === 'connected' ? 'default' : 'secondary'}>
                        {getStatusText(instance.status)}
                      </Badge>
                      <Button variant="outline" size="sm" className="gap-2">
                        <Settings className="h-4 w-4" />
                        Configurar
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    <div>
                      <Label className="text-sm text-muted-foreground">Última Atividade</Label>
                      <p className="text-sm font-medium">{instance.lastActivity}</p>
                    </div>
                    <div>
                      <Label className="text-sm text-muted-foreground">Mensagens Enviadas</Label>
                      <p className="text-sm font-medium">{instance.messagesCount.toLocaleString()}</p>
                    </div>
                    <div>
                      <Label className="text-sm text-muted-foreground">Business Account ID</Label>
                      <p className="text-sm font-medium">{instance.businessAccountId}</p>
                    </div>
                    <div>
                      <Label className="text-sm text-muted-foreground">App ID</Label>
                      <p className="text-sm font-medium">{instance.appId}</p>
                    </div>
                  </div>

                  {instance.status === 'disconnected' && instance.qrCode && (
                    <div className="border rounded-lg p-4 bg-muted/50">
                      <div className="flex items-center gap-4">
                        <div className="w-32 h-32 bg-white rounded-lg flex items-center justify-center">
                          <img src={instance.qrCode} alt="QR Code" className="w-28 h-28" />
                        </div>
                        <div className="flex-1">
                          <h4 className="font-medium mb-2">Escaneie o QR Code</h4>
                          <p className="text-sm text-muted-foreground mb-4">
                            Abra o WhatsApp no seu telefone e escaneie este código para conectar a instância.
                          </p>
                          <Button variant="outline" size="sm" className="gap-2">
                            <RefreshCw className="h-4 w-4" />
                            Atualizar QR Code
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-4 border-t">
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" className="gap-2">
                        <Activity className="h-4 w-4" />
                        Logs
                      </Button>
                      <Button variant="outline" size="sm" className="gap-2">
                        <BarChart3 className="h-4 w-4" />
                        Métricas
                      </Button>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" className="gap-2">
                        <Edit className="h-4 w-4" />
                        Editar
                      </Button>
                      <Button variant="outline" size="sm" className="gap-2 text-destructive">
                        <Trash2 className="h-4 w-4" />
                        Excluir
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Webhooks Tab */}
        <TabsContent value="webhooks" className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-medium">Webhooks Configurados</h3>
              <p className="text-sm text-muted-foreground">
                Gerencie os endpoints que recebem eventos do WhatsApp
              </p>
            </div>
            <Dialog open={showWebhookDialog} onOpenChange={setShowWebhookDialog}>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <Plus className="h-4 w-4" />
                  Novo Webhook
                </Button>
              </DialogTrigger>
            </Dialog>
          </div>

          <div className="grid gap-4">
            {mockWebhooks.map((webhook) => (
              <Card key={webhook.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg">{webhook.name}</CardTitle>
                      <CardDescription>{webhook.url}</CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={webhook.status === 'active' ? 'default' : 'secondary'}>
                        {webhook.status === 'active' ? 'Ativo' : 'Inativo'}
                      </Badge>
                      <Switch checked={webhook.status === 'active'} />
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-3">
                    <div>
                      <Label className="text-sm text-muted-foreground">Eventos</Label>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {webhook.events.map((event) => (
                          <Badge key={event} variant="outline" className="text-xs">
                            {event}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <div>
                      <Label className="text-sm text-muted-foreground">Último Trigger</Label>
                      <p className="text-sm font-medium">{webhook.lastTrigger}</p>
                    </div>
                    <div>
                      <Label className="text-sm text-muted-foreground">Taxa de Sucesso</Label>
                      <div className="flex items-center gap-2">
                        <Progress value={webhook.successRate} className="flex-1" />
                        <span className="text-sm font-medium">{webhook.successRate}%</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t">
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" className="gap-2">
                        <Activity className="h-4 w-4" />
                        Logs
                      </Button>
                      <Button variant="outline" size="sm" className="gap-2">
                        <Zap className="h-4 w-4" />
                        Testar
                      </Button>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" className="gap-2">
                        <Edit className="h-4 w-4" />
                        Editar
                      </Button>
                      <Button variant="outline" size="sm" className="gap-2 text-destructive">
                        <Trash2 className="h-4 w-4" />
                        Excluir
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* API Keys Tab */}
        <TabsContent value="api-keys" className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-medium">Chaves de API</h3>
              <p className="text-sm text-muted-foreground">
                Gerencie as chaves de acesso para integração com WhatsApp Business API
              </p>
            </div>
            <Dialog open={showApiKeyDialog} onOpenChange={setShowApiKeyDialog}>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <Plus className="h-4 w-4" />
                  Nova Chave
                </Button>
              </DialogTrigger>
            </Dialog>
          </div>

          <div className="grid gap-4">
            {mockInstances.map((instance) => (
              <Card key={instance.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg">{instance.name}</CardTitle>
                      <CardDescription>Chave de API para {instance.phoneNumber}</CardDescription>
                    </div>
                    <Badge variant="outline">
                      <Key className="h-3 w-3 mr-1" />
                      API Key
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Chave de API</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        type={showApiKey[instance.id] ? 'text' : 'password'}
                        value={instance.apiKey}
                        readOnly
                        className="font-mono"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => toggleApiKeyVisibility(instance.id)}
                      >
                        {showApiKey[instance.id] ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>
                      <Button variant="outline" size="sm" className="gap-2">
                        <Copy className="h-4 w-4" />
                        Copiar
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Webhook URL</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        value={instance.webhookUrl}
                        readOnly
                        className="font-mono"
                      />
                      <Button variant="outline" size="sm" className="gap-2">
                        <Copy className="h-4 w-4" />
                        Copiar
                      </Button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t">
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" className="gap-2">
                        <RefreshCw className="h-4 w-4" />
                        Regenerar
                      </Button>
                      <Button variant="outline" size="sm" className="gap-2">
                        <Download className="h-4 w-4" />
                        Baixar Config
                      </Button>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" className="gap-2">
                        <Shield className="h-4 w-4" />
                        Permissões
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings" className="space-y-4">
          <div className="grid gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Configurações Gerais</CardTitle>
                <CardDescription>
                  Configure as opções globais de integração com WhatsApp
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Auto-reconexão</Label>
                    <p className="text-sm text-muted-foreground">
                      Reconectar automaticamente em caso de desconexão
                    </p>
                  </div>
                  <Switch defaultChecked />
                </div>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Logs detalhados</Label>
                    <p className="text-sm text-muted-foreground">
                      Registrar informações detalhadas de debug
                    </p>
                  </div>
                  <Switch />
                </div>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Notificações de status</Label>
                    <p className="text-sm text-muted-foreground">
                      Receber notificações sobre mudanças de status
                    </p>
                  </div>
                  <Switch defaultChecked />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Limites e Quotas</CardTitle>
                <CardDescription>
                  Configure os limites de uso da API
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Mensagens por minuto</Label>
                  <Input type="number" defaultValue="60" />
                </div>
                <div className="space-y-2">
                  <Label>Timeout de conexão (segundos)</Label>
                  <Input type="number" defaultValue="30" />
                </div>
                <div className="space-y-2">
                  <Label>Tentativas de reenvio</Label>
                  <Input type="number" defaultValue="3" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Segurança</CardTitle>
                <CardDescription>
                  Configure as opções de segurança
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>IPs permitidos</Label>
                  <Textarea 
                    placeholder="Digite os IPs permitidos, um por linha"
                    defaultValue="192.168.1.0/24&#10;10.0.0.0/8"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Verificação SSL</Label>
                    <p className="text-sm text-muted-foreground">
                      Verificar certificados SSL em webhooks
                    </p>
                  </div>
                  <Switch defaultChecked />
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Create Instance Dialog */}
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Nova Instância WhatsApp</DialogTitle>
          <DialogDescription>
            Configure uma nova instância do WhatsApp Business API
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="instance-name">Nome da Instância</Label>
            <Input
              id="instance-name"
              placeholder="Ex: Instância Principal"
              value={newInstance.name}
              onChange={(e) => setNewInstance(prev => ({ ...prev, name: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone-number">Número de Telefone</Label>
            <Input
              id="phone-number"
              placeholder="+55 11 99999-9999"
              value={newInstance.phoneNumber}
              onChange={(e) => setNewInstance(prev => ({ ...prev, phoneNumber: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="business-account-id">Business Account ID</Label>
            <Input
              id="business-account-id"
              placeholder="BA123456789"
              value={newInstance.businessAccountId}
              onChange={(e) => setNewInstance(prev => ({ ...prev, businessAccountId: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="app-id">App ID</Label>
            <Input
              id="app-id"
              placeholder="APP987654321"
              value={newInstance.appId}
              onChange={(e) => setNewInstance(prev => ({ ...prev, appId: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="access-token">Access Token</Label>
            <Input
              id="access-token"
              type="password"
              placeholder="EAAxxxxxxxxxxxxxxx"
              value={newInstance.accessToken}
              onChange={(e) => setNewInstance(prev => ({ ...prev, accessToken: e.target.value }))}
            />
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreateInstance}>
              Criar Instância
            </Button>
          </div>
        </div>
      </DialogContent>

      {/* Create Webhook Dialog */}
      <Dialog open={showWebhookDialog} onOpenChange={setShowWebhookDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo Webhook</DialogTitle>
            <DialogDescription>
              Configure um novo endpoint para receber eventos
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="webhook-name">Nome do Webhook</Label>
              <Input
                id="webhook-name"
                placeholder="Ex: Webhook Principal"
                value={newWebhook.name}
                onChange={(e) => setNewWebhook(prev => ({ ...prev, name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="webhook-url">URL do Endpoint</Label>
              <Input
                id="webhook-url"
                placeholder="https://api.exemplo.com/webhook"
                value={newWebhook.url}
                onChange={(e) => setNewWebhook(prev => ({ ...prev, url: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="webhook-secret">Secret (Opcional)</Label>
              <Input
                id="webhook-secret"
                type="password"
                placeholder="Chave secreta para validação"
                value={newWebhook.secret}
                onChange={(e) => setNewWebhook(prev => ({ ...prev, secret: e.target.value }))}
              />
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setShowWebhookDialog(false)}>
                Cancelar
              </Button>
              <Button onClick={handleCreateWebhook}>
                Criar Webhook
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}