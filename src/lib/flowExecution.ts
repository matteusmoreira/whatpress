import { supabase } from './supabase'
import { redis } from './redis'
import { Flow, FlowNode, FlowEdge, FLOW_NODE_TYPES, EXECUTION_STATUSES } from './flows'
import { sendMessage } from './messages'
import { updateContact, addTagToContact, removeTagFromContact } from './contacts'
import { addQueueJob, QUEUE_TYPES } from './queue'
import { monitorFunction } from './monitoring'
import { v4 as uuidv4 } from 'uuid'

// Interface de contexto de execução
export interface ExecutionContext {
  variables: Record<string, any>
  contact?: any
  executionId: string
  tenantId: string
  metadata?: Record<string, any>
}

// Resultado da execução de um nó
export interface NodeExecutionResult {
  success: boolean
  nextNodeId?: string
  error?: string
  data?: any
  logs: Array<{
    level: 'info' | 'warn' | 'error' | 'debug'
    message: string
    data?: any
  }>
}

// Motor de execução de fluxos
export class FlowExecutionEngine {
  private tenantId: string
  private executionId: string
  private context: ExecutionContext
  private flow: Flow

  constructor(tenantId: string, executionId: string, context: ExecutionContext, flow: Flow) {
    this.tenantId = tenantId
    this.executionId = executionId
    this.context = context
    this.flow = flow
  }

  // Executar fluxo completo
  async executeFlow(): Promise<void> {
    return monitorFunction(
      async () => {
        try {
          // Atualizar status para running
          await this.updateExecutionStatus(EXECUTION_STATUSES.RUNNING)

          // Encontrar nó inicial
          const startNode = this.flow.nodes.find(n => n.type === FLOW_NODE_TYPES.START)
          if (!startNode) {
            throw new Error('Nó inicial não encontrado')
          }

          // Executar a partir do nó inicial
          await this.executeNode(startNode.id)

          // Atualizar status para completed
          await this.updateExecutionStatus(EXECUTION_STATUSES.COMPLETED)

        } catch (error) {
          console.error('Erro na execução do fluxo:', error)
          await this.updateExecutionStatus(EXECUTION_STATUSES.FAILED, error.message)
        }
      },
      {
        functionName: 'executeFlow',
        category: 'flow_execution',
        metadata: {
          tenantId: this.tenantId,
          executionId: this.executionId,
          flowId: this.flow.id
        }
      }
    )()
  }

  // Executar nó específico
  private async executeNode(nodeId: string): Promise<void> {
    const node = this.flow.nodes.find(n => n.id === nodeId)
    if (!node) {
      throw new Error(`Nó ${nodeId} não encontrado`)
    }

    console.log(`Executando nó: ${node.data.label} (${node.type})`)

    // Adicionar ao histórico de nós executados
    await this.addExecutionLog(nodeId, node.type, 'info', `Iniciando execução do nó: ${node.data.label}`)

    let result: NodeExecutionResult

    try {
      // Executar o nó baseado no seu tipo
      switch (node.type) {
        case FLOW_NODE_TYPES.START:
          result = await this.executeStartNode(node)
          break

        case FLOW_NODE_TYPES.END:
          result = await this.executeEndNode(node)
          break

        case FLOW_NODE_TYPES.ACTION_SEND_MESSAGE:
          result = await this.executeSendMessageNode(node)
          break

        case FLOW_NODE_TYPES.ACTION_DELAY:
          result = await this.executeDelayNode(node)
          break

        case FLOW_NODE_TYPES.CONDITION_IF:
          result = await this.executeConditionNode(node)
          break

        case FLOW_NODE_TYPES.ACTION_UPDATE_CONTACT:
          result = await this.executeUpdateContactNode(node)
          break

        case FLOW_NODE_TYPES.ACTION_ADD_TAG:
          result = await this.executeAddTagNode(node)
          break

        case FLOW_NODE_TYPES.ACTION_REMOVE_TAG:
          result = await this.executeRemoveTagNode(node)
          break

        case FLOW_NODE_TYPES.TRIGGER_SCHEDULE:
          result = await this.executeScheduleNode(node)
          break

        default:
          throw new Error(`Tipo de nó não suportado: ${node.type}`)
      }

      // Registrar logs do resultado
      for (const log of result.logs) {
        await this.addExecutionLog(nodeId, node.type, log.level, log.message, log.data)
      }

      if (!result.success) {
        throw new Error(result.error || `Erro na execução do nó ${node.data.label}`)
      }

      // Executar próximo nó se houver
      if (result.nextNodeId) {
        await this.executeNode(result.nextNodeId)
      }

    } catch (error) {
      await this.addExecutionLog(nodeId, node.type, 'error', `Erro na execução: ${error.message}`)
      throw error
    }
  }

