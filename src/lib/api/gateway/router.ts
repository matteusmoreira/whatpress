import { Router, Request, Response } from 'express';
import { APIGateway } from './auth';
import { PaymentService } from '@/lib/integrations/payments/core/payment-service';
import { PaymentProviderRegistry } from '@/lib/integrations/payments/core/provider-registry';
import { CreatePaymentData, Payment } from '@/lib/sdk/types';

export class APIRouter {
  private router: Router;
  private gateway: APIGateway;
  private paymentService: PaymentService;

  constructor() {
    this.router = Router();
    this.gateway = new APIGateway();
    this.paymentService = new PaymentService(new PaymentProviderRegistry());
    this.setupRoutes();
  }

  private setupRoutes(): void {
    // Apply global middleware
    this.router.use(this.gateway.loggingMiddleware());
    this.router.use(this.gateway.securityMiddleware());
    this.router.use(this.gateway.corsMiddleware());
    this.router.use(this.gateway.rateLimitMiddleware());

    // Health check endpoint
    this.router.get('/health', this.healthCheck.bind(this));

    // API v1 routes
    const v1Router = Router();
    
    // Public endpoints
    v1Router.get('/status', this.getStatus.bind(this));
    
    // Protected endpoints - require API key
    v1Router.use(this.gateway.apiKeyAuthMiddleware());
    
    // Payment endpoints
    v1Router.post('/payments', this.createPayment.bind(this));
    v1Router.get('/payments/:id', this.getPayment.bind(this));
    v1Router.put('/payments/:id/confirm', this.confirmPayment.bind(this));
    v1Router.put('/payments/:id/cancel', this.cancelPayment.bind(this));
    v1Router.post('/payments/:id/refund', this.refundPayment.bind(this));
    
    // Payment provider endpoints
    v1Router.get('/providers', this.getProviders.bind(this));
    v1Router.get('/providers/:id', this.getProvider.bind(this));
    
    // Webhook endpoints
    v1Router.post('/webhooks/stripe', this.handleStripeWebhook.bind(this));
    v1Router.post('/webhooks/asaas', this.handleAsaasWebhook.bind(this));
    v1Router.post('/webhooks/mercadopago', this.handleMercadoPagoWebhook.bind(this));
    
    // Customer endpoints
    v1Router.post('/customers', this.createCustomer.bind(this));
    v1Router.get('/customers/:id', this.getCustomer.bind(this));
    v1Router.put('/customers/:id', this.updateCustomer.bind(this));
    
    // Analytics endpoints
    v1Router.get('/analytics/payments', this.getPaymentAnalytics.bind(this));
    v1Router.get('/analytics/providers', this.getProviderAnalytics.bind(this));
    
    // Mount v1 routes
    this.router.use('/v1', v1Router);
    
    // Apply error handling middleware
    this.router.use(this.gateway.errorMiddleware());
  }

