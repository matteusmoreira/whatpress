import { PaymentProviderConfig, CreatePaymentData, Payment } from '@/lib/sdk/types';
import { ASAAS_CONFIG } from './config';

interface AsaasPaymentResponse {
  object: string;
  id: string;
  dateCreated: string;
  customer: string;
  paymentLink?: string;
  value: number;
  netValue: number;
  originalValue?: number;
  interestValue?: number;
  description?: string;
  billingType: string;
  status: string;
  dueDate: string;
  originalDueDate?: string;
  paymentDate?: string;
  customerPaymentDate?: string;
  installmentNumber?: number;
  invoiceUrl: string;
  invoiceNumber: string;
  externalReference?: string;
  deleted?: boolean;
  anticipated?: boolean;
  anticipable?: boolean;
  creditDate?: string;
  estimatedCreditDate?: string;
  transactionReceiptUrl?: string;
  bankSlipUrl?: string;
  lastInvoiceViewedDate?: string;
  lastBankSlipViewedDate?: string;
  postalService?: boolean;
  custody?: string;
  refunds?: any[];
}

interface AsaasCustomerResponse {
  object: string;
  id: string;
  dateCreated: string;
  name: string;
  email: string;
  phone?: string;
  mobilePhone?: string;
  address?: {
    address: string;
    addressNumber: string;
    complement?: string;
    province: string;
    postalCode: string;
    city: string;
    state: string;
    country: string;
  };
  cpfCnpj: string;
  personType: 'FISICA' | 'JURIDICA';
  company?: string;
  externalReference?: string;
  notificationDisabled: boolean;
  city: number;
  state: string;
  country: string;
  complement?: string;
  postalCode: string;
  cpfCnpj: string;
}

export class AsaasService {
  private config: PaymentProviderConfig;
  private baseUrl: string;
  private apiKey: string;

  constructor(config: PaymentProviderConfig) {
    this.config = config;
    this.baseUrl = config.config.sandbox 
      ? ASAAS_CONFIG.SANDBOX_URL 
      : ASAAS_CONFIG.BASE_URL;
    this.apiKey = config.config.secret_key;
  }

  async createPayment(data: CreatePaymentData): Promise<Payment> {
    try {
      const asaasData = {
        customer: data.customer_id,
        billingType: this.mapPaymentMethod(data.payment_method),
        value: data.amount,
        dueDate: data.due_date || this.getDefaultDueDate(),
        description: data.description,
        externalReference: data.order_id,
        installmentCount: data.installments || 1,
        installmentValue: data.installments ? data.amount / data.installments : undefined,
        postalService: false,
      };

      const response = await this.makeRequest('POST', '/payments', asaasData);
      return this.mapAsaasPaymentToPayment(response);
    } catch (error) {
      throw this.handleAsaasError(error);
    }
  }

  async createCreditCardPayment(data: CreatePaymentData & {
    credit_card: {
      holderName: string;
      number: string;
      expiryMonth: string;
      expiryYear: string;
      ccv: string;
    };
    credit_card_holder_info: {
      name: string;
      email: string;
      cpfCnpj: string;
      postalCode: string;
      addressNumber: string;
      addressComplement?: string;
      phone?: string;
      mobilePhone?: string;
    };
  }): Promise<Payment> {
    try {
      const asaasData = {
        customer: data.customer_id,
        billingType: 'CREDIT_CARD',
        value: data.amount,
        dueDate: data.due_date || this.getDefaultDueDate(),
        description: data.description,
        externalReference: data.order_id,
        creditCard: {
          holderName: data.credit_card.holderName,
          number: data.credit_card.number,
          expiryMonth: data.credit_card.expiryMonth,
          expiryYear: data.credit_card.expiryYear,
          ccv: data.credit_card.ccv,
        },
        creditCardHolderInfo: data.credit_card_holder_info,
        installmentCount: data.installments || 1,
        installmentValue: data.installments ? data.amount / data.installments : undefined,
      };

      const response = await this.makeRequest('POST', '/payments', asaasData);
      return this.mapAsaasPaymentToPayment(response);
    } catch (error) {
      throw this.handleAsaasError(error);
    }
  }