  // Executores de nós específicos
  private async executeStartNode(node: FlowNode): Promise<NodeExecutionResult> {
    return {
      success: true,
      logs: [{
        level: 'info',
        message: 'Fluxo iniciado com sucesso'
      }]
    }
  }

  private async executeEndNode(node: FlowNode): Promise<NodeExecutionResult> {
    return {
      success: true,
      logs: [{
        level: 'info',
        message: 'Fluxo finalizado com sucesso'
      }]
    }
  }

  private async executeSendMessageNode(node: FlowNode): Promise<NodeExecutionResult> {
    const logs: NodeExecutionResult['logs'] = []
    
    try {
      const { channel, message, templateId, mediaUrl } = node.data.config
      
      if (!channel) {
        throw new Error('Canal não especificado')
      }

      if (!message && !templateId) {
        throw new Error('Mensagem ou template não especificado')
      }

      // Processar variáveis na mensagem
      const processedMessage = this.processTemplate(message || '', this.context.variables)

      logs.push({
        level: 'info',
        message: `Enviando mensagem via ${channel}`,
        data: { message: processedMessage, channel }
      })

      // Enviar mensagem
      const result = await sendMessage({
        channel,
        to: this.context.contact?.phone || this.context.contact?.email,
        message: processedMessage,
        templateId,
        mediaUrl,
        contactId: this.context.contact?.id,
        tenantId: this.tenantId
      })

      if (result.success) {
        logs.push({
          level: 'info',
          message: 'Mensagem enviada com sucesso',
          data: { messageId: result.messageId }
        })
      } else {
        throw new Error(result.error || 'Erro ao enviar mensagem')
      }

      // Próximo nó
      const nextNodeId = this.getNextNode(node.id)

      return {
        success: true,
        nextNodeId,
        logs
      }

    } catch (error) {
      logs.push({
        level: 'error',
        message: `Erro ao enviar mensagem: ${error.message}`
      })

      return {
        success: false,
        error: error.message,
        logs
      }
    }
  }

  private async executeDelayNode(node: FlowNode): Promise<NodeExecutionResult> {
    const logs: NodeExecutionResult['logs'] = []
    
    try {
      const { duration } = node.data.config
      
      if (!duration || duration <= 0) {
        throw new Error('Duração inválida')
      }

      logs.push({
        level: 'info',
        message: `Aguardando ${duration}ms`
      })

      // Agendar próxima execução
      const scheduledAt = new Date(Date.now() + duration)
      
      await addQueueJob(QUEUE_TYPES.FLOW_EXECUTION, {
        executionId: this.executionId,
        flowId: this.flow.id,
        tenantId: this.tenantId,
        currentNodeId: node.id,
        context: this.context,
        scheduledAt
      })

      logs.push({
        level: 'info',
        message: `Delay agendado para ${scheduledAt.toISOString()}`
      })

      return {
        success: true,
        logs
      }

    } catch (error) {
      logs.push({
        level: 'error',
        message: `Erro no delay: ${error.message}`
      })

      return {
        success: false,
        error: error.message,
        logs
      }
    }
  }

