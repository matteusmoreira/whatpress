import { Router, Request, Response } from 'express'
import swaggerJsdoc from 'swagger-jsdoc'
import swaggerUi from 'swagger-ui-express'

/**
 * Configuração do Swagger/OpenAPI
 */
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'WhatPress API',
      version: '1.0.0',
      description: 'API completa para gerenciamento de campanhas de marketing e automação',
      contact: {
        name: 'WhatPress Support',
        email: 'support@whatpress.com'
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT'
      }
    },
    servers: [
      {
        url: 'https://api.whatpress.com',
        description: 'Production server'
      },
      {
        url: 'http://localhost:3001',
        description: 'Development server'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT'
        },
        apiKey: {
          type: 'apiKey',
          in: 'header',
          name: 'X-API-Key'
        }
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            error: {
              type: 'string',
              description: 'Error message'
            },
            code: {
              type: 'string',
              description: 'Error code'
            }
          }
        },
        Campaign: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
              description: 'Campaign ID'
            },
            name: {
              type: 'string',
              description: 'Campaign name'
            },
            type: {
              type: 'string',
              enum: ['email', 'sms', 'whatsapp'],
              description: 'Campaign type'
            },
            subject: {
              type: 'string',
              description: 'Campaign subject'
            },
            content: {
              type: 'string',
              description: 'Campaign content'
            },
            status: {
              type: 'string',
              enum: ['draft', 'scheduled', 'sending', 'sent', 'paused', 'cancelled'],
              description: 'Campaign status'
            },
            created_at: {
              type: 'string',
              format: 'date-time',
              description: 'Creation timestamp'
            },
            updated_at: {
              type: 'string',
              format: 'date-time',
              description: 'Last update timestamp'
            }
          }
        },
        Contact: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
              description: 'Contact ID'
            },
            email: {
              type: 'string',
              format: 'email',
              description: 'Contact email'
            },
            name: {
              type: 'string',
              description: 'Contact name'
            },
            phone: {
              type: 'string',
              description: 'Contact phone'
            },
            status: {
              type: 'string',
              enum: ['active', 'inactive', 'unsubscribed', 'bounced'],
              description: 'Contact status'
            },
            tags: {
              type: 'array',
              items: {
                type: 'string'
              },
              description: 'Contact tags'
            },
            created_at: {
              type: 'string',
              format: 'date-time',
              description: 'Creation timestamp'
            }
          }
        },
        ContactList: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
              description: 'List ID'
            },
            name: {
              type: 'string',
              description: 'List name'
            },
            description: {
              type: 'string',
              description: 'List description'
            },
            contacts_count: {
              type: 'integer',
              description: 'Number of contacts in the list'
            },
            created_at: {
              type: 'string',
              format: 'date-time',
              description: 'Creation timestamp'
            }
          }
        },
        CRMIntegration: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
              description: 'Integration ID'
            },
            name: {
              type: 'string',
              description: 'Integration name'
            },
            type: {
              type: 'string',
              enum: ['salesforce', 'hubspot', 'pipedrive'],
              description: 'CRM type'
            },
            status: {
              type: 'string',
              enum: ['active', 'inactive', 'error'],
              description: 'Integration status'
            },
            last_sync: {
              type: 'string',
              format: 'date-time',
              description: 'Last sync timestamp'
            },
            created_at: {
              type: 'string',
              format: 'date-time',
              description: 'Creation timestamp'
            }
          }
        },
        Webhook: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
              description: 'Webhook ID'
            },
            name: {
              type: 'string',
              description: 'Webhook name'
            },
            url: {
              type: 'string',
              format: 'uri',
              description: 'Webhook URL'
            },
            events: {
              type: 'array',
              items: {
                type: 'string'
              },
              description: 'Events that trigger this webhook'
            },
            status: {
              type: 'string',
              enum: ['active', 'inactive', 'error'],
              description: 'Webhook status'
            },
            retry_config: {
              type: 'object',
              properties: {
                max_attempts: {
                  type: 'integer',
                  description: 'Maximum retry attempts'
                },
                backoff_multiplier: {
                  type: 'number',
                  description: 'Backoff multiplier for retries'
                },
                initial_delay: {
                  type: 'integer',
                  description: 'Initial retry delay in milliseconds'
                }
              }
            },
            created_at: {
              type: 'string',
              format: 'date-time',
              description: 'Creation timestamp'
            }
          }
        },
        Metrics: {
          type: 'object',
          properties: {
            campaigns: {
              type: 'object',
              properties: {
                total: {
                  type: 'integer',
                  description: 'Total campaigns'
                },
                by_status: {
                  type: 'object',
                  additionalProperties: {
                    type: 'integer'
                  }
                }
              }
            },
            contacts: {
              type: 'object',
              properties: {
                total: {
                  type: 'integer',
                  description: 'Total contacts'
                },
                by_status: {
                  type: 'object',
                  additionalProperties: {
                    type: 'integer'
                  }
                }
              }
            },
            period: {
              type: 'object',
              properties: {
                start: {
                  type: 'string',
                  format: 'date-time'
                },
                end: {
                  type: 'string',
                  format: 'date-time'
                }
              }
            }
          }
        },
        APIKey: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
              description: 'API Key ID'
            },
            name: {
              type: 'string',
              description: 'Key name'
            },
            key: {
              type: 'string',
              description: 'API Key (only shown on creation)'
            },
            permissions: {
              type: 'array',
              items: {
                type: 'string'
              },
              description: 'Key permissions'
            },
            rate_limit: {
              type: 'object',
              properties: {
                requests_per_minute: {
                  type: 'integer'
                },
                requests_per_hour: {
                  type: 'integer'
                },
                requests_per_day: {
                  type: 'integer'
                }
              }
            },
            last_used: {
              type: 'string',
              format: 'date-time',
              description: 'Last usage timestamp'
            },
            created_at: {
              type: 'string',
              format: 'date-time',
              description: 'Creation timestamp'
            }
          }
        },
        AutomationPlatform: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            platform: { type: 'string', enum: ['zapier', 'make', 'n8n', 'custom'] },
            webhook_url: { type: 'string', format: 'uri' },
            events: { type: 'array', items: { type: 'string' } },
            config: {
              type: 'object',
              properties: {
                api_key: { type: 'string' },
                secret: { type: 'string' },
                headers: { type: 'object', additionalProperties: { type: 'string' } },
                auth_type: { type: 'string', enum: ['none', 'api_key', 'bearer', 'basic'] },
                retry_config: {
                  type: 'object',
                  properties: {
                    max_attempts: { type: 'number', minimum: 1, maximum: 10 },
                    backoff_multiplier: { type: 'number', minimum: 1, maximum: 5 },
                    initial_delay: { type: 'number', minimum: 1000 }
                  }
                }
              }
            },
            status: { type: 'string', enum: ['active', 'inactive', 'error'] },
            created_at: { type: 'string', format: 'date-time' },
            updated_at: { type: 'string', format: 'date-time' }
          },
          required: ['id', 'name', 'platform', 'webhook_url', 'events', 'config', 'status', 'created_at', 'updated_at']
        },
        AutomationStats: {
          type: 'object',
          properties: {
            total_automations: { type: 'integer' },
            active_automations: { type: 'integer' },
            total_triggers: { type: 'integer' },
            total_actions: { type: 'integer' },
            success_rate: { type: 'number' }
          }
        },
        PaymentProvider: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
              description: 'Provider ID'
            },
            name: {
              type: 'string',
              description: 'Provider name'
            },
            provider: {
              type: 'string',
              enum: ['stripe', 'mercadopago', 'asaas'],
              description: 'Provider type'
            },
            status: {
              type: 'string',
              enum: ['active', 'inactive', 'testing'],
              description: 'Provider status'
            },
            config: {
              type: 'object',
              properties: {
                public_key: { type: 'string' },
                sandbox: { type: 'boolean' },
                currency: { type: 'string' },
                country: { type: 'string' }
              }
            },
            created_at: {
              type: 'string',
              format: 'date-time',
              description: 'Creation timestamp'
            },
            updated_at: {
              type: 'string',
              format: 'date-time',
              description: 'Last update timestamp'
            }
          }
        },
        Payment: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
              description: 'Payment ID'
            },
            amount: {
              type: 'number',
              format: 'float',
              description: 'Payment amount'
            },
            currency: {
              type: 'string',
              description: 'Payment currency'
            },
            status: {
              type: 'string',
              enum: ['pending', 'succeeded', 'failed', 'cancelled', 'refunded'],
              description: 'Payment status'
            },
            customer_id: {
              type: 'string',
              description: 'Customer ID'
            },
            provider_payment_id: {
              type: 'string',
              description: 'Provider payment ID'
            },
            created_at: {
              type: 'string',
              format: 'date-time',
              description: 'Creation timestamp'
            }
          }
        },
        PaymentStats: {
          type: 'object',
          properties: {
            total_amount: {
              type: 'number',
              format: 'float',
              description: 'Total amount processed'
            },
            total_transactions: {
              type: 'integer',
              description: 'Total number of transactions'
            },
            by_status: {
              type: 'object',
              properties: {
                succeeded: { type: 'integer' },
                failed: { type: 'integer' },
                pending: { type: 'integer' },
                cancelled: { type: 'integer' },
                refunded: { type: 'integer' }
              }
            },
            by_currency: {
              type: 'object',
              additionalProperties: { type: 'number' }
            },
            period: {
              type: 'object',
              properties: {
                start: { type: 'string', format: 'date-time' },
                end: { type: 'string', format: 'date-time' }
              }
            }
          }
        },
        // Esquemas de integração de pagamento
        PaymentProvider: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            provider: { type: 'string', enum: ['stripe', 'mercadopago', 'paypal', 'pagarme', 'asaas'] },
            config: { type: 'object' },
            status: { type: 'string', enum: ['active', 'inactive', 'testing', 'error'] },
            test_result: { type: 'object' },
            created_at: { type: 'string', format: 'date-time' },
            updated_at: { type: 'string', format: 'date-time' }
          }
        },
        Payment: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            provider_id: { type: 'string' },
            provider_payment_id: { type: 'string' },
            amount: { type: 'number' },
            currency: { type: 'string' },
            status: { type: 'string', enum: ['pending', 'succeeded', 'failed', 'cancelled', 'refunded'] },
            customer_email: { type: 'string' },
            customer_name: { type: 'string' },
            description: { type: 'string' },
            metadata: { type: 'object' },
            client_secret: { type: 'string' },
            paid_at: { type: 'string', format: 'date-time' },
            created_at: { type: 'string', format: 'date-time' },
            updated_at: { type: 'string', format: 'date-time' }
          }
        },
        PaymentStats: {
          type: 'object',
          properties: {
            total_amount: { type: 'number' },
            total_transactions: { type: 'number' },
            by_status: { type: 'object' },
            by_currency: { type: 'object' },
            period: { type: 'object' }
          }
        }
      }
    },
    tags: [
      {
        name: 'Health',
        description: 'Health check endpoints'
      },
      {
        name: 'Campaigns',
        description: 'Campaign management endpoints'
      },
      {
        name: 'Contacts',
        description: 'Contact management endpoints'
      },
      {
        name: 'Lists',
        description: 'Contact list management endpoints'
      },
      {
        name: 'Analytics',
        description: 'Analytics and metrics endpoints'
      },
      {
        name: 'CRM Integrations',
        description: 'CRM integration management endpoints'
      },
      {
        name: 'Webhooks',
        description: 'Webhook management endpoints'
      },
      {
        name: 'Authentication',
        description: 'API authentication endpoints'
      },
      {
    name: 'Pagamentos',
    description: 'Operações relacionadas a pagamentos e provedores de pagamento'
  },
  {
    name: 'Gateway',
    description: 'API Gateway - Gerenciamento centralizado de APIs e serviços'
  }
    ]
  },
  apis: [
    './src/lib/api/*.ts', // Arquivos de rotas
    './src/lib/api/routes.ts', // Rotas principais
    './src/lib/api/integrations.ts' // Rotas de integração
  ]
}

