import React, { useState, useEffect } from 'react'
import { 
  Plus, 
  Search, 
  Filter, 
  Play, 
  Pause, 
  Trash2, 
  Edit3, 
  Download, 
  Upload,
  Copy,
  Eye,
  Clock,
  CheckCircle,
  AlertCircle,
  MoreVertical,
  Settings,
  Zap,
  MessageSquare,
  GitBranch,
  Clock3
} from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import { Flow, FLOW_STATUSES, FLOW_TEMPLATES } from '@/lib/flows'
import { useFlows } from '@/hooks/useFlows'
import { FlowBuilder } from './FlowBuilder'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface FlowManagerProps {
  onFlowSelect?: (flow: Flow) => void
  selectedFlowId?: string
}

export function FlowManager({ onFlowSelect, selectedFlowId }: FlowManagerProps) {
  const { 
    flows, 
    isLoading, 
    error, 
    createFlow, 
    updateFlow, 
    deleteFlow, 
    getFlow, 
    executeFlow, 
    useTemplate,
    validateFlow,
    importFlow,
    exportFlow,
    refetch 
  } = useFlows()

  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [selectedFlow, setSelectedFlow] = useState<Flow | null>(null)
  const [isBuilderOpen, setIsBuilderOpen] = useState(false)
  const [isTemplateDialogOpen, setIsTemplateDialogOpen] = useState(false)
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false)
  const [importFile, setImportFile] = useState<File | null>(null)
  const [newFlowName, setNewFlowName] = useState('')
  const [newFlowDescription, setNewFlowDescription] = useState('')

  // Filtrar fluxos
  const filteredFlows = flows.filter(flow => {
    const matchesSearch = flow.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         flow.description?.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesStatus = statusFilter === 'all' || flow.status === statusFilter
    const matchesCategory = categoryFilter === 'all' || flow.metadata?.category === categoryFilter

    return matchesSearch && matchesStatus && matchesCategory
  })

  // Categorias únicas
  const categories = Array.from(new Set(flows.map(flow => flow.metadata?.category).filter(Boolean)))

  const handleCreateFlow = async () => {
    if (!newFlowName.trim()) {
      toast.error('Nome do fluxo é obrigatório')
      return
    }

    const newFlow = await createFlow({
      name: newFlowName,
      description: newFlowDescription,
      nodes: [],
      edges: [],
      status: FLOW_STATUSES.DRAFT
    })

    if (newFlow) {
      setNewFlowName('')
      setNewFlowDescription('')
      setSelectedFlow(newFlow)
      setIsBuilderOpen(true)
    }
  }

  const handleUseTemplate = async (templateKey: keyof typeof FLOW_TEMPLATES) => {
    const template = FLOW_TEMPLATES[templateKey]
    const flow = await useTemplate(templateKey, {
      name: `${template.name} - Cópia`,
      description: template.description
    })

    if (flow) {
      setSelectedFlow(flow)
      setIsBuilderOpen(true)
      setIsTemplateDialogOpen(false)
    }
  }

  const handleSaveFlow = async (flow: Flow) => {
    if (selectedFlow) {
      const updatedFlow = await updateFlow(selectedFlow.id, flow)
      if (updatedFlow) {
        setSelectedFlow(updatedFlow)
        toast.success('Fluxo salvo com sucesso!')
      }
    }
  }

  const handleTestFlow = async (flow: Flow) => {
    // Validar fluxo antes de testar
    const validation = validateFlow(flow)
    if (!validation.valid) {
      toast.error(`Fluxo inválido: ${validation.errors.join(', ')}`)
      return
    }

    const executionId = await executeFlow(flow.id, {
      variables: { test: true },
      contact: { id: 'test-contact', name: 'Teste', phone: '5511999999999' }
    })

    if (executionId) {
      toast.success('Teste iniciado! Verifique os logs de execução.')
    }
  }

  const handleExportFlow = async (flow: Flow) => {
    const exportData = await exportFlow(flow.id)
    if (exportData) {
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${flow.name.replace(/\s+/g, '_')}.json`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('Fluxo exportado com sucesso!')
    }
  }

  const handleImportFlow = async () => {
    if (!importFile) {
      toast.error('Selecione um arquivo para importar')
      return
    }

    try {
      const text = await importFile.text()
      const flowData = JSON.parse(text)
      
      const importedFlow = await importFlow(flowData)
      if (importedFlow) {
        setIsImportDialogOpen(false)
        setImportFile(null)
        toast.success('Fluxo importado com sucesso!')
      }
    } catch (error) {
      toast.error('Erro ao importar fluxo: formato inválido')
    }
  }

  const handleDeleteFlow = async (flowId: string) => {
    if (confirm('Tem certeza que deseja excluir este fluxo?')) {
      const success = await deleteFlow(flowId)
      if (success) {
        toast.success('Fluxo excluído com sucesso!')
      }
    }
  }

  const handleExecuteFlow = async (flowId: string) => {
    const executionId = await executeFlow(flowId)
    if (executionId) {
      toast.success('Fluxo executado com sucesso!')
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case FLOW_STATUSES.ACTIVE:
        return 'bg-green-100 text-green-800'
      case FLOW_STATUSES.PAUSED:
        return 'bg-yellow-100 text-yellow-800'
      case FLOW_STATUSES.DRAFT:
        return 'bg-blue-100 text-blue-800'
      case FLOW_STATUSES.ARCHIVED:
        return 'bg-gray-100 text-gray-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case FLOW_STATUSES.ACTIVE:
        return <CheckCircle className="w-3 h-3" />
      case FLOW_STATUSES.PAUSED:
        return <Pause className="w-3 h-3" />
      case FLOW_STATUSES.DRAFT:
        return <Clock3 className="w-3 h-3" />
      default:
        return null
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <p className="text-gray-600">{error}</p>
        <Button onClick={refetch} className="mt-4">
          Tentar Novamente
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Fluxos de Automação</h2>
          <p className="text-gray-600">Crie e gerencie fluxos automatizados para suas campanhas</p>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setIsImportDialogOpen(true)}
          >
            <Upload className="w-4 h-4 mr-2" />
            Importar
          </Button>
          
          <Button
            variant="outline"
            onClick={() => setIsTemplateDialogOpen(true)}
          >
            <Copy className="w-4 h-4 mr-2" />
            Templates
          </Button>
          
          <Button onClick={() => setIsBuilderOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Novo Fluxo
          </Button>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <Input
            placeholder="Buscar fluxos..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos Status</SelectItem>
            <SelectItem value={FLOW_STATUSES.DRAFT}>Rascunho</SelectItem>
            <SelectItem value={FLOW_STATUSES.ACTIVE}>Ativo</SelectItem>
            <SelectItem value={FLOW_STATUSES.PAUSED}>Pausado</SelectItem>
            <SelectItem value={FLOW_STATUSES.ARCHIVED}>Arquivado</SelectItem>
          </SelectContent>
        </Select>
        
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Categoria" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas Categorias</SelectItem>
            {categories.map(category => (
              <SelectItem key={category} value={category!}>
                {category}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Grid de Fluxos */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredFlows.map((flow) => (
          <Card 
            key={flow.id} 
            className={cn(
              "hover:shadow-lg transition-shadow cursor-pointer",
              selectedFlowId === flow.id && "ring-2 ring-blue-500"
            )}
            onClick={() => onFlowSelect?.(flow)}
          >
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle className="text-lg font-semibold text-gray-900">
                    {flow.name}
                  </CardTitle>
                  {flow.description && (
                    <CardDescription className="mt-1">
                      {flow.description}
                    </CardDescription>
                  )}
                </div>
                
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                      <MoreVertical className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={(e) => {
                      e.stopPropagation()
                      setSelectedFlow(flow)
                      setIsBuilderOpen(true)
                    }}>
                      <Edit3 className="w-4 h-4 mr-2" />
                      Editar
                    </DropdownMenuItem>
                    
                    <DropdownMenuItem onClick={(e) => {
                      e.stopPropagation()
                      handleExecuteFlow(flow.id)
                    }}>
                      <Play className="w-4 h-4 mr-2" />
                      Executar
                    </DropdownMenuItem>
                    
                    <DropdownMenuItem onClick={(e) => {
                      e.stopPropagation()
                      handleTestFlow(flow)
                    }}>
                      <Zap className="w-4 h-4 mr-2" />
                      Testar
                    </DropdownMenuItem>
                    
                    <DropdownMenuItem onClick={(e) => {
                      e.stopPropagation()
                      handleExportFlow(flow)
                    }}>
                      <Download className="w-4 h-4 mr-2" />
                      Exportar
                    </DropdownMenuItem>
                    
                    <DropdownMenuSeparator />
                    
                    <DropdownMenuItem 
                      className="text-red-600"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDeleteFlow(flow.id)
                      }}
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Excluir
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </CardHeader>
            
            <CardContent>
              <div className="space-y-4">
                {/* Status e metadata */}
                <div className="flex items-center gap-2">
                  <Badge className={getStatusColor(flow.status)}>
                    {getStatusIcon(flow.status)}
                    <span className="ml-1">{flow.status}</span>
                  </Badge>
                  
                  {flow.metadata?.category && (
                    <Badge variant="outline">
                      {flow.metadata.category}
                    </Badge>
                  )}
                  
                  {flow.metadata?.template && (
                    <Badge variant="secondary">
                      Template
                    </Badge>
                  )}
                </div>
                
                {/* Estatísticas */}
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <div className="text-center">
                    <div className="font-semibold text-gray-900">{flow.nodes.length}</div>
                    <div className="text-gray-500">Nós</div>
                  </div>
                  <div className="text-center">
                    <div className="font-semibold text-gray-900">{flow.edges.length}</div>
                    <div className="text-gray-500">Conexões</div>
                  </div>
                  <div className="text-center">
                    <div className="font-semibold text-gray-900">v{flow.version}</div>
                    <div className="text-gray-500">Versão</div>
                  </div>
                </div>
                
                {/* Datas */}
                <div className="text-xs text-gray-500">
                  <div>Criado em {format(new Date(flow.createdAt), 'PPP', { locale: ptBR })}</div>
                  {flow.updatedAt !== flow.createdAt && (
                    <div>Atualizado em {format(new Date(flow.updatedAt), 'PPP', { locale: ptBR })}</div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Dialog do Flow Builder */}
      <Dialog open={isBuilderOpen} onOpenChange={setIsBuilderOpen}>
        <DialogContent className="max-w-full max-h-full w-full h-full p-0">
          <DialogHeader className="sr-only">
            <DialogTitle>Construtor de Fluxos</DialogTitle>
            <DialogDescription>
              Crie e edite fluxos de automação com interface visual drag-and-drop
            </DialogDescription>
          </DialogHeader>
          
          <FlowBuilder
            flow={selectedFlow}
            onSave={handleSaveFlow}
            onTest={handleTestFlow}
            onImport={(data) => {
              importFlow(data)
              setIsBuilderOpen(false)
            }}
            onExport={handleExportFlow}
          />
        </DialogContent>
      </Dialog>

      {/* Dialog de Templates */}
      <Dialog open={isTemplateDialogOpen} onOpenChange={setIsTemplateDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Templates de Fluxos</DialogTitle>
            <DialogDescription>
              Escolha um template pré-construído para começar rapidamente
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            {Object.entries(FLOW_TEMPLATES).map(([key, template]) => (
              <Card key={key} className="cursor-pointer hover:shadow-lg transition-shadow">
                <CardHeader>
                  <CardTitle className="text-lg">{template.name}</CardTitle>
                  <CardDescription>{template.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-gray-500">
                      {template.nodes.length} nós • {template.edges.length} conexões
                    </div>
                    <Button
                      size="sm"
                      onClick={() => handleUseTemplate(key as keyof typeof FLOW_TEMPLATES)}
                    >
                      Usar Template
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog de Importação */}
      <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Importar Fluxo</DialogTitle>
            <DialogDescription>
              Faça upload de um arquivo JSON com a definição do fluxo
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 mt-4">
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
              <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
              <p className="text-sm text-gray-600 mb-2">
                {importFile ? importFile.name : 'Arraste o arquivo aqui ou clique para selecionar'}
              </p>
              <input
                type="file"
                accept=".json"
                onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                className="hidden"
                id="import-file"
              />
              <label
                htmlFor="import-file"
                className="cursor-pointer text-blue-600 hover:text-blue-800 text-sm font-medium"
              >
                Selecionar arquivo
              </label>
            </div>
            
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setIsImportDialogOpen(false)
                  setImportFile(null)
                }}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleImportFlow}
                disabled={!importFile}
              >
                Importar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}