import React, { useEffect, useMemo, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { DialogDescription } from '@radix-ui/react-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { useToast } from '@/hooks/use-toast'
import { supabase } from '@/lib/supabase'

interface ContactCreateModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  tenantId?: string
  userId: string
  onCreated?: () => void
}

function normalizePhoneBr(input: string): { value: string | null; error?: string } {
  const digits = (input || '').replace(/\D/g, '')
  if (!digits) return { value: null, error: 'Telefone vazio' }
  if (digits.length === 11) return { value: `55${digits}` }
  if (digits.length === 13 && digits.startsWith('55')) return { value: digits }
  return { value: null, error: 'Formato inválido' }
}

export const ContactCreateModal: React.FC<ContactCreateModalProps> = ({ open, onOpenChange, tenantId, userId, onCreated }) => {
  const { toast } = useToast()
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [tags, setTags] = useState('')
  const [consent, setConsent] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!open) {
      setName('')
      setPhone('')
      setTags('')
      setConsent(false)
      setSubmitting(false)
    }
  }, [open])

  const normalized = useMemo(() => normalizePhoneBr(phone), [phone])
  const canSubmit = useMemo(() => Boolean(normalized.value), [normalized])

  const handleCreate = async () => {
    try {
      if (!canSubmit || !normalized.value) {
        toast({ title: 'Telefone inválido', description: 'Use 55DDDNúmero ou (11) 99999-9999', variant: 'destructive' })
        return
      }
      setSubmitting(true)

      let exists: string[] = []
      if (tenantId) {
        const { data } = await supabase.from('contacts').select('phone_number').eq('tenant_id', tenantId)
        exists = (data || []).map((d: any) => String(d.phone_number))
      } else {
        const { data } = await supabase.from('contacts').select('phone_number').eq('user_id', userId)
        exists = (data || []).map((d: any) => String(d.phone_number))
      }
      if (exists.includes(normalized.value)) {
        toast({ title: 'Contato já existe', description: 'Este telefone já está cadastrado', variant: 'destructive' })
        setSubmitting(false)
        return
      }

      const toInsert = {
        user_id: userId,
        tenant_id: tenantId || null,
        phone_number: normalized.value,
        name: name || normalized.value,
        profile_pic_url: null,
        is_group: false,
        tags: tags ? tags.split(',').map(t => t.trim()).filter(Boolean) : [],
        created_at: new Date().toISOString(),
      }

      const { error } = await supabase.from('contacts').insert([toInsert])
      if (error) throw error

      toast({ title: 'Contato criado', description: 'O contato foi adicionado com sucesso' })
      onCreated && onCreated()
      onOpenChange(false)
    } catch (err: any) {
      toast({ title: 'Erro ao criar contato', description: err.message || 'Falha ao criar', variant: 'destructive' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Adicionar Contato</DialogTitle>
          <DialogDescription>Preencha os dados do contato para adicioná-lo à sua base.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <span className="text-sm">Nome</span>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="Nome" />
          </div>
          <div className="space-y-1">
            <span className="text-sm">Telefone</span>
            <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="55DDDNúmero" />
            {!canSubmit && phone && <span className="text-xs text-red-600">Formato inválido</span>}
          </div>
          <div className="space-y-1">
            <span className="text-sm">Tags</span>
            <Input value={tags} onChange={e => setTags(e.target.value)} placeholder="tag1, tag2" />
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox checked={consent} onCheckedChange={v => setConsent(Boolean(v))} />
            <span className="text-sm">Registrar consentimento</span>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>Cancelar</Button>
          <Button onClick={handleCreate} disabled={submitting || !canSubmit}>{submitting ? 'Salvando...' : 'Adicionar'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default ContactCreateModal
