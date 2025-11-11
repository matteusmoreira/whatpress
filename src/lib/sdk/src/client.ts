import {
  WhatsPressConfig,
  Payment,
  PaymentCreateRequest,
  PaymentListResponse,
  APIKey,
  APIKeyCreateRequest,
  APIKeyListResponse,
  WebhookDeliveryListResponse,
  HealthResponse,
  WhatsPressError,
} from './types';

export class WhatsPressClient {
  private config: Required<WhatsPressConfig>;
  private baseHeaders: Record<string, string>;

  constructor(config: WhatsPressConfig) {
    this.config = {
      baseURL: 'https://api.whatpress.com',
      timeout: 30000,
      retries: 3,
      retryDelay: 1000,
      ...config,
    };

    this.baseHeaders = {
      'Content-Type': 'application/json',
      'X-API-Key': this.config.apiKey,
      'User-Agent': 'WhatsPress-JS-SDK/1.0.0',
    };
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    retryCount = 0
  ): Promise<T> {
    const url = `${this.config.baseURL}${endpoint}`;
    const controller = new AbortController();
    
    // Timeout
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          ...this.baseHeaders,
          ...options.headers,
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        
        // Retry on specific status codes
        if (retryCount < this.config.retries && this.shouldRetry(response.status)) {
          await this.delay(this.config.retryDelay * Math.pow(2, retryCount));
          return this.request<T>(endpoint, options, retryCount + 1);
        }

        throw new WhatsPressError(
          errorData.error || `HTTP ${response.status}: ${response.statusText}`,
          errorData.code,
          response.status,
          errorData.details
        );
      }

      return await response.json();
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof WhatsPressError) {
        throw error;
      }

      // Network errors or abort errors
      if (error.name === 'AbortError' && retryCount < this.config.retries) {
        await this.delay(this.config.retryDelay * Math.pow(2, retryCount));
        return this.request<T>(endpoint, options, retryCount + 1);
      }

      throw new WhatsPressError(
        'Network error occurred',
        'NETWORK_ERROR',
        0,
        { originalError: error.message }
      );
    }
  }

  private shouldRetry(statusCode: number): boolean {
    return [429, 500, 502, 503, 504].includes(statusCode);
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Payments API
  async createPayment(data: PaymentCreateRequest): Promise<Payment> {
    return this.request<Payment>('/api/v1/payments', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getPayment(id: string): Promise<Payment> {
    return this.request<Payment>(`/api/v1/payments/${id}`);
  }

  async listPayments(params?: {
    status?: 'pending' | 'processing' | 'succeeded' | 'failed' | 'cancelled' | 'refunded';
    provider?: 'stripe' | 'asaas' | 'mercadopago';
    limit?: number;
    offset?: number;
  }): Promise<PaymentListResponse> {
    const queryParams = new URLSearchParams();
    
    if (params?.status) queryParams.append('status', params.status);
    if (params?.provider) queryParams.append('provider', params.provider);
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.offset) queryParams.append('offset', params.offset.toString());

    const queryString = queryParams.toString();
    const url = `/api/v1/payments${queryString ? `?${queryString}` : ''}`;

    return this.request<PaymentListResponse>(url);
  }

  async confirmPayment(id: string): Promise<Payment> {
    return this.request<Payment>(`/api/v1/payments/${id}/confirm`, {
      method: 'POST',
    });
  }

  async cancelPayment(id: string): Promise<Payment> {
    return this.request<Payment>(`/api/v1/payments/${id}/cancel`, {
      method: 'POST',
    });
  }

  async refundPayment(id: string, amount?: number): Promise<Payment> {
    const queryParams = amount ? `?amount=${amount}` : '';
    return this.request<Payment>(`/api/v1/payments/${id}/refund${queryParams}`, {
      method: 'POST',
    });
  }

  // API Keys Management
  async createAPIKey(data: APIKeyCreateRequest): Promise<APIKey> {
    return this.request<APIKey>('/api/v1/api-keys', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async listAPIKeys(params?: {
    status?: 'active' | 'suspended' | 'revoked';
    limit?: number;
  }): Promise<APIKeyListResponse> {
    const queryParams = new URLSearchParams();
    
    if (params?.status) queryParams.append('status', params.status);
    if (params?.limit) queryParams.append('limit', params.limit.toString());

    const queryString = queryParams.toString();
    const url = `/api/v1/api-keys${queryString ? `?${queryString}` : ''}`;

    return this.request<APIKeyListResponse>(url);
  }

  async getAPIKey(id: string): Promise<APIKey> {
    return this.request<APIKey>(`/api/v1/api-keys/${id}`);
  }

  async updateAPIKey(id: string, data: Partial<APIKeyCreateRequest>): Promise<APIKey> {
    return this.request<APIKey>(`/api/v1/api-keys/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteAPIKey(id: string): Promise<void> {
    await this.request<void>(`/api/v1/api-keys/${id}`, {
      method: 'DELETE',
    });
  }

  async suspendAPIKey(id: string): Promise<APIKey> {
    return this.request<APIKey>(`/api/v1/api-keys/${id}/suspend`, {
      method: 'POST',
    });
  }

  async activateAPIKey(id: string): Promise<APIKey> {
    return this.request<APIKey>(`/api/v1/api-keys/${id}/activate`, {
      method: 'POST',
    });
  }

  // Webhooks Management
  async listWebhookDeliveries(params?: {
    eventId?: string;
    status?: 'pending' | 'delivered' | 'failed' | 'retrying';
    limit?: number;
  }): Promise<WebhookDeliveryListResponse> {
    const queryParams = new URLSearchParams();
    
    if (params?.eventId) queryParams.append('eventId', params.eventId);
    if (params?.status) queryParams.append('status', params.status);
    if (params?.limit) queryParams.append('limit', params.limit.toString());

    const queryString = queryParams.toString();
    const url = `/api/v1/webhooks/deliveries${queryString ? `?${queryString}` : ''}`;

    return this.request<WebhookDeliveryListResponse>(url);
  }

  async retryFailedWebhookDeliveries(): Promise<void> {
    await this.request<void>('/api/v1/webhooks/deliveries/retry', {
      method: 'POST',
    });
  }

  // Health Check
  async healthCheck(): Promise<HealthResponse> {
    return this.request<HealthResponse>('/health');
  }

  // Utility methods
  setApiKey(apiKey: string): void {
    this.config.apiKey = apiKey;
    this.baseHeaders['X-API-Key'] = apiKey;
  }

  setBaseURL(baseURL: string): void {
    this.config.baseURL = baseURL;
  }

  setTimeout(timeout: number): void {
    this.config.timeout = timeout;
  }

  setRetryConfig(retries: number, retryDelay: number): void {
    this.config.retries = retries;
    this.config.retryDelay = retryDelay;
  }

  // Batch operations
  async createPayments(payments: PaymentCreateRequest[]): Promise<Payment[]> {
    return Promise.all(payments.map(payment => this.createPayment(payment)));
  }

  async getPayments(ids: string[]): Promise<Payment[]> {
    return Promise.all(ids.map(id => this.getPayment(id)));
  }

  async confirmPayments(ids: string[]): Promise<Payment[]> {
    return Promise.all(ids.map(id => this.confirmPayment(id)));
  }

  async cancelPayments(ids: string[]): Promise<Payment[]> {
    return Promise.all(ids.map(id => this.cancelPayment(id)));
  }

  async refundPayments(ids: string[]): Promise<Payment[]> {
    return Promise.all(ids.map(id => this.refundPayment(id)));
  }
}