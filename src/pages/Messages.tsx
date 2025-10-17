import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Search,
  Send,
  Phone,
  Video,
  MoreVertical,
  Paperclip,
  Smile,
  Clock,
  Users,
  Image,
  FileText,
  Mic,
  MessageSquare,
  Filter,
  Archive,
  Star,
  Trash2,
  RefreshCw,
  CheckCheck,
  Download,
  Calendar
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/hooks/use-toast'
import { supabase } from '@/lib/supabase'
import { evolutionApi } from '@/services/evolutionApi'
import { useMessages } from '@/hooks/useMessages'
import { MediaUpload, BulkMessageDialog } from '@/components/MediaUpload'
import { MediaFile } from '@/hooks/useMessages'

interface Message {
  id: string
  whatsapp_instance_id: string
  message_id: string
  from_number: string
  to_number: string
  content: string
  message_type: string
  media_url?: string
  is_from_me: boolean
  timestamp: string
  status: string
}

interface Contact {
  id: string
  phone_number: string
  name: string
  last_message_at: string
}

interface Conversation {
  contact: Contact
  lastMessage: Message | null
  unreadCount: number
}

export default function Messages() {
  const [selectedContact, setSelectedContact] = useState<string | null>(null)
  const [messageText, setMessageText] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [messages, setMessages] = useState<Message[]>([])
  const [contacts, setContacts] = useState<Contact[]>([])
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  
  const { user } = useAuth()
  const { toast } = useToast()

  // Auto scroll para última mensagem
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Carregar dados iniciais
  useEffect(() => {
    if (user) {
      loadData()
    }
  }, [user])

  // Carregar mensagens e contatos
  const loadData = async () => {
    try {
      setLoading(true)

      // Carregar contatos
      const { data: contactsData, error: contactsError } = await supabase
        .from('contacts')
        .select('*')
        .eq('user_id', user?.id)
        .order('last_message_at', { ascending: false })

      if (contactsError) throw contactsError

      // Carregar mensagens
      const { data: messagesData, error: messagesError } = await supabase
        .from('messages')
        .select('*')
        .eq('user_id', user?.id)
        .order('timestamp', { ascending: true })

      if (messagesError) throw messagesError

      setContacts(contactsData || [])
      setMessages(messagesData || [])

      // Criar conversas
      const conversationsMap = new Map<string, Conversation>()
      
      contactsData?.forEach(contact => {
        conversationsMap.set(contact.phone_number, {
          contact,
          lastMessage: null,
          unreadCount: 0
        })
      })

      // Adicionar mensagens às conversas
      messagesData?.forEach(message => {
        const phoneNumber = message.is_from_me ? message.to_number : message.from_number
        const conversation = conversationsMap.get(phoneNumber)
        
        if (conversation) {
          // Atualizar última mensagem
          if (!conversation.lastMessage || 
              new Date(message.timestamp) > new Date(conversation.lastMessage.timestamp)) {
            conversation.lastMessage = message
          }
          
          // Contar mensagens não lidas
          if (!message.is_from_me && message.status !== 'read') {
            conversation.unreadCount++
          }
        }
      })

      setConversations(Array.from(conversationsMap.values()))

    } catch (error) {
      console.error('Erro ao carregar dados:', error)
      toast({
        title: "Erro ao carregar",
        description: "Não foi possível carregar as mensagens",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  // Filtrar mensagens do contato selecionado
  const selectedContactMessages = messages.filter(msg => 
    selectedContact && (
      (msg.from_number === selectedContact && !msg.is_from_me) ||
      (msg.to_number === selectedContact && msg.is_from_me)
    )
  )

  // Filtrar conversas por termo de busca
  const filteredConversations = conversations.filter(conv =>
    conv.contact.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    conv.contact.phone_number.includes(searchTerm) ||
    (conv.lastMessage?.content || '').toLowerCase().includes(searchTerm.toLowerCase())
  )

  // Enviar mensagem
  const handleSendMessage = async () => {
    if (!messageText.trim() || !selectedContact || !user) return

    try {
      setSending(true)

      // Buscar instância ativa do usuário
      const { data: instances, error: instanceError } = await supabase
        .from('whatsapp_instances')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'connected')
        .limit(1)

      if (instanceError) throw instanceError

      if (!instances || instances.length === 0) {
        toast({
          title: "Nenhuma instância conectada",
          description: "Conecte uma instância do WhatsApp primeiro",
          variant: "destructive",
        })
        return
      }

      const instance = instances[0]

      // Enviar mensagem via Evolution API
      const response = await fetch(`${import.meta.env.VITE_EVOLUTION_API_URL}/message/sendText/${instance.api_key}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': import.meta.env.VITE_EVOLUTION_API_KEY
        },
        body: JSON.stringify({
          number: selectedContact,
          text: messageText
        })
      })

      if (!response.ok) {
        throw new Error('Falha ao enviar mensagem')
      }

      // Salvar mensagem no banco
      const { error: messageError } = await supabase
        .from('messages')
        .insert([
          {
            whatsapp_instance_id: instance.id,
            user_id: user.id,
            message_id: `sent_${Date.now()}`,
            from_number: instance.name,
            to_number: selectedContact,
            content: messageText,
            message_type: 'text',
            is_from_me: true,
            timestamp: new Date().toISOString(),
            status: 'sent'
          }
        ])

      if (messageError) throw messageError

      setMessageText('')
      await loadData() // Recarregar dados
      
      toast({
        title: "Mensagem enviada",
        description: "Sua mensagem foi enviada com sucesso",
      })
    } catch (error) {
      console.error('Erro ao enviar mensagem:', error)
      toast({
        title: "Erro ao enviar",
        description: "Não foi possível enviar a mensagem",
        variant: "destructive",
      })
    } finally {
      setSending(false)
    }
  }

  // Formatar timestamp
  const formatTime = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const hours = diff / (1000 * 60 * 60)
    
    if (hours < 24) {
      return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    } else {
      return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
    }
  }

  // Obter ícone do tipo de mensagem
  const getMessageTypeIcon = (type: string) => {
    switch (type) {
      case 'image': return <Image className="w-4 h-4" />
      case 'document': return <FileText className="w-4 h-4" />
      case 'audio': return <Mic className="w-4 h-4" />
      default: return null
    }
  }

  // Obter nome do contato
  const getContactName = (phoneNumber: string) => {
    const contact = contacts.find(c => c.phone_number === phoneNumber)
    return contact?.name || phoneNumber.split('@')[0] || phoneNumber
  }

  if (loading) {
    return (
      <div className="h-[calc(100vh-2rem)] flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4" />
          <p>Carregando mensagens...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-[calc(100vh-2rem)] flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Mensagens</h1>
          <p className="text-muted-foreground">
            Gerencie suas conversas em tempo real
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" onClick={loadData} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Lista de Conversas */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Conversas</CardTitle>
              <Badge variant="outline">
                {conversations.length} conversas
              </Badge>
            </div>
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar conversas..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8"
              />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[500px]">
              {filteredConversations.length === 0 ? (
                <div className="p-6 text-center text-muted-foreground">
                  <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Nenhuma conversa encontrada</p>
                  <p className="text-sm mt-2">
                    As conversas aparecerão aqui quando você receber mensagens
                  </p>
                </div>
              ) : (
                filteredConversations.map((conversation, index) => (
                  <div key={conversation.contact.id}>
                    <div
                      className={`p-4 cursor-pointer hover:bg-muted/50 transition-colors ${
                        selectedContact === conversation.contact.phone_number ? 'bg-muted' : ''
                      }`}
                      onClick={() => setSelectedContact(conversation.contact.phone_number)}
                    >
                      <div className="flex items-center space-x-3">
                        <Avatar>
                          <AvatarFallback>
                            {conversation.contact.name.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <p className="font-medium truncate">{conversation.contact.name}</p>
                            <span className="text-xs text-muted-foreground">
                              {conversation.lastMessage && formatTime(conversation.lastMessage.timestamp)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <p className="text-sm text-muted-foreground truncate">
                              {conversation.lastMessage?.content || 'Nenhuma mensagem'}
                            </p>
                            {conversation.unreadCount > 0 && (
                              <Badge variant="default" className="ml-2 h-5 w-5 p-0 text-xs">
                                {conversation.unreadCount}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                    {index < filteredConversations.length - 1 && <Separator />}
                  </div>
                ))
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Área de Chat */}
        <Card className="lg:col-span-2 flex flex-col">
          {selectedContact ? (
            <>
              {/* Header do Chat */}
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <Avatar>
                      <AvatarFallback>
                        {getContactName(selectedContact).charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <h3 className="font-medium">
                        {getContactName(selectedContact)}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {selectedContact}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button variant="ghost" size="sm">
                      <Phone className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="sm">
                      <Video className="w-4 h-4" />
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem>
                          <Archive className="h-4 w-4 mr-2" />
                          Arquivar
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <Star className="h-4 w-4 mr-2" />
                          Favoritar
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <Download className="h-4 w-4 mr-2" />
                          Exportar Chat
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </CardHeader>

              {/* Mensagens */}
              <CardContent className="flex-1 p-0">
                <ScrollArea className="h-[400px] p-4">
                  {selectedContactMessages.length === 0 ? (
                    <div className="text-center text-muted-foreground py-8">
                      <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>Nenhuma mensagem ainda</p>
                      <p className="text-sm">Envie uma mensagem para começar a conversa</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {selectedContactMessages.map((message) => (
                        <div
                          key={message.id}
                          className={`flex ${message.is_from_me ? 'justify-end' : 'justify-start'}`}
                        >
                          <div
                            className={`max-w-[70%] rounded-lg p-3 ${
                              message.is_from_me
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-muted'
                            }`}
                          >
                            <div className="flex items-center space-x-2 mb-1">
                              {getMessageTypeIcon(message.message_type)}
                              {message.message_type !== 'text' && (
                                <span className="text-xs opacity-70">
                                  {message.message_type.charAt(0).toUpperCase() + message.message_type.slice(1)}
                                </span>
                              )}
                            </div>
                            <p className="text-sm">{message.content}</p>
                            {message.media_url && (
                              <Button variant="ghost" size="sm" className="mt-2 p-0 h-auto">
                                <Download className="w-3 h-3 mr-1" />
                                Download
                              </Button>
                            )}
                            <div className="flex items-center justify-end space-x-1 mt-1">
                              <span className="text-xs opacity-70">
                                {formatTime(message.timestamp)}
                              </span>
                              {message.is_from_me && (
                                <CheckCheck className="w-3 h-3 opacity-70" />
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                      <div ref={messagesEndRef} />
                    </div>
                  )}
                </ScrollArea>
              </CardContent>

              {/* Input de Mensagem */}
              <div className="p-4 border-t">
                <div className="flex items-center space-x-2">
                  <Button variant="ghost" size="sm">
                    <Paperclip className="w-4 h-4" />
                  </Button>
                  <div className="flex-1 relative">
                    <Input
                      placeholder="Digite sua mensagem..."
                      value={messageText}
                      onChange={(e) => setMessageText(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                      disabled={sending}
                    />
                  </div>
                  <Button variant="ghost" size="sm">
                    <Smile className="w-4 h-4" />
                  </Button>
                  <Button 
                    onClick={handleSendMessage}
                    disabled={!messageText.trim() || sending}
                  >
                    {sending ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <CardContent className="flex-1 flex items-center justify-center">
              <div className="text-center text-muted-foreground">
                <MessageSquare className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <h3 className="text-lg font-medium mb-2">Selecione uma conversa</h3>
                <p>Escolha uma conversa da lista para começar a trocar mensagens</p>
              </div>
            </CardContent>
          )}
        </Card>
      </div>
    </div>
  )
}