/**
 * Sistema de Templates Avançados
 * 
 * Gerencia templates de mensagens com:
 * - Variáveis dinâmicas
 * - Rich media (imagens, vídeos, botões)
 * - Preview em tempo real
 * - Validação de variáveis
 * - Suporte a múltiplos canais (WhatsApp, Email, SMS)
 */

import { supabase } from './supabase'
import { addQueueJob } from './queue'
import { redis } from './redis'
import { monitorFunction } from './monitoring'
import { v4 as uuidv4 } from 'uuid'

// Tipos de templates suportados
export const TEMPLATE_TYPES = {
  WHATSAPP: 'whatsapp',
  EMAIL: 'email',
  SMS: 'sms',
  PUSH: 'push'
} as const

export type TemplateType = typeof TEMPLATE_TYPES[keyof typeof TEMPLATE_TYPES]

// Tipos de variáveis suportadas
export const VARIABLE_TYPES = {
  TEXT: 'text',
  NUMBER: 'number',
  DATE: 'date',
  BOOLEAN: 'boolean',
  URL: 'url',
  EMAIL: 'email',
  PHONE: 'phone',
  IMAGE: 'image',
  VIDEO: 'video',
  DOCUMENT: 'document'
} as const

export type VariableType = typeof VARIABLE_TYPES[keyof typeof VARIABLE_TYPES]

// Componentes de rich media
export const RICH_MEDIA_COMPONENTS = {
  IMAGE: 'image',
  VIDEO: 'video',
  BUTTON: 'button',
  QUICK_REPLY: 'quick_reply',
  LIST: 'list',
  LOCATION: 'location',
  CONTACT: 'contact',
  DOCUMENT: 'document',
  AUDIO: 'audio'
} as const

export type RichMediaComponent = typeof RICH_MEDIA_COMPONENTS[keyof typeof RICH_MEDIA_COMPONENTS]

export interface TemplateVariable {
  name: string
  type: VariableType
  required: boolean
  defaultValue?: any
  description?: string
  validation?: {
    minLength?: number
    maxLength?: number
    pattern?: string
    options?: string[]
  }
}

export interface RichMediaItem {
  type: RichMediaComponent
  content: string
  url?: string
  caption?: string
  buttons?: Array<{
    text: string
    type: 'url' | 'phone' | 'copy' | 'reply'
    value: string
  }>
  items?: Array<{
    title: string
    description?: string
    id: string
  }>
}

export interface MessageTemplate {
  id: string
  name: string
  description?: string
  type: TemplateType
  content: string
  variables: TemplateVariable[]
  richMedia?: RichMediaItem[]
  category: 'marketing' | 'transactional' | 'utility' | 'authentication'
  language: string
  isActive: boolean
  createdBy: string
  tenantId: string
  createdAt: string
  updatedAt: string
  usageCount: number
  lastUsedAt?: string
  approved: boolean
  approvedBy?: string
  approvedAt?: string
}

export interface TemplatePreview {
  content: string
  variables: Record<string, any>
  richMedia?: RichMediaItem[]
  errors: string[]
  warnings: string[]
}

/**
 * Valida variáveis em um template
 */
