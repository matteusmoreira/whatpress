import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import { Checkbox } from '@/components/ui/checkbox'
import { 
  ArrowLeft,
  Send,
  Users,
  MessageSquare,
  Calendar,
  Clock,
  Target,
  Filter,
  Plus,
  X,
  Eye,
  Save,
  Loader2,
  CheckCircle,
  AlertCircle,
  Upload,
  FileText,
  Zap,
  Search,
  Tag,
  UserCheck,
  UserX,
  Globe,
  MapPin,
  Phone,
  Mail,
  Sparkles
} from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Progress } from '@/components/ui/progress'
import { useCampaigns } from '@/hooks/useCampaigns'
import { useContacts } from '@/hooks/useContacts'
import { useTemplates } from '@/hooks/useTemplates'

interface CampaignFormData {
  name: string
  description: string
  message: string
  scheduled_at: string
  target_contacts: string[]
  template_id?: string
  segmentation?: {
    tags?: string[]
    location?: string
    age_range?: { min: number; max: number }
    last_interaction?: string
  }
}

interface ContactSegment {
  id: string
  name: string
  description: string
  count: number
  contacts: string[]
}

export default function CreateCampaign() {
  const navigate = useNavigate()
  const { createCampaign, loading: campaignLoading } = useCampaigns()
  const { contacts, loading: contactsLoading } = useContacts()
  const { templates, loading: templatesLoading } = useTemplates()
  
  const [formData, setFormData] = useState<CampaignFormData>({
    name: '',
    description: '',
    message: '',
    scheduled_at: '',
    target_contacts: [],
    segmentation: {}
  })
  
  const [selectedContacts, setSelectedContacts] = useState<string[]>([])
  const [contactFilter, setContactFilter] = useState('')
  const [scheduleEnabled, setScheduleEnabled] = useState(false)
  const [previewMode, setPreviewMode] = useState(false)
  const [currentStep, setCurrentStep] = useState(1)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [segmentationMode, setSegmentationMode] = useState<'manual' | 'smart'>('manual')
  const [smartSegments, setSmartSegments] = useState<ContactSegment[]>([])

  // Filtros avançados
  const [tagFilter, setTagFilter] = useState<string[]>([])
  const [locationFilter, setLocationFilter] = useState('')
  const [lastInteractionFilter, setLastInteractionFilter] = useState('')

  const filteredContacts = contacts.filter(contact => {
    const matchesSearch = contact.name.toLowerCase().includes(contactFilter.toLowerCase()) ||
      contact.phone.includes(contactFilter)
    
    const matchesTags = tagFilter.length === 0 || 
      tagFilter.some(tag => contact.tags?.includes(tag))
    
    const matchesLocation = !locationFilter || 
      contact.location?.toLowerCase().includes(locationFilter.toLowerCase())
    
    return matchesSearch && matchesTags && matchesLocation
  })

  // Gerar segmentos inteligentes
  const generateSmartSegments = () => {
    const segments: ContactSegment[] = [
      {
        id: 'recent_customers',
        name: 'Clientes Recentes',
        description: 'Contatos que interagiram nos últimos 7 dias',
        count: contacts.filter(c => {
          const lastMsg = new Date(c.last_message_at || 0)
          const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
          return lastMsg > weekAgo
        }).length,
        contacts: contacts.filter(c => {
          const lastMsg = new Date(c.last_message_at || 0)
          const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
          return lastMsg > weekAgo
        }).map(c => c.id)
      },
      {
        id: 'inactive_contacts',
        name: 'Contatos Inativos',
        description: 'Sem interação há mais de 30 dias',
        count: contacts.filter(c => {
          const lastMsg = new Date(c.last_message_at || 0)
          const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
          return lastMsg < monthAgo
        }).length,
        contacts: contacts.filter(c => {
          const lastMsg = new Date(c.last_message_at || 0)
          const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
          return lastMsg < monthAgo
        }).map(c => c.id)
      },
      {
        id: 'vip_contacts',
        name: 'Contatos VIP',
        description: 'Contatos com tag VIP ou Premium',
        count: contacts.filter(c => 
          c.tags?.some(tag => ['VIP', 'Premium', 'Importante'].includes(tag))
        ).length,
        contacts: contacts.filter(c => 
          c.tags?.some(tag => ['VIP', 'Premium', 'Importante'].includes(tag))
        ).map(c => c.id)
      },
      {
        id: 'new_contacts',
        name: 'Novos Contatos',
        description: 'Adicionados nos últimos 14 dias',
        count: contacts.filter(c => {
          const created = new Date(c.created_at)
          const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)
          return created > twoWeeksAgo
        }).length,
        contacts: contacts.filter(c => {
          const created = new Date(c.created_at)
          const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)
          return created > twoWeeksAgo
        }).map(c => c.id)
      }
    ]
    
    setSmartSegments(segments.filter(s => s.count > 0))
  }

  const handleInputChange = (field: keyof CampaignFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }))
    }
  }

  const handleContactToggle = (contactId: string) => {
    setSelectedContacts(prev => 
      prev.includes(contactId) 
        ? prev.filter(id => id !== contactId)
        : [...prev, contactId]
    )
  }

  const handleSelectAllContacts = () => {
    if (selectedContacts.length === filteredContacts.length) {
      setSelectedContacts([])
    } else {
      setSelectedContacts(filteredContacts.map(c => c.id))
    }
  }

  const handleSegmentSelect = (segment: ContactSegment) => {
    setSelectedContacts(segment.contacts)
  }

  const handleTemplateSelect = (templateId: string) => {
    const template = templates.find(t => t.id === templateId)
    if (template) {
      setFormData(prev => ({
        ...prev,
        template_id: templateId,
        message: template.content
      }))
    }
  }

  const validateForm = () => {
    const newErrors: Record<string, string> = {}
    
    if (!formData.name.trim()) {
      newErrors.name = 'Nome da campanha é obrigatório'
    }
    
    if (!formData.message.trim()) {
      newErrors.message = 'Mensagem é obrigatória'
    }
    
    if (selectedContacts.length === 0) {
      newErrors.contacts = 'Selecione pelo menos um contato'
    }
    
    if (scheduleEnabled && !formData.scheduled_at) {
      newErrors.scheduled_at = 'Data de agendamento é obrigatória'
    }
    
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async () => {
    if (!validateForm()) return
    
    try {
      const campaignData = {
        ...formData,
        target_contacts: selectedContacts,
        scheduled_at: scheduleEnabled ? formData.scheduled_at : null
      }
      
      await createCampaign(campaignData)
      navigate('/dashboard/campaigns')
    } catch (error) {
      console.error('Erro ao criar campanha:', error)
    }
  }

  const handleSaveDraft = async () => {
    try {
      const campaignData = {
        ...formData,
        target_contacts: selectedContacts,
        status: 'draft'
      }
      
      await createCampaign(campaignData)
      navigate('/dashboard/campaigns')
    } catch (error) {
      console.error('Erro ao salvar rascunho:', error)
    }
  }

  const getStepIcon = (step: number) => {
    if (currentStep > step) return <CheckCircle className="h-5 w-5 text-green-600" />
    if (currentStep === step) return <div className="h-5 w-5 rounded-full bg-primary text-white flex items-center justify-center text-sm font-bold">{step}</div>
    return <div className="h-5 w-5 rounded-full bg-muted text-muted-foreground flex items-center justify-center text-sm">{step}</div>
  }

  const getStepTitle = (step: number) => {
    const titles = {
      1: 'Informações Básicas',
      2: 'Seleção de Público',
      3: 'Mensagem e Template',
      4: 'Agendamento',
      5: 'Revisão e Envio'
    }
    return titles[step as keyof typeof titles]
  }

  if (contactsLoading || templatesLoading) {
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
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard/campaigns')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-foreground">Nova Campanha</h1>
            <p className="text-muted-foreground">Crie uma nova campanha de WhatsApp</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={handleSaveDraft} disabled={campaignLoading}>
            <Save className="h-4 w-4 mr-2" />
            Salvar Rascunho
          </Button>
          <Button onClick={() => setPreviewMode(!previewMode)} variant="outline">
            <Eye className="h-4 w-4 mr-2" />
            {previewMode ? 'Editar' : 'Visualizar'}
          </Button>
        </div>
      </div>

      {/* Progress Steps */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Progresso da Criação</h3>
            <span className="text-sm text-muted-foreground">Passo {currentStep} de 5</span>
          </div>
          <div className="flex items-center justify-between mb-4">
            {[1, 2, 3, 4, 5].map((step, index) => (
              <div key={step} className="flex items-center">
                <div className="flex flex-col items-center">
                  {getStepIcon(step)}
                  <span className="text-xs mt-2 text-center max-w-20">
                    {getStepTitle(step)}
                  </span>
                </div>
                {index < 4 && (
                  <div className={`h-0.5 w-16 mx-2 ${currentStep > step ? 'bg-green-600' : 'bg-muted'}`} />
                )}
              </div>
            ))}
          </div>
          <Progress value={(currentStep / 5) * 100} className="h-2" />
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          <Tabs value={currentStep.toString()} onValueChange={(value) => setCurrentStep(parseInt(value))}>
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="1">Básico</TabsTrigger>
              <TabsTrigger value="2">Público</TabsTrigger>
              <TabsTrigger value="3">Mensagem</TabsTrigger>
              <TabsTrigger value="4">Agenda</TabsTrigger>
              <TabsTrigger value="5">Revisão</TabsTrigger>
            </TabsList>

            {/* Passo 1: Informações Básicas */}
            <TabsContent value="1" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Informações da Campanha
                  </CardTitle>
                  <CardDescription>
                    Defina o nome e descrição da sua campanha
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Nome da Campanha *</Label>
                    <Input
                      id="name"
                      placeholder="Ex: Promoção Black Friday 2024"
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
                    <Label htmlFor="description">Descrição (Opcional)</Label>
                    <Textarea
                      id="description"
                      placeholder="Descreva o objetivo desta campanha..."
                      value={formData.description}
                      onChange={(e) => handleInputChange('description', e.target.value)}
                      rows={3}
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Passo 2: Seleção de Público */}
            <TabsContent value="2" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Seleção de Público-Alvo
                  </CardTitle>
                  <CardDescription>
                    Escolha os contatos que receberão a campanha
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Modo de Segmentação */}
                  <div className="flex items-center gap-4">
                    <Button
                      variant={segmentationMode === 'manual' ? 'default' : 'outline'}
                      onClick={() => setSegmentationMode('manual')}
                      className="gap-2"
                    >
                      <UserCheck className="h-4 w-4" />
                      Seleção Manual
                    </Button>
                    <Button
                      variant={segmentationMode === 'smart' ? 'default' : 'outline'}
                      onClick={() => {
                        setSegmentationMode('smart')
                        generateSmartSegments()
                      }}
                      className="gap-2"
                    >
                      <Sparkles className="h-4 w-4" />
                      Segmentação Inteligente
                    </Button>
                  </div>

                  {segmentationMode === 'smart' ? (
                    /* Segmentação Inteligente */
                    <div className="space-y-4">
                      <h4 className="font-medium">Segmentos Sugeridos</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {smartSegments.map((segment) => (
                          <Card 
                            key={segment.id} 
                            className="cursor-pointer hover:shadow-md transition-shadow"
                            onClick={() => handleSegmentSelect(segment)}
                          >
                            <CardContent className="p-4">
                              <div className="flex items-center justify-between mb-2">
                                <h5 className="font-medium">{segment.name}</h5>
                                <Badge variant="secondary">{segment.count}</Badge>
                              </div>
                              <p className="text-sm text-muted-foreground">{segment.description}</p>
                              <Button 
                                size="sm" 
                                className="w-full mt-3"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleSegmentSelect(segment)
                                }}
                              >
                                Selecionar Segmento
                              </Button>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </div>
                  ) : (
                    /* Seleção Manual */
                    <div className="space-y-4">
                      {/* Filtros */}
                      <div className="flex flex-col lg:flex-row gap-4">
                        <div className="relative flex-1">
                          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            placeholder="Buscar contatos..."
                            value={contactFilter}
                            onChange={(e) => setContactFilter(e.target.value)}
                            className="pl-10"
                          />
                        </div>
                        <Select value={locationFilter} onValueChange={setLocationFilter}>
                          <SelectTrigger className="w-full lg:w-48">
                            <SelectValue placeholder="Localização" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="">Todas</SelectItem>
                            <SelectItem value="São Paulo">São Paulo</SelectItem>
                            <SelectItem value="Rio de Janeiro">Rio de Janeiro</SelectItem>
                            <SelectItem value="Belo Horizonte">Belo Horizonte</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Ações em Massa */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Checkbox
                            checked={selectedContacts.length === filteredContacts.length && filteredContacts.length > 0}
                            onCheckedChange={handleSelectAllContacts}
                          />
                          <span className="text-sm">
                            Selecionar todos ({filteredContacts.length})
                          </span>
                        </div>
                        <Badge variant="secondary">
                          {selectedContacts.length} selecionados
                        </Badge>
                      </div>

                      {/* Lista de Contatos */}
                      <div className="max-h-96 overflow-y-auto space-y-2">
                        {filteredContacts.map((contact) => (
                          <div
                            key={contact.id}
                            className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50"
                          >
                            <div className="flex items-center gap-3">
                              <Checkbox
                                checked={selectedContacts.includes(contact.id)}
                                onCheckedChange={() => handleContactToggle(contact.id)}
                              />
                              <div>
                                <p className="font-medium">{contact.name}</p>
                                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                  <span className="flex items-center gap-1">
                                    <Phone className="h-3 w-3" />
                                    {contact.phone}
                                  </span>
                                  {contact.location && (
                                    <span className="flex items-center gap-1">
                                      <MapPin className="h-3 w-3" />
                                      {contact.location}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {contact.tags?.map((tag) => (
                                <Badge key={tag} variant="outline" className="text-xs">
                                  {tag}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {errors.contacts && (
                    <p className="text-sm text-red-600 flex items-center gap-1">
                      <AlertCircle className="h-4 w-4" />
                      {errors.contacts}
                    </p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Passo 3: Mensagem e Template */}
            <TabsContent value="3" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MessageSquare className="h-5 w-5" />
                    Mensagem da Campanha
                  </CardTitle>
                  <CardDescription>
                    Escreva sua mensagem ou use um template
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Seleção de Template */}
                  <div className="space-y-2">
                    <Label>Template (Opcional)</Label>
                    <Select value={formData.template_id || ''} onValueChange={handleTemplateSelect}>
                      <SelectTrigger>
                        <SelectValue placeholder="Escolha um template..." />
                      </SelectTrigger>
                      <SelectContent>
                        {templates.map((template) => (
                          <SelectItem key={template.id} value={template.id}>
                            {template.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Editor de Mensagem */}
                  <div className="space-y-2">
                    <Label htmlFor="message">Mensagem *</Label>
                    <Textarea
                      id="message"
                      placeholder="Digite sua mensagem aqui..."
                      value={formData.message}
                      onChange={(e) => handleInputChange('message', e.target.value)}
                      rows={8}
                      className={errors.message ? 'border-red-500' : ''}
                    />
                    {errors.message && (
                      <p className="text-sm text-red-600 flex items-center gap-1">
                        <AlertCircle className="h-4 w-4" />
                        {errors.message}
                      </p>
                    )}
                    <p className="text-sm text-muted-foreground">
                      Use variáveis como {'{nome}'}, {'{empresa}'} para personalizar
                    </p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Passo 4: Agendamento */}
            <TabsContent value="4" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="h-5 w-5" />
                    Agendamento da Campanha
                  </CardTitle>
                  <CardDescription>
                    Defina quando a campanha será enviada
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Agendar Envio</Label>
                      <p className="text-sm text-muted-foreground">
                        Ative para programar o envio da campanha
                      </p>
                    </div>
                    <Switch
                      checked={scheduleEnabled}
                      onCheckedChange={setScheduleEnabled}
                    />
                  </div>

                  {scheduleEnabled && (
                    <div className="space-y-2">
                      <Label htmlFor="scheduled_at">Data e Hora do Envio *</Label>
                      <Input
                        id="scheduled_at"
                        type="datetime-local"
                        value={formData.scheduled_at}
                        onChange={(e) => handleInputChange('scheduled_at', e.target.value)}
                        className={errors.scheduled_at ? 'border-red-500' : ''}
                        min={new Date().toISOString().slice(0, 16)}
                      />
                      {errors.scheduled_at && (
                        <p className="text-sm text-red-600 flex items-center gap-1">
                          <AlertCircle className="h-4 w-4" />
                          {errors.scheduled_at}
                        </p>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Passo 5: Revisão */}
            <TabsContent value="5" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5" />
                    Revisão da Campanha
                  </CardTitle>
                  <CardDescription>
                    Revise todos os detalhes antes de criar a campanha
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <div>
                        <h4 className="font-medium mb-2">Informações Básicas</h4>
                        <div className="space-y-2 text-sm">
                          <p><strong>Nome:</strong> {formData.name || 'Não definido'}</p>
                          <p><strong>Descrição:</strong> {formData.description || 'Nenhuma'}</p>
                        </div>
                      </div>
                      
                      <div>
                        <h4 className="font-medium mb-2">Público-Alvo</h4>
                        <div className="space-y-2 text-sm">
                          <p><strong>Contatos selecionados:</strong> {selectedContacts.length}</p>
                          <p><strong>Modo:</strong> {segmentationMode === 'smart' ? 'Segmentação Inteligente' : 'Seleção Manual'}</p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="space-y-4">
                      <div>
                        <h4 className="font-medium mb-2">Agendamento</h4>
                        <div className="space-y-2 text-sm">
                          <p><strong>Tipo:</strong> {scheduleEnabled ? 'Agendada' : 'Envio Imediato'}</p>
                          {scheduleEnabled && (
                            <p><strong>Data/Hora:</strong> {formData.scheduled_at ? new Date(formData.scheduled_at).toLocaleString('pt-BR') : 'Não definida'}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-medium mb-2">Prévia da Mensagem</h4>
                    <div className="p-4 bg-muted rounded-lg">
                      <p className="whitespace-pre-wrap">{formData.message || 'Nenhuma mensagem definida'}</p>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <Button onClick={handleSubmit} disabled={campaignLoading} className="flex-1">
                      {campaignLoading ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          Criando...
                        </>
                      ) : (
                        <>
                          <Send className="h-4 w-4 mr-2" />
                          {scheduleEnabled ? 'Agendar Campanha' : 'Criar e Enviar'}
                        </>
                      )}
                    </Button>
                    <Button variant="outline" onClick={handleSaveDraft} disabled={campaignLoading}>
                      <Save className="h-4 w-4 mr-2" />
                      Salvar Rascunho
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Estatísticas */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Resumo da Campanha</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Contatos selecionados</span>
                <Badge variant="secondary">{selectedContacts.length}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Alcance estimado</span>
                <Badge variant="secondary">{selectedContacts.length * 0.95}%</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Custo estimado</span>
                <Badge variant="secondary">R$ {(selectedContacts.length * 0.05).toFixed(2)}</Badge>
              </div>
            </CardContent>
          </Card>

          {/* Dicas */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Zap className="h-5 w-5" />
                Dicas para Sucesso
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="text-sm space-y-2">
                <p className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                  Use variáveis para personalizar mensagens
                </p>
                <p className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                  Teste com um grupo pequeno primeiro
                </p>
                <p className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                  Evite horários de descanso
                </p>
                <p className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                  Mantenha mensagens concisas
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}