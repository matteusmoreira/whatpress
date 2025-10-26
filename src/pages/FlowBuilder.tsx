import { useState, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { 
  Save, 
  Play, 
  Pause,
  Square,
  Plus,
  Trash2,
  Settings,
  ArrowRight,
  ArrowDown,
  MessageSquare,
  Clock,
  Users,
  Target,
  GitBranch,
  Zap,
  Timer,
  CheckCircle,
  AlertCircle,
  Eye,
  Copy,
  RotateCcw,
  Send,
  UserPlus,
  Tag,
  Filter,
  Calendar,
  Bot,
  Workflow
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
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'
import { useQuotas } from '@/hooks/useQuotas'
import { toast } from 'sonner'

// Tipos de nós do fluxo
type NodeType = 'trigger' | 'message' | 'delay' | 'condition' | 'action' | 'end'

interface FlowNode {
  id: string
  type: NodeType
  title: string
  description?: string
  config: any
  position: { x: number; y: number }
  connections: string[]
}

interface FlowData {
  id: string
  name: string
  description: string
  nodes: FlowNode[]
  isActive: boolean
  createdAt: string
  lastModified: string
}

// Componentes de nós
const NodeComponent = ({ 
  node, 
  onEdit, 
  onDelete, 
  onConnect 
}: { 
  node: FlowNode
  onEdit: (node: FlowNode) => void
  onDelete: (nodeId: string) => void
  onConnect: (nodeId: string) => void
}) => {
  const getNodeIcon = (type: NodeType) => {
    switch (type) {
      case 'trigger':
        return <Zap className="h-5 w-5" />
      case 'message':
        return <MessageSquare className="h-5 w-5" />
      case 'delay':
        return <Timer className="h-5 w-5" />
      case 'condition':
        return <GitBranch className="h-5 w-5" />
      case 'action':
        return <Target className="h-5 w-5" />
      case 'end':
        return <CheckCircle className="h-5 w-5" />
      default:
        return <Square className="h-5 w-5" />
    }
  }

  const getNodeColor = (type: NodeType) => {
    switch (type) {
      case 'trigger':
        return 'border-blue-500 bg-blue-50'
      case 'message':
        return 'border-green-500 bg-green-50'
      case 'delay':
        return 'border-yellow-500 bg-yellow-50'
      case 'condition':
        return 'border-purple-500 bg-purple-50'
      case 'action':
        return 'border-orange-500 bg-orange-50'
      case 'end':
        return 'border-gray-500 bg-gray-50'
      default:
        return 'border-gray-300 bg-white'
    }
  }

  return (
    <div 
      className={`relative p-4 border-2 rounded-lg cursor-pointer hover:shadow-md transition-all ${getNodeColor(node.type)}`}
      style={{ 
        position: 'absolute', 
        left: node.position.x, 
        top: node.position.y,
        minWidth: '200px'
      }}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {getNodeIcon(node.type)}
          <span className="font-semibold text-sm">{node.title}</span>
        </div>
        <div className="flex items-center gap-1">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => onEdit(node)}
            className="h-6 w-6 p-0"
          >
            <Settings className="h-3 w-3" />
          </Button>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => onDelete(node.id)}
            className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>
      
      {node.description && (
        <p className="text-xs text-muted-foreground mb-2">{node.description}</p>
      )}
      
      <div className="flex justify-center">
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => onConnect(node.id)}
          className="h-6 text-xs"
        >
          <Plus className="h-3 w-3 mr-1" />
          Conectar
        </Button>
      </div>
      
      {/* Indicador de conexões */}
      {node.connections.length > 0 && (
        <div className="absolute -bottom-2 -right-2 bg-blue-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs">
          {node.connections.length}
        </div>
      )}
    </div>
  )
}

