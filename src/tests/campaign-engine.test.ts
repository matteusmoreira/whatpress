import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCampaignEngine } from '@/hooks/useCampaignEngine';

// Mock do Supabase
vi.mock('@/lib/supabase', () => {
  // Helper para cadeia de métodos
  const selectChain = {
    eq: vi.fn(() => selectChain),
    lte: vi.fn(() => selectChain),
    order: vi.fn(() => selectChain),
    limit: vi.fn(() => ({ data: [], error: null })),
    data: [],
    error: null,
  } as any;

  const updateChain = {
    eq: vi.fn(() => updateChain)
  } as any;

  const deleteChain = {
    eq: vi.fn(() => ({ data: null, error: null }))
  } as any;

  const insertChain = {
    select: vi.fn(() => ({
      single: vi.fn(() => ({ data: null, error: null }))
    }))
  } as any;

  return {
    supabase: {
      from: vi.fn(() => ({
        select: vi.fn(() => selectChain),
        insert: vi.fn(() => insertChain),
        update: vi.fn(() => updateChain),
        delete: vi.fn(() => deleteChain),
      })),
      channel: vi.fn(() => ({
        on: vi.fn(() => ({ subscribe: vi.fn(() => ({ unsubscribe: vi.fn() })) })),
      })),
    }
  };
});

// Mock de sonner toast para evitar timers/animacao
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

vi.mock('@/hooks/useQuotas', () => ({
  useQuotas: () => ({
    canPerformAction: vi.fn(() => true),
    updateQuotaUsage: vi.fn(async () => {}),
    getUpgradeMessage: vi.fn(() => 'Upgrade necessário')
  })
}));

// Mock de MultiSession e RateLimit
vi.mock('@/hooks/useMultiSession', () => ({
  useMultiSession: () => ({
    instances: [
      { id: 'instance-1', name: 'inst-1', status: 'connected', health_status: 'healthy' },
      { id: 'instance-2', name: 'inst-2', status: 'connected', health_status: 'healthy' },
    ],
    selectBestInstance: vi.fn((exclude: string[] = []) => {
      const available = [
        { id: 'instance-1', name: 'inst-1', status: 'connected', health_status: 'healthy' },
        { id: 'instance-2', name: 'inst-2', status: 'connected', health_status: 'healthy' },
      ].filter(i => !exclude.includes(i.id));
      return available[0] || null;
    })
  })
}));

vi.mock('@/hooks/useRateLimit', () => ({
  useRateLimit: () => ({
    canSendMessage: vi.fn(() => true),
    recordMessageSent: vi.fn(),
    getNextAllowedTime: vi.fn(() => new Date(Date.now() + 1000)),
  })
}));

// Mock Evolution API service
vi.mock('@/services/evolutionApi', () => ({
  EvolutionApiService: vi.fn().mockImplementation(() => ({
    sendTextMessage: vi.fn(async () => Promise.resolve(true)),
  }))
}));

describe('useCampaignEngine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deve inicializar com estado vazio', () => {
    const { result } = renderHook(() => useCampaignEngine());

    expect(result.current.campaigns).toEqual([]);
    expect(result.current.metrics).toEqual({});
    expect(result.current.messageQueue).toEqual([]);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBe(null);
  });

  it('deve ter todas as funções necessárias', () => {
    const { result } = renderHook(() => useCampaignEngine());

    // Funções de gerenciamento de campanhas
    expect(typeof result.current.createCampaign).toBe('function');
    expect(typeof result.current.updateCampaign).toBe('function');
    expect(typeof result.current.deleteCampaign).toBe('function');

    // Funções de execução de campanhas
    expect(typeof result.current.startCampaign).toBe('function');
    expect(typeof result.current.pauseCampaign).toBe('function');
    expect(typeof result.current.resumeCampaign).toBe('function');
    expect(typeof result.current.stopCampaign).toBe('function');

    // Funções de gerenciamento de fila
    expect(typeof result.current.addToQueue).toBe('function');
    expect(typeof result.current.processQueue).toBe('function');
    expect(typeof result.current.retryFailedMessages).toBe('function');

    // Funções de envio de mensagens
    expect(typeof result.current.sendMessage).toBe('function');

    // Funções de tempo real
    expect(typeof result.current.subscribeToMetrics).toBe('function');
    expect(typeof result.current.refreshData).toBe('function');
  });

  it('deve criar uma campanha com dados válidos', async () => {
    const { result } = renderHook(() => useCampaignEngine());

    const campaignData = {
      name: 'Campanha Teste',
      description: 'Descrição da campanha teste',
      campaign_type: 'intelligent' as const,
      multi_session_enabled: true,
      randomization_enabled: true,
      rate_limit_per_minute: 10
    };

    await act(async () => {
      const campaign = await result.current.createCampaign(campaignData);
      expect(campaign).toBeDefined();
    });
  });

  it('deve iniciar uma campanha', async () => {
    const { result } = renderHook(() => useCampaignEngine());

    // adicionar campanha ao estado para evitar retorno precoce
    await act(async () => {
      result.current.updateCampaign('test-campaign-id', { id: 'test-campaign-id' } as any);
    });

    await act(async () => {
      const success = await result.current.startCampaign('test-campaign-id');
      expect(typeof success).toBe('boolean');
    });
  });

  it('deve pausar uma campanha', async () => {
    const { result } = renderHook(() => useCampaignEngine());

    await act(async () => {
      const success = await result.current.pauseCampaign('test-campaign-id');
      expect(typeof success).toBe('boolean');
    });
  });

  it('deve retomar uma campanha', async () => {
    const { result } = renderHook(() => useCampaignEngine());

    await act(async () => {
      const success = await result.current.resumeCampaign('test-campaign-id');
      expect(typeof success).toBe('boolean');
    });
  });

  it('deve parar uma campanha', async () => {
    const { result } = renderHook(() => useCampaignEngine());

    await act(async () => {
      const success = await result.current.stopCampaign('test-campaign-id');
      expect(typeof success).toBe('boolean');
    });
  });

  it('deve adicionar mensagens à fila', async () => {
    const { result } = renderHook(() => useCampaignEngine());

    const messages = [
      {
        whatsapp_instance_id: 'instance-1',
        contact_id: 'contact-1',
        message_content: { text: 'Olá!' },
        priority: 1,
        scheduled_at: new Date().toISOString()
      }
    ];

    await act(async () => {
      const success = await result.current.addToQueue('test-campaign-id', messages);
      expect(typeof success).toBe('boolean');
    });
  });

  it('deve processar a fila de mensagens', async () => {
    const { result } = renderHook(() => useCampaignEngine());

    await act(async () => {
      const success = await result.current.processQueue('test-campaign-id');
      expect(typeof success).toBe('boolean');
    });
  });

  it('deve reenviar mensagens falhadas', async () => {
    const { result } = renderHook(() => useCampaignEngine());

    await act(async () => {
      const success = await result.current.retryFailedMessages('test-campaign-id');
      expect(typeof success).toBe('boolean');
    });
  });

  it('deve enviar mensagem individual', async () => {
    const { result } = renderHook(() => useCampaignEngine());

    await act(async () => {
      const success = await result.current.sendMessage(
        'instance-1',
        'contact-1',
        'Mensagem teste',
        'campaign-1'
      );
      expect(typeof success).toBe('boolean');
    });
  });
});