export function validateTemplateVariables(
  template: MessageTemplate,
  variables: Record<string, any>
): { valid: boolean; errors: string[]; warnings: string[] } {
  const errors: string[] = []
  const warnings: string[] = []

  // Verificar variáveis obrigatórias
  template.variables.forEach(variable => {
    const value = variables[variable.name]
    
    if (variable.required && (value === undefined || value === null || value === '')) {
      errors.push(`Variável obrigatória '${variable.name}' não fornecida`)
      return
    }

    if (value === undefined || value === null || value === '') {
      return // Variável opcional vazia
    }

    // Validação por tipo
    switch (variable.type) {
      case VARIABLE_TYPES.TEXT:
        if (typeof value !== 'string') {
          errors.push(`Variável '${variable.name}' deve ser texto`)
        } else if (variable.validation) {
          if (variable.validation.minLength && value.length < variable.validation.minLength) {
            errors.push(`Texto '${variable.name}' muito curto (mínimo ${variable.validation.minLength})`)
          }
          if (variable.validation.maxLength && value.length > variable.validation.maxLength) {
            errors.push(`Texto '${variable.name}' muito longo (máximo ${variable.validation.maxLength})`)
          }
          if (variable.validation.pattern && !new RegExp(variable.validation.pattern).test(value)) {
            errors.push(`Texto '${variable.name}' não corresponde ao padrão esperado`)
          }
          if (variable.validation.options && !variable.validation.options.includes(value)) {
            errors.push(`Texto '${variable.name}' deve ser uma das opções: ${variable.validation.options.join(', ')}`)
          }
        }
        break

      case VARIABLE_TYPES.NUMBER:
        if (typeof value !== 'number' && isNaN(Number(value))) {
          errors.push(`Variável '${variable.name}' deve ser número`)
        }
        break

      case VARIABLE_TYPES.DATE:
        if (!isValidDate(value)) {
          errors.push(`Variável '${variable.name}' deve ser data válida`)
        }
        break

      case VARIABLE_TYPES.BOOLEAN:
        if (typeof value !== 'boolean' && value !== 'true' && value !== 'false') {
          errors.push(`Variável '${variable.name}' deve ser booleano`)
        }
        break

      case VARIABLE_TYPES.URL:
        if (!isValidUrl(value)) {
          errors.push(`Variável '${variable.name}' deve ser URL válida`)
        }
        break

      case VARIABLE_TYPES.EMAIL:
        if (!isValidEmail(value)) {
          errors.push(`Variável '${variable.name}' deve ser email válido`)
        }
        break

      case VARIABLE_TYPES.PHONE:
        if (!isValidPhone(value)) {
          errors.push(`Variável '${variable.name}' deve ser telefone válido`)
        }
        break

      case VARIABLE_TYPES.IMAGE:
      case VARIABLE_TYPES.VIDEO:
      case VARIABLE_TYPES.DOCUMENT:
        if (typeof value !== 'string' || !isValidUrl(value)) {
          errors.push(`Variável '${variable.name}' deve ser URL válida de ${variable.type}`)
        }
        break
    }
  })

  // Verificar variáveis não definidas no template
  Object.keys(variables).forEach(varName => {
    if (!template.variables.find(v => v.name === varName)) {
      warnings.push(`Variável '${varName}' não definida no template`)
    }
  })

  return {
    valid: errors.length === 0,
    errors,
    warnings
  }
}

/**
 * Processa template com variáveis
 */
export function processTemplate(
  template: MessageTemplate,
  variables: Record<string, any>
): TemplatePreview {
  const { valid, errors, warnings } = validateTemplateVariables(template, variables)

  if (!valid) {
    return {
      content: template.content,
      variables,
      richMedia: template.richMedia,
      errors,
      warnings
    }
  }

  // Substituir variáveis no conteúdo
  let processedContent = template.content
  template.variables.forEach(variable => {
    const value = variables[variable.name] || variable.defaultValue || ''
    const placeholder = `{{${variable.name}}}`
    processedContent = processedContent.replace(new RegExp(placeholder, 'g'), String(value))
  })

  // Processar rich media
  const processedRichMedia = template.richMedia?.map(item => {
    if (item.type === 'image' || item.type === 'video' || item.type === 'document') {
      return {
        ...item,
        url: processRichMediaContent(item.url || item.content, variables)
      }
    }
    
    if (item.type === 'button' && item.buttons) {
      return {
        ...item,
        buttons: item.buttons.map(button => ({
          ...button,
          value: processRichMediaContent(button.value, variables)
        }))
      }
    }

    return item
  })

  return {
    content: processedContent,
    variables,
    richMedia: processedRichMedia,
    errors: [],
    warnings
  }
}

/**
 * Processa conteúdo de rich media
 */
