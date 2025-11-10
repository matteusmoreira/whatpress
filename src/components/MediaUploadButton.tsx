import { useState, useCallback, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Progress } from '@/components/ui/progress'
import { Paperclip, Image as Img, FileText, Mic, Video as Vid, X, Loader2 } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { supabase } from '@/lib/supabase'
import type { WhatsAppInstance } from '@/services/whatsappInstanceService'

type MediaType = 'image' | 'document' | 'audio' | 'video'

interface Props {
  contactNumber: string
  instance: WhatsAppInstance | null
  sendMedia: (
    targetInstance: WhatsAppInstance,
    toNumber: string,
    mediaUrl: string,
    caption?: string,
    type?: MediaType
  ) => Promise<{ success: boolean }>
  disabled?: boolean
}

export function MediaUploadButton({ contactNumber, instance, sendMedia, disabled = false }: Props) {
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [type, setType] = useState<MediaType | null>(null)
  const [caption, setCaption] = useState('')
  const [preview, setPreview] = useState<string | undefined>()
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const maxBytes = 16 * 1024 * 1024
  const detectType = (mime: string): MediaType | null =>
    mime.startsWith('image/') ? 'image'
    : mime === 'video/mp4' ? 'video'
    : mime === 'audio/mpeg' ? 'audio'
    : (mime.includes('pdf') || mime.includes('msword') || mime.includes('officedocument')) ? 'document'
    : null

  const handleSelectFile = useCallback((f: File) => {
    setErrorMsg(null)
    if (f.size > maxBytes) { setErrorMsg('Arquivo excede 16MB.'); return }
    const t = detectType(f.type)
    if (!t) { setErrorMsg('Tipo não suportado.'); return }
    setFile(f); setType(t)
    if (t === 'image') { const r = new FileReader(); r.onload = e => setPreview(e.target?.result as string); r.readAsDataURL(f) } else { setPreview(undefined) }
  }, [])

  const reset = () => { setFile(null); setType(null); setCaption(''); setPreview(undefined); setProgress(0); setUploading(false); setErrorMsg(null) }

  const iconEl = type === 'image' ? <Img className="h-4 w-4" />
    : type === 'document' ? <FileText className="h-4 w-4" />
    : type === 'audio' ? <Mic className="h-4 w-4" />
    : type === 'video' ? <Vid className="h-4 w-4" /> : <Paperclip className="h-4 w-4" />

  const handleSend = useCallback(async () => {
    setErrorMsg(null)
    setUploading(true); setProgress(0)
    if (!instance) { setErrorMsg('Nenhuma instância conectada.'); setUploading(false); return }
    if (!file || !type) { setErrorMsg('Selecione um arquivo válido.'); setUploading(false); return }
    try {
      const { data: auth } = await supabase.auth.getUser(); const userId = auth.user?.id
      if (!userId) throw new Error('Usuário não autenticado')
      const filePath = `media/${userId}/${Date.now()}_${file.name}`
      const { error: uploadError } = await supabase.storage.from('whatsapp-media').upload(filePath, file, {
        upsert: false,
        onUploadProgress: (evt: ProgressEvent) => { if (!evt.lengthComputable) return; setProgress((evt.loaded / evt.total) * 100) }
      } as unknown as Record<string, unknown>)
      if (uploadError) throw uploadError
      const { data: pub } = supabase.storage.from('whatsapp-media').getPublicUrl(filePath)
      const url = pub?.publicUrl; if (!url) throw new Error('Falha ao obter URL pública')
      const ok = await sendMedia(instance, contactNumber, url, caption || undefined, type)
      if (ok?.success) { toast({ title: 'Mídia enviada' }); setOpen(false); reset() } else { setErrorMsg('Falha ao enviar mídia.') }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erro desconhecido'
      setErrorMsg(msg); toast({ title: 'Erro ao enviar mídia', description: msg, variant: 'destructive' })
    } finally { setUploading(false) }
  }, [instance, file, type, caption, contactNumber, sendMedia, toast])

  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => { setOpen(true); setErrorMsg(null) }} disabled={disabled} data-testid="open-media-upload" title={!instance ? 'Nenhuma instância conectada' : undefined}>
        <Paperclip className="w-4 h-4" />
      </Button>
      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset() }}>
        <DialogContent className="max-w-lg" data-testid="media-dialog">
          <DialogHeader><DialogTitle>Enviar Mídia</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <input
                ref={inputRef}
                type="file"
                className="block w-full text-sm"
                accept="image/jpeg,image/png,image/gif,video/mp4,audio/mpeg,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                data-testid="media-file-input"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleSelectFile(f) }}
                disabled={disabled}
              />
              {file && (
                <div className="flex items-center justify-between p-3 rounded-md bg-muted">
                  <div className="flex items-center gap-2">{iconEl}<p className="text-sm font-medium">{file.name}</p></div>
                  <Button variant="ghost" size="sm" onClick={reset} disabled={uploading}><X className="h-4 w-4" /></Button>
                </div>
              )}
              {preview && (<img src={preview} alt="Preview" className="max-w-full h-32 object-cover rounded-md" />)}
              {uploading && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm"><span>Enviando...</span><span>{Math.round(progress)}%</span></div>
                  <Progress value={progress} className="h-2" />
                </div>
              )}
              {errorMsg && (<p className="text-sm text-destructive">{errorMsg}</p>)}
            </div>
            <Input value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Legenda (opcional)" disabled={uploading} />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setOpen(false)} disabled={uploading}>Cancelar</Button>
              <Button onClick={handleSend} disabled={uploading || !file || !type || disabled} data-testid="send-media">{uploading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}Enviar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}