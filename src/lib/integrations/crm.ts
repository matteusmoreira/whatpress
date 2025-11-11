import { supabase } from '@/lib/supabase'
import { monitorFunction } from '@/lib/monitoring'

/**
 * Interface base para integrações CRM
 */
export interface CRMIntegration {
  id: string
  name: string
  type: 'salesforce' | 'hubspot' | 'pipedrive'
  config: Record<string, any>
  status: 'active' | 'inactive' | 'error'
  last_sync?: Date
  tenant_id: string
  created_at: Date
  updated_at: Date
}

/**
 * Interface para contatos do CRM
 */
export interface CRMContact {
  id: string
  email: string
  name: string
  phone?: string
  company?: string
  title?: string
  custom_fields?: Record<string, any>
  tags?: string[]
  created_at: Date
  updated_at: Date
}

/**
 * Interface para leads do CRM
 */
export interface CRMLead {
  id: string
  email: string
  name: string
  company?: string
  title?: string
  source?: string
  status: string
  value?: number
  custom_fields?: Record<string, any>
  created_at: Date
  updated_at: Date
}

/**
 * Classe base para integrações CRM
 */
export abstract class BaseCRMIntegration {
  protected config: Record<string, any>
  protected integrationId: string
  protected tenantId: string

  constructor(config: Record<string, any>, integrationId: string, tenantId: string) {
    this.config = config
    this.integrationId = integrationId
    this.tenantId = tenantId
  }

  abstract getContacts(): Promise<CRMContact[]>
  abstract getLeads(): Promise<CRMLead[]>
  abstract createContact(contact: Partial<CRMContact>): Promise<CRMContact>
  abstract updateContact(id: string, contact: Partial<CRMContact>): Promise<CRMContact>
  abstract createLead(lead: Partial<CRMLead>): Promise<CRMLead>
  abstract updateLead(id: string, lead: Partial<CRMLead>): Promise<CRMLead>
  abstract testConnection(): Promise<boolean>
  abstract getFields(): Promise<Record<string, any>[]>
}

/**
 * Integração Salesforce
 */
export class SalesforceIntegration extends BaseCRMIntegration {
  private accessToken?: string
  private instanceUrl?: string

