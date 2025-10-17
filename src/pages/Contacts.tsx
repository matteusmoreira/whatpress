import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Checkbox } from '@/components/ui/checkbox'
import { 
  Users, 
  Plus, 
  Search, 
  Filter,
  Upload,
  Download,
  MoreHorizontal,
  Phone,
  Mail,
  Calendar,
  Tag,
  Trash2,
  Edit,
  MessageSquare,
  UserPlus,
  FileSpreadsheet,
  RefreshCw
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
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/hooks/use-toast'
import { supabase } from '@/lib/supabase'

interface Contact {
  id: string
  user_id: string
  phone_number: string
  name: string
  profile_picture_url?: string
  last_message_at: string
  created_at: string
  updated_at: string
}

interface ContactStats {
  total: number
  active: number
  withMessages: number
  newThisWeek: number
}

export default function Contacts() {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [stats, setStats] = useState<ContactStats>({
    total: 0,
    active: 0,
    withMessages: 0,
    newThisWeek: 0
  })
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedContacts, setSelectedContacts] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  
  const { user } = useAuth()
  const { toast } = useToast()

  // Carregar dados iniciais
  useEffect(() => {
    if (user) {
      loadContacts()
    }
  }, [user])

  // Carregar contatos do banco
  const loadContacts = async () => {
    try {
      setLoading(true)

      // Carregar contatos
      const { data: contactsData, error: contactsError } = await supabase
        .from('contacts')
        .select('*')
        .eq('user_id', user?.id)
        .order('last_message_at', { ascending: false })

      if (contactsError) throw contactsError

      setContacts(contactsData || [])

      // Calcular estatísticas
      const now = new Date()
      const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

      const total = contactsData?.length || 0
      const active = contactsData?.filter(c => 
        new Date(c.last_message_at) > new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
      ).length || 0
      const withMessages = contactsData?.filter(c => c.last_message_at).length || 0
      const newThisWeek = contactsData?.filter(c => 
        new Date(c.created_at) > oneWeekAgo
      ).length || 0

      setStats({
        total,
        active,
        withMessages,
        newThisWeek
      })

    } catch (error) {
      console.error('Erro ao carregar contatos:', error)
      toast({
        title: "Erro ao carregar",
        description: "Não foi possível carregar os contatos",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  // Filtrar contatos por termo de busca
  const filteredContacts = contacts.filter(contact =>
    contact.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    contact.phone_number.includes(searchTerm)
  )

  // Selecionar contato
  const handleSelectContact = (contactId: string) => {
    setSelectedContacts(prev => 
      prev.includes(contactId) 
        ? prev.filter(id => id !== contactId)
        : [...prev, contactId]
    )
  }

  // Selecionar todos
  const handleSelectAll = () => {
    setSelectedContacts(
      selectedContacts.length === filteredContacts.length 
        ? [] 
        : filteredContacts.map(contact => contact.id)
    )
  }

  // Deletar contatos selecionados
  const handleDeleteSelected = async () => {
    if (selectedContacts.length === 0) return

    try {
      const { error } = await supabase
        .from('contacts')
        .delete()
        .in('id', selectedContacts)

      if (error) throw error

      toast({
        title: "Contatos deletados",
        description: `${selectedContacts.length} contato(s) foram deletados`,
      })

      setSelectedContacts([])
      await loadContacts()
    } catch (error) {
      console.error('Erro ao deletar contatos:', error)
      toast({
        title: "Erro ao deletar",
        description: "Não foi possível deletar os contatos",
        variant: "destructive",
      })
    }
  }

  // Formatar data
  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    })
  }

  // Formatar telefone
  const formatPhone = (phone: string) => {
    // Remove @c.us se existir
    const cleanPhone = phone.replace('@c.us', '')
    
    // Formatar número brasileiro
    if (cleanPhone.startsWith('55') && cleanPhone.length >= 12) {
      const number = cleanPhone.substring(2)
      return `+55 ${number.substring(0, 2)} ${number.substring(2, 7)}-${number.substring(7)}`
    }
    
    return cleanPhone
  }

  if (loading) {
    return (
      <div className="h-[calc(100vh-2rem)] flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4" />
          <p>Carregando contatos...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Contatos</h1>
          <p className="text-muted-foreground">Gerencie sua base de contatos e leads</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={loadContacts} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
          <Button variant="outline" className="gap-2">
            <Upload className="h-4 w-4" />
            Importar
          </Button>
          <Button variant="outline" className="gap-2">
            <Download className="h-4 w-4" />
            Exportar
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Contatos</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              Todos os contatos cadastrados
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Contatos Ativos</CardTitle>
            <UserPlus className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.active.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              Com mensagens nos últimos 30 dias
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Com Mensagens</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.withMessages.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              Contatos que já enviaram mensagens
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Novos esta Semana</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.newThisWeek.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              Contatos adicionados nos últimos 7 dias
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Search */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar contatos..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
            
            {selectedContacts.length > 0 && (
              <div className="flex items-center space-x-2">
                <span className="text-sm text-muted-foreground">
                  {selectedContacts.length} selecionado(s)
                </span>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleDeleteSelected}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Deletar
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        
        <CardContent>
          {/* Table Header */}
          <div className="flex items-center space-x-4 py-3 border-b">
            <Checkbox
              checked={selectedContacts.length === filteredContacts.length && filteredContacts.length > 0}
              onCheckedChange={handleSelectAll}
            />
            <div className="flex-1 grid grid-cols-4 gap-4 text-sm font-medium text-muted-foreground">
              <div>Nome</div>
              <div>Telefone</div>
              <div>Última Mensagem</div>
              <div>Cadastrado em</div>
            </div>
            <div className="w-10"></div>
          </div>

          {/* Table Body */}
          <div className="space-y-2">
            {filteredContacts.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Nenhum contato encontrado</p>
                <p className="text-sm mt-2">
                  Os contatos aparecerão aqui quando você receber mensagens
                </p>
              </div>
            ) : (
              filteredContacts.map((contact) => (
                <div key={contact.id} className="flex items-center space-x-4 py-3 hover:bg-muted/50 rounded-lg">
                  <Checkbox
                    checked={selectedContacts.includes(contact.id)}
                    onCheckedChange={() => handleSelectContact(contact.id)}
                  />
                  <div className="flex-1 grid grid-cols-4 gap-4">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                        <span className="text-sm font-medium text-primary">
                          {contact.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium">{contact.name}</p>
                      </div>
                    </div>
                    <div>
                      <p className="text-sm">{formatPhone(contact.phone_number)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">
                        {contact.last_message_at ? formatDate(contact.last_message_at) : 'Nunca'}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">
                        {formatDate(contact.created_at)}
                      </p>
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem>
                        <MessageSquare className="h-4 w-4 mr-2" />
                        Enviar Mensagem
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                        <Edit className="h-4 w-4 mr-2" />
                        Editar
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="text-destructive">
                        <Trash2 className="h-4 w-4 mr-2" />
                        Deletar
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}