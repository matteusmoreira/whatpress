import Stripe from 'stripe';
import { STRIPE_CONFIG } from './config';
import { PaymentProviderConfig } from '@/lib/sdk/types';

export class StripeWebhookHandler {
  private stripe: Stripe;
  private config: PaymentProviderConfig;

  constructor(config: PaymentProviderConfig) {
    this.config = config;
    this.stripe = new Stripe(config.config.secret_key, {
      apiVersion: STRIPE_CONFIG.API_VERSION,
    });
  }

  async handleWebhook(payload: Buffer, signature: string): Promise<any> {
    try {
      // Verify webhook signature
      const event = this.stripe.webhooks.constructEvent(
        payload,
        signature,
        this.config.config.webhook_secret
      );

      console.log(`Received Stripe webhook event: ${event.type}`);

      // Handle different event types
      switch (event.type) {
        case STRIPE_CONFIG.WEBHOOK_EVENTS.PAYMENT_SUCCESS:
          return await this.handlePaymentSuccess(event);
        
        case STRIPE_CONFIG.WEBHOOK_EVENTS.PAYMENT_FAILED:
          return await this.handlePaymentFailed(event);
        
        case STRIPE_CONFIG.WEBHOOK_EVENTS.PAYMENT_CANCELED:
          return await this.handlePaymentCanceled(event);
        
        case STRIPE_CONFIG.WEBHOOK_EVENTS.REFUND_CREATED:
          return await this.handleRefundCreated(event);
        
        case STRIPE_CONFIG.WEBHOOK_EVENTS.INVOICE_PAID:
          return await this.handleInvoicePaid(event);
        
        case STRIPE_CONFIG.WEBHOOK_EVENTS.INVOICE_PAYMENT_FAILED:
          return await this.handleInvoicePaymentFailed(event);
        
        case STRIPE_CONFIG.WEBHOOK_EVENTS.SETUP_INTENT_SUCCEEDED:
          return await this.handleSetupIntentSucceeded(event);
        
        case STRIPE_CONFIG.WEBHOOK_EVENTS.CUSTOMER_CREATED:
          return await this.handleCustomerCreated(event);
        
        case STRIPE_CONFIG.WEBHOOK_EVENTS.CUSTOMER_UPDATED:
          return await this.handleCustomerUpdated(event);
        
        default:
          console.log(`Unhandled event type: ${event.type}`);
          return { received: true, message: 'Event type not handled' };
      }
    } catch (error) {
      console.error('Error handling Stripe webhook:', error);
      throw new Error('Webhook signature verification failed');
    }
  }

  private async handlePaymentSuccess(event: Stripe.Event): Promise<any> {
    const paymentIntent = event.data.object as Stripe.PaymentIntent;
    
    console.log('Payment succeeded:', paymentIntent.id);
    
    // Here you would typically:
    // 1. Update your database
    // 2. Send confirmation email
    // 3. Trigger business logic
    // 4. Notify other systems
    
    return {
      received: true,
      event: 'payment_success',
      payment_intent_id: paymentIntent.id,
      amount: paymentIntent.amount,
      currency: paymentIntent.currency,
      customer: paymentIntent.customer,
    };
  }

  private async handlePaymentFailed(event: Stripe.Event): Promise<any> {
    const paymentIntent = event.data.object as Stripe.PaymentIntent;
    
    console.log('Payment failed:', paymentIntent.id);
    console.log('Failure reason:', paymentIntent.last_payment_error?.message);
    
    return {
      received: true,
      event: 'payment_failed',
      payment_intent_id: paymentIntent.id,
      error: paymentIntent.last_payment_error?.message,
    };
  }

  private async handlePaymentCanceled(event: Stripe.Event): Promise<any> {
    const paymentIntent = event.data.object as Stripe.PaymentIntent;
    
    console.log('Payment canceled:', paymentIntent.id);
    
    return {
      received: true,
      event: 'payment_canceled',
      payment_intent_id: paymentIntent.id,
    };
  }

  private async handleRefundCreated(event: Stripe.Event): Promise<any> {
    const refund = event.data.object as Stripe.Refund;
    
    console.log('Refund created:', refund.id);
    console.log('Amount refunded:', refund.amount);
    
    return {
      received: true,
      event: 'refund_created',
      refund_id: refund.id,
      amount: refund.amount,
      currency: refund.currency,
      payment_intent: refund.payment_intent,
    };
  }

  private async handleInvoicePaid(event: Stripe.Event): Promise<any> {
    const invoice = event.data.object as Stripe.Invoice;
    
    console.log('Invoice paid:', invoice.id);
    console.log('Amount paid:', invoice.amount_paid);
    
    return {
      received: true,
      event: 'invoice_paid',
      invoice_id: invoice.id,
      amount_paid: invoice.amount_paid,
      customer: invoice.customer,
      subscription: invoice.subscription,
    };
  }

  private async handleInvoicePaymentFailed(event: Stripe.Event): Promise<any> {
    const invoice = event.data.object as Stripe.Invoice;
    
    console.log('Invoice payment failed:', invoice.id);
    console.log('Attempt count:', invoice.attempt_count);
    
    return {
      received: true,
      event: 'invoice_payment_failed',
      invoice_id: invoice.id,
      attempt_count: invoice.attempt_count,
      customer: invoice.customer,
      subscription: invoice.subscription,
    };
  }

  private async handleSetupIntentSucceeded(event: Stripe.Event): Promise<any> {
    const setupIntent = event.data.object as Stripe.SetupIntent;
    
    console.log('Setup intent succeeded:', setupIntent.id);
    console.log('Customer:', setupIntent.customer);
    
    return {
      received: true,
      event: 'setup_intent_succeeded',
      setup_intent_id: setupIntent.id,
      customer: setupIntent.customer,
      payment_method: setupIntent.payment_method,
    };
  }

  private async handleCustomerCreated(event: Stripe.Event): Promise<any> {
    const customer = event.data.object as Stripe.Customer;
    
    console.log('Customer created:', customer.id);
    console.log('Email:', customer.email);
    
    return {
      received: true,
      event: 'customer_created',
      customer_id: customer.id,
      email: customer.email,
      name: customer.name,
    };
  }

  private async handleCustomerUpdated(event: Stripe.Event): Promise<any> {
    const customer = event.data.object as Stripe.Customer;
    
    console.log('Customer updated:', customer.id);
    
    return {
      received: true,
      event: 'customer_updated',
      customer_id: customer.id,
      email: customer.email,
      name: customer.name,
    };
  }

  // Utility method to get webhook events
  getWebhookEvents(): string[] {
    return Object.values(STRIPE_CONFIG.WEBHOOK_EVENTS);
  }

  // Method to validate webhook signature
  validateWebhookSignature(payload: Buffer, signature: string): boolean {
    try {
      this.stripe.webhooks.constructEvent(
        payload,
        signature,
        this.config.config.webhook_secret
      );
      return true;
    } catch (error) {
      console.error('Webhook signature validation failed:', error);
      return false;
    }
  }
}