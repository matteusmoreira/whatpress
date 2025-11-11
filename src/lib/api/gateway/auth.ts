import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  skipSuccessfulRequests: boolean;
  skipFailedRequests: boolean;
  message: string;
  statusCode: number;
  standardHeaders: boolean;
  legacyHeaders: boolean;
}

export interface RateLimitStore {
  increment(key: string): Promise<RateLimitInfo>;
  decrement(key: string): Promise<void>;
  resetKey(key: string): Promise<void>;
  resetAll(): Promise<void>;
}

export interface RateLimitInfo {
  totalRequests: number;
  remainingRequests: number;
  resetTime: Date;
}

export interface AuthConfig {
  apiKeyHeader: string;
  apiKeyPrefix: string;
  tokenHeader: string;
  tokenPrefix: string;
  rateLimit: RateLimitConfig;
  cors: {
    origin: string | string[];
    methods: string[];
    allowedHeaders: string[];
    credentials: boolean;
    maxAge: number;
  };
  security: {
    helmet: boolean;
    hsts: boolean;
    noSniff: boolean;
    xssFilter: boolean;
    frameOptions: boolean;
  };
}

export class MemoryRateLimitStore implements RateLimitStore {
  private requests: Map<string, { count: number; resetTime: Date }> = new Map();
  private windowMs: number;

  constructor(windowMs: number) {
    this.windowMs = windowMs;
  }

  async increment(key: string): Promise<RateLimitInfo> {
    const now = new Date();
    const record = this.requests.get(key);
    
    if (!record || now > record.resetTime) {
      this.requests.set(key, {
        count: 1,
        resetTime: new Date(now.getTime() + this.windowMs),
      });
      
      return {
        totalRequests: 1,
        remainingRequests: 0,
        resetTime: new Date(now.getTime() + this.windowMs),
      };
    }
    
    record.count++;
    
    return {
      totalRequests: record.count,
      remainingRequests: 0,
      resetTime: record.resetTime,
    };
  }

  async decrement(key: string): Promise<void> {
    const record = this.requests.get(key);
    if (record && record.count > 0) {
      record.count--;
    }
  }

  async resetKey(key: string): Promise<void> {
    this.requests.delete(key);
  }

  async resetAll(): Promise<void> {
    this.requests.clear();
  }
}

export class APIGateway {
  private config: AuthConfig;
  private rateLimitStore: RateLimitStore;

  constructor(config: Partial<AuthConfig> = {}) {
    this.config = {
      apiKeyHeader: 'x-api-key',
      apiKeyPrefix: 'Bearer',
      tokenHeader: 'Authorization',
      tokenPrefix: 'Bearer',
      rateLimit: {
        windowMs: 15 * 60 * 1000, // 15 minutes
        maxRequests: 100,
        skipSuccessfulRequests: false,
        skipFailedRequests: false,
        message: 'Too many requests from this IP, please try again later.',
        statusCode: 429,
        standardHeaders: true,
        legacyHeaders: false,
      },
      cors: {
        origin: '*',
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key'],
        credentials: false,
        maxAge: 86400,
      },
      security: {
        helmet: true,
        hsts: true,
        noSniff: true,
        xssFilter: true,
        frameOptions: true,
      },
      ...config,
    };
    
    this.rateLimitStore = new MemoryRateLimitStore(this.config.rateLimit.windowMs);
  }

