import { CRMIntegration, CRMContact, CRMDeal, CRMOrganization, CRMIntegrationConfig } from './types';

export class SalesforceIntegration implements CRMIntegration {
  private config: CRMIntegrationConfig;
  private accessToken?: string;
  private instanceUrl?: string;

  constructor(config: CRMIntegrationConfig) {
    this.config = config;
  }

  private async authenticate(): Promise<void> {
    try {
      const response = await fetch(`${this.config.baseUrl}/services/oauth2/token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'password',
          client_id: this.config.apiKey,
          client_secret: this.config.apiSecret || '',
          username: this.config.customFields?.username || '',
          password: this.config.customFields?.password || '',
        }),
      });

      if (!response.ok) {
        throw new Error(`Salesforce authentication failed: ${response.statusText}`);
      }

      const data = await response.json();
      this.accessToken = data.access_token;
      this.instanceUrl = data.instance_url;
    } catch (error) {
      console.error('Salesforce authentication error:', error);
      throw error;
    }
  }

  private async makeRequest(endpoint: string, options: RequestInit = {}): Promise<any> {
    if (!this.accessToken || !this.instanceUrl) {
      await this.authenticate();
    }

    const url = `${this.instanceUrl}/services/data/v58.0${endpoint}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      if (response.status === 401) {
        // Token expired, re-authenticate and retry
        await this.authenticate();
        return this.makeRequest(endpoint, options);
      }
      throw new Error(`Salesforce API error: ${response.statusText}`);
    }

    return response.json();
  }

  async createContact(contact: Partial<CRMContact>): Promise<CRMContact> {
    const salesforceContact = {
      FirstName: contact.firstName,
      LastName: contact.lastName,
      Email: contact.email,
      Phone: contact.phone,
      AccountId: contact.company,
      ...contact.customFields,
    };

    const result = await this.makeRequest('/sobjects/Contact', {
      method: 'POST',
      body: JSON.stringify(salesforceContact),
    });

    return {
      ...contact,
      id: result.id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as CRMContact;
  }

  async updateContact(id: string, contact: Partial<CRMContact>): Promise<CRMContact> {
    const salesforceContact = {
      FirstName: contact.firstName,
      LastName: contact.lastName,
      Email: contact.email,
      Phone: contact.phone,
      AccountId: contact.company,
      ...contact.customFields,
    };

    await this.makeRequest(`/sobjects/Contact/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(salesforceContact),
    });

    return this.getContact(id) as Promise<CRMContact>;
  }

  async getContact(id: string): Promise<CRMContact | null> {
    try {
      const result = await this.makeRequest(`/sobjects/Contact/${id}`);
      
      return {
        id: result.Id,
        email: result.Email,
        firstName: result.FirstName,
        lastName: result.LastName,
        phone: result.Phone,
        company: result.AccountId,
        customFields: result,
        createdAt: result.CreatedDate,
        updatedAt: result.LastModifiedDate,
      };
    } catch (error) {
      if (error.message.includes('NOT_FOUND')) {
        return null;
      }
      throw error;
    }
  }

  async listContacts(params?: any): Promise<CRMContact[]> {
    const query = this.buildSOQLQuery('Contact', params);
    const result = await this.makeRequest(`/query?q=${encodeURIComponent(query)}`);
    
    return result.records.map((record: any) => ({
      id: record.Id,
      email: record.Email,
      firstName: record.FirstName,
      lastName: record.LastName,
      phone: record.Phone,
      company: record.AccountId,
      customFields: record,
      createdAt: record.CreatedDate,
      updatedAt: record.LastModifiedDate,
    }));
  }

  async createDeal(deal: Partial<CRMDeal>): Promise<CRMDeal> {
    const salesforceOpportunity = {
      Name: deal.title,
      Amount: deal.value,
      CurrencyIsoCode: deal.currency,
      StageName: deal.stage,
      Probability: deal.probability,
      ContactId: deal.contactId,
      AccountId: deal.organizationId,
      ...deal.customFields,
    };

    const result = await this.makeRequest('/sobjects/Opportunity', {
      method: 'POST',
      body: JSON.stringify(salesforceOpportunity),
    });

    return {
      ...deal,
      id: result.id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as CRMDeal;
  }

  async updateDeal(id: string, deal: Partial<CRMDeal>): Promise<CRMDeal> {
    const salesforceOpportunity = {
      Name: deal.title,
      Amount: deal.value,
      CurrencyIsoCode: deal.currency,
      StageName: deal.stage,
      Probability: deal.probability,
      ContactId: deal.contactId,
      AccountId: deal.organizationId,
      ...deal.customFields,
    };

    await this.makeRequest(`/sobjects/Opportunity/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(salesforceOpportunity),
    });

    return this.getDeal(id) as Promise<CRMDeal>;
  }

  async getDeal(id: string): Promise<CRMDeal | null> {
    try {
      const result = await this.makeRequest(`/sobjects/Opportunity/${id}`);
      
      return {
        id: result.Id,
        title: result.Name,
        value: result.Amount,
        currency: result.CurrencyIsoCode,
        stage: result.StageName,
        probability: result.Probability,
        contactId: result.ContactId,
        organizationId: result.AccountId,
        customFields: result,
        createdAt: result.CreatedDate,
        updatedAt: result.LastModifiedDate,
        closedAt: result.CloseDate,
      };
    } catch (error) {
      if (error.message.includes('NOT_FOUND')) {
        return null;
      }
      throw error;
    }
  }

  async listDeals(params?: any): Promise<CRMDeal[]> {
    const query = this.buildSOQLQuery('Opportunity', params);
    const result = await this.makeRequest(`/query?q=${encodeURIComponent(query)}`);
    
    return result.records.map((record: any) => ({
      id: record.Id,
      title: record.Name,
      value: record.Amount,
      currency: record.CurrencyIsoCode,
      stage: record.StageName,
      probability: record.Probability,
      contactId: record.ContactId,
      organizationId: record.AccountId,
      customFields: record,
      createdAt: record.CreatedDate,
      updatedAt: record.LastModifiedDate,
      closedAt: record.CloseDate,
    }));
  }

  async createOrganization(org: Partial<CRMOrganization>): Promise<CRMOrganization> {
    const salesforceAccount = {
      Name: org.name,
      Website: org.domain,
      Industry: org.industry,
      NumberOfEmployees: org.size,
      ...org.customFields,
    };

    const result = await this.makeRequest('/sobjects/Account', {
      method: 'POST',
      body: JSON.stringify(salesforceAccount),
    });

    return {
      ...org,
      id: result.id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as CRMOrganization;
  }

  async updateOrganization(id: string, org: Partial<CRMOrganization>): Promise<CRMOrganization> {
    const salesforceAccount = {
      Name: org.name,
      Website: org.domain,
      Industry: org.industry,
      NumberOfEmployees: org.size,
      ...org.customFields,
    };

    await this.makeRequest(`/sobjects/Account/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(salesforceAccount),
    });

    return this.getOrganization(id) as Promise<CRMOrganization>;
  }

  async getOrganization(id: string): Promise<CRMOrganization | null> {
    try {
      const result = await this.makeRequest(`/sobjects/Account/${id}`);
      
      return {
        id: result.Id,
        name: result.Name,
        domain: result.Website,
        industry: result.Industry,
        size: result.NumberOfEmployees?.toString(),
        customFields: result,
        createdAt: result.CreatedDate,
        updatedAt: result.LastModifiedDate,
      };
    } catch (error) {
      if (error.message.includes('NOT_FOUND')) {
        return null;
      }
      throw error;
    }
  }

  async listOrganizations(params?: any): Promise<CRMOrganization[]> {
    const query = this.buildSOQLQuery('Account', params);
    const result = await this.makeRequest(`/query?q=${encodeURIComponent(query)}`);
    
    return result.records.map((record: any) => ({
      id: record.Id,
      name: record.Name,
      domain: record.Website,
      industry: record.Industry,
      size: record.NumberOfEmployees?.toString(),
      customFields: record,
      createdAt: record.CreatedDate,
      updatedAt: record.LastModifiedDate,
    }));
  }

  async syncData(dataType: 'contacts' | 'deals' | 'organizations'): Promise<void> {
    // Implement data synchronization logic
    console.log(`Syncing ${dataType} from Salesforce`);
    
    switch (dataType) {
      case 'contacts':
        await this.listContacts();
        break;
      case 'deals':
        await this.listDeals();
        break;
      case 'organizations':
        await this.listOrganizations();
        break;
    }
    
    // Update last sync timestamp
    this.config.lastSync = new Date().toISOString();
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.authenticate();
      await this.makeRequest('/limits');
      return true;
    } catch (error) {
      console.error('Salesforce connection test failed:', error);
      return false;
    }
  }

  private buildSOQLQuery(objectName: string, params?: any): string {
    let query = `SELECT Id, CreatedDate, LastModifiedDate`;
    
    // Add object-specific fields
    switch (objectName) {
      case 'Contact':
        query += ', FirstName, LastName, Email, Phone, AccountId';
        break;
      case 'Opportunity':
        query += ', Name, Amount, CurrencyIsoCode, StageName, Probability, ContactId, AccountId, CloseDate';
        break;
      case 'Account':
        query += ', Name, Website, Industry, NumberOfEmployees';
        break;
    }
    
    query += ` FROM ${objectName}`;
    
    // Add WHERE clause if filters provided
    if (params?.filters) {
      const conditions = Object.entries(params.filters)
        .map(([key, value]) => `${key} = '${value}'`)
        .join(' AND ');
      query += ` WHERE ${conditions}`;
    }
    
    // Add ORDER BY
    if (params?.orderBy) {
      query += ` ORDER BY ${params.orderBy}`;
    }
    
    // Add LIMIT
    if (params?.limit) {
      query += ` LIMIT ${params.limit}`;
    }
    
    return query;
  }
}