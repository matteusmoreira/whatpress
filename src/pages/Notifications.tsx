import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { 
  Bell, 
  BellRing,
  MessageSquare,
  Users,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Clock,
  Settings,
  Smartphone,
  Mail,
  Webhook,
  Zap,
  Filter,
  Search,
  MoreVertical,
  Eye,
  Trash2,
  Edit,
  Send
} from 'lucide-react'
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
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

export default function Notifications() {
  const [selectedFilter, setSelectedFilter] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)

  // Mock data para notificações
  const notifications = [
    {
      id: 1,
      title: 'Nova mensagem recebida',
      message: 'Você recebeu uma nova mensagem de João Silva',
      type: 'message',
      status: 'unread',
      timestamp: new Date(Date.now() - 5 * 60 * 1000),
      channel: 'app',
      priority: 'normal',
      contact: 'João Silva'
    },
    {
      id: 2,
      title: 'Campanha finalizada',
      message: 'A campanha "Black Friday" foi finalizada com sucesso. 4.890 mensagens enviadas.',
      type: 'campaign',
      status: 'read',
      timestamp: new Date(Date.now() - 30 * 60 * 1000),
      channel: 'email',
      priority: 'high',
      campaign: 'Black Friday'
    },
    {
      id: 3,
      title: 'Limite de mensagens atingido',
      message: 'Você atingiu 90% do limite mensal de mensagens. Considere fazer upgrade.',
      type: 'warning',
      status: 'unread',
      timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
      channel: 'app',
      priority: 'high'
    },

  ]



  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'message':
        return <MessageSquare className="h-4 w-4 text-blue-500" />
      case 'campaign':
        return <TrendingUp className="h-4 w-4 text-green-500" />
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />
      case 'error':
        return <AlertTriangle className="h-4 w-4 text-red-500" />
      case 'contact':
        return <Users className="h-4 w-4 text-purple-500" />
      default:
        return <Bell className="h-4 w-4 text-gray-500" />
    }
  }

  const getNotificationBadge = (type: string) => {
    switch (type) {
      case 'message':
        return <Badge variant="outline" className="text-blue-600 border-blue-200">Mensagem</Badge>
      case 'campaign':
        return <Badge variant="outline" className="text-green-600 border-green-200">Campanha</Badge>
      case 'warning':
        return <Badge variant="outline" className="text-yellow-600 border-yellow-200">Aviso</Badge>
      case 'error':
        return <Badge variant="outline" className="text-red-600 border-red-200">Erro</Badge>
      case 'contact':
        return <Badge variant="outline" className="text-purple-600 border-purple-200">Contato</Badge>
      default:
        return <Badge variant="outline">Info</Badge>
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'border-l-red-500'
      case 'normal':
        return 'border-l-blue-500'
      case 'low':
        return 'border-l-gray-300'
      default:
        return 'border-l-gray-300'
    }
  }

  const getChannelIcon = (channel: string) => {
    switch (channel) {
      case 'app':
        return <Smartphone className="h-3 w-3" />
      case 'email':
        return <Mail className="h-3 w-3" />
      case 'webhook':
        return <Webhook className="h-3 w-3" />
      default:
        return <Bell className="h-3 w-3" />
    }
  }

  const filteredNotifications = notifications.filter(notification => {
    const matchesFilter = selectedFilter === 'all' || 
                         (selectedFilter === 'unread' && notification.status === 'unread') ||
                         (selectedFilter === 'read' && notification.status === 'read') ||
                         notification.type === selectedFilter

    const matchesSearch = notification.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         notification.message.toLowerCase().includes(searchTerm.toLowerCase())

    return matchesFilter && matchesSearch
  })

  const unreadCount = notifications.filter(n => n.status === 'unread').length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Notificações</h1>
          <p className="text-muted-foreground">
            Gerencie suas notificações e alertas em tempo real
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="secondary" className="gap-1">
            <BellRing className="h-3 w-3" />
            {unreadCount} não lidas
          </Badge>
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Bell className="mr-2 h-4 w-4" />
                Nova Notificação
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Criar Nova Notificação</DialogTitle>
                <DialogDescription>
                  Configure uma nova notificação personalizada
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Título</Label>
                  <Input
                    id="title"
                    placeholder="Título da notificação"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="message">Mensagem</Label>
                  <Textarea
                    id="message"
                    placeholder="Conteúdo da notificação"
                    rows={3}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="type">Tipo</Label>
                  <Select defaultValue="info">
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="info">Informação</SelectItem>
                      <SelectItem value="warning">Aviso</SelectItem>
                      <SelectItem value="error">Erro</SelectItem>
                      <SelectItem value="success">Sucesso</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={() => setIsCreateDialogOpen(false)}>
                  <Send className="mr-2 h-4 w-4" />
                  Enviar
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Tabs defaultValue="notifications" className="space-y-4">
        <TabsList>
          <TabsTrigger value="notifications">Notificações</TabsTrigger>
          <TabsTrigger value="settings">Configurações</TabsTrigger>
        </TabsList>

        <TabsContent value="notifications" className="space-y-4">
          {/* Filters */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar notificações..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-64"
              />
            </div>
            <Select value={selectedFilter} onValueChange={setSelectedFilter}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="unread">Não lidas</SelectItem>
                <SelectItem value="read">Lidas</SelectItem>
                <SelectItem value="message">Mensagens</SelectItem>
                <SelectItem value="campaign">Campanhas</SelectItem>
                <SelectItem value="warning">Avisos</SelectItem>
                <SelectItem value="error">Erros</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm">
              <Filter className="mr-2 h-4 w-4" />
              Filtros
            </Button>
          </div>

          {/* Notifications List */}
          <div className="space-y-3">
            {filteredNotifications.map((notification) => (
              <Card key={notification.id} className={`border-l-4 ${getPriorityColor(notification.priority)} ${notification.status === 'unread' ? 'bg-blue-50/50' : ''}`}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3 flex-1">
                      <div className="mt-1">
                        {getNotificationIcon(notification.type)}
                      </div>
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <h4 className={`font-medium ${notification.status === 'unread' ? 'font-semibold' : ''}`}>
                            {notification.title}
                          </h4>
                          {getNotificationBadge(notification.type)}
                          {notification.status === 'unread' && (
                            <div className="w-2 h-2 bg-blue-500 rounded-full" />
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {notification.message}
                        </p>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {format(notification.timestamp, 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                          </div>
                          <div className="flex items-center gap-1">
                            {getChannelIcon(notification.channel)}
                            {notification.channel}
                          </div>
                          {notification.contact && (
                            <div className="flex items-center gap-1">
                              <Users className="h-3 w-3" />
                              {notification.contact}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem>
                          <Eye className="mr-2 h-4 w-4" />
                          Marcar como lida
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <Edit className="mr-2 h-4 w-4" />
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-red-600">
                          <Trash2 className="mr-2 h-4 w-4" />
                          Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {filteredNotifications.length === 0 && (
            <Card>
              <CardContent className="p-8 text-center">
                <Bell className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">Nenhuma notificação encontrada</h3>
                <p className="text-muted-foreground">
                  Não há notificações que correspondam aos filtros selecionados.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="settings" className="space-y-4">
          <div className="grid gap-6 md:grid-cols-2">
            {/* App Notifications */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Smartphone className="h-5 w-5" />
                  Notificações do App
                </CardTitle>
                <CardDescription>
                  Configure as notificações dentro da plataforma
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="app-enabled">Ativar notificações</Label>
                    <p className="text-sm text-muted-foreground">Receber notificações no app</p>
                  </div>
                  <Switch id="app-enabled" defaultChecked />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="app-messages">Novas mensagens</Label>
                    <p className="text-sm text-muted-foreground">Notificar sobre novas mensagens</p>
                  </div>
                  <Switch id="app-messages" defaultChecked />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="app-campaigns">Atualizações de campanhas</Label>
                    <p className="text-sm text-muted-foreground">Status de campanhas</p>
                  </div>
                  <Switch id="app-campaigns" defaultChecked />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="app-alerts">Alertas do sistema</Label>
                    <p className="text-sm text-muted-foreground">Avisos importantes</p>
                  </div>
                  <Switch id="app-alerts" defaultChecked />
                </div>
              </CardContent>
            </Card>

            {/* Email Notifications */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mail className="h-5 w-5" />
                  Notificações por Email
                </CardTitle>
                <CardDescription>
                  Configure as notificações por email
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="email-enabled">Ativar emails</Label>
                    <p className="text-sm text-muted-foreground">Receber notificações por email</p>
                  </div>
                  <Switch id="email-enabled" defaultChecked />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="email-messages">Novas mensagens</Label>
                    <p className="text-sm text-muted-foreground">Email para cada nova mensagem</p>
                  </div>
                  <Switch id="email-messages" />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="email-campaigns">Campanhas</Label>
                    <p className="text-sm text-muted-foreground">Relatórios de campanhas</p>
                  </div>
                  <Switch id="email-campaigns" defaultChecked />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="email-weekly">Relatório semanal</Label>
                    <p className="text-sm text-muted-foreground">Resumo semanal por email</p>
                  </div>
                  <Switch id="email-weekly" defaultChecked />
                </div>
              </CardContent>
            </Card>


          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}