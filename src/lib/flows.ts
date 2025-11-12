import { supabase } from './supabase'
import { redis } from './redis'
import { addQueueJob, QUEUE_TYPES } from './queue'
import { monitorFunction } from './monitoring'
import { v4 as uuidv4 } from 'uuid'

// Tipos de nós do fluxo
export const FLOW_NODE_TYPES = {
  // Triggers
  TRIGGER_WEBHOOK: 'trigger_webhook',
  TRIGGER_SCHEDULE: 'trigger_schedule',
  TRIGGER_EVENT: 'trigger_event',
  TRIGGER_MANUAL: 'trigger_manual',
  
  // Actions
  ACTION_SEND_MESSAGE: 'action_send_message',
  ACTION_UPDATE_CONTACT: 'action_update_contact',
  ACTION_ADD_TAG: 'action_add_tag',
  ACTION_REMOVE_TAG: 'action_remove_tag',
  ACTION_DELAY: 'action_delay',
  ACTION_WEBHOOK: 'action_webhook',
  ACTION_CONDITION: 'action_condition',
  ACTION_SPLIT: 'action_split',
  ACTION_JOIN: 'action_join',
  
  // Logic
  CONDITION_IF: 'condition_if',
  CONDITION_WAIT: 'condition_wait',
  
  // Flow Control
  START: 'start',
  END: 'end'
} as const

export const FLOW_STATUSES = {
  DRAFT: 'draft',
  ACTIVE: 'active',
  PAUSED: 'paused',
  ARCHIVED: 'archived'
} as const

export const EXECUTION_STATUSES = {
  PENDING: 'pending',
  RUNNING: 'running',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
  TIMEOUT: 'timeout'
} as const

// Interfaces principais
export interface FlowNode {
  id: string
  type: keyof typeof FLOW_NODE_TYPES
  position: { x: number; y: number }
  data: {
    label: string
    description?: string
    config: Record<string, any>
    variables?: Record<string, any>
  }
}

export interface FlowEdge {
  id: string
  source: string
  target: string
  sourceHandle?: string
  targetHandle?: string
  type?: string
  label?: string
  condition?: string
}

export interface Flow {
  id: string
  name: string
  description?: string
  tenantId: string
  createdBy: string
  nodes: FlowNode[]
  edges: FlowEdge[]
  status: keyof typeof FLOW_STATUSES
  version: number
  variablesSchema?: Record<string, {
    type: 'string' | 'number' | 'boolean' | 'object' | 'array'
    required?: boolean
    default?: any
    description?: string
  }>
  metadata?: {
    category?: string
    tags?: string[]
    template?: boolean
    templateId?: string
  }
  createdAt: string
  updatedAt: string
}

export interface FlowExecution {
  id: string
  flowId: string
  tenantId: string
  status: keyof typeof EXECUTION_STATUSES
  context: Record<string, any>
  currentNodeId?: string
  executedNodes: string[]
  logs: FlowExecutionLog[]
  error?: string
  startedAt: string
  completedAt?: string
  scheduledAt?: string
  metadata?: {
    trigger?: string
    contactId?: string
    campaignId?: string
  }
}

export interface FlowExecutionLog {
  id: string
  executionId: string
  nodeId: string
  nodeType: string
  level: 'info' | 'warn' | 'error' | 'debug'
  message: string
  data?: Record<string, any>
  timestamp: string
}

// Funções principais do motor de fluxos
export class FlowEngine {
  private tenantId: string

  constructor(tenantId: string) {
    this.tenantId = tenantId
  }

