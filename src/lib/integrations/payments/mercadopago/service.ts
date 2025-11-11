import { PaymentProviderConfig, CreatePaymentData, Payment } from '@/lib/sdk/types';
import { MERCADOPAGO_CONFIG } from './config';

interface MercadoPagoPaymentResponse {
  id: number;
  date_created: string;
  date_approved?: string;
  date_last_updated: string;
  money_release_date?: string;
  operation_type: string;
  issuer_id?: string;
  payment_method_id: string;
  payment_type_id: string;
  status: string;
  status_detail: string;
  currency_id: string;
  description: string;
  live_mode: boolean;
  sponsor_id?: string;
  authorization_code?: string;
  money_release_schema?: string;
  taxes_amount: number;
  counter_currency?: string;
  brand_id?: string;
  shipping_amount: number;
  pos_id?: string;
  store_id?: string;
  integrator_id?: string;
  platform_id?: string;
  corporation_id?: string;
  collector_id: number;
  payer: {
    type: string;
    id?: string;
    operator_id?: string;
    first_name?: string;
    last_name?: string;
    email?: string;
    identification?: {
      type: string;
      number: string;
    };
    phone?: {
      area_code: string;
      number: string;
      extension?: string;
    };
    entity_type?: string;
  };
  metadata: any;
  additional_info?: {
    ip_address?: string;
    items?: Array<{
      id?: string;
      title?: string;
      description?: string;
      picture_url?: string;
      category_id?: string;
      quantity?: string;
      unit_price?: string;
    }>;
    payer?: {
      first_name?: string;
      last_name?: string;
      phone?: {
        area_code?: string;
        number?: string;
      };
      address?: {
        zip_code?: string;
        street_name?: string;
        street_number?: string;
      };
    };
    shipments?: {
      receiver_address?: {
        zip_code?: string;
        street_name?: string;
        street_number?: string;
        floor?: string;
        apartment?: string;
        city_name?: string;
        state_name?: string;
        country_name?: string;
      };
    };
  };
  transaction_amount: number;
  transaction_amount_refunded: number;
  coupon_amount: number;
  differential_pricing_id?: string;
  deduction_schema?: string;
  callback_url?: string;
  installments: number;
  token?: string;
  external_reference?: string;
  transaction_details: {
    payment_method_reference_id?: string;
    acquirer_reference?: string;
    net_received_amount: number;
    total_paid_amount: number;
    overpaid_amount: number;
    external_resource_url?: string;
    installment_amount?: number;
    financial_institution?: string;
    payable_deferral_option_id?: string;
    bank_transfer_id?: string;
    transaction_id?: string;
  };
  fee_details: Array<{
    type: string;
    amount: number;
    fee_payer: string;
  }>;
  charges_details: Array<{
    id: string;
    name: string;
    type: string;
    amount: number;
    metadata: any;
    date_created: string;
    date_last_updated: string;
    refunds: any[];
  }>;
  captured: boolean;
  binary_mode: boolean;
  call_for_authorize_id?: string;
  statement_descriptor: string;
  card?: {
    id?: string;
    first_six_digits: string;
    last_four_digits: string;
    expiration_month: number;
    expiration_year: number;
    date_created: string;
    date_last_updated: string;
    cardholder: {
      name: string;
      identification: {
        type: string;
        number: string;
      };
    };
  };
  notification_url?: string;
  refunds: any[];
}

export class MercadoPagoService {
  private config: PaymentProviderConfig;
  private baseUrl: string;
  private accessToken: string;

  constructor(config: PaymentProviderConfig) {
    this.config = config;
    this.baseUrl = MERCADOPAGO_CONFIG.BASE_URL;
    this.accessToken = config.config.secret_key;
  }

  async createPayment(data: CreatePaymentData): Promise<Payment> {
    try {
      const mpData = {
        transaction_amount: data.amount,
        description: data.description,
        payment_method_id: this.mapPaymentMethod(data.payment_method),
        payer: {
          email: data.customer_email,
          identification: {
            type: 'CPF',
            number: data.customer_document || '',
          },
        },
        installments: data.installments || 1,
        token: data.payment_token,
        external_reference: data.order_id,
        notification_url: data.notification_url,
        callback_url: data.return_url,
        statement_descriptor: MERCADOPAGO_CONFIG.PAYMENT_CONFIG.statement_descriptor,
        capture: true,
        binary_mode: false,
        additional_info: {
          items: data.items?.map(item => ({
            id: item.id,
            title: item.name,
            description: item.description,
            quantity: item.quantity.toString(),
            unit_price: item.price.toString(),
          })),
        },
        metadata: data.metadata,
      };

      const response = await this.makeRequest('POST', '/v1/payments', mpData);
      return this.mapMercadoPagoPaymentToPayment(response);
    } catch (error) {
      throw this.handleMercadoPagoError(error);
    }
  }