function processRichMediaContent(content: string, variables: Record<string, any>): string {
  let processed = content
  Object.entries(variables).forEach(([key, value]) => {
    const placeholder = `{{${key}}}`
    processed = processed.replace(new RegExp(placeholder, 'g'), String(value))
  })
  return processed
}

/**
 * Detecta variáveis em um template
 */
export function detectTemplateVariables(content: string): string[] {
  const variableRegex = /\{\{([^}]+)\}\}/g
  const variables = new Set<string>()
  let match

  while ((match = variableRegex.exec(content)) !== null) {
    const varName = match[1].trim()
    if (varName && !varName.includes(' ')) {
      variables.add(varName)
    }
  }

  return Array.from(variables)
}

/**
 * Cria novo template
 */
export async function createTemplate(
  templateData: Omit<MessageTemplate, 'id' | 'createdAt' | 'updatedAt' | 'usageCount' | 'approved'>
): Promise<MessageTemplate> {
  return monitorFunction(
    async () => {
      const template: MessageTemplate = {
        ...templateData,
        id: uuidv4(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        usageCount: 0,
        approved: false
      }

      const { data, error } = await supabase
        .from('message_templates')
        .insert(template)
        .select()
        .single()

      if (error) {
        throw new Error(`Erro ao criar template: ${error.message}`)
      }

      // Adicionar à fila para aprovação se necessário
      if (templateData.category === 'marketing') {
        await addQueueJob('template', 'review', {
          templateId: template.id,
          type: template.type
        })
      }

      // Limpar cache
      await redis.del(`templates:${templateData.tenantId}`)

      return data
    },
    {
      functionName: 'createTemplate',
      category: 'database',
      metadata: { 
        name: templateData.name,
        type: templateData.type,
        category: templateData.category,
        tenantId: templateData.tenantId
      }
    }
  )()
}

/**
 * Lista templates do tenant
 */
export async function listTemplates(
  tenantId: string,
  options?: {
    type?: TemplateType
    category?: string
    isActive?: boolean
    approved?: boolean
    search?: string
    limit?: number
    offset?: number
  }
): Promise<MessageTemplate[]> {
  return monitorFunction(
    async () => {
      // Verificar cache
      const cacheKey = `templates:${tenantId}:${JSON.stringify(options || {})}`
      const cached = await redis.get(cacheKey)
      if (cached) {
        return JSON.parse(cached)
      }

      let query = supabase
        .from('message_templates')
        .select('*')
        .eq('tenantId', tenantId)

      // Filtros
      if (options?.type) {
        query = query.eq('type', options.type)
      }

      if (options?.category) {
        query = query.eq('category', options.category)
      }

      if (options?.isActive !== undefined) {
        query = query.eq('isActive', options.isActive)
      }

      if (options?.approved !== undefined) {
        query = query.eq('approved', options.approved)
      }

      if (options?.search) {
        query = query.or(`name.ilike.%${options.search}%,description.ilike.%${options.search}%`)
      }

      // Paginação
      const limit = options?.limit || 50
      const offset = options?.offset || 0
      query = query.range(offset, offset + limit - 1)

      // Ordenação
      query = query.order('createdAt', { ascending: false })

      const { data, error } = await query

      if (error) {
        throw new Error(`Erro ao listar templates: ${error.message}`)
      }

      // Armazenar em cache
      await redis.setex(cacheKey, 300, JSON.stringify(data || []))

      return data || []
    },
    {
      functionName: 'listTemplates',
      category: 'database',
      metadata: { 
        tenantId, 
        type: options?.type,
        category: options?.category,
        search: options?.search,
        limit: options?.limit,
        offset: options?.offset
      }
    }
  )()
}

/**
 * Obtém template por ID
 */
export async function getTemplateById(
  templateId: string,
  tenantId: string
): Promise<MessageTemplate | null> {
  return monitorFunction(
    async () => {
      // Verificar cache
      const cacheKey = `template:${templateId}`
      const cached = await redis.get(cacheKey)
      if (cached) {
        return JSON.parse(cached)
      }

      const { data, error } = await supabase
        .from('message_templates')
        .select('*')
        .eq('id', templateId)
        .eq('tenantId', tenantId)
        .single()

      if (error || !data) {
        return null
      }

      // Armazenar em cache
      await redis.setex(cacheKey, 600, JSON.stringify(data))

      return data
    },
    {
      functionName: 'getTemplateById',
      category: 'database',
      metadata: { templateId, tenantId }
    }
  )()
}

/**
 * Atualiza template
 */
export async function updateTemplate(
  templateId: string,
  tenantId: string,
  updates: Partial<MessageTemplate>
): Promise<MessageTemplate | null> {
  return monitorFunction(
    async () => {
      const { data, error } = await supabase
        .from('message_templates')
        .update({
          ...updates,
          updatedAt: new Date().toISOString()
        })
        .eq('id', templateId)
        .eq('tenantId', tenantId)
        .select()
        .single()

      if (error) {
        throw new Error(`Erro ao atualizar template: ${error.message}`)
      }

      // Limpar caches
      await redis.del(`template:${templateId}`)
      await redis.del(`templates:${tenantId}`)

      return data
    },
    {
      functionName: 'updateTemplate',
      category: 'database',
      metadata: { templateId, tenantId, updates: Object.keys(updates) }
    }
  )()
}

/**
 * Deleta template
 */
export async function deleteTemplate(
  templateId: string,
  tenantId: string
): Promise<boolean> {
  return monitorFunction(
    async () => {
      const { error } = await supabase
        .from('message_templates')
        .delete()
        .eq('id', templateId)
        .eq('tenantId', tenantId)

      if (error) {
        throw new Error(`Erro ao deletar template: ${error.message}`)
      }

      // Limpar caches
      await redis.del(`template:${templateId}`)
      await redis.del(`templates:${tenantId}`)

      return true
    },
    {
      functionName: 'deleteTemplate',
      category: 'database',
      metadata: { templateId, tenantId }
    }
  )()
}

/**
 * Aprova template
 */
export async function approveTemplate(
  templateId: string,
  tenantId: string,
  approvedBy: string
): Promise<MessageTemplate | null> {
  return monitorFunction(
    async () => {
      const { data, error } = await supabase
        .from('message_templates')
        .update({
          approved: true,
          approvedBy,
          approvedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        })
        .eq('id', templateId)
        .eq('tenantId', tenantId)
        .select()
        .single()

      if (error) {
        throw new Error(`Erro ao aprovar template: ${error.message}`)
      }

      // Limpar cache
      await redis.del(`template:${templateId}`)

      return data
    },
    {
      functionName: 'approveTemplate',
      category: 'database',
      metadata: { templateId, tenantId, approvedBy }
    }
  )()
}

/**
 * Incrementa contador de uso do template
 */
export async function incrementTemplateUsage(
  templateId: string,
  tenantId: string
): Promise<void> {
  return monitorFunction(
    async () => {
      const { error } = await supabase
        .from('message_templates')
        .update({
          usageCount: supabase.sql`usage_count + 1`,
          lastUsedAt: new Date().toISOString()
        })
        .eq('id', templateId)
        .eq('tenantId', tenantId)

      if (error) {
        console.error('Erro ao incrementar uso do template:', error)
      }

      // Limpar cache
      await redis.del(`template:${templateId}`)
    },
    {
      functionName: 'incrementTemplateUsage',
      category: 'database',
      metadata: { templateId, tenantId }
    }
  )()
}

/**
 * Funções utilitárias
 */
function isValidDate(date: any): boolean {
  return !isNaN(Date.parse(date))
}

function isValidUrl(url: string): boolean {
  try {
    new URL(url)
    return true
  } catch {
    return false
  }
}

function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

function isValidPhone(phone: string): boolean {
  const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/
  return phoneRegex.test(phone.replace(/[\s\-\(\)]/g, ''))
}