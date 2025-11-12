import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { 
  Settings as SettingsIcon, 
  User, 
  Bell, 
  Shield, 
  CreditCard, 
  Palette, 
  Smartphone,
  Key,
  Database,
  Crown,
  Eye,
  EyeOff,
  Save,
  RefreshCw,
  Download,
  Upload,
  Trash2
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

export default function Settings() {
  const { toast } = useToast()
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)

  // Estados para as configurações
  const [profile, setProfile] = useState({
    name: 'João Silva',
    email: 'joao@empresa.com',
    phone: '+55 11 99999-9999',
    company: 'Minha Empresa LTDA',
    position: 'Gerente de Marketing',
    avatar: '',
    timezone: 'America/Sao_Paulo',
    language: 'pt-BR'
  })

  const [notifications, setNotifications] = useState({
    email: true,
    push: true,
    sms: false,
    marketing: true,
    newMessages: true,
    campaignUpdates: true,
    systemAlerts: true,
    weeklyReports: false
  })

  const [security, setSecurity] = useState({
    twoFactor: false,
    sessionTimeout: '30',
    passwordExpiry: '90',
    loginAlerts: true,
    apiAccess: true
  })

  const [billing, setBilling] = useState({
    plan: 'Pro',
    billingCycle: 'monthly',
    autoRenew: true,
    invoiceEmail: 'financeiro@empresa.com',
    paymentMethod: 'card'
  })

  const [whatsapp, setWhatsapp] = useState({
    defaultInstance: 'principal',
    autoReconnect: true,
    messageDelay: '1000',
    maxRetries: '3',
    webhookUrl: 'https://meusite.com/webhook',
    webhookSecret: '••••••••••••••••'
  })

  const [appearance, setAppearance] = useState({
    theme: 'system',
    primaryColor: 'blue',
    fontSize: 'medium',
    compactMode: false,
    animations: true
  })

  const handleSave = async (section: string) => {
    setLoading(true)
    try {
      // Simular salvamento
      await new Promise(resolve => setTimeout(resolve, 1000))
      toast({
        title: "Configurações salvas",
        description: `As configurações de ${section} foram atualizadas com sucesso.`,
      })
    } catch (error) {
      toast({
        title: "Erro ao salvar",
        description: "Ocorreu um erro ao salvar as configurações.",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const handleExportData = () => {
    toast({
      title: "Exportação iniciada",
      description: "Seus dados estão sendo preparados para download.",
    })
  }

  const handleDeleteAccount = () => {
    toast({
      title: "Ação não permitida",
      description: "Entre em contato com o suporte para excluir sua conta.",
      variant: "destructive"
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <SettingsIcon className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold">Configurações</h1>
          <p className="text-muted-foreground">
            Gerencie suas preferências e configurações da conta
          </p>
        </div>
      </div>

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="profile" className="flex items-center gap-2">
            <User className="h-4 w-4" />
            Perfil
          </TabsTrigger>
          <TabsTrigger value="notifications" className="flex items-center gap-2">
            <Bell className="h-4 w-4" />
            Notificações
          </TabsTrigger>
          <TabsTrigger value="security" className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Segurança
          </TabsTrigger>
          <TabsTrigger value="billing" className="flex items-center gap-2">
            <CreditCard className="h-4 w-4" />
            Cobrança
          </TabsTrigger>
          <TabsTrigger value="whatsapp" className="flex items-center gap-2">
            <Smartphone className="h-4 w-4" />
            WhatsApp
          </TabsTrigger>
          <TabsTrigger value="appearance" className="flex items-center gap-2">
            <Palette className="h-4 w-4" />
            Aparência
          </TabsTrigger>
        </TabsList>

        {/* Perfil */}
        <TabsContent value="profile" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Informações Pessoais
              </CardTitle>
              <CardDescription>
                Atualize suas informações pessoais e de contato
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center gap-6">
                <Avatar className="h-20 w-20">
                  <AvatarImage src={profile.avatar} />
                  <AvatarFallback className="text-lg">
                    {profile.name.split(' ').map(n => n[0]).join('')}
                  </AvatarFallback>
                </Avatar>
                <div className="space-y-2">
                  <Button variant="outline" size="sm">
                    <Upload className="h-4 w-4 mr-2" />
                    Alterar Foto
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    JPG, PNG ou GIF. Máximo 2MB.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome Completo</Label>
                  <Input
                    id="name"
                    value={profile.name}
                    onChange={(e) => setProfile(prev => ({ ...prev, name: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={profile.email}
                    onChange={(e) => setProfile(prev => ({ ...prev, email: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Telefone</Label>
                  <Input
                    id="phone"
                    value={profile.phone}
                    onChange={(e) => setProfile(prev => ({ ...prev, phone: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="company">Empresa</Label>
                  <Input
                    id="company"
                    value={profile.company}
                    onChange={(e) => setProfile(prev => ({ ...prev, company: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="position">Cargo</Label>
                  <Input
                    id="position"
                    value={profile.position}
                    onChange={(e) => setProfile(prev => ({ ...prev, position: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="timezone">Fuso Horário</Label>
                  <Select value={profile.timezone} onValueChange={(value) => setProfile(prev => ({ ...prev, timezone: value }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="America/Sao_Paulo">São Paulo (GMT-3)</SelectItem>
                      <SelectItem value="America/New_York">Nova York (GMT-5)</SelectItem>
                      <SelectItem value="Europe/London">Londres (GMT+0)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex justify-end">
                <Button onClick={() => handleSave('perfil')} disabled={loading}>
                  {loading ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                  Salvar Alterações
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notificações */}
        <TabsContent value="notifications" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Preferências de Notificação
              </CardTitle>
              <CardDescription>
                Configure como e quando você deseja receber notificações
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label>Notificações por Email</Label>
                    <p className="text-sm text-muted-foreground">
                      Receba notificações importantes por email
                    </p>
                  </div>
                  <Switch
                    checked={notifications.email}
                    onCheckedChange={(checked) => setNotifications(prev => ({ ...prev, email: checked }))}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label>Notificações Push</Label>
                    <p className="text-sm text-muted-foreground">
                      Receba notificações push no navegador
                    </p>
                  </div>
                  <Switch
                    checked={notifications.push}
                    onCheckedChange={(checked) => setNotifications(prev => ({ ...prev, push: checked }))}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label>Notificações SMS</Label>
                    <p className="text-sm text-muted-foreground">
                      Receba alertas críticos por SMS
                    </p>
                  </div>
                  <Switch
                    checked={notifications.sms}
                    onCheckedChange={(checked) => setNotifications(prev => ({ ...prev, sms: checked }))}
                  />
                </div>

                <Separator />

                <div className="space-y-4">
                  <h4 className="font-medium">Tipos de Notificação</h4>
                  
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <Label>Novas Mensagens</Label>
                      <p className="text-sm text-muted-foreground">
                        Quando receber novas mensagens no WhatsApp
                      </p>
                    </div>
                    <Switch
                      checked={notifications.newMessages}
                      onCheckedChange={(checked) => setNotifications(prev => ({ ...prev, newMessages: checked }))}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <Label>Atualizações de Campanhas</Label>
                      <p className="text-sm text-muted-foreground">
                        Status e resultados das suas campanhas
                      </p>
                    </div>
                    <Switch
                      checked={notifications.campaignUpdates}
                      onCheckedChange={(checked) => setNotifications(prev => ({ ...prev, campaignUpdates: checked }))}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <Label>Alertas do Sistema</Label>
                      <p className="text-sm text-muted-foreground">
                        Problemas técnicos e manutenções
                      </p>
                    </div>
                    <Switch
                      checked={notifications.systemAlerts}
                      onCheckedChange={(checked) => setNotifications(prev => ({ ...prev, systemAlerts: checked }))}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <Label>Relatórios Semanais</Label>
                      <p className="text-sm text-muted-foreground">
                        Resumo semanal das suas atividades
                      </p>
                    </div>
                    <Switch
                      checked={notifications.weeklyReports}
                      onCheckedChange={(checked) => setNotifications(prev => ({ ...prev, weeklyReports: checked }))}
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <Button onClick={() => handleSave('notificações')} disabled={loading}>
                  {loading ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                  Salvar Preferências
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Segurança */}
        <TabsContent value="security" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Segurança da Conta
              </CardTitle>
              <CardDescription>
                Mantenha sua conta segura com essas configurações
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label>Autenticação de Dois Fatores</Label>
                    <p className="text-sm text-muted-foreground">
                      Adicione uma camada extra de segurança
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={security.twoFactor}
                      onCheckedChange={(checked) => setSecurity(prev => ({ ...prev, twoFactor: checked }))}
                    />
                    {security.twoFactor && <Badge variant="secondary">Ativo</Badge>}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Timeout da Sessão (minutos)</Label>
                    <Select value={security.sessionTimeout} onValueChange={(value) => setSecurity(prev => ({ ...prev, sessionTimeout: value }))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="15">15 minutos</SelectItem>
                        <SelectItem value="30">30 minutos</SelectItem>
                        <SelectItem value="60">1 hora</SelectItem>
                        <SelectItem value="120">2 horas</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Expiração da Senha (dias)</Label>
                    <Select value={security.passwordExpiry} onValueChange={(value) => setSecurity(prev => ({ ...prev, passwordExpiry: value }))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="30">30 dias</SelectItem>
                        <SelectItem value="60">60 dias</SelectItem>
                        <SelectItem value="90">90 dias</SelectItem>
                        <SelectItem value="never">Nunca</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Alterar Senha</Label>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="current-password">Senha Atual</Label>
                        <div className="relative">
                          <Input
                            id="current-password"
                            type={showPassword ? "text" : "password"}
                            placeholder="Digite sua senha atual"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                            onClick={() => setShowPassword(!showPassword)}
                          >
                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </Button>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="new-password">Nova Senha</Label>
                        <Input
                          id="new-password"
                          type="password"
                          placeholder="Digite sua nova senha"
                        />
                      </div>
                    </div>
                    <Button variant="outline" size="sm">
                      <Key className="h-4 w-4 mr-2" />
                      Alterar Senha
                    </Button>
                  </div>
                </div>

                <Separator />

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <Label>Alertas de Login</Label>
                      <p className="text-sm text-muted-foreground">
                        Receba alertas sobre novos logins
                      </p>
                    </div>
                    <Switch
                      checked={security.loginAlerts}
                      onCheckedChange={(checked) => setSecurity(prev => ({ ...prev, loginAlerts: checked }))}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <Label>Acesso à API</Label>
                      <p className="text-sm text-muted-foreground">
                        Permitir acesso via API externa
                      </p>
                    </div>
                    <Switch
                      checked={security.apiAccess}
                      onCheckedChange={(checked) => setSecurity(prev => ({ ...prev, apiAccess: checked }))}
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-between items-center">
                <Button onClick={() => handleSave('segurança')} disabled={loading}>
                  {loading ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                  Salvar Configurações
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => window.location.href = '/dashboard/settings/security'}
                  className="flex items-center gap-2"
                >
                  <Shield className="h-4 w-4" />
                  Configurações Avançadas
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Cobrança */}
        <TabsContent value="billing" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Plano e Cobrança
              </CardTitle>
              <CardDescription>
                Gerencie seu plano, pagamentos e faturas
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-3">
                  <Crown className="h-8 w-8 text-yellow-500" />
                  <div>
                    <h3 className="font-semibold">Plano Pro</h3>
                    <p className="text-sm text-muted-foreground">
                      Até 10.000 mensagens/mês
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold">R$ 99,90</p>
                  <p className="text-sm text-muted-foreground">/mês</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Ciclo de Cobrança</Label>
                  <Select value={billing.billingCycle} onValueChange={(value) => setBilling(prev => ({ ...prev, billingCycle: value }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="monthly">Mensal</SelectItem>
                      <SelectItem value="yearly">Anual (20% desconto)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Email para Faturas</Label>
                  <Input
                    value={billing.invoiceEmail}
                    onChange={(e) => setBilling(prev => ({ ...prev, invoiceEmail: e.target.value }))}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label>Renovação Automática</Label>
                  <p className="text-sm text-muted-foreground">
                    Renove automaticamente seu plano
                  </p>
                </div>
                <Switch
                  checked={billing.autoRenew}
                  onCheckedChange={(checked) => setBilling(prev => ({ ...prev, autoRenew: checked }))}
                />
              </div>

              <Separator />

              <div className="space-y-4">
                <h4 className="font-medium">Método de Pagamento</h4>
                <div className="flex items-center gap-4 p-4 border rounded-lg">
                  <CreditCard className="h-6 w-6" />
                  <div className="flex-1">
                    <p className="font-medium">•••• •••• •••• 1234</p>
                    <p className="text-sm text-muted-foreground">Visa - Expira em 12/25</p>
                  </div>
                  <Button variant="outline" size="sm">Alterar</Button>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="font-medium">Uso Atual</h4>
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center p-4 border rounded-lg">
                    <p className="text-2xl font-bold text-primary">7,543</p>
                    <p className="text-sm text-muted-foreground">Mensagens enviadas</p>
                  </div>
                  <div className="text-center p-4 border rounded-lg">
                    <p className="text-2xl font-bold text-green-600">2,457</p>
                    <p className="text-sm text-muted-foreground">Mensagens restantes</p>
                  </div>
                  <div className="text-center p-4 border rounded-lg">
                    <p className="text-2xl font-bold text-blue-600">15</p>
                    <p className="text-sm text-muted-foreground">Dias restantes</p>
                  </div>
                </div>
              </div>

              <div className="flex justify-between">
                <Button variant="outline">
                  <Download className="h-4 w-4 mr-2" />
                  Baixar Fatura
                </Button>
                <Button>
                  <Crown className="h-4 w-4 mr-2" />
                  Fazer Upgrade
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* WhatsApp */}
        <TabsContent value="whatsapp" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Smartphone className="h-5 w-5" />
                Configurações do WhatsApp
              </CardTitle>
              <CardDescription>
                Configure as integrações e comportamentos do WhatsApp
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Instância Padrão</Label>
                  <Select value={whatsapp.defaultInstance} onValueChange={(value) => setWhatsapp(prev => ({ ...prev, defaultInstance: value }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="principal">Principal</SelectItem>
                      <SelectItem value="vendas">Vendas</SelectItem>
                      <SelectItem value="suporte">Suporte</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Delay entre Mensagens (ms)</Label>
                  <Input
                    value={whatsapp.messageDelay}
                    onChange={(e) => setWhatsapp(prev => ({ ...prev, messageDelay: e.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Máximo de Tentativas</Label>
                  <Input
                    value={whatsapp.maxRetries}
                    onChange={(e) => setWhatsapp(prev => ({ ...prev, maxRetries: e.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label>URL do Webhook</Label>
                  <Input
                    value={whatsapp.webhookUrl}
                    onChange={(e) => setWhatsapp(prev => ({ ...prev, webhookUrl: e.target.value }))}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Secret do Webhook</Label>
                <div className="flex gap-2">
                  <Input
                    type="password"
                    value={whatsapp.webhookSecret}
                    onChange={(e) => setWhatsapp(prev => ({ ...prev, webhookSecret: e.target.value }))}
                  />
                  <Button variant="outline" size="icon">
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label>Reconexão Automática</Label>
                  <p className="text-sm text-muted-foreground">
                    Reconectar automaticamente em caso de desconexão
                  </p>
                </div>
                <Switch
                  checked={whatsapp.autoReconnect}
                  onCheckedChange={(checked) => setWhatsapp(prev => ({ ...prev, autoReconnect: checked }))}
                />
              </div>

              <Separator />

              <div className="space-y-4">
                <h4 className="font-medium">Status das Instâncias</h4>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                      <div>
                        <p className="font-medium">Principal</p>
                        <p className="text-sm text-muted-foreground">+55 11 99999-9999</p>
                      </div>
                    </div>
                    <Badge variant="secondary">Conectado</Badge>
                  </div>

                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                      <div>
                        <p className="font-medium">Vendas</p>
                        <p className="text-sm text-muted-foreground">+55 11 88888-8888</p>
                      </div>
                    </div>
                    <Badge variant="outline">Aguardando QR</Badge>
                  </div>

                  <div className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                      <div>
                        <p className="font-medium">Suporte</p>
                        <p className="text-sm text-muted-foreground">Não configurado</p>
                      </div>
                    </div>
                    <Badge variant="destructive">Desconectado</Badge>
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <Button onClick={() => handleSave('WhatsApp')} disabled={loading}>
                  {loading ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                  Salvar Configurações
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Aparência */}
        <TabsContent value="appearance" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette className="h-5 w-5" />
                Aparência e Personalização
              </CardTitle>
              <CardDescription>
                Personalize a aparência da interface
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Tema</Label>
                  <Select value={appearance.theme} onValueChange={(value) => setAppearance(prev => ({ ...prev, theme: value }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="light">Claro</SelectItem>
                      <SelectItem value="dark">Escuro</SelectItem>
                      <SelectItem value="system">Sistema</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Cor Primária</Label>
                  <div className="flex gap-2">
                    {['blue', 'green', 'purple', 'orange', 'red'].map((color) => (
                      <button
                        key={color}
                        className={`w-8 h-8 rounded-full border-2 ${
                          appearance.primaryColor === color ? 'border-foreground' : 'border-muted'
                        }`}
                        style={{ backgroundColor: `hsl(var(--${color}))` }}
                        onClick={() => setAppearance(prev => ({ ...prev, primaryColor: color }))}
                      />
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Tamanho da Fonte</Label>
                  <Select value={appearance.fontSize} onValueChange={(value) => setAppearance(prev => ({ ...prev, fontSize: value }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="small">Pequena</SelectItem>
                      <SelectItem value="medium">Média</SelectItem>
                      <SelectItem value="large">Grande</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label>Modo Compacto</Label>
                    <p className="text-sm text-muted-foreground">
                      Reduz o espaçamento entre elementos
                    </p>
                  </div>
                  <Switch
                    checked={appearance.compactMode}
                    onCheckedChange={(checked) => setAppearance(prev => ({ ...prev, compactMode: checked }))}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label>Animações</Label>
                    <p className="text-sm text-muted-foreground">
                      Habilitar animações da interface
                    </p>
                  </div>
                  <Switch
                    checked={appearance.animations}
                    onCheckedChange={(checked) => setAppearance(prev => ({ ...prev, animations: checked }))}
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <Button onClick={() => handleSave('aparência')} disabled={loading}>
                  {loading ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                  Aplicar Configurações
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Seção de Dados e Privacidade */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Dados e Privacidade
          </CardTitle>
          <CardDescription>
            Gerencie seus dados pessoais e configurações de privacidade
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium">Exportar Dados</h4>
              <p className="text-sm text-muted-foreground">
                Baixe uma cópia de todos os seus dados
              </p>
            </div>
            <Button variant="outline" onClick={handleExportData}>
              <Download className="h-4 w-4 mr-2" />
              Exportar
            </Button>
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium text-destructive">Excluir Conta</h4>
              <p className="text-sm text-muted-foreground">
                Exclua permanentemente sua conta e todos os dados
              </p>
            </div>
            <Button variant="destructive" onClick={handleDeleteAccount}>
              <Trash2 className="h-4 w-4 mr-2" />
              Excluir Conta
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
