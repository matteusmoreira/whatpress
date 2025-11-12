import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { 
  MessageSquare, 
  Phone, 
  Mail, 
  Search,
  Send
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

export default function Support() {
  const { toast } = useToast()
  const [searchQuery, setSearchQuery] = useState('')
  const [ticketSubject, setTicketSubject] = useState('')
  const [ticketMessage, setTicketMessage] = useState('')

  const faqItems = [
    {
      question: "Como conectar meu WhatsApp?",
      answer: "Acesse a seção 'Conexões WhatsApp' no menu lateral e siga o processo de autenticação com QR Code."
    },
    {
      question: "Como criar uma campanha?",
      answer: "Vá para 'Campanhas' > 'Nova Campanha', defina sua audiência, crie sua mensagem e agende o envio."
    },
    {
      question: "Posso enviar mídia nas mensagens?",
      answer: "Sim! Nossa plataforma suporta envio de imagens, vídeos, documentos e áudios."
    }
  ]

  const handleCreateTicket = () => {
    if (!ticketSubject || !ticketMessage) {
      toast({
        title: "Erro",
        description: "Preencha todos os campos obrigatórios",
        variant: "destructive"
      })
      return
    }

    toast({
      title: "Ticket criado!",
      description: "Seu ticket foi criado com sucesso. Você receberá uma resposta em breve."
    })

    setTicketSubject('')
    setTicketMessage('')
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Central de Suporte</h1>
        <p className="text-muted-foreground">
          Encontre respostas, crie tickets e acesse recursos de ajuda
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* FAQ */}
        <Card>
          <CardHeader>
            <CardTitle>Perguntas Frequentes</CardTitle>
            <CardDescription>
              Encontre respostas rápidas para as dúvidas mais comuns
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar nas perguntas frequentes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            <div className="space-y-4">
              {faqItems.map((item, index) => (
                <div key={index} className="border rounded-lg p-4">
                  <h4 className="font-medium mb-2">{item.question}</h4>
                  <p className="text-sm text-muted-foreground">{item.answer}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Criar Ticket */}
        <Card>
          <CardHeader>
            <CardTitle>Criar Novo Ticket</CardTitle>
            <CardDescription>
              Descreva seu problema e nossa equipe entrará em contato
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="subject">Assunto</Label>
              <Input
                id="subject"
                placeholder="Descreva brevemente o problema"
                value={ticketSubject}
                onChange={(e) => setTicketSubject(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="message">Mensagem</Label>
              <Textarea
                id="message"
                placeholder="Descreva detalhadamente o problema ou dúvida"
                rows={4}
                value={ticketMessage}
                onChange={(e) => setTicketMessage(e.target.value)}
              />
            </div>

            <Button onClick={handleCreateTicket} className="w-full">
              <Send className="h-4 w-4 mr-2" />
              Criar Ticket
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Contatos */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-primary/10 rounded-lg">
                <MessageSquare className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold">Chat ao Vivo</h3>
                <p className="text-sm text-muted-foreground">Resposta imediata</p>
                <Button variant="link" className="p-0 h-auto text-primary">
                  Iniciar chat
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-primary/10 rounded-lg">
                <Mail className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold">Email</h3>
                <p className="text-sm text-muted-foreground">suporte@whatpress.com</p>
                <Button variant="link" className="p-0 h-auto text-primary">
                  Enviar email
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-primary/10 rounded-lg">
                <Phone className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold">Telefone</h3>
                <p className="text-sm text-muted-foreground">(11) 9999-9999</p>
                <Button variant="link" className="p-0 h-auto text-primary">
                  Ligar agora
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
