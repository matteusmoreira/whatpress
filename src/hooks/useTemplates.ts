import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { useTenant } from '@/hooks/useTenant'

export interface Template {
  id: string
  name: string
  content: string
  category: string
  description?: string
  variables: string[]
  is_active: boolean
  usage_count?: number
  created_at: string
  updated_at: string
}

export interface TemplateStats {
  total_templates: number
  active_templates: number
  categories_count: number
  most_used_template: string | null
}

export function useTemplates() {
  const { user } = useAuth()
  const { currentTenant } = useTenant()
  const [templates, setTemplates] = useState<Template[]>([])
  const [stats, setStats] = useState<TemplateStats | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchTemplates = async () => {
    if (!user) return

    try {
      setLoading(true)
      // Preferir tenant_id quando disponível; fallback para user_id
      let dataResp: any[] = []
      const { data, error } = await supabase
        .from('message_templates')
        .select('*')
        .eq(currentTenant?.id ? 'tenant_id' : 'user_id', currentTenant?.id ?? user.id)
        .order('created_at', { ascending: false })

      if (error) {
        if (currentTenant?.id) {
          const fallback = await supabase
            .from('message_templates')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
          if (fallback.error) throw fallback.error
          dataResp = fallback.data || []
        } else {
          throw error
        }
      } else {
        dataResp = data || []
      }

      // Processar dados para garantir que variables seja um array
      const processedData = dataResp.map(template => ({
        ...template,
        variables: Array.isArray(template.variables) ? template.variables : [],
        usage_count: template.usage_count || 0
      }))

      setTemplates(processedData)
    } catch (error) {
      console.error('Erro ao buscar templates:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchStats = async () => {
    if (!user) return

    try {
      let dataResp: any[] = []
      const { data, error } = await supabase
        .from('message_templates')
        .select('id, category, is_active, usage_count')
        .eq(currentTenant?.id ? 'tenant_id' : 'user_id', currentTenant?.id ?? user.id)

      if (error) {
        if (currentTenant?.id) {
          const fallback = await supabase
            .from('message_templates')
            .select('id, category, is_active, usage_count')
            .eq('user_id', user.id)
          if (fallback.error) throw fallback.error
          dataResp = fallback.data || []
        } else {
          throw error
        }
      } else {
        dataResp = data || []
      }

      const templates = dataResp || []
      const categories = [...new Set(templates.map(t => t.category))]
      
      // Encontrar template mais usado
      const mostUsed = templates.reduce((prev, current) => 
        (current.usage_count || 0) > (prev.usage_count || 0) ? current : prev
      , templates[0])
      
      setStats({
        total_templates: templates.length,
        active_templates: templates.filter(t => t.is_active).length,
        categories_count: categories.length,
        most_used_template: mostUsed?.id || null
      })
    } catch (error) {
      console.error('Erro ao buscar estatísticas de templates:', error)
    }
  }

  const createTemplate = async (templateData: Omit<Template, 'id' | 'created_at' | 'updated_at'>) => {
    if (!user) throw new Error('Usuário não autenticado')

    // Tentar inserir com tenant_id quando disponível; fallback para schema legado
    try {
      const { data, error } = await supabase
        .from('message_templates')
        .insert([{ 
          ...templateData, 
          user_id: user.id, 
          usage_count: 0,
          ...(currentTenant?.id ? { tenant_id: currentTenant.id } : {})
        }])
        .select()
        .single()

      if (error) throw error

      const processedData = {
        ...data,
        variables: Array.isArray(data.variables) ? data.variables : [],
        usage_count: data.usage_count || 0
      }

      setTemplates(prev => [processedData, ...prev])
      await fetchStats()
      return processedData
    } catch (err: any) {
      // Fallback: tentar sem tenant_id
      const fb = await supabase
        .from('message_templates')
        .insert([{ 
          ...templateData, 
          user_id: user.id, 
          usage_count: 0
        }])
        .select()
        .single()

      if (fb.error) throw fb.error

      const processedData = {
        ...fb.data,
        variables: Array.isArray(fb.data.variables) ? fb.data.variables : [],
        usage_count: fb.data.usage_count || 0
      }

      setTemplates(prev => [processedData, ...prev])
      await fetchStats()
      return processedData
    }
  }

  const updateTemplate = async (id: string, updates: Partial<Template>) => {
    if (!user) throw new Error('Usuário não autenticado')

    // Atualizar com filtro por tenant quando disponível; fallback para user_id
    let updated: any = null
    const base = supabase.from('message_templates').update(updates).eq('id', id)
    const withFilter = currentTenant?.id ? base.eq('tenant_id', currentTenant.id) : base.eq('user_id', user.id)
    const { data, error } = await withFilter.select().single()

    if (error && currentTenant?.id) {
      const fb = await supabase
        .from('message_templates')
        .update(updates)
        .eq('id', id)
        .eq('user_id', user.id)
        .select()
        .single()
      if (fb.error) throw fb.error
      updated = fb.data
    } else if (error) {
      throw error
    } else {
      updated = data
    }

    const processedData = {
      ...updated,
      variables: Array.isArray(updated.variables) ? updated.variables : [],
      usage_count: updated.usage_count || 0
    }

    setTemplates(prev => prev.map(template => 
      template.id === id ? { ...template, ...processedData } : template
    ))
    await fetchStats()
    return processedData
  }

  const deleteTemplate = async (id: string) => {
    if (!user) throw new Error('Usuário não autenticado')

    const base = supabase.from('message_templates').delete().eq('id', id)
    const withFilter = currentTenant?.id ? base.eq('tenant_id', currentTenant.id) : base.eq('user_id', user.id)
    const { error } = await withFilter

    if (error && currentTenant?.id) {
      const fb = await supabase
        .from('message_templates')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id)
      if (fb.error) throw fb.error
    } else if (error) {
      throw error
    }

    setTemplates(prev => prev.filter(template => template.id !== id))
    await fetchStats()
  }

  const duplicateTemplate = async (template: Template) => {
    if (!user) throw new Error('Usuário não autenticado')

    const duplicatedTemplate = {
      name: `${template.name} (Cópia)`,
      content: template.content,
      category: template.category,
      description: template.description,
      variables: template.variables,
      is_active: false
    }

    return await createTemplate(duplicatedTemplate)
  }

  const toggleTemplateStatus = async (id: string) => {
    const template = templates.find(t => t.id === id)
    if (!template) return

    await updateTemplate(id, { is_active: !template.is_active })
  }

  const incrementUsageCount = async (id: string) => {
    const template = templates.find(t => t.id === id)
    if (!template) return

    const newUsageCount = (template.usage_count || 0) + 1
    await updateTemplate(id, { usage_count: newUsageCount })
  }

  const getTemplatesByCategory = (category: string) => {
    return templates.filter(template => template.category === category)
  }

  const getActiveTemplates = () => {
    return templates.filter(template => template.is_active)
  }

  const searchTemplates = (query: string) => {
    const lowercaseQuery = query.toLowerCase()
    return templates.filter(template => 
      template.name.toLowerCase().includes(lowercaseQuery) ||
      template.content.toLowerCase().includes(lowercaseQuery) ||
      template.category.toLowerCase().includes(lowercaseQuery) ||
      (template.description && template.description.toLowerCase().includes(lowercaseQuery))
    )
  }

  const getCategories = () => {
    return [...new Set(templates.map(template => template.category))]
  }

  const getMostUsedTemplates = (limit: number = 5) => {
    return [...templates]
      .sort((a, b) => (b.usage_count || 0) - (a.usage_count || 0))
      .slice(0, limit)
  }

  const getTemplateVariables = (templateId: string) => {
    const template = templates.find(t => t.id === templateId)
    return template?.variables || []
  }

  useEffect(() => {
    if (user) {
      fetchTemplates()
      fetchStats()
    }
    // Recarregar ao trocar o tenant
  }, [user, currentTenant?.id])

  return {
    templates,
    stats,
    loading,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    duplicateTemplate,
    toggleTemplateStatus,
    incrementUsageCount,
    getTemplatesByCategory,
    getActiveTemplates,
    searchTemplates,
    getCategories,
    getMostUsedTemplates,
    getTemplateVariables,
    refetch: fetchTemplates
  }
}