  private async healthCheck(req: Request, res: Response): Promise<void> {
    try {
      const health = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        version: process.env.npm_package_version || '1.0.0',
        services: {
          database: await this.checkDatabaseHealth(),
          payment_providers: await this.checkPaymentProvidersHealth(),
        },
      };
      
      res.json(health);
    } catch (error) {
      res.status(500).json({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: error.message,
      });
    }
  }

  private async getStatus(req: Request, res: Response): Promise<void> {
    res.json({
      status: 'operational',
      version: process.env.npm_package_version || '1.0.0',
      timestamp: new Date().toISOString(),
    });
  }

  private async createPayment(req: Request, res: Response): Promise<void> {
    try {
      const paymentData: CreatePaymentData = req.body;
      const payment = await this.paymentService.createPayment(paymentData);
      
      res.status(201).json({
        success: true,
        data: payment,
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message,
      });
    }
  }

  private async getPayment(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const payment = await this.paymentService.getPayment(id);
      
      if (!payment) {
        res.status(404).json({
          success: false,
          error: 'Payment not found',
        });
        return;
      }
      
      res.json({
        success: true,
        data: payment,
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message,
      });
    }
  }

  private async confirmPayment(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const payment = await this.paymentService.confirmPayment(id);
      
      res.json({
        success: true,
        data: payment,
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message,
      });
    }
  }

  private async cancelPayment(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const payment = await this.paymentService.cancelPayment(id);
      
      res.json({
        success: true,
        data: payment,
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message,
      });
    }
  }

  private async refundPayment(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { amount } = req.body;
      const payment = await this.paymentService.refundPayment(id, amount);
      
      res.json({
        success: true,
        data: payment,
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message,
      });
    }
  }

  private async getProviders(req: Request, res: Response): Promise<void> {
    try {
      const providers = await this.paymentService.getAvailableProviders();
      
      res.json({
        success: true,
        data: providers,
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message,
      });
    }
  }

  private async getProvider(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const provider = await this.paymentService.getProvider(id);
      
      if (!provider) {
        res.status(404).json({
          success: false,
          error: 'Provider not found',
        });
        return;
      }
      
      res.json({
        success: true,
        data: provider,
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message,
      });
    }
  }

  private async handleStripeWebhook(req: Request, res: Response): Promise<void> {
    try {
      const signature = req.headers['stripe-signature'] as string;
      const payload = req.body;
      
      // Handle Stripe webhook
      console.log('Stripe webhook received:', { signature, payload });
      
      res.json({
        success: true,
        message: 'Webhook processed',
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message,
      });
    }
  }

  private async handleAsaasWebhook(req: Request, res: Response): Promise<void> {
    try {
      const payload = req.body;
      
      // Handle Asaas webhook
      console.log('Asaas webhook received:', payload);
      
      res.json({
        success: true,
        message: 'Webhook processed',
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message,
      });
    }
  }

  private async handleMercadoPagoWebhook(req: Request, res: Response): Promise<void> {
    try {
      const payload = req.body;
      
      // Handle MercadoPago webhook
      console.log('MercadoPago webhook received:', payload);
      
      res.json({
        success: true,
        message: 'Webhook processed',
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message,
      });
    }
  }

  private async createCustomer(req: Request, res: Response): Promise<void> {
    try {
      const customerData = req.body;
      // Implement customer creation logic
      
      res.status(201).json({
        success: true,
        data: { id: 'customer123', ...customerData },
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message,
      });
    }
  }

  private async getCustomer(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      // Implement customer retrieval logic
      
      res.json({
        success: true,
        data: { id, email: 'customer@example.com' },
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message,
      });
    }
  }

  private async updateCustomer(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const customerData = req.body;
      // Implement customer update logic
      
      res.json({
        success: true,
        data: { id, ...customerData },
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message,
      });
    }
  }

  private async getPaymentAnalytics(req: Request, res: Response): Promise<void> {
    try {
      const { start_date, end_date, provider } = req.query;
      
      // Implement analytics logic
      const analytics = {
        total_payments: 100,
        total_amount: 50000,
        success_rate: 0.95,
        average_amount: 500,
        by_provider: {
          stripe: { count: 40, amount: 20000 },
          asaas: { count: 35, amount: 17500 },
          mercadopago: { count: 25, amount: 12500 },
        },
        by_status: {
          paid: { count: 95, amount: 47500 },
          pending: { count: 3, amount: 1500 },
          failed: { count: 2, amount: 1000 },
        },
      };
      
      res.json({
        success: true,
        data: analytics,
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message,
      });
    }
  }

  private async getProviderAnalytics(req: Request, res: Response): Promise<void> {
    try {
      // Implement provider analytics logic
      const analytics = {
        providers: [
          { id: 'stripe', name: 'Stripe', status: 'active', success_rate: 0.98 },
          { id: 'asaas', name: 'Asaas', status: 'active', success_rate: 0.96 },
          { id: 'mercadopago', name: 'Mercado Pago', status: 'active', success_rate: 0.94 },
        ],
      };
      
      res.json({
        success: true,
        data: analytics,
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message,
      });
    }
  }

  private async checkDatabaseHealth(): Promise<{ status: string; latency?: number }> {
    try {
      // Implement database health check
      return { status: 'healthy', latency: 50 };
    } catch (error) {
      return { status: 'unhealthy' };
    }
  }

  private async checkPaymentProvidersHealth(): Promise<Record<string, { status: string; latency?: number }>> {
    try {
      // Implement payment providers health check
      return {
        stripe: { status: 'healthy', latency: 120 },
        asaas: { status: 'healthy', latency: 200 },
        mercadopago: { status: 'healthy', latency: 180 },
      };
    } catch (error) {
      return {
        stripe: { status: 'unhealthy' },
        asaas: { status: 'unhealthy' },
        mercadopago: { status: 'unhealthy' },
      };
    }
  }

  getRouter(): Router {
    return this.router;
  }
}