  // Criar novo fluxo
  async createFlow(flowData: Omit<Flow, 'id' | 'createdAt' | 'updatedAt' | 'version'>): Promise<Flow | null> {
    return monitorFunction(
      async () => {
        const now = new Date().toISOString()
        const flow: Flow = {
          ...flowData,
          id: uuidv4(),
          version: 1,
          createdAt: now,
          updatedAt: now
        }

        const { data, error } = await supabase
          .from('flows')
          .insert(flow)
          .select()
          .single()

        if (error) {
          console.error('Erro ao criar fluxo:', error)
          return null
        }

        // Invalidar cache
        await redis.del(`flows:${this.tenantId}:*`)

        return data
      },
      {
        functionName: 'createFlow',
        category: 'flows',
        metadata: {
          tenantId: this.tenantId,
          flowName: flowData.name
        }
      }
    )()
  }

  // Obter fluxo por ID
  async getFlow(flowId: string): Promise<Flow | null> {
    return monitorFunction(
      async () => {
        const cacheKey = `flow:${flowId}`
        
        // Tentar obter do cache
        const cached = await redis.get(cacheKey)
        if (cached) return JSON.parse(cached)

        const { data, error } = await supabase
          .from('flows')
          .select('*')
          .eq('id', flowId)
          .eq('tenantId', this.tenantId)
          .single()

        if (error) {
          console.error('Erro ao obter fluxo:', error)
          return null
        }

        // Cachear por 5 minutos
        await redis.setex(cacheKey, 300, JSON.stringify(data))

        return data
      },
      {
        functionName: 'getFlow',
        category: 'flows',
        metadata: {
          tenantId: this.tenantId,
          flowId
        }
      }
    )()
  }

  // Listar fluxos do tenant
  async listFlows(options?: {
    status?: keyof typeof FLOW_STATUSES
    category?: string
    template?: boolean
    limit?: number
    offset?: number
  }): Promise<Flow[]> {
    return monitorFunction(
      async () => {
        const cacheKey = `flows:${this.tenantId}:${JSON.stringify(options || {})}`
        
        // Tentar obter do cache
        const cached = await redis.get(cacheKey)
        if (cached) return JSON.parse(cached)

        let query = supabase
          .from('flows')
          .select('*')
          .eq('tenantId', this.tenantId)
          .order('createdAt', { ascending: false })

        if (options?.status) {
          query = query.eq('status', options.status)
        }

        if (options?.category) {
          query = query.contains('metadata', { category: options.category })
        }

        if (options?.template !== undefined) {
          query = query.contains('metadata', { template: options.template })
        }

        if (options?.limit) {
          query = query.limit(options.limit)
        }

        if (options?.offset) {
          query = query.range(options.offset, options.offset + (options.limit || 50) - 1)
        }

        const { data, error } = await query

        if (error) {
          console.error('Erro ao listar fluxos:', error)
          return []
        }

        // Cachear por 2 minutos
        await redis.setex(cacheKey, 120, JSON.stringify(data))

        return data || []
      },
      {
        functionName: 'listFlows',
        category: 'flows',
        metadata: {
          tenantId: this.tenantId,
          options
        }
      }
    )()
  }

  // Atualizar fluxo
  async updateFlow(flowId: string, updates: Partial<Flow>): Promise<Flow | null> {
    return monitorFunction(
      async () => {
        const { data, error } = await supabase
          .from('flows')
          .update({
            ...updates,
            updatedAt: new Date().toISOString()
          })
          .eq('id', flowId)
          .eq('tenantId', this.tenantId)
          .select()
          .single()

        if (error) {
          console.error('Erro ao atualizar fluxo:', error)
          return null
        }

        // Invalidar cache
        await redis.del(`flow:${flowId}`)
        await redis.del(`flows:${this.tenantId}:*`)

        return data
      },
      {
        functionName: 'updateFlow',
        category: 'flows',
        metadata: {
          tenantId: this.tenantId,
          flowId
        }
      }
    )()
  }