  async createCreditCardPayment(data: CreatePaymentData & {
    credit_card: {
      token: string;
      issuer_id: string;
      payment_method_id: string;
    };
  }): Promise<Payment> {
    try {
      const mpData = {
        transaction_amount: data.amount,
        description: data.description,
        payment_method_id: data.credit_card.payment_method_id,
        token: data.credit_card.token,
        issuer_id: data.credit_card.issuer_id,
        payer: {
          email: data.customer_email,
          identification: {
            type: 'CPF',
            number: data.customer_document || '',
          },
        },
        installments: data.installments || 1,
        external_reference: data.order_id,
        notification_url: data.notification_url,
        callback_url: data.return_url,
        statement_descriptor: MERCADOPAGO_CONFIG.PAYMENT_CONFIG.statement_descriptor,
        capture: true,
        binary_mode: false,
        additional_info: {
          items: data.items?.map(item => ({
            id: item.id,
            title: item.name,
            description: item.description,
            quantity: item.quantity.toString(),
            unit_price: item.price.toString(),
          })),
        },
        metadata: data.metadata,
      };

      const response = await this.makeRequest('POST', '/v1/payments', mpData);
      return this.mapMercadoPagoPaymentToPayment(response);
    } catch (error) {
      throw this.handleMercadoPagoError(error);
    }
  }

  async createPixPayment(data: CreatePaymentData): Promise<Payment> {
    try {
      const mpData = {
        transaction_amount: data.amount,
        description: data.description,
        payment_method_id: 'pix',
        payer: {
          email: data.customer_email,
          first_name: data.customer_name?.split(' ')[0],
          last_name: data.customer_name?.split(' ').slice(1).join(' '),
          identification: {
            type: 'CPF',
            number: data.customer_document || '',
          },
        },
        external_reference: data.order_id,
        notification_url: data.notification_url,
        callback_url: data.return_url,
        statement_descriptor: MERCADOPAGO_CONFIG.PAYMENT_CONFIG.statement_descriptor,
        additional_info: {
          items: data.items?.map(item => ({
            id: item.id,
            title: item.name,
            description: item.description,
            quantity: item.quantity.toString(),
            unit_price: item.price.toString(),
          })),
        },
        metadata: data.metadata,
        date_of_expiration: this.getPixExpirationDate(),
      };

      const response = await this.makeRequest('POST', '/v1/payments', mpData);
      return this.mapMercadoPagoPaymentToPayment(response);
    } catch (error) {
      throw this.handleMercadoPagoError(error);
    }
  }

  async createBoletoPayment(data: CreatePaymentData): Promise<Payment> {
    try {
      const mpData = {
        transaction_amount: data.amount,
        description: data.description,
        payment_method_id: 'bolbradesco',
        payer: {
          email: data.customer_email,
          first_name: data.customer_name?.split(' ')[0],
          last_name: data.customer_name?.split(' ').slice(1).join(' '),
          identification: {
            type: 'CPF',
            number: data.customer_document || '',
          },
          address: {
            zip_code: data.billing_address?.zip_code,
            street_name: data.billing_address?.street,
            street_number: data.billing_address?.number,
            neighborhood: data.billing_address?.neighborhood,
            city: data.billing_address?.city,
            federal_unit: data.billing_address?.state,
          },
        },
        external_reference: data.order_id,
        notification_url: data.notification_url,
        callback_url: data.return_url,
        statement_descriptor: MERCADOPAGO_CONFIG.PAYMENT_CONFIG.statement_descriptor,
        additional_info: {
          items: data.items?.map(item => ({
            id: item.id,
            title: item.name,
            description: item.description,
            quantity: item.quantity.toString(),
            unit_price: item.price.toString(),
          })),
        },
        metadata: data.metadata,
        date_of_expiration: this.getBoletoExpirationDate(),
      };

      const response = await this.makeRequest('POST', '/v1/payments', mpData);
      return this.mapMercadoPagoPaymentToPayment(response);
    } catch (error) {
      throw this.handleMercadoPagoError(error);
    }
  }

