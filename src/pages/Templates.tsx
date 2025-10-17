import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  Plus,
  Search,
  Filter,
  MoreHorizontal,
  Edit,
  Copy,
  Trash2,
  Eye,
  FileText,
  MessageSquare,
  Zap,
  Tag,
  ToggleLeft,
  ToggleRight,
  Loader2,
  AlertCircle,
  CheckCircle,
  Save,
  X,
  Code,
  Hash
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { useTemplates, Template } from '@/hooks/useTemplates'
import { TEMPLATE_VARIABLES } from '@/constants/templateVariables'

const TEMPLATE_CATEGORIES = [
  'Vendas',
  'Marketing',
  'Suporte',
  'Follow-up',
  'Promoção',
  'Boas-vindas',
  'Cobrança',
  'Pesquisa',
  'Outros'
]

export default function Templates() {
  const navigate = useNavigate()
  const { 
    templates, 
    stats, 
    loading, 
    createTemplate, 
    updateTemplate, 
    deleteTemplate,
    duplicateTemplate,
    toggleTemplateStatus,
    getTemplatesByCategory,
    getActiveTemplates,
    searchTemplates,
    getCategories
  } = useTemplates()
  
  const [searchTerm, setSearchTerm] = useState('')
  const [filterCategory, setFilterCategory] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  
  const [formData, setFormData] = useState({
    name: '',
    content: '',
    category: '',
    variables: [] as string[],
    is_active: true
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [variablesDialogOpen, setVariablesDialogOpen] = useState(false)

  const filteredTemplates = templates.filter(template => {
    const matchesSearch = searchTerm === '' || 
      template.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      template.content.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesCategory = filterCategory === 'all' || template.category === filterCategory
    const matchesStatus = filterStatus === 'all' || 
      (filterStatus === 'active' && template.is_active) ||
      (filterStatus === 'inactive' && !template.is_active)
    
    return matchesSearch && matchesCategory && matchesStatus
  })

  const resetForm = () => {
    setFormData({
      name: '',
      content: '',
      category: '',
      variables: [],
      is_active: true
    })
    setErrors({})
  }

  const validateForm = () => {
    const newErrors: Record<string, string> = {}
    
    if (!formData.name.trim()) {
      newErrors.name = 'Nome do template é obrigatório'
    }
    
    if (!formData.content.trim()) {
      newErrors.content = 'Conteúdo do template é obrigatório'
    }
    
    if (!formData.category) {
      newErrors.category = 'Categoria é obrigatória'
    }
    
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const extractVariables = (content: string) => {
    const variableRegex = /\{([^}]+)\}/g
    const variables = []
    let match
    
    while ((match = variableRegex.exec(content)) !== null) {
      if (!variables.includes(match[1])) {
        variables.push(match[1])
      }
    }
    
    return variables
  }

  const handleContentChange = (content: string) => {
    setFormData(prev => ({
      ...prev,
      content,
      variables: extractVariables(content)
    }))
  }

  const handleCreate = async () => {
    if (!validateForm()) return
    
    try {
      setActionLoading('create')
      await createTemplate(formData)
      setCreateDialogOpen(false)
      resetForm()
    } catch (error) {
      console.error('Erro ao criar template:', error)
    } finally {
      setActionLoading(null)
    }
  }

  const handleEdit = async () => {
    if (!validateForm() || !selectedTemplate) return
    
    try {
      setActionLoading('edit')
      await updateTemplate(selectedTemplate.id, formData)
      setEditDialogOpen(false)
      setSelectedTemplate(null)
      resetForm()
    } catch (error) {
      console.error('Erro ao editar template:', error)
    } finally {
      setActionLoading(null)
    }
  }

  const handleDelete = async () => {
    if (!selectedTemplate) return
    
    try {
      setActionLoading('delete')
      await deleteTemplate(selectedTemplate.id)
      setDeleteDialogOpen(false)
      setSelectedTemplate(null)
    } catch (error) {
      console.error('Erro ao excluir template:', error)
    } finally {
      setActionLoading(null)
    }
  }

  const handleDuplicate = async (template: Template) => {
    try {
      setActionLoading(template.id)
      await duplicateTemplate(template)
    } catch (error) {
      console.error('Erro ao duplicar template:', error)
    } finally {
      setActionLoading(null)
    }
  }

  const handleToggleStatus = async (template: Template) => {
    try {
      setActionLoading(template.id)
      await toggleTemplateStatus(template.id)
    } catch (error) {
      console.error('Erro ao alterar status:', error)
    } finally {
      setActionLoading(null)
    }
  }

  const openEditDialog = (template: Template) => {
    setSelectedTemplate(template)
    setFormData({
      name: template.name,
      content: template.content,
      category: template.category,
      variables: template.variables,
      is_active: template.is_active
    })
    setEditDialogOpen(true)
  }

  const openPreviewDialog = (template: Template) => {
    setSelectedTemplate(template)
    setPreviewDialogOpen(true)
  }

  const openDeleteDialog = (template: Template) => {
    setSelectedTemplate(template)
    setDeleteDialogOpen(true)
  }

  const handlePreview = (template: any) => {
    setSelectedTemplate(template)
    setPreviewDialogOpen(true)
  }



  const handleSubmit = async () => {
    if (!validateForm()) return
    
    setIsSubmitting(true)
    try {
      if (selectedTemplate) {
        await updateTemplate(selectedTemplate.id, formData)
        setEditDialogOpen(false)
      } else {
        await createTemplate(formData)
        setCreateDialogOpen(false)
      }
      resetForm()
    } catch (error) {
      console.error('Erro ao salvar template:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteConfirm = async () => {
    if (!selectedTemplate) return
    
    try {
      await deleteTemplate(selectedTemplate.id)
      setDeleteDialogOpen(false)
      setSelectedTemplate(null)
    } catch (error) {
      console.error('Erro ao deletar template:', error)
    }
  }

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
    
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: ''
      }))
    }
  }

  const insertVariable = (variable: string) => {
    const textarea = document.getElementById('template-content') as HTMLTextAreaElement
    if (textarea) {
      const start = textarea.selectionStart
      const end = textarea.selectionEnd
      const text = formData.content
      const before = text.substring(0, start)
      const after = text.substring(end)
      const newText = before + `{${variable}}` + after
      
      handleInputChange('content', newText)
      
      // Reposicionar cursor
      setTimeout(() => {
        textarea.focus()
        textarea.setSelectionRange(start + variable.length + 2, start + variable.length + 2)
      }, 0)
    }
  }

  const getCategoryInfo = (categoryId: string) => {
    return TEMPLATE_CATEGORIES.find(cat => cat.id === categoryId) || TEMPLATE_CATEGORIES[0]
  }

  const renderPreviewContent = (content: string) => {
    return content.replace(/\{([^}]+)\}/g, (match, variable) => {
      const varInfo = TEMPLATE_VARIABLES.find(v => v.name === variable)
      return varInfo ? varInfo.example : match
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Templates</h1>
          <p className="text-muted-foreground">Gerencie seus templates de mensagem</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={() => setVariablesDialogOpen(true)}>
            <Code className="h-4 w-4 mr-2" />
            Variáveis
          </Button>
          <Button onClick={handleCreate}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Template
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total de Templates</p>
                <p className="text-2xl font-bold">{templates.length}</p>
              </div>
              <FileText className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Templates Ativos</p>
                <p className="text-2xl font-bold">{templates.filter(t => t.is_active).length}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Categorias</p>
                <p className="text-2xl font-bold">{new Set(templates.map(t => t.category)).size}</p>
              </div>
              <Tag className="h-8 w-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Mais Usado</p>
                <p className="text-2xl font-bold">
                  {Math.max(...templates.map(t => t.usage_count || 0), 0)}
                </p>
              </div>
              <Star className="h-8 w-8 text-yellow-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Search */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar templates..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-full lg:w-48">
                <SelectValue placeholder="Categoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as Categorias</SelectItem>
                {TEMPLATE_CATEGORIES.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
              <SelectTrigger className="w-full lg:w-48">
                <SelectValue placeholder="Ordenar por" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="created_at">Mais Recentes</SelectItem>
                <SelectItem value="name">Nome A-Z</SelectItem>
                <SelectItem value="category">Categoria</SelectItem>
                <SelectItem value="usage">Mais Usados</SelectItem>
              </SelectContent>
            </Select>
            
            <div className="flex items-center gap-2">
              <Button
                variant={viewMode === 'grid' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('grid')}
              >
                <Palette className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === 'list' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewMode('list')}
              >
                <FileText className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Templates Grid/List */}
      {sortedTemplates.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <MessageSquare className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">Nenhum template encontrado</h3>
            <p className="text-muted-foreground mb-6">
              {searchTerm || selectedCategory !== 'all' 
                ? 'Tente ajustar os filtros de busca' 
                : 'Crie seu primeiro template para começar'
              }
            </p>
            {!searchTerm && selectedCategory === 'all' && (
              <Button onClick={handleCreate}>
                <Plus className="h-4 w-4 mr-2" />
                Criar Primeiro Template
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className={viewMode === 'grid' 
          ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6' 
          : 'space-y-4'
        }>
          {sortedTemplates.map((template) => {
            const categoryInfo = getCategoryInfo(template.category)
            const IconComponent = categoryInfo.icon
            
            return viewMode === 'grid' ? (
              <Card key={template.id} className="hover:shadow-lg transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${categoryInfo.color} text-white`}>
                        <IconComponent className="h-4 w-4" />
                      </div>
                      <div>
                        <CardTitle className="text-lg">{template.name}</CardTitle>
                        <Badge variant="outline" className="text-xs">
                          {categoryInfo.name}
                        </Badge>
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handlePreview(template)}>
                          <Eye className="h-4 w-4 mr-2" />
                          Visualizar
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleEdit(template)}>
                          <Edit className="h-4 w-4 mr-2" />
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleDuplicate(template)}>
                          <Copy className="h-4 w-4 mr-2" />
                          Duplicar
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                          onClick={() => handleDelete(template)}
                          className="text-red-600"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground line-clamp-3 mb-4">
                    {template.content}
                  </p>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Usado {template.usage_count || 0}x</span>
                    <span>{new Date(template.created_at).toLocaleDateString('pt-BR')}</span>
                  </div>
                  {template.variables && template.variables.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-3">
                      {template.variables.slice(0, 3).map((variable) => (
                        <Badge key={variable} variant="secondary" className="text-xs">
                          {'{' + variable + '}'}
                        </Badge>
                      ))}
                      {template.variables.length > 3 && (
                        <Badge variant="secondary" className="text-xs">
                          +{template.variables.length - 3}
                        </Badge>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            ) : (
              <Card key={template.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 flex-1">
                      <div className={`p-2 rounded-lg ${categoryInfo.color} text-white`}>
                        <IconComponent className="h-4 w-4" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-1">
                          <h3 className="font-semibold">{template.name}</h3>
                          <Badge variant="outline" className="text-xs">
                            {categoryInfo.name}
                          </Badge>
                          {!template.is_active && (
                            <Badge variant="secondary" className="text-xs">
                              Inativo
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-1">
                          {template.content}
                        </p>
                        <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                          <span>Usado {template.usage_count || 0}x</span>
                          <span>{new Date(template.created_at).toLocaleDateString('pt-BR')}</span>
                          {template.variables && template.variables.length > 0 && (
                            <span>{template.variables.length} variáveis</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="sm" onClick={() => handlePreview(template)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleEdit(template)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleDuplicate(template)}>
                            <Copy className="h-4 w-4 mr-2" />
                            Duplicar
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem 
                            onClick={() => handleDelete(template)}
                            className="text-red-600"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={createDialogOpen || editDialogOpen} onOpenChange={(open) => {
        if (!open) {
          setCreateDialogOpen(false)
          setEditDialogOpen(false)
          resetForm()
          setSelectedTemplate(null)
        }
      }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedTemplate ? 'Editar Template' : 'Novo Template'}
            </DialogTitle>
            <DialogDescription>
              {selectedTemplate 
                ? 'Modifique as informações do template' 
                : 'Crie um novo template de mensagem'
              }
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Form */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome do Template *</Label>
                <Input
                  id="name"
                  placeholder="Ex: Boas-vindas para novos clientes"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  className={errors.name ? 'border-red-500' : ''}
                />
                {errors.name && (
                  <p className="text-sm text-red-600 flex items-center gap-1">
                    <AlertCircle className="h-4 w-4" />
                    {errors.name}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="category">Categoria *</Label>
                <Select value={formData.category} onValueChange={(value) => handleInputChange('category', value)}>
                  <SelectTrigger className={errors.category ? 'border-red-500' : ''}>
                    <SelectValue placeholder="Selecione uma categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    {TEMPLATE_CATEGORIES.map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        <div className="flex items-center gap-2">
                          <category.icon className="h-4 w-4" />
                          {category.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.category && (
                  <p className="text-sm text-red-600 flex items-center gap-1">
                    <AlertCircle className="h-4 w-4" />
                    {errors.category}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Descrição (Opcional)</Label>
                <Textarea
                  id="description"
                  placeholder="Descreva quando usar este template..."
                  value={formData.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="template-content">Conteúdo do Template *</Label>
                <Textarea
                  id="template-content"
                  placeholder="Digite o conteúdo do template aqui..."
                  value={formData.content}
                  onChange={(e) => handleInputChange('content', e.target.value)}
                  rows={8}
                  className={errors.content ? 'border-red-500' : ''}
                />
                {errors.content && (
                  <p className="text-sm text-red-600 flex items-center gap-1">
                    <AlertCircle className="h-4 w-4" />
                    {errors.content}
                  </p>
                )}
                <p className="text-sm text-muted-foreground">
                  Use {'{variavel}'} para inserir variáveis dinâmicas
                </p>
              </div>

              {/* Variables Panel */}
              <div className="space-y-2">
                <Label>Variáveis Disponíveis</Label>
                <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto">
                  {TEMPLATE_VARIABLES.map((variable) => (
                    <Button
                      key={variable.name}
                      variant="outline"
                      size="sm"
                      onClick={() => insertVariable(variable.name)}
                      className="justify-start text-xs"
                    >
                      <Hash className="h-3 w-3 mr-1" />
                      {variable.name}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="is_active"
                    checked={formData.is_active}
                    onCheckedChange={(checked) => handleInputChange('is_active', checked)}
                  />
                  <Label htmlFor="is_active">Template ativo</Label>
                </div>
              </div>
            </div>

            {/* Preview */}
            <div className="space-y-4">
              <div>
                <Label>Prévia do Template</Label>
                <div className="mt-2 p-4 bg-green-50 border border-green-200 rounded-lg">
                  <div className="bg-white rounded-lg p-3 shadow-sm">
                    <p className="text-sm whitespace-pre-wrap">
                      {formData.content ? renderPreviewContent(formData.content) : 'Digite o conteúdo para ver a prévia...'}
                    </p>
                  </div>
                </div>
              </div>

              {formData.variables.length > 0 && (
                <div>
                  <Label>Variáveis Detectadas</Label>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {formData.variables.map((variable) => (
                      <Badge key={variable} variant="secondary">
                        {'{' + variable + '}'}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label>Informações do Template</Label>
                <div className="text-sm space-y-1">
                  <p><strong>Caracteres:</strong> {formData.content.length}</p>
                  <p><strong>Palavras:</strong> {formData.content.split(/\s+/).filter(word => word.length > 0).length}</p>
                  <p><strong>Variáveis:</strong> {formData.variables.length}</p>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setCreateDialogOpen(false)
              setEditDialogOpen(false)
              resetForm()
            }}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Salvando...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  {selectedTemplate ? 'Atualizar' : 'Criar'} Template
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={previewDialogOpen} onOpenChange={setPreviewDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Prévia do Template</DialogTitle>
            <DialogDescription>
              {selectedTemplate?.name}
            </DialogDescription>
          </DialogHeader>
          
          {selectedTemplate && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <strong>Categoria:</strong> {getCategoryInfo(selectedTemplate.category).name}
                </div>
                <div>
                  <strong>Criado em:</strong> {new Date(selectedTemplate.created_at).toLocaleDateString('pt-BR')}
                </div>
                <div>
                  <strong>Usado:</strong> {selectedTemplate.usage_count || 0} vezes
                </div>
                <div>
                  <strong>Status:</strong> {selectedTemplate.is_active ? 'Ativo' : 'Inativo'}
                </div>
              </div>
              
              <Separator />
              
              <div>
                <Label>Conteúdo Original</Label>
                <div className="mt-2 p-3 bg-muted rounded-lg">
                  <p className="text-sm whitespace-pre-wrap">{selectedTemplate.content}</p>
                </div>
              </div>
              
              <div>
                <Label>Prévia com Dados de Exemplo</Label>
                <div className="mt-2 p-4 bg-green-50 border border-green-200 rounded-lg">
                  <div className="bg-white rounded-lg p-3 shadow-sm">
                    <p className="text-sm whitespace-pre-wrap">
                      {renderPreviewContent(selectedTemplate.content)}
                    </p>
                  </div>
                </div>
              </div>
              
              {selectedTemplate.variables && selectedTemplate.variables.length > 0 && (
                <div>
                  <Label>Variáveis Utilizadas</Label>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {selectedTemplate.variables.map((variable: string) => (
                      <Badge key={variable} variant="outline">
                        {'{' + variable + '}'}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewDialogOpen(false)}>
              Fechar
            </Button>
            <Button onClick={() => {
              setPreviewDialogOpen(false)
              handleEdit(selectedTemplate)
            }}>
              <Edit className="h-4 w-4 mr-2" />
              Editar Template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Variables Help Dialog */}
      <Dialog open={variablesDialogOpen} onOpenChange={setVariablesDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Guia de Variáveis</DialogTitle>
            <DialogDescription>
              Use essas variáveis em seus templates para personalizar mensagens
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {TEMPLATE_VARIABLES.map((variable) => (
                <div key={variable.name} className="p-4 border rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <code className="text-sm font-mono bg-muted px-2 py-1 rounded">
                      {'{' + variable.name + '}'}
                    </code>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        navigator.clipboard.writeText(`{${variable.name}}`)
                      }}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-sm text-muted-foreground mb-1">{variable.description}</p>
                  <p className="text-sm"><strong>Exemplo:</strong> {variable.example}</p>
                </div>
              ))}
            </div>
            
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h4 className="font-medium mb-2 flex items-center gap-2">
                <Zap className="h-4 w-4" />
                Dicas de Uso
              </h4>
              <ul className="text-sm space-y-1 text-blue-800">
                <li>• Use variáveis para personalizar mensagens automaticamente</li>
                <li>• Combine múltiplas variáveis em um mesmo template</li>
                <li>• Teste sempre com dados reais antes de usar em campanhas</li>
                <li>• Variáveis não encontradas serão exibidas como texto normal</li>
              </ul>
            </div>
          </div>
          
          <DialogFooter>
            <Button onClick={() => setVariablesDialogOpen(false)}>
              Entendi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Exclusão</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir o template "{selectedTemplate?.name}"?
              Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDeleteConfirm}>
              <Trash2 className="h-4 w-4 mr-2" />
              Excluir Template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}