  // Validar fluxo antes da execução
  validateFlow(flow: Flow): { valid: boolean; errors: string[] } {
    const errors: string[] = []

    // Verificar se tem nó inicial
    const startNode = flow.nodes.find(n => n.type === FLOW_NODE_TYPES.START)
    if (!startNode) {
      errors.push('Fluxo deve ter um nó inicial')
    }

    // Verificar se tem nó final
    const endNodes = flow.nodes.filter(n => n.type === FLOW_NODE_TYPES.END)
    if (endNodes.length === 0) {
      errors.push('Fluxo deve ter pelo menos um nó final')
    }

    // Verificar conectividade
    const visited = new Set<string>()
    const queue = startNode ? [startNode.id] : []
    
    while (queue.length > 0) {
      const nodeId = queue.shift()!
      if (visited.has(nodeId)) continue
      
      visited.add(nodeId)
      
      // Encontrar nós conectados
      const connectedEdges = flow.edges.filter(e => e.source === nodeId)
      connectedEdges.forEach(edge => {
        if (!visited.has(edge.target)) {
          queue.push(edge.target)
        }
      })
    }

    // Verificar se todos os nós são alcançáveis
    const unreachableNodes = flow.nodes.filter(n => !visited.has(n.id) && n.type !== FLOW_NODE_TYPES.START)
    if (unreachableNodes.length > 0) {
      errors.push(`${unreachableNodes.length} nó(s) não são alcançáveis do nó inicial`)
    }

    // Validar configurações específicas de cada tipo de nó
    flow.nodes.forEach(node => {
      const nodeErrors = this.validateNodeConfig(node)
      errors.push(...nodeErrors.map(err => `Nó ${node.data.label}: ${err}`))
    })

    return {
      valid: errors.length === 0,
      errors
    }
  }

  // Validar configuração de nó específico
  private validateNodeConfig(node: FlowNode): string[] {
    const errors: string[] = []

    switch (node.type) {
      case FLOW_NODE_TYPES.ACTION_SEND_MESSAGE:
        if (!node.data.config.message && !node.data.config.templateId) {
          errors.push('Deve ter mensagem ou template')
        }
        if (!node.data.config.channel) {
          errors.push('Deve especificar canal')
        }
        break

      case FLOW_NODE_TYPES.CONDITION_IF:
        if (!node.data.config.condition) {
          errors.push('Deve ter condição')
        }
        break

      case FLOW_NODE_TYPES.ACTION_DELAY:
        if (!node.data.config.duration) {
          errors.push('Deve ter duração')
        }
        break

      case FLOW_NODE_TYPES.TRIGGER_SCHEDULE:
        if (!node.data.config.cron && !node.data.config.datetime) {
          errors.push('Deve ter cron ou datetime')
        }
        break
    }

    return errors
  }

  // Iniciar execução de fluxo
  async startExecution(flowId: string, context: Record<string, any> = {}, metadata?: Record<string, any>): Promise<FlowExecution | null> {
    return monitorFunction(
      async () => {
        const flow = await this.getFlow(flowId)
        if (!flow) {
          console.error('Fluxo não encontrado:', flowId)
          return null
        }

        // Validar fluxo
        const validation = this.validateFlow(flow)
        if (!validation.valid) {
          console.error('Fluxo inválido:', validation.errors)
          return null
        }

        // Criar execução
        const execution: FlowExecution = {
          id: uuidv4(),
          flowId,
          tenantId: this.tenantId,
          status: EXECUTION_STATUSES.PENDING,
          context,
          executedNodes: [],
          logs: [],
          startedAt: new Date().toISOString(),
          metadata
        }

        const { data, error } = await supabase
          .from('flow_executions')
          .insert(execution)
          .select()
          .single()

        if (error) {
          console.error('Erro ao criar execução:', error)
          return null
        }

        // Adicionar à fila de execução
        await addQueueJob(QUEUE_TYPES.FLOW_EXECUTION, {
          executionId: execution.id,
          flowId,
          tenantId: this.tenantId,
          context
        })

        return data
      },
      {
        functionName: 'startExecution',
        category: 'flows',
        metadata: {
          tenantId: this.tenantId,
          flowId,
          context
        }
      }
    )()
  }

