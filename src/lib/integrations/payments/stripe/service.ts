import Stripe from 'stripe';
import { PaymentProviderConfig, CreatePaymentData, Payment } from '@/lib/sdk/types';
import { STRIPE_CONFIG } from './config';

export class StripeService {
  private stripe: Stripe;
  private config: PaymentProviderConfig;

  constructor(config: PaymentProviderConfig) {
    this.config = config;
    this.stripe = new Stripe(config.config.secret_key, {
      apiVersion: STRIPE_CONFIG.API_VERSION,
      maxNetworkRetries: STRIPE_CONFIG.RETRY_CONFIG.max_attempts,
    });
  }

  async createPayment(data: CreatePaymentData): Promise<Payment> {
    try {
      const paymentIntent = await this.stripe.paymentIntents.create({
        amount: Math.round(data.amount * 100), // Convert to cents
        currency: data.currency || this.config.config.currency,
        customer: data.customer_id,
        description: data.description,
        metadata: {
          order_id: data.order_id,
          customer_id: data.customer_id,
          provider_id: this.config.id,
        },
        payment_method_types: this.getPaymentMethods(data.payment_method),
        confirm: data.auto_confirm !== false,
        capture_method: 'automatic',
        statement_descriptor: STRIPE_CONFIG.BRAZIL_CONFIG.statement_descriptor,
      });

      return this.mapPaymentIntentToPayment(paymentIntent);
    } catch (error) {
      throw this.handleStripeError(error);
    }
  }

  async confirmPayment(paymentIntentId: string): Promise<Payment> {
    try {
      const paymentIntent = await this.stripe.paymentIntents.confirm(paymentIntentId);
      return this.mapPaymentIntentToPayment(paymentIntent);
    } catch (error) {
      throw this.handleStripeError(error);
    }
  }

  async cancelPayment(paymentIntentId: string): Promise<Payment> {
    try {
      const paymentIntent = await this.stripe.paymentIntents.cancel(paymentIntentId);
      return this.mapPaymentIntentToPayment(paymentIntent);
    } catch (error) {
      throw this.handleStripeError(error);
    }
  }

  async createRefund(paymentIntentId: string, amount?: number): Promise<Payment> {
    try {
      const refund = await this.stripe.refunds.create({
        payment_intent: paymentIntentId,
        amount: amount ? Math.round(amount * 100) : undefined,
      });

      // Get updated payment intent
      const paymentIntent = await this.stripe.paymentIntents.retrieve(paymentIntentId);
      return this.mapPaymentIntentToPayment(paymentIntent);
    } catch (error) {
      throw this.handleStripeError(error);
    }
  }

  async getPayment(paymentIntentId: string): Promise<Payment> {
    try {
      const paymentIntent = await this.stripe.paymentIntents.retrieve(paymentIntentId);
      return this.mapPaymentIntentToPayment(paymentIntent);
    } catch (error) {
      throw this.handleStripeError(error);
    }
  }

  async createCustomer(customerData: {
    email: string;
    name?: string;
    phone?: string;
    cpf?: string;
    cnpj?: string;
    address?: {
      line1: string;
      line2?: string;
      city: string;
      state: string;
      postal_code: string;
      country?: string;
    };
  }): Promise<string> {
    try {
      const customer = await this.stripe.customers.create({
        email: customerData.email,
        name: customerData.name,
        phone: customerData.phone,
        address: customerData.address,
        metadata: {
          cpf: customerData.cpf,
          cnpj: customerData.cnpj,
        },
      });
      return customer.id;
    } catch (error) {
      throw this.handleStripeError(error);
    }
  }

  async updateCustomer(customerId: string, customerData: Partial<{
    email: string;
    name: string;
    phone: string;
    cpf: string;
    cnpj: string;
    address: any;
  }>): Promise<void> {
    try {
      await this.stripe.customers.update(customerId, {
        email: customerData.email,
        name: customerData.name,
        phone: customerData.phone,
        address: customerData.address,
        metadata: {
          cpf: customerData.cpf,
          cnpj: customerData.cnpj,
        },
      });
    } catch (error) {
      throw this.handleStripeError(error);
    }
  }

  async createSetupIntent(customerId: string): Promise<string> {
    try {
      const setupIntent = await this.stripe.setupIntents.create({
        customer: customerId,
        payment_method_types: ['card'],
      });
      return setupIntent.client_secret;
    } catch (error) {
      throw this.handleStripeError(error);
    }
  }

  async createPixPayment(data: CreatePaymentData): Promise<Payment> {
    try {
      const paymentIntent = await this.stripe.paymentIntents.create({
        amount: Math.round(data.amount * 100),
        currency: 'BRL',
        customer: data.customer_id,
        description: data.description,
        metadata: {
          order_id: data.order_id,
          customer_id: data.customer_id,
          provider_id: this.config.id,
          payment_type: 'pix',
        },
        payment_method_types: ['pix'],
        payment_method_data: {
          type: 'pix',
        },
        confirm: true,
        return_url: data.return_url || 'https://whatpress.com.br/payment/success',
      });

      return this.mapPaymentIntentToPayment(paymentIntent);
    } catch (error) {
      throw this.handleStripeError(error);
    }
  }

