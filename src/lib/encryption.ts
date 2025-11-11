import { createClient } from '@supabase/supabase-js'

export interface EncryptionConfig {
  algorithm: string
  keyLength: number
  ivLength: number
  saltLength: number
  iterations: number
}

export interface EncryptedData {
  encrypted: string
  iv: string
  salt: string
  algorithm: string
  iterations: number
}

export interface EncryptionKey {
  id: string
  key: CryptoKey
  created_at: Date
  expires_at?: Date
  is_active: boolean
}

class EncryptionService {
  private config: EncryptionConfig = {
    algorithm: 'AES-GCM',
    keyLength: 256,
    ivLength: 12,
    saltLength: 16,
    iterations: 100000
  }

  private keys: Map<string, EncryptionKey> = new Map()
  private masterKey: CryptoKey | null = null

  constructor() {
    this.initializeMasterKey()
  }

  isEnabled(): boolean {
    return this.masterKey !== null
  }

  private async initializeMasterKey(): Promise<void> {
    try {
      const masterKeyData = process.env.VITE_MASTER_ENCRYPTION_KEY
      if (!masterKeyData) {
        console.warn('Chave mestra de criptografia não configurada')
        return
      }

      const keyData = new Uint8Array(masterKeyData.split(',').map(Number))
      this.masterKey = await crypto.subtle.importKey(
        'raw',
        keyData,
        { name: 'PBKDF2' },
        false,
        ['deriveKey']
      )
    } catch (error) {
      console.error('Erro ao inicializar chave mestra:', error)
    }
  }

  async generateKey(userId: string, tenantId: string): Promise<EncryptionKey> {
    try {
      const salt = crypto.getRandomValues(new Uint8Array(this.config.saltLength))
      const keyId = this.generateKeyId(userId, tenantId)

      if (!this.masterKey) {
        throw new Error('Chave mestra não inicializada')
      }

      const key = await crypto.subtle.deriveKey(
        {
          name: 'PBKDF2',
          salt: salt,
          iterations: this.config.iterations,
          hash: 'SHA-256'
        },
        this.masterKey,
        {
          name: this.config.algorithm,
          length: this.config.keyLength
        },
        false,
        ['encrypt', 'decrypt']
      )

      const encryptionKey: EncryptionKey = {
        id: keyId,
        key: key,
        created_at: new Date(),
        expires_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 dias
        is_active: true
      }

      this.keys.set(keyId, encryptionKey)
      return encryptionKey
    } catch (error) {
      console.error('Erro ao gerar chave de criptografia:', error)
      throw new Error('Falha ao gerar chave de criptografia')
    }
  }

  async encryptData(data: any, userId: string, tenantId: string): Promise<EncryptedData> {
    try {
      const keyId = this.generateKeyId(userId, tenantId)
      let encryptionKey = this.keys.get(keyId)

      if (!encryptionKey || this.isKeyExpired(encryptionKey)) {
        encryptionKey = await this.generateKey(userId, tenantId)
      }

      const iv = crypto.getRandomValues(new Uint8Array(this.config.ivLength))
      const dataToEncrypt = new TextEncoder().encode(JSON.stringify(data))

      const encrypted = await crypto.subtle.encrypt(
        {
          name: this.config.algorithm,
          iv: iv
        },
        encryptionKey.key,
        dataToEncrypt
      )

      return {
        encrypted: this.arrayBufferToBase64(encrypted),
        iv: this.arrayBufferToBase64(iv),
        salt: this.generateSalt(userId, tenantId),
        algorithm: this.config.algorithm,
        iterations: this.config.iterations
      }
    } catch (error) {
      console.error('Erro ao criptografar dados:', error)
      throw new Error('Falha ao criptografar dados')
    }
  }

  async decryptData(encryptedData: EncryptedData, userId: string, tenantId: string): Promise<any> {
    try {
      const keyId = this.generateKeyId(userId, tenantId)
      let encryptionKey = this.keys.get(keyId)

      if (!encryptionKey || this.isKeyExpired(encryptionKey)) {
        encryptionKey = await this.generateKey(userId, tenantId)
      }

      const encryptedBuffer = this.base64ToArrayBuffer(encryptedData.encrypted)
      const iv = this.base64ToArrayBuffer(encryptedData.iv)

      const decrypted = await crypto.subtle.decrypt(
        {
          name: encryptedData.algorithm,
          iv: iv
        },
        encryptionKey.key,
        encryptedBuffer
      )

      const decryptedText = new TextDecoder().decode(decrypted)
      return JSON.parse(decryptedText)
    } catch (error) {
      console.error('Erro ao descriptografar dados:', error)
      throw new Error('Falha ao descriptografar dados')
    }
  }

  async encryptField(data: string, userId: string, tenantId: string): Promise<string> {
    const encryptedData = await this.encryptData(data, userId, tenantId)
    return JSON.stringify(encryptedData)
  }

  async decryptField(encryptedField: string, userId: string, tenantId: string): Promise<string> {
    try {
      const encryptedData: EncryptedData = JSON.parse(encryptedField)
      return await this.decryptData(encryptedData, userId, tenantId)
    } catch (error) {
      console.error('Erro ao descriptografar campo:', error)
      throw new Error('Falha ao descriptografar campo')
    }
  }

  async rotateKey(userId: string, tenantId: string): Promise<EncryptionKey> {
    try {
      const keyId = this.generateKeyId(userId, tenantId)
      const oldKey = this.keys.get(keyId)

      if (oldKey) {
        oldKey.is_active = false
      }

      return await this.generateKey(userId, tenantId)
    } catch (error) {
      console.error('Erro ao rotacionar chave:', error)
      throw new Error('Falha ao rotacionar chave')
    }
  }