  // Obter execução por ID
  async getExecution(executionId: string): Promise<FlowExecution | null> {
    return monitorFunction(
      async () => {
        const { data, error } = await supabase
          .from('flow_executions')
          .select(`
            *,
            logs:flow_execution_logs(*)
          `)
          .eq('id', executionId)
          .eq('tenantId', this.tenantId)
          .single()

        if (error) {
          console.error('Erro ao obter execução:', error)
          return null
        }

        return data
      },
      {
        functionName: 'getExecution',
        category: 'flows',
        metadata: {
          tenantId: this.tenantId,
          executionId
        }
      }
    )()
  }

  // Listar execuções
  async listExecutions(flowId?: string, options?: {
    status?: keyof typeof EXECUTION_STATUSES
    limit?: number
    offset?: number
  }): Promise<FlowExecution[]> {
    return monitorFunction(
      async () => {
        let query = supabase
          .from('flow_executions')
          .select('*')
          .eq('tenantId', this.tenantId)
          .order('startedAt', { ascending: false })

        if (flowId) {
          query = query.eq('flowId', flowId)
        }

        if (options?.status) {
          query = query.eq('status', options.status)
        }

        if (options?.limit) {
          query = query.limit(options.limit)
        }

        if (options?.offset) {
          query = query.range(options.offset, options.offset + (options.limit || 50) - 1)
        }

        const { data, error } = await query

        if (error) {
          console.error('Erro ao listar execuções:', error)
          return []
        }

        return data || []
      },
      {
        functionName: 'listExecutions',
        category: 'flows',
        metadata: {
          tenantId: this.tenantId,
          flowId,
          options
        }
      }
    )()
  }

  // Cancelar execução
  async cancelExecution(executionId: string): Promise<boolean> {
    return monitorFunction(
      async () => {
        const { error } = await supabase
          .from('flow_executions')
          .update({
            status: EXECUTION_STATUSES.CANCELLED,
            completedAt: new Date().toISOString()
          })
          .eq('id', executionId)
          .eq('tenantId', this.tenantId)

        if (error) {
          console.error('Erro ao cancelar execução:', error)
          return false
        }

        return true
      },
      {
        functionName: 'cancelExecution',
        category: 'flows',
        metadata: {
          tenantId: this.tenantId,
          executionId
        }
      }
    )()
  }

  // Adicionar log de execução
  async addExecutionLog(executionId: string, log: Omit<FlowExecutionLog, 'id' | 'executionId' | 'timestamp'>): Promise<void> {
    await supabase.from('flow_execution_logs').insert({
      ...log,
      id: uuidv4(),
      executionId,
      timestamp: new Date().toISOString()
    })
  }
}

// Funções auxiliares
export function createFlowNode(type: keyof typeof FLOW_NODE_TYPES, position: { x: number; y: number }, data: FlowNode['data']): FlowNode {
  return {
    id: uuidv4(),
    type,
    position,
    data
  }
}

export function createFlowEdge(source: string, target: string, options?: Partial<FlowEdge>): FlowEdge {
  return {
    id: uuidv4(),
    source,
    target,
    ...options
  }
}

