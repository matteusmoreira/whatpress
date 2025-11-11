import React, { useCallback, useState, useRef, useEffect } from 'react'
import ReactFlow, {
  ReactFlowProvider,
  addEdge,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  Handle,
  Position,
  Node,
  Edge,
  Connection,
  NodeTypes,
  ConnectionMode,
  Panel,
  useReactFlow
} from 'reactflow'
import 'reactflow/dist/style.css'
import { 
  Play, 
  Save, 
  Download, 
  Upload, 
  Trash2, 
  Copy, 
  Settings,
  Plus,
  MessageSquare,
  Clock,
  GitBranch,
  Zap,
  User,
  Tag,
  Webhook,
  Pause,
  CheckCircle,
  AlertCircle
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Flow, FlowNode, FlowEdge, FLOW_NODE_TYPES, FLOW_STATUSES } from '@/lib/flows'

// Componentes de nó customizados
const CustomNode = ({ data, type, selected }: { data: any; type: string; selected?: boolean }) => {
  const getNodeIcon = () => {
    switch (type) {
      case FLOW_NODE_TYPES.START:
        return <Play className="w-4 h-4 text-green-600" />
      case FLOW_NODE_TYPES.END:
        return <CheckCircle className="w-4 h-4 text-red-600" />
      case FLOW_NODE_TYPES.ACTION_SEND_MESSAGE:
        return <MessageSquare className="w-4 h-4 text-blue-600" />
      case FLOW_NODE_TYPES.ACTION_DELAY:
        return <Clock className="w-4 h-4 text-orange-600" />
      case FLOW_NODE_TYPES.CONDITION_IF:
        return <GitBranch className="w-4 h-4 text-purple-600" />
      case FLOW_NODE_TYPES.TRIGGER_WEBHOOK:
        return <Webhook className="w-4 h-4 text-indigo-600" />
      case FLOW_NODE_TYPES.TRIGGER_SCHEDULE:
        return <Clock className="w-4 h-4 text-teal-600" />
      case FLOW_NODE_TYPES.ACTION_UPDATE_CONTACT:
        return <User className="w-4 h-4 text-cyan-600" />
      case FLOW_NODE_TYPES.ACTION_ADD_TAG:
        return <Tag className="w-4 h-4 text-pink-600" />
      default:
        return <Zap className="w-4 h-4 text-gray-600" />
    }
  }

  const getNodeColor = () => {
    switch (type) {
      case FLOW_NODE_TYPES.START:
        return 'bg-green-50 border-green-200'
      case FLOW_NODE_TYPES.END:
        return 'bg-red-50 border-red-200'
      case FLOW_NODE_TYPES.ACTION_SEND_MESSAGE:
        return 'bg-blue-50 border-blue-200'
      case FLOW_NODE_TYPES.ACTION_DELAY:
        return 'bg-orange-50 border-orange-200'
      case FLOW_NODE_TYPES.CONDITION_IF:
        return 'bg-purple-50 border-purple-200'
      default:
        return 'bg-gray-50 border-gray-200'
    }
  }

  return (
    <div className={cn(
      "px-4 py-3 rounded-lg border-2 min-w-[150px]",
      getNodeColor(),
      selected && "ring-2 ring-blue-500",
      "shadow-sm hover:shadow-md transition-shadow"
    )}>
      <Handle
        type="target"
        position={Position.Top}
        className="w-3 h-3 bg-gray-400"
      />
      
      <div className="flex items-center gap-2 mb-2">
        {getNodeIcon()}
        <span className="font-medium text-sm text-gray-900">{data.label}</span>
      </div>
      
      {data.description && (
        <p className="text-xs text-gray-600 mb-2">{data.description}</p>
      )}
      
      {type === FLOW_NODE_TYPES.ACTION_SEND_MESSAGE && data.config?.channel && (
        <div className="text-xs text-gray-500 bg-white px-2 py-1 rounded border">
          Canal: {data.config.channel}
        </div>
      )}
      
      {type === FLOW_NODE_TYPES.ACTION_DELAY && data.config?.duration && (
        <div className="text-xs text-gray-500 bg-white px-2 py-1 rounded border">
          Delay: {data.config.duration}ms
        </div>
      )}
      
      <Handle
        type="source"
        position={Position.Bottom}
        className="w-3 h-3 bg-gray-400"
      />
    </div>
  )
}