  async authenticate(): Promise<void> {
    await monitorFunction('crm.salesforce.auth', async () => {
      try {
        const response = await fetch('https://login.salesforce.com/services/oauth2/token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: new URLSearchParams({
            grant_type: 'password',
            client_id: this.config.clientId,
            client_secret: this.config.clientSecret,
            username: this.config.username,
            password: this.config.password + this.config.securityToken
          })
        })

        const data = await response.json()
        
        if (!response.ok) {
          throw new Error(`Salesforce auth failed: ${data.error_description}`)
        }

        this.accessToken = data.access_token
        this.instanceUrl = data.instance_url

        // Salvar tokens no banco
        await supabase
          .from('crm_integrations')
          .update({
            config: {
              ...this.config,
              accessToken: this.accessToken,
              instanceUrl: this.instanceUrl
            }
          })
          .eq('id', this.integrationId)
      } catch (error) {
        console.error('Salesforce authentication error:', error)
        throw error
      }
    })
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.authenticate()
      
      const response = await fetch(`${this.instanceUrl}/services/data/v58.0/sobjects/Account/describe`, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        }
      })

      return response.ok
    } catch (error) {
      console.error('Salesforce connection test failed:', error)
      return false
    }
  }

  async getContacts(): Promise<CRMContact[]> {
    await monitorFunction('crm.salesforce.getContacts', async () => {
      await this.authenticate()

      const response = await fetch(`${this.instanceUrl}/services/data/v58.0/query?q=SELECT Id, Email, Name, Phone, Account.Name, Title FROM Contact`, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        }
      })

      const data = await response.json()
      
      return data.records.map((record: any) => ({
        id: record.Id,
        email: record.Email,
        name: record.Name,
        phone: record.Phone,
        company: record.Account?.Name,
        title: record.Title,
        created_at: new Date(),
        updated_at: new Date()
      }))
    })

    return []
  }

  async getLeads(): Promise<CRMLead[]> {
    await monitorFunction('crm.salesforce.getLeads', async () => {
      await this.authenticate()

      const response = await fetch(`${this.instanceUrl}/services/data/v58.0/query?q=SELECT Id, Email, Name, Company, Title, LeadSource, Status FROM Lead`, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        }
      })

      const data = await response.json()
      
      return data.records.map((record: any) => ({
        id: record.Id,
        email: record.Email,
        name: record.Name,
        company: record.Company,
        title: record.Title,
        source: record.LeadSource,
        status: record.Status,
        created_at: new Date(),
        updated_at: new Date()
      }))
    })

    return []
  }

  async createContact(contact: Partial<CRMContact>): Promise<CRMContact> {
    await monitorFunction('crm.salesforce.createContact', async () => {
      await this.authenticate()

      const response = await fetch(`${this.instanceUrl}/services/data/v58.0/sobjects/Contact`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          Email: contact.email,
          Name: contact.name,
          Phone: contact.phone,
          Title: contact.title
        })
      })

      const data = await response.json()
      
      return {
        id: data.id,
        email: contact.email!,
        name: contact.name!,
        phone: contact.phone,
        title: contact.title,
        created_at: new Date(),
        updated_at: new Date()
      }
    })

    throw new Error('Failed to create contact')
  }

  async updateContact(id: string, contact: Partial<CRMContact>): Promise<CRMContact> {
    await monitorFunction('crm.salesforce.updateContact', async () => {
      await this.authenticate()

      const response = await fetch(`${this.instanceUrl}/services/data/v58.0/sobjects/Contact/${id}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          Email: contact.email,
          Name: contact.name,
          Phone: contact.phone,
          Title: contact.title
        })
      })

      if (!response.ok) {
        throw new Error('Failed to update contact')
      }

      return this.getContactById(id)
    })

    throw new Error('Failed to update contact')
  }

  async createLead(lead: Partial<CRMLead>): Promise<CRMLead> {
    await monitorFunction('crm.salesforce.createLead', async () => {
      await this.authenticate()

      const response = await fetch(`${this.instanceUrl}/services/data/v58.0/sobjects/Lead`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          Email: lead.email,
          Name: lead.name,
          Company: lead.company,
          Title: lead.title,
          LeadSource: lead.source
        })
      })

      const data = await response.json()
      
      return {
        id: data.id,
        email: lead.email!,
        name: lead.name!,
        company: lead.company,
        title: lead.title,
        source: lead.source,
        status: 'Open',
        created_at: new Date(),
        updated_at: new Date()
      }
    })

    throw new Error('Failed to create lead')
  }

  async updateLead(id: string, lead: Partial<CRMLead>): Promise<CRMLead> {
    await monitorFunction('crm.salesforce.updateLead', async () => {
      await this.authenticate()

      const response = await fetch(`${this.instanceUrl}/services/data/v58.0/sobjects/Lead/${id}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          Email: lead.email,
          Name: lead.name,
          Company: lead.company,
          Title: lead.title,
          LeadSource: lead.source
        })
      })

      if (!response.ok) {
        throw new Error('Failed to update lead')
      }

      return this.getLeadById(id)
    })

    throw new Error('Failed to update lead')
  }

  async getFields(): Promise<Record<string, any>[]> {
    await monitorFunction('crm.salesforce.getFields', async () => {
      await this.authenticate()

      const response = await fetch(`${this.instanceUrl}/services/data/v58.0/sobjects/Contact/describe`, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        }
      })

      const data = await response.json()
      
      return data.fields.map((field: any) => ({
        name: field.name,
        label: field.label,
        type: field.type,
        required: field.nillable === false,
        picklistValues: field.picklistValues
      }))
    })

    return []
  }

  private async getContactById(id: string): Promise<CRMContact> {
    const response = await fetch(`${this.instanceUrl}/services/data/v58.0/sobjects/Contact/${id}`, {
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json'
      }
    })

    const record = await response.json()
    
    return {
      id: record.Id,
      email: record.Email,
      name: record.Name,
      phone: record.Phone,
      company: record.Account?.Name,
      title: record.Title,
      created_at: new Date(),
      updated_at: new Date()
    }
  }

  private async getLeadById(id: string): Promise<CRMLead> {
    const response = await fetch(`${this.instanceUrl}/services/data/v58.0/sobjects/Lead/${id}`, {
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json'
      }
    })

    const record = await response.json()
    
    return {
      id: record.Id,
      email: record.Email,
      name: record.Name,
      company: record.Company,
      title: record.Title,
      source: record.LeadSource,
      status: record.Status,
      created_at: new Date(),
      updated_at: new Date()
    }
  }
}