// Templates de fluxos pré-construídos
export const FLOW_TEMPLATES = {
  WELCOME_SEQUENCE: {
    name: 'Sequência de Boas-vindas',
    description: 'Fluxo automatizado para novos contatos',
    nodes: [
      {
        id: 'start',
        type: FLOW_NODE_TYPES.START,
        position: { x: 100, y: 100 },
        data: {
          label: 'Início',
          config: {}
        }
      },
      {
        id: 'welcome_message',
        type: FLOW_NODE_TYPES.ACTION_SEND_MESSAGE,
        position: { x: 300, y: 100 },
        data: {
          label: 'Mensagem de Boas-vindas',
          config: {
            channel: 'whatsapp',
            message: 'Olá {{nome}}! Bem-vindo(a) à nossa equipe. Como posso ajudar você hoje?',
            delay: 0
          }
        }
      },
      {
        id: 'wait_response',
        type: FLOW_NODE_TYPES.CONDITION_WAIT,
        position: { x: 500, y: 100 },
        data: {
          label: 'Aguardar Resposta',
          config: {
            timeout: 86400000, // 24 horas
            condition: 'message_received'
          }
        }
      },
      {
        id: 'follow_up',
        type: FLOW_NODE_TYPES.ACTION_SEND_MESSAGE,
        position: { x: 700, y: 200 },
        data: {
          label: 'Follow-up',
          config: {
            channel: 'whatsapp',
            message: 'Oi {{nome}}, tudo bem? Estou aqui caso precise de ajuda!',
            delay: 86400000 // 24 horas
          }
        }
      },
      {
        id: 'end',
        type: FLOW_NODE_TYPES.END,
        position: { x: 900, y: 100 },
        data: {
          label: 'Fim',
          config: {}
        }
      }
    ],
    edges: [
      { id: 'e1', source: 'start', target: 'welcome_message' },
      { id: 'e2', source: 'welcome_message', target: 'wait_response' },
      { id: 'e3', source: 'wait_response', target: 'follow_up', condition: 'timeout' },
      { id: 'e4', source: 'wait_response', target: 'end', condition: 'message_received' },
      { id: 'e5', source: 'follow_up', target: 'end' }
    ]
  },

  FOLLOW_UP_SEQUENCE: {
    name: 'Sequência de Follow-up',
    description: 'Fluxo de acompanhamento para leads',
    nodes: [
      {
        id: 'start',
        type: FLOW_NODE_TYPES.START,
        position: { x: 100, y: 100 },
        data: { label: 'Início', config: {} }
      },
      {
        id: 'day1',
        type: FLOW_NODE_TYPES.ACTION_SEND_MESSAGE,
        position: { x: 300, y: 100 },
        data: {
          label: 'Dia 1 - Primeiro Contato',
          config: {
            channel: 'whatsapp',
            message: 'Olá {{nome}}! Obrigado pelo interesse. Posso tirar alguma dúvida?',
            delay: 0
          }
        }
      },
      {
        id: 'day3',
        type: FLOW_NODE_TYPES.ACTION_SEND_MESSAGE,
        position: { x: 500, y: 100 },
        data: {
          label: 'Dia 3 - Valor',
          config: {
            channel: 'whatsapp',
            message: '{{nome}}, nossa solução pode te ajudar a {{beneficio}}. Quer saber mais?',
            delay: 172800000 // 2 dias
          }
        }
      },
      {
        id: 'day7',
        type: FLOW_NODE_TYPES.ACTION_SEND_MESSAGE,
        position: { x: 700, y: 100 },
        data: {
          label: 'Dia 7 - Último Contato',
          config: {
            channel: 'whatsapp',
            message: '{{nome}}, estou aqui caso mude de ideia. Podemos marcar uma call rápida?',
            delay: 345600000 // 4 dias adicionais
          }
        }
      },
      {
        id: 'end',
        type: FLOW_NODE_TYPES.END,
        position: { x: 900, y: 100 },
        data: { label: 'Fim', config: {} }
      }
    ],
    edges: [
      { id: 'e1', source: 'start', target: 'day1' },
      { id: 'e2', source: 'day1', target: 'day3' },
      { id: 'e3', source: 'day3', target: 'day7' },
      { id: 'e4', source: 'day7', target: 'end' }
    ]
  },

  NURTURE_SEQUENCE: {
    name: 'Sequência de Nutrição',
    description: 'Fluxo educativo para nutrir leads',
    nodes: [
      {
        id: 'start',
        type: FLOW_NODE_TYPES.START,
        position: { x: 100, y: 100 },
        data: { label: 'Início', config: {} }
      },
      {
        id: 'educational1',
        type: FLOW_NODE_TYPES.ACTION_SEND_MESSAGE,
        position: { x: 300, y: 100 },
        data: {
          label: 'Conteúdo Educativo 1',
          config: {
            channel: 'email',
            subject: '5 dicas para melhorar seu {{area}}',
            message: 'Oi {{nome}}, separamos 5 dicas valiosas para você...',
            delay: 0
          }
        }
      },
      {
        id: 'wait1',
        type: FLOW_NODE_TYPES.ACTION_DELAY,
        position: { x: 500, y: 100 },
        data: {
          label: 'Esperar 3 dias',
          config: { duration: 259200000 } // 3 dias
        }
      },
      {
        id: 'educational2',
        type: FLOW_NODE_TYPES.ACTION_SEND_MESSAGE,
        position: { x: 700, y: 100 },
        data: {
          label: 'Conteúdo Educativo 2',
          config: {
            channel: 'whatsapp',
            message: '{{nome}}, você viu nosso último artigo sobre {{tema}}? Acha que pode te ajudar?',
            delay: 0
          }
        }
      },
      {
        id: 'condition',
        type: FLOW_NODE_TYPES.CONDITION_IF,
        position: { x: 900, y: 100 },
        data: {
          label: 'Lead Qualificado?',
          config: {
            condition: 'contact.tags.includes("qualified")'
          }
        }
      },
      {
        id: 'sales_message',
        type: FLOW_NODE_TYPES.ACTION_SEND_MESSAGE,
        position: { x: 1100, y: 50 },
        data: {
          label: 'Mensagem de Vendas',
          config: {
            channel: 'whatsapp',
            message: '{{nome}}, parece que você está pronto! Vamos marcar uma demonstração?',
            delay: 0
          }
        }
      },
      {
        id: 'continue_nurture',
        type: FLOW_NODE_TYPES.ACTION_SEND_MESSAGE,
        position: { x: 1100, y: 150 },
        data: {
          label: 'Continuar Nutrição',
          config: {
            channel: 'email',
            subject: 'Mais conteúdo para você',
            message: '{{nome}}, aqui está mais conteúdo que pode te interessar...',
            delay: 604800000 // 7 dias
          }
        }
      },
      {
        id: 'end',
        type: FLOW_NODE_TYPES.END,
        position: { x: 1300, y: 100 },
        data: { label: 'Fim', config: {} }
      }
    ],
    edges: [
      { id: 'e1', source: 'start', target: 'educational1' },
      { id: 'e2', source: 'educational1', target: 'wait1' },
      { id: 'e3', source: 'wait1', target: 'educational2' },
      { id: 'e4', source: 'educational2', target: 'condition' },
      { id: 'e5', source: 'condition', target: 'sales_message', condition: 'true' },
      { id: 'e6', source: 'condition', target: 'continue_nurture', condition: 'false' },
      { id: 'e7', source: 'sales_message', target: 'end' },
      { id: 'e8', source: 'continue_nurture', target: 'end' }
    ]
  }
}

// Exportar funções auxiliares
export async function importFlow(flowData: any, tenantId: string, userId: string): Promise<Flow | null> {
  const engine = new FlowEngine(tenantId)
  
  try {
    const flow = await engine.createFlow({
      ...flowData,
      tenantId,
      createdBy: userId,
      status: FLOW_STATUSES.DRAFT
    })
    
    return flow
  } catch (error) {
    console.error('Erro ao importar fluxo:', error)
    return null
  }
}

export async function exportFlow(flowId: string, tenantId: string): Promise<any | null> {
  const engine = new FlowEngine(tenantId)
  const flow = await engine.getFlow(flowId)
  
  if (!flow) return null
  
  // Remover campos internos
  const { id: _id, tenantId: _tenant, createdAt: _createdAt, updatedAt: _updatedAt, ...exportData } = flow
  
  return exportData
}
