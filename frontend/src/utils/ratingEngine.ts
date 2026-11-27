// ============================================================
// InsureFlow Actuarial Rating & Underwriting Engine (INS-15)
// Standardized Single Source of Truth for AD&D Policy Pricing
// ============================================================

export type PaymentFrequency = 'MONTHLY' | 'ANNUAL';

export interface CoverageTier {
  id: string;
  name: string;
  badge?: string;
  coverAmount: number;
  tagline: string;
  recommendedFor: string;
}

export interface PremiumQuote {
  coverAmount: number;
  monthlyPremium: number;
  annualPremium: number;
  annualSavings: number;
  dailyCost: number;
  baseRatePerThousand: number;
  annualDiscountPercentage: number;
  paymentFrequency: PaymentFrequency;
  effectivePremium: number; // monthly or annual depending on frequency
}

export interface BenefitItem {
  event: string;
  percentage: number;
  payoutAmount: number;
  category: 'LIFE' | 'LIMB' | 'SIGHT_SPEECH' | 'PARTIAL';
}

// Actuarial Constants per System Architecture Section 4 & Product Schedule
export const MIN_COVER_AMOUNT = 10000;
export const MAX_COVER_AMOUNT = 300000;
export const COVER_STEP = 5000;
export const BASE_RATE_PER_THOUSAND = 0.60; // $0.60 per $1,000 / month
export const ANNUAL_DISCOUNT_PERCENTAGE = 10; // 10% discount on annual commitment

// Standard Product Tiers
export const COVERAGE_TIERS: CoverageTier[] = [
  {
    id: 'starter',
    name: 'Starter Protection',
    coverAmount: 50000,
    tagline: 'Essential personal accident baseline',
    recommendedFor: 'Young professionals & students'
  },
  {
    id: 'standard',
    name: 'Family Standard',
    badge: 'MOST POPULAR',
    coverAmount: 100000,
    tagline: '3–5 years household income protection',
    recommendedFor: 'Families & primary wage earners'
  },
  {
    id: 'comprehensive',
    name: 'Comprehensive Gold',
    badge: 'RECOMMENDED',
    coverAmount: 200000,
    tagline: 'Mortgage, debt & education continuity',
    recommendedFor: 'Homeowners & dual-dependent households'
  },
  {
    id: 'executive',
    name: 'Executive Maximum',
    coverAmount: 300000,
    tagline: 'Maximum underwritten policy limit',
    recommendedFor: 'High net worth & business owners'
  }
];

/**
 * Calculates standardized premium quote with monthly/annual comparison and micro-rates
 */
export function calculatePremiumQuote(
  coverAmount: number,
  paymentFrequency: PaymentFrequency = 'MONTHLY'
): PremiumQuote {
  // Enforce bounds & rounding to step
  const clampedCover = Math.max(
    MIN_COVER_AMOUNT,
    Math.min(MAX_COVER_AMOUNT, Math.round(coverAmount / COVER_STEP) * COVER_STEP)
  );

  // Standard Monthly Formula: (coverAmount / 1000) * 0.60
  const monthlyPremium = Number(((clampedCover / 1000) * BASE_RATE_PER_THOUSAND).toFixed(2));

  // Annual calculation with 10% discount: (monthlyPremium * 12) * 0.90
  const grossAnnual = monthlyPremium * 12;
  const annualPremium = Number((grossAnnual * (1 - ANNUAL_DISCOUNT_PERCENTAGE / 100)).toFixed(2));
  const annualSavings = Number((grossAnnual - annualPremium).toFixed(2));

  // Daily cost micro-metric
  const dailyCost = Number((monthlyPremium / 30).toFixed(2));

  const effectivePremium = paymentFrequency === 'ANNUAL' ? annualPremium : monthlyPremium;

  return {
    coverAmount: clampedCover,
    monthlyPremium,
    annualPremium,
    annualSavings,
    dailyCost,
    baseRatePerThousand: BASE_RATE_PER_THOUSAND,
    annualDiscountPercentage: ANNUAL_DISCOUNT_PERCENTAGE,
    paymentFrequency,
    effectivePremium
  };
}

/**
 * Generates the official Accidental Dismemberment Schedule (Table of Benefits)
 * based on percentage of chosen Principal Sum.
 */
export function getBenefitSchedule(coverAmount: number): BenefitItem[] {
  return [
    {
      event: 'Accidental Loss of Life',
      percentage: 100,
      payoutAmount: coverAmount,
      category: 'LIFE'
    },
    {
      event: 'Loss of Both Hands or Both Feet',
      percentage: 100,
      payoutAmount: coverAmount,
      category: 'LIMB'
    },
    {
      event: 'Loss of Entire Sight in Both Eyes',
      percentage: 100,
      payoutAmount: coverAmount,
      category: 'SIGHT_SPEECH'
    },
    {
      event: 'Complete Loss of Speech and Hearing',
      percentage: 100,
      payoutAmount: coverAmount,
      category: 'SIGHT_SPEECH'
    },
    {
      event: 'Loss of One Hand or One Foot',
      percentage: 50,
      payoutAmount: coverAmount * 0.5,
      category: 'LIMB'
    },
    {
      event: 'Loss of Entire Sight in One Eye',
      percentage: 50,
      payoutAmount: coverAmount * 0.5,
      category: 'SIGHT_SPEECH'
    },
    {
      event: 'Loss of Thumb & Index Finger of Same Hand',
      percentage: 25,
      payoutAmount: coverAmount * 0.25,
      category: 'PARTIAL'
    }
  ];
}