/**
 * Integração HubSpot
 */
export class HubSpotIntegration extends BaseCRMIntegration {
  private accessToken?: string

  async authenticate(): Promise<void> {
    this.accessToken = this.config.accessToken
    
    if (!this.accessToken) {
      throw new Error('HubSpot access token not configured')
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.authenticate()
      
      const response = await fetch('https://api.hubapi.com/crm/v3/objects/contacts', {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        }
      })

      return response.ok
    } catch (error) {
      console.error('HubSpot connection test failed:', error)
      return false
    }
  }

  async getContacts(): Promise<CRMContact[]> {
    await monitorFunction('crm.hubspot.getContacts', async () => {
      await this.authenticate()

      const response = await fetch('https://api.hubapi.com/crm/v3/objects/contacts?properties=email,firstname,lastname,phone,company,jobtitle', {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        }
      })

      const data = await response.json()
      
      return data.results.map((record: any) => ({
        id: record.id,
        email: record.properties.email,
        name: `${record.properties.firstname || ''} ${record.properties.lastname || ''}`.trim(),
        phone: record.properties.phone,
        company: record.properties.company,
        title: record.properties.jobtitle,
        created_at: new Date(),
        updated_at: new Date()
      }))
    })

    return []
  }

  async getLeads(): Promise<CRMLead[]> {
    await monitorFunction('crm.hubspot.getLeads', async () => {
      await this.authenticate()

      const response = await fetch('https://api.hubapi.com/crm/v3/objects/deals?properties=dealname,dealstage,amount,dealtype', {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        }
      })

      const data = await response.json()
      
      return data.results.map((record: any) => ({
        id: record.id,
        email: '', // HubSpot deals não têm email diretamente
        name: record.properties.dealname,
        company: '',
        title: '',
        source: record.properties.dealtype,
        status: record.properties.dealstage,
        value: record.properties.amount ? parseFloat(record.properties.amount) : undefined,
        created_at: new Date(),
        updated_at: new Date()
      }))
    })

    return []
  }

  async createContact(contact: Partial<CRMContact>): Promise<CRMContact> {
    await monitorFunction('crm.hubspot.createContact', async () => {
      await this.authenticate()

      const response = await fetch('https://api.hubapi.com/crm/v3/objects/contacts', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          properties: {
            email: contact.email,
            firstname: contact.name?.split(' ')[0],
            lastname: contact.name?.split(' ').slice(1).join(' '),
            phone: contact.phone,
            company: contact.company,
            jobtitle: contact.title
          }
        })
      })

      const data = await response.json()
      
      return {
        id: data.id,
        email: contact.email!,
        name: contact.name!,
        phone: contact.phone,
        company: contact.company,
        title: contact.title,
        created_at: new Date(),
        updated_at: new Date()
      }
    })

    throw new Error('Failed to create contact')
  }

  async updateContact(id: string, contact: Partial<CRMContact>): Promise<CRMContact> {
    await monitorFunction('crm.hubspot.updateContact', async () => {
      await this.authenticate()

      const response = await fetch(`https://api.hubapi.com/crm/v3/objects/contacts/${id}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          properties: {
            email: contact.email,
            firstname: contact.name?.split(' ')[0],
            lastname: contact.name?.split(' ').slice(1).join(' '),
            phone: contact.phone,
            company: contact.company,
            jobtitle: contact.title
          }
        })
      })

      if (!response.ok) {
        throw new Error('Failed to update contact')
      }

      return this.getContactById(id)
    })

    throw new Error('Failed to update contact')
  }

  async createLead(lead: Partial<CRMLead>): Promise<CRMLead> {
    await monitorFunction('crm.hubspot.createLead', async () => {
      await this.authenticate()

      const response = await fetch('https://api.hubapi.com/crm/v3/objects/deals', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          properties: {
            dealname: lead.name,
            dealstage: 'appointmentscheduled',
            amount: lead.value?.toString(),
            dealtype: lead.source
          }
        })
      })

      const data = await response.json()
      
      return {
        id: data.id,
        email: lead.email || '',
        name: lead.name!,
        company: lead.company,
        title: lead.title,
        source: lead.source,
        status: 'appointmentscheduled',
        value: lead.value,
        created_at: new Date(),
        updated_at: new Date()
      }
    })

    throw new Error('Failed to create lead')
  }

  async updateLead(id: string, lead: Partial<CRMLead>): Promise<CRMLead> {
    await monitorFunction('crm.hubspot.updateLead', async () => {
      await this.authenticate()

      const response = await fetch(`https://api.hubapi.com/crm/v3/objects/deals/${id}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          properties: {
            dealname: lead.name,
            dealstage: lead.status,
            amount: lead.value?.toString(),
            dealtype: lead.source
          }
        })
      })

      if (!response.ok) {
        throw new Error('Failed to update lead')
      }

      return this.getLeadById(id)
    })

    throw new Error('Failed to update lead')
  }

  async getFields(): Promise<Record<string, any>[]> {
    await monitorFunction('crm.hubspot.getFields', async () => {
      await this.authenticate()

      const response = await fetch('https://api.hubapi.com/crm/v3/properties/contacts', {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json'
        }
      })

      const data = await response.json()
      
      return data.results.map((field: any) => ({
        name: field.name,
        label: field.label,
        type: field.type,
        required: field.modificationMetadata?.required,
        options: field.options
      }))
    })

    return []
  }

  private async getContactById(id: string): Promise<CRMContact> {
    const response = await fetch(`https://api.hubapi.com/crm/v3/objects/contacts/${id}?properties=email,firstname,lastname,phone,company,jobtitle`, {
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json'
      }
    })

    const record = await response.json()
    
    return {
      id: record.id,
      email: record.properties.email,
      name: `${record.properties.firstname || ''} ${record.properties.lastname || ''}`.trim(),
      phone: record.properties.phone,
      company: record.properties.company,
      title: record.properties.jobtitle,
      created_at: new Date(),
      updated_at: new Date()
    }
  }

  private async getLeadById(id: string): Promise<CRMLead> {
    const response = await fetch(`https://api.hubapi.com/crm/v3/objects/deals/${id}?properties=dealname,dealstage,amount,dealtype`, {
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json'
      }
    })

    const record = await response.json()
    
    return {
      id: record.id,
      email: '',
      name: record.properties.dealname,
      company: '',
      title: '',
      source: record.properties.dealtype,
      status: record.properties.dealstage,
      value: record.properties.amount ? parseFloat(record.properties.amount) : undefined,
      created_at: new Date(),
      updated_at: new Date()
    }
  }
}