  async createBoletoPayment(data: CreatePaymentData): Promise<Payment> {
    try {
      const paymentIntent = await this.stripe.paymentIntents.create({
        amount: Math.round(data.amount * 100),
        currency: 'BRL',
        customer: data.customer_id,
        description: data.description,
        metadata: {
          order_id: data.order_id,
          customer_id: data.customer_id,
          provider_id: this.config.id,
          payment_type: 'boleto',
        },
        payment_method_types: ['boleto'],
        payment_method_data: {
          type: 'boleto',
          billing_details: {
            name: data.customer_name,
            email: data.customer_email,
            address: {
              line1: data.billing_address?.street,
              city: data.billing_address?.city,
              state: data.billing_address?.state,
              postal_code: data.billing_address?.zip_code,
              country: 'BR',
            },
          },
        },
        confirm: true,
      });

      return this.mapPaymentIntentToPayment(paymentIntent);
    } catch (error) {
      throw this.handleStripeError(error);
    }
  }

  private getPaymentMethods(paymentMethod?: string): string[] {
    if (paymentMethod === 'pix') return ['pix'];
    if (paymentMethod === 'boleto') return ['boleto'];
    if (paymentMethod === 'card') return ['card'];
    
    // Default payment methods based on currency
    if (this.config.config.currency === 'BRL') {
      return ['card', 'pix', 'boleto'];
    }
    
    return ['card'];
  }

  private mapPaymentIntentToPayment(paymentIntent: Stripe.PaymentIntent): Payment {
    const paymentMethod = this.getPaymentMethodFromIntent(paymentIntent);
    
    return {
      id: paymentIntent.id,
      provider_id: this.config.id,
      provider_name: 'stripe',
      order_id: paymentIntent.metadata?.order_id,
      customer_id: paymentIntent.metadata?.customer_id || paymentIntent.customer as string,
      amount: paymentIntent.amount / 100, // Convert from cents
      currency: paymentIntent.currency,
      status: this.mapStripeStatusToPaymentStatus(paymentIntent.status),
      payment_method: paymentMethod,
      provider_response: {
        payment_intent_id: paymentIntent.id,
        client_secret: paymentIntent.client_secret,
        charges: paymentIntent.charges.data,
      },
      metadata: paymentIntent.metadata,
      created_at: new Date(paymentIntent.created * 1000).toISOString(),
      updated_at: new Date().toISOString(),
      paid_at: paymentIntent.status === 'succeeded' ? new Date(paymentIntent.created * 1000).toISOString() : null,
      refunded_amount: paymentIntent.charges.data.reduce((sum, charge) => sum + (charge.refunded ? charge.amount_refunded : 0), 0) / 100,
      installments: paymentIntent.charges.data[0]?.payment_method_details?.card?.installments || 1,
      fraud_score: paymentIntent.charges.data[0]?.outcome?.risk_score || 0,
      billing_address: this.extractBillingAddress(paymentIntent),
      error_message: paymentIntent.last_payment_error?.message,
    };
  }

  private getPaymentMethodFromIntent(paymentIntent: Stripe.PaymentIntent): string {
    if (paymentIntent.payment_method_types.includes('pix')) return 'pix';
    if (paymentIntent.payment_method_types.includes('boleto')) return 'boleto';
    if (paymentIntent.payment_method_types.includes('card')) return 'card';
    return 'unknown';
  }

  private mapStripeStatusToPaymentStatus(stripeStatus: string): string {
    const statusMap: Record<string, string> = {
      'succeeded': 'paid',
      'processing': 'processing',
      'requires_payment_method': 'pending',
      'requires_confirmation': 'pending',
      'requires_action': 'pending',
      'canceled': 'canceled',
      'payment_failed': 'failed',
    };
    
    return statusMap[stripeStatus] || 'pending';
  }

  private extractBillingAddress(paymentIntent: Stripe.PaymentIntent): any {
    const charge = paymentIntent.charges.data[0];
    if (!charge?.billing_details?.address) return null;
    
    const address = charge.billing_details.address;
    return {
      street: address.line1,
      number: address.line2,
      city: address.city,
      state: address.state,
      zip_code: address.postal_code,
      country: address.country,
    };
  }

  private handleStripeError(error: any): Error {
    if (error.type === 'StripeCardError') {
      return new Error(`Card declined: ${error.message}`);
    }
    
    if (error.type === 'StripeInvalidRequestError') {
      return new Error(`Invalid request: ${error.message}`);
    }
    
    if (error.type === 'StripeAPIError') {
      return new Error(`Stripe API error: ${error.message}`);
    }
    
    return new Error(`Stripe error: ${error.message}`);
  }

  getStripeInstance(): Stripe {
    return this.stripe;
  }
}