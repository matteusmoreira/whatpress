import { useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { MediaUploadButton } from '@/components/MediaUploadButton'
import type { WhatsAppInstance } from '@/services/whatsappInstanceService'
import { supabase } from '@/lib/supabase'

export default function DevMediaUploadPage() {
  useEffect(() => {
    const originalGetUser = supabase.auth.getUser
    const originalFrom = supabase.storage.from

    // Mock de auth para E2E
    ;(supabase.auth as any).getUser = async () => ({ data: { user: { id: 'e2e-user' } } })

    // Mock de Storage para simular upload e URL pública
    ;(supabase.storage as any).from = (bucket: string) => {
      return {
        upload: async (_path: string, _file: File, opts?: any) => {
          // Simula progresso
          if (opts?.onUploadProgress) {
            for (let p = 0; p <= 100; p += 25) {
              opts.onUploadProgress({ lengthComputable: true, loaded: p, total: 100 })
              await new Promise(r => setTimeout(r, 50))
            }
          }
          return { error: null }
        },
        getPublicUrl: (_path: string) => ({ data: { publicUrl: `https://example.com/${bucket}/mock-file` } })
      }
    }

    return () => {
      ;(supabase.auth as any).getUser = originalGetUser
      ;(supabase.storage as any).from = originalFrom
    }
  }, [])

  const dummyInstance: WhatsAppInstance = {
    id: 'inst-e2e',
    user_id: 'e2e-user',
    name: 'E2E',
    status: 'connected',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }

  const sendMedia = async () => {
    await new Promise(r => setTimeout(r, 200))
    return { success: true }
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <Card className="max-w-xl mx-auto">
        <CardHeader>
          <CardTitle>Dev: Teste de Upload de Mídia</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Abrir modal e testar envio</span>
            <MediaUploadButton
              contactNumber="5599999999999"
              instance={dummyInstance}
              sendMedia={sendMedia as any}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}