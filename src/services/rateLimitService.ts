interface RateLimitConfig {
  windowMs: number;      // Janela de tempo em milissegundos
  maxRequests: number;   // Máximo de requisições por janela
  keyGenerator?: (req: any) => string; // Função para gerar chave única
  skipSuccessfulRequests?: boolean;    // Não contar requisições bem-sucedidas
  skipFailedRequests?: boolean;        // Não contar requisições com erro
  message?: string;        // Mensagem de erro quando limitado
  statusCode?: number;     // Código HTTP quando limitado
}

interface RateLimitStore {
  [key: string]: {
    count: number;
    resetTime: number;
  };
}

class RateLimitService {
  private store: RateLimitStore = {};
  private config: RateLimitConfig;

  constructor(config: RateLimitConfig) {
    this.config = {
      windowMs: 15 * 60 * 1000, // 15 minutos padrão
      maxRequests: 100,
      keyGenerator: (req) => req.ip || 'unknown',
      skipSuccessfulRequests: false,
      skipFailedRequests: false,
      message: 'Muitas requisições, por favor tente novamente mais tarde',
      statusCode: 429,
      ...config
    };

    // Limpar store periodicamente
    setInterval(() => this.cleanup(), 60000); // A cada minuto
  }

  /**
   * Verifica se a requisição está dentro do limite
   */
  async checkLimit(req: any): Promise<{
    allowed: boolean;
    limit: number;
    remaining: number;
    resetTime: number;
    retryAfter?: number;
  }> {
    const key = this.config.keyGenerator!(req);
    const now = Date.now();

    // Limpar entrada expirada
    if (this.store[key] && this.store[key].resetTime < now) {
      delete this.store[key];
    }

    // Criar nova entrada se necessário
    if (!this.store[key]) {
      this.store[key] = {
        count: 0,
        resetTime: now + this.config.windowMs
      };
    }

    const entry = this.store[key];
    const remaining = Math.max(0, this.config.maxRequests - entry.count);
    const resetTime = entry.resetTime;

    // Verificar se atingiu o limite
    if (entry.count >= this.config.maxRequests) {
      const retryAfter = Math.ceil((resetTime - now) / 1000);
      return {
        allowed: false,
        limit: this.config.maxRequests,
        remaining: 0,
        resetTime,
        retryAfter
      };
    }

    // Incrementar contador
    entry.count++;

    return {
      allowed: true,
      limit: this.config.maxRequests,
      remaining: remaining - 1,
      resetTime
    };
  }

  /**
   * Aplica rate limiting à requisição
   */
  async applyRateLimit(req: any, res: any, next: any): Promise<void> {
    try {
      const result = await this.checkLimit(req);

      // Adicionar headers de rate limit
      res.setHeader('X-RateLimit-Limit', result.limit);
      res.setHeader('X-RateLimit-Remaining', result.remaining);
      res.setHeader('X-RateLimit-Reset', new Date(result.resetTime).toISOString());

      if (!result.allowed) {
        if (result.retryAfter) {
          res.setHeader('Retry-After', result.retryAfter);
        }

        return res.status(this.config.statusCode!).json({
          error: this.config.message,
          retryAfter: result.retryAfter
        });
      }

      next();
    } catch (error) {
      console.error('Erro ao aplicar rate limit:', error);
      // Em caso de erro, permite a requisição continuar
      next();
    }
  }

  /**
   * Limpa entradas expiradas do store
   */
  private cleanup(): void {
    const now = Date.now();
    for (const key in this.store) {
      if (this.store[key].resetTime < now) {
        delete this.store[key];
      }
    }
  }

  /**
   * Reseta o contador para uma chave específica
   */
  reset(key: string): void {
    delete this.store[key];
  }

  /**
   * Obtém estatísticas do rate limit
   */
  getStats(): {
    totalKeys: number;
    config: RateLimitConfig;
    store: RateLimitStore;
  } {
    return {
      totalKeys: Object.keys(this.store).length,
      config: this.config,
      store: { ...this.store }
    };
  }
}

// Configurações predefinidas para diferentes endpoints
export const rateLimitConfigs = {
  // API pública geral
  api: {
    windowMs: 15 * 60 * 1000, // 15 minutos
    maxRequests: 100,
    message: 'Muitas requisições à API, por favor tente novamente mais tarde'
  },

  // Autenticação
  auth: {
    windowMs: 15 * 60 * 1000, // 15 minutos
    maxRequests: 5,
    keyGenerator: (req) => {
      // Usa IP + user agent para identificar tentativas de login
      return `${req.ip || 'unknown'}-${req.headers['user-agent'] || 'unknown'}`;
    },
    message: 'Muitas tentativas de autenticação, por favor aguarde'
  },

  // Envio de mensagens (anti-spam)
  messaging: {
    windowMs: 60 * 1000, // 1 minuto
    maxRequests: 30,
    keyGenerator: (req) => {
      // Usa user_id do token JWT ou IP
      return req.user?.id || req.ip || 'unknown';
    },
    message: 'Muitas mensagens enviadas, por favor aguarde'
  },

  // Upload de mídia
  upload: {
    windowMs: 60 * 60 * 1000, // 1 hora
    maxRequests: 50,
    message: 'Muitos uploads, por favor aguarde'
  },

  // Webhooks
  webhook: {
    windowMs: 60 * 1000, // 1 minuto
    maxRequests: 60,
    message: 'Muitos webhooks, por favor aguarde'
  },

  // Contatos (importação)
  contacts: {
    windowMs: 60 * 60 * 1000, // 1 hora
    maxRequests: 10,
    message: 'Muitas importações de contatos, por favor aguarde'
  },

  // Relatórios
  reports: {
    windowMs: 60 * 60 * 1000, // 1 hora
    maxRequests: 20,
    message: 'Muitas requisições de relatórios, por favor aguarde'
  }
};

// Instâncias de rate limit para uso específico
export const createRateLimiter = (type: keyof typeof rateLimitConfigs) => {
  return new RateLimitService(rateLimitConfigs[type]);
};

// Middleware Express para rate limiting
export const rateLimitMiddleware = (type: keyof typeof rateLimitConfigs) => {
  const limiter = createRateLimiter(type);
  return (req: any, res: any, next: any) => {
    limiter.applyRateLimit(req, res, next);
  };
};

// Hook React para rate limiting no frontend
export const useRateLimit = () => {
  const checkRateLimit = async (endpoint: string): Promise<boolean> => {
    try {
      // Implementação simplificada - em produção usar Redis ou similar
      const key = `rate_limit_${endpoint}_${Date.now()}`;
      const count = parseInt(localStorage.getItem(key) || '0');
      
      if (count > 10) { // Limite simples
        return false;
      }
      
      localStorage.setItem(key, (count + 1).toString());
      
      // Limpar após 1 minuto
      setTimeout(() => {
        localStorage.removeItem(key);
      }, 60000);
      
      return true;
    } catch (error) {
      console.error('Erro ao verificar rate limit:', error);
      return true; // Em caso de erro, permite a ação
    }
  };

  return {
    checkRateLimit
  };
};

export default RateLimitService;