import { useEffect, useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import { supabase } from '@/lib/supabase'

type ContactItem = {
  id: string
  name: string
  phone_number: string
  crm_status?: string | null
}

const STAGES = [
  { key: 'novo', label: 'Novo' },
  { key: 'qualificado', label: 'Qualificado' },
  { key: 'em_negociacao', label: 'Em negociação' },
  { key: 'ganho', label: 'Ganho' },
  { key: 'perdido', label: 'Perdido' },
]

interface Props {
  contacts: any[]
  onChanged?: () => void
}

export default function ContactsKanban({ contacts, onChanged }: Props) {
  const { toast } = useToast()
  const [columns, setColumns] = useState<Record<string, ContactItem[]>>({})

  useEffect(() => {
    const grouped: Record<string, ContactItem[]> = {}
    STAGES.forEach(s => (grouped[s.key] = []))
    contacts.forEach((c: any) => {
      const item: ContactItem = { id: c.id, name: c.name, phone_number: c.phone_number, crm_status: c.crm_status }
      const stage = item.crm_status && STAGES.find(s => s.key === item.crm_status) ? String(item.crm_status) : 'novo'
      grouped[stage].push(item)
    })
    setColumns(grouped)
  }, [contacts])

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>, stage: string) => {
    e.preventDefault()
    const contactId = e.dataTransfer.getData('contactId')
    if (!contactId) return
    try {
      const { error } = await supabase.from('contacts').update({ crm_status: stage }).eq('id', contactId)
      if (error) throw error
      setColumns(prev => {
        const next: Record<string, ContactItem[]> = {}
        STAGES.forEach(s => (next[s.key] = prev[s.key].filter(c => c.id !== contactId)))
        const moved = Object.values(prev).flat().find(c => c.id === contactId)
        if (moved) next[stage] = [...next[stage], { ...moved, crm_status: stage }]
        return next
      })
      toast({ title: 'Status atualizado', description: 'Contato movido no Kanban' })
      onChanged && onChanged()
    } catch (err: any) {
      toast({ title: 'Erro ao atualizar status', description: err.message || 'Falha ao mover', variant: 'destructive' })
    }
  }

  const onDragOver = (e: React.DragEvent<HTMLDivElement>) => e.preventDefault()

  const renderCard = (c: ContactItem) => (
    <div
      key={c.id}
      className="p-3 rounded border bg-card hover:bg-muted/50 cursor-move"
      draggable
      onDragStart={e => e.dataTransfer.setData('contactId', c.id)}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
            <span className="text-sm font-medium text-primary">{c.name?.charAt(0)?.toUpperCase()}</span>
          </div>
          <div>
            <div className="text-sm font-medium">{c.name}</div>
            <div className="text-xs text-muted-foreground">{c.phone_number}</div>
          </div>
        </div>
      </div>
    </div>
  )

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 py-4">
      {STAGES.map(s => (
        <Card key={s.key} onDrop={e => handleDrop(e, s.key)} onDragOver={onDragOver}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">{s.label}</CardTitle>
              <Badge variant="secondary">{columns[s.key]?.length || 0}</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-2 min-h-[200px]">
            {(columns[s.key] || []).map(renderCard)}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
