import React, { useState } from 'react';
import { 
  COVERAGE_TIERS, calculatePremiumQuote, getBenefitSchedule,
  MIN_COVER_AMOUNT, MAX_COVER_AMOUNT, COVER_STEP, PaymentFrequency 
} from '../utils/ratingEngine';
import { 
  Shield, Check, Sparkles, Sliders, ChevronDown, 
  ChevronUp, Zap 
} from 'lucide-react';

interface CoverageCalculatorProps {
  coverAmount: number;
  onCoverChange: (amount: number) => void;
  frequency?: PaymentFrequency;
  onFrequencyChange?: (freq: PaymentFrequency) => void;
}

export const CoverageCalculator: React.FC<CoverageCalculatorProps> = ({
  coverAmount,
  onCoverChange,
  frequency = 'MONTHLY',
  onFrequencyChange
}) => {
  const [mode, setMode] = useState<'tiers' | 'slider'>('tiers');
  const [showSchedule, setShowSchedule] = useState<boolean>(false);

  const quote = calculatePremiumQuote(coverAmount, frequency);
  const benefitSchedule = getBenefitSchedule(coverAmount);

  return (
    <div className="space-y-5 animate-fade-in">
      
      {/* Header Banner with Underwriting Badge */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-[#D8CBB9]">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#5A6644] bg-[#8B9A6E]/15 px-2 py-0.5 rounded border border-[#8B9A6E]/30">
            Guaranteed Issue AD&D • Ages 18–69
          </span>
          <h3 className="text-lg font-bold text-[#2E3523] mt-1">Select Principal Sum Coverage</h3>
        </div>

        {/* Mode Toggle: Tiers vs Custom Slider */}
        <div className="inline-flex bg-[#EEEEEE] p-1 rounded-xl border border-[#D8CBB9] self-start sm:self-auto text-xs font-semibold">
          <button
            type="button"
            onClick={() => setMode('tiers')}
            className={`px-3 py-1.5 rounded-lg transition flex items-center space-x-1.5 ${
              mode === 'tiers'
                ? 'bg-[#8B9A6E] text-white shadow-sm'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Recommended Tiers</span>
          </button>
          <button
            type="button"
            onClick={() => setMode('slider')}
            className={`px-3 py-1.5 rounded-lg transition flex items-center space-x-1.5 ${
              mode === 'slider'
                ? 'bg-[#8B9A6E] text-white shadow-sm'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Custom Slider</span>
          </button>
        </div>
      </div>

      {/* MODE A: RECOMMENDED TIER CARDS */}
      {mode === 'tiers' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {COVERAGE_TIERS.map((tier) => {
            const isSelected = coverAmount === tier.coverAmount;
            const tierQuote = calculatePremiumQuote(tier.coverAmount, frequency);

            return (
              <div
                key={tier.id}
                onClick={() => onCoverChange(tier.coverAmount)}
                className={`relative p-4 rounded-2xl cursor-pointer transition-all border text-left flex flex-col justify-between ${
                  isSelected
                    ? 'bg-[#EAE2D6] border-2 border-[#8B9A6E] shadow-md scale-[1.01]'
                    : 'bg-white hover:bg-[#F7F2EB] border-[#D8CBB9] hover:border-[#8B9A6E]/60 shadow-sm'
                }`}
              >
                {/* Badge if present */}
                {tier.badge && (
                  <span className={`absolute -top-2.5 right-3 px-2.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wider rounded-full shadow-sm text-white ${
                    tier.badge === 'MOST POPULAR' ? 'bg-[#5A6644]' : 'bg-[#8B9A6E]'
                  }`}>
                    {tier.badge}
                  </span>
                )}

                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-stone-600">{tier.name}</span>
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center border ${
                      isSelected ? 'bg-[#8B9A6E] border-[#8B9A6E] text-white' : 'border-stone-300 bg-white'
                    }`}>
                      {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                    </div>
                  </div>

                  <div className="mt-2 text-2xl font-black text-[#2E3523] tracking-tight">
                    ${tier.coverAmount.toLocaleString()}
                  </div>
                  <p className="text-[11px] text-stone-600 mt-0.5 font-medium">{tier.tagline}</p>
                </div>

                <div className="mt-4 pt-3 border-t border-[#D8CBB9]/60 flex items-center justify-between text-xs">
                  <div>
                    <span className="text-[10px] text-stone-500 block uppercase font-bold">Premium</span>
                    <span className="text-sm font-extrabold text-[#5A6644]">
                      ${tierQuote.monthlyPremium.toFixed(2)}/mo
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-stone-400 block">Daily Equivalent</span>
                    <span className="text-[11px] font-semibold text-stone-700">
                      ${tierQuote.dailyCost}/day
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODE B: CUSTOM GRANULAR RANGE SLIDER */}
      {mode === 'slider' && (
        <div className="space-y-4 p-5 bg-white rounded-2xl border border-[#D8CBB9] shadow-sm">
          <div className="flex justify-between items-center">
            <span className="text-xs font-bold uppercase tracking-wider text-stone-600">
              Interactive Fine-Tuning ($5k increments)
            </span>
            <span className="text-xs font-mono font-bold text-[#5A6644]">
              Step: $5,000
            </span>
          </div>

          {/* Slider Control */}
          <div className="space-y-2">
            <input
              type="range"
              min={MIN_COVER_AMOUNT}
              max={MAX_COVER_AMOUNT}
              step={COVER_STEP}
              value={coverAmount}
              onChange={(e) => onCoverChange(Number(e.target.value))}
              className="w-full h-3 bg-[#EEEEEE] rounded-lg appearance-none cursor-pointer accent-[#8B9A6E]"
            />
            <div className="flex justify-between text-[11px] font-bold text-stone-500">
              <span>${MIN_COVER_AMOUNT.toLocaleString()}</span>
              <span>$150,000</span>
              <span>${MAX_COVER_AMOUNT.toLocaleString()}</span>
            </div>
          </div>

          {/* Quick Step Buttons */}
          <div className="grid grid-cols-6 gap-1.5 pt-1">
            {[25000, 50000, 100000, 150000, 200000, 300000].map((amt) => (
              <button
                key={amt}
                type="button"
                onClick={() => onCoverChange(amt)}
                className={`py-1.5 px-2 text-[11px] font-bold rounded-lg border transition ${
                  coverAmount === amt
                    ? 'bg-[#8B9A6E] text-white border-[#8B9A6E]'
                    : 'bg-[#F7F2EB] text-stone-700 border-[#D8CBB9] hover:bg-[#EAE2D6]'
                }`}
              >
                ${amt / 1000}k
              </button>
            ))}
          </div>
        </div>
      )}

      {/* SELECTED COVER & LIVE RATE SUMMARY CARD */}
      <div className="p-5 bg-gradient-to-r from-[#EAE2D6] via-[#F2ECE3] to-[#EAE2D6] rounded-2xl border border-[#D8CBB9] shadow-sm space-y-4">
        
        {/* Top: Selected Amount & Frequency Switcher */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#D8CBB9]">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-stone-500">
              Total Principal Sum Selected
            </span>
            <div className="text-3xl font-black text-[#2E3523] tracking-tight">
              ${coverAmount.toLocaleString()} <span className="text-xs font-normal text-stone-500">USD</span>
            </div>
          </div>

          {/* Billing Frequency Toggle */}
          {onFrequencyChange && (
            <div className="inline-flex bg-white p-1 rounded-xl border border-[#D8CBB9] shadow-sm text-xs font-semibold self-start sm:self-auto">
              <button
                type="button"
                onClick={() => onFrequencyChange('MONTHLY')}
                className={`px-3 py-1.5 rounded-lg transition ${
                  frequency === 'MONTHLY'
                    ? 'bg-[#8B9A6E] text-white shadow-sm'
                    : 'text-stone-600 hover:text-stone-900'
                }`}
              >
                Monthly
              </button>
              <button
                type="button"
                onClick={() => onFrequencyChange('ANNUAL')}
                className={`px-3 py-1.5 rounded-lg transition flex items-center space-x-1 ${
                  frequency === 'ANNUAL'
                    ? 'bg-[#5A6644] text-white shadow-sm'
                    : 'text-[#5A6644] hover:text-[#2E3523]'
                }`}
              >
                <span>Annual</span>
                <span className="bg-emerald-100 text-emerald-800 text-[9px] font-extrabold px-1.5 py-0.2 rounded-full">
                  10% OFF
                </span>
              </button>
            </div>
          )}
        </div>

        {/* Bottom: Rate Metrics & Micro-Anchoring */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div className="bg-white p-3 rounded-xl border border-[#D8CBB9]/80 shadow-xs">
            <span className="text-[10px] font-bold uppercase text-stone-500 block">
              {frequency === 'ANNUAL' ? 'Annualized Premium' : 'Monthly Premium'}
            </span>
            <div className="text-xl font-extrabold text-[#5A6644] leading-tight mt-0.5">
              ${quote.effectivePremium.toFixed(2)}
              <span className="text-xs text-stone-500 font-normal">
                {frequency === 'ANNUAL' ? '/yr' : '/mo'}
              </span>
            </div>
            {frequency === 'ANNUAL' && (
              <span className="text-[10px] text-emerald-700 font-bold block mt-0.5">
                Save ${quote.annualSavings.toFixed(2)} / yr!
              </span>
            )}
          </div>

          <div className="bg-white p-3 rounded-xl border border-[#D8CBB9]/80 shadow-xs">
            <span className="text-[10px] font-bold uppercase text-stone-500 block">
              Daily Micro-Cost
            </span>
            <div className="text-xl font-extrabold text-stone-800 leading-tight mt-0.5">
              ${quote.dailyCost}
              <span className="text-xs text-stone-500 font-normal">/day</span>
            </div>
            <span className="text-[10px] text-stone-500 block mt-0.5">
              Less than a daily beverage
            </span>
          </div>

          <div className="col-span-2 sm:col-span-1 bg-white p-3 rounded-xl border border-[#D8CBB9]/80 shadow-xs flex flex-col justify-center">
            <div className="flex items-center space-x-1 text-[10px] font-bold uppercase text-stone-500">
              <Zap className="w-3 h-3 text-[#8B9A6E]" />
              <span>Actuarial Rate Rule</span>
            </div>
            <p className="text-xs font-mono font-bold text-stone-700 mt-1">
              $0.60 per $1k/month
            </p>
            <span className="text-[9px] text-stone-400 mt-0.5">
              ({(coverAmount / 1000).toFixed(0)} units × $0.60)
            </span>
          </div>
        </div>
      </div>

      {/* ACCIDENTAL DISMEMBERMENT BENEFIT SCHEDULE ACCORDION */}
      <div className="border border-[#D8CBB9] rounded-2xl bg-white overflow-hidden shadow-xs">
        <button
          type="button"
          onClick={() => setShowSchedule(!showSchedule)}
          className="w-full px-4 py-3 bg-[#F7F2EB] hover:bg-[#EAE2D6]/70 flex items-center justify-between text-xs font-bold text-[#2E3523] transition"
        >
          <div className="flex items-center space-x-2">
            <Shield className="w-4 h-4 text-[#8B9A6E]" />
            <span>View Official Dismemberment Payout Schedule ({benefitSchedule.length} Conditions)</span>
          </div>
          <div className="flex items-center space-x-1 text-[#5A6644]">
            <span className="text-[11px] font-semibold">{showSchedule ? 'Hide' : 'Expand'}</span>
            {showSchedule ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </div>
        </button>

        {showSchedule && (
          <div className="p-4 space-y-2 text-xs border-t border-[#D8CBB9] animate-fade-in">
            <p className="text-[11px] text-stone-500 mb-2">
              Benefits are paid as an insured percentage of the chosen <strong>${coverAmount.toLocaleString()}</strong> Principal Sum:
            </p>
            <div className="divide-y divide-[#EEEEEE]">
              {benefitSchedule.map((b, idx) => (
                <div key={idx} className="py-2 flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="w-5 h-5 rounded-full bg-[#8B9A6E]/15 text-[#5A6644] text-[10px] font-bold flex items-center justify-center">
                      {b.percentage}%
                    </span>
                    <span className="text-stone-700 font-medium">{b.event}</span>
                  </div>
                  <span className="font-extrabold text-[#2E3523] font-mono">
                    ${b.payoutAmount.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

    </div>
  );
};
