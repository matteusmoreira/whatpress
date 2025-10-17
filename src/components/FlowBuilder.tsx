import React, { useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { 
  Plus, 
  X, 
  ArrowDown, 
  ArrowRight,
  MessageSquare,
  Clock,
  Tag,
  UserPlus,
  Send,
  Timer,
  GitBranch,
  Settings,
  Play,
  Pause
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
} from '@/components/ui/dialog'
import { AutomationAction, AutomationCondition } from '@/hooks/useAutomations'

interface FlowNode {
  id: string
  type: 'action' | 'condition' | 'delay'
  data: AutomationAction | AutomationCondition | { delay: { amount: number; unit: string } }
  position: { x: number; y: number }
  connections: string[]
}

interface FlowBuilderProps {
  actions: AutomationAction[]
  conditions?: AutomationCondition[]
  onChange: (actions: AutomationAction[], conditions?: AutomationCondition[]) => void
  className?: string
}

const ACTION_TYPES = [
  { id: 'send_message', name: 'Enviar Mensagem', icon: Send, color: 'bg-blue-100 text-blue-700' },
  { id: 'add_tag', name: 'Adicionar Tag', icon: Tag, color: 'bg-green-100 text-green-700' },
  { id: 'remove_tag', name: 'Remover Tag', icon: X, color: 'bg-red-100 text-red-700' },
  { id: 'update_contact', name: 'Atualizar Contato', icon: UserPlus, color: 'bg-purple-100 text-purple-700' },
  { id: 'delay', name: 'Aguardar', icon: Timer, color: 'bg-orange-100 text-orange-700' },
  { id: 'webhook', name: 'Webhook', icon: GitBranch, color: 'bg-gray-100 text-gray-700' }
]

export default function FlowBuilder({ actions, conditions = [], onChange, className }: FlowBuilderProps) {
  const [nodes, setNodes] = useState<FlowNode[]>([])
  const [selectedNode, setSelectedNode] = useState<FlowNode | null>(null)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [editingAction, setEditingAction] = useState<AutomationAction | null>(null)

  // Inicializar nodes baseado nas actions
  React.useEffect(() => {
    const initialNodes: FlowNode[] = actions.map((action, index) => ({
      id: `node-${index}`,
      type: 'action',
      data: action,
      position: { x: 100, y: 100 + (index * 150) },
      connections: index < actions.length - 1 ? [`node-${index + 1}`] : []
    }))
    setNodes(initialNodes)
  }, [actions])

  const addAction = useCallback((type: string) => {
    const newAction: AutomationAction = {
      type: type as any,
      config: {}
    }

    const newNode: FlowNode = {
      id: `node-${Date.now()}`,
      type: 'action',
      data: newAction,
      position: { x: 100, y: 100 + (nodes.length * 150) },
      connections: []
    }

    // Conectar o último node ao novo
    const updatedNodes = nodes.map((node, index) => {
      if (index === nodes.length - 1) {
        return { ...node, connections: [newNode.id] }
      }
      return node
    })

    const finalNodes = [...updatedNodes, newNode]
    setNodes(finalNodes)

    // Atualizar actions
    const newActions = finalNodes
      .filter(node => node.type === 'action')
      .map(node => node.data as AutomationAction)
    
    onChange(newActions, conditions)
  }, [nodes, conditions, onChange])

  const removeNode = useCallback((nodeId: string) => {
    const updatedNodes = nodes.filter(node => node.id !== nodeId)
    
    // Remover conexões para o node removido
    const finalNodes = updatedNodes.map(node => ({
      ...node,
      connections: node.connections.filter(conn => conn !== nodeId)
    }))

    setNodes(finalNodes)

    // Atualizar actions
    const newActions = finalNodes
      .filter(node => node.type === 'action')
      .map(node => node.data as AutomationAction)
    
    onChange(newActions, conditions)
  }, [nodes, conditions, onChange])

  const editAction = useCallback((node: FlowNode) => {
    if (node.type === 'action') {
      setEditingAction(node.data as AutomationAction)
      setSelectedNode(node)
      setEditDialogOpen(true)
    }
  }, [])

  const saveAction = useCallback((updatedAction: AutomationAction) => {
    if (!selectedNode) return

    const updatedNodes = nodes.map(node => 
      node.id === selectedNode.id 
        ? { ...node, data: updatedAction }
        : node
    )

    setNodes(updatedNodes)

    // Atualizar actions
    const newActions = updatedNodes
      .filter(node => node.type === 'action')
      .map(node => node.data as AutomationAction)
    
    onChange(newActions, conditions)
    setEditDialogOpen(false)
    setEditingAction(null)
    setSelectedNode(null)
  }, [selectedNode, nodes, conditions, onChange])

  const getActionIcon = (type: string) => {
    const actionType = ACTION_TYPES.find(at => at.id === type)
    return actionType ? actionType.icon : MessageSquare
  }

  const getActionColor = (type: string) => {
    const actionType = ACTION_TYPES.find(at => at.id === type)
    return actionType ? actionType.color : 'bg-gray-100 text-gray-700'
  }

  const getActionName = (type: string) => {
    const actionType = ACTION_TYPES.find(at => at.id === type)
    return actionType ? actionType.name : type
  }

  const renderActionContent = (action: AutomationAction) => {
    switch (action.type) {
      case 'send_message':
        return action.config.message?.content || 'Configurar mensagem'
      case 'add_tag':
        return `Tags: ${action.config.tags?.join(', ') || 'Configurar tags'}`
      case 'remove_tag':
        return `Remover: ${action.config.tags?.join(', ') || 'Configurar tags'}`
      case 'delay':
        return `Aguardar ${action.config.delay?.amount || 0} ${action.config.delay?.unit || 'minutos'}`
      case 'webhook':
        return action.config.webhook?.url || 'Configurar webhook'
      default:
        return 'Configurar ação'
    }
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Flow Builder</h3>
        <div className="flex gap-2">
          {ACTION_TYPES.map(actionType => (
            <Button
              key={actionType.id}
              variant="outline"
              size="sm"
              onClick={() => addAction(actionType.id)}
              className="gap-2"
            >
              <actionType.icon className="h-4 w-4" />
              {actionType.name}
            </Button>
          ))}
        </div>
      </div>

      {/* Flow Canvas */}
      <div className="min-h-[400px] border-2 border-dashed border-gray-200 rounded-lg p-4 bg-gray-50/50">
        {nodes.length === 0 ? (
          <div className="flex items-center justify-center h-64 text-gray-500">
            <div className="text-center">
              <MessageSquare className="h-12 w-12 mx-auto mb-4 text-gray-400" />
              <p className="text-lg font-medium">Nenhuma ação configurada</p>
              <p className="text-sm">Adicione ações para criar seu fluxo de automação</p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {nodes.map((node, index) => {
              const action = node.data as AutomationAction
              const Icon = getActionIcon(action.type)
              
              return (
                <div key={node.id} className="flex items-center gap-4">
                  {/* Node */}
                  <Card className="w-80 cursor-pointer hover:shadow-md transition-shadow">
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className={`p-2 rounded-lg ${getActionColor(action.type)}`}>
                            <Icon className="h-4 w-4" />
                          </div>
                          <div>
                            <CardTitle className="text-sm">{getActionName(action.type)}</CardTitle>
                            <Badge variant="outline" className="text-xs">
                              Ação {index + 1}
                            </Badge>
                          </div>
                        </div>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => editAction(node)}
                          >
                            <Settings className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeNode(node.id)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <p className="text-sm text-gray-600 truncate">
                        {renderActionContent(action)}
                      </p>
                    </CardContent>
                  </Card>

                  {/* Connection Arrow */}
                  {index < nodes.length - 1 && (
                    <ArrowDown className="h-6 w-6 text-gray-400" />
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Edit Action Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Configurar Ação</DialogTitle>
            <DialogDescription>
              Configure os detalhes da ação selecionada
            </DialogDescription>
          </DialogHeader>

          {editingAction && (
            <div className="space-y-4">
              {editingAction.type === 'send_message' && (
                <div className="space-y-2">
                  <Label htmlFor="message-content">Mensagem</Label>
                  <Textarea
                    id="message-content"
                    placeholder="Digite sua mensagem..."
                    value={editingAction.config.message?.content || ''}
                    onChange={(e) => setEditingAction({
                      ...editingAction,
                      config: {
                        ...editingAction.config,
                        message: {
                          ...editingAction.config.message,
                          content: e.target.value
                        }
                      }
                    })}
                  />
                </div>
              )}

              {(editingAction.type === 'add_tag' || editingAction.type === 'remove_tag') && (
                <div className="space-y-2">
                  <Label htmlFor="tags">Tags (separadas por vírgula)</Label>
                  <Input
                    id="tags"
                    placeholder="tag1, tag2, tag3"
                    value={editingAction.config.tags?.join(', ') || ''}
                    onChange={(e) => setEditingAction({
                      ...editingAction,
                      config: {
                        ...editingAction.config,
                        tags: e.target.value.split(',').map(tag => tag.trim()).filter(Boolean)
                      }
                    })}
                  />
                </div>
              )}

              {editingAction.type === 'delay' && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="delay-amount">Quantidade</Label>
                    <Input
                      id="delay-amount"
                      type="number"
                      min="1"
                      value={editingAction.config.delay?.amount || 1}
                      onChange={(e) => setEditingAction({
                        ...editingAction,
                        config: {
                          ...editingAction.config,
                          delay: {
                            ...editingAction.config.delay,
                            amount: parseInt(e.target.value) || 1,
                            unit: editingAction.config.delay?.unit || 'minutes'
                          }
                        }
                      })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="delay-unit">Unidade</Label>
                    <Select
                      value={editingAction.config.delay?.unit || 'minutes'}
                      onValueChange={(value) => setEditingAction({
                        ...editingAction,
                        config: {
                          ...editingAction.config,
                          delay: {
                            ...editingAction.config.delay,
                            amount: editingAction.config.delay?.amount || 1,
                            unit: value as 'minutes' | 'hours' | 'days'
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

              {editingAction.type === 'webhook' && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="webhook-url">URL do Webhook</Label>
                    <Input
                      id="webhook-url"
                      placeholder="https://exemplo.com/webhook"
                      value={editingAction.config.webhook?.url || ''}
                      onChange={(e) => setEditingAction({
                        ...editingAction,
                        config: {
                          ...editingAction.config,
                          webhook: {
                            ...editingAction.config.webhook,
                            url: e.target.value,
                            method: editingAction.config.webhook?.method || 'POST'
                          }
                        }
                      })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="webhook-method">Método</Label>
                    <Select
                      value={editingAction.config.webhook?.method || 'POST'}
                      onValueChange={(value) => setEditingAction({
                        ...editingAction,
                        config: {
                          ...editingAction.config,
                          webhook: {
                            ...editingAction.config.webhook,
                            url: editingAction.config.webhook?.url || '',
                            method: value as 'GET' | 'POST'
                          }
                        }
                      })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="GET">GET</SelectItem>
                        <SelectItem value="POST">POST</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={() => editingAction && saveAction(editingAction)}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}