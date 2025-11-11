export const STRIPE_CONFIG = {
  API_VERSION: '2024-06-20' as const,
  WEBHOOK_SECRET_HEADER: 'stripe-signature' as const,
  DEFAULT_CURRENCY: 'BRL' as const,
  SUPPORTED_CURRENCIES: ['BRL', 'USD', 'EUR'] as const,
  SUPPORTED_PAYMENT_METHODS: ['card', 'boleto', 'pix'] as const,
  
  // Configurações específicas para Brasil
  BRAZIL_CONFIG: {
    statement_descriptor: 'WHATPRESS',
    payment_methods: ['card', 'boleto', 'pix'],
    capture_method: 'automatic',
    confirmation_method: 'automatic',
  },

  // Webhook events
  WEBHOOK_EVENTS: {
    PAYMENT_SUCCESS: 'payment_intent.succeeded',
    PAYMENT_FAILED: 'payment_intent.payment_failed',
    PAYMENT_CANCELED: 'payment_intent.canceled',
    REFUND_CREATED: 'charge.refunded',
    INVOICE_PAID: 'invoice.payment_succeeded',
    INVOICE_PAYMENT_FAILED: 'invoice.payment_failed',
    SETUP_INTENT_SUCCEEDED: 'setup_intent.succeeded',
    CUSTOMER_CREATED: 'customer.created',
    CUSTOMER_UPDATED: 'customer.updated',
  } as const,

  // Error codes
  ERROR_CODES: {
    CARD_DECLINED: 'card_declined',
    INSUFFICIENT_FUNDS: 'insufficient_funds',
    EXPIRED_CARD: 'expired_card',
    INCORRECT_CVC: 'incorrect_cvc',
    PROCESSING_ERROR: 'processing_error',
    NETWORK_ERROR: 'network_error',
  } as const,

  // Retry configuration
  RETRY_CONFIG: {
    max_attempts: 3,
    backoff_multiplier: 2,
    initial_delay: 1000,
  },
} as const;

export type StripeConfig = typeof STRIPE_CONFIG;