/**
 * Rotas da documentação
 */
const docsRouter = Router()

// Configurar Swagger UI
const specs = swaggerJsdoc(swaggerOptions)

docsRouter.use('/', swaggerUi.serve, swaggerUi.setup(specs, {
  explorer: true,
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'WhatPress API Documentation',
  customfavIcon: '/assets/favicon.ico'
}))

// Documentação em JSON
docsRouter.get('/json', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'application/json')
  res.send(specs)
})

// Documentação YAML
docsRouter.get('/yaml', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/yaml')
  res.send(specs)
})

export { docsRouter }

// Additional API routes for automation integrations
const automationRoutes = {
  '/api/integrations/webhooks': {
    get: {
      tags: ['Integrations'],
      summary: 'List webhooks',
      security: [{ bearerAuth: [] }, { apiKey: [] }],
      responses: {
        '200': {
          description: 'Webhooks list',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean' },
                  data: {
                    type: 'array',
                    items: { $ref: '#/components/schemas/Webhook' }
                  }
                }
              }
            }
          }
        }
      }
    }
  },
  '/api/integrations/automation/templates': {
    get: {
      tags: ['Integrations'],
      summary: 'Get automation templates',
      security: [{ bearerAuth: [] }, { apiKey: [] }],
      responses: {
        '200': {
          description: 'Automation templates',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean' },
                  data: { type: 'object', additionalProperties: { type: 'object' } }
                }
              }
            }
          }
        }
      }
    }
  },
  '/api/integrations/automation/templates/{template}': {
    post: {
      tags: ['Integrations'],
      summary: 'Create automation from template',
      security: [{ bearerAuth: [] }, { apiKey: [] }],
      parameters: [
        {
          name: 'template',
          in: 'path',
          required: true,
          schema: { type: 'string', enum: ['zapier', 'make', 'n8n'] }
        }
      ],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                webhook_url: { type: 'string', format: 'uri' },
                api_key: { type: 'string' },
                secret: { type: 'string' }
              }
            }
          }
        }
      },
      responses: {
        '200': {
          description: 'Automation created',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean' },
                  data: { $ref: '#/components/schemas/Webhook' }
                }
              }
            }
          }
        }
      }
    }
  },
  '/api/integrations/automation': {
    get: {
      tags: ['Integrações'],
      summary: 'Listar integrações de automação',
      security: [{ bearerAuth: [] }, { apiKey: [] }],
      parameters: [
        { name: 'page', in: 'query', schema: { type: 'integer' } },
        { name: 'limit', in: 'query', schema: { type: 'integer' } }
      ],
      responses: {
        '200': { description: 'Sucesso', content: { 'application/json': { schema: { type: 'object' } } } }
      }
    },
    post: {
      tags: ['Integrations'],
      summary: 'Create automation platform integration',
      security: [{ bearerAuth: [] }, { apiKey: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/AutomationPlatform' }
          }
        }
      },
      responses: {
        '200': {
          description: 'Integration created',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean' },
                  data: { $ref: '#/components/schemas/AutomationPlatform' }
                }
              }
            }
          }
        }
      }
    }
  },
  '/api/integrations/automation/templates': {
    get: {
      tags: ['Integrações'],
      summary: 'Obter templates de automação',
      security: [{ bearerAuth: [] }, { apiKey: [] }],
      responses: {
        '200': { description: 'Sucesso', content: { 'application/json': { schema: { type: 'object' } } } }
      }
    }
  },
  '/api/integrations/automation/stats': {
    get: {
      tags: ['Integrations'],
      summary: 'Get automation statistics',
      security: [{ bearerAuth: [] }, { apiKey: [] }],
      responses: {
        '200': {
          description: 'Automation statistics',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  success: { type: 'boolean' },
                  data: { $ref: '#/components/schemas/AutomationStats' }
                }
              }
            }
          }
        }
      }
    }
  },
  // Documentação dos endpoints de pagamento
  '/api/payments/providers': {
    get: {
      tags: ['Pagamentos'],
      summary: 'Listar provedores de pagamento',
      security: [{ bearerAuth: [] }, { apiKey: [] }],
      parameters: [
        { name: 'page', in: 'query', schema: { type: 'integer' } },
        { name: 'limit', in: 'query', schema: { type: 'integer' } }
      ],
      responses: {
        '200': { description: 'Sucesso', content: { 'application/json': { schema: { type: 'object' } } } }
      }
    },
    post: {
      tags: ['Pagamentos'],
      summary: 'Criar configuração de provedor',
      security: [{ bearerAuth: [] }, { apiKey: [] }],
      requestBody: {
        required: true,
        content: { 'application/json': { schema: { $ref: '#/components/schemas/PaymentProvider' } } }
      },
      responses: {
        '201': { description: 'Criado', content: { 'application/json': { schema: { $ref: '#/components/schemas/PaymentProvider' } } } }
      }
    }
  },
  '/api/payments/providers/{id}': {
    get: {
      tags: ['Pagamentos'],
      summary: 'Obter provedor específico',
      security: [{ bearerAuth: [] }, { apiKey: [] }],
      parameters: [
        { name: 'id', in: 'path', required: true, schema: { type: 'string' } }
      ],
      responses: {
        '200': { description: 'Sucesso', content: { 'application/json': { schema: { $ref: '#/components/schemas/PaymentProvider' } } } }
      }
    }
  },
  '/api/payments/providers/{id}/test': {
    post: {
      tags: ['Pagamentos'],
      summary: 'Testar conexão com provedor',
      security: [{ bearerAuth: [] }, { apiKey: [] }],
      parameters: [
        { name: 'id', in: 'path', required: true, schema: { type: 'string' } }
      ],
      responses: {
        '200': { description: 'Sucesso', content: { 'application/json': { schema: { type: 'object' } } } }
      }
    }
  },
  '/api/payments/providers/available': {
    get: {
      tags: ['Pagamentos'],
      summary: 'Obter provedores disponíveis',
      security: [{ bearerAuth: [] }, { apiKey: [] }],
      responses: {
        '200': { description: 'Sucesso', content: { 'application/json': { schema: { type: 'object' } } } }
      }
    }
  },
  '/api/payments': {
    get: {
      tags: ['Pagamentos'],
      summary: 'Listar pagamentos',
      security: [{ bearerAuth: [] }, { apiKey: [] }],
      parameters: [
        { name: 'page', in: 'query', schema: { type: 'integer' } },
        { name: 'limit', in: 'query', schema: { type: 'integer' } },
        { name: 'status', in: 'query', schema: { type: 'string' } },
        { name: 'customer_email', in: 'query', schema: { type: 'string' } }
      ],
      responses: {
        '200': { description: 'Sucesso', content: { 'application/json': { schema: { type: 'object' } } } }
      }
    },
    post: {
      tags: ['Pagamentos'],
      summary: 'Criar intenção de pagamento',
      security: [{ bearerAuth: [] }, { apiKey: [] }],
      requestBody: {
        required: true,
        content: { 'application/json': { schema: { type: 'object' } } }
      },
      responses: {
        '201': { description: 'Criado', content: { 'application/json': { schema: { $ref: '#/components/schemas/Payment' } } } }
      }
    }
  },
  '/api/payments/stats': {
    get: {
      tags: ['Pagamentos'],
      summary: 'Obter estatísticas de pagamento',
      security: [{ bearerAuth: [] }, { apiKey: [] }],
      parameters: [
        { name: 'period', in: 'query', schema: { type: 'string' } }
      ],
      responses: {
        '200': { description: 'Sucesso', content: { 'application/json': { schema: { $ref: '#/components/schemas/PaymentStats' } } } }
      }
    }
  },
  '/api/payments/webhooks/{provider}': {
    post: {
      tags: ['Pagamentos'],
      summary: 'Webhook de atualização de pagamento',
      parameters: [
        { name: 'provider', in: 'path', required: true, schema: { type: 'string', enum: ['stripe', 'mercadopago', 'asaas'] } }
      ],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: { type: 'object' }
          }
        }
      },
      responses: {
        '200': { description: 'Webhook processado com sucesso', content: { 'application/json': { schema: { type: 'object' } } } }
      }
    }
  },
  '/api/gateway/health': {
    get: {
      tags: ['Gateway'],
      summary: 'Health check do API Gateway',
      responses: {
        '200': { description: 'Gateway está funcionando', content: { 'application/json': { schema: { type: 'object' } } } }
      }
    }
  },
  '/api/gateway/metrics': {
    get: {
      tags: ['Gateway'],
      summary: 'Obter métricas do gateway',
      security: [{ bearerAuth: [] }, { apiKey: [] }],
      responses: {
        '200': { description: 'Métricas do gateway', content: { 'application/json': { schema: { type: 'object' } } } }
      }
    }
  },
  '/api/gateway/config': {
    get: {
      tags: ['Gateway'],
      summary: 'Obter configurações do gateway',
      security: [{ bearerAuth: [] }, { apiKey: [] }],
      responses: {
        '200': { description: 'Configurações do gateway', content: { 'application/json': { schema: { type: 'object' } } } }
      }
    }
  },
  '/api/gateway/services': {
    get: {
      tags: ['Gateway'],
      summary: 'Obter status dos serviços externos',
      security: [{ bearerAuth: [] }, { apiKey: [] }],
      responses: {
        '200': { description: 'Status dos serviços', content: { 'application/json': { schema: { type: 'object' } } } }
      }
    }
  },
  '/api/gateway/logs': {
    get: {
      tags: ['Gateway'],
      summary: 'Obter logs do gateway',
      security: [{ bearerAuth: [] }, { apiKey: [] }],
      parameters: [
        { name: 'page', in: 'query', schema: { type: 'integer' } },
        { name: 'limit', in: 'query', schema: { type: 'integer' } },
        { name: 'level', in: 'query', schema: { type: 'string' } },
        { name: 'service', in: 'query', schema: { type: 'string' } }
      ],
      responses: {
        '200': { description: 'Logs do gateway', content: { 'application/json': { schema: { type: 'object' } } } }
      }
    }
  }
};