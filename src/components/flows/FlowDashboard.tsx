import React, { useState } from 'react'
import { 
  Play, 
  Pause, 
  RotateCcw, 
  Save,
  Upload,
  Download,
  CheckCircle,
  AlertCircle,
  Info,
  Zap,
  Settings,
  Eye,
  GitBranch,
  Trash2
} from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Flow, validateFlow } from '@/lib/flows'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { FlowBuilder } from './FlowBuilder'
import { ExecutionMonitor } from './ExecutionMonitor'

interface FlowDashboardProps {
  flowId?: string
  onClose?: () => void
}

export function FlowDashboard({ flowId, onClose }: FlowDashboardProps) {
  const [activeTab, setActiveTab] = useState<'builder' | 'monitor' | 'settings'>('builder')
  const [showTestDialog, setShowTestDialog] = useState(false)
  const [testVariables, setTestVariables] = useState('{}')
  const [testContact, setTestContact] = useState('{"id": "test-contact", "name": "Teste", "phone": "5511999999999"}')

  // Validação do fluxo
  const handleValidateFlow = (flow: Flow) => {
    const validation = validateFlow(flow)
    
    if (validation.valid) {
      toast.success('Fluxo válido! Pronto para execução.')
    } else {
      toast.error(`Fluxo inválido: ${validation.errors.join(', ')}`)
    }
    
    return validation
  }

  // Teste do fluxo
  const handleTestFlow = (flow: Flow) => {
    try {
      const variables = JSON.parse(testVariables)
      const contact = JSON.parse(testContact)
      
      setShowTestDialog(false)
      toast.success('Teste iniciado! Verifique o monitor de execução.')
      
      // Aqui você integraria com o hook useFlows para executar o teste
      console.log('Iniciando teste do fluxo:', flow.id, { variables, contact })
      
    } catch (error) {
      toast.error('Dados de teste inválidos. Verifique o formato JSON.')
    }
  }

  // Simulação de execução
  const handleSimulateExecution = (flow: Flow) => {
    const validation = handleValidateFlow(flow)
    
    if (validation.valid) {
      setShowTestDialog(true)
    }
  }

  // Estatísticas do fluxo (mock)
  const flowStats = {
    totalExecutions: 42,
    successfulExecutions: 38,
    failedExecutions: 4,
    averageDuration: '2.3s',
    lastExecution: new Date().toISOString(),
    activeNodes: 5
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-6 py-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {flowId ? 'Dashboard do Fluxo' : 'Dashboard de Fluxos'}
          </h1>
          <p className="text-gray-600">
            Visualize, teste e monitore seus fluxos de automação
          </p>
        </div>
        
        {onClose && (
          <Button variant="ghost" onClick={onClose}>
            Fechar
          </Button>
        )}
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as any)} className="flex-1">
        <TabsList className="mx-6 mt-4">
          <TabsTrigger value="builder" className="flex items-center gap-2">
            <GitBranch className="w-4 h-4" />
            Construtor
          </TabsTrigger>
          <TabsTrigger value="monitor" className="flex items-center gap-2">
            <Eye className="w-4 h-4" />
            Monitor
          </TabsTrigger>
          <TabsTrigger value="settings" className="flex items-center gap-2">
            <Settings className="w-4 h-4" />
            Configurações
          </TabsTrigger>
        </TabsList>

        <TabsContent value="builder" className="flex-1 p-0">
          <FlowBuilder
            flowId={flowId}
            onValidate={handleValidateFlow}
            onTest={handleSimulateExecution}
            onSave={(flow) => {
              toast.success('Fluxo salvo com sucesso!')
            }}
          />
        </TabsContent>

        <TabsContent value="monitor" className="flex-1 p-6">
          <ExecutionMonitor flowId={flowId} />
        </TabsContent>

        <TabsContent value="settings" className="flex-1 p-6">
          <div className="space-y-6">
            {/* Estatísticas */}
            <Card>
              <CardHeader>
                <CardTitle>Estatísticas do Fluxo</CardTitle>
                <CardDescription>
                  Métricas de desempenho e uso do fluxo
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center p-4 bg-blue-50 rounded-lg">
                    <div className="text-2xl font-bold text-blue-600">{flowStats.totalExecutions}</div>
                    <div className="text-sm text-gray-600">Total Execuções</div>
                  </div>
                  
                  <div className="text-center p-4 bg-green-50 rounded-lg">
                    <div className="text-2xl font-bold text-green-600">{flowStats.successfulExecutions}</div>
                    <div className="text-sm text-gray-600">Bem-sucedidas</div>
                  </div>
                  
                  <div className="text-center p-4 bg-red-50 rounded-lg">
                    <div className="text-2xl font-bold text-red-600">{flowStats.failedExecutions}</div>
                    <div className="text-sm text-gray-600">Falhas</div>
                  </div>
                  
                  <div className="text-center p-4 bg-purple-50 rounded-lg">
                    <div className="text-2xl font-bold text-purple-600">{flowStats.averageDuration}</div>
                    <div className="text-sm text-gray-600">Duração Média</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Configurações de Execução */}
            <Card>
              <CardHeader>
                <CardTitle>Configurações de Execução</CardTitle>
                <CardDescription>
                  Configure como o fluxo deve ser executado
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">Execução em Paralelo</div>
                      <div className="text-sm text-gray-600">
                        Permite executar múltiplas instâncias simultaneamente
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                    >
                      Configurar
                    </Button>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">Limite de Tentativas</div>
                      <div className="text-sm text-gray-600">
                        Número máximo de tentativas em caso de falha
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                    >
                      Configurar
                    </Button>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">Timeout</div>
                      <div className="text-sm text-gray-600">
                        Tempo máximo de execução antes de cancelar
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                    >
                      Configurar
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Ações */}
            <Card>
              <CardHeader>
                <CardTitle>Ações</CardTitle>
                <CardDescription>
                  Ações administrativas para o fluxo
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" className="flex items-center gap-2">
                    <Download className="w-4 h-4" />
                    Exportar Fluxo
                  </Button>
                  
                  <Button variant="outline" className="flex items-center gap-2">
                    <Upload className="w-4 h-4" />
                    Importar Configurações
                  </Button>
                  
                  <Button variant="outline" className="flex items-center gap-2">
                    <RotateCcw className="w-4 h-4" />
                    Reiniciar Estatísticas
                  </Button>
                  
                  <Button variant="destructive" className="flex items-center gap-2">
                    <Trash2 className="w-4 h-4" />
                    Excluir Fluxo
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Dialog de Teste */}
      <Dialog open={showTestDialog} onOpenChange={setShowTestDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap className="w-5 h-5" />
              Testar Fluxo
            </DialogTitle>
            <DialogDescription>
              Configure os dados de teste para simular a execução do fluxo
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 mt-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Variáveis (JSON)
              </label>
              <textarea
                value={testVariables}
                onChange={(e) => setTestVariables(e.target.value)}
                className="w-full h-32 p-3 border rounded-lg font-mono text-sm"
                placeholder='{"nome": "João", "produto": "Curso de Marketing"}'
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Contato de Teste (JSON)
              </label>
              <textarea
                value={testContact}
                onChange={(e) => setTestContact(e.target.value)}
                className="w-full h-24 p-3 border rounded-lg font-mono text-sm"
                placeholder='{"id": "test-1", "name": "João Silva", "phone": "5511999999999"}'
              />
            </div>
          </div>
          
          <div className="flex justify-end gap-2 mt-6">
            <Button
              variant="outline"
              onClick={() => setShowTestDialog(false)}
            >
              Cancelar
            </Button>
            <Button
              onClick={() => {
                setShowTestDialog(false)
                toast.success('Teste iniciado!')
              }}
            >
              Iniciar Teste
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}