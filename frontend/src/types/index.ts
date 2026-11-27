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
  isPrimary?: boolean;
  guardianName?: string;
}

export interface PolicyAuditLog {
  id: string;
  action: string;
  old_value?: Record<string, unknown> | null;
  new_value?: Record<string, unknown> | null;
  changed_at: string;
  first_name?: string;
  last_name?: string;
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
  annualPremium?: number;
  dailyRate?: number;
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
  auditLogs?: PolicyAuditLog[];
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
  eventsCount?: number;
}

export interface CampaignEvent {
  id: string;
  campaignId: string;
  eventId: string;
  channel: 'Telemarketting' | 'Banner' | 'Collection' | 'Letter' | 'NewsLetter' | string;
  media: 'mail' | 'direct mail' | string;
  scheduledDrop: string;
  finalDescription?: string;
  eventType: 'mailing' | 'Remailing' | 'follow up mail' | 'BSM(benefit statement mailing)' | string;
  quantity: number;
  createdAt: string;
  campaignCode?: string;
  campaignName?: string;
  clientName?: string;
  productName?: string;
  segmentsCount?: number;
  allocatedTarget?: number;
}

export interface Segment {
  id: string;
  eventId: string;
  name: string;
  insuranceStatus: 'I' | 'UI';
  clientId: string;
  clientName?: string;
  clientCode?: string;
  state: string;
  spokenKey: string;
  target: number;
  description?: string;
  createdAt: string;
  eventCode?: string;
  eventQuantity?: number;
  eventChannel?: string;
  campaignCode?: string;
  campaignName?: string;
}

export interface CustomerStats {
  insuredCount: number;
  uninsuredCount: number;
  totalCustomers: number;
}

export interface ClaimDocument {
  id: string;
  fileName: string;
  s3Key: string;
  contentType?: string;
  fileSize?: number;
  uploadedAt: string;
}

export type ClaimStatus = 'SUBMITTED' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED';

export interface Claim {
  id: string;
  claimNumber: string;
  policyId: string;
  policyNumber: string;
  userId: string;
  insuredFirstName: string;
  insuredLastName: string;
  insuredName: string;
  insuredEmail: string;
  insuredPhone?: string;
  productId: string;
  productName: string;
  productCode?: string;
  incidentType: string;
  incidentDate: string;
  description?: string;
  status: ClaimStatus;
  claimedAmount: number | string;
  approvedAmount?: number | string;
  reviewerNotes?: string;
  reviewedAt?: string;
  createdAt: string;
  updatedAt: string;
  documents: ClaimDocument[];
}