  async confirmPayment(paymentId: string): Promise<Payment> {
    try {
      const response = await this.makeRequest('PUT', `/v1/payments/${paymentId}`, {
        status: 'approved',
      });
      return this.mapMercadoPagoPaymentToPayment(response);
    } catch (error) {
      throw this.handleMercadoPagoError(error);
    }
  }

  async cancelPayment(paymentId: string): Promise<Payment> {
    try {
      const response = await this.makeRequest('PUT', `/v1/payments/${paymentId}`, {
        status: 'cancelled',
      });
      return this.mapMercadoPagoPaymentToPayment(response);
    } catch (error) {
      throw this.handleMercadoPagoError(error);
    }
  }

  async createRefund(paymentId: string, amount?: number): Promise<Payment> {
    try {
      const refundData = amount ? { amount } : {};
      await this.makeRequest('POST', `/v1/payments/${paymentId}/refunds`, refundData);
      
      // Get updated payment
      const response = await this.makeRequest('GET', `/v1/payments/${paymentId}`);
      return this.mapMercadoPagoPaymentToPayment(response);
    } catch (error) {
      throw this.handleMercadoPagoError(error);
    }
  }

  async getPayment(paymentId: string): Promise<Payment> {
    try {
      const response = await this.makeRequest('GET', `/v1/payments/${paymentId}`);
      return this.mapMercadoPagoPaymentToPayment(response);
    } catch (error) {
      throw this.handleMercadoPagoError(error);
    }
  }

  async createCustomer(customerData: {
    email: string;
    first_name: string;
    last_name: string;
    phone?: {
      area_code: string;
      number: string;
    };
    identification: {
      type: string;
      number: string;
    };
    address?: {
      zip_code: string;
      street_name: string;
      street_number: string;
      city_name?: string;
      state_name?: string;
      country_name?: string;
    };
    default_address?: string;
    default_card?: string;
  }): Promise<string> {
    try {
      const response = await this.makeRequest('POST', '/v1/customers', customerData);
      return response.id;
    } catch (error) {
      throw this.handleMercadoPagoError(error);
    }
  }

  async updateCustomer(customerId: string, customerData: Partial<{
    email: string;
    first_name: string;
    last_name: string;
    phone: {
      area_code: string;
      number: string;
    };
    identification: {
      type: string;
      number: string;
    };
    address: {
      zip_code: string;
      street_name: string;
      street_number: string;
      city_name?: string;
      state_name?: string;
      country_name?: string;
    };
    default_address: string;
    default_card: string;
  }>): Promise<void> {
    try {
      await this.makeRequest('PUT', `/v1/customers/${customerId}`, customerData);
    } catch (error) {
      throw this.handleMercadoPagoError(error);
    }
  }

  async createCardToken(cardData: {
    card_number: string;
    security_code: string;
    expiration_month: string;
    expiration_year: string;
    cardholder: {
      name: string;
      identification: {
        type: string;
        number: string;
      };
    };
  }): Promise<string> {
    try {
      const response = await this.makeRequest('POST', '/v1/card_tokens', cardData);
      return response.id;
    } catch (error) {
      throw this.handleMercadoPagoError(error);
    }
  }

