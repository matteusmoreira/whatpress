import React, { useState, useEffect } from 'react'
import { useTemplates } from '../../hooks/useTemplates'
import { MessageTemplate, TemplateVariable, RichMediaItem } from '../../lib/templates'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { Textarea } from '../ui/Textarea'
import { Select } from '../ui/Select'
import { Card } from '../ui/Card'
import { Badge } from '../ui/Badge'
import { toast } from 'sonner'
import { Plus, Edit, Trash2, Eye, Search, Filter, Copy, Send, Check, X } from 'lucide-react'
import { cn } from '../../lib/utils'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

interface TemplateManagerProps {
  onSelectTemplate?: (template: MessageTemplate) => void
  onSendTemplate?: (template: MessageTemplate) => void
  selectedTemplateId?: string
  showActions?: boolean
}

export function TemplateManager({ 
  onSelectTemplate, 
  onSendTemplate, 
  selectedTemplateId,
  showActions = true 
}: TemplateManagerProps) {
  const { 
    templates, 
    isLoading, 
    error,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    approveTemplate,
    TEMPLATE_TYPES,
    VARIABLE_TYPES,
    RICH_MEDIA_COMPONENTS 
  } = useTemplates()

  const [searchTerm, setSearchTerm] = useState('')
  const [typeFilter, setTypeFilter] = useState<string>('')
  const [categoryFilter, setCategoryFilter] = useState<string>('')
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [showForm, setShowForm] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<MessageTemplate | null>(null)
  const [previewTemplate, setPreviewTemplate] = useState<MessageTemplate | null>(null)

  // Estado do formulário
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    type: 'whatsapp' as const,
    content: '',
    category: 'transactional' as const,
    language: 'pt-BR',
    isActive: true,
    variables: [] as TemplateVariable[],
    richMedia: [] as RichMediaItem[]
  })

  // Estado de preview
  const [previewVariables, setPreviewVariables] = useState<Record<string, any>>({})

  // Filtrar templates
  const filteredTemplates = templates.filter(template => {
    if (searchTerm && !template.name.toLowerCase().includes(searchTerm.toLowerCase()) && 
        !template.description?.toLowerCase().includes(searchTerm.toLowerCase())) {
      return false
    }
    if (typeFilter && template.type !== typeFilter) return false
    if (categoryFilter && template.category !== categoryFilter) false
    if (statusFilter === 'active' && !template.isActive) return false
    if (statusFilter === 'inactive' && template.isActive) return false
    if (statusFilter === 'approved' && !template.approved) return false
    if (statusFilter === 'pending' && template.approved) return false
    return true
  })

  // Detectar variáveis automaticamente
  useEffect(() => {
    if (formData.content) {
      const variableRegex = /\{\{([^}]+)\}\}/g
      const detectedVariables = new Set<string>()
      let match

      while ((match = variableRegex.exec(formData.content)) !== null) {
        const varName = match[1].trim()
        if (varName && !varName.includes(' ')) {
          detectedVariables.add(varName)
        }
      }

      const newVariables = Array.from(detectedVariables).map(varName => ({
        name: varName,
        type: 'text' as const,
        required: true,
        description: ''
      }))

      setFormData(prev => ({
        ...prev,
        variables: newVariables
      }))
    }
  }, [formData.content])

  // Handlers
  const handleCreate = () => {
    setEditingTemplate(null)
    setFormData({
      name: '',
      description: '',
      type: 'whatsapp',
      content: '',
      category: 'transactional',
      language: 'pt-BR',
      isActive: true,
      variables: [],
      richMedia: []
    })
    setShowForm(true)
  }

  const handleEdit = (template: MessageTemplate) => {
    setEditingTemplate(template)
    setFormData({
      name: template.name,
      description: template.description || '',
      type: template.type,
      content: template.content,
      category: template.category,
      language: template.language,
      isActive: template.isActive,
      variables: template.variables,
      richMedia: template.richMedia || []
    })
    setShowForm(true)
  }

  const handleDelete = async (template: MessageTemplate) => {
    if (!confirm(`Tem certeza que deseja excluir o template "${template.name}"?`)) {
      return
    }

    try {
      const success = await deleteTemplate(template.id)
      if (success) {
        toast.success('Template excluído com sucesso')
      } else {
        toast.error('Erro ao excluir template')
      }
    } catch (error) {
      toast.error('Erro ao excluir template')
    }
  }

  const handleApprove = async (template: MessageTemplate) => {
    try {
      const approvedTemplate = await approveTemplate(template.id)
      if (approvedTemplate) {
        toast.success('Template aprovado com sucesso')
      } else {
        toast.error('Erro ao aprovar template')
      }
    } catch (error) {
      toast.error('Erro ao aprovar template')
    }
  }

  const handlePreview = (template: MessageTemplate) => {
    setPreviewTemplate(template)
    // Inicializar variáveis de preview com valores de exemplo
    const exampleVariables: Record<string, any> = {}
    template.variables.forEach(variable => {
      switch (variable.type) {
        case 'text':
          exampleVariables[variable.name] = `Exemplo ${variable.name}`
          break
        case 'number':
          exampleVariables[variable.name] = 123
          break
        case 'date':
          exampleVariables[variable.name] = new Date().toISOString().split('T')[0]
          break
        case 'boolean':
          exampleVariables[variable.name] = true
          break
        case 'url':
          exampleVariables[variable.name] = 'https://exemplo.com'
          break
        case 'email':
          exampleVariables[variable.name] = 'exemplo@email.com'
          break
        case 'phone':
          exampleVariables[variable.name] = '+5511999999999'
          break
        default:
          exampleVariables[variable.name] = `Valor ${variable.name}`
      }
    })
    setPreviewVariables(exampleVariables)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      if (editingTemplate) {
        const updatedTemplate = await updateTemplate(editingTemplate.id, formData)
        if (updatedTemplate) {
          toast.success('Template atualizado com sucesso')
          setShowForm(false)
        } else {
          toast.error('Erro ao atualizar template')
        }
      } else {
        const newTemplate = await createTemplate(formData)
        if (newTemplate) {
          toast.success('Template criado com sucesso')
          setShowForm(false)
        } else {
          toast.error('Erro ao criar template')
        }
      }
    } catch (error) {
      toast.error('Erro ao salvar template')
    }
  }

  // Renderização do preview
  const renderPreview = () => {
    if (!previewTemplate) return null

    const preview = processTemplate(previewTemplate, previewVariables)

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <Card className="max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
          <div className="p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Preview: {previewTemplate.name}</h3>
              <button
                onClick={() => setPreviewTemplate(null)}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Variáveis */}
            <div className="mb-6">
              <h4 className="font-medium mb-2">Variáveis:</h4>
              <div className="space-y-2">
                {previewTemplate.variables.map(variable => (
                  <div key={variable.name} className="flex items-center gap-2">
                    <label className="w-32 text-sm font-medium">{variable.name}:</label>
                    <Input
                      value={previewVariables[variable.name] || ''}
                      onChange={(e) => setPreviewVariables(prev => ({
                        ...prev,
                        [variable.name]: e.target.value
                      }))}
                      className="flex-1"
                      placeholder={`Valor para ${variable.name}`}
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Mensagem processada */}
            <div className="mb-4">
              <h4 className="font-medium mb-2">Mensagem:</h4>
              <div className="bg-gray-50 p-4 rounded-lg">
                <pre className="whitespace-pre-wrap font-sans">{preview.content}</pre>
              </div>
            </div>

            {/* Erros e avisos */}
            {preview.errors.length > 0 && (
              <div className="mb-4">
                <h4 className="font-medium text-red-600 mb-2">Erros:</h4>
                <ul className="text-sm text-red-600 space-y-1">
                  {preview.errors.map((error, index) => (
                    <li key={index}>• {error}</li>
                  ))}
                </ul>
              </div>
            )}

            {preview.warnings.length > 0 && (
              <div className="mb-4">
                <h4 className="font-medium text-yellow-600 mb-2">Avisos:</h4>
                <ul className="text-sm text-yellow-600 space-y-1">
                  {preview.warnings.map((warning, index) => (
                    <li key={index}>• {warning}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Rich Media */}
            {preview.richMedia && preview.richMedia.length > 0 && (
              <div className="mb-4">
                <h4 className="font-medium mb-2">Rich Media:</h4>
                <div className="space-y-2">
                  {preview.richMedia.map((item, index) => (
                    <div key={index} className="bg-gray-100 p-3 rounded">
                      <div className="font-medium text-sm">{item.type}</div>
                      <div className="text-sm text-gray-600">{item.content}</div>
                      {item.url && <div className="text-sm text-blue-600">{item.url}</div>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Card>
      </div>
    )
  }

  // Renderização do formulário
  const renderForm = () => {
    if (!showForm) return null

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <Card className="max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
          <form onSubmit={handleSubmit} className="p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-semibold">
                {editingTemplate ? 'Editar Template' : 'Novo Template'}
              </h3>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Informações básicas */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Nome *</label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    required
                    placeholder="Nome do template"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Descrição</label>
                  <Textarea
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Descrição do template"
                    rows={3}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Tipo</label>
                  <Select
                    value={formData.type}
                    onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value as any }))}
                  >
                    {Object.entries(TEMPLATE_TYPES).map(([key, value]) => (
                      <option key={key} value={value}>{key}</option>
                    ))}
                  </Select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Categoria</label>
                  <Select
                    value={formData.category}
                    onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value as any }))}
                  >
                    <option value="transactional">Transacional</option>
                    <option value="marketing">Marketing</option>
                    <option value="utility">Utilitário</option>
                    <option value="authentication">Autenticação</option>
                  </Select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Idioma</label>
                  <Input
                    value={formData.language}
                    onChange={(e) => setFormData(prev => ({ ...prev, language: e.target.value }))}
                    placeholder="pt-BR"
                  />
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="isActive"
                    checked={formData.isActive}
                    onChange={(e) => setFormData(prev => ({ ...prev, isActive: e.target.checked }))}
                    className="mr-2"
                  />
                  <label htmlFor="isActive" className="text-sm font-medium">Ativo</label>
                </div>
              </div>

              {/* Conteúdo */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Conteúdo *</label>
                  <Textarea
                    value={formData.content}
                    onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
                    required
                    placeholder="Conteúdo do template (use {{variavel}} para variáveis)"
                    rows={8}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Use {{nome}} para variáveis. Elas serão detectadas automaticamente.
                  </p>
                </div>

                {/* Variáveis detectadas */}
                {formData.variables.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium mb-2">Variáveis Detectadas</label>
                    <div className="space-y-2 max-h-32 overflow-y-auto">
                      {formData.variables.map((variable, index) => (
                        <div key={index} className="flex items-center gap-2 text-sm">
                          <span className="font-mono bg-gray-100 px-2 py-1 rounded">
                            {{variable.name}}
                          </span>
                          <select
                            value={variable.type}
                            onChange={(e) => {
                              const newVariables = [...formData.variables]
                              newVariables[index].type = e.target.value as any
                              setFormData(prev => ({ ...prev, variables: newVariables }))
                            }}
                            className="text-xs border rounded px-2 py-1"
                          >
                            {Object.entries(VARIABLE_TYPES).map(([key, value]) => (
                              <option key={key} value={value}>{key}</option>
                            ))}
                          </select>
                          <input
                            type="text"
                            value={variable.description || ''}
                            onChange={(e) => {
                              const newVariables = [...formData.variables]
                              newVariables[index].description = e.target.value
                              setFormData(prev => ({ ...prev, variables: newVariables }))
                            }}
                            placeholder="Descrição"
                            className="text-xs border rounded px-2 py-1 flex-1"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowForm(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? 'Salvando...' : (editingTemplate ? 'Atualizar' : 'Criar')}
              </Button>
            </div>
          </form>
        </Card>
      </div>
    )
  }

  if (error) {
    return (
      <Card className="p-6">
        <div className="text-center text-red-600">
          <p>Erro ao carregar templates: {error}</p>
        </div>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Templates de Mensagens</h2>
        {showActions && (
          <Button onClick={handleCreate}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Template
          </Button>
        )}
      </div>

      {/* Filtros */}
      <Card className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Buscar templates..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          <Select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
          >
            <option value="">Todos os tipos</option>
            {Object.entries(TEMPLATE_TYPES).map(([key, value]) => (
              <option key={key} value={value}>{key}</option>
            ))}
          </Select>

          <Select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
          >
            <option value="">Todas categorias</option>
            <option value="transactional">Transacional</option>
            <option value="marketing">Marketing</option>
            <option value="utility">Utilitário</option>
            <option value="authentication">Autenticação</option>
          </Select>

          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">Todos status</option>
            <option value="active">Ativo</option>
            <option value="inactive">Inativo</option>
            <option value="approved">Aprovado</option>
            <option value="pending">Pendente</option>
          </Select>
        </div>
      </Card>

      {/* Lista de templates */}
      {isLoading ? (
        <Card className="p-6">
          <div className="text-center text-gray-500">Carregando templates...</div>
        </Card>
      ) : filteredTemplates.length === 0 ? (
        <Card className="p-6">
          <div className="text-center text-gray-500">
            {searchTerm || typeFilter || categoryFilter || statusFilter
              ? 'Nenhum template encontrado com os filtros aplicados'
              : 'Nenhum template criado ainda'}
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTemplates.map(template => (
            <Card 
              key={template.id} 
              className={cn(
                'p-4 hover:shadow-lg transition-shadow',
                selectedTemplateId === template.id && 'ring-2 ring-blue-500'
              )}
            >
              <div className="space-y-3">
                {/* Cabeçalho */}
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg">{template.name}</h3>
                    {template.description && (
                      <p className="text-sm text-gray-600 mt-1">{template.description}</p>
                    )}
                  </div>
                  <div className="flex gap-1">
                    {!template.approved && (
                      <Badge variant="warning" className="text-xs">Pendente</Badge>
                    )}
                    <Badge 
                      variant={template.isActive ? 'success' : 'secondary'}
                      className="text-xs"
                    >
                      {template.isActive ? 'Ativo' : 'Inativo'}
                    </Badge>
                  </div>
                </div>

                {/* Informações */}
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Tipo:</span>
                    <span className="capitalize">{template.type}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Categoria:</span>
                    <span className="capitalize">{template.category}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Idioma:</span>
                    <span>{template.language}</span>
                  </div>
                  {template.usageCount > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Usos:</span>
                      <span>{template.usageCount}</span>
                    </div>
                  )}
                  {template.lastUsedAt && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Último uso:</span>
                      <span>{format(new Date(template.lastUsedAt), 'dd/MM/yyyy', { locale: ptBR })}</span>
                    </div>
                  )}
                </div>

                {/* Variáveis */}
                {template.variables.length > 0 && (
                  <div>
                    <span className="text-sm text-gray-500">Variáveis:</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {template.variables.map(variable => (
                        <Badge key={variable.name} variant="outline" className="text-xs">
                          {{variable.name}}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Preview do conteúdo */}
                <div className="bg-gray-50 p-3 rounded">
                  <div className="text-sm text-gray-700 line-clamp-3">
                    {template.content}
                  </div>
                </div>

                {/* Ações */}
                {showActions && (
                  <div className="flex gap-2 pt-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handlePreview(template)}
                      className="flex-1"
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      Preview
                    </Button>
                    
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleEdit(template)}
                      className="flex-1"
                    >
                      <Edit className="h-4 w-4 mr-1" />
                      Editar
                    </Button>

                    {!template.approved && (
                      <Button
                        size="sm"
                        variant="success"
                        onClick={() => handleApprove(template)}
                        className="flex-1"
                      >
                        <Check className="h-4 w-4 mr-1" />
                        Aprovar
                      </Button>
                    )}

                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleDelete(template)}
                      className="flex-1"
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      Excluir
                    </Button>

                    {onSelectTemplate && (
                      <Button
                        size="sm"
                        onClick={() => onSelectTemplate(template)}
                        className="flex-1"
                      >
                        <Copy className="h-4 w-4 mr-1" />
                        Selecionar
                      </Button>
                    )}

                    {onSendTemplate && (
                      <Button
                        size="sm"
                        variant="primary"
                        onClick={() => onSendTemplate(template)}
                        className="flex-1"
                      >
                        <Send className="h-4 w-4 mr-1" />
                        Enviar
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Modais */}
      {renderForm()}
      {renderPreview()}
    </div>
  )
}