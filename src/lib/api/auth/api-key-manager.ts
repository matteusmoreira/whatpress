import crypto from 'crypto';

export interface APIKeyPermissions {
  // Payment permissions
  payments: {
    create: boolean;
    read: boolean;
    update: boolean;
    delete: boolean;
    refund: boolean;
  };
  
  // Customer permissions
  customers: {
    create: boolean;
    read: boolean;
    update: boolean;
    delete: boolean;
  };
  
  // Provider permissions
  providers: {
    read: boolean;
    configure: boolean;
  };
  
  // Webhook permissions
  webhooks: {
    read: boolean;
    create: boolean;
    update: boolean;
    delete: boolean;
  };
  
  // Analytics permissions
  analytics: {
    read: boolean;
    export: boolean;
  };
  
  // Admin permissions
  admin: {
    manage_api_keys: boolean;
    manage_providers: boolean;
    manage_settings: boolean;
    view_logs: boolean;
  };
}

export interface APIKey {
  id: string;
  name: string;
  key: string;
  secret_hash: string;
  permissions: APIKeyPermissions;
  status: 'active' | 'suspended' | 'revoked';
  usage_limits: {
    requests_per_minute: number;
    requests_per_hour: number;
    requests_per_day: number;
  };
  usage_stats: {
    total_requests: number;
    last_request_at: string | null;
    requests_this_minute: number;
    requests_this_hour: number;
    requests_today: number;
  };
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
  expires_at: string | null;
  last_used_at: string | null;
  created_by: string;
}

export interface CreateAPIKeyData {
  name: string;
  permissions: Partial<APIKeyPermissions>;
  usage_limits?: {
    requests_per_minute?: number;
    requests_per_hour?: number;
    requests_per_day?: number;
  };
  expires_at?: string;
  metadata?: Record<string, any>;
}

export class APIKeyManager {
  private keys: Map<string, APIKey> = new Map();
  private usage: Map<string, number[]> = new Map();

  constructor() {
    // Initialize with default permissions structure
    this.initializeDefaultPermissions();
  }

  private initializeDefaultPermissions(): void {
    // This ensures all permission categories exist
  }

  async createAPIKey(data: CreateAPIKeyData, createdBy: string): Promise<{ key: APIKey; secret: string }> {
    const id = this.generateId();
    const secret = this.generateSecret();
    const secretHash = this.hashSecret(secret);
    
    const now = new Date().toISOString();
    const key: APIKey = {
      id,
      name: data.name,
      key: this.generateKey(),
      secret_hash: secretHash,
      permissions: this.mergePermissions(data.permissions),
      status: 'active',
      usage_limits: {
        requests_per_minute: data.usage_limits?.requests_per_minute || 60,
        requests_per_hour: data.usage_limits?.requests_per_hour || 1000,
        requests_per_day: data.usage_limits?.requests_per_day || 10000,
      },
      usage_stats: {
        total_requests: 0,
        last_request_at: null,
        requests_this_minute: 0,
        requests_this_hour: 0,
        requests_today: 0,
      },
      metadata: data.metadata || {},
      created_at: now,
      updated_at: now,
      expires_at: data.expires_at || null,
      last_used_at: null,
      created_by,
    };

    this.keys.set(key.key, key);
    this.usage.set(key.key, []);

    return { key, secret };
  }

  async validateAPIKey(key: string, secret?: string): Promise<APIKey | null> {
    const apiKey = this.keys.get(key);
    
    if (!apiKey) {
      return null;
    }

    // Check if key is active
    if (apiKey.status !== 'active') {
      return null;
    }

    // Check if key has expired
    if (apiKey.expires_at && new Date(apiKey.expires_at) < new Date()) {
      return null;
    }

    // Validate secret if provided
    if (secret && !this.validateSecret(secret, apiKey.secret_hash)) {
      return null;
    }

    // Check usage limits
    if (!this.checkUsageLimits(apiKey)) {
      return null;
    }

    return apiKey;
  }

