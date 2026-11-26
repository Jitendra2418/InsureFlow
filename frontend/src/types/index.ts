export type UserRole = 'CUSTOMER' | 'ADMIN' | 'OPERATIONS';

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
  code: 'DD' | 'HP' | 'RC';
  description: string;
  status: 'FLAGSHIP' | 'ACTIVE' | 'COMING_SOON';
  premiumRatePerThousand: number;
}