  private generateKeyId(userId: string, tenantId: string): string {
    return `key_${tenantId}_${userId}`
  }

  private generateSalt(userId: string, tenantId: string): string {
    const combined = `${tenantId}:${userId}:${Date.now()}`
    const encoder = new TextEncoder()
    const data = encoder.encode(combined)
    return this.arrayBufferToBase64(data.slice(0, this.config.saltLength))
  }

  private isKeyExpired(key: EncryptionKey): boolean {
    if (!key.expires_at) return false
    return new Date() > key.expires_at
  }

  private arrayBufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
    const bytes = new Uint8Array(buffer)
    let binary = ''
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i])
    }
    return btoa(binary)
  }

  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binaryString = atob(base64)
    const bytes = new Uint8Array(binaryString.length)
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i)
    }
    return bytes.buffer
  }

  async generateSecureToken(length: number = 32): Promise<string> {
    const array = new Uint8Array(length)
    crypto.getRandomValues(array)
    return this.arrayBufferToBase64(array)
  }

  async hashData(data: string, salt: string): Promise<string> {
    try {
      const encoder = new TextEncoder()
      const dataBuffer = encoder.encode(data + salt)
      const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer)
      return this.arrayBufferToBase64(hashBuffer)
    } catch (error) {
      console.error('Erro ao gerar hash:', error)
      throw new Error('Falha ao gerar hash')
    }
  }

  // Métodos de conformidade LGPD
  async anonymizeData(data: string): Promise<string> {
    return this.hashData(data, Date.now().toString())
  }

  async pseudonymizeData(data: string, key: string): Promise<string> {
    return this.hashData(data, key)
  }

  // Métodos para gestão de consentimento
  generateConsentId(): string {
    return `consent_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  validateConsentFormat(consentId: string): boolean {
    const consentRegex = /^consent_\d+_[a-z0-9]{9}$/
    return consentRegex.test(consentId)
  }

  // Métodos para auditoria
  async createAuditLog(
    userId: string,
    tenantId: string,
    action: string,
    resource: string,
    metadata?: Record<string, any>
  ): Promise<void> {
    try {
      const auditData = {
        user_id: userId,
        tenant_id: tenantId,
        action,
        resource,
        metadata: metadata ? await this.encryptData(metadata, userId, tenantId) : null,
        timestamp: new Date().toISOString(),
        ip_address: await this.getClientIP(),
        user_agent: navigator.userAgent
      }

      // Armazenar em localStorage para auditoria local
      const auditLogs = JSON.parse(localStorage.getItem('audit_logs') || '[]')
      auditLogs.push(auditData)
      
      // Manter apenas últimos 1000 logs
      if (auditLogs.length > 1000) {
        auditLogs.splice(0, auditLogs.length - 1000)
      }
      
      localStorage.setItem('audit_logs', JSON.stringify(auditLogs))
    } catch (error) {
      console.error('Erro ao criar log de auditoria:', error)
    }
  }

  private async getClientIP(): Promise<string> {
    try {
      const response = await fetch('https://api.ipify.org?format=json')
      const data = await response.json()
      return data.ip
    } catch {
      return 'unknown'
    }
  }

  // Métodos para exportação e portabilidade de dados (LGPD)
  async exportUserData(userId: string, tenantId: string): Promise<{
    personalData: Record<string, any>
    usageData: Record<string, any>
    consentData: Record<string, any>
  }> {
    try {
      // Coletar dados do usuário (simulado)
      const personalData = {
        userId,
        tenantId,
        exportDate: new Date().toISOString(),
        // Adicionar dados reais do usuário aqui
      }

      const usageData = {
        messagesSent: 0, // Buscar do banco
        lastActivity: new Date().toISOString(),
        // Adicionar mais dados de uso
      }

      const consentData = {
        consentId: this.generateConsentId(),
        consentDate: new Date().toISOString(),
        consentVersion: '1.0',
        // Adicionar histórico de consentimento
      }

      return {
        personalData,
        usageData,
        consentData
      }
    } catch (error) {
      console.error('Erro ao exportar dados do usuário:', error)
      throw new Error('Falha ao exportar dados')
    }
  }

  // Método para exclusão de dados (direito ao esquecimento)
  async deleteUserData(userId: string, tenantId: string): Promise<void> {
    try {
      // Implementar lógica de exclusão segura
      // 1. Anonimizar dados pessoais
      // 2. Excluir dados não essenciais
      // 3. Manter logs de auditoria por período legal
      
      console.log(`Iniciando exclusão de dados para usuário ${userId} do tenant ${tenantId}`)
      
      // Criar log de auditoria para exclusão
      await this.createAuditLog(userId, tenantId, 'data_deletion', 'user_data', {
        deletionDate: new Date().toISOString(),
        reason: 'user_request'
      })
      
    } catch (error) {
      console.error('Erro ao excluir dados do usuário:', error)
      throw new Error('Falha ao excluir dados')
    }
  }
}

// Singleton instance
export const encryptionService = new EncryptionService()

export const getEncryptionService = () => {
  return {
    isEnabled: () => encryptionService.isEnabled(),
    encryptData: async (content: string) => {
      return encryptionService.encryptField(content, 'system', 'system')
    },
    decryptData: async (encryptedField: string) => {
      return encryptionService.decryptField(encryptedField, 'system', 'system')
    }
  }
}

export default encryptionService