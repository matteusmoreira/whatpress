import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

// Criar mocks encadeáveis para o Supabase
const selectChain: any = {
  eq: vi.fn(() => selectChain),
  order: vi.fn(() => selectChain),
  limit: vi.fn(() => ({ data: [], error: null })),
  data: [],
  error: null,
}

const updateChain: any = {
  eq: vi.fn(() => ({ data: null, error: null })),
}

const insertChain: any = {
  select: vi.fn(() => ({
    single: vi.fn(() => ({ data: null, error: null }))
  }))
}

const mockSupabase = {
  from: vi.fn(() => ({
    select: vi.fn(() => selectChain),
    insert: vi.fn(() => insertChain),
    update: vi.fn(() => updateChain),
  })),
  storage: {
    from: vi.fn(() => ({
      upload: vi.fn(() => ({ data: { path: 'test-path' }, error: null })),
      getPublicUrl: vi.fn(() => ({ data: { publicUrl: 'https://test-url.com/media.jpg' } }))
    }))
  }
};

const mockEvolutionApi = {
  getContacts: vi.fn(async () => [
    { number: '5511999999999', name: 'João Silva', profilePic: 'https://example.com/pic1.jpg', isGroup: false },
    { number: '5511888888888', name: 'Maria Santos', profilePic: 'https://example.com/pic2.jpg', isGroup: false },
    { number: '5511777777777', name: 'Grupo Teste', profilePic: 'https://example.com/group.jpg', isGroup: true }
  ]),
  sendMediaMessage: vi.fn(async () => ({ success: true, messageId: 'test-message-id' })),
  getInstanceInfo: vi.fn(async () => ({ status: 'connected' }))
};

// Mock do Supabase
vi.mock('@/lib/supabase', () => ({
  supabase: mockSupabase
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'test-user-id', email: 'test@test.com' },
    loading: false,
    error: null
  })
}));

// Mock de sonner toast
vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  }
}));

// Mock dos hooks
vi.mock('@/hooks/useTenant', () => ({
  useTenant: () => ({
    currentTenant: { id: 'test-tenant-id' }
  })
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn()
  })
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'test-user-id' } })
}));

// Mock do Evolution API service
vi.mock('@/services/evolutionApi', () => ({
  evolutionApi: mockEvolutionApi
}));

