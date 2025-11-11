export interface WhatsPressConfig {
  apiKey: string;
  baseURL?: string;
  timeout?: number;
  retries?: number;
  retryDelay?: number;
}

export interface PaymentCustomer {
  name: string;
  email: string;
  phone?: string;
  cpf?: string;
  cnpj?: string;
  address?: {
    street?: string;
    number?: string;
    complement?: string;
    neighborhood?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    country?: string;
  };
}

export interface PaymentMetadata {
  [key: string]: any;
}

export interface PaymentCreateRequest {
  amount: number;
  currency: 'BRL' | 'USD' | 'EUR';
  provider: 'stripe' | 'asaas' | 'mercadopago';
  customer: PaymentCustomer;
  metadata?: PaymentMetadata;
  description?: string;
  dueDate?: string;
  installments?: number;
  paymentMethod?: 'credit_card' | 'debit_card' | 'boleto' | 'pix' | 'transfer';
}

export interface Payment {
  id: string;
  amount: number;
  currency: string;
  provider: 'stripe' | 'asaas' | 'mercadopago';
  status: 'pending' | 'processing' | 'succeeded' | 'failed' | 'cancelled' | 'refunded';
  customer: PaymentCustomer;
  metadata?: PaymentMetadata;
  description?: string;
  dueDate?: string;
  installments?: number;
  paymentMethod?: string;
  providerPaymentId?: string;
  providerData?: any;
  createdAt: string;
  updatedAt: string;
  confirmedAt?: string;
  cancelledAt?: string;
  refundedAt?: string;
  refundAmount?: number;
}

export interface PaymentListResponse {
  data: Payment[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

export interface APIKeyPermissions {
  payments?: ('create' | 'read' | 'update' | 'delete')[];
  customers?: ('create' | 'read' | 'update' | 'delete')[];
  providers?: ('read' | 'update')[];
  webhooks?: ('read' | 'update')[];
  analytics?: ('read')[];
  admin?: ('read' | 'update' | 'delete')[];
}

export interface APIKeyUsageLimits {
  daily?: number;
  monthly?: number;
  total?: number;
}

export interface APIKeyCreateRequest {
  name: string;
  description?: string;
  permissions: APIKeyPermissions;
  usageLimits?: APIKeyUsageLimits;
  expiresAt?: string;
}

export interface APIKey {
  id: string;
  key: string;
  name: string;
  description?: string;
  permissions: APIKeyPermissions;
  usageLimits?: APIKeyUsageLimits;
  status: 'active' | 'suspended' | 'revoked';
  expiresAt?: string;
  lastUsedAt?: string;
  usageCount: {
    daily: number;
    monthly: number;
    total: number;
  };
  createdAt: string;
  updatedAt: string;
}

export interface APIKeyListResponse {
  data: APIKey[];
  total: number;
  limit: number;
  hasMore: boolean;
}

export interface WebhookEvent {
  id: string;
  type: string;
  provider: 'stripe' | 'asaas' | 'mercadopago';
  data: any;
  createdAt: string;
}

export interface WebhookDelivery {
  id: string;
  eventId: string;
  webhookId: string;
  url: string;
  status: 'pending' | 'delivered' | 'failed' | 'retrying';
  attempts: number;
  maxAttempts: number;
  lastAttemptAt?: string;
  nextRetryAt?: string;
  responseStatus?: number;
  responseBody?: string;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
}

export interface WebhookDeliveryListResponse {
  data: WebhookDelivery[];
  total: number;
  limit: number;
  hasMore: boolean;
}

export interface HealthResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  version: string;
  uptime: number;
  services: {
    database: 'healthy' | 'unhealthy';
    redis: 'healthy' | 'unhealthy';
    providers: {
      stripe: 'healthy' | 'unhealthy';
      asaas: 'healthy' | 'unhealthy';
      mercadopago: 'healthy' | 'unhealthy';
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