// Paleta de nós
const NodePalette = ({ onAddNode }: { onAddNode: (type: string, position: { x: number; y: number }) => void }) => {
  const nodeTypes = [
    { type: FLOW_NODE_TYPES.START, label: 'Início', icon: <Play className="w-4 h-4" />, color: 'text-green-600' },
    { type: FLOW_NODE_TYPES.END, label: 'Fim', icon: <CheckCircle className="w-4 h-4" />, color: 'text-red-600' },
    { type: FLOW_NODE_TYPES.ACTION_SEND_MESSAGE, label: 'Enviar Mensagem', icon: <MessageSquare className="w-4 h-4" />, color: 'text-blue-600' },
    { type: FLOW_NODE_TYPES.ACTION_DELAY, label: 'Delay', icon: <Clock className="w-4 h-4" />, color: 'text-orange-600' },
    { type: FLOW_NODE_TYPES.CONDITION_IF, label: 'Condição If', icon: <GitBranch className="w-4 h-4" />, color: 'text-purple-600' },
    { type: FLOW_NODE_TYPES.TRIGGER_SCHEDULE, label: 'Agendamento', icon: <Clock className="w-4 h-4" />, color: 'text-teal-600' },
    { type: FLOW_NODE_TYPES.ACTION_UPDATE_CONTACT, label: 'Atualizar Contato', icon: <User className="w-4 h-4" />, color: 'text-cyan-600' },
    { type: FLOW_NODE_TYPES.ACTION_ADD_TAG, label: 'Adicionar Tag', icon: <Tag className="w-4 h-4" />, color: 'text-pink-600' },
  ]

  const handleDragStart = (e: React.DragEvent, nodeType: string) => {
    e.dataTransfer.setData('application/reactflow', nodeType)
    e.dataTransfer.effectAllowed = 'move'
  }

  return (
    <div className="bg-white border-r border-gray-200 p-4 w-64">
      <h3 className="font-semibold text-gray-900 mb-4">Componentes</h3>
      <div className="space-y-2">
        {nodeTypes.map((node) => (
          <div
            key={node.type}
            className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:bg-gray-50 cursor-move transition-colors"
            draggable
            onDragStart={(e) => handleDragStart(e, node.type)}
          >
            <div className={node.color}>{node.icon}</div>
            <span className="text-sm font-medium text-gray-700">{node.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// Painel de propriedades
const PropertiesPanel = ({ selectedNode, onUpdateNode, onDeleteNode }: {
  selectedNode: Node | null
  onUpdateNode: (nodeId: string, data: any) => void
  onDeleteNode: (nodeId: string) => void
}) => {
  const [formData, setFormData] = useState<any>({})

  useEffect(() => {
    if (selectedNode) {
      setFormData(selectedNode.data || {})
    }
  }, [selectedNode])

  if (!selectedNode) {
    return (
      <div className="bg-white border-l border-gray-200 p-4 w-80">
        <p className="text-gray-500 text-sm">Selecione um nó para editar suas propriedades</p>
      </div>
    )
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onUpdateNode(selectedNode.id, formData)
  }

  const renderConfigFields = () => {
    switch (selectedNode.type) {
      case FLOW_NODE_TYPES.ACTION_SEND_MESSAGE:
        return (
          <>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Canal</label>
              <select
                value={formData.config?.channel || 'whatsapp'}
                onChange={(e) => setFormData({
                  ...formData,
                  config: { ...formData.config, channel: e.target.value }
                })}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="whatsapp">WhatsApp</option>
                <option value="email">Email</option>
                <option value="sms">SMS</option>
              </select>
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Mensagem</label>
              <textarea
                value={formData.config?.message || ''}
                onChange={(e) => setFormData({
                  ...formData,
                  config: { ...formData.config, message: e.target.value }
                })}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Digite sua mensagem... Use {{variavel}} para variáveis"
              />
            </div>
          </>
        )

      case FLOW_NODE_TYPES.ACTION_DELAY:
        return (
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">Duração (ms)</label>
            <input
              type="number"
              value={formData.config?.duration || 0}
              onChange={(e) => setFormData({
                ...formData,
                config: { ...formData.config, duration: parseInt(e.target.value) || 0 }
              })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Ex: 5000 para 5 segundos"
            />
          </div>
        )

      case FLOW_NODE_TYPES.CONDITION_IF:
        return (
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">Condição</label>
            <input
              type="text"
              value={formData.config?.condition || ''}
              onChange={(e) => setFormData({
                ...formData,
                config: { ...formData.config, condition: e.target.value }
              })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Ex: contact.tags.includes('vip')"
            />
          </div>
        )

      default:
        return null
    }
  }

  return (
    <div className="bg-white border-l border-gray-200 p-4 w-80">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900">Propriedades</h3>
        <button
          onClick={() => onDeleteNode(selectedNode.id)}
          className="p-1 text-red-600 hover:bg-red-50 rounded"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Nome</label>
          <input
            type="text"
            value={formData.label || ''}
            onChange={(e) => setFormData({ ...formData, label: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Descrição</label>
          <textarea
            value={formData.description || ''}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            rows={2}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {renderConfigFields()}

        <button
          type="submit"
          className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors"
        >
          Salvar Alterações
        </button>
      </form>
    </div>
  )
}

// Barra de ferramentas
const Toolbar = ({ flow, onSave, onTest, onImport, onExport }: {
  flow: Flow | null
  onSave: () => void
  onTest: () => void
  onImport: () => void
  onExport: () => void
}) => {
  return (
    <div className="bg-white border-b border-gray-200 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h2 className="text-xl font-semibold text-gray-900">
            {flow?.name || 'Novo Fluxo'}
          </h2>
          {flow && (
            <span className={`px-2 py-1 text-xs font-medium rounded-full ${
              flow.status === FLOW_STATUSES.ACTIVE 
                ? 'bg-green-100 text-green-800'
                : flow.status === FLOW_STATUSES.PAUSED
                ? 'bg-yellow-100 text-yellow-800'
                : 'bg-gray-100 text-gray-800'
            }`}>
              {flow.status}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onImport}
            className="flex items-center gap-2 px-3 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
          >
            <Upload className="w-4 h-4" />
            Importar
          </button>
          
          <button
            onClick={onExport}
            className="flex items-center gap-2 px-3 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
          >
            <Download className="w-4 h-4" />
            Exportar
          </button>
          
          <button
            onClick={onTest}
            className="flex items-center gap-2 px-3 py-2 text-blue-700 bg-blue-100 rounded-md hover:bg-blue-200 transition-colors"
          >
            <Play className="w-4 h-4" />
            Testar
          </button>
          
          <button
            onClick={onSave}
            className="flex items-center gap-2 px-4 py-2 text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors"
          >
            <Save className="w-4 h-4" />
            Salvar
          </button>
        </div>
      </div>
    </div>
  )
}

// Componente principal do Flow Builder
const FlowBuilderCore = ({ 
  initialFlow,
  onSave,
  onTest,
  onImport,
  onExport
}: {
  initialFlow?: Flow
  onSave: (flow: Flow) => void
  onTest: (flow: Flow) => void
  onImport: (data: any) => void
  onExport: (flow: Flow) => void
}) => {
  const reactFlowWrapper = useRef<HTMLDivElement>(null)
  const [nodes, setNodes, onNodesChange] = useNodesState(initialFlow?.nodes || [])
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialFlow?.edges || [])
  const [selectedNode, setSelectedNode] = useState<Node | null>(null)
  const { screenToFlowPosition } = useReactFlow()

  const nodeTypes: NodeTypes = {
    [FLOW_NODE_TYPES.START]: (props) => <CustomNode {...props} type={FLOW_NODE_TYPES.START} />,
    [FLOW_NODE_TYPES.END]: (props) => <CustomNode {...props} type={FLOW_NODE_TYPES.END} />,
    [FLOW_NODE_TYPES.ACTION_SEND_MESSAGE]: (props) => <CustomNode {...props} type={FLOW_NODE_TYPES.ACTION_SEND_MESSAGE} />,
    [FLOW_NODE_TYPES.ACTION_DELAY]: (props) => <CustomNode {...props} type={FLOW_NODE_TYPES.ACTION_DELAY} />,
    [FLOW_NODE_TYPES.CONDITION_IF]: (props) => <CustomNode {...props} type={FLOW_NODE_TYPES.CONDITION_IF} />,
    [FLOW_NODE_TYPES.TRIGGER_SCHEDULE]: (props) => <CustomNode {...props} type={FLOW_NODE_TYPES.TRIGGER_SCHEDULE} />,
    [FLOW_NODE_TYPES.ACTION_UPDATE_CONTACT]: (props) => <CustomNode {...props} type={FLOW_NODE_TYPES.ACTION_UPDATE_CONTACT} />,
    [FLOW_NODE_TYPES.ACTION_ADD_TAG]: (props) => <CustomNode {...props} type={FLOW_NODE_TYPES.ACTION_ADD_TAG} />,
  }

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  )

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
  }, [])

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault()

      const type = event.dataTransfer.getData('application/reactflow')

      if (typeof type === 'undefined' || !type) {
        return
      }

      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      })

      const newNode: Node = {
        id: `${type}_${Date.now()}`,
        type,
        position,
        data: {
          label: type.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' '),
          config: {}
        },
      }

      setNodes((nds) => nds.concat(newNode))
    },
    [screenToFlowPosition, setNodes]
  )

  const onNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
    setSelectedNode(node)
  }, [])

  const updateNode = useCallback((nodeId: string, data: any) => {
    setNodes((nds) =>
      nds.map((node) => {
        if (node.id === nodeId) {
          return { ...node, data: { ...node.data, ...data } }
        }
        return node
      })
    )
    setSelectedNode(null)
    toast.success('Nó atualizado com sucesso!')
  }, [setNodes])

  const deleteNode = useCallback((nodeId: string) => {
    setNodes((nds) => nds.filter((node) => node.id !== nodeId))
    setEdges((eds) => eds.filter((edge) => edge.source !== nodeId && edge.target !== nodeId))
    setSelectedNode(null)
    toast.success('Nó removido com sucesso!')
  }, [setNodes, setEdges])

  const handleSave = () => {
    const flow: Flow = {
      id: initialFlow?.id || '',
      name: initialFlow?.name || 'Novo Fluxo',
      description: initialFlow?.description || '',
      tenantId: initialFlow?.tenantId || '',
      createdBy: initialFlow?.createdBy || '',
      nodes: nodes.map(node => ({
        id: node.id,
        type: node.type as any,
        position: node.position,
        data: node.data
      })),
      edges: edges.map(edge => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        sourceHandle: edge.sourceHandle,
        targetHandle: edge.targetHandle,
        type: edge.type,
        label: edge.label,
        condition: (edge as any).condition
      })),
      status: initialFlow?.status || FLOW_STATUSES.DRAFT,
      version: initialFlow?.version || 1,
      variablesSchema: initialFlow?.variablesSchema || {},
      metadata: initialFlow?.metadata || {},
      createdAt: initialFlow?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
    
    onSave(flow)
  }

  const handleTest = () => {
    const flow: Flow = {
      id: initialFlow?.id || '',
      name: initialFlow?.name || 'Novo Fluxo',
      description: initialFlow?.description || '',
      tenantId: initialFlow?.tenantId || '',
      createdBy: initialFlow?.createdBy || '',
      nodes: nodes.map(node => ({
        id: node.id,
        type: node.type as any,
        position: node.position,
        data: node.data
      })),
      edges: edges.map(edge => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        sourceHandle: edge.sourceHandle,
        targetHandle: edge.targetHandle,
        type: edge.type,
        label: edge.label,
        condition: (edge as any).condition
      })),
      status: initialFlow?.status || FLOW_STATUSES.DRAFT,
      version: initialFlow?.version || 1,
      variablesSchema: initialFlow?.variablesSchema || {},
      metadata: initialFlow?.metadata || {},
      createdAt: initialFlow?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
    
    onTest(flow)
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <Toolbar
        flow={initialFlow}
        onSave={handleSave}
        onTest={handleTest}
        onImport={onImport}
        onExport={onExport}
      />
      
      <div className="flex flex-1 overflow-hidden">
        <NodePalette onAddNode={(type, position) => {
          const newNode: Node = {
            id: `${type}_${Date.now()}`,
            type,
            position,
            data: {
              label: type.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' '),
              config: {}
            },
          }
          setNodes((nds) => nds.concat(newNode))
        }} />
        
        <div className="flex-1" ref={reactFlowWrapper}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onDragOver={onDragOver}
            onDrop={onDrop}
            onNodeClick={onNodeClick}
            nodeTypes={nodeTypes}
            connectionMode={ConnectionMode.Loose}
            fitView
            className="bg-gray-50"
          >
            <Background color="#aaa" gap={16} />
            <Controls />
            <MiniMap 
              nodeColor={(node) => {
                switch (node.type) {
                  case FLOW_NODE_TYPES.START:
                    return '#10b981'
                  case FLOW_NODE_TYPES.END:
                    return '#ef4444'
                  case FLOW_NODE_TYPES.ACTION_SEND_MESSAGE:
                    return '#3b82f6'
                  case FLOW_NODE_TYPES.ACTION_DELAY:
                    return '#f59e0b'
                  case FLOW_NODE_TYPES.CONDITION_IF:
                    return '#8b5cf6'
                  default:
                    return '#6b7280'
                }
              }}
              nodeStrokeWidth={3}
            />
          </ReactFlow>
        </div>
        
        <PropertiesPanel
          selectedNode={selectedNode}
          onUpdateNode={updateNode}
          onDeleteNode={deleteNode}
        />
      </div>
    </div>
  )
}

// Componente principal exportado
export const FlowBuilder = ({ 
  flow,
  onSave,
  onTest,
  onImport,
  onExport
}: {
  flow?: Flow
  onSave: (flow: Flow) => void
  onTest: (flow: Flow) => void
  onImport: (data: any) => void
  onExport: (flow: Flow) => void
}) => {
  return (
    <ReactFlowProvider>
      <FlowBuilderCore
        initialFlow={flow}
        onSave={onSave}
        onTest={onTest}
        onImport={onImport}
        onExport={onExport}
      />
    </ReactFlowProvider>
  )
}