  private async executeConditionNode(node: FlowNode): Promise<NodeExecutionResult> {
    const logs: NodeExecutionResult['logs'] = []
    
    try {
      const { condition } = node.data.config
      
      if (!condition) {
        throw new Error('Condição não especificada')
      }

      // Avaliar condição
      const conditionResult = this.evaluateCondition(condition, this.context)
      
      logs.push({
        level: 'info',
        message: `Condição avaliada: ${condition}`,
        data: { result: conditionResult }
      })

      // Encontrar próximo nó baseado no resultado
      const nextNodeId = this.getNextNodeByCondition(node.id, conditionResult)

      return {
        success: true,
        nextNodeId,
        logs
      }

    } catch (error) {
      logs.push({
        level: 'error',
        message: `Erro na condição: ${error.message}`
      })

      return {
        success: false,
        error: error.message,
        logs
      }
    }
  }

  private async executeUpdateContactNode(node: FlowNode): Promise<NodeExecutionResult> {
    const logs: NodeExecutionResult['logs'] = []
    
    try {
      const { updates } = node.data.config
      
      if (!updates || !this.context.contact?.id) {
        throw new Error('Dados de atualização ou contato não especificados')
      }

      logs.push({
        level: 'info',
        message: 'Atualizando contato',
        data: { updates }
      })

      // Processar variáveis nas atualizações
      const processedUpdates = this.processObjectTemplate(updates, this.context.variables)

      // Atualizar contato
      const result = await updateContact(this.context.contact.id, processedUpdates, this.tenantId)

      if (result.success) {
        logs.push({
          level: 'info',
          message: 'Contato atualizado com sucesso'
        })

        // Atualizar contexto
        this.context.contact = { ...this.context.contact, ...processedUpdates }
      } else {
        throw new Error(result.error || 'Erro ao atualizar contato')
      }

      const nextNodeId = this.getNextNode(node.id)

      return {
        success: true,
        nextNodeId,
        logs
      }

    } catch (error) {
      logs.push({
        level: 'error',
        message: `Erro ao atualizar contato: ${error.message}`
      })

      return {
        success: false,
        error: error.message,
        logs
      }
    }
  }

  private async executeAddTagNode(node: FlowNode): Promise<NodeExecutionResult> {
    const logs: NodeExecutionResult['logs'] = []
    
    try {
      const { tag } = node.data.config
      
      if (!tag || !this.context.contact?.id) {
        throw new Error('Tag ou contato não especificado')
      }

      logs.push({
        level: 'info',
        message: `Adicionando tag: ${tag}`
      })

      // Processar variáveis na tag
      const processedTag = this.processTemplate(tag, this.context.variables)

      // Adicionar tag
      const result = await addTagToContact(this.context.contact.id, processedTag, this.tenantId)

      if (result.success) {
        logs.push({
          level: 'info',
          message: 'Tag adicionada com sucesso'
        })
      } else {
        throw new Error(result.error || 'Erro ao adicionar tag')
      }

      const nextNodeId = this.getNextNode(node.id)

      return {
        success: true,
        nextNodeId,
        logs
      }

    } catch (error) {
      logs.push({
        level: 'error',
        message: `Erro ao adicionar tag: ${error.message}`
      })

      return {
        success: false,
        error: error.message,
        logs
      }
    }
  }

  private async executeRemoveTagNode(node: FlowNode): Promise<NodeExecutionResult> {
    const logs: NodeExecutionResult['logs'] = []
    
    try {
      const { tag } = node.data.config
      
      if (!tag || !this.context.contact?.id) {
        throw new Error('Tag ou contato não especificado')
      }

      logs.push({
        level: 'info',
        message: `Removendo tag: ${tag}`
      })

      // Processar variáveis na tag
      const processedTag = this.processTemplate(tag, this.context.variables)

      // Remover tag
      const result = await removeTagFromContact(this.context.contact.id, processedTag, this.tenantId)

      if (result.success) {
        logs.push({
          level: 'info',
          message: 'Tag removida com sucesso'
        })
      } else {
        throw new Error(result.error || 'Erro ao remover tag')
      }

      const nextNodeId = this.getNextNode(node.id)

      return {
        success: true,
        nextNodeId,
        logs
      }

    } catch (error) {
      logs.push({
        level: 'error',
        message: `Erro ao remover tag: ${error.message}`
      })

      return {
        success: false,
        error: error.message,
        logs
      }
    }
  }

