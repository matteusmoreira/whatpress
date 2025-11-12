import { useState, useEffect, useCallback } from 'react';
import { encryptionService, EncryptedData } from '@/lib/encryption';
import { useAuth } from './useAuth';
import { toast } from 'sonner';

export interface UseEncryptionResult {
  // Estado
  isEncryptionAvailable: boolean;
  isLoading: boolean;
  error: string | null;
  
  // Métodos de criptografia
  encrypt: (text: string) => Promise<EncryptedData>;
  decrypt: (encryptedData: EncryptedData) => Promise<string>;
  encryptObject: (obj: any) => Promise<EncryptedData>;
  decryptObject: (encryptedData: EncryptedData) => Promise<any>;
  
  // Métodos de dados sensíveis
  encryptContactData: (contact: any) => Promise<any>;
  decryptContactData: (contact: any) => Promise<any>;
  encryptMessage: (message: string) => Promise<EncryptedData>;
  decryptMessage: (encryptedData: EncryptedData) => Promise<string>;
  encryptTemplate: (template: any) => Promise<any>;
  decryptTemplate: (template: any) => Promise<any>;
  
  // Métodos LGPD
  anonymizeData: (data: string) => Promise<string>;
  pseudonymizeData: (data: string, key: string) => Promise<string>;
  exportUserData: (userId: string) => Promise<any>;
  deleteUserData: (userId: string) => Promise<void>;
  createAuditLog: (action: string, resource: string, metadata?: Record<string, any>) => Promise<void>;
  
  // Utilitários
  hash: (text: string) => Promise<string>;
  generateSecureId: () => string;
  generateSecureToken: (length?: number) => Promise<string>;
  rotateKey: () => Promise<void>;
  getKeyStatus: () => Promise<{ createdAt: Date | null; expiresAt: Date | null; isActive: boolean } | null>;
}