/**
 * Integração Pipedrive
 */
export class PipedriveIntegration extends BaseCRMIntegration {
  private apiToken: string
  private apiUrl: string

  constructor(config: Record<string, any>, integrationId: string, tenantId: string) {
    super(config, integrationId, tenantId)
    this.apiToken = config.apiToken
    this.apiUrl = `https://api.pipedrive.com/v1`
  }

  async testConnection(): Promise<boolean> {
    try {
      const response = await fetch(`${this.apiUrl}/users/me?api_token=${this.apiToken}`)
      return response.ok
    } catch (error) {
      console.error('Pipedrive connection test failed:', error)
      return false
    }
  }

  async getContacts(): Promise<CRMContact[]> {
    await monitorFunction('crm.pipedrive.getContacts', async () => {
      const response = await fetch(`${this.apiUrl}/persons?api_token=${this.apiToken}&limit=500`)
      const data = await response.json()
      
      return data.data.map((record: any) => ({
        id: record.id.toString(),
        email: record.email?.[0]?.value || '',
        name: record.name,
        phone: record.phone?.[0]?.value,
        company: record.org?.name,
        custom_fields: record,
        created_at: new Date(record.add_time),
        updated_at: new Date(record.update_time)
      }))
    })

    return []
  }

  async getLeads(): Promise<CRMLead[]> {
    await monitorFunction('crm.pipedrive.getLeads', async () => {
      const response = await fetch(`${this.apiUrl}/deals?api_token=${this.apiToken}&limit=500`)
      const data = await response.json()
      
      return data.data.map((record: any) => ({
        id: record.id.toString(),
        email: '',
        name: record.title,
        company: record.org?.name,
        value: record.value,
        status: record.status,
        custom_fields: record,
        created_at: new Date(record.add_time),
        updated_at: new Date(record.update_time)
      }))
    })

    return []
  }

