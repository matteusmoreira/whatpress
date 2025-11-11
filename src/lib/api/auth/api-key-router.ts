import { Router, Request, Response } from 'express';
import { APIKeyManager, CreateAPIKeyData, APIKey } from './api-key-manager';

export class APIKeyRouter {
  private router: Router;
  private keyManager: APIKeyManager;

  constructor() {
    this.router = Router();
    this.keyManager = new APIKeyManager();
    this.setupRoutes();
  }

  private setupRoutes(): void {
    // API Key management endpoints
    this.router.post('/keys', this.createAPIKey.bind(this));
    this.router.get('/keys', this.listAPIKeys.bind(this));
    this.router.get('/keys/:key', this.getAPIKey.bind(this));
    this.router.put('/keys/:key', this.updateAPIKey.bind(this));
    this.router.delete('/keys/:key', this.revokeAPIKey.bind(this));
    this.router.post('/keys/:key/suspend', this.suspendAPIKey.bind(this));
    this.router.post('/keys/:key/activate', this.activateAPIKey.bind(this));
    
    // Permission templates
    this.router.get('/permissions/templates', this.getPermissionTemplates.bind(this));
    
    // Usage analytics
    this.router.get('/keys/:key/usage', this.getAPIKeyUsage.bind(this));
  }

  private async createAPIKey(req: Request, res: Response): Promise<void> {
    try {
      const data: CreateAPIKeyData = req.body;
      const createdBy = (req as any).user?.id || 'system';
      
      if (!data.name) {
        res.status(400).json({
          success: false,
          error: 'API key name is required',
        });
        return;
      }
      
      const { key, secret } = await this.keyManager.createAPIKey(data, createdBy);
      
      res.status(201).json({
        success: true,
        data: {
          key: key.key,
          secret,
          name: key.name,
          permissions: key.permissions,
          status: key.status,
          created_at: key.created_at,
          expires_at: key.expires_at,
        },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  private async listAPIKeys(req: Request, res: Response): Promise<void> {
    try {
      const keys = await this.keyManager.listAPIKeys();
      
      // Remove sensitive information
      const sanitizedKeys = keys.map(key => ({
        id: key.id,
        name: key.name,
        key: key.key.substring(0, 8) + '...',
        permissions: key.permissions,
        status: key.status,
        usage_stats: key.usage_stats,
        created_at: key.created_at,
        updated_at: key.updated_at,
        expires_at: key.expires_at,
        last_used_at: key.last_used_at,
        created_by: key.created_by,
      }));
      
      res.json({
        success: true,
        data: sanitizedKeys,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  private async getAPIKey(req: Request, res: Response): Promise<void> {
    try {
      const { key } = req.params;
      const apiKey = await this.keyManager.getAPIKey(key);
      
      if (!apiKey) {
        res.status(404).json({
          success: false,
          error: 'API key not found',
        });
        return;
      }
      
      // Remove sensitive information
      const sanitizedKey = {
        id: apiKey.id,
        name: apiKey.name,
        key: apiKey.key.substring(0, 8) + '...',
        permissions: apiKey.permissions,
        status: apiKey.status,
        usage_stats: apiKey.usage_stats,
        usage_limits: apiKey.usage_limits,
        metadata: apiKey.metadata,
        created_at: apiKey.created_at,
        updated_at: apiKey.updated_at,
        expires_at: apiKey.expires_at,
        last_used_at: apiKey.last_used_at,
        created_by: apiKey.created_by,
      };
      
      res.json({
        success: true,
        data: sanitizedKey,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  private async updateAPIKey(req: Request, res: Response): Promise<void> {
    try {
      const { key } = req.params;
      const data = req.body;
      
      const updatedKey = await this.keyManager.updateAPIKey(key, data);
      
      if (!updatedKey) {
        res.status(404).json({
          success: false,
          error: 'API key not found',
        });
        return;
      }
      
      // Remove sensitive information
      const sanitizedKey = {
        id: updatedKey.id,
        name: updatedKey.name,
        key: updatedKey.key.substring(0, 8) + '...',
        permissions: updatedKey.permissions,
        status: updatedKey.status,
        usage_stats: updatedKey.usage_stats,
        usage_limits: updatedKey.usage_limits,
        metadata: updatedKey.metadata,
        created_at: updatedKey.created_at,
        updated_at: updatedKey.updated_at,
        expires_at: updatedKey.expires_at,
        last_used_at: updatedKey.last_used_at,
        created_by: updatedKey.created_by,
      };
      
      res.json({
        success: true,
        data: sanitizedKey,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  private async revokeAPIKey(req: Request, res: Response): Promise<void> {
    try {
      const { key } = req.params;
      const success = await this.keyManager.revokeAPIKey(key);
      
      if (!success) {
        res.status(404).json({
          success: false,
          error: 'API key not found',
        });
        return;
      }
      
      res.json({
        success: true,
        message: 'API key revoked successfully',
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  private async suspendAPIKey(req: Request, res: Response): Promise<void> {
    try {
      const { key } = req.params;
      const success = await this.keyManager.suspendAPIKey(key);
      
      if (!success) {
        res.status(404).json({
          success: false,
          error: 'API key not found',
        });
        return;
      }
      
      res.json({
        success: true,
        message: 'API key suspended successfully',
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  private async activateAPIKey(req: Request, res: Response): Promise<void> {
    try {
      const { key } = req.params;
      const success = await this.keyManager.activateAPIKey(key);
      
      if (!success) {
        res.status(404).json({
          success: false,
          error: 'API key not found',
        });
        return;
      }
      
      res.json({
        success: true,
        message: 'API key activated successfully',
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  private async getPermissionTemplates(req: Request, res: Response): Promise<void> {
    try {
      const templates = APIKeyManager.getPermissionTemplates();
      
      res.json({
        success: true,
        data: templates,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  private async getAPIKeyUsage(req: Request, res: Response): Promise<void> {
    try {
      const { key } = req.params;
      const apiKey = await this.keyManager.getAPIKey(key);
      
      if (!apiKey) {
        res.status(404).json({
          success: false,
          error: 'API key not found',
        });
        return;
      }
      
      const usage = {
        total_requests: apiKey.usage_stats.total_requests,
        requests_this_minute: apiKey.usage_stats.requests_this_minute,
        requests_this_hour: apiKey.usage_stats.requests_this_hour,
        requests_today: apiKey.usage_stats.requests_today,
        last_request_at: apiKey.usage_stats.last_request_at,
        usage_limits: apiKey.usage_limits,
        usage_percentage: {
          minute: (apiKey.usage_stats.requests_this_minute / apiKey.usage_limits.requests_per_minute) * 100,
          hour: (apiKey.usage_stats.requests_this_hour / apiKey.usage_limits.requests_per_hour) * 100,
          day: (apiKey.usage_stats.requests_today / apiKey.usage_limits.requests_per_day) * 100,
        },
      };
      
      res.json({
        success: true,
        data: usage,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  }

  getRouter(): Router {
    return this.router;
  }
}