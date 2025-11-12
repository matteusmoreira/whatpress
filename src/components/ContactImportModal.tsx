import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { DialogDescription } from '@radix-ui/react-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { useToast } from '@/hooks/use-toast'
import Papa from 'papaparse'
import * as XLSX from 'xlsx'
import { supabase } from '@/lib/supabase'

type ContactRow = {
  name: string
  phone: string
  email?: string
  tags?: string[]
  valid: boolean
  error?: string
}

type ColumnMap = { name?: string; phone?: string; email?: string; tags?: string }

interface ContactImportModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  tenantId?: string
  userId: string
  onImported?: () => void
}

function normalizePhoneBr(input: string): { value: string | null; error?: string } {
  const digits = (input || '').replace(/\D/g, '')
  if (!digits) return { value: null, error: 'Telefone vazio' }
  // Accept 11 digits (DDD + 9) -> prefix 55
  if (digits.length === 11) {
    return { value: `55${digits}` }
  }
  // Accept 13 digits starting with 55
  if (digits.length === 13 && digits.startsWith('55')) {
    return { value: digits }
  }
  return { value: null, error: 'Formato inválido (use (11) 99999-9999 ou 11999999999)' }
}

function guessColumnMap(headers: string[]): ColumnMap {
  const lower = headers.map(h => h.toLowerCase())
  const find = (...candidates: string[]) => {
    const idx = lower.findIndex(h => candidates.some(c => h.includes(c)))
    return idx >= 0 ? headers[idx] : undefined
  }
  return {
    name: find('nome', 'name'),
    phone: find('telefone', 'phone', 'celular', 'whatsapp'),
    email: find('email', 'e-mail'),
    tags: find('tags', 'tag')
  }
}