  private async executeScheduleNode(node: FlowNode): Promise<NodeExecutionResult> {
    const logs: NodeExecutionResult['logs'] = []
    
    try {
      const { cron, datetime } = node.data.config
      
      if (!cron && !datetime) {
        throw new Error('Cron ou datetime deve ser especificado')
      }

      logs.push({
        level: 'info',
        message: `Agendamento configurado: ${cron || datetime}`
      })

      // Agendar próxima execução
      const scheduledAt = datetime ? new Date(datetime) : this.parseCronExpression(cron)
      
      await addQueueJob(QUEUE_TYPES.FLOW_EXECUTION, {
        executionId: this.executionId,
        flowId: this.flow.id,
        tenantId: this.tenantId,
        currentNodeId: node.id,
        context: this.context,
        scheduledAt
      })

      logs.push({
        level: 'info',
        message: `Execução agendada para ${scheduledAt.toISOString()}`
      })

      return {
        success: true,
        logs
      }

    } catch (error) {
      logs.push({
        level: 'error',
        message: `Erro no agendamento: ${error.message}`
      })

      return {
        success: false,
        error: error.message,
        logs
      }
    }
  }

  // Funções auxiliares
  private getNextNode(currentNodeId: string): string | undefined {
    const outgoingEdges = this.flow.edges.filter(edge => edge.source === currentNodeId)
    
    if (outgoingEdges.length === 0) {
      return undefined
    }
    
    // Retornar o primeiro nó conectado (para nós simples)
    return outgoingEdges[0].target
  }

  private getNextNodeByCondition(currentNodeId: string, conditionResult: boolean): string | undefined {
    const outgoingEdges = this.flow.edges.filter(edge => edge.source === currentNodeId)
    
    // Procurar aresta com condição que corresponda ao resultado
    const matchingEdge = outgoingEdges.find(edge => {
      if (!edge.condition) return true // Aresta padrão
      return edge.condition === (conditionResult ? 'true' : 'false')
    })
    
    return matchingEdge?.target
  }

  private evaluateCondition(condition: string, context: ExecutionContext): boolean {
    try {
      // Substituir variáveis na condição
      const processedCondition = this.processTemplate(condition, context.variables)
      
      // Avaliar condição de forma segura
      // Aqui você pode implementar um parser mais sofisticado
      // Por enquanto, vamos usar eval com restrições
      const safeContext = {
        contact: context.contact,
        variables: context.variables,
        Math,
        Date,
        JSON,
        Object,
        Array,
        String,
        Number,
        Boolean
      }
      
      const func = new Function(...Object.keys(safeContext), `return ${processedCondition}`)
      return Boolean(func(...Object.values(safeContext)))
      
    } catch (error) {
      console.error('Erro ao avaliar condição:', error)
      return false
    }
  }

  private processTemplate(template: string, variables: Record<string, any>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return variables[key] || match
    })
  }

  private processObjectTemplate(obj: any, variables: Record<string, any>): any {
    if (typeof obj === 'string') {
      return this.processTemplate(obj, variables)
    } else if (Array.isArray(obj)) {
      return obj.map(item => this.processObjectTemplate(item, variables))
    } else if (typeof obj === 'object' && obj !== null) {
      const processed: any = {}
      for (const [key, value] of Object.entries(obj)) {
        processed[key] = this.processObjectTemplate(value, variables)
      }
      return processed
    }
    return obj
  }

  private parseCronExpression(cron: string): Date {
    // Implementar parser de cron expression
    // Por enquanto, retornar data futura simples
    const date = new Date()
    date.setMinutes(date.getMinutes() + 5) // 5 minutos no futuro
    return date
  }

  private async updateExecutionStatus(status: keyof typeof EXECUTION_STATUSES, error?: string): Promise<void> {
    const updateData: any = {
      status,
      updatedAt: new Date().toISOString()
    }

    if (status === EXECUTION_STATUSES.COMPLETED || status === EXECUTION_STATUSES.FAILED || status === EXECUTION_STATUSES.CANCELLED) {
      updateData.completedAt = new Date().toISOString()
    }

    if (error) {
      updateData.error = error
    }

    await supabase
      .from('flow_executions')
      .update(updateData)
      .eq('id', this.executionId)
  }

  private async addExecutionLog(nodeId: string, nodeType: string, level: string, message: string, data?: any): Promise<void> {
    await supabase.from('flow_execution_logs').insert({
      id: uuidv4(),
      executionId: this.executionId,
      nodeId,
      nodeType,
      level: level as any,
      message,
      data,
      timestamp: new Date().toISOString()
    })
  }
}