  async updateAPIKey(key: string, data: Partial<CreateAPIKeyData>): Promise<APIKey | null> {
    const apiKey = this.keys.get(key);
    
    if (!apiKey) {
      return null;
    }

    const updatedKey: APIKey = {
      ...apiKey,
      name: data.name || apiKey.name,
      permissions: data.permissions ? this.mergePermissions(data.permissions, apiKey.permissions) : apiKey.permissions,
      usage_limits: {
        ...apiKey.usage_limits,
        ...data.usage_limits,
      },
      metadata: {
        ...apiKey.metadata,
        ...data.metadata,
      },
      updated_at: new Date().toISOString(),
    };

    if (data.expires_at !== undefined) {
      updatedKey.expires_at = data.expires_at;
    }

    this.keys.set(key, updatedKey);
    return updatedKey;
  }

  async revokeAPIKey(key: string): Promise<boolean> {
    const apiKey = this.keys.get(key);
    
    if (!apiKey) {
      return false;
    }

    apiKey.status = 'revoked';
    apiKey.updated_at = new Date().toISOString();
    
    this.keys.set(key, apiKey);
    return true;
  }

  async suspendAPIKey(key: string): Promise<boolean> {
    const apiKey = this.keys.get(key);
    
    if (!apiKey) {
      return false;
    }

    apiKey.status = 'suspended';
    apiKey.updated_at = new Date().toISOString();
    
    this.keys.set(key, apiKey);
    return true;
  }

  async activateAPIKey(key: string): Promise<boolean> {
    const apiKey = this.keys.get(key);
    
    if (!apiKey) {
      return false;
    }

    apiKey.status = 'active';
    apiKey.updated_at = new Date().toISOString();
    
    this.keys.set(key, apiKey);
    return true;
  }

  async getAPIKey(key: string): Promise<APIKey | null> {
    return this.keys.get(key) || null;
  }

  async listAPIKeys(): Promise<APIKey[]> {
    return Array.from(this.keys.values());
  }

  async recordUsage(key: string): Promise<void> {
    const apiKey = this.keys.get(key);
    if (!apiKey) return;

    const now = new Date();
    const usage = this.usage.get(key) || [];
    
    // Add current timestamp
    usage.push(now.getTime());
    
    // Remove timestamps older than 24 hours
    const cutoff = now.getTime() - 24 * 60 * 60 * 1000;
    const filteredUsage = usage.filter(timestamp => timestamp > cutoff);
    
    this.usage.set(key, filteredUsage);
    
    // Update stats
    apiKey.usage_stats.total_requests++;
    apiKey.usage_stats.last_request_at = now.toISOString();
    apiKey.usage_stats.last_used_at = now.toISOString();
    
    // Calculate current usage
    const minuteAgo = now.getTime() - 60 * 1000;
    const hourAgo = now.getTime() - 60 * 60 * 1000;
    const dayAgo = now.getTime() - 24 * 60 * 60 * 1000;
    
    apiKey.usage_stats.requests_this_minute = filteredUsage.filter(t => t > minuteAgo).length;
    apiKey.usage_stats.requests_this_hour = filteredUsage.filter(t => t > hourAgo).length;
    apiKey.usage_stats.requests_today = filteredUsage.filter(t => t > dayAgo).length;
    
    this.keys.set(key, apiKey);
  }

  checkPermission(key: string, resource: keyof APIKeyPermissions, action: string): boolean {
    const apiKey = this.keys.get(key);
    if (!apiKey) return false;

    const resourcePermissions = apiKey.permissions[resource];
    if (!resourcePermissions) return false;

    return resourcePermissions[action as keyof typeof resourcePermissions] === true;
  }

