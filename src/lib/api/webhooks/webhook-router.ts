import { Router, Request, Response } from 'express';
import { WebhookManager } from './webhook-manager';

export class WebhookRouter {
  private router: Router;
  private webhookManager: WebhookManager;

  constructor() {
    this.router = Router();
    this.webhookManager = new WebhookManager();
    this.setupRoutes();
  }

  private setupRoutes(): void {
    // Payment provider webhooks
    this.router.post('/stripe', this.handleStripeWebhook.bind(this));
    this.router.post('/asaas', this.handleAsaasWebhook.bind(this));
    this.router.post('/mercadopago', this.handleMercadoPagoWebhook.bind(this));

    // Generic webhook endpoint for custom integrations
    this.router.post('/generic', this.handleGenericWebhook.bind(this));

    // Webhook management endpoints
    this.router.get('/deliveries', this.getWebhookDeliveries.bind(this));
    this.router.post('/deliveries/retry', this.retryFailedDeliveries.bind(this));
    
    // Health check
    this.router.get('/health', this.healthCheck.bind(this));
  }

  private async handleStripeWebhook(req: Request, res: Response): Promise<void> {
    try {
      await this.webhookManager.processWebhook('stripe', req, res);
    } catch (error) {
      console.error('Stripe webhook error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  private async handleAsaasWebhook(req: Request, res: Response): Promise<void> {
    try {
      await this.webhookManager.processWebhook('asaas', req, res);
    } catch (error) {
      console.error('Asaas webhook error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  private async handleMercadoPagoWebhook(req: Request, res: Response): Promise<void> {
    try {
      await this.webhookManager.processWebhook('mercadopago', req, res);
    } catch (error) {
      console.error('Mercado Pago webhook error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  private async handleGenericWebhook(req: Request, res: Response): Promise<void> {
    try {
      const { provider, event } = req.body;
      
      if (!provider || !event) {
        res.status(400).json({ error: 'Provider and event are required' });
        return;
      }

      await this.webhookManager.processWebhook(provider, req, res);
    } catch (error) {
      console.error('Generic webhook error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  private async getWebhookDeliveries(req: Request, res: Response): Promise<void> {
    try {
      const { eventId, status, limit = '50' } = req.query;
      
      const deliveries = await this.webhookManager.getDeliveries(eventId as string);
      
      let filteredDeliveries = deliveries;
      
      if (status) {
        filteredDeliveries = deliveries.filter(d => d.status === status);
      }
      
      const limitNum = parseInt(limit as string, 10);
      const paginatedDeliveries = filteredDeliveries.slice(0, limitNum);
      
      res.json({
        deliveries: paginatedDeliveries,
        total: deliveries.length,
        filtered: filteredDeliveries.length,
      });
    } catch (error) {
      console.error('Get webhook deliveries error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  private async retryFailedDeliveries(req: Request, res: Response): Promise<void> {
    try {
      await this.webhookManager.retryFailedDeliveries();
      res.json({ message: 'Failed deliveries are being retried' });
    } catch (error) {
      console.error('Retry failed deliveries error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  private async healthCheck(req: Request, res: Response): Promise<void> {
    res.json({ 
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  }

  getRouter(): Router {
    return this.router;
  }
}