  // Rate limiting middleware
  rateLimitMiddleware(): (req: Request, res: Response, next: NextFunction) => Promise<void> {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const key = this.getRateLimitKey(req);
        const rateLimitInfo = await this.rateLimitStore.increment(key);
        
        // Set rate limit headers
        if (this.config.rateLimit.standardHeaders) {
          res.setHeader('RateLimit-Limit', this.config.rateLimit.maxRequests);
          res.setHeader('RateLimit-Remaining', Math.max(0, this.config.rateLimit.maxRequests - rateLimitInfo.totalRequests));
          res.setHeader('RateLimit-Reset', rateLimitInfo.resetTime);
        }
        
        if (this.config.rateLimit.legacyHeaders) {
          res.setHeader('X-RateLimit-Limit', this.config.rateLimit.maxRequests);
          res.setHeader('X-RateLimit-Remaining', Math.max(0, this.config.rateLimit.maxRequests - rateLimitInfo.totalRequests));
          res.setHeader('X-RateLimit-Reset', new Date(rateLimitInfo.resetTime).getTime());
        }
        
        // Check if limit exceeded
        if (rateLimitInfo.totalRequests > this.config.rateLimit.maxRequests) {
          res.status(this.config.rateLimit.statusCode).json({
            error: this.config.rateLimit.message,
            retryAfter: Math.ceil((rateLimitInfo.resetTime.getTime() - Date.now()) / 1000),
          });
          return;
        }
        
        // Store rate limit info in request for later use
        (req as any).rateLimit = rateLimitInfo;
        
        next();
      } catch (error) {
        console.error('Rate limiting error:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    };
  }

  // API Key authentication middleware
  apiKeyAuthMiddleware(): (req: Request, res: Response, next: NextFunction) => Promise<void> {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const apiKey = this.extractApiKey(req);
        
        if (!apiKey) {
          res.status(401).json({ error: 'API key required' });
          return;
        }
        
        // Validate API key
        const isValid = await this.validateApiKey(apiKey);
        if (!isValid) {
          res.status(401).json({ error: 'Invalid API key' });
          return;
        }
        
        // Store API key info in request
        (req as any).apiKey = apiKey;
        
        next();
      } catch (error) {
        console.error('API key authentication error:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    };
  }

  // JWT token authentication middleware
  tokenAuthMiddleware(): (req: Request, res: Response, next: NextFunction) => Promise<void> {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const token = this.extractToken(req);
        
        if (!token) {
          res.status(401).json({ error: 'Authentication token required' });
          return;
        }
        
        // Validate token
        const payload = await this.validateToken(token);
        if (!payload) {
          res.status(401).json({ error: 'Invalid or expired token' });
          return;
        }
        
        // Store user info in request
        (req as any).user = payload;
        
        next();
      } catch (error) {
        console.error('Token authentication error:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    };
  }

  // CORS middleware
  corsMiddleware(): (req: Request, res: Response, next: NextFunction) => void {
    return (req: Request, res: Response, next: NextFunction): void => {
      const origin = req.headers.origin;
      
      // Handle origin
      if (this.config.cors.origin === '*') {
        res.setHeader('Access-Control-Allow-Origin', '*');
      } else if (Array.isArray(this.config.cors.origin)) {
        if (origin && this.config.cors.origin.includes(origin)) {
          res.setHeader('Access-Control-Allow-Origin', origin);
        }
      } else if (this.config.cors.origin === origin) {
        res.setHeader('Access-Control-Allow-Origin', origin);
      }
      
      // Handle credentials
      if (this.config.cors.credentials) {
        res.setHeader('Access-Control-Allow-Credentials', 'true');
      }
      
      // Handle methods
      res.setHeader('Access-Control-Allow-Methods', this.config.cors.methods.join(','));
      
      // Handle headers
      res.setHeader('Access-Control-Allow-Headers', this.config.cors.allowedHeaders.join(','));
      
      // Handle max age
      res.setHeader('Access-Control-Max-Age', this.config.cors.maxAge.toString());
      
      // Handle preflight requests
      if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
      }
      
      next();
    };
  }

  // Security headers middleware
  securityMiddleware(): (req: Request, res: Response, next: NextFunction) => void {
    return (req: Request, res: Response, next: NextFunction): void => {
      if (this.config.security.helmet) {
        // Set security headers
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('X-Frame-Options', 'DENY');
        res.setHeader('X-XSS-Protection', '1; mode=block');
        res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
        res.setHeader('Content-Security-Policy', "default-src 'self'");
        
        if (this.config.security.hsts) {
          res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
        }
      }
      
      next();
    };
  }

  // Request logging middleware
  loggingMiddleware(): (req: Request, res: Response, next: NextFunction) => void {
    return (req: Request, res: Response, next: NextFunction): void => {
      const start = Date.now();
      
      // Log request
      console.log(`[${new Date().toISOString()}] ${req.method} ${req.url} - ${req.ip}`);
      
      // Log response
      res.on('finish', () => {
        const duration = Date.now() - start;
        console.log(
          `[${new Date().toISOString()}] ${req.method} ${req.url} - ${res.statusCode} ${duration}ms`
        );
      });
      
      next();
    };
  }

  // Error handling middleware
  errorMiddleware(): (err: Error, req: Request, res: Response, next: NextFunction) => void {
    return (err: Error, req: Request, res: Response, next: NextFunction): void => {
      console.error('API Gateway Error:', err);
      
      if (res.headersSent) {
        return next(err);
      }
      
      res.status(500).json({
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? err.message : undefined,
      });
    };
  }

  // Helper methods
  private getRateLimitKey(req: Request): string {
    return `rate_limit:${req.ip}`;
  }

  private extractApiKey(req: Request): string | null {
    const header = req.headers[this.config.apiKeyHeader.toLowerCase()];
    if (!header) return null;
    
    const headerValue = Array.isArray(header) ? header[0] : header;
    
    if (this.config.apiKeyPrefix && headerValue.startsWith(this.config.apiKeyPrefix)) {
      return headerValue.substring(this.config.apiKeyPrefix.length).trim();
    }
    
    return headerValue.trim();
  }

  private extractToken(req: Request): string | null {
    const header = req.headers[this.config.tokenHeader.toLowerCase()];
    if (!header) return null;
    
    const headerValue = Array.isArray(header) ? header[0] : header;
    
    if (this.config.tokenPrefix && headerValue.startsWith(this.config.tokenPrefix)) {
      return headerValue.substring(this.config.tokenPrefix.length).trim();
    }
    
    return headerValue.trim();
  }

  private async validateApiKey(apiKey: string): Promise<boolean> {
    // In a real implementation, you would validate the API key
    // against your database or key management system
    // For now, return true as placeholder
    return true;
  }

  private async validateToken(token: string): Promise<any> {
    // In a real implementation, you would validate the JWT token
    // and return the decoded payload
    // For now, return a mock payload
    return {
      id: 'user123',
      email: 'user@example.com',
      role: 'user',
    };
  }

  // Utility methods
  generateApiKey(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  generateApiSecret(): string {
    return crypto.randomBytes(64).toString('hex');
  }

  hashApiSecret(secret: string): string {
    return crypto.createHash('sha256').update(secret).digest('hex');
  }
}