import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  Smartphone, 
  Plus, 
  Search, 
  QrCode,
  Wifi,
  WifiOff,
  MoreHorizontal,
  RefreshCw,
  Trash2,
  Settings,
  AlertCircle,
  CheckCircle,
  Clock,
  Maximize2
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Label } from '@/components/ui/label'
import { useEvolutionApi } from '@/hooks/useEvolutionApi'
import { useToast } from '@/hooks/use-toast'
import { WhatsAppInstance } from '@/services/whatsappInstanceService'

export default function WhatsAppConnections() {
  const [searchTerm, setSearchTerm] = useState('')
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [newInstanceName, setNewInstanceName] = useState('')
  const [selectedInstance, setSelectedInstance] = useState<WhatsAppInstance | null>(null)
  const [isQRDialogOpen, setIsQRDialogOpen] = useState(false)
  
  const { 
    instances,
    connectionStatus, 
    loading, 
    createInstance,
    connect, 
    disconnect, 
    checkConnectionStatus,
    deleteInstance
  } = useEvolutionApi()
  
  const { toast } = useToast()

  const qrToDisplay = selectedInstance?.qr_code || connectionStatus.qrCode

  // Filtrar instâncias baseado no termo de busca
  const filteredInstances = instances.filter(instance =>
    instance.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (instance.phone_number && instance.phone_number.includes(searchTerm))
  )

  const handleCreateInstance = async () => {
    if (!newInstanceName.trim()) {
      toast({
        title: "Nome obrigatório",
        description: "Por favor, digite um nome para a instância.",
        variant: "destructive"
      })
      return
    }

    try {
      await createInstance(newInstanceName.trim())
      setNewInstanceName('')
      setIsCreateDialogOpen(false)
    } catch (error) {
      // Erro já tratado no hook
    }
  }

  const handleConnect = async (instance: WhatsAppInstance) => {
    try {
      setSelectedInstance(instance)
      await connect(instance.id)
      
      // Se gerou QR Code, abrir dialog
      if (connectionStatus.qrCode) {
        setIsQRDialogOpen(true)
      }
    } catch (error) {
      // Erro já tratado no hook
    }
  }

  const handleDisconnect = async (instance: WhatsAppInstance) => {
    try {
      await disconnect(instance.id)
    } catch (error) {
      // Erro já tratado no hook
    }
  }

  const handleDelete = async (instance: WhatsAppInstance) => {
    if (window.confirm(`Tem certeza que deseja deletar a instância "${instance.name}"?`)) {
      try {
        await deleteInstance(instance.id)
      } catch (error) {
        // Erro já tratado no hook
      }
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'connected':
        return <CheckCircle className="w-4 h-4 text-green-500" />
      case 'connecting':
        return <Clock className="w-4 h-4 text-yellow-500" />
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-500" />
      default:
        return <WifiOff className="w-4 h-4 text-gray-500" />
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'connected':
        return <Badge variant="success">Conectado</Badge>
      case 'connecting':
        return <Badge variant="warning">Conectando</Badge>
      case 'error':
        return <Badge variant="destructive">Erro</Badge>
      default:
        return <Badge variant="secondary">Desconectado</Badge>
    }
  }

  const formatLastActivity = (dateString?: string) => {
    if (!dateString) return 'Nunca'
    
    const date = new Date(dateString)
    const now = new Date()
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60))
    
    if (diffInMinutes < 1) return 'Agora'
    if (diffInMinutes < 60) return `${diffInMinutes}m atrás`
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h atrás`
    return `${Math.floor(diffInMinutes / 1440)}d atrás`
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Conexões WhatsApp</h1>
          <p className="text-muted-foreground">
            Gerencie suas conexões com WhatsApp usando Evolution API
          </p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Nova Conexão
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Criar Nova Instância</DialogTitle>
              <DialogDescription>
                Crie uma nova instância WhatsApp para conectar um número.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="instanceName">Nome da Instância</Label>
                <Input
                  id="instanceName"
                  placeholder="Ex: WhatsApp Principal"
                  value={newInstanceName}
                  onChange={(e) => setNewInstanceName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleCreateInstance()
                    }
                  }}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleCreateInstance} disabled={loading}>
                {loading ? "Criando..." : "Criar Instância"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="instances" className="space-y-4">
        <TabsList>
          <TabsTrigger value="instances">Instâncias</TabsTrigger>
          <TabsTrigger value="settings">Configurações</TabsTrigger>
        </TabsList>

        <TabsContent value="instances" className="space-y-4">
          {/* Barra de busca e ações */}
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar conexões..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8"
              />
            </div>
            <Button variant="outline" onClick={() => checkConnectionStatus()} disabled={loading}>
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
          </div>

          {/* Lista de instâncias */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredInstances.length === 0 ? (
              <div className="col-span-full">
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <Smartphone className="w-12 h-12 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold mb-2">Nenhuma instância encontrada</h3>
                    <p className="text-muted-foreground text-center mb-4">
                      {searchTerm ? 
                        'Nenhuma instância corresponde à sua busca.' :
                        'Crie sua primeira instância WhatsApp para começar.'
                      }
                    </p>
                    {!searchTerm && (
                      <Button onClick={() => setIsCreateDialogOpen(true)}>
                        <Plus className="w-4 h-4 mr-2" />
                        Criar Primeira Instância
                      </Button>
                    )}
                  </CardContent>
                </Card>
              </div>
            ) : (
              filteredInstances.map((instance) => (
                <Card key={instance.id} className="relative">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(instance.status)}
                        <CardTitle className="text-lg">{instance.name}</CardTitle>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => checkConnectionStatus(instance.id)}>
                            <RefreshCw className="w-4 h-4 mr-2" />
                            Verificar Status
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDelete(instance)}>
                            <Trash2 className="w-4 h-4 mr-2" />
                            Deletar
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    <div className="space-y-1">
                      {instance.phone_number && (
                        <CardDescription>{instance.phone_number}</CardDescription>
                      )}
                      <div className="flex items-center gap-2">
                        {getStatusBadge(instance.status)}
                      </div>
                    </div>
                  </CardHeader>
                  
                  <CardContent className="space-y-4">
                    <div className="text-sm text-muted-foreground">
                      <div className="flex justify-between">
                        <span>Última atividade:</span>
                        <span>{formatLastActivity(instance.last_activity)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Criado em:</span>
                        <span>{new Date(instance.created_at).toLocaleDateString('pt-BR')}</span>
                      </div>
                    </div>

                    {/* QR Code se estiver conectando */}
                    {instance.status === 'connecting' && instance.qr_code && (
                      <div className="border rounded-lg p-4 bg-muted/50">
                        <div className="flex items-center gap-4">
                          <div className="w-24 h-24 bg-white rounded-lg flex items-center justify-center">
                            <img 
                              src={instance.qr_code} 
                              alt="QR Code" 
                              className="w-20 h-20" 
                            />
                          </div>
                          <div className="flex-1">
                            <h4 className="font-medium mb-1">Escaneie o QR Code</h4>
                            <p className="text-sm text-muted-foreground">
                              Use o WhatsApp do seu celular para escanear
                            </p>
                          </div>
                          <div className="flex items-center gap-2 ml-auto">
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => { setSelectedInstance(instance); setIsQRDialogOpen(true); }}
                            >
                              <Maximize2 className="w-4 h-4 mr-2" />
                              Ampliar QR Code
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => checkConnectionStatus(instance.id)}
                            >
                              <RefreshCw className="w-4 h-4 mr-2" />
                              Atualizar status
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Botões de ação */}
                    <div className="flex gap-2">
                      {instance.status === 'disconnected' && (
                        <Button 
                          onClick={() => handleConnect(instance)}
                          disabled={loading}
                          className="flex-1"
                        >
                          <QrCode className="w-4 h-4 mr-2" />
                          Conectar
                        </Button>
                      )}
                      
                      {instance.status === 'connecting' && (
                        <Button 
                          onClick={() => handleDisconnect(instance)}
                          variant="outline"
                          disabled={loading}
                          className="flex-1"
                        >
                          Cancelar
                        </Button>
                      )}
                      {instance.status === 'connecting' && (
                        <Button 
                          onClick={() => checkConnectionStatus(instance.id)}
                          variant="outline"
                          disabled={loading}
                          className="flex-1"
                        >
                          <RefreshCw className="w-4 h-4 mr-2" />
                          Atualizar status
                        </Button>
                      )}
                      {instance.status === 'connected' && (
                        <Button 
                          onClick={() => handleDisconnect(instance)}
                          variant="outline"
                          disabled={loading}
                          className="flex-1"
                        >
                          <WifiOff className="w-4 h-4 mr-2" />
                          Desconectar
                        </Button>
                      )}
                      
                      {instance.status === 'error' && (
                        <Button 
                          onClick={() => handleConnect(instance)}
                          disabled={loading}
                          className="flex-1"
                        >
                          <RefreshCw className="w-4 h-4 mr-2" />
                          Tentar Novamente
                        </Button>
                      )}
                      {instance.status === 'error' && (
                        <Button 
                          onClick={() => checkConnectionStatus(instance.id)}
                          variant="outline"
                          disabled={loading}
                          className="flex-1"
                        >
                          <RefreshCw className="w-4 h-4 mr-2" />
                          Verificar Status
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Configurações da Evolution API</CardTitle>
              <CardDescription>
                Configure os parâmetros de conexão com a Evolution API
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label className="text-sm font-medium">URL da API</Label>
                  <Input 
                    value={import.meta.env.VITE_EVOLUTION_API_URL || 'http://localhost:8080'}
                    readOnly
                    className="bg-muted"
                  />
                </div>
                <div>
                  <Label className="text-sm font-medium">Chave da API</Label>
                  <Input 
                    value={import.meta.env.VITE_EVOLUTION_API_KEY || 'Não configurada'}
                    type="password"
                    readOnly
                    className="bg-muted"
                  />
                </div>
              </div>
              <div className="text-sm text-muted-foreground">
                <p>
                  Configure as variáveis de ambiente VITE_EVOLUTION_API_URL e VITE_EVOLUTION_API_KEY 
                  no arquivo .env para conectar com sua instância da Evolution API.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialog para mostrar QR Code */}
      <Dialog open={isQRDialogOpen} onOpenChange={setIsQRDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Conectar WhatsApp</DialogTitle>
            <DialogDescription>
              Escaneie o QR Code com seu WhatsApp para conectar a instância
            </DialogDescription>
          </DialogHeader>
          
          {qrToDisplay && (
            <div className="flex justify-center p-4">
              <div className="bg-white p-4 rounded-lg">
                <img 
                  src={qrToDisplay} 
                  alt="QR Code para conectar WhatsApp" 
                  className="w-64 h-64"
                />
              </div>
            </div>
          )}
          
          <div className="text-center text-sm text-muted-foreground">
            <p>1. Abra o WhatsApp no seu celular</p>
            <p>2. Toque em Menu ou Configurações</p>
            <p>3. Toque em Aparelhos conectados</p>
            <p>4. Toque em Conectar um aparelho</p>
            <p>5. Aponte seu celular para esta tela para capturar o código</p>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsQRDialogOpen(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}