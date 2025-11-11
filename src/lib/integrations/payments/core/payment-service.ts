import { PaymentProviderConfig, Payment, CreatePaymentData } from '@/lib/sdk/types';
import { StripeService } from '../stripe/service';

export interface PaymentProvider {
  createPayment(data: CreatePaymentData): Promise<Payment>;
  confirmPayment(paymentId: string): Promise<Payment>;
  cancelPayment(paymentId: string): Promise<Payment>;
  createRefund(paymentId: string, amount?: number): Promise<Payment>;
  getPayment(paymentId: string): Promise<Payment>;
  getProviderName(): string;
  testConnection(): Promise<boolean>;
}

export interface PaymentProviderFactory {
  createProvider(config: PaymentProviderConfig): PaymentProvider;
}

export class PaymentProviderManager {
  private providers: Map<string, PaymentProvider> = new Map();
  private configs: Map<string, PaymentProviderConfig> = new Map();

  registerProvider(config: PaymentProviderConfig, provider: PaymentProvider): void {
    this.providers.set(config.id, provider);
    this.configs.set(config.id, config);
  }

  getProvider(providerId: string): PaymentProvider | null {
    return this.providers.get(providerId) || null;
  }

  getProviderByName(providerName: string): PaymentProvider | null {
    for (const [id, config] of this.configs) {
      if (config.provider === providerName) {
        return this.providers.get(id) || null;
      }
    }
    return null;
  }

  getAllProviders(): PaymentProvider[] {
    return Array.from(this.providers.values());
  }

  getAvailableProviders(): PaymentProviderConfig[] {
    return Array.from(this.configs.values());
  }

  async testProvider(providerId: string): Promise<boolean> {
    const provider = this.getProvider(providerId);
    if (!provider) {
      throw new Error(`Provider ${providerId} not found`);
    }
    return await provider.testConnection();
  }

  async testAllProviders(): Promise<Record<string, boolean>> {
    const results: Record<string, boolean> = {};
    
    for (const [id, provider] of this.providers) {
      try {
        results[id] = await provider.testConnection();
      } catch (error) {
        console.error(`Failed to test provider ${id}:`, error);
        results[id] = false;
      }
    }
    
    return results;
  }
}

export class PaymentService {
  private manager: PaymentProviderManager;

  constructor() {
    this.manager = new PaymentProviderManager();
  }

  registerProvider(config: PaymentProviderConfig, provider: PaymentProvider): void {
    this.manager.registerProvider(config, provider);
  }

  async createPayment(providerId: string, data: CreatePaymentData): Promise<Payment> {
    const provider = this.manager.getProvider(providerId);
    if (!provider) {
      throw new Error(`Payment provider ${providerId} not found`);
    }
    return await provider.createPayment(data);
  }

  async createPaymentWithBestProvider(data: CreatePaymentData, criteria?: {
    preferredProvider?: string;
    minSuccessRate?: number;
    maxFees?: number;
    supportedMethods?: string[];
  }): Promise<Payment> {
    const providers = this.manager.getAllProviders();
    
    if (providers.length === 0) {
      throw new Error('No payment providers available');
    }

    // If preferred provider is specified and available, use it
    if (criteria?.preferredProvider) {
      const preferred = this.manager.getProviderByName(criteria.preferredProvider);
      if (preferred) {
        return await preferred.createPayment(data);
      }
    }

    // Otherwise, use the first available provider (can be enhanced with intelligent selection)
    return await providers[0].createPayment(data);
  }

  async confirmPayment(providerId: string, paymentId: string): Promise<Payment> {
    const provider = this.manager.getProvider(providerId);
    if (!provider) {
      throw new Error(`Payment provider ${providerId} not found`);
    }
    return await provider.confirmPayment(paymentId);
  }

  async cancelPayment(providerId: string, paymentId: string): Promise<Payment> {
    const provider = this.manager.getProvider(providerId);
    if (!provider) {
      throw new Error(`Payment provider ${providerId} not found`);
    }
    return await provider.cancelPayment(paymentId);
  }

  async createRefund(providerId: string, paymentId: string, amount?: number): Promise<Payment> {
    const provider = this.manager.getProvider(providerId);
    if (!provider) {
      throw new Error(`Payment provider ${providerId} not found`);
    }
    return await provider.createRefund(paymentId, amount);
  }

  async getPayment(providerId: string, paymentId: string): Promise<Payment> {
    const provider = this.manager.getProvider(providerId);
    if (!provider) {
      throw new Error(`Payment provider ${providerId} not found`);
    }
    return await provider.getPayment(paymentId);
  }

  getManager(): PaymentProviderManager {
    return this.manager;
  }
}