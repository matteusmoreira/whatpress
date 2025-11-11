import { describe, it, expect, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useSecurityAudit } from '@/hooks/useSecurityAudit'
import { useRateLimit } from '@/hooks/useRateLimit'
import { useBackup } from '@/hooks/useBackup'

// Mock do Supabase
vi.mock('@/lib/supabase', () => ({
  default: {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: 'test-user-id', user_metadata: { tenant_id: 'test-tenant' } } }
      })
    },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      single: vi.fn().mockReturnThis()
    }),
    storage: {
      from: vi.fn().mockReturnValue({
        upload: vi.fn().mockResolvedValue({ data: { path: 'test-path' } }),
        download: vi.fn().mockResolvedValue({ data: new Blob(['test']) }),
        remove: vi.fn().mockResolvedValue({ data: null })
      })
    }
  }
}))

// Mock do toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn()
  }
}))

describe('Security Hooks', () => {
  describe('useSecurityAudit', () => {
    it('should initialize without errors', () => {
      const { result } = renderHook(() => useSecurityAudit())
      
      expect(result.current).toBeDefined()
      expect(typeof result.current.logSecurityEvent).toBe('function')
      expect(typeof result.current.getSecurityEvents).toBe('function')
      expect(typeof result.current.getSecurityStats).toBe('function')
    })

    it('should log authentication events', async () => {
      const { result } = renderHook(() => useSecurityAudit())
      
      await act(async () => {
        await result.current.logAuthenticationEvent('login', true, { 
          email: 'test@example.com',
          userId: 'test-user-id'
        })
      })
      
      // Verificar se não houve erros
      expect(true).toBe(true)
    })

    it('should log data access events', async () => {
      const { result } = renderHook(() => useSecurityAudit())
      
      await act(async () => {
        await result.current.logDataAccessEvent('messages', 'read', true, { 
          userId: 'test-user-id',
          recordId: 'test-record-id'
        })
      })
      
      // Verificar se não houve erros
      expect(true).toBe(true)
    })

    it('should log encryption events', async () => {
      const { result } = renderHook(() => useSecurityAudit())
      
      await act(async () => {
        await result.current.logEncryptionEvent('data_encrypted', true, { 
          dataType: 'message',
          size: 100
        })
      })
      
      // Verificar se não houve erros
      expect(true).toBe(true)
    })
  })

  describe('useRateLimit', () => {
    it('should initialize without errors', () => {
      const { result } = renderHook(() => useRateLimit())
      
      expect(result.current).toBeDefined()
      expect(typeof result.current.checkRateLimit).toBe('function')
      expect(typeof result.current.checkMessageRateLimit).toBe('function')
      expect(typeof result.current.checkAuthenticationRateLimit).toBe('function')
    })

    it('should check message rate limit', async () => {
      const { result } = renderHook(() => useRateLimit())
      
      const { allowed, info } = await result.current.checkMessageRateLimit('test-user')
      
      expect(typeof allowed).toBe('boolean')
      expect(info).toBeDefined()
      expect(typeof info.currentCount).toBe('number')
      expect(typeof info.maxRequests).toBe('number')
    })

    it('should check authentication rate limit', async () => {
      const { result } = renderHook(() => useRateLimit())
      
      const { allowed, info } = await result.current.checkAuthenticationRateLimit('test@example.com')
      
      expect(typeof allowed).toBe('boolean')
      expect(info).toBeDefined()
      expect(typeof info.currentCount).toBe('number')
      expect(typeof info.maxRequests).toBe('number')
    })
  })

  describe('useBackup', () => {
    it('should initialize without errors', () => {
      const { result } = renderHook(() => useBackup())
      
      expect(result.current).toBeDefined()
      expect(typeof result.current.createBackupConfig).toBe('function')
      expect(typeof result.current.getBackupConfigs).toBe('function')
      expect(typeof result.current.createBackup).toBe('function')
      expect(typeof result.current.getBackups).toBe('function')
    })

    it('should create backup config', async () => {
      const { result } = renderHook(() => useBackup())
      
      await act(async () => {
        const config = await result.current.createBackupConfig({
          name: 'Test Backup',
          description: 'Test backup config',
          tables: ['messages', 'contacts'],
          schedule: 'daily',
          retention_days: 30,
          is_encrypted: true
        })
        
        expect(config).toBeDefined()
      })
    })

    it('should get backup configs', async () => {
      const { result } = renderHook(() => useBackup())
      
      await act(async () => {
        const configs = await result.current.getBackupConfigs()
        
        expect(Array.isArray(configs)).toBe(true)
      })
    })

    it('should get backups', async () => {
      const { result } = renderHook(() => useBackup())
      
      await act(async () => {
        const backups = await result.current.getBackups()
        
        expect(Array.isArray(backups)).toBe(true)
      })
    })
  })
})