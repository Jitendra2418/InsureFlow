export type UserRole = 'CUSTOMER' | 'ADMIN' | 'OPERATIONS';

export interface Client {
  id: string;
  name: string;
  clientId: string;
  code: string;
  businessType: 'Bank' | 'Creditunion' | 'Affinity partner' | 'Association' | string;
  status: 'A-ACTIVE' | 'IA-INACTIVE' | string;
  address?: string;
  state?: string;
  contactEmail?: string;
  isActive: boolean;
  createdAt: string;
}

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  dateOfBirth?: string;
  phone?: string;
  aadharNumber?: string;
  role: UserRole;
  createdAt?: string;
}

export interface Beneficiary {
  id?: string;
  firstName: string;
  lastName: string;
  relationship: string;
  percentage: number;
  phone?: string;
}

export interface Policy {
  id: string;
  policyNumber: string;
  userId: string;
  productId: string;
  productName: string;
  productCode: 'DD' | 'HP' | 'RC';
  coverAmount: number;
  monthlyPremium: number;
  status: 'ACTIVE' | 'CANCELLED' | 'LAPSED';
  effectiveDate: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  zipCode: string;
  beneficiaries: Beneficiary[];
  campaignCode?: string;
  certificateKey?: string;
  createdAt: string;
}

export interface Product {
  id: string;
  name: string;
  code: string;
  status: string;
  description?: string;
  premiumRatePerThousand?: number;
}

export interface Campaign {
  id: string;
  campaignId: string;
  name: string;
  description?: string;
  clientId: string;
  clientName: string;
  productId: string;
  productName: string;
  productCode?: string;
  status: 'ACTIVE' | 'INACTIVE' | 'PLANNED' | string;
  startDate: string;
  endDate: string;
  createdAt: string;
}