  async createContact(contact: Partial<CRMContact>): Promise<CRMContact> {
    await monitorFunction('crm.pipedrive.createContact', async () => {
      const response = await fetch(`${this.apiUrl}/persons?api_token=${this.apiToken}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: contact.name,
          email: contact.email ? [{ value: contact.email, primary: true }] : [],
          phone: contact.phone ? [{ value: contact.phone, primary: true }] : [],
          org_id: contact.company
        })
      })

      const data = await response.json()
      
      return {
        id: data.data.id.toString(),
        email: contact.email!,
        name: contact.name!,
        phone: contact.phone,
        company: contact.company,
        created_at: new Date(),
        updated_at: new Date()
      }
    })

    throw new Error('Failed to create contact')
  }

  async updateContact(id: string, contact: Partial<CRMContact>): Promise<CRMContact> {
    await monitorFunction('crm.pipedrive.updateContact', async () => {
      const response = await fetch(`${this.apiUrl}/persons/${id}?api_token=${this.apiToken}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: contact.name,
          email: contact.email ? [{ value: contact.email, primary: true }] : undefined,
          phone: contact.phone ? [{ value: contact.phone, primary: true }] : undefined
        })
      })

      if (!response.ok) {
        throw new Error('Failed to update contact')
      }

      return this.getContactById(id)
    })

    throw new Error('Failed to update contact')
  }

  async createLead(lead: Partial<CRMLead>): Promise<CRMLead> {
    await monitorFunction('crm.pipedrive.createLead', async () => {
      const response = await fetch(`${this.apiUrl}/deals?api_token=${this.apiToken}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title: lead.name,
          value: lead.value,
          status: lead.status || 'open'
        })
      })

      const data = await response.json()
      
      return {
        id: data.data.id.toString(),
        email: lead.email || '',
        name: lead.name!,
        company: lead.company,
        value: lead.value,
        status: lead.status || 'open',
        created_at: new Date(),
        updated_at: new Date()
      }
    })

    throw new Error('Failed to create lead')
  }

  async updateLead(id: string, lead: Partial<CRMLead>): Promise<CRMLead> {
    await monitorFunction('crm.pipedrive.updateLead', async () => {
      const response = await fetch(`${this.apiUrl}/deals/${id}?api_token=${this.apiToken}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title: lead.name,
          value: lead.value,
          status: lead.status
        })
      })

      if (!response.ok) {
        throw new Error('Failed to update lead')
      }

      return this.getLeadById(id)
    })

    throw new Error('Failed to update lead')
  }

  async getFields(): Promise<Record<string, any>[]> {
    await monitorFunction('crm.pipedrive.getFields', async () => {
      const response = await fetch(`${this.apiUrl}/personFields?api_token=${this.apiToken}`)
      const data = await response.json()
      
      return data.data.map((field: any) => ({
        name: field.key,
        label: field.name,
        type: field.field_type,
        required: field.mandatory_flag,
        options: field.options
      }))
    })

    return []
  }

  private async getContactById(id: string): Promise<CRMContact> {
    const response = await fetch(`${this.apiUrl}/persons/${id}?api_token=${this.apiToken}`)
    const record = await response.json()
    
    return {
      id: record.data.id.toString(),
      email: record.data.email?.[0]?.value || '',
      name: record.data.name,
      phone: record.data.phone?.[0]?.value,
      company: record.data.org?.name,
      created_at: new Date(record.data.add_time),
      updated_at: new Date(record.data.update_time)
    }
  }

  private async getLeadById(id: string): Promise<CRMLead> {
    const response = await fetch(`${this.apiUrl}/deals/${id}?api_token=${this.apiToken}`)
    const record = await response.json()
    
    return {
      id: record.data.id.toString(),
      email: '',
      name: record.data.title,
      company: record.data.org?.name,
      value: record.data.value,
      status: record.data.status,
      created_at: new Date(record.data.add_time),
      updated_at: new Date(record.data.update_time)
    }
  }
}

