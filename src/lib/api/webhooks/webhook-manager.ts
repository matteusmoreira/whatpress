import { Request, Response } from 'express';

export interface WebhookEvent {
  id: string;
  type: string;
  provider: string;
  timestamp: string;
  data: any;
  signature?: string;
  headers?: Record<string, string>;
}

export interface WebhookHandler {
  handle(event: WebhookEvent): Promise<void>;
  validateSignature(payload: any, signature: string): boolean;
}

export interface WebhookConfig {
  secret: string;
  endpoint: string;
  events: string[];
  retryAttempts: number;
  timeout: number;
}

export interface WebhookDelivery {
  id: string;
  eventId: string;
  endpoint: string;
  status: 'pending' | 'delivered' | 'failed' | 'retrying';
  attempts: number;
  lastAttemptAt: string;
  nextAttemptAt: string;
  response: {
    statusCode?: number;
    body?: string;
    headers?: Record<string, string>;
  };
  error?: string;
}

export class WebhookManager {
  private handlers: Map<string, WebhookHandler> = new Map();
  private deliveries: Map<string, WebhookDelivery[]> = new Map();
  private config: Map<string, WebhookConfig> = new Map();

  constructor() {
    this.initializeHandlers();
  }

  private initializeHandlers(): void {
    // Register default webhook handlers
    this.registerHandler('payment-created', new PaymentCreatedHandler());
    this.registerHandler('payment-updated', new PaymentUpdatedHandler());
    this.registerHandler('payment-confirmed', new PaymentConfirmedHandler());
    this.registerHandler('payment-cancelled', new PaymentCancelledHandler());
    this.registerHandler('payment-refunded', new PaymentRefundedHandler());
    this.registerHandler('payment-failed', new PaymentFailedHandler());
    this.registerHandler('subscription-created', new SubscriptionCreatedHandler());
    this.registerHandler('subscription-updated', new SubscriptionUpdatedHandler());
    this.registerHandler('subscription-cancelled', new SubscriptionCancelledHandler());
    this.registerHandler('chargeback-created', new ChargebackCreatedHandler());
    this.registerHandler('chargeback-won', new ChargebackWonHandler());
    this.registerHandler('chargeback-lost', new ChargebackLostHandler());
  }

  registerHandler(eventType: string, handler: WebhookHandler): void {
    this.handlers.set(eventType, handler);
  }

