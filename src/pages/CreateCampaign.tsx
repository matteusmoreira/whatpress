import { useState, useEffect } from 'react'
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
  Gauge,
  Webhook,
  ArrowUp,
  ArrowDown,
  Trash2
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
import { useQuotas } from '@/hooks/useQuotas'
import { toast } from 'sonner'
import { GatingBanner } from '@/components/GatingBanner'
import { formatUsageTooltip } from '@/lib/utils'
import { QuotaAlertsManager } from '@/components/QuotaAlertsManager'

// Tipos de sequência para execução
type SequenceMode = 'sequential' | 'parallel' | 'balanced'
interface SequenceStep { id: string; type: 'message' | 'delay' | 'webhook'; label?: string; message?: { text?: string; template_id?: string }; delay?: { amount: number; unit: 'seconds' | 'minutes' | 'hours' }; webhook?: { url: string; method: 'GET' | 'POST'; payload?: string } }

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
  execution_strategy?: { mode: SequenceMode; steps: SequenceStep[] }
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
  const { configs: rateLimitConfigs, activeConfigs, getStatus, canSendMessage, getNextAllowedTime } = useRateLimit()
  const { loading: quotasLoading, getResourceUsage, canCreateResource, isFeatureBlocked, alerts, acknowledgeAlert } = useQuotas()

  // Gating: quotas + rate limit + feature
  const campaignUsage = getResourceUsage('campaigns')
  const campaignsQuotaBlocked = !!campaignUsage && (campaignUsage.status === 'blocked' || !canCreateResource('campaigns') || isFeatureBlocked('campaigns'))
  const messagesFeatureBlocked = isFeatureBlocked('messages')
  const rateStatusGlobal = getStatus('global')
  const canSendGlobal = canSendMessage('global')
  const rateLimitedNow = !canSendGlobal
  const nextAllowedTime = getNextAllowedTime('global')
  const canSchedule = !campaignsQuotaBlocked && !messagesFeatureBlocked
  const canSendNow = !campaignsQuotaBlocked && !messagesFeatureBlocked && canSendGlobal
  const criticalState = !!campaignUsage && campaignUsage.status === 'critical'
  



  
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
    },
    execution_strategy: {
      mode: 'sequential',
      steps: []
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
  const [useSequence, setUseSequence] = useState(false)
  const [invalidSteps, setInvalidSteps] = useState<number[]>([])
  
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

  // Sequência: helpers de passos
  const handleAddStep = (type: 'message' | 'delay' | 'webhook') => {
    const newStepId = `step-${Date.now()}`
    const base: SequenceStep = { id: newStepId, type }
    const step: SequenceStep =
      type === 'message'
        ? { ...base, message: { text: '', template_id: formData.template_id } }
        : type === 'delay'
          ? { ...base, delay: { amount: 60, unit: 'seconds' } }
          : { ...base, webhook: { url: '', method: 'POST', payload: '' } }
  
    setFormData(prev => ({
      ...prev,
      execution_strategy: {
        mode: prev.execution_strategy?.mode || 'sequential',
        steps: [...(prev.execution_strategy?.steps || []), step]
      }
    }))
  }
  
  const handleUpdateStep = (index: number, updated: Partial<SequenceStep>) => {
    let updatedStepValid = true
    setFormData(prev => {
      const steps = [...(prev.execution_strategy?.steps || [])]
      const current = steps[index]
      if (!current) return prev
      const nextStep = { ...current, ...updated }
      steps[index] = nextStep
      // validar passo atualizado
      if (nextStep.type === 'message') {
        const hasText = !!nextStep.message?.text && nextStep.message.text.trim() !== ''
        const hasTemplate = !!nextStep.message?.template_id
        updatedStepValid = hasText || hasTemplate
      } else if (nextStep.type === 'delay') {
        const amount = nextStep.delay?.amount ?? 0
        updatedStepValid = !!amount && amount > 0
      } else if (nextStep.type === 'webhook') {
        const url = nextStep.webhook?.url?.trim() || ''
        updatedStepValid = !!url
      }
      return {
        ...prev,
        execution_strategy: {
          mode: prev.execution_strategy?.mode || 'sequential',
          steps
        }
      }
    })
    setInvalidSteps(prev => {
      const set = new Set(prev)
      if (updatedStepValid) {
        set.delete(index)
      } else {
        set.add(index)
      }
      return Array.from(set)
    })
  }
  
  const moveStepUp = (index: number) => {
    setFormData(prev => {
      const steps = [...(prev.execution_strategy?.steps || [])]
      if (index <= 0) return prev
      const tmp = steps[index - 1]
      steps[index - 1] = steps[index]
      steps[index] = tmp
      return {
        ...prev,
        execution_strategy: { mode: prev.execution_strategy?.mode || 'sequential', steps }
      }
    })
    setInvalidSteps([])
  }
  
  const moveStepDown = (index: number) => {
    setFormData(prev => {
      const steps = [...(prev.execution_strategy?.steps || [])]
      if (index >= steps.length - 1) return prev
      const tmp = steps[index + 1]
      steps[index + 1] = steps[index]
      steps[index] = tmp
      return {
        ...prev,
        execution_strategy: { mode: prev.execution_strategy?.mode || 'sequential', steps }
      }
    })
    setInvalidSteps([])
  }
  
  const deleteStep = (index: number) => {
    setFormData(prev => {
      const steps = [...(prev.execution_strategy?.steps || [])]
      steps.splice(index, 1)
      return {
        ...prev,
        execution_strategy: { mode: prev.execution_strategy?.mode || 'sequential', steps }
      }
    })
    setInvalidSteps([])
  }

  // Navegação: validação antes de avançar do Passo 3
  const handleNextFromStep3 = () => {
    if (useSequence) {
      const steps = formData.execution_strategy?.steps || []
      if (steps.length === 0) {
        setErrors(prev => ({ ...prev, execution_strategy: 'Adicione ao menos um passo à sequência.' }))
        return
      }
      const invalid = validateSequenceSteps()
      if (invalid.length > 0) {
        setInvalidSteps(invalid)
        setErrors(prev => ({ ...prev, execution_strategy: `Existem passos com campos obrigatórios não preenchidos (índices: ${invalid.map(i => i + 1).join(', ')})` }))
        return
      } else {
        setInvalidSteps([])
      }
      // limpar erro de sequência se existir
      setErrors(prev => {
        const next = { ...prev }
        delete next.execution_strategy
        return next
      })
    } else {
      if (!formData.message || formData.message.trim() === '') {
        setErrors(prev => ({ ...prev, message: 'Mensagem é obrigatória.' }))
        return
      }
      // limpar erro de mensagem se existir
      setErrors(prev => {
        const next = { ...prev }
        delete next.message
        return next
      })
    }
    setCurrentStep(4)
  }

  const handleNextFromStep5 = () => {
    if (scheduleEnabled) {
      if (!formData.scheduled_at || formData.scheduled_at.trim() === '') {
        setErrors(prev => ({ ...prev, scheduled_at: 'Informe a data e hora do envio.' }))
        return
      }
      const scheduled = new Date(formData.scheduled_at)
      if (!isNaN(scheduled.getTime()) && scheduled.getTime() <= Date.now()) {
        setErrors(prev => ({ ...prev, scheduled_at: 'A data e hora devem ser futuras.' }))
        return
      }
      // Gating: quotas, feature e rate limit
      if (campaignsQuotaBlocked) {
        setErrors(prev => ({ ...prev, scheduled_at: 'Agendamento bloqueado: limite de campanhas atingido.' }))
        return
      }
      if (messagesFeatureBlocked) {
        setErrors(prev => ({ ...prev, scheduled_at: 'Agendamento bloqueado: recurso de mensagens indisponível no seu plano.' }))
        return
      }
      const status = getStatus('global')
      if (status?.isLimited) {
        setErrors(prev => ({ ...prev, scheduled_at: 'Envio bloqueado pelo rate limit no momento. Próximo envio permitido ' + (nextAllowedTime ? new Date(nextAllowedTime as number).toLocaleString() : 'em breve') }))
        return
      }
    }
    setErrors(prev => { const next = { ...prev }; delete next.scheduled_at; return next })
    setCurrentStep(6)
  }

  // Validação detalhada dos passos da sequência
  const validateSequenceSteps = (): number[] => {
    const steps = formData.execution_strategy?.steps || []
    const invalid: number[] = []
    steps.forEach((step, idx) => {
      if (step.type === 'message') {
        const hasText = !!step.message?.text && step.message.text.trim() !== ''
        const hasTemplate = !!step.message?.template_id
        if (!hasText && !hasTemplate) invalid.push(idx)
      } else if (step.type === 'delay') {
        const amount = step.delay?.amount ?? 0
        if (!amount || amount <= 0) invalid.push(idx)
      } else if (step.type === 'webhook') {
        const url = step.webhook?.url?.trim() || ''
        if (!url) invalid.push(idx)
      }
    })
    return invalid
  }

  const validateForm = () => {
    const newErrors: Record<string, string> = {}
    
    if (!formData.name.trim()) {
      newErrors.name = 'Nome da campanha é obrigatório'
    }
    
    if (useSequence) {
      if (!formData.execution_strategy || !formData.execution_strategy.steps || formData.execution_strategy.steps.length === 0) {
        newErrors.execution_strategy = 'Adicione ao menos um passo na sequência'
      } else {
        const invalid = validateSequenceSteps()
        if (invalid.length > 0) {
          newErrors.execution_strategy = `Existem passos com campos obrigatórios não preenchidos (índices: ${invalid.map(i => i + 1).join(', ')})`
          setInvalidSteps(invalid)
        } else {
          setInvalidSteps([])
        }
      }
    } else {
      if (!formData.message.trim()) {
        newErrors.message = 'Mensagem é obrigatória'
      }
    }
    
    if (selectedContacts.length === 0) {
      newErrors.contacts = 'Selecione pelo menos um contato'
    }
    
    if (scheduleEnabled) {
      if (!formData.scheduled_at) {
        newErrors.scheduled_at = 'Data de agendamento é obrigatória'
      } else {
        const scheduled = new Date(formData.scheduled_at)
        if (!isNaN(scheduled.getTime()) && scheduled.getTime() <= Date.now()) {
          newErrors.scheduled_at = 'A data e hora devem ser futuras'
        }
      }
    }
    
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async () => {
    if (!validateForm()) return

    // Gating: bloqueios antes de criar campanha
    if (scheduleEnabled) {
      if (campaignsQuotaBlocked) {
        setErrors(prev => ({ ...prev, scheduled_at: 'Agendamento bloqueado: limite de campanhas atingido.' }))
        return
      }
      if (messagesFeatureBlocked) {
        setErrors(prev => ({ ...prev, scheduled_at: 'Agendamento bloqueado: recurso de mensagens indisponível no seu plano.' }))
        return
      }
      // Observação: rate limit ativo agora não impede agendar para o futuro; o aviso é mostrado no Passo 5
    } else {
      if (campaignsQuotaBlocked) {
        setErrors(prev => ({ ...prev, message: 'Envio bloqueado: limite de campanhas atingido.' }))
        return
      }
      if (messagesFeatureBlocked) {
        setErrors(prev => ({ ...prev, message: 'Envio bloqueado: recurso de mensagens indisponível no seu plano.' }))
        return
      }
      const status = getStatus('global')
      if (status?.isLimited) {
        setErrors(prev => ({ ...prev, message: 'Envio bloqueado pelo rate limit. Próximo envio permitido ' + (nextAllowedTime ? new Date(nextAllowedTime as number).toLocaleString() : 'em breve') }))
        return
      }
    }
    
    try {
      const executionStrategyPayload = useSequence
        ? formData.execution_strategy
        : {
            mode: 'sequential',
            steps: [
              {
                id: 'msg-1',
                type: 'message',
                message: {
                  text: formData.message,
                  template_id: formData.template_id
                }
              }
            ]
          }

      const campaignData = {
        name: formData.name,
        description: formData.description,
        template_id: formData.template_id,
        target_contacts: selectedContacts,
        scheduled_at: scheduleEnabled ? formData.scheduled_at : null,
        execution_strategy: executionStrategyPayload
      }
      
      await createCampaign(campaignData)
      navigate('/dashboard/campaigns')
    } catch (error) {
      console.error('Erro ao criar campanha:', error)
    }
  }

  const handleSaveDraft = async () => {
    // Gating: impedir salvar rascunho quando quotas estão bloqueadas
    if (campaignsQuotaBlocked) {
      setErrors(prev => ({ ...prev, name: 'Salvar rascunho bloqueado: limite de campanhas atingido.' }))
      return
    }
    try {
      const executionStrategyPayload = useSequence
        ? formData.execution_strategy
        : {
            mode: 'sequential',
            steps: [
              {
                id: 'msg-1',
                type: 'message',
                message: {
                  text: formData.message,
                  template_id: formData.template_id
                }
              }
            ]
          }

      const campaignData = {
        name: formData.name,
        description: formData.description,
        template_id: formData.template_id,
        target_contacts: selectedContacts,
        execution_strategy: executionStrategyPayload,
        status: 'draft' as 'draft',
        scheduled_at: scheduleEnabled ? formData.scheduled_at : null
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
          <Button variant="outline" onClick={handleSaveDraft} disabled={campaignLoading || campaignsQuotaBlocked} title={campaignsQuotaBlocked ? formatUsageTooltip(campaignUsage?.current, campaignUsage?.max) : undefined}>
            <Save className="h-4 w-4 mr-2" />
            Salvar Rascunho
          </Button>
          <Button onClick={() => setPreviewMode(!previewMode)} variant="outline">
            <Eye className="h-4 w-4 mr-2" />
            {previewMode ? 'Editar' : 'Visualizar'}
          </Button>
        </div>
      </div>

      {/* Quota alerts (toasts) */}
      <QuotaAlertsManager showCriticalToast usage={campaignUsage} />

      {/* Gating Banner */}
      <GatingBanner
        campaignsQuotaBlocked={campaignsQuotaBlocked}
        messagesFeatureBlocked={messagesFeatureBlocked}
        rateLimitedNow={rateLimitedNow}
        criticalState={criticalState}
        campaignsUsage={campaignUsage}
        nextAllowedTime={nextAllowedTime}
        rateTimeMode="relative"
      />

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

            {/* Passo 2: Seleção de Público */}
            <TabsContent value="2" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Seleção de Público
                  </CardTitle>
                  <CardDescription>
                    Busque, filtre e selecione os contatos que receberão esta campanha
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Filtros */}
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label>Buscar Contatos</Label>
                        <div className="relative">
                          <Search className="h-4 w-4 absolute left-2 top-2.5 text-muted-foreground" />
                          <Input
                            placeholder="Nome ou telefone..."
                            className="pl-8"
                            value={contactFilter}
                            onChange={(e) => setContactFilter(e.target.value)}
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label>Tags</Label>
                        <div className="flex items-center gap-2">
                          <Select
                            onValueChange={(tag) => setTagFilter(prev => prev.includes(tag) ? prev : [...prev, tag])}
                          >
                            <SelectTrigger className="w-[180px]">
                              <SelectValue placeholder="Adicionar tag" />
                            </SelectTrigger>
                            <SelectContent>
                              {Array.from(new Set(contacts.flatMap(c => c.tags || []))).map(tag => (
                                <SelectItem key={tag} value={tag}>{tag}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <div className="flex flex-wrap gap-2">
                            {tagFilter.map(tag => (
                              <Badge key={tag} variant="secondary" className="flex items-center gap-1">
                                <Tag className="h-3 w-3" />
                                {tag}
                                <button
                                  type="button"
                                  onClick={() => setTagFilter(prev => prev.filter(t => t !== tag))}
                                  className="ml-1 hover:text-red-600"
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label>Localização</Label>
                        <div className="relative">
                          <MapPin className="h-4 w-4 absolute left-2 top-2.5 text-muted-foreground" />
                          <Input
                            placeholder="Cidade, estado..."
                            className="pl-8"
                            value={locationFilter}
                            onChange={(e) => setLocationFilter(e.target.value)}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                          <Checkbox
                            checked={selectedContacts.length === filteredContacts.length && filteredContacts.length > 0}
                            onCheckedChange={handleSelectAllContacts}
                          />
                          <span className="text-sm">Selecionar todos os {filteredContacts.length} contato(s)</span>
                        </div>
                        {errors.contacts && (
                          <p className="text-sm text-red-600 flex items-center gap-1">
                            <AlertCircle className="h-4 w-4" />
                            {errors.contacts}
                          </p>
                        )}
                      </div>
                      <Button variant="outline" onClick={generateSmartSegments}>
                        <Sparkles className="h-4 w-4 mr-2" /> Sugestões de Segmentos
                      </Button>
                    </div>

                    {!!smartSegments.length && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {smartSegments.map(segment => (
                          <div key={segment.id} className="p-3 border rounded-lg flex items-center justify-between">
                            <div>
                              <div className="font-medium">{segment.name}</div>
                              <p className="text-sm text-muted-foreground">{segment.description}</p>
                            </div>
                            <div className="flex items-center gap-3">
                              <Badge variant="outline">{segment.count}</Badge>
                              <Button variant="secondary" size="sm" onClick={() => handleSegmentSelect(segment)}>
                                Selecionar
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    <Separator />

                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4" />
                          <span className="text-sm">Selecionados: {selectedContacts.length}</span>
                        </div>
                        <Button variant="outline" size="sm" onClick={() => setSelectedContacts([])}>Limpar seleção</Button>
                      </div>

                      {contactsLoading ? (
                        <div className="flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span>Carregando contatos…</span>
                        </div>
                      ) : filteredContacts.length === 0 ? (
                        <p className="text-sm text-muted-foreground">Nenhum contato encontrado com os filtros.</p>
                      ) : (
                        <div className="border rounded-md">
                          <div className="divide-y">
                            {filteredContacts.map((contact) => (
                              <div key={contact.id} className="flex items-center justify-between p-3">
                                <div className="flex items-center gap-3">
                                  <Checkbox
                                    checked={selectedContacts.includes(contact.id)}
                                    onCheckedChange={() => handleContactToggle(contact.id)}
                                  />
                                  <div>
                                    <div className="font-medium">{contact.name}</div>
                                    <div className="text-xs text-muted-foreground flex items-center gap-2">
                                      <Phone className="h-3 w-3" /> {contact.phone}
                                      {contact.location && (<><MapPin className="h-3 w-3" /> {contact.location}</>)}
                                    </div>
                                    {!!contact.tags?.length && (
                                      <div className="mt-1 flex flex-wrap gap-1">
                                        {contact.tags!.map((tag) => (
                                          <Badge key={tag} variant="outline" className="text-xs">{tag}</Badge>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                </div>
                                <div>
                                  {selectedContacts.includes(contact.id) ? (
                                    <Badge variant="success">Selecionado</Badge>
                                  ) : (
                                    <Badge variant="secondary">Disponível</Badge>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between">
                      <Button variant="outline" onClick={() => setCurrentStep(1)}>
                        Voltar: Básico
                        <ArrowLeft className="h-4 w-4 ml-2" />
                      </Button>
                      <Button onClick={() => setCurrentStep(3)}>
                        Próximo: Mensagem
                        <ArrowLeft className="h-4 w-4 ml-2 rotate-180" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Passo 3: Mensagem e Sequência */}
            <TabsContent value="3" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MessageSquare className="h-5 w-5" />
                    Mensagem e Sequência
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <Label className="text-base font-medium">Usar Sequência</Label>
                      <p className="text-sm text-muted-foreground">Ative para executar múltiplos passos</p>
                    </div>
                    <Switch checked={useSequence} onCheckedChange={setUseSequence} />
                  </div>

                  {!useSequence ? (
                    <div className="space-y-2">
                      <Label>Mensagem *</Label>
                      <Textarea rows={5} placeholder="Digite sua mensagem..." value={formData.message} onChange={(e)=>handleInputChange('message', e.target.value)} className={errors.message ? 'border-red-500' : ''} />
                      {errors.message && <p className="text-sm text-red-600 flex items-center gap-1"><AlertCircle className="h-4 w-4"/>{errors.message}</p>}
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-2">
                          <Label className="flex items-center gap-2"><Gauge className="h-4 w-4"/> Modo de Execução</Label>
                          <Select
                            value={formData.execution_strategy?.mode || 'sequential'}
                            onValueChange={(value: any) =>
                              setFormData(prev => ({
                                ...prev,
                                execution_strategy: {
                                  mode: value as SequenceMode,
                                  steps: prev.execution_strategy?.steps || []
                                }
                              }))
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="sequential">Sequencial</SelectItem>
                              <SelectItem value="parallel">Paralelo</SelectItem>
                              <SelectItem value="balanced">Balanceado</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2 md:col-span-2">
                          <Label>Adicionar Passo</Label>
                          <div className="flex flex-wrap gap-2">
                            <Button variant="outline" onClick={() => handleAddStep('message')}><Plus className="h-4 w-4 mr-2"/>Mensagem</Button>
                            <Button variant="outline" onClick={() => handleAddStep('delay')}><Clock className="h-4 w-4 mr-2"/>Atraso</Button>
                            <Button variant="outline" onClick={() => handleAddStep('webhook')}><Webhook className="h-4 w-4 mr-2"/>Webhook</Button>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-3">
                        {(!formData.execution_strategy?.steps || formData.execution_strategy.steps.length === 0) ? (
                          <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                            Nenhum passo adicionado. Use os botões acima para criar a sequência.
                          </div>
                        ) : (
                          formData.execution_strategy!.steps.map((step, index) => (
                            <div key={step.id} className={`rounded-lg border p-4 space-y-3 bg-muted/30 ${invalidSteps.includes(index) ? 'border-red-500' : ''}`}>
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  {step.type === 'message' && <MessageSquare className="h-4 w-4 text-green-600" />}
                                  {step.type === 'delay' && <Clock className="h-4 w-4 text-yellow-600" />}
                                  {step.type === 'webhook' && <Webhook className="h-4 w-4 text-blue-600" />}
                                  <div className="font-medium">Passo {index + 1}: {step.type === 'message' ? 'Mensagem' : step.type === 'delay' ? 'Atraso' : 'Webhook'}</div>
                                </div>
                                <div className="flex items-center gap-1">
                                  <Button variant="ghost" size="icon" onClick={() => moveStepUp(index)} disabled={index === 0}>
                                    <ArrowUp className="h-4 w-4" />
                                  </Button>
                                  <Button variant="ghost" size="icon" onClick={() => moveStepDown(index)} disabled={index === (formData.execution_strategy!.steps.length - 1)}>
                                    <ArrowDown className="h-4 w-4" />
                                  </Button>
                                  <Button variant="ghost" size="icon" onClick={() => deleteStep(index)}>
                                    <Trash2 className="h-4 w-4 text-red-600" />
                                  </Button>
                                </div>
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                  <Label>Rótulo</Label>
                                  <Input value={step.label || ''} onChange={(e) => handleUpdateStep(index, { label: e.target.value })} placeholder="Ex.: Saudação inicial" />
                                </div>

                                {step.type === 'message' && (
                                  <>
                                    <div className="space-y-2 md:col-span-2">
                                      <Label>Mensagem</Label>
                                      <Textarea rows={4} value={step.message?.text || ''} onChange={(e) => handleUpdateStep(index, { message: { text: e.target.value, template_id: step.message?.template_id } })} />
                                      {invalidSteps.includes(index) && (!step.message?.text || step.message.text.trim() === '') && !step.message?.template_id && (
                                        <p className="text-xs text-red-600 flex items-center gap-1"><AlertCircle className="h-3 w-3"/>Informe o texto ou selecione um template.</p>
                                      )}
                                    </div>
                                    <div className="space-y-2">
                                      <Label>Template (opcional)</Label>
                                      <Select
                                        value={step.message?.template_id || ''}
                                        onValueChange={(value: any) => handleUpdateStep(index, { message: { text: step.message?.text || '', template_id: value || undefined } })}
                                      >
                                        <SelectTrigger>
                                          <SelectValue placeholder="Selecione um template" />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {templates.map(t => (
                                            <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                                          ))}
                                          <SelectItem value="">Sem template</SelectItem>
                                        </SelectContent>
                                      </Select>
                                    </div>
                                  </>
                                )}

                                {step.type === 'delay' && (
                                  <>
                                    <div className="space-y-2">
                                      <Label>Quantidade</Label>
                                      <Input type="number" min="1" value={step.delay?.amount ?? 60} onChange={(e) => handleUpdateStep(index, { delay: { amount: parseInt(e.target.value) || 0, unit: step.delay?.unit || 'seconds' } })} />
                                      {invalidSteps.includes(index) && (!step.delay?.amount || step.delay.amount <= 0) && (
                                        <p className="text-xs text-red-600 flex items-center gap-1"><AlertCircle className="h-3 w-3"/>Informe um valor maior que 0.</p>
                                      )}
                                    </div>
                                    <div className="space-y-2">
                                      <Label>Unidade</Label>
                                      <Select
                                        value={step.delay?.unit || 'seconds'}
                                        onValueChange={(value: any) => handleUpdateStep(index, { delay: { amount: step.delay?.amount ?? 60, unit: value as 'seconds' | 'minutes' | 'hours' } })}
                                      >
                                        <SelectTrigger>
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="seconds">Segundos</SelectItem>
                                          <SelectItem value="minutes">Minutos</SelectItem>
                                          <SelectItem value="hours">Horas</SelectItem>
                                        </SelectContent>
                                      </Select>
                                    </div>
                                  </>
                                )}

                                {step.type === 'webhook' && (
                                  <>
                                    <div className="space-y-2">
                                      <Label>URL</Label>
                                      <Input type="url" value={step.webhook?.url || ''} onChange={(e) => handleUpdateStep(index, { webhook: { url: e.target.value, method: step.webhook?.method || 'POST', payload: step.webhook?.payload } })} placeholder="https://..." />
                                      {invalidSteps.includes(index) && (!step.webhook?.url || step.webhook.url.trim() === '') && (
                                        <p className="text-xs text-red-600 flex items-center gap-1"><AlertCircle className="h-3 w-3"/>Informe a URL do webhook.</p>
                                      )}
                                    </div>
                                    <div className="space-y-2">
                                      <Label>Método</Label>
                                      <Select
                                        value={step.webhook?.method || 'POST'}
                                        onValueChange={(value: any) => handleUpdateStep(index, { webhook: { url: step.webhook?.url || '', method: value as 'GET' | 'POST', payload: step.webhook?.payload } })}
                                      >
                                        <SelectTrigger>
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="GET">GET</SelectItem>
                                          <SelectItem value="POST">POST</SelectItem>
                                        </SelectContent>
                                      </Select>
                                    </div>
                                    <div className="md:col-span-2 space-y-2">
                                      <Label>Payload (opcional)</Label>
                                      <Textarea rows={3} value={step.webhook?.payload || ''} onChange={(e) => handleUpdateStep(index, { webhook: { url: step.webhook?.url || '', method: step.webhook?.method || 'POST', payload: e.target.value } })} />
                                    </div>
                                  </>
                                )}
                              </div>
                            </div>
                          ))
                        )}
                      </div>

                      {errors.execution_strategy && (
                        <p className="text-sm text-red-600 flex items-center gap-1">
                          <AlertCircle className="h-4 w-4" />
                          {errors.execution_strategy}
                        </p>
                      )}
                    </div>
                  )}

                  <div className="flex items-center justify-between">
                    <Button variant="outline" onClick={()=>setCurrentStep(2)}>
                      Voltar: Público
                      <ArrowLeft className="h-4 w-4 ml-2" />
                    </Button>
                    <Button onClick={handleNextFromStep3}>
                      Próximo: Avançado
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
                    <Button onClick={() => setCurrentStep(5)} disabled={!canSchedule}>
                      Próximo: Agendamento
                      <ArrowLeft className="h-4 w-4 ml-2 rotate-180" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

          {/* Passo 5: Agendamento */}
          <TabsContent value="5" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Agendamento
                </CardTitle>
                <CardDescription>
                  Opcionalmente, programe quando a campanha deve ser enviada
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-base font-medium">Agendar envio</Label>
                    <p className="text-sm text-muted-foreground">Ative para escolher data e hora</p>
                  </div>
                  <Switch checked={scheduleEnabled} onCheckedChange={setScheduleEnabled} disabled={!canSchedule} />
                </div>

                {scheduleEnabled && (
                  <div className="space-y-2">
                    <Label>Data e hora</Label>
                    <Input
                      type="datetime-local"
                      value={formData.scheduled_at}
                      onChange={(e) => handleInputChange('scheduled_at', e.target.value)}
                      disabled={!canSchedule}
                      className={errors.scheduled_at ? 'border-red-500' : ''}
                    />
                    {errors.scheduled_at && (
                      <p className="text-sm text-red-600 flex items-center gap-1">
                        <AlertCircle className="h-4 w-4" />
                        {errors.scheduled_at}
                      </p>
                    )}
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <Button variant="outline" onClick={() => setCurrentStep(4)}>
                    Voltar: Avançado
                    <ArrowLeft className="h-4 w-4 ml-2" />
                  </Button>
                  <Button onClick={handleNextFromStep5}>
                    Próximo: Revisão
                    <ArrowLeft className="h-4 w-4 ml-2 rotate-180" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Passo 6: Revisão e Envio */}
          <TabsContent value="6" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5" />
                  Revisão e Envio
                </CardTitle>
                <CardDescription>
                  Revise os detalhes e envie a campanha
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Nome</Label>
                    <p className="text-sm text-muted-foreground">{formData.name || '—'}</p>
                    <Label>Descrição</Label>
                    <p className="text-sm text-muted-foreground">{formData.description || '—'}</p>
                    <Label>Público</Label>
                    <p className="text-sm text-muted-foreground">{selectedContacts.length} contato(s)</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Mensagem</Label>
                    <p className="text-sm text-muted-foreground">{useSequence ? `Sequência com ${(formData.execution_strategy?.steps || []).length} passo(s)` : (formData.message ? `${Math.min(formData.message.length, 120)} caracteres` : '—')}</p>
                    <Label>Agendamento</Label>
                    <p className="text-sm text-muted-foreground">{scheduleEnabled && formData.scheduled_at ? new Date(formData.scheduled_at).toLocaleString() : 'Imediato'}</p>
                  </div>
                </div>

                {useSequence && (formData.execution_strategy?.steps || []).length > 0 && (
                  <div className="space-y-2">
                    <Label>Detalhes da Execução</Label>
                    <p className="text-xs text-muted-foreground">
                      Modo: {formData.execution_strategy?.mode === 'sequential' ? 'Sequencial' : formData.execution_strategy?.mode === 'parallel' ? 'Paralelo' : 'Balanceado'}
                    </p>
                    <div className="space-y-2">
                      {(formData.execution_strategy?.steps || []).map((step, idx) => (
                        <div key={step.id || idx} className="rounded-md border p-3">
                          <p className="text-sm">
                            Passo {idx + 1}: {step.type === 'message' ? 'Mensagem' : step.type === 'delay' ? 'Atraso' : 'Webhook'}
                          </p>
                          <div className="mt-1 text-xs text-muted-foreground">
                            {step.type === 'message' && (
                              <p>{step.message?.template_id ? `Template #${step.message.template_id}` : `${(step.message?.text || '').slice(0, 120) || '—'}`}</p>
                            )}
                            {step.type === 'delay' && (
                              <p>{step.delay?.amount} {step.delay?.unit === 'seconds' ? 'segundo(s)' : step.delay?.unit === 'minutes' ? 'minuto(s)' : 'hora(s)'}</p>
                            )}
                            {step.type === 'webhook' && (
                              <p>{step.webhook?.method || 'POST'} {step.webhook?.url || '—'}</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <Separator />

                <div className="flex items-center justify-between">
                  <Button variant="outline" onClick={() => setCurrentStep(5)}>
                    Voltar: Agenda
                    <ArrowLeft className="h-4 w-4 ml-2" />
                  </Button>
                  <div className="flex items-center gap-2">
                    <Button variant="secondary" onClick={handleSaveDraft} disabled={campaignsQuotaBlocked} title={campaignsQuotaBlocked ? formatUsageTooltip(campaignUsage?.current, campaignUsage?.max) : undefined}>
                      <Save className="h-4 w-4 mr-2" />
                      Salvar rascunho
                    </Button>
                    <Button onClick={handleSubmit} disabled={scheduleEnabled ? !canSchedule : !canSendNow}>
                      <Send className="h-4 w-4 mr-2" />
                      Enviar campanha
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          </Tabs>

            {/* Dicas removidas - será reposicionada posteriormente */}
          </div>
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
                <Badge variant="secondary">≈ {Math.round(selectedContacts.length * 0.95)} contato(s) (~95%)</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Custo estimado</span>
                <Badge variant="secondary">
                  R$ {(
                    selectedContacts.length * 0.05 *
                    (useSequence
                      ? (formData.execution_strategy?.steps?.filter((s) => s.type === 'message')?.length || 0)
                      : ((formData.message && formData.message.trim() !== '') || formData.template_id ? 1 : 0)
                    )
                  ).toFixed(2)}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Agendamento</span>
                <Badge variant="secondary">{scheduleEnabled && formData.scheduled_at ? new Date(formData.scheduled_at).toLocaleString() : 'Imediato'}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Execução</span>
                <Badge variant="secondary">
                  {useSequence
                    ? `${formData.execution_strategy?.mode === 'sequential' ? 'Sequencial' : formData.execution_strategy?.mode === 'parallel' ? 'Paralelo' : 'Balanceado'} · ${formData.execution_strategy?.steps?.length || 0} passo(s)`
                    : 'Mensagem única'}
                </Badge>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
  )
}