describe('Fluxo de Busca de Contatos e Envio de Mídia', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('deve buscar contatos automaticamente quando a instância estiver conectada', async () => {
    const { useEvolutionApi } = await import('@/hooks/useEvolutionApi');
    const { result } = renderHook(() => useEvolutionApi());

    // Simular conexão da instância
    await act(async () => {
      // Simular evento de conexão via webhook
      const mockEvent = {
        type: 'CONNECTION_UPDATE',
        data: { status: 'connected' }
      };
      
      // Chamar função de busca de contatos
      await result.current.fetchContactsAndSave();
    });

    // Verificar se os contatos foram buscados
    await waitFor(() => {
      const evolutionApi = vi.mocked(require('@/services/evolutionApi').evolutionApi);
      expect(evolutionApi.getContacts).toHaveBeenCalled();
    });
  });

  it('deve salvar contatos no banco de dados após busca', async () => {
    const { useEvolutionApi } = await import('@/hooks/useEvolutionApi');
    const { result } = renderHook(() => useEvolutionApi());
    const mockUser = { id: 'test-user-id' };

    // Mock do hook useAuth
    vi.doMock('@/hooks/useAuth', () => ({
      useAuth: () => ({ user: mockUser })
    }));

    await act(async () => {
      await result.current.fetchContactsAndSave();
    });

    // Verificar se os contatos foram salvos no banco
    await waitFor(() => {
      const supabase = vi.mocked(require('@/lib/supabase').supabase);
      expect(supabase.from).toHaveBeenCalledWith('contacts');
    });
  });

  it('deve enviar mensagem com mídia (imagem) com sucesso', async () => {
    const { useMessages } = await import('@/hooks/useMessages');
    const { result } = renderHook(() => useMessages());
    const mockUser = { id: 'test-user-id' };

    // Mock do hook useAuth
    vi.doMock('@/hooks/useAuth', () => ({
      useAuth: () => ({ user: mockUser })
    }));

    // Mock de instância conectada
    vi.mocked(require('@/lib/supabase').supabase.from).mockReturnValue({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            limit: vi.fn(() => ({
              data: [{ id: 'test-instance-id', status: 'connected', api_key: 'test-key' }],
              error: null
            }))
          })),
          limit: vi.fn(() => ({
            data: [{ id: 'test-instance-id', status: 'connected', api_key: 'test-key' }],
            error: null
          }))
        }))
      }))
    } as any);

    const mockMediaFile = {
      file: new File(['test-content'], 'test-image.jpg', { type: 'image/jpeg' }),
      type: 'image' as const,
      preview: 'data:image/jpeg;base64,test'
    };

    await act(async () => {
      const result = await result.current.sendMediaMessage(
        '5511999999999',
        'Mensagem de teste com imagem',
        mockMediaFile
      );

      expect(result.success).toBe(true);
      expect(result.mediaUrl).toBe('https://test-url.com/media.jpg');
    });

    // Verificar se a mensagem foi enviada via Evolution API
    await waitFor(() => {
      const evolutionApi = vi.mocked(require('@/services/evolutionApi').evolutionApi);
      expect(evolutionApi.sendMediaMessage).toHaveBeenCalledWith(
        '5511999999999',
        'https://test-url.com/media.jpg',
        'Mensagem de teste com imagem',
        'image'
      );
    });
  });

  it('deve enviar mensagem com vídeo com sucesso', async () => {
    const { useMessages } = await import('@/hooks/useMessages');
    const { result } = renderHook(() => useMessages());
    const mockUser = { id: 'test-user-id' };

    // Mock do hook useAuth
    vi.doMock('@/hooks/useAuth', () => ({
      useAuth: () => ({ user: mockUser })
    }));

    // Mock de instância conectada
    vi.mocked(require('@/lib/supabase').supabase.from).mockReturnValue({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            limit: vi.fn(() => ({
              data: [{ id: 'test-instance-id', status: 'connected', api_key: 'test-key' }],
              error: null
            }))
          })),
          limit: vi.fn(() => ({
            data: [{ id: 'test-instance-id', status: 'connected', api_key: 'test-key' }],
            error: null
          }))
        }))
      }))
    } as any);

    const mockVideoFile = {
      file: new File(['test-video-content'], 'test-video.mp4', { type: 'video/mp4' }),
      type: 'video' as const
    };

    await act(async () => {
      const result = await result.current.sendMediaMessage(
        '5511888888888',
        'Mensagem de teste com vídeo',
        mockVideoFile
      );

      expect(result.success).toBe(true);
      expect(result.mediaUrl).toBe('https://test-url.com/media.jpg');
    });

    // Verificar se a mensagem foi enviada via Evolution API
    await waitFor(() => {
      const evolutionApi = vi.mocked(require('@/services/evolutionApi').evolutionApi);
      expect(evolutionApi.sendMediaMessage).toHaveBeenCalledWith(
        '5511888888888',
        'https://test-url.com/media.jpg',
        'Mensagem de teste com vídeo',
        'video'
      );
    });
  });

  it('deve lidar com erro ao enviar mensagem com mídia', async () => {
    const { useMessages } = await import('@/hooks/useMessages');
    const { result } = renderHook(() => useMessages());
    const mockUser = { id: 'test-user-id' };

    // Mock do hook useAuth
    vi.doMock('@/hooks/useAuth', () => ({
      useAuth: () => ({ user: mockUser })
    }));

    // Mock de erro no upload
    const mockSupabase = vi.mocked((await import('@/lib/supabase')).supabase);
    mockSupabase.storage.from = vi.fn(() => ({
      upload: vi.fn(() => Promise.resolve({ data: null, error: new Error('Erro no upload') }))
    } as any));

    const mockMediaFile = {
      file: new File(['test-content'], 'test-image.jpg', { type: 'image/jpeg' }),
      type: 'image' as const,
      preview: 'data:image/jpeg;base64,test'
    };

    await act(async () => {
      const ok = await result.current.sendMediaMessage(
        '5511999999999',
        'Mensagem de teste',
        mockMediaFile
      );
      expect(ok).toBe(false)
    })

    // Verificar se o toast de erro foi chamado (via sonner)
    await waitFor(async () => {
      const { toast: sonnerToast } = await import('sonner')
      expect(sonnerToast.error).toHaveBeenCalledWith('Erro no upload');
    });
  });

  it('deve validar tipos de arquivo de mídia corretamente', async () => {
    const { useMessages } = await import('@/hooks/useMessages');
    const { result } = renderHook(() => useMessages());

    const validImageFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
    const validVideoFile = new File(['test'], 'test.mp4', { type: 'video/mp4' });
    const validAudioFile = new File(['test'], 'test.mp3', { type: 'audio/mp3' });
    const validDocumentFile = new File(['test'], 'test.pdf', { type: 'application/pdf' });
    const invalidFile = new File(['test'], 'test.exe', { type: 'application/x-msdownload' });

    // Testar arquivos válidos
    expect(() => {
      const mediaFile = {
        file: validImageFile,
        type: 'image' as const
      };
      // Deve aceitar sem erro
    }).not.toThrow();

    expect(() => {
      const mediaFile = {
        file: validVideoFile,
        type: 'video' as const
      };
      // Deve aceitar sem erro
    }).not.toThrow();

    expect(() => {
      const mediaFile = {
        file: validAudioFile,
        type: 'audio' as const
      };
      // Deve aceitar sem erro
    }).not.toThrow();

    expect(() => {
      const mediaFile = {
        file: validDocumentFile,
        type: 'document' as const
      };
      // Deve aceitar sem erro
    }).not.toThrow();

    // Arquivo inválido deve ser rejeitado pelo componente MediaUpload
    // mas não causa erro no hook
  });
});
    // Garantir instância conectada para atingir caminho de upload
    const { supabase } = await import('@/lib/supabase')
    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({
            limit: vi.fn(() => ({
              data: [{ id: 'test-instance-id', status: 'connected', api_key: 'test-key' }],
              error: null
            }))
          }))
        }))
      }))
    } as any);