export default function FlowBuilder() {
  const [flowData, setFlowData] = useState<FlowData>({
    id: '1',
    name: 'Nova Automação',
    description: 'Descrição da automação',
    nodes: [
      {
        id: 'trigger-1',
        type: 'trigger',
        title: 'Novo Contato',
        description: 'Quando um novo contato é adicionado',
        config: { triggerType: 'new_contact' },
        position: { x: 50, y: 50 },
        connections: []
      }
    ],
    isActive: false,
    createdAt: new Date().toISOString(),
    lastModified: new Date().toISOString()
  })

  const [selectedNode, setSelectedNode] = useState<FlowNode | null>(null)
  const [showNodeDialog, setShowNodeDialog] = useState(false)
  const [showSaveDialog, setShowSaveDialog] = useState(false)

  const { isFeatureBlocked } = useQuotas()
  const messagesFeatureBlocked = isFeatureBlocked('messages')

  const addNode = useCallback((type: NodeType) => {
    const newNode: FlowNode = {
      id: `${type}-${Date.now()}`,
      type,
      title: getNodeTitle(type),
      description: getNodeDescription(type),
      config: {},
      position: { 
        x: Math.random() * 400 + 100, 
        y: Math.random() * 300 + 150 
      },
      connections: []
    }

    setFlowData(prev => ({
      ...prev,
      nodes: [...prev.nodes, newNode],
      lastModified: new Date().toISOString()
    }))
  }, [])

  const editNode = useCallback((node: FlowNode) => {
    setSelectedNode(node)
    setShowNodeDialog(true)
  }, [])

  const deleteNode = useCallback((nodeId: string) => {
    setFlowData(prev => ({
      ...prev,
      nodes: prev.nodes.filter(node => node.id !== nodeId),
      lastModified: new Date().toISOString()
    }))
  }, [])

  const connectNode = useCallback((nodeId: string) => {
    // Lógica para conectar nós
    console.log('Conectando nó:', nodeId)
  }, [])

  const saveFlow = useCallback(() => {
    console.log('Salvando fluxo:', flowData)
    setShowSaveDialog(false)
  }, [flowData])

  function getNodeTitle(type: NodeType): string {
    switch (type) {
      case 'trigger':
        return 'Gatilho'
      case 'message':
        return 'Enviar Mensagem'
      case 'delay':
        return 'Aguardar'
      case 'condition':
        return 'Condição'
      case 'action':
        return 'Ação'
      case 'end':
        return 'Finalizar'
      default:
        return 'Nó'
    }
  }

  function getNodeDescription(type: NodeType): string {
    switch (type) {
      case 'trigger':
        return 'Inicia a automação'
      case 'message':
        return 'Envia uma mensagem'
      case 'delay':
        return 'Aguarda um tempo'
      case 'condition':
        return 'Verifica uma condição'
      case 'action':
        return 'Executa uma ação'
      case 'end':
        return 'Finaliza a automação'
      default:
        return 'Nó personalizado'
    }
  }

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <div className="border-b bg-background p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div>
              <h1 className="text-2xl font-bold">{flowData.name}</h1>
              <p className="text-sm text-muted-foreground">{flowData.description}</p>
            </div>
            <Badge variant={flowData.isActive ? "default" : "secondary"}>
              {flowData.isActive ? 'Ativa' : 'Inativa'}
            </Badge>
          </div>
          
          <div className="flex items-center gap-3">
            <Button variant="outline" className="gap-2">
              <Eye className="h-4 w-4" />
              Visualizar
            </Button>
            <Button variant="outline" className="gap-2">
              <Copy className="h-4 w-4" />
              Duplicar
            </Button>
            <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <Save className="h-4 w-4" />
                  Salvar
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Salvar Automação</DialogTitle>
                  <DialogDescription>
                    Configure os detalhes da sua automação
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Nome</label>
                    <Input 
                      value={flowData.name}
                      onChange={(e) => setFlowData(prev => ({ ...prev, name: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Descrição</label>
                    <Textarea 
                      value={flowData.description}
                      onChange={(e) => setFlowData(prev => ({ ...prev, description: e.target.value }))}
                    />
                  </div>
                  <div className="flex justify-end gap-3">
                    <Button variant="outline" onClick={() => setShowSaveDialog(false)}>
                      Cancelar
                    </Button>
                    <Button onClick={saveFlow}>
                      Salvar Automação
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
            <Button 
              variant={flowData.isActive ? "destructive" : "default"}
              className="gap-2"
              onClick={() => {
                if (!flowData.isActive) {
                  const hasMessageNode = flowData.nodes.some(n => n.type === 'message')
                  if (messagesFeatureBlocked && hasMessageNode) {
                    toast.error('Ativação bloqueada: envio de mensagens indisponível no seu plano.')
                    return
                  }
                }
                setFlowData(prev => ({ 
                  ...prev, 
                  isActive: !prev.isActive,
                  lastModified: new Date().toISOString()
                }))
              }}
            >
              {flowData.isActive ? (
                <>
                  <Pause className="h-4 w-4" />
                  Pausar
                </>
              ) : (
                <>
                  <Play className="h-4 w-4" />
                  Ativar
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      <div className="flex flex-1">
        {/* Sidebar com ferramentas */}
        <div className="w-64 border-r bg-background p-4">
          <div className="space-y-6">
            <div>
              <h3 className="font-semibold mb-3">Adicionar Nós</h3>
              <div className="space-y-2">
                <Button 
                  variant="outline" 
                  className="w-full justify-start gap-2"
                  onClick={() => addNode('trigger')}
                >
                  <Zap className="h-4 w-4" />
                  Gatilho
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full justify-start gap-2"
                  disabled={messagesFeatureBlocked}
                  title={messagesFeatureBlocked ? 'Envio de mensagens indisponível no seu plano' : undefined}
                  onClick={() => {
                    if (messagesFeatureBlocked) {
                      toast.info('Recurso indisponível no seu plano: envio de mensagens está bloqueado.')
                      return
                    }
                    addNode('message')
                  }}
                >
                  <MessageSquare className="h-4 w-4" />
                  Mensagem
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full justify-start gap-2"
                  onClick={() => addNode('delay')}
                >
                  <Timer className="h-4 w-4" />
                  Aguardar
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full justify-start gap-2"
                  onClick={() => addNode('condition')}
                >
                  <GitBranch className="h-4 w-4" />
                  Condição
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full justify-start gap-2"
                  onClick={() => addNode('action')}
                >
                  <Target className="h-4 w-4" />
                  Ação
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full justify-start gap-2"
                  onClick={() => addNode('end')}
                >
                  <CheckCircle className="h-4 w-4" />
                  Finalizar
                </Button>
              </div>
            </div>

            <div>
              <h3 className="font-semibold mb-3">Estatísticas</h3>
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total de Nós:</span>
                  <span className="font-medium">{flowData.nodes.length}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Conexões:</span>
                  <span className="font-medium">
                    {flowData.nodes.reduce((acc, node) => acc + node.connections.length, 0)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Status:</span>
                  <Badge variant={flowData.isActive ? "default" : "secondary"} className="text-xs">
                    {flowData.isActive ? 'Ativa' : 'Inativa'}
                  </Badge>
                </div>
              </div>
            </div>

            <div>
              <h3 className="font-semibold mb-3">Ações</h3>
              <div className="space-y-2">
                <Button variant="outline" className="w-full justify-start gap-2">
                  <RotateCcw className="h-4 w-4" />
                  Desfazer
                </Button>
                <Button variant="outline" className="w-full justify-start gap-2">
                  <Eye className="h-4 w-4" />
                  Pré-visualizar
                </Button>
                <Button variant="outline" className="w-full justify-start gap-2">
                  <Settings className="h-4 w-4" />
                  Configurações
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Canvas principal */}
        <div className="flex-1 relative bg-gray-50 overflow-auto">
          <div className="absolute inset-0 p-4">
            {/* Grid de fundo */}
            <div 
              className="absolute inset-0 opacity-20"
              style={{
                backgroundImage: `
                  linear-gradient(to right, #e5e7eb 1px, transparent 1px),
                  linear-gradient(to bottom, #e5e7eb 1px, transparent 1px)
                `,
                backgroundSize: '20px 20px'
              }}
            />
            
            {/* Renderizar nós */}
            {flowData.nodes.map((node) => (
              <NodeComponent
                key={node.id}
                node={node}
                onEdit={editNode}
                onDelete={deleteNode}
                onConnect={connectNode}
              />
            ))}

            {/* Placeholder quando não há nós */}
            {flowData.nodes.length === 1 && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <Workflow className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-muted-foreground mb-2">
                    Construa seu Fluxo de Automação
                  </h3>
                  <p className="text-muted-foreground mb-4">
                    Adicione nós da barra lateral para criar sua sequência automatizada
                  </p>
                  <Button disabled={messagesFeatureBlocked} title={messagesFeatureBlocked ? 'Envio de mensagens indisponível no seu plano' : undefined} onClick={() => {
                    if (messagesFeatureBlocked) {
                      toast.info('Recurso indisponível no seu plano: envio de mensagens está bloqueado.')
                      return
                    }
                    addNode('message')
                  }} className="gap-2">
                    <Plus className="h-4 w-4" />
                    Adicionar Primeiro Nó
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Dialog para editar nó */}
      <Dialog open={showNodeDialog} onOpenChange={setShowNodeDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Configurar {selectedNode?.title}</DialogTitle>
            <DialogDescription>
              Configure as propriedades deste nó
            </DialogDescription>
          </DialogHeader>
          
          {selectedNode?.type === 'message' && messagesFeatureBlocked && (
            <div className="rounded-md border border-yellow-300 bg-yellow-50 p-3 text-sm text-yellow-900">
              O envio de mensagens está bloqueado no seu plano. Você pode configurar o conteúdo do nó, mas o fluxo não enviará mensagens enquanto o bloqueio persistir.
            </div>
          )}
          
          {selectedNode && (
            <Tabs defaultValue="general" className="space-y-4">
              <TabsList>
                <TabsTrigger value="general">Geral</TabsTrigger>
                <TabsTrigger value="config">Configuração</TabsTrigger>
                <TabsTrigger value="conditions">Condições</TabsTrigger>
              </TabsList>
              
              <TabsContent value="general" className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Título</label>
                  <Input 
                    value={selectedNode.title}
                    onChange={(e) => setSelectedNode(prev => prev ? { ...prev, title: e.target.value } : null)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Descrição</label>
                  <Textarea 
                    value={selectedNode.description || ''}
                    onChange={(e) => setSelectedNode(prev => prev ? { ...prev, description: e.target.value } : null)}
                  />
                </div>
              </TabsContent>
              
              <TabsContent value="config" className="space-y-4">
                {selectedNode.type === 'message' && (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Conteúdo da Mensagem</label>
                      <Textarea 
                        placeholder="Digite a mensagem que será enviada..."
                        rows={4}
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Tipo de Mensagem</label>
                      <Select>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o tipo" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="text">Texto</SelectItem>
                          <SelectItem value="image">Imagem</SelectItem>
                          <SelectItem value="document">Documento</SelectItem>
                          <SelectItem value="template">Template</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}
                
                {selectedNode.type === 'delay' && (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Tempo de Espera</label>
                      <div className="flex gap-2">
                        <Input type="number" placeholder="1" className="w-20" />
                        <Select>
                          <SelectTrigger className="w-32">
                            <SelectValue placeholder="Unidade" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="minutes">Minutos</SelectItem>
                            <SelectItem value="hours">Horas</SelectItem>
                            <SelectItem value="days">Dias</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                )}
                
                {selectedNode.type === 'condition' && (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Tipo de Condição</label>
                      <Select>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione a condição" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="tag">Possui Tag</SelectItem>
                          <SelectItem value="field">Campo Personalizado</SelectItem>
                          <SelectItem value="interaction">Última Interação</SelectItem>
                          <SelectItem value="time">Horário</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}
              </TabsContent>
              
              <TabsContent value="conditions" className="space-y-4">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Condições de Execução</label>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <input type="checkbox" id="business-hours" />
                        <label htmlFor="business-hours" className="text-sm">
                          Apenas em horário comercial
                        </label>
                      </div>
                      <div className="flex items-center gap-2">
                        <input type="checkbox" id="weekdays" />
                        <label htmlFor="weekdays" className="text-sm">
                          Apenas em dias úteis
                        </label>
                      </div>
                      <div className="flex items-center gap-2">
                        <input type="checkbox" id="active-contacts" />
                        <label htmlFor="active-contacts" className="text-sm">
                          Apenas contatos ativos
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          )}
          
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setShowNodeDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={() => {
              if (selectedNode) {
                setFlowData(prev => ({
                  ...prev,
                  nodes: prev.nodes.map(node => 
                    node.id === selectedNode.id ? selectedNode : node
                  ),
                  lastModified: new Date().toISOString()
                }))
              }
              setShowNodeDialog(false)
            }}>
              Salvar Configurações
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}