  async createPixPayment(data: CreatePaymentData): Promise<Payment> {
    try {
      const asaasData = {
        customer: data.customer_id,
        billingType: 'PIX',
        value: data.amount,
        dueDate: data.due_date || this.getDefaultDueDate(),
        description: data.description,
        externalReference: data.order_id,
      };

      const response = await this.makeRequest('POST', '/payments', asaasData);
      return this.mapAsaasPaymentToPayment(response);
    } catch (error) {
      throw this.handleAsaasError(error);
    }
  }

  async createBoletoPayment(data: CreatePaymentData): Promise<Payment> {
    try {
      const asaasData = {
        customer: data.customer_id,
        billingType: 'BOLETO',
        value: data.amount,
        dueDate: data.due_date || this.getDefaultDueDate(),
        description: data.description,
        externalReference: data.order_id,
        postalService: false,
      };

      const response = await this.makeRequest('POST', '/payments', asaasData);
      return this.mapAsaasPaymentToPayment(response);
    } catch (error) {
      throw this.handleAsaasError(error);
    }
  }

  async confirmPayment(paymentId: string): Promise<Payment> {
    try {
      // Asaas doesn't have a separate confirm endpoint
      // Payments are confirmed automatically or through webhooks
      return await this.getPayment(paymentId);
    } catch (error) {
      throw this.handleAsaasError(error);
    }
  }

  async cancelPayment(paymentId: string): Promise<Payment> {
    try {
      const response = await this.makeRequest('DELETE', `/payments/${paymentId}`);
      return this.mapAsaasPaymentToPayment(response);
    } catch (error) {
      throw this.handleAsaasError(error);
    }
  }

  async createRefund(paymentId: string, amount?: number): Promise<Payment> {
    try {
      const refundData = amount ? { value: amount } : {};
      const response = await this.makeRequest('POST', `/payments/${paymentId}/refund`, refundData);
      return this.mapAsaasPaymentToPayment(response);
    } catch (error) {
      throw this.handleAsaasError(error);
    }
  }

  async getPayment(paymentId: string): Promise<Payment> {
    try {
      const response = await this.makeRequest('GET', `/payments/${paymentId}`);
      return this.mapAsaasPaymentToPayment(response);
    } catch (error) {
      throw this.handleAsaasError(error);
    }
  }

  async createCustomer(customerData: {
    name: string;
    email: string;
    cpfCnpj: string;
    phone?: string;
    mobilePhone?: string;
    address?: {
      address: string;
      number: string;
      complement?: string;
      province: string;
      postalCode: string;
      city: string;
      state: string;
      country?: string;
    };
    personType: 'FISICA' | 'JURIDICA';
    company?: string;
    externalReference?: string;
  }): Promise<string> {
    try {
      const response = await this.makeRequest('POST', '/customers', customerData);
      return response.id;
    } catch (error) {
      throw this.handleAsaasError(error);
    }
  }

  async updateCustomer(customerId: string, customerData: Partial<{
    name: string;
    email: string;
    phone: string;
    mobilePhone: string;
    address: {
      address: string;
      number: string;
      complement?: string;
      province: string;
      postalCode: string;
      city: string;
      state: string;
      country: string;
    };
    cpfCnpj: string;
    personType: 'FISICA' | 'JURIDICA';
    company: string;
    externalReference: string;
  }>): Promise<void> {
    try {
      await this.makeRequest('PUT', `/customers/${customerId}`, customerData);
    } catch (error) {
      throw this.handleAsaasError(error);
    }
  }

  async getCustomer(customerId: string): Promise<AsaasCustomerResponse> {
    try {
      return await this.makeRequest('GET', `/customers/${customerId}`);
    } catch (error) {
      throw this.handleAsaasError(error);
    }
  }

