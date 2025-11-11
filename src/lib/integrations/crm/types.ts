export interface CRMContact {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  company?: string;
  customFields?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface CRMDeal {
  id: string;
  title: string;
  value: number;
  currency: string;
  stage: string;
  probability: number;
  contactId: string;
  organizationId?: string;
  customFields?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
  closedAt?: string;
}

export interface CRMOrganization {
  id: string;
  name: string;
  domain?: string;
  industry?: string;
  size?: string;
  customFields?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface CRMIntegrationConfig {
  provider: string;
  apiKey: string;
  apiSecret?: string;
  baseUrl?: string;
  enabled: boolean;
  syncInterval: number; // minutes
  lastSync?: string;
  customFields?: Record<string, any>;
}

export interface CRMIntegration {
  createContact(contact: Partial<CRMContact>): Promise<CRMContact>;
  updateContact(id: string, contact: Partial<CRMContact>): Promise<CRMContact>;
  getContact(id: string): Promise<CRMContact | null>;
  listContacts(params?: any): Promise<CRMContact[]>;
  
  createDeal(deal: Partial<CRMDeal>): Promise<CRMDeal>;
  updateDeal(id: string, deal: Partial<CRMDeal>): Promise<CRMDeal>;
  getDeal(id: string): Promise<CRMDeal | null>;
  listDeals(params?: any): Promise<CRMDeal[]>;
  
  createOrganization(org: Partial<CRMOrganization>): Promise<CRMOrganization>;
  updateOrganization(id: string, org: Partial<CRMOrganization>): Promise<CRMOrganization>;
  getOrganization(id: string): Promise<CRMOrganization | null>;
  listOrganizations(params?: any): Promise<CRMOrganization[]>;
  
  syncData(dataType: 'contacts' | 'deals' | 'organizations'): Promise<void>;
  testConnection(): Promise<boolean>;
}