  private async makeRequest(method: string, endpoint: string, data?: any): Promise<any> {
    const url = `${this.baseUrl}${endpoint}`;
    
    const options: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.accessToken}`,
        'User-Agent': 'WhatPress/1.0',
      },
    };

    if (data && method !== 'GET') {
      options.body = JSON.stringify(data);
    }

    const response = await fetch(url, options);
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(`MercadoPago API error: ${error.message || 'Unknown error'}`);
    }

    return await response.json();
  }

  private mapPaymentMethod(paymentMethod?: string): string {
    const methodMap: Record<string, string> = {
      'credit_card': 'master',
      'debit_card': 'visa',
      'pix': 'pix',
      'boleto': 'bolbradesco',
      'ticket': 'bolbradesco',
      'bank_transfer': 'bank_transfer',
    };
    
    return methodMap[paymentMethod || ''] || 'master';
  }

  private mapMercadoPagoPaymentToPayment(mpPayment: MercadoPagoPaymentResponse): Payment {
    return {
      id: mpPayment.id.toString(),
      provider_id: this.config.id,
      provider_name: 'mercadopago',
      order_id: mpPayment.external_reference,
      customer_id: mpPayment.payer?.id,
      amount: mpPayment.transaction_amount,
      currency: mpPayment.currency_id.toLowerCase(),
      status: this.mapMercadoPagoStatusToPaymentStatus(mpPayment.status),
      payment_method: this.mapMercadoPagoPaymentTypeToPaymentMethod(mpPayment.payment_type_id),
      provider_response: {
        mercadopago_payment_id: mpPayment.id,
        status_detail: mpPayment.status_detail,
        payment_method_id: mpPayment.payment_method_id,
        payment_type_id: mpPayment.payment_type_id,
        installments: mpPayment.installments,
        captured: mpPayment.captured,
        binary_mode: mpPayment.binary_mode,
        statement_descriptor: mpPayment.statement_descriptor,
        card_first_six_digits: mpPayment.card?.first_six_digits,
        card_last_four_digits: mpPayment.card?.last_four_digits,
        transaction_details: mpPayment.transaction_details,
        fee_details: mpPayment.fee_details,
        charges_details: mpPayment.charges_details,
        refunds: mpPayment.refunds,
      },
      metadata: mpPayment.metadata,
      created_at: new Date(mpPayment.date_created).toISOString(),
      updated_at: new Date(mpPayment.date_last_updated).toISOString(),
      paid_at: mpPayment.date_approved ? new Date(mpPayment.date_approved).toISOString() : null,
      refunded_amount: mpPayment.transaction_amount_refunded,
      installments: mpPayment.installments,
      fraud_score: 0,
      billing_address: this.extractBillingAddress(mpPayment),
      error_message: mpPayment.status_detail,
    };
  }

  private mapMercadoPagoStatusToPaymentStatus(status: string): string {
    const statusMap: Record<string, string> = {
      'approved': 'paid',
      'authorized': 'authorized',
      'in_process': 'processing',
      'in_mediation': 'mediation',
      'pending': 'pending',
      'rejected': 'rejected',
      'cancelled': 'canceled',
      'refunded': 'refunded',
      'charged_back': 'chargeback',
    };
    
    return statusMap[status] || 'pending';
  }

  private mapMercadoPagoPaymentTypeToPaymentMethod(paymentTypeId: string): string {
    const methodMap: Record<string, string> = {
      'credit_card': 'credit_card',
      'debit_card': 'debit_card',
      'ticket': 'boleto',
      'bank_transfer': 'bank_transfer',
      'atm': 'atm',
      'prepaid_card': 'prepaid_card',
      'account_money': 'account_money',
      'digital_currency': 'digital_currency',
      'digital_wallet': 'digital_wallet',
      'voucher_card': 'voucher_card',
      'gift_card': 'gift_card',
      'pix': 'pix',
    };
    
    return methodMap[paymentTypeId] || 'unknown';
  }

  private extractBillingAddress(mpPayment: MercadoPagoPaymentResponse): any {
    const additionalInfo = mpPayment.additional_info;
    if (!additionalInfo?.payer?.address) return null;
    
    const address = additionalInfo.payer.address;
    return {
      street: address.street_name,
      number: address.street_number,
      city: address.city_name,
      state: address.state_name,
      zip_code: address.zip_code,
      country: address.country_name,
    };
  }

  private getPixExpirationDate(): string {
    const date = new Date();
    date.setHours(date.getHours() + 24); // 24 hours from now
    return date.toISOString();
  }

  private getBoletoExpirationDate(): string {
    const date = new Date();
    date.setDate(date.getDate() + MERCADOPAGO_CONFIG.PAYMENT_CONFIG.expiration_date);
    return date.toISOString();
  }

  private handleMercadoPagoError(error: any): Error {
    if (error.message?.includes('MercadoPago API error')) {
      return error;
    }
    
    return new Error(`MercadoPago error: ${error.message || 'Unknown error'}`);
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.makeRequest('GET', '/v1/payments/search?limit=1');
      return true;
    } catch (error) {
      console.error('MercadoPago connection test failed:', error);
      return false;
    }
  }
}