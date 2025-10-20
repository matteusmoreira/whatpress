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
  Sparkles,
  Settings,
  Network,
  Shuffle,
  Gauge
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
import { useMultiSession } from '@/hooks/useMultiSession'
import { useRandomization } from '@/hooks/useRandomization'
import { useRateLimit } from '@/hooks/useRateLimit'

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
  // Configurações avançadas
  multi_session_config?: {
    enabled: boolean
    load_balancing_strategy: 'least_loaded' | 'priority_based' | 'round_robin' | 'random'
    max_retries: number
    failover_enabled: boolean
  }
  randomization_config?: {
    enabled: boolean
    profile_id?: string
    delay_variance: number
    template_rotation: boolean
    human_simulation: boolean
  }
  rate_limit_config?: {
    enabled: boolean
    config_id?: string
    messages_per_minute: number
    burst_control: boolean
    adaptive_rate: boolean
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
  const { instances, loadBalancingConfig } = useMultiSession()
  const { profiles: randomizationProfiles, activeProfile } = useRandomization()
  const { configs: rateLimitConfigs, activeConfigs } = useRateLimit()
  
  const [formData, setFormData] = useState<CampaignFormData>({
    name: '',
    description: '',
    message: '',
    scheduled_at: '',
    target_contacts: [],
    segmentation: {},
    // Configurações padrão avançadas
    multi_session_config: {
      enabled: true,
      load_balancing_strategy: 'least_loaded',
      max_retries: 3,
      failover_enabled: true
    },
    randomization_config: {
      enabled: true,
      profile_id: activeProfile?.id,
      delay_variance: 30,
      template_rotation: true,
      human_simulation: true
    },
    rate_limit_config: {
      enabled: true,
      config_id: activeConfigs[0]?.id,
      messages_per_minute: 10,
      burst_control: true,
      adaptive_rate: true
    }
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
        status: 'draft' as 'draft'
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
      4: 'Configurações Avançadas',
      5: 'Agendamento',
      6: 'Revisão e Envio'
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
            <h1 className="text-3xl font-bold text-foreground">Nova Campanha Inteligente</h1>
            <p className="text-muted-foreground">Crie uma campanha com multi-sessão e randomização avançada</p>
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
            <span className="text-sm text-muted-foreground">Passo {currentStep} de 6</span>
          </div>
          <div className="flex items-center justify-between mb-4">
            {[1, 2, 3, 4, 5, 6].map((step, index) => (
              <div key={step} className="flex items-center">
                <div className="flex flex-col items-center">
                  {getStepIcon(step)}
                  <span className="text-xs mt-2 text-center max-w-20">
                    {getStepTitle(step)}
                  </span>
                </div>
                {index < 5 && (
                  <div className={`h-0.5 w-16 mx-2 ${currentStep > step ? 'bg-green-600' : 'bg-muted'}`} />
                )}
              </div>
            ))}
          </div>
          <Progress value={(currentStep / 6) * 100} className="h-2" />
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          <Tabs value={currentStep.toString()} onValueChange={(value) => setCurrentStep(parseInt(value))}>
            <TabsList className="grid w-full grid-cols-6">
              <TabsTrigger value="1">Básico</TabsTrigger>
              <TabsTrigger value="2">Público</TabsTrigger>
              <TabsTrigger value="3">Mensagem</TabsTrigger>
              <TabsTrigger value="4">Avançado</TabsTrigger>
              <TabsTrigger value="5">Agenda</TabsTrigger>
              <TabsTrigger value="6">Revisão</TabsTrigger>
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

                  <div className="flex items-center justify-end">
                    <Button onClick={() => setCurrentStep(2)}>
                      Próximo: Selecionar Público
                      <ArrowLeft className="h-4 w-4 ml-2 rotate-180" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Passo 4: Configurações Avançadas */}
            <TabsContent value="4" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Settings className="h-5 w-5" />
                    Configurações Avançadas
                  </CardTitle>
                  <CardDescription>
                    Configure multi-sessão, randomização e rate limiting
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Multi-Sessão */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Network className="h-5 w-5 text-blue-600" />
                        <div>
                          <Label className="text-base font-medium">Multi-Sessão WhatsApp</Label>
                          <p className="text-sm text-muted-foreground">
                            Distribua mensagens entre múltiplas instâncias
                          </p>
                        </div>
                      </div>
                      <Switch
                        checked={formData.multi_session_config?.enabled}
                        onCheckedChange={(checked) => 
                          setFormData(prev => ({
                            ...prev,
                            multi_session_config: {
                              ...prev.multi_session_config!,
                              enabled: checked
                            }
                          }))
                        }
                      />
                    </div>

                    {formData.multi_session_config?.enabled && (
                      <div className="ml-7 space-y-4 p-4 bg-muted/50 rounded-lg">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Estratégia de Balanceamento</Label>
                            <Select
                              value={formData.multi_session_config.load_balancing_strategy}
                              onValueChange={(value: any) =>
                                setFormData(prev => ({
                                  ...prev,
                                  multi_session_config: {
                                    ...prev.multi_session_config!,
                                    load_balancing_strategy: value
                                  }
                                }))
                              }
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="least_loaded">Menos Carregada</SelectItem>
                                <SelectItem value="priority_based">Por Prioridade</SelectItem>
                                <SelectItem value="round_robin">Round Robin</SelectItem>
                                <SelectItem value="random">Aleatória</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="space-y-2">
                            <Label>Máximo de Tentativas</Label>
                            <Input
                              type="number"
                              min="1"
                              max="10"
                              value={formData.multi_session_config.max_retries}
                              onChange={(e) =>
                                setFormData(prev => ({
                                  ...prev,
                                  multi_session_config: {
                                    ...prev.multi_session_config!,
                                    max_retries: parseInt(e.target.value)
                                  }
                                }))
                              }
                            />
                          </div>
                        </div>

                        <div className="flex items-center justify-between">
                          <div>
                            <Label>Failover Automático</Label>
                            <p className="text-sm text-muted-foreground">
                              Redirecionar mensagens se uma instância falhar
                            </p>
                          </div>
                          <Switch
                            checked={formData.multi_session_config.failover_enabled}
                            onCheckedChange={(checked) =>
                              setFormData(prev => ({
                                ...prev,
                                multi_session_config: {
                                  ...prev.multi_session_config!,
                                  failover_enabled: checked
                                }
                              }))
                            }
                          />
                        </div>

                        <div className="text-sm text-muted-foreground">
                          <strong>{instances.filter(i => i.status === 'connected').length}</strong> instâncias ativas disponíveis
                        </div>
                      </div>
                    )}
                  </div>

                  <Separator />

                  {/* Randomização */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Shuffle className="h-5 w-5 text-purple-600" />
                        <div>
                          <Label className="text-base font-medium">Sistema de Randomização</Label>
                          <p className="text-sm text-muted-foreground">
                            Simule comportamento humano e evite detecção
                          </p>
                        </div>
                      </div>
                      <Switch
                        checked={formData.randomization_config?.enabled}
                        onCheckedChange={(checked) =>
                          setFormData(prev => ({
                            ...prev,
                            randomization_config: {
                              ...prev.randomization_config!,
                              enabled: checked
                            }
                          }))
                        }
                      />
                    </div>

                    {formData.randomization_config?.enabled && (
                      <div className="ml-7 space-y-4 p-4 bg-muted/50 rounded-lg">
                        <div className="space-y-2">
                          <Label>Perfil de Randomização</Label>
                          <Select
                            value={formData.randomization_config.profile_id || ''}
                            onValueChange={(value) =>
                              setFormData(prev => ({
                                ...prev,
                                randomization_config: {
                                  ...prev.randomization_config!,
                                  profile_id: value
                                }
                              }))
                            }
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione um perfil" />
                            </SelectTrigger>
                            <SelectContent>
                              {randomizationProfiles.map(profile => (
                                <SelectItem key={profile.id} value={profile.id}>
                                  {profile.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Variação de Delay (%)</Label>
                            <Input
                              type="number"
                              min="0"
                              max="100"
                              value={formData.randomization_config.delay_variance}
                              onChange={(e) =>
                                setFormData(prev => ({
                                  ...prev,
                                  randomization_config: {
                                    ...prev.randomization_config!,
                                    delay_variance: parseInt(e.target.value)
                                  }
                                }))
                              }
                            />
                          </div>

                          <div className="flex items-center justify-between">
                            <div>
                              <Label>Rotação de Templates</Label>
                              <p className="text-xs text-muted-foreground">
                                Variar mensagens automaticamente
                              </p>
                            </div>
                            <Switch
                              checked={formData.randomization_config.template_rotation}
                              onCheckedChange={(checked) =>
                                setFormData(prev => ({
                                  ...prev,
                                  randomization_config: {
                                    ...prev.randomization_config!,
                                    template_rotation: checked
                                  }
                                }))
                              }
                            />
                          </div>
                        </div>

                        <div className="flex items-center justify-between">
                          <div>
                            <Label>Simulação Humana</Label>
                            <p className="text-sm text-muted-foreground">
                              Simular velocidade de digitação e leitura
                            </p>
                          </div>
                          <Switch
                            checked={formData.randomization_config.human_simulation}
                            onCheckedChange={(checked) =>
                              setFormData(prev => ({
                                ...prev,
                                randomization_config: {
                                  ...prev.randomization_config!,
                                  human_simulation: checked
                                }
                              }))
                            }
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  <Separator />

                  {/* Rate Limiting */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Gauge className="h-5 w-5 text-orange-600" />
                        <div>
                          <Label className="text-base font-medium">Controle de Velocidade</Label>
                          <p className="text-sm text-muted-foreground">
                            Limite a velocidade de envio para evitar bloqueios
                          </p>
                        </div>
                      </div>
                      <Switch
                        checked={formData.rate_limit_config?.enabled}
                        onCheckedChange={(checked) =>
                          setFormData(prev => ({
                            ...prev,
                            rate_limit_config: {
                              ...prev.rate_limit_config!,
                              enabled: checked
                            }
                          }))
                        }
                      />
                    </div>

                    {formData.rate_limit_config?.enabled && (
                      <div className="ml-7 space-y-4 p-4 bg-muted/50 rounded-lg">
                        <div className="space-y-2">
                          <Label>Configuração de Rate Limit</Label>
                          <Select
                            value={formData.rate_limit_config.config_id || ''}
                            onValueChange={(value) =>
                              setFormData(prev => ({
                                ...prev,
                                rate_limit_config: {
                                  ...prev.rate_limit_config!,
                                  config_id: value
                                }
                              }))
                            }
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione uma configuração" />
                            </SelectTrigger>
                            <SelectContent>
                              {rateLimitConfigs.map(config => (
                                <SelectItem key={config.id} value={config.id}>
                                  {config.name} ({config.messages_per_minute}/min)
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Mensagens por Minuto</Label>
                            <Input
                              type="number"
                              min="1"
                              max="60"
                              value={formData.rate_limit_config.messages_per_minute}
                              onChange={(e) =>
                                setFormData(prev => ({
                                  ...prev,
                                  rate_limit_config: {
                                    ...prev.rate_limit_config!,
                                    messages_per_minute: parseInt(e.target.value)
                                  }
                                }))
                              }
                            />
                          </div>

                          <div className="flex items-center justify-between">
                            <div>
                              <Label>Controle de Burst</Label>
                              <p className="text-xs text-muted-foreground">
                                Prevenir rajadas de mensagens
                              </p>
                            </div>
                            <Switch
                              checked={formData.rate_limit_config.burst_control}
                              onCheckedChange={(checked) =>
                                setFormData(prev => ({
                                  ...prev,
                                  rate_limit_config: {
                                    ...prev.rate_limit_config!,
                                    burst_control: checked
                                  }
                                }))
                              }
                            />
                          </div>
                        </div>

                        <div className="flex items-center justify-between">
                          <div>
                            <Label>Rate Adaptativo</Label>
                            <p className="text-sm text-muted-foreground">
                              Ajustar velocidade baseado no desempenho
                            </p>
                          </div>
                          <Switch
                            checked={formData.rate_limit_config.adaptive_rate}
                            onCheckedChange={(checked) =>
                              setFormData(prev => ({
                                ...prev,
                                rate_limit_config: {
                                  ...prev.rate_limit_config!,
                                  adaptive_rate: checked
                                }
                              }))
                            }
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-4">
                    <Button variant="outline" onClick={() => setCurrentStep(3)}>
                      <ArrowLeft className="h-4 w-4 mr-2" />
                      Voltar
                    </Button>
                    <Button onClick={() => setCurrentStep(5)}>
                      Próximo: Agendamento
                      <ArrowLeft className="h-4 w-4 ml-2 rotate-180" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* ... existing code for other tabs ... */}
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