  private mergePermissions(newPermissions: Partial<APIKeyPermissions>, existing?: APIKeyPermissions): APIKeyPermissions {
    const defaultPermissions: APIKeyPermissions = {
      payments: {
        create: false,
        read: false,
        update: false,
        delete: false,
        refund: false,
      },
      customers: {
        create: false,
        read: false,
        update: false,
        delete: false,
      },
      providers: {
        read: false,
        configure: false,
      },
      webhooks: {
        read: false,
        create: false,
        update: false,
        delete: false,
      },
      analytics: {
        read: false,
        export: false,
      },
      admin: {
        manage_api_keys: false,
        manage_providers: false,
        manage_settings: false,
        view_logs: false,
      },
    };

    const basePermissions = existing || defaultPermissions;

    return {
      payments: { ...basePermissions.payments, ...newPermissions.payments },
      customers: { ...basePermissions.customers, ...newPermissions.customers },
      providers: { ...basePermissions.providers, ...newPermissions.providers },
      webhooks: { ...basePermissions.webhooks, ...newPermissions.webhooks },
      analytics: { ...basePermissions.analytics, ...newPermissions.analytics },
      admin: { ...basePermissions.admin, ...newPermissions.admin },
    };
  }

  private checkUsageLimits(apiKey: APIKey): boolean {
    const stats = apiKey.usage_stats;
    const limits = apiKey.usage_limits;

    // Check per-minute limit
    if (stats.requests_this_minute >= limits.requests_per_minute) {
      return false;
    }

    // Check per-hour limit
    if (stats.requests_this_hour >= limits.requests_per_hour) {
      return false;
    }

    // Check per-day limit
    if (stats.requests_today >= limits.requests_per_day) {
      return false;
    }

    return true;
  }

  private generateId(): string {
    return crypto.randomBytes(16).toString('hex');
  }

  private generateKey(): string {
    return `wp_${crypto.randomBytes(32).toString('hex')}`;
  }

  private generateSecret(): string {
    return crypto.randomBytes(64).toString('hex');
  }

  private hashSecret(secret: string): string {
    return crypto.createHash('sha256').update(secret).digest('hex');
  }

  private validateSecret(secret: string, hash: string): boolean {
    const secretHash = this.hashSecret(secret);
    return crypto.timingSafeEqual(Buffer.from(secretHash), Buffer.from(hash));
  }

  // Predefined permission templates
  static getPermissionTemplates() {
    return {
      full_access: {
        payments: { create: true, read: true, update: true, delete: true, refund: true },
        customers: { create: true, read: true, update: true, delete: true },
        providers: { read: true, configure: true },
        webhooks: { read: true, create: true, update: true, delete: true },
        analytics: { read: true, export: true },
        admin: { manage_api_keys: true, manage_providers: true, manage_settings: true, view_logs: true },
      },
      payments_only: {
        payments: { create: true, read: true, update: false, delete: false, refund: true },
        customers: { create: false, read: false, update: false, delete: false },
        providers: { read: true, configure: false },
        webhooks: { read: false, create: false, update: false, delete: false },
        analytics: { read: true, export: false },
        admin: { manage_api_keys: false, manage_providers: false, manage_settings: false, view_logs: false },
      },
      read_only: {
        payments: { create: false, read: true, update: false, delete: false, refund: false },
        customers: { create: false, read: true, update: false, delete: false },
        providers: { read: true, configure: false },
        webhooks: { read: true, create: false, update: false, delete: false },
        analytics: { read: true, export: false },
        admin: { manage_api_keys: false, manage_providers: false, manage_settings: false, view_logs: false },
      },
      analytics_only: {
        payments: { create: false, read: false, update: false, delete: false, refund: false },
        customers: { create: false, read: false, update: false, delete: false },
        providers: { read: false, configure: false },
        webhooks: { read: false, create: false, update: false, delete: false },
        analytics: { read: true, export: true },
        admin: { manage_api_keys: false, manage_providers: false, manage_settings: false, view_logs: false },
      },
    };
  }
}