export interface WhatsPressConfig {
  apiKey: string;
  baseURL?: string;
  timeout?: number;
  retries?: number;
  retryDelay?: number;
}

export interface PaymentCustomer {
  email: string;
  name: string;
  phone?: string;
  document?: string;
}

export interface PaymentMetadata {
  [key: string]: any;
}

export interface PaymentCreateRequest {
  amount: number;
  currency: 'BRL' | 'USD' | 'EUR';
  paymentMethod: 'credit_card' | 'debit_card' | 'pix' | 'boleto' | 'bank_transfer';
  provider?: 'stripe' | 'asaas' | 'mercadopago';
  customer: PaymentCustomer;
  metadata?: PaymentMetadata;
}

export interface Payment {
  id: string;
  amount: number;
  currency: string;
  status: 'pending' | 'processing' | 'succeeded' | 'failed' | 'cancelled' | 'refunded';
  provider: 'stripe' | 'asaas' | 'mercadopago';
  paymentMethod: string;
  customer: PaymentCustomer;
  metadata?: PaymentMetadata;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentListResponse {
  payments: Payment[];
  total: number;
  limit: number;
  offset: number;
}

export interface APIKey {
  id: string;
  name: string;
  key?: string;
  permissions: APIKeyPermissions;
  usageLimits?: APIKeyUsageLimits;
  status: 'active' | 'suspended' | 'revoked';
  createdAt: string;
  lastUsedAt?: string;
}

export interface APIKeyPermissions {
  payments?: {
    read?: boolean;
    write?: boolean;
    create?: boolean;
    update?: boolean;
    delete?: boolean;
  };
  customers?: {
    read?: boolean;
    write?: boolean;
  };
  webhooks?: {
    read?: boolean;
    write?: boolean;
  };
  analytics?: {
    read?: boolean;
  };
  admin?: {
    read?: boolean;
    write?: boolean;
  };
}

export interface APIKeyUsageLimits {
  requestsPerMinute?: number;
  requestsPerHour?: number;
  requestsPerDay?: number;
}

export interface APIKeyCreateRequest {
  name: string;
  permissions: APIKeyPermissions;
  usageLimits?: APIKeyUsageLimits;
}

export interface APIKeyListResponse {
  apiKeys: APIKey[];
  total: number;
}

export interface WebhookEvent {
  id: string;
  type: string;
  provider: 'stripe' | 'asaas' | 'mercadopago';
  timestamp: string;
  data: any;
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

export interface WebhookDeliveryListResponse {
  deliveries: WebhookDelivery[];
  total: number;
  filtered: number;
}

export interface HealthResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  services: {
    database: {
      status: string;
      latency?: number;
    };
    redis: {
      status: string;
      latency?: number;
    };
    paymentProviders: {
      stripe: string;
      asaas: string;
      mercadopago: string;
    };
  };
}

export class WhatsPressError extends Error {
  constructor(
    message: string,
    public code?: string,
    public statusCode?: number,
    public details?: any
  ) {
    super(message);
    this.name = 'WhatsPressError';
  }
}