  async processWebhook(provider: string, req: Request, res: Response): Promise<void> {
    try {
      const event = this.parseWebhookEvent(provider, req);
      
      if (!event) {
        res.status(400).json({ error: 'Invalid webhook payload' });
        return;
      }

      // Validate signature if present
      if (event.signature && !this.validateSignature(provider, event)) {
        res.status(401).json({ error: 'Invalid webhook signature' });
        return;
      }

      // Process the event
      await this.processEvent(event);
      
      res.status(200).json({ success: true });
    } catch (error) {
      console.error('Webhook processing error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  private parseWebhookEvent(provider: string, req: Request): WebhookEvent | null {
    try {
      const payload = req.body;
      const signature = this.extractSignature(provider, req);
      
      return {
        id: this.generateEventId(),
        type: this.determineEventType(provider, payload),
        provider,
        timestamp: new Date().toISOString(),
        data: payload,
        signature,
        headers: req.headers as Record<string, string>,
      };
    } catch (error) {
      console.error('Error parsing webhook event:', error);
      return null;
    }
  }

  private extractSignature(provider: string, req: Request): string | undefined {
    switch (provider) {
      case 'stripe':
        return req.headers['stripe-signature'] as string;
      case 'asaas':
        return req.headers['asaas-webhook-signature'] as string;
      case 'mercadopago':
        return req.headers['x-signature'] as string;
      default:
        return undefined;
    }
  }

  private determineEventType(provider: string, payload: any): string {
    // Map provider-specific events to standard event types
    switch (provider) {
      case 'stripe':
        return this.mapStripeEvent(payload.type);
      case 'asaas':
        return this.mapAsaasEvent(payload.event);
      case 'mercadopago':
        return this.mapMercadoPagoEvent(payload.action);
      default:
        return 'unknown';
    }
  }

  private mapStripeEvent(stripeEvent: string): string {
    const eventMap: Record<string, string> = {
      'payment_intent.created': 'payment-created',
      'payment_intent.succeeded': 'payment-confirmed',
      'payment_intent.payment_failed': 'payment-failed',
      'payment_intent.cancelled': 'payment-cancelled',
      'charge.refunded': 'payment-refunded',
      'charge.dispute.created': 'chargeback-created',
      'charge.dispute.closed': 'chargeback-resolved',
      'customer.subscription.created': 'subscription-created',
      'customer.subscription.updated': 'subscription-updated',
      'customer.subscription.deleted': 'subscription-cancelled',
    };
    
    return eventMap[stripeEvent] || 'unknown';
  }

  private mapAsaasEvent(asaasEvent: string): string {
    const eventMap: Record<string, string> = {
      'PAYMENT_CREATED': 'payment-created',
      'PAYMENT_UPDATED': 'payment-updated',
      'PAYMENT_CONFIRMED': 'payment-confirmed',
      'PAYMENT_RECEIVED': 'payment-confirmed',
      'PAYMENT_OVERDUE': 'payment-failed',
      'PAYMENT_CANCELED': 'payment-cancelled',
      'PAYMENT_REFUNDED': 'payment-refunded',
      'PAYMENT_REVERSED': 'payment-refunded',
      'CHARGEBACK_REQUESTED': 'chargeback-created',
      'CHARGEBACK_DISPUTE': 'chargeback-created',
    };
    
    return eventMap[asaasEvent] || 'unknown';
  }

  private mapMercadoPagoAction(mercadopagoAction: string): string {
    const actionMap: Record<string, string> = {
      'payment.created': 'payment-created',
      'payment.updated': 'payment-updated',
      'payment.approved': 'payment-confirmed',
      'payment.rejected': 'payment-failed',
      'payment.cancelled': 'payment-cancelled',
      'payment.refunded': 'payment-refunded',
      'payment.chargeback': 'chargeback-created',
      'payment.dispute': 'chargeback-created',
      'payment.mediation': 'chargeback-created',
    };
    
    return actionMap[mercadopagoAction] || 'unknown';
  }

  private validateSignature(provider: string, event: WebhookEvent): boolean {
    // This is a simplified validation - in production, implement proper signature validation
    // for each provider using their respective methods
    return true;
  }

  private async processEvent(event: WebhookEvent): Promise<void> {
    const handler = this.handlers.get(event.type);
    
    if (handler) {
      try {
        await handler.handle(event);
        
        // Record successful delivery
        this.recordDelivery(event.id, 'delivered');
      } catch (error) {
        console.error(`Error processing event ${event.id}:`, error);
        
        // Record failed delivery
        this.recordDelivery(event.id, 'failed', error.message);
        
        // Retry logic could be implemented here
        throw error;
      }
    } else {
      console.warn(`No handler found for event type: ${event.type}`);
    }
  }

  private recordDelivery(eventId: string, status: WebhookDelivery['status'], error?: string): void {
    const delivery: WebhookDelivery = {
      id: this.generateDeliveryId(),
      eventId,
      endpoint: 'webhook',
      status,
      attempts: 1,
      lastAttemptAt: new Date().toISOString(),
      nextAttemptAt: new Date().toISOString(),
      response: {},
      error,
    };

    const deliveries = this.deliveries.get(eventId) || [];
    deliveries.push(delivery);
    this.deliveries.set(eventId, deliveries);
  }

  private generateEventId(): string {
    return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateDeliveryId(): string {
    return `del_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  async getDeliveries(eventId?: string): Promise<WebhookDelivery[]> {
    if (eventId) {
      return this.deliveries.get(eventId) || [];
    }
    
    const allDeliveries: WebhookDelivery[] = [];
    for (const deliveries of this.deliveries.values()) {
      allDeliveries.push(...deliveries);
    }
    
    return allDeliveries;
  }

  async retryFailedDeliveries(): Promise<void> {
    for (const [eventId, deliveries] of this.deliveries.entries()) {
      const failedDeliveries = deliveries.filter(d => d.status === 'failed');
      
      for (const delivery of failedDeliveries) {
        if (delivery.attempts < 3) { // Max 3 attempts
          try {
            // Retry delivery logic here
            delivery.status = 'delivered';
            delivery.lastAttemptAt = new Date().toISOString();
            delivery.attempts++;
          } catch (error) {
            delivery.status = 'failed';
            delivery.error = error.message;
            delivery.attempts++;
          }
        }
      }
    }
  }
}

// Base webhook handler class
abstract class BaseWebhookHandler implements WebhookHandler {
  abstract handle(event: WebhookEvent): Promise<void>;
  
  validateSignature(payload: any, signature: string): boolean {
    // Base implementation - should be overridden by specific handlers
    return true;
  }
}

// Specific webhook handlers
class PaymentCreatedHandler extends BaseWebhookHandler {
  async handle(event: WebhookEvent): Promise<void> {
    console.log(`Payment created: ${event.data.id}`);
    
    // Implement business logic for payment creation
    // 1. Update database
    // 2. Send notifications
    // 3. Trigger workflows
    
    await this.updateDatabase(event);
    await this.sendNotifications(event);
  }

  private async updateDatabase(event: WebhookEvent): Promise<void> {
    // Update payment record in database
    console.log('Updating payment in database:', event.data);
  }

  private async sendNotifications(event: WebhookEvent): Promise<void> {
    // Send email/SMS notifications
    console.log('Sending payment notifications:', event.data);
  }
}

class PaymentUpdatedHandler extends BaseWebhookHandler {
  async handle(event: WebhookEvent): Promise<void> {
    console.log(`Payment updated: ${event.data.id}`);
    
    await this.updateDatabase(event);
    await this.sendNotifications(event);
  }

  private async updateDatabase(event: WebhookEvent): Promise<void> {
    console.log('Updating payment in database:', event.data);
  }

  private async sendNotifications(event: WebhookEvent): Promise<void> {
    console.log('Sending payment update notifications:', event.data);
  }
}

class PaymentConfirmedHandler extends BaseWebhookHandler {
  async handle(event: WebhookEvent): Promise<void> {
    console.log(`Payment confirmed: ${event.data.id}`);
    
    await this.updateDatabase(event);
    await this.sendNotifications(event);
    await this.fulfillOrder(event);
  }

  private async updateDatabase(event: WebhookEvent): Promise<void> {
    console.log('Updating payment status to confirmed:', event.data);
  }

  private async sendNotifications(event: WebhookEvent): Promise<void> {
    console.log('Sending payment confirmation notifications:', event.data);
  }

  private async fulfillOrder(event: WebhookEvent): Promise<void> {
    console.log('Fulfilling order for confirmed payment:', event.data);
  }
}

class PaymentCancelledHandler extends BaseWebhookHandler {
  async handle(event: WebhookEvent): Promise<void> {
    console.log(`Payment cancelled: ${event.data.id}`);
    
    await this.updateDatabase(event);
    await this.sendNotifications(event);
    await this.cancelOrder(event);
  }

  private async updateDatabase(event: WebhookEvent): Promise<void> {
    console.log('Updating payment status to cancelled:', event.data);
  }

  private async sendNotifications(event: WebhookEvent): Promise<void> {
    console.log('Sending payment cancellation notifications:', event.data);
  }

  private async cancelOrder(event: WebhookEvent): Promise<void> {
    console.log('Cancelling order for cancelled payment:', event.data);
  }
}

class PaymentRefundedHandler extends BaseWebhookHandler {
  async handle(event: WebhookEvent): Promise<void> {
    console.log(`Payment refunded: ${event.data.id}`);
    
    await this.updateDatabase(event);
    await this.sendNotifications(event);
    await this.processRefund(event);
  }

  private async updateDatabase(event: WebhookEvent): Promise<void> {
    console.log('Updating payment status to refunded:', event.data);
  }

  private async sendNotifications(event: WebhookEvent): Promise<void> {
    console.log('Sending refund notifications:', event.data);
  }

  private async processRefund(event: WebhookEvent): Promise<void> {
    console.log('Processing refund for payment:', event.data);
  }
}

class PaymentFailedHandler extends BaseWebhookHandler {
  async handle(event: WebhookEvent): Promise<void> {
    console.log(`Payment failed: ${event.data.id}`);
    
    await this.updateDatabase(event);
    await this.sendNotifications(event);
    await this.handleFailure(event);
  }

  private async updateDatabase(event: WebhookEvent): Promise<void> {
    console.log('Updating payment status to failed:', event.data);
  }

  private async sendNotifications(event: WebhookEvent): Promise<void> {
    console.log('Sending payment failure notifications:', event.data);
  }

  private async handleFailure(event: WebhookEvent): Promise<void> {
    console.log('Handling payment failure:', event.data);
  }
}

class SubscriptionCreatedHandler extends BaseWebhookHandler {
  async handle(event: WebhookEvent): Promise<void> {
    console.log(`Subscription created: ${event.data.id}`);
    
    await this.updateDatabase(event);
    await this.sendNotifications(event);
  }

  private async updateDatabase(event: WebhookEvent): Promise<void> {
    console.log('Creating subscription in database:', event.data);
  }

  private async sendNotifications(event: WebhookEvent): Promise<void> {
    console.log('Sending subscription creation notifications:', event.data);
  }
}

class SubscriptionUpdatedHandler extends BaseWebhookHandler {
  async handle(event: WebhookEvent): Promise<void> {
    console.log(`Subscription updated: ${event.data.id}`);
    
    await this.updateDatabase(event);
    await this.sendNotifications(event);
  }

  private async updateDatabase(event: WebhookEvent): Promise<void> {
    console.log('Updating subscription in database:', event.data);
  }

  private async sendNotifications(event: WebhookEvent): Promise<void> {
    console.log('Sending subscription update notifications:', event.data);
  }
}

class SubscriptionCancelledHandler extends BaseWebhookHandler {
  async handle(event: WebhookEvent): Promise<void> {
    console.log(`Subscription cancelled: ${event.data.id}`);
    
    await this.updateDatabase(event);
    await this.sendNotifications(event);
  }

  private async updateDatabase(event: WebhookEvent): Promise<void> {
    console.log('Cancelling subscription in database:', event.data);
  }

  private async sendNotifications(event: WebhookEvent): Promise<void> {
    console.log('Sending subscription cancellation notifications:', event.data);
  }
}

class ChargebackCreatedHandler extends BaseWebhookHandler {
  async handle(event: WebhookEvent): Promise<void> {
    console.log(`Chargeback created: ${event.data.id}`);
    
    await this.updateDatabase(event);
    await this.sendNotifications(event);
    await this.handleDispute(event);
  }

  private async updateDatabase(event: WebhookEvent): Promise<void> {
    console.log('Recording chargeback in database:', event.data);
  }

  private async sendNotifications(event: WebhookEvent): Promise<void> {
    console.log('Sending chargeback notifications:', event.data);
  }

  private async handleDispute(event: WebhookEvent): Promise<void> {
    console.log('Handling chargeback dispute:', event.data);
  }
}

class ChargebackWonHandler extends BaseWebhookHandler {
  async handle(event: WebhookEvent): Promise<void> {
    console.log(`Chargeback won: ${event.data.id}`);
    
    await this.updateDatabase(event);
    await this.sendNotifications(event);
  }

  private async updateDatabase(event: WebhookEvent): Promise<void> {
    console.log('Updating chargeback status to won:', event.data);
  }

  private async sendNotifications(event: WebhookEvent): Promise<void> {
    console.log('Sending chargeback won notifications:', event.data);
  }
}

class ChargebackLostHandler extends BaseWebhookHandler {
  async handle(event: WebhookEvent): Promise<void> {
    console.log(`Chargeback lost: ${event.data.id}`);
    
    await this.updateDatabase(event);
    await this.sendNotifications(event);
    await this.processChargebackLoss(event);
  }

  private async updateDatabase(event: WebhookEvent): Promise<void> {
    console.log('Updating chargeback status to lost:', event.data);
  }

  private async sendNotifications(event: WebhookEvent): Promise<void> {
    console.log('Sending chargeback lost notifications:', event.data);
  }

  private async processChargebackLoss(event: WebhookEvent): Promise<void> {
    console.log('Processing chargeback loss:', event.data);
  }
}