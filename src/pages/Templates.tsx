import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { TemplateManager } from '@/components/templates/TemplateManager'
import { useTemplates } from '@/hooks/useTemplates'
import { Plus, Search, MessageSquare, FileText, Sparkles, TrendingUp } from 'lucide-react'
import { toast } from 'sonner'

export default function Templates() {
  const [searchTerm, setSearchTerm] = useState('')
  const [activeTab, setActiveTab] = useState('all')
  const { templates, loading, createTemplate } = useTemplates()

  // Filtrar templates por categoria e busca
  const filteredTemplates = templates.filter(template => {
    const matchesSearch = 
      template.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      template.content.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesTab = 
      activeTab === 'all' || 
      template.category === activeTab

    return matchesSearch && matchesTab
  })

  // Estatísticas
  const stats = {
    total: templates.length,
    marketing: templates.filter(t => t.category === 'marketing').length,
    transactional: templates.filter(t => t.category === 'transactional').length,
    support: templates.filter(t => t.category === 'support').length,
    active: templates.filter(t => t.is_active).length,
  }

  const handleCreateFromLibrary = async (templateData: any) => {
    try {
      await createTemplate(templateData)
      toast.success('Template criado com sucesso!')
    } catch (error) {
      toast.error('Erro ao criar template')
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Templates de Mensagens</h1>
          <p className="text-muted-foreground">
            Gerencie e organize seus templates para campanhas e automações
          </p>
        </div>
      </div>

      {/* Estatísticas */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">
              templates criados
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Marketing</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.marketing}</div>
            <p className="text-xs text-muted-foreground">
              campanhas
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Transacionais</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.transactional}</div>
            <p className="text-xs text-muted-foreground">
              notificações
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Suporte</CardTitle>
            <Sparkles className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.support}</div>
            <p className="text-xs text-muted-foreground">
              atendimento
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ativos</CardTitle>
            <Badge variant="outline" className="h-4 px-1">
              {Math.round((stats.active / stats.total) * 100) || 0}%
            </Badge>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.active}</div>
            <p className="text-xs text-muted-foreground">
              em uso
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filtros e Busca */}
      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
          <CardDescription>
            Busque e filtre seus templates por categoria
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4 md:flex-row md:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Buscar templates por nome ou conteúdo..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full md:w-auto">
              <TabsList>
                <TabsTrigger value="all">Todos</TabsTrigger>
                <TabsTrigger value="marketing">Marketing</TabsTrigger>
                <TabsTrigger value="transactional">Transacionais</TabsTrigger>
                <TabsTrigger value="support">Suporte</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </CardContent>
      </Card>

      {/* Template Manager */}
      <Card>
        <CardContent className="p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : filteredTemplates.length === 0 ? (
            <div className="text-center py-12">
              <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">
                {searchTerm || activeTab !== 'all' 
                  ? 'Nenhum template encontrado' 
                  : 'Nenhum template criado ainda'}
              </h3>
              <p className="text-muted-foreground mb-4">
                {searchTerm || activeTab !== 'all'
                  ? 'Tente ajustar os filtros ou criar um novo template'
                  : 'Crie seu primeiro template para começar a enviar mensagens personalizadas'}
              </p>
            </div>
          ) : (
            <TemplateManager 
              showActions={true}
            />
          )}
        </CardContent>
      </Card>

      {/* Biblioteca de Templates (Opcional - para futuro) */}
      {templates.length === 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              Biblioteca de Templates
            </CardTitle>
            <CardDescription>
              Comece rápido com nossos templates prontos
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {/* Template 1: Boas-vindas */}
              <Card className="border-2 hover:border-primary transition-colors cursor-pointer">
                <CardHeader>
                  <CardTitle className="text-base">Boas-vindas</CardTitle>
                  <CardDescription className="text-xs">
                    Mensagem de boas-vindas para novos clientes
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4">
                    "Olá {{nome}}! Seja bem-vindo(a) à {{empresa}}. Estamos felizes em tê-lo(a) conosco! 🎉"
                  </p>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="w-full"
                    onClick={() => handleCreateFromLibrary({
                      name: 'Boas-vindas',
                      content: 'Olá {{nome}}! Seja bem-vindo(a) à {{empresa}}. Estamos felizes em tê-lo(a) conosco! 🎉',
                      category: 'marketing',
                      variables: [
                        { name: 'nome', type: 'text', required: true },
                        { name: 'empresa', type: 'text', required: true }
                      ]
                    })}
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Usar Template
                  </Button>
                </CardContent>
              </Card>

              {/* Template 2: Confirmação de Pedido */}
              <Card className="border-2 hover:border-primary transition-colors cursor-pointer">
                <CardHeader>
                  <CardTitle className="text-base">Confirmação de Pedido</CardTitle>
                  <CardDescription className="text-xs">
                    Confirme pedidos automaticamente
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4">
                    "Pedido #{{pedido}} confirmado! Total: R$ {{valor}}. Previsão de entrega: {{data}}. ✅"
                  </p>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="w-full"
                    onClick={() => handleCreateFromLibrary({
                      name: 'Confirmação de Pedido',
                      content: 'Pedido #{{pedido}} confirmado! Total: R$ {{valor}}. Previsão de entrega: {{data}}. ✅',
                      category: 'transactional',
                      variables: [
                        { name: 'pedido', type: 'text', required: true },
                        { name: 'valor', type: 'text', required: true },
                        { name: 'data', type: 'text', required: true }
                      ]
                    })}
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Usar Template
                  </Button>
                </CardContent>
              </Card>

              {/* Template 3: Lembrete */}
              <Card className="border-2 hover:border-primary transition-colors cursor-pointer">
                <CardHeader>
                  <CardTitle className="text-base">Lembrete de Agendamento</CardTitle>
                  <CardDescription className="text-xs">
                    Lembre seus clientes de compromissos
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4">
                    "Olá {{nome}}! Lembrete: você tem um agendamento em {{data}} às {{hora}}. 📅"
                  </p>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="w-full"
                    onClick={() => handleCreateFromLibrary({
                      name: 'Lembrete de Agendamento',
                      content: 'Olá {{nome}}! Lembrete: você tem um agendamento em {{data}} às {{hora}}. 📅',
                      category: 'support',
                      variables: [
                        { name: 'nome', type: 'text', required: true },
                        { name: 'data', type: 'text', required: true },
                        { name: 'hora', type: 'text', required: true }
                      ]
                    })}
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Usar Template
                  </Button>
                </CardContent>
              </Card>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
