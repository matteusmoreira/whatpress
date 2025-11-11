import { PaymentProviderConfig } from '@/lib/sdk/types';
import { PaymentProvider } from './payment-service';
import { StripeService } from '../stripe/service';

export class StripeProviderFactory {
  createProvider(config: PaymentProviderConfig): PaymentProvider {
    if (config.provider !== 'stripe') {
      throw new Error('Invalid provider type for Stripe factory');
    }
    return new StripeService(config);
  }
}

export class PaymentProviderRegistry {
  private static factories: Map<string, any> = new Map();

  static registerFactory(providerName: string, factory: any): void {
    this.factories.set(providerName, factory);
  }

  static createProvider(config: PaymentProviderConfig): PaymentProvider {
    const factory = this.factories.get(config.provider);
    if (!factory) {
      throw new Error(`No factory registered for provider: ${config.provider}`);
    }
    return factory.createProvider(config);
  }

  static getSupportedProviders(): string[] {
    return Array.from(this.factories.keys());
  }
}

// Register default factories
PaymentProviderRegistry.registerFactory('stripe', new StripeProviderFactory());