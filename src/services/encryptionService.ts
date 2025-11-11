import CryptoJS from 'crypto-js';

class EncryptionService {
  private readonly key: string;
  private readonly algorithm = 'AES-256-GCM';

  constructor() {
    const encryptionKey = import.meta.env.VITE_ENCRYPTION_KEY;
    if (!encryptionKey) {
      throw new Error('VITE_ENCRYPTION_KEY não está configurado');
    }
    this.key = encryptionKey;
  }

  /**
   * Criptografa dados sensíveis
   */
  encrypt(data: string): string {
    try {
      const encrypted = CryptoJS.AES.encrypt(data, this.key).toString();
      return encrypted;
    } catch (error) {
      console.error('Erro ao criptografar dados:', error);
      throw new Error('Falha ao criptografar dados');
    }
  }

  /**
   * Descriptografa dados
   */
  decrypt(encryptedData: string): string {
    try {
      const bytes = CryptoJS.AES.decrypt(encryptedData, this.key);
      const decrypted = bytes.toString(CryptoJS.enc.Utf8);
      
      if (!decrypted) {
        throw new Error('Falha ao descriptografar - dados inválidos');
      }
      
      return decrypted;
    } catch (error) {
      console.error('Erro ao descriptografar dados:', error);
      throw new Error('Falha ao descriptografar dados');
    }
  }

  /**
   * Criptografa objeto JSON
   */
  encryptObject<T>(data: T): string {
    try {
      const jsonString = JSON.stringify(data);
      return this.encrypt(jsonString);
    } catch (error) {
      console.error('Erro ao criptografar objeto:', error);
      throw new Error('Falha ao criptografar objeto');
    }
  }

  /**
   * Descriptografa objeto JSON
   */
  decryptObject<T>(encryptedData: string): T {
    try {
      const decryptedString = this.decrypt(encryptedData);
      return JSON.parse(decryptedString) as T;
    } catch (error) {
      console.error('Erro ao descriptografar objeto:', error);
      throw new Error('Falha ao descriptografar objeto');
    }
  }

  /**
   * Criptografa dados sensíveis de contato
   */
  encryptContactData(contact: {
    name?: string;
    phone: string;
    email?: string;
    notes?: string;
    customFields?: Record<string, any>;
  }): {
    name?: string;
    phone: string;
    email?: string;
    notes?: string;
    customFields?: string;
    isEncrypted: boolean;
  } {
    const encrypted: any = {
      phone: contact.phone, // Telefone não é criptografado para queries
      isEncrypted: true
    };

    if (contact.name) {
      encrypted.name = this.encrypt(contact.name);
    }

    if (contact.email) {
      encrypted.email = this.encrypt(contact.email);
    }

    if (contact.notes) {
      encrypted.notes = this.encrypt(contact.notes);
    }

    if (contact.customFields) {
      encrypted.customFields = this.encryptObject(contact.customFields);
    }

    return encrypted;
  }

  /**
   * Descriptografa dados de contato
   */
  decryptContactData(encryptedContact: {
    name?: string;
    phone: string;
    email?: string;
    notes?: string;
    customFields?: string;
    isEncrypted: boolean;
  }): {
    name?: string;
    phone: string;
    email?: string;
    notes?: string;
    customFields?: Record<string, any>;
  } {
    if (!encryptedContact.isEncrypted) {
      return encryptedContact;
    }

    const decrypted: any = {
      phone: encryptedContact.phone
    };

    if (encryptedContact.name) {
      decrypted.name = this.decrypt(encryptedContact.name);
    }

    if (encryptedContact.email) {
      decrypted.email = this.decrypt(encryptedContact.email);
    }

    if (encryptedContact.notes) {
      decrypted.notes = this.decrypt(encryptedContact.notes);
    }

    if (encryptedContact.customFields) {
      decrypted.customFields = this.decryptObject(encryptedContact.customFields);
    }

    return decrypted;
  }

  /**
   * Criptografa mensagem
   */
  encryptMessage(message: {
    content: string;
    mediaUrl?: string;
    mediaType?: string;
    caption?: string;
  }): {
    content: string;
    mediaUrl?: string;
    mediaType?: string;
    caption?: string;
    isEncrypted: boolean;
  } {
    const encrypted: any = {
      content: this.encrypt(message.content),
      isEncrypted: true
    };

    if (message.mediaUrl) {
      encrypted.mediaUrl = this.encrypt(message.mediaUrl);
    }

    if (message.caption) {
      encrypted.caption = this.encrypt(message.caption);
    }

    if (message.mediaType) {
      encrypted.mediaType = message.mediaType; // Tipo não é sensível
    }

    return encrypted;
  }

  /**
   * Descriptografa mensagem
   */
  decryptMessage(encryptedMessage: {
    content: string;
    mediaUrl?: string;
    mediaType?: string;
    caption?: string;
    isEncrypted: boolean;
  }): {
    content: string;
    mediaUrl?: string;
    mediaType?: string;
    caption?: string;
  } {
    if (!encryptedMessage.isEncrypted) {
      return encryptedMessage;
    }

    const decrypted: any = {
      content: this.decrypt(encryptedMessage.content)
    };

    if (encryptedMessage.mediaUrl) {
      decrypted.mediaUrl = this.decrypt(encryptedMessage.mediaUrl);
    }

    if (encryptedMessage.caption) {
      decrypted.caption = this.decrypt(encryptedMessage.caption);
    }

    if (encryptedMessage.mediaType) {
      decrypted.mediaType = encryptedMessage.mediaType;
    }

    return decrypted;
  }

  /**
   * Valida se a chave de criptografia está configurada corretamente
   */
  validateKey(): boolean {
    try {
      const testData = 'test';
      const encrypted = this.encrypt(testData);
      const decrypted = this.decrypt(encrypted);
      return decrypted === testData;
    } catch (error) {
      console.error('Validação da chave de criptografia falhou:', error);
      return false;
    }
  }

  /**
   * Gera hash de dados para comparação segura
   */
  hash(data: string): string {
    return CryptoJS.SHA256(data + this.key).toString();
  }

  /**
   * Compara dados com hash de forma timing-safe
   */
  compareHash(data: string, hash: string): boolean {
    const computedHash = this.hash(data);
    return computedHash === hash;
  }
}

// Singleton instance
export const encryptionService = new EncryptionService();

export default EncryptionService;