export const useEncryption = (): UseEncryptionResult => {
  const [isEncryptionAvailable, setIsEncryptionAvailable] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    checkEncryptionAvailability();
  }, []);

  const checkEncryptionAvailability = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Verificar se a criptografia está configurada
      const masterKey = process.env.VITE_MASTER_ENCRYPTION_KEY;
      
      if (!masterKey) {
        setIsEncryptionAvailable(false);
        setError('Chave mestra de criptografia não configurada');
        return;
      }

      // Testar serviço de criptografia
      const testData = 'teste';
      const userId = user?.id || 'test-user';
      const tenantId = user?.user_metadata?.tenant_id || 'test-tenant';
      
      const encrypted = await encryptionService.encryptData(testData, userId, tenantId);
      const decrypted = await encryptionService.decryptData(encrypted, userId, tenantId);
      
      if (decrypted !== testData) {
        throw new Error('Falha no teste de criptografia');
      }

      setIsEncryptionAvailable(true);
    } catch (error) {
      console.error('Erro ao verificar disponibilidade de criptografia:', error);
      setIsEncryptionAvailable(false);
      setError(error instanceof Error ? error.message : 'Erro desconhecido');
    } finally {
      setIsLoading(false);
    }
  };

  const encrypt = useCallback(async (text: string): Promise<EncryptedData> => {
    try {
      if (!isEncryptionAvailable) {
        throw new Error('Criptografia não disponível');
      }
      
      if (!user?.id || !user?.user_metadata?.tenant_id) {
        throw new Error('Usuário não autenticado');
      }
      
      return await encryptionService.encryptData(text, user.id, user.user_metadata.tenant_id);
    } catch (error) {
      console.error('Erro ao criptografar texto:', error);
      toast.error('Erro ao criptografar dados');
      throw error;
    }
  }, [isEncryptionAvailable, user]);

  const decrypt = useCallback(async (encryptedData: EncryptedData): Promise<string> => {
    try {
      if (!isEncryptionAvailable) {
        throw new Error('Criptografia não disponível');
      }
      
      if (!user?.id || !user?.user_metadata?.tenant_id) {
        throw new Error('Usuário não autenticado');
      }
      
      return await encryptionService.decryptData(encryptedData, user.id, user.user_metadata.tenant_id);
    } catch (error) {
      console.error('Erro ao descriptografar texto:', error);
      toast.error('Erro ao descriptografar dados');
      throw error;
    }
  }, [isEncryptionAvailable, user]);

  const encryptObject = useCallback(async (obj: any): Promise<EncryptedData> => {
    try {
      if (!isEncryptionAvailable) {
        throw new Error('Criptografia não disponível');
      }
      
      if (!user?.id || !user?.user_metadata?.tenant_id) {
        throw new Error('Usuário não autenticado');
      }
      
      return await encryptionService.encryptData(obj, user.id, user.user_metadata.tenant_id);
    } catch (error) {
      console.error('Erro ao criptografar objeto:', error);
      toast.error('Erro ao criptografar dados');
      throw error;
    }
  }, [isEncryptionAvailable, user]);

  const decryptObject = useCallback(async (encryptedData: EncryptedData): Promise<any> => {
    try {
      if (!isEncryptionAvailable) {
        throw new Error('Criptografia não disponível');
      }
      
      if (!user?.id || !user?.user_metadata?.tenant_id) {
        throw new Error('Usuário não autenticado');
      }
      
      return await encryptionService.decryptData(encryptedData, user.id, user.user_metadata.tenant_id);
    } catch (error) {
      console.error('Erro ao descriptografar objeto:', error);
      toast.error('Erro ao descriptografar dados');
      throw error;
    }
  }, [isEncryptionAvailable, user]);

  const encryptContactData = useCallback(async (contact: any): Promise<any> => {
    try {
      if (!isEncryptionAvailable) {
        return contact; // Retorna dados sem criptografar se não disponível
      }
      
      if (!user?.id || !user?.user_metadata?.tenant_id) {
        throw new Error('Usuário não autenticado');
      }
      
      const encryptedContact = { ...contact };
      
      // Criptografar campos sensíveis
      if (contact.phone) {
        encryptedContact.phone = await encryptionService.encryptField(contact.phone, user.id, user.user_metadata.tenant_id);
      }
      if (contact.email) {
        encryptedContact.email = await encryptionService.encryptField(contact.email, user.id, user.user_metadata.tenant_id);
      }
      if (contact.name) {
        encryptedContact.name = await encryptionService.encryptField(contact.name, user.id, user.user_metadata.tenant_id);
      }
      
      return encryptedContact;
    } catch (error) {
      console.error('Erro ao criptografar dados de contato:', error);
      toast.error('Erro ao criptografar dados de contato');
      throw error;
    }
  }, [isEncryptionAvailable, user]);

  const decryptContactData = useCallback(async (contact: any): Promise<any> => {
    try {
      if (!isEncryptionAvailable) {
        return contact; // Retorna dados sem descriptografar se não disponível
      }
      
      if (!user?.id || !user?.user_metadata?.tenant_id) {
        throw new Error('Usuário não autenticado');
      }
      
      const decryptedContact = { ...contact };
      
      // Descriptografar campos sensíveis
      if (contact.phone) {
        decryptedContact.phone = await encryptionService.decryptField(contact.phone, user.id, user.user_metadata.tenant_id);
      }
      if (contact.email) {
        decryptedContact.email = await encryptionService.decryptField(contact.email, user.id, user.user_metadata.tenant_id);
      }
      if (contact.name) {
        decryptedContact.name = await encryptionService.decryptField(contact.name, user.id, user.user_metadata.tenant_id);
      }
      
      return decryptedContact;
    } catch (error) {
      console.error('Erro ao descriptografar dados de contato:', error);
      toast.error('Erro ao descriptografar dados de contato');
      throw error;
    }
  }, [isEncryptionAvailable, user]);

  const encryptMessage = useCallback(async (message: string): Promise<EncryptedData> => {
    try {
      if (!isEncryptionAvailable) {
        throw new Error('Criptografia não disponível');
      }
      
      if (!user?.id || !user?.user_metadata?.tenant_id) {
        throw new Error('Usuário não autenticado');
      }
      
      return await encryptionService.encryptData(message, user.id, user.user_metadata.tenant_id);
    } catch (error) {
      console.error('Erro ao criptografar mensagem:', error);
      toast.error('Erro ao criptografar mensagem');
      throw error;
    }
  }, [isEncryptionAvailable, user]);

  const decryptMessage = useCallback(async (encryptedData: EncryptedData): Promise<string> => {
    try {
      if (!isEncryptionAvailable) {
        throw new Error('Criptografia não disponível');
      }
      
      if (!user?.id || !user?.user_metadata?.tenant_id) {
        throw new Error('Usuário não autenticado');
      }
      
      return await encryptionService.decryptData(encryptedData, user.id, user.user_metadata.tenant_id);
    } catch (error) {
      console.error('Erro ao descriptografar mensagem:', error);
      toast.error('Erro ao descriptografar mensagem');
      throw error;
    }
  }, [isEncryptionAvailable, user]);

  const encryptTemplate = useCallback(async (template: any): Promise<any> => {
    try {
      if (!isEncryptionAvailable) {
        return template; // Retorna template sem criptografar se não disponível
      }
      
      if (!user?.id || !user?.user_metadata?.tenant_id) {
        throw new Error('Usuário não autenticado');
      }
      
      const encryptedTemplate = { ...template };
      
      // Criptografar campos sensíveis do template
      if (template.content) {
        encryptedTemplate.content = await encryptionService.encryptField(template.content, user.id, user.user_metadata.tenant_id);
      }
      if (template.name) {
        encryptedTemplate.name = await encryptionService.encryptField(template.name, user.id, user.user_metadata.tenant_id);
      }
      
      return encryptedTemplate;
    } catch (error) {
      console.error('Erro ao criptografar template:', error);
      toast.error('Erro ao criptografar template');
      throw error;
    }
  }, [isEncryptionAvailable, user]);

  const decryptTemplate = useCallback(async (template: any): Promise<any> => {
    try {
      if (!isEncryptionAvailable) {
        return template; // Retorna template sem descriptografar se não disponível
      }
      
      if (!user?.id || !user?.user_metadata?.tenant_id) {
        throw new Error('Usuário não autenticado');
      }
      
      const decryptedTemplate = { ...template };
      
      // Descriptografar campos sensíveis do template
      if (template.content) {
        decryptedTemplate.content = await encryptionService.decryptField(template.content, user.id, user.user_metadata.tenant_id);
      }
      if (template.name) {
        decryptedTemplate.name = await encryptionService.decryptField(template.name, user.id, user.user_metadata.tenant_id);
      }
      
      return decryptedTemplate;
    } catch (error) {
      console.error('Erro ao descriptografar template:', error);
      toast.error('Erro ao descriptografar template');
      throw error;
    }
  }, [isEncryptionAvailable, user]);

  const hash = useCallback(async (text: string): Promise<string> => {
    try {
      if (!isEncryptionAvailable) {
        throw new Error('Criptografia não disponível');
      }
      
      if (!user?.id || !user?.user_metadata?.tenant_id) {
        throw new Error('Usuário não autenticado');
      }
      
      return await encryptionService.hashData(text, user.id);
    } catch (error) {
      console.error('Erro ao criar hash:', error);
      toast.error('Erro ao criar hash');
      throw error;
    }
  }, [isEncryptionAvailable, user]);

  const generateSecureId = useCallback((): string => {
    try {
      return `id_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    } catch (error) {
      console.error('Erro ao gerar ID seguro:', error);
      return `id_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
  }, []);

  const generateSecureToken = useCallback(async (length: number = 32): Promise<string> => {
    try {
      if (!isEncryptionAvailable) {
        // Fallback para token simples se criptografia não disponível
        return Math.random().toString(36).substr(2, length);
      }
      
      return await encryptionService.generateSecureToken(length);
    } catch (error) {
      console.error('Erro ao gerar token seguro:', error);
      // Fallback para token simples
      return Math.random().toString(36).substr(2, length);
    }
  }, [isEncryptionAvailable]);

  // Métodos LGPD
  const anonymizeData = useCallback(async (data: string): Promise<string> => {
    try {
      if (!isEncryptionAvailable) {
        throw new Error('Criptografia não disponível');
      }
      
      return await encryptionService.anonymizeData(data);
    } catch (error) {
      console.error('Erro ao anonimizar dados:', error);
      toast.error('Erro ao anonimizar dados');
      throw error;
    }
  }, [isEncryptionAvailable]);

  const pseudonymizeData = useCallback(async (data: string, key: string): Promise<string> => {
    try {
      if (!isEncryptionAvailable) {
        throw new Error('Criptografia não disponível');
      }
      
      return await encryptionService.pseudonymizeData(data, key);
    } catch (error) {
      console.error('Erro ao pseudonimizar dados:', error);
      toast.error('Erro ao pseudonimizar dados');
      throw error;
    }
  }, [isEncryptionAvailable]);

  const exportUserData = useCallback(async (userId: string): Promise<any> => {
    try {
      if (!user?.user_metadata?.tenant_id) {
        throw new Error('Tenant ID não disponível');
      }
      
      return await encryptionService.exportUserData(userId, user.user_metadata.tenant_id);
    } catch (error) {
      console.error('Erro ao exportar dados do usuário:', error);
      toast.error('Erro ao exportar dados do usuário');
      throw error;
    }
  }, [user]);

  const deleteUserData = useCallback(async (userId: string): Promise<void> => {
    try {
      if (!user?.user_metadata?.tenant_id) {
        throw new Error('Tenant ID não disponível');
      }
      
      await encryptionService.deleteUserData(userId, user.user_metadata.tenant_id);
      toast.success('Dados do usuário excluídos com sucesso');
    } catch (error) {
      console.error('Erro ao excluir dados do usuário:', error);
      toast.error('Erro ao excluir dados do usuário');
      throw error;
    }
  }, [user]);

  const createAuditLog = useCallback(async (action: string, resource: string, metadata?: Record<string, any>): Promise<void> => {
    try {
      if (!user?.id || !user?.user_metadata?.tenant_id) {
        throw new Error('Usuário não autenticado');
      }
      
      await encryptionService.createAuditLog(user.id, user.user_metadata.tenant_id, action, resource, metadata);
    } catch (error) {
      console.error('Erro ao criar log de auditoria:', error);
      // Não mostrar toast para logs de auditoria para evitar loops
    }
  }, [user]);

  const rotateKey = useCallback(async (): Promise<void> => {
    try {
      if (!isEncryptionAvailable) {
        throw new Error('Criptografia não disponível');
      }
      
      if (!user?.id || !user?.user_metadata?.tenant_id) {
        throw new Error('Usuário não autenticado');
      }
      
      await encryptionService.rotateKey(user.id, user.user_metadata.tenant_id);
      toast.success('Chave de criptografia rotacionada com sucesso');
    } catch (error) {
      console.error('Erro ao rotacionar chave:', error);
      toast.error('Erro ao rotacionar chave');
      throw error;
    }
  }, [isEncryptionAvailable, user]);

  const getKeyStatus = useCallback(async (): Promise<{ createdAt: Date | null; expiresAt: Date | null; isActive: boolean } | null> => {
    try {
      if (!user?.id || !user?.user_metadata?.tenant_id) {
        return null
      }
      const info = encryptionService.getKeyInfo(user.id, user.user_metadata.tenant_id)
      if (!info) return null
      return {
        createdAt: info.created_at,
        expiresAt: info.expires_at ?? null,
        isActive: info.is_active,
      }
    } catch (error) {
      console.error('Erro ao obter status da chave:', error)
      return null
    }
  }, [user])

  return {
    isEncryptionAvailable,
    isLoading,
    error,
    encrypt,
    decrypt,
    encryptObject,
    decryptObject,
    encryptContactData,
    decryptContactData,
    encryptMessage,
    decryptMessage,
    encryptTemplate,
    decryptTemplate,
    hash,
    generateSecureId,
    generateSecureToken,
    anonymizeData,
    pseudonymizeData,
    exportUserData,
    deleteUserData,
    createAuditLog,
    rotateKey,
    getKeyStatus
  };
};

export default useEncryption;
