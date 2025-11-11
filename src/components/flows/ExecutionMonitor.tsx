import React, { useState, useEffect } from 'react'
import { 
  Play, 
  Pause, 
  RotateCcw, 
  Filter, 
  Download,
  Search,
  Clock,
  CheckCircle,
  AlertCircle,
  Info,
  Terminal,
  Trash2,
  RefreshCw
} from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import { FlowExecution, EXECUTION_STATUSES } from '@/lib/flows'
import { useFlows } from '@/hooks/useFlows'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

interface ExecutionMonitorProps {
  flowId?: string
  onClose?: () => void
}

export function ExecutionMonitor({ flowId, onClose }: ExecutionMonitorProps) {
  const { getFlowExecutions, getExecutionLogs, cancelExecution } = useFlows()
  
  const [executions, setExecutions] = useState<FlowExecution[]>([])
  const [selectedExecution, setSelectedExecution] = useState<FlowExecution | null>(null)
  const [logs, setLogs] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [refreshInterval, setRefreshInterval] = useState<NodeJS.Timeout | null>(null)

  // Buscar execuções
  const fetchExecutions = async () => {
    try {
      setIsLoading(true)
      const data = await getFlowExecutions(flowId)
      setExecutions(data || [])
    } catch (error) {
      console.error('Erro ao buscar execuções:', error)
      toast.error('Erro ao buscar execuções')
    } finally {
      setIsLoading(false)
    }
  }

  // Buscar logs da execução selecionada
  const fetchExecutionLogs = async (executionId: string) => {
    try {
      const executionLogs = await getExecutionLogs(executionId)
      setLogs(executionLogs || [])
    } catch (error) {
      console.error('Erro ao buscar logs:', error)
      toast.error('Erro ao buscar logs da execução')
    }
  }

  // Auto refresh
  useEffect(() => {
    if (autoRefresh) {
      const interval = setInterval(fetchExecutions, 5000)
      setRefreshInterval(interval)
      return () => clearInterval(interval)
    } else if (refreshInterval) {
      clearInterval(refreshInterval)
      setRefreshInterval(null)
    }
  }, [autoRefresh])

  // Buscar execuções inicialmente
  useEffect(() => {
    fetchExecutions()
  }, [flowId])

  // Buscar logs quando execução é selecionada
  useEffect(() => {
    if (selectedExecution) {
      fetchExecutionLogs(selectedExecution.id)
    }
  }, [selectedExecution])

  // Filtrar execuções
  const filteredExecutions = executions.filter(execution => {
    const matchesSearch = execution.flowName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         execution.id.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesStatus = statusFilter === 'all' || execution.status === statusFilter

    return matchesSearch && matchesStatus
  })

  const handleCancelExecution = async (executionId: string) => {
    try {
      await cancelExecution(executionId)
      toast.success('Execução cancelada com sucesso!')
      fetchExecutions()
    } catch (error) {
      console.error('Erro ao cancelar execução:', error)
      toast.error('Erro ao cancelar execução')
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case EXECUTION_STATUSES.RUNNING:
        return 'bg-blue-100 text-blue-800'
      case EXECUTION_STATUSES.COMPLETED:
        return 'bg-green-100 text-green-800'
      case EXECUTION_STATUSES.FAILED:
        return 'bg-red-100 text-red-800'
      case EXECUTION_STATUSES.CANCELLED:
        return 'bg-yellow-100 text-yellow-800'
      case EXECUTION_STATUSES.PENDING:
        return 'bg-gray-100 text-gray-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case EXECUTION_STATUSES.RUNNING:
        return <RefreshCw className="w-3 h-3 animate-spin" />
      case EXECUTION_STATUSES.COMPLETED:
        return <CheckCircle className="w-3 h-3" />
      case EXECUTION_STATUSES.FAILED:
        return <AlertCircle className="w-3 h-3" />
      case EXECUTION_STATUSES.CANCELLED:
        return <Pause className="w-3 h-3" />
      case EXECUTION_STATUSES.PENDING:
        return <Clock className="w-3 h-3" />
      default:
        return null
    }
  }

  const getLogLevelColor = (level: string) => {
    switch (level) {
      case 'error':
        return 'text-red-600 bg-red-50'
      case 'warn':
        return 'text-yellow-600 bg-yellow-50'
      case 'info':
        return 'text-blue-600 bg-blue-50'
      case 'debug':
        return 'text-gray-600 bg-gray-50'
      default:
        return 'text-gray-600 bg-gray-50'
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">
            {flowId ? 'Monitor de Execuções' : 'Todas as Execuções'}
          </h2>
          <p className="text-gray-600">
            Acompanhe o status e logs das execuções de fluxos
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={cn(autoRefresh && 'bg-green-50 text-green-700')}
          >
            <RefreshCw className={cn("w-4 h-4 mr-2", autoRefresh && "animate-spin")} />
            {autoRefresh ? 'Auto Refresh ON' : 'Auto Refresh OFF'}
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={fetchExecutions}
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Atualizar
          </Button>
          
          {onClose && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
            >
              Fechar
            </Button>
          )}
        </div>
      </div>

      {/* Filtros */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <Input
            placeholder="Buscar execuções..."
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
            <SelectItem value={EXECUTION_STATUSES.PENDING}>Pendente</SelectItem>
            <SelectItem value={EXECUTION_STATUSES.RUNNING}>Executando</SelectItem>
            <SelectItem value={EXECUTION_STATUSES.COMPLETED}>Concluído</SelectItem>
            <SelectItem value={EXECUTION_STATUSES.FAILED}>Falhou</SelectItem>
            <SelectItem value={EXECUTION_STATUSES.CANCELLED}>Cancelado</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Lista de Execuções */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Lista de Execuções */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Execuções ({filteredExecutions.length})</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-96">
                <div className="space-y-2 p-4">
                  {isLoading ? (
                    <div className="flex items-center justify-center h-32">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                    </div>
                  ) : filteredExecutions.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      Nenhuma execução encontrada
                    </div>
                  ) : (
                    filteredExecutions.map((execution) => (
                      <div
                        key={execution.id}
                        className={cn(
                          "p-3 border rounded-lg cursor-pointer hover:bg-gray-50",
                          selectedExecution?.id === execution.id && "bg-blue-50 border-blue-200"
                        )}
                        onClick={() => setSelectedExecution(execution)}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <Badge className={getStatusColor(execution.status)}>
                            {getStatusIcon(execution.status)}
                            <span className="ml-1">{execution.status}</span>
                          </Badge>
                          
                          {execution.status === EXECUTION_STATUSES.RUNNING && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleCancelExecution(execution.id)
                              }}
                            >
                              <Pause className="w-3 h-3" />
                            </Button>
                          )}
                        </div>
                        
                        <div className="space-y-1">
                          <div className="font-medium text-sm">{execution.flowName}</div>
                          <div className="text-xs text-gray-500">ID: {execution.id}</div>
                          <div className="text-xs text-gray-500">
                            {format(new Date(execution.createdAt), 'PPp', { locale: ptBR })}
                          </div>
                        </div>
                        
                        {/* Progresso */}
                        {execution.status === EXECUTION_STATUSES.RUNNING && execution.progress !== undefined && (
                          <div className="mt-2">
                            <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
                              <span>Progresso</span>
                              <span>{execution.progress}%</span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-1">
                              <div 
                                className="bg-blue-600 h-1 rounded-full transition-all duration-300"
                                style={{ width: `${execution.progress}%` }}
                              ></div>
                            </div>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        {/* Detalhes e Logs */}
        <div className="lg:col-span-2">
          {selectedExecution ? (
            <Tabs defaultValue="details" className="space-y-4">
              <TabsList>
                <TabsTrigger value="details">Detalhes</TabsTrigger>
                <TabsTrigger value="logs">Logs</TabsTrigger>
                <TabsTrigger value="context">Contexto</TabsTrigger>
              </TabsList>
              
              <TabsContent value="details">
                <Card>
                  <CardHeader>
                    <CardTitle>Detalhes da Execução</CardTitle>
                    <CardDescription>
                      Informações detalhadas sobre a execução do fluxo
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-sm font-medium text-gray-700">ID da Execução</label>
                          <div className="text-sm text-gray-900">{selectedExecution.id}</div>
                        </div>
                        
                        <div>
                          <label className="text-sm font-medium text-gray-700">Fluxo</label>
                          <div className="text-sm text-gray-900">{selectedExecution.flowName}</div>
                        </div>
                        
                        <div>
                          <label className="text-sm font-medium text-gray-700">Status</label>
                          <div className="flex items-center gap-2">
                            <Badge className={getStatusColor(selectedExecution.status)}>
                              {getStatusIcon(selectedExecution.status)}
                              <span className="ml-1">{selectedExecution.status}</span>
                            </Badge>
                          </div>
                        </div>
                        
                        <div>
                          <label className="text-sm font-medium text-gray-700">Progresso</label>
                          <div className="text-sm text-gray-900">
                            {selectedExecution.progress !== undefined ? `${selectedExecution.progress}%` : 'N/A'}
                          </div>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-sm font-medium text-gray-700">Início</label>
                          <div className="text-sm text-gray-900">
                            {format(new Date(selectedExecution.createdAt), 'PPpp', { locale: ptBR })}
                          </div>
                        </div>
                        
                        <div>
                          <label className="text-sm font-medium text-gray-700">Término</label>
                          <div className="text-sm text-gray-900">
                            {selectedExecution.completedAt 
                              ? format(new Date(selectedExecution.completedAt), 'PPpp', { locale: ptBR })
                              : 'Em andamento'
                            }
                          </div>
                        </div>
                      </div>
                      
                      {selectedExecution.error && (
                        <div>
                          <label className="text-sm font-medium text-red-700">Erro</label>
                          <div className="text-sm text-red-900 bg-red-50 p-3 rounded-lg">
                            {selectedExecution.error}
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
              
              <TabsContent value="logs">
                <Card>
                  <CardHeader>
                    <CardTitle>Logs de Execução</CardTitle>
                    <CardDescription>
                      Registro detalhado de cada etapa da execução
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-96">
                      <div className="space-y-2">
                        {logs.length === 0 ? (
                          <div className="text-center py-8 text-gray-500">
                            Nenhum log disponível
                          </div>
                        ) : (
                          logs.map((log, index) => (
                            <div key={index} className="flex items-start gap-3 p-2 rounded hover:bg-gray-50">
                              <div className={cn(
                                "px-2 py-1 rounded text-xs font-mono",
                                getLogLevelColor(log.level)
                              )}>
                                {log.level}
                              </div>
                              
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium">{log.message}</div>
                                
                                {log.nodeId && (
                                  <div className="text-xs text-gray-500 mt-1">
                                    Nó: {log.nodeId} • {log.nodeType}
                                  </div>
                                )}
                                
                                {log.details && (
                                  <div className="text-xs text-gray-600 mt-1 font-mono">
                                    {JSON.stringify(log.details, null, 2)}
                                  </div>
                                )}
                              </div>
                              
                              <div className="text-xs text-gray-400">
                                {format(new Date(log.timestamp), 'HH:mm:ss.SSS')}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              </TabsContent>
              
              <TabsContent value="context">
                <Card>
                  <CardHeader>
                    <CardTitle>Contexto de Execução</CardTitle>
                    <CardDescription>
                      Variáveis e dados compartilhados durante a execução
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {selectedExecution.context ? (
                        <pre className="text-sm text-gray-900 bg-gray-50 p-4 rounded-lg overflow-auto">
                          {JSON.stringify(selectedExecution.context, null, 2)}
                        </pre>
                      ) : (
                        <div className="text-center py-8 text-gray-500">
                          Nenhum contexto disponível
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          ) : (
            <Card>
              <CardContent className="flex items-center justify-center h-64">
                <div className="text-center text-gray-500">
                  <Terminal className="w-12 h-12 mx-auto mb-4" />
                  <p>Selecione uma execução para ver os detalhes</p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}