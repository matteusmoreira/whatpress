import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Textarea } from '@/components/ui/textarea';
import { 
  Shuffle, 
  Clock, 
  MessageSquare, 
  Users, 
  Shield, 
  Settings,
  Plus,
  Trash2,
  Save,
  Eye,
  EyeOff,
  Timer,
  Zap,
  Target,
  AlertTriangle
} from 'lucide-react';
import { useRandomization, RandomizationProfile } from '@/hooks/useRandomization';
import { useToast } from '@/hooks/use-toast';

interface RandomizationSettingsProps {
  campaignId?: string;
  onProfileSelect?: (profile: RandomizationProfile) => void;
}

export const RandomizationSettings: React.FC<RandomizationSettingsProps> = ({
  campaignId,
  onProfileSelect
}) => {
  const { toast } = useToast();
  const {
    profiles,
    activeProfile,
    isLoading,
    createProfile,
    updateProfile,
    deleteProfile,
    setActiveProfile,
    calculateDelay,
    refreshData
  } = useRandomization();

  const [selectedProfile, setSelectedProfile] = useState<RandomizationProfile | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingProfile, setEditingProfile] = useState<Partial<RandomizationProfile> | null>(null);
  const [previewDelay, setPreviewDelay] = useState<number | null>(null);

  const defaultProfile: Partial<RandomizationProfile> = {
    name: '',
    description: '',
    min_delay_seconds: 5,
    max_delay_seconds: 15,
    delay_distribution: 'uniform',
    template_rotation_enabled: true,
    template_selection_strategy: 'random',
    contact_shuffle_enabled: true,
    shuffle_strategy: 'random',
    human_simulation_enabled: true,
    typing_delay_enabled: true,
    read_receipt_delay: true,
    online_status_simulation: false,
    burst_prevention: true,
    max_messages_per_burst: 5,
    burst_cooldown_minutes: 10,
    respect_working_hours: false,
    working_hours_start: '09:00',
    working_hours_end: '18:00',
    working_days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
    timezone: 'America/Sao_Paulo',
    is_active: true
  };

  useEffect(() => {
    if (activeProfile) {
      setSelectedProfile(activeProfile);
      onProfileSelect?.(activeProfile);
    }
  }, [activeProfile, onProfileSelect]);

  const handleCreateProfile = async () => {
    if (!editingProfile) return;

    try {
      // Basic validation
      if (!editingProfile.name) {
        toast({
          title: "Erro de Validação",
          description: "Nome do perfil é obrigatório",
          variant: "destructive"
        });
        return;
      }

      const success = await createProfile(editingProfile as Omit<RandomizationProfile, 'id' | 'tenant_id' | 'created_at' | 'updated_at'>);
      
      if (success) {
        setEditingProfile(null);
        setShowCreateForm(false);
        toast({
          title: "Sucesso",
          description: "Perfil de randomização criado com sucesso"
        });
      }
    } catch (error) {
      toast({
        title: "Erro",
        description: "Falha ao criar perfil de randomização",
        variant: "destructive"
      });
    }
  };

  const handleUpdateProfile = async (profile: RandomizationProfile) => {
    try {
      // Basic validation
      if (!profile.name) {
        toast({
          title: "Erro de Validação",
          description: "Nome do perfil é obrigatório",
          variant: "destructive"
        });
        return;
      }

      const success = await updateProfile(profile.id, profile);
      
      if (success) {
        toast({
          title: "Sucesso",
          description: "Perfil atualizado com sucesso"
        });
      }
    } catch (error) {
      toast({
        title: "Erro",
        description: "Falha ao atualizar perfil",
        variant: "destructive"
      });
    }
  };

  const handleDeleteProfile = async (profileId: string) => {
    try {
      const success = await deleteProfile(profileId);
      
      if (success) {
        toast({
          title: "Sucesso",
          description: "Perfil removido com sucesso"
        });
      }
    } catch (error) {
      toast({
        title: "Erro",
        description: "Falha ao remover perfil",
        variant: "destructive"
      });
    }
  };

  const handleActivateProfile = async (profile: RandomizationProfile) => {
    try {
      const success = await setActiveProfile(profile.id);
      
      if (success) {
        toast({
          title: "Sucesso",
          description: `Perfil "${profile.name}" ativado`
        });
      }
    } catch (error) {
      toast({
        title: "Erro",
        description: "Falha ao ativar perfil",
        variant: "destructive"
      });
    }
  };

  const handlePreviewDelay = () => {
    if (editingProfile) {
      const delayMs = calculateDelay();
      setPreviewDelay(Math.round(delayMs / 1000));
      setTimeout(() => setPreviewDelay(null), 3000);
    }
  };

  const updateEditingProfile = (updates: Partial<RandomizationProfile>) => {
    setEditingProfile(prev => ({ ...prev, ...updates }));
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Shuffle className="h-5 w-5" />
                Configurações de Randomização
              </CardTitle>
              <CardDescription>
                Configure perfis de randomização para simular comportamento humano
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={() => {
                setEditingProfile(defaultProfile);
                setShowCreateForm(true);
              }} size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Novo Perfil
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      <Tabs defaultValue="profiles" className="space-y-4">
        <TabsList>
          <TabsTrigger value="profiles">Perfis</TabsTrigger>
          <TabsTrigger value="editor">Editor</TabsTrigger>
          <TabsTrigger value="preview">Visualização</TabsTrigger>
        </TabsList>

        <TabsContent value="profiles" className="space-y-4">
          {profiles.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center h-64">
                <Shuffle className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">Nenhum perfil configurado</h3>
                <p className="text-muted-foreground text-center mb-4">
                  Crie seu primeiro perfil de randomização para começar
                </p>
                <Button onClick={() => {
                  setEditingProfile(defaultProfile);
                  setShowCreateForm(true);
                }}>
                  <Plus className="h-4 w-4 mr-2" />
                  Criar Perfil
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {profiles.map((profile) => (
                <Card key={profile.id} className="cursor-pointer hover:shadow-md transition-shadow"
                      onClick={() => setSelectedProfile(profile)}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-3 h-3 rounded-full ${profile.is_active ? 'bg-green-500' : 'bg-gray-400'}`} />
                        <div>
                          <CardTitle className="text-lg">{profile.name}</CardTitle>
                          <CardDescription>{profile.description}</CardDescription>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {activeProfile?.id === profile.id && (
                          <Badge variant="default">Ativo</Badge>
                        )}
                        {profile.burst_prevention && (
                          <Badge variant="secondary">
                            <Shield className="h-3 w-3 mr-1" />
                            Anti-Detecção
                          </Badge>
                        )}
                        {profile.human_simulation_enabled && (
                          <Badge variant="secondary">
                            <Users className="h-3 w-3 mr-1" />
                            Simulação Humana
                          </Badge>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {/* Configurações Principais */}
                      <div className="grid grid-cols-3 gap-4 text-center">
                        <div>
                          <div className="text-lg font-bold text-primary">
                            {profile.min_delay_seconds}s - {profile.max_delay_seconds}s
                          </div>
                          <div className="text-xs text-muted-foreground">Intervalo de Delay</div>
                        </div>
                        <div>
                          <div className="text-lg font-bold text-green-600">
                            {profile.delay_distribution}
                          </div>
                          <div className="text-xs text-muted-foreground">Distribuição</div>
                        </div>
                        <div>
                          <div className="text-lg font-bold text-blue-600">
                            {profile.max_messages_per_burst}
                          </div>
                          <div className="text-xs text-muted-foreground">Msgs por Burst</div>
                        </div>
                      </div>

                      {/* Features Ativas */}
                      <div className="flex flex-wrap gap-2">
                        {profile.template_rotation_enabled && (
                          <Badge variant="outline" className="text-xs">
                            <MessageSquare className="h-3 w-3 mr-1" />
                            Rotação de Templates
                          </Badge>
                        )}
                        {profile.contact_shuffle_enabled && (
                          <Badge variant="outline" className="text-xs">
                            <Shuffle className="h-3 w-3 mr-1" />
                            Embaralhar Contatos
                          </Badge>
                        )}
                        {profile.respect_working_hours && (
                          <Badge variant="outline" className="text-xs">
                            <Clock className="h-3 w-3 mr-1" />
                            Horário Comercial
                          </Badge>
                        )}
                        {profile.burst_prevention && (
                          <Badge variant="outline" className="text-xs">
                            <Shield className="h-3 w-3 mr-1" />
                            Anti-Burst
                          </Badge>
                        )}
                      </div>

                      {/* Ações */}
                      <div className="flex items-center justify-between pt-2 border-t">
                        <div className="text-sm text-muted-foreground">
                          {profile.respect_working_hours && (
                            <span>
                              Horário: {profile.working_hours_start} - {profile.working_hours_end}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingProfile(profile);
                              setShowCreateForm(true);
                            }}
                          >
                            <Settings className="h-4 w-4 mr-1" />
                            Editar
                          </Button>
                          {activeProfile?.id !== profile.id && (
                            <Button 
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleActivateProfile(profile);
                              }}
                            >
                              <Target className="h-4 w-4 mr-1" />
                              Ativar
                            </Button>
                          )}
                          <Button 
                            size="sm" 
                            variant="destructive"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteProfile(profile.id);
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="editor" className="space-y-4">
          {(showCreateForm || editingProfile) ? (
            <Card>
              <CardHeader>
                <CardTitle>
                  {editingProfile?.id ? 'Editar Perfil' : 'Novo Perfil de Randomização'}
                </CardTitle>
                <CardDescription>
                  Configure as opções de randomização para simular comportamento humano
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Informações Básicas */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Informações Básicas</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="name">Nome do Perfil</Label>
                      <Input
                        id="name"
                        value={editingProfile?.name || ''}
                        onChange={(e) => updateEditingProfile({ name: e.target.value })}
                        placeholder="Ex: Perfil Conservador"
                      />
                    </div>
                    <div>
                      <Label htmlFor="description">Descrição</Label>
                      <Input
                        id="description"
                        value={editingProfile?.description || ''}
                        onChange={(e) => updateEditingProfile({ description: e.target.value })}
                        placeholder="Descrição do perfil"
                      />
                    </div>
                  </div>
                </div>

                {/* Configurações de Delay */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">Configurações de Delay</h3>
                    <Button variant="outline" size="sm" onClick={handlePreviewDelay}>
                      <Eye className="h-4 w-4 mr-2" />
                      Testar Delay
                    </Button>
                  </div>
                  
                  {previewDelay && (
                    <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
                      <div className="flex items-center gap-2">
                        <Timer className="h-4 w-4 text-blue-600" />
                        <span className="text-sm font-medium">Delay calculado: {previewDelay}s</span>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <Label htmlFor="delay_min">Delay Mínimo (segundos)</Label>
                      <Input
                        id="delay_min"
                        type="number"
                        min="1"
                        value={editingProfile?.min_delay_seconds || 5}
                        onChange={(e) => updateEditingProfile({ min_delay_seconds: parseInt(e.target.value) })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="delay_max">Delay Máximo (segundos)</Label>
                      <Input
                        id="delay_max"
                        type="number"
                        min="1"
                        value={editingProfile?.max_delay_seconds || 15}
                        onChange={(e) => updateEditingProfile({ max_delay_seconds: parseInt(e.target.value) })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="distribution">Distribuição</Label>
                      <Select 
                        value={editingProfile?.delay_distribution || 'uniform'}
                        onValueChange={(value) => updateEditingProfile({ delay_distribution: value as RandomizationProfile['delay_distribution'] })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="uniform">Uniforme</SelectItem>
                          <SelectItem value="normal">Normal</SelectItem>
                          <SelectItem value="exponential">Exponencial</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="template_strategy">Estratégia de Seleção</Label>
                      <Select 
                        value={editingProfile?.template_selection_strategy || 'random'}
                        onValueChange={(value) => updateEditingProfile({ template_selection_strategy: value as RandomizationProfile['template_selection_strategy'] })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="random">Aleatória</SelectItem>
                          <SelectItem value="sequential">Sequencial</SelectItem>
                          <SelectItem value="weighted">Ponderada</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="shuffle_strategy">Estratégia</Label>
                      <Select 
                        value={editingProfile?.shuffle_strategy || 'random'}
                        onValueChange={(value) => updateEditingProfile({ shuffle_strategy: value as RandomizationProfile['shuffle_strategy'] })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="random">Aleatória</SelectItem>
                          <SelectItem value="priority_based">Por prioridade</SelectItem>
                          <SelectItem value="time_based">Por horário</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="cooldown">Cooldown (minutos)</Label>
                      <Input
                        id="cooldown"
                        type="number"
                        min="1"
                        max="60"
                        value={editingProfile?.burst_cooldown_minutes || 10}
                        onChange={(e) => updateEditingProfile({ burst_cooldown_minutes: parseInt(e.target.value) })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="max_burst">Máx. Mensagens por Burst</Label>
                      <Input
                        id="max_burst"
                        type="number"
                        min="1"
                        max="20"
                        value={editingProfile?.max_messages_per_burst || 5}
                        onChange={(e) => updateEditingProfile({ max_messages_per_burst: parseInt(e.target.value) })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="start_time">Horário de Início</Label>
                      <Input
                        id="start_time"
                        type="time"
                        value={editingProfile?.working_hours_start || '09:00'}
                        onChange={(e) => updateEditingProfile({ working_hours_start: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="end_time">Horário de Fim</Label>
                      <Input
                        id="end_time"
                        type="time"
                        value={editingProfile?.working_hours_end || '18:00'}
                        onChange={(e) => updateEditingProfile({ working_hours_end: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="timezone">Fuso Horário</Label>
                      <Select 
                        value={editingProfile?.timezone || 'America/Sao_Paulo'}
                        onValueChange={(value) => updateEditingProfile({ timezone: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="America/Sao_Paulo">São Paulo (GMT-3)</SelectItem>
                          <SelectItem value="America/New_York">Nova York (GMT-5)</SelectItem>
                          <SelectItem value="Europe/London">Londres (GMT+0)</SelectItem>
                          <SelectItem value="Asia/Tokyo">Tóquio (GMT+9)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                {/* Simulação Humana */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">Simulação Humana</h3>
                    <Switch
                      checked={editingProfile?.human_simulation_enabled || false}
                      onCheckedChange={(checked) => updateEditingProfile({ human_simulation_enabled: checked })}
                    />
                  </div>
                  
                  {editingProfile?.human_simulation_enabled && (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <Label htmlFor="typing_delay">Delay de Digitação</Label>
                          <Switch
                            checked={editingProfile?.typing_delay_enabled || false}
                            onCheckedChange={(checked) => updateEditingProfile({ typing_delay_enabled: checked })}
                          />
                        </div>
                        
                      </div>

                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <Label htmlFor="read_receipt_delay">Atraso de Recibo de Leitura</Label>
                          <Switch
                            checked={editingProfile?.read_receipt_delay || false}
                            onCheckedChange={(checked) => updateEditingProfile({ read_receipt_delay: checked })}
                          />
                        </div>
                        <div className="flex items-center justify-between">
                          <Label htmlFor="online_status">Simular Status Online</Label>
                          <Switch
                            checked={editingProfile?.online_status_simulation || false}
                            onCheckedChange={(checked) => updateEditingProfile({ online_status_simulation: checked })}
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Anti-Detecção */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">Anti-Detecção</h3>
                    <Switch
                      checked={editingProfile?.burst_prevention || false}
                      onCheckedChange={(checked) => updateEditingProfile({ burst_prevention: checked })}
                    />
                  </div>
                  
                  {editingProfile?.burst_prevention && (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="max_burst">Máx. Mensagens por Burst</Label>
                        <Input
                          id="max_burst"
                          type="number"
                          min="1"
                          max="20"
                          value={editingProfile?.max_messages_per_burst || 5}
                          onChange={(e) => updateEditingProfile({ max_messages_per_burst: parseInt(e.target.value) })}
                        />
                      </div>
                      <div>
                        <Label htmlFor="cooldown">Cooldown (minutos)</Label>
                        <Input
                          id="cooldown"
                          type="number"
                          min="1"
                          max="60"
                          value={editingProfile?.burst_cooldown_minutes || 10}
                          onChange={(e) => updateEditingProfile({ burst_cooldown_minutes: parseInt(e.target.value) })}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Horário de Trabalho */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">Horário de Trabalho</h3>
                    <Switch
                      checked={editingProfile?.respect_working_hours || false}
                      onCheckedChange={(checked) => updateEditingProfile({ respect_working_hours: checked })}
                    />
                  </div>
                  
                  {editingProfile?.respect_working_hours && (
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <Label htmlFor="start_time">Horário de Início</Label>
                        <Input
                          id="start_time"
                          type="time"
                          value={editingProfile?.working_hours_start || '09:00'}
                          onChange={(e) => updateEditingProfile({ working_hours_start: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label htmlFor="end_time">Horário de Fim</Label>
                        <Input
                          id="end_time"
                          type="time"
                          value={editingProfile?.working_hours_end || '18:00'}
                          onChange={(e) => updateEditingProfile({ working_hours_end: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label htmlFor="timezone">Fuso Horário</Label>
                        <Select 
                          value={editingProfile?.timezone || 'America/Sao_Paulo'}
                          onValueChange={(value) => updateEditingProfile({ timezone: value })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="America/Sao_Paulo">São Paulo (GMT-3)</SelectItem>
                            <SelectItem value="America/New_York">Nova York (GMT-5)</SelectItem>
                            <SelectItem value="Europe/London">Londres (GMT+0)</SelectItem>
                            <SelectItem value="Asia/Tokyo">Tóquio (GMT+9)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )}
                </div>

                {/* Ações */}
                <div className="flex justify-end gap-2 pt-4 border-t">
                  <Button variant="outline" onClick={() => {
                    setEditingProfile(null);
                    setShowCreateForm(false);
                  }}>
                    Cancelar
                  </Button>
                  <Button onClick={editingProfile?.id ? 
                    () => handleUpdateProfile(editingProfile as RandomizationProfile) : 
                    handleCreateProfile
                  }>
                    <Save className="h-4 w-4 mr-2" />
                    {editingProfile?.id ? 'Atualizar' : 'Criar'} Perfil
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center h-64">
                <Settings className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">Selecione um perfil para editar</h3>
                <p className="text-muted-foreground text-center">
                  Escolha um perfil existente ou crie um novo
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="preview" className="space-y-4">
          {selectedProfile ? (
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Configurações de Delay</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Intervalo Base</span>
                      <span>{selectedProfile.min_delay_seconds}s - {selectedProfile.max_delay_seconds}s</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>Distribuição</span>
                      <span>{selectedProfile.delay_distribution}</span>
                    </div>
                  </div>
                  
                  <div className="p-3 bg-muted rounded-lg">
                    <div className="text-sm font-medium mb-2">Exemplo de Delays:</div>
                    <div className="space-y-1 text-sm">
                      {Array.from({ length: 5 }, (_, i) => (
                        <div key={i} className="flex justify-between">
                          <span>Mensagem {i + 1}:</span>
                          <span>{Math.round(calculateDelay(selectedProfile.id) / 1000)}s</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Recursos Ativos</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Rotação de Templates</span>
                      {selectedProfile.template_rotation_enabled ? (
                        <Badge variant="default">Ativo</Badge>
                      ) : (
                        <Badge variant="secondary">Inativo</Badge>
                      )}
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Embaralhamento de Contatos</span>
                      {selectedProfile.contact_shuffle_enabled ? (
                        <Badge variant="default">Ativo</Badge>
                      ) : (
                        <Badge variant="secondary">Inativo</Badge>
                      )}
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Simulação Humana</span>
                      {selectedProfile.human_simulation_enabled ? (
                        <Badge variant="default">Ativo</Badge>
                      ) : (
                        <Badge variant="secondary">Inativo</Badge>
                      )}
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Anti-Detecção</span>
                      {selectedProfile.burst_prevention ? (
                        <Badge variant="default">Ativo</Badge>
                      ) : (
                        <Badge variant="secondary">Inativo</Badge>
                      )}
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Horário de Trabalho</span>
                      {selectedProfile.respect_working_hours ? (
                        <Badge variant="default">
                          {selectedProfile.working_hours_start} - {selectedProfile.working_hours_end}
                        </Badge>
                      ) : (
                        <Badge variant="secondary">24h</Badge>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {selectedProfile.burst_prevention && (
                <Card className="md:col-span-2">
                  <CardHeader>
                    <CardTitle>Configurações Anti-Detecção</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-6">
                      <div>
                        <h4 className="font-medium mb-2">Prevenção de Burst</h4>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span>Máx. por burst:</span>
                            <span>{selectedProfile.max_messages_per_burst} mensagens</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Cooldown:</span>
                            <span>{selectedProfile.burst_cooldown_minutes} minutos</span>
                          </div>
                        </div>
                      </div>
                      
                      {selectedProfile.human_simulation_enabled && (
                        <div>
                          <h4 className="font-medium mb-2">Simulação Humana</h4>
                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span>Delay de digitação:</span>
                              <span>{selectedProfile.typing_delay_enabled ? 'Ativo' : 'Inativo'}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Recibo de leitura:</span>
                              <span>{selectedProfile.read_receipt_delay ? 'Com atraso' : 'Imediato'}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Simulação status online:</span>
                              <span>{selectedProfile.online_status_simulation ? 'Ativo' : 'Inativo'}</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center h-64">
                <Eye className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">Selecione um perfil</h3>
                <p className="text-muted-foreground text-center">
                  Escolha um perfil para visualizar suas configurações
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};