export const ContactImportModal: React.FC<ContactImportModalProps> = ({ open, onOpenChange, tenantId, userId, onImported }) => {
  const { toast } = useToast()
  const [file, setFile] = useState<File | null>(null)
  const [headers, setHeaders] = useState<string[]>([])
  const [map, setMap] = useState<ColumnMap>({})
  const [rows, setRows] = useState<ContactRow[]>([])
  const [importing, setImporting] = useState(false)
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    if (!open) {
      setFile(null)
      setHeaders([])
      setMap({})
      setRows([])
      setImporting(false)
      setProgress(0)
    }
  }, [open])

  const handleSelectFile = (f: File) => {
    if (!f) return
    if (f.size > 5 * 1024 * 1024) {
      toast({ title: 'Arquivo muito grande', description: 'Limite de 5MB', variant: 'destructive' })
      return
    }
    setFile(f)
    parseFile(f)
  }

  const onDrop = (e: React.DragEvent<HTMLDivElement>) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) handleSelectFile(f) }
  const onDragOver = (e: React.DragEvent<HTMLDivElement>) => e.preventDefault()

  const parseFile = async (f: File) => {
    try {
      const isCsv = f.name.toLowerCase().endsWith('.csv')
      const isXlsx = f.name.toLowerCase().endsWith('.xlsx') || f.name.toLowerCase().endsWith('.xls')
      if (!isCsv && !isXlsx) {
        toast({ title: 'Formato não suportado', description: 'Use CSV ou Excel', variant: 'destructive' })
        return
      }
      let data: any[] = []
      if (isCsv) {
        const text = await f.text()
        const result = Papa.parse(text, { header: true, skipEmptyLines: true })
        if (result.errors?.length) {
          toast({ title: 'Erro ao ler CSV', description: result.errors[0]?.message, variant: 'destructive' })
        }
        data = (result.data || []).filter(Boolean)
      } else {
        const buf = await f.arrayBuffer()
        const wb = XLSX.read(buf, { type: 'array' })
        const sheetName = wb.SheetNames[0]
        const sheet = wb.Sheets[sheetName]
        data = XLSX.utils.sheet_to_json(sheet, { defval: '' }) as any[]
      }

      // Limite de linhas
      if (data.length > 250) {
        toast({
          title: 'Arquivo grande demais',
          description: `O arquivo possui ${data.length} linhas. Apenas as primeiras 250 serão consideradas.`,
        })
        data = data.slice(0, 250)
      }
      const hdrs = Object.keys(data[0] || {})
      setHeaders(hdrs)
      const guessed = guessColumnMap(hdrs)
      setMap(guessed)
      const parsed: ContactRow[] = data.map((row: any) => {
        const name = row[guessed.name || 'name'] || ''
        const phoneRaw = row[guessed.phone || 'phone'] || ''
        const email = row[guessed.email || 'email'] || ''
        const tagsRaw = row[guessed.tags || 'tags'] || ''
        const norm = normalizePhoneBr(String(phoneRaw))
        return { name: String(name || '').trim(), phone: norm.value || '', email: String(email || '').trim() || undefined, tags: String(tagsRaw || '').split(',').map(t => t.trim()).filter(Boolean), valid: Boolean(norm.value), error: norm.error }
      })
      setRows(parsed)
    } catch (err: any) {
      console.error('Erro ao parsear arquivo:', err)
      toast({ title: 'Erro ao processar', description: err.message || 'Falha ao ler arquivo', variant: 'destructive' })
    }
  }

  const validCount = useMemo(() => rows.filter(r => r.valid).length, [rows])
  const invalidCount = useMemo(() => rows.filter(r => !r.valid).length, [rows])

  const updateCell = (index: number, key: keyof ContactRow, value: any) => {
    setRows(prev => { const next = [...prev]; const r = { ...next[index], [key]: value }; if (key === 'phone') { const n = normalizePhoneBr(String(value)); r.phone = n.value || ''; r.valid = Boolean(n.value); r.error = n.error } next[index] = r; return next })
  }

  const handleImport = useCallback(async () => {
    try {
      if (!rows.length) {
        toast({ title: 'Nada para importar', description: 'Selecione um arquivo primeiro', variant: 'destructive' })
        return
      }
      setImporting(true)
      setProgress(0)
      // Estatísticas base
      const totalProcessed = rows.length
      const validRows = rows.filter(r => r.valid)
      // Deduplicação intra-arquivo (mantém primeira ocorrência)
      const seen = new Set<string>()
      const deduped: ContactRow[] = []
      let intraDupIgnored = 0
      for (const r of validRows) {
        if (seen.has(r.phone)) {
          intraDupIgnored++
          continue
        }
        seen.add(r.phone)
        deduped.push(r)
      }
      let existingPhones: string[] = []
      if (tenantId) {
        const { data } = await supabase.from('contacts').select('phone_number').eq('tenant_id', tenantId)
        existingPhones = (data || []).map((d: any) => String(d.phone_number))
      } else {
        const { data } = await supabase.from('contacts').select('phone_number').eq('user_id', userId)
        existingPhones = (data || []).map((d: any) => String(d.phone_number))
      }
      const toInsertRows = deduped.filter(r => !existingPhones.includes(r.phone))
      const duplicatesInDb = deduped.length - toInsertRows.length
      const toInsert = toInsertRows.map(r => ({
        user_id: userId,
        tenant_id: tenantId || null,
        phone_number: r.phone,
        name: r.name || r.phone,
        profile_pic_url: null,
        is_group: false,
        tags: r.tags || [],
        // Removido email do insert para compatibilidade com schema atual
        created_at: new Date().toISOString(),
      }))

      const chunkSize = 100
      for (let i = 0; i < toInsert.length; i += chunkSize) {
        const chunk = toInsert.slice(i, i + chunkSize)
        const { error } = await supabase.from('contacts').insert(chunk)
        if (error) throw error
        setProgress(Math.round(((i + chunk.length) / Math.max(1, toInsert.length)) * 100))
      }

      toast({
        title: 'Importação concluída',
        description: `Processado: ${totalProcessed} • Válidos: ${validRows.length} • Duplicatas no arquivo: ${intraDupIgnored} • Já existentes: ${duplicatesInDb} • Inseridos: ${toInsert.length}`,
      })
      onImported && onImported()
      onOpenChange(false)
    } catch (err: any) {
      console.error('Erro ao importar contatos:', err)
      toast({ title: 'Erro na importação', description: err.message || 'Falha ao importar', variant: 'destructive' })
    } finally {
      setImporting(false)
    }
  }, [rows, tenantId, userId, onImported, onOpenChange, toast])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Importar Contatos</DialogTitle>
          <DialogDescription>Selecione um arquivo CSV ou Excel e ajuste o mapeamento de colunas.</DialogDescription>
        </DialogHeader>

        <div onDrop={onDrop} onDragOver={onDragOver} className="border border-dashed rounded-md p-4 mb-3 text-center cursor-pointer hover:bg-muted" onClick={() => (document.getElementById('contact-file-input') as HTMLInputElement)?.click()}>
          <p className="text-sm">Arraste e solte o arquivo aqui ou clique para selecionar</p>
          <Input id="contact-file-input" type="file" accept=".csv,.xls,.xlsx" className="hidden" onChange={e => e.target.files?.[0] && handleSelectFile(e.target.files[0])} />
        </div>

        {headers.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
            {(['name','phone','email','tags'] as (keyof ColumnMap)[]).map(key => (
              <div key={key} className="space-y-1">
                <span className="text-xs capitalize">{key}</span>
                <select className="w-full border rounded h-9 px-2" value={(map[key] as string) || ''} onChange={e => setMap(prev => ({ ...prev, [key]: e.target.value || undefined }))}>
                  <option value="">Não mapear</option>
                  {headers.map(h => (<option key={h} value={h}>{h}</option>))}
                </select>
              </div>
            ))}
          </div>
        )}

        {rows.length > 0 && (
          <div className="mb-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm">Válidos: {validCount} • Inválidos: {invalidCount}</p>
              {importing && <div className="w-48"><Progress value={progress} /></div>}
            </div>
            <div className="max-h-64 overflow-auto border rounded">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-muted">
                  <tr>
                    <th className="p-2 text-left">Nome</th>
                    <th className="p-2 text-left">Telefone</th>
                    <th className="p-2 text-left">Email</th>
                    <th className="p-2 text-left">Tags</th>
                    <th className="p-2 text-left">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={i} className={r.valid ? '' : 'bg-red-50'}>
                      <td className="p-2"><Input value={r.name} onChange={e => updateCell(i, 'name', e.target.value)} /></td>
                      <td className="p-2"><Input value={r.phone} onChange={e => updateCell(i, 'phone', e.target.value)} placeholder="55DDDNúmero" /></td>
                      <td className="p-2"><Input value={r.email || ''} onChange={e => updateCell(i, 'email', e.target.value)} /></td>
                      <td className="p-2"><Input value={(r.tags || []).join(', ')} onChange={e => updateCell(i, 'tags', e.target.value.split(',').map(t => t.trim()))} /></td>
                      <td className="p-2">{r.valid ? 'OK' : (r.error || 'Inválido')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={importing}>Cancelar</Button>
          <Button onClick={handleImport} disabled={importing || validCount === 0}>
            {importing ? 'Importando...' : 'Confirmar Importação'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default ContactImportModal