// Funções auxiliares para execução
export async function executeFlow(flowId: string, tenantId: string, context: Record<string, any> = {}): Promise<string | null> {
  return monitorFunction(
    async () => {
      try {
        // Obter fluxo
        const { data: flow } = await supabase
          .from('flows')
          .select('*')
          .eq('id', flowId)
          .eq('tenantId', tenantId)
          .single()

        if (!flow) {
          throw new Error('Fluxo não encontrado')
        }

        // Criar execução
        const executionId = uuidv4()
        const executionContext: ExecutionContext = {
          variables: context.variables || {},
          contact: context.contact,
          executionId,
          tenantId,
          metadata: context.metadata
        }

        // Criar registro de execução
        await supabase.from('flow_executions').insert({
          id: executionId,
          flowId,
          tenantId,
          status: EXECUTION_STATUSES.PENDING,
          context: executionContext,
          executedNodes: [],
          logs: [],
          startedAt: new Date().toISOString()
        })

        // Adicionar à fila de execução
        await addQueueJob(QUEUE_TYPES.FLOW_EXECUTION, {
          executionId,
          flowId,
          tenantId,
          context: executionContext
        })

        console.log(`Execução ${executionId} agendada para o fluxo ${flowId}`)
        return executionId

      } catch (error) {
        console.error('Erro ao executar fluxo:', error)
        return null
      }
    },
    {
      functionName: 'executeFlow',
      category: 'flow_execution',
      metadata: {
        flowId,
        tenantId,
        context
      }
    }
  )()
}

export async function resumeFlowExecution(executionId: string, tenantId: string): Promise<boolean> {
  return monitorFunction(
    async () => {
      try {
        // Obter execução
        const { data: execution } = await supabase
          .from('flow_executions')
          .select('*')
          .eq('id', executionId)
          .eq('tenantId', tenantId)
          .single()

        if (!execution) {
          throw new Error('Execução não encontrada')
        }

        if (execution.status !== EXECUTION_STATUSES.PENDING) {
          throw new Error('Execução não está pendente')
        }

        // Obter fluxo
        const { data: flow } = await supabase
          .from('flows')
          .select('*')
          .eq('id', execution.flowId)
          .eq('tenantId', tenantId)
          .single()

        if (!flow) {
          throw new Error('Fluxo não encontrado')
        }

        // Criar engine e executar
        const engine = new FlowExecutionEngine(tenantId, executionId, execution.context, flow)
        await engine.executeFlow()

        return true

      } catch (error) {
        console.error('Erro ao retomar execução:', error)
        return false
      }
    },
    {
      functionName: 'resumeFlowExecution',
      category: 'flow_execution',
      metadata: {
        executionId,
        tenantId
      }
    }
  )()
}

export async function cancelFlowExecution(executionId: string, tenantId: string): Promise<boolean> {
  return monitorFunction(
    async () => {
      try {
        const { error } = await supabase
          .from('flow_executions')
          .update({
            status: EXECUTION_STATUSES.CANCELLED,
            completedAt: new Date().toISOString()
          })
          .eq('id', executionId)
          .eq('tenantId', tenantId)

        if (error) {
          throw error
        }

        return true

      } catch (error) {
        console.error('Erro ao cancelar execução:', error)
        return false
      }
    },
    {
      functionName: 'cancelFlowExecution',
      category: 'flow_execution',
      metadata: {
        executionId,
        tenantId
      }
    }
  )()
}