/**
 * Serviço de gerenciamento de integrações CRM
 */
export class CRMIntegrationService {
  private integrations: Map<string, BaseCRMIntegration> = new Map()

  async getIntegration(integrationId: string): Promise<BaseCRMIntegration | null> {
    const integration = this.integrations.get(integrationId)
    if (integration) {
      return integration
    }

    // Carregar do banco
    const { data } = await supabase
      .from('crm_integrations')
      .select('*')
      .eq('id', integrationId)
      .single()

    if (!data) {
      return null
    }

    return this.createIntegration(data)
  }

  async createIntegration(crmData: CRMIntegration): Promise<BaseCRMIntegration> {
    let integration: BaseCRMIntegration

    switch (crmData.type) {
      case 'salesforce':
        integration = new SalesforceIntegration(crmData.config, crmData.id, crmData.tenant_id)
        break
      case 'hubspot':
        integration = new HubSpotIntegration(crmData.config, crmData.id, crmData.tenant_id)
        break
      case 'pipedrive':
        integration = new PipedriveIntegration(crmData.config, crmData.id, crmData.tenant_id)
        break
      default:
        throw new Error(`Unsupported CRM type: ${crmData.type}`)
    }

    this.integrations.set(crmData.id, integration)
    return integration
  }

  async syncContacts(integrationId: string): Promise<void> {
    const integration = await this.getIntegration(integrationId)
    if (!integration) {
      throw new Error('Integration not found')
    }

    const contacts = await integration.getContacts()

    // Sincronizar com banco local
    for (const contact of contacts) {
      await supabase
        .from('contacts')
        .upsert({
          email: contact.email,
          name: contact.name,
          phone: contact.phone,
          tenant_id: integration.tenantId,
          crm_integration_id: integrationId,
          crm_contact_id: contact.id,
          custom_fields: contact.custom_fields,
          tags: contact.tags
        }, {
          onConflict: 'email,tenant_id'
        })
    }

    // Atualizar última sincronização
    await supabase
      .from('crm_integrations')
      .update({ last_sync: new Date() })
      .eq('id', integrationId)
  }

  async syncLeads(integrationId: string): Promise<void> {
    const integration = await this.getIntegration(integrationId)
    if (!integration) {
      throw new Error('Integration not found')
    }

    const leads = await integration.getLeads()

    // Sincronizar com banco local
    for (const lead of leads) {
      await supabase
        .from('leads')
        .upsert({
          email: lead.email,
          name: lead.name,
          company: lead.company,
          phone: '',
          tenant_id: integration.tenantId,
          crm_integration_id: integrationId,
          crm_lead_id: lead.id,
          status: lead.status,
          value: lead.value,
          custom_fields: lead.custom_fields
        }, {
          onConflict: 'email,tenant_id'
        })
    }

    // Atualizar última sincronização
    await supabase
      .from('crm_integrations')
      .update({ last_sync: new Date() })
      .eq('id', integrationId)
  }
}

// Exportar instância singleton
export const crmIntegrationService = new CRMIntegrationService()