  private async makeRequest(method: string, endpoint: string, data?: any): Promise<any> {
    const url = `${this.baseUrl}${endpoint}`;
    
    const options: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
        'access_token': this.apiKey,
        'User-Agent': 'WhatPress/1.0',
      },
    };

    if (data && method !== 'GET') {
      options.body = JSON.stringify(data);
    }

    const response = await fetch(url, options);
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Asaas API error: ${error.errors?.[0]?.description || error.message || 'Unknown error'}`);
    }

    return await response.json();
  }

  private mapPaymentMethod(paymentMethod?: string): string {
    const methodMap: Record<string, string> = {
      'credit_card': 'CREDIT_CARD',
      'debit_card': 'DEBIT_CARD',
      'boleto': 'BOLETO',
      'pix': 'PIX',
    };
    
    return methodMap[paymentMethod || ''] || 'UNDEFINED';
  }

  private mapAsaasPaymentToPayment(asaasPayment: AsaasPaymentResponse): Payment {
    return {
      id: asaasPayment.id,
      provider_id: this.config.id,
      provider_name: 'asaas',
      order_id: asaasPayment.externalReference,
      customer_id: asaasPayment.customer,
      amount: asaasPayment.value,
      currency: 'BRL',
      status: this.mapAsaasStatusToPaymentStatus(asaasPayment.status),
      payment_method: this.mapAsaasBillingTypeToPaymentMethod(asaasPayment.billingType),
      provider_response: {
        asaas_payment_id: asaasPayment.id,
        invoice_url: asaasPayment.invoiceUrl,
        bank_slip_url: asaasPayment.bankSlipUrl,
        invoice_number: asaasPayment.invoiceNumber,
        net_value: asaasPayment.netValue,
        original_value: asaasPayment.originalValue,
        interest_value: asaasPayment.interestValue,
        installment_number: asaasPayment.installmentNumber,
        transaction_receipt_url: asaasPayment.transactionReceiptUrl,
        refunds: asaasPayment.refunds,
      },
      metadata: {
        external_reference: asaasPayment.externalReference,
        anticipated: asaasPayment.anticipated,
        anticipable: asaasPayment.anticipable,
        postal_service: asaasPayment.postalService,
        custody: asaasPayment.custody,
      },
      created_at: new Date(asaasPayment.dateCreated).toISOString(),
      updated_at: new Date().toISOString(),
      paid_at: asaasPayment.paymentDate ? new Date(asaasPayment.paymentDate).toISOString() : null,
      due_date: new Date(asaasPayment.dueDate).toISOString(),
      refunded_amount: 0,
      installments: asaasPayment.installmentNumber || 1,
      fraud_score: 0,
      error_message: undefined,
    };
  }

  private mapAsaasStatusToPaymentStatus(status: string): string {
    const statusMap: Record<string, string> = {
      'PENDING': 'pending',
      'RECEIVED': 'processing',
      'CONFIRMED': 'paid',
      'OVERDUE': 'overdue',
      'CANCELED': 'canceled',
      'REFUNDED': 'refunded',
      'REVERSED': 'reversed',
      'CHARGEBACK_REQUESTED': 'chargeback_requested',
      'CHARGEBACK_DISPUTE': 'chargeback_dispute',
      'AWAITING_RISK_ANALYSIS': 'processing',
      'APPROVED_BY_RISK_ANALYSIS': 'approved',
      'REPROVED_BY_RISK_ANALYSIS': 'rejected',
      'RECOVERED': 'recovered',
      'RECOVERY_IN_PROTEST': 'protest',
      'IN_PROTEST': 'protest',
    };
    
    return statusMap[status] || 'pending';
  }

  private mapAsaasBillingTypeToPaymentMethod(billingType: string): string {
    const methodMap: Record<string, string> = {
      'CREDIT_CARD': 'credit_card',
      'DEBIT_CARD': 'debit_card',
      'BOLETO': 'boleto',
      'PIX': 'pix',
      'UNDEFINED': 'undefined',
    };
    
    return methodMap[billingType] || 'unknown';
  }

  private getDefaultDueDate(): string {
    const date = new Date();
    date.setDate(date.getDate() + ASAAS_CONFIG.PAYMENT_CONFIG.due_date_limit_days);
    return date.toISOString().split('T')[0];
  }

  private handleAsaasError(error: any): Error {
    if (error.message?.includes('Asaas API error')) {
      return error;
    }
    
    return new Error(`Asaas error: ${error.message || 'Unknown error'}`);
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.makeRequest('GET', '/customers?limit=1');
      return true;
    } catch (error) {
      console.error('Asaas connection test failed:', error);
      return false;
    }
  }
}