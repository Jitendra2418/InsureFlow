import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Beneficiary } from '../types';
import { apiRequest } from '../api';
import { CoverageCalculator } from './CoverageCalculator';
import { BeneficiaryManager } from './BeneficiaryManager';
import { 
  X, Check, ShieldCheck, ArrowRight, ArrowLeft, 
  Sparkles, AlertCircle, Building2
} from 'lucide-react';

interface EnrollmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (policyNumber: string) => void;
}

export const EnrollmentModal: React.FC<EnrollmentModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const { user, refreshPolicies } = useAuth();

  // Wizard Steps: 1: Code Verification, 2: Cover Amount, 3: Address & Beneficiary, 4: Review & Enroll
  const [step, setStep] = useState<number>(1);

  // Form State
  const [campaignCode, setCampaignCode] = useState<string>('');
  const [spokenKey, setSpokenKey] = useState<string>('');
  const [codeValid, setCodeValid] = useState<boolean | null>(null);
  const [codeError, setCodeError] = useState<string>('');
  const [isValidatingCode, setIsValidatingCode] = useState<boolean>(false);

  // Cover Amount: $10,000 to $300,000 in $5,000 steps
  const [coverAmount, setCoverAmount] = useState<number>(100000);

  // Address
  const [addressLine1, setAddressLine1] = useState<string>('');
  const [addressLine2, setAddressLine2] = useState<string>('');
  const [city, setCity] = useState<string>('');
  const [state, setState] = useState<string>('');
  const [zipCode, setZipCode] = useState<string>('');

  // Beneficiaries
  const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([
    { firstName: '', lastName: '', relationship: 'Spouse', percentage: 100, phone: '' }
  ]);

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [generalError, setGeneralError] = useState<string>('');

  if (!isOpen) return null;

  // Monthly Premium Formula: (cover_amount / 1000) * 0.60
  const monthlyPremium = (coverAmount / 1000) * 0.60;

  // Step 1: Validate Campaign Code & Spoken Key against PostgreSQL
  const handleValidateCode = async () => {
    setCodeError('');
    if (!campaignCode.trim()) {
      setCodeError('Please enter a valid campaign code.');
      return;
    }
    if (!spokenKey.trim()) {
      setCodeError('Please enter the spoken key.');
      return;
    }

    setIsValidatingCode(true);
    try {
      const res = await apiRequest<{ valid: boolean; code: string; error?: string }>('/enrollment/validate-code', {
        method: 'POST',
        body: JSON.stringify({
          code: campaignCode.trim().toUpperCase(),
          spokenKey: spokenKey.trim().toUpperCase()
        })
      });

      if (res.valid) {
        setCodeValid(true);
        setTimeout(() => {
          setStep(2);
        }, 500);
      } else {
        setCodeValid(false);
        setCodeError(res.error || 'Invalid or redeemed campaign code.');
      }
    } catch (err: unknown) {
      setCodeValid(false);
      const errMsg = err instanceof Error ? err.message : 'Invalid campaign code or spoken key.';
      setCodeError(errMsg);
    } finally {
      setIsValidatingCode(false);
    }
  };

  // Step 3 Validation before Review
  const handleGoToReview = () => {
    setGeneralError('');
    if (!addressLine1.trim() || !city.trim() || !state.trim() || !zipCode.trim()) {
      setGeneralError('Please fill out all required address fields.');
      return;
    }

    const primary = beneficiaries.filter(b => b.isPrimary !== false);
    const contingent = beneficiaries.filter(b => b.isPrimary === false);

    if (primary.length === 0) {
      setGeneralError('At least one Primary beneficiary must be designated.');
      return;
    }

    const primaryTotal = primary.reduce((sum, b) => sum + (Number(b.percentage) || 0), 0);
    if (Math.abs(primaryTotal - 100) > 0.01) {
      setGeneralError(`Primary beneficiary allocations must sum to exactly 100%. Current total: ${primaryTotal.toFixed(1)}%`);
      return;
    }

    if (contingent.length > 0) {
      const contingentTotal = contingent.reduce((sum, b) => sum + (Number(b.percentage) || 0), 0);
      if (Math.abs(contingentTotal - 100) > 0.01) {
        setGeneralError(`Contingent beneficiary allocations must sum to exactly 100%. Current total: ${contingentTotal.toFixed(1)}%`);
        return;
      }
    }

    for (const b of beneficiaries) {
      if (!b.firstName.trim() || !b.lastName.trim()) {
        setGeneralError('Please provide both first and last name for every beneficiary.');
        return;
      }
      const isMinor = b.relationship === 'Child (Minor under 18)' || b.relationship === 'Child';
      if (isMinor && (!b.guardianName || !b.guardianName.trim())) {
        setGeneralError(`Legal Guardian/Trustee name is required for minor beneficiary ${b.firstName} ${b.lastName}.`);
        return;
      }
    }
    setStep(4);
  };

  // Submit Enrollment directly to PostgreSQL
  const handleSubmitEnrollment = async () => {
    if (!user) return;
    setIsSubmitting(true);
    setGeneralError('');

    try {
      const res = await apiRequest<{ message: string; policy: { policyNumber: string } }>('/enrollment/enroll', {
        method: 'POST',
        body: JSON.stringify({
          campaignCode: campaignCode.toUpperCase(),
          spokenKey: spokenKey.toUpperCase(),
          coverAmount,
          addressLine1: addressLine1.trim(),
          addressLine2: addressLine2.trim() || null,
          city: city.trim(),
          state: state.trim(),
          zipCode: zipCode.trim(),
          beneficiaries
        })
      });

      await refreshPolicies();
      setIsSubmitting(false);
      onSuccess(res.policy.policyNumber);
      onClose();
    } catch (err: unknown) {
      setIsSubmitting(false);
      const errMsg = err instanceof Error ? err.message : 'Enrollment failed in database.';
      setGeneralError(errMsg);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-3 sm:p-6 bg-stone-900/60 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-[#F7F2EB] rounded-2xl shadow-2xl border border-[#EAE2D6] overflow-hidden my-3 sm:my-6 flex flex-col max-h-[92vh]">
        
        {/* Header - Fixed Top */}
        <div className="bg-[#EAE2D6] px-6 py-4 border-b border-[#D8CBB9] flex items-center justify-between flex-shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-[#8B9A6E] flex items-center justify-center text-white shadow-sm">
              <ShieldCheck className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[#2E3523]">AD&D Coverage Enrollment</h2>
              <p className="text-xs text-stone-600 font-medium">PostgreSQL-Backed Policy Enrollment</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-stone-500 hover:text-stone-800 rounded-lg hover:bg-[#F7F2EB] transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Wizard Step Indicator - Fixed */}
        <div className="px-6 py-2.5 bg-[#EEEEEE] border-b border-[#EAE2D6] flex-shrink-0">
          <div className="flex items-center justify-between text-xs font-semibold text-stone-600">
            <span className={step >= 1 ? 'text-[#5A6644] font-bold flex items-center space-x-1' : ''}>
              <span className={`w-5 h-5 rounded-full inline-flex items-center justify-center mr-1 text-[11px] ${step >= 1 ? 'bg-[#8B9A6E] text-white' : 'bg-stone-300 text-stone-700'}`}>1</span>
              Campaign Code
            </span>
            <span className="text-stone-300">→</span>
            <span className={step >= 2 ? 'text-[#5A6644] font-bold flex items-center space-x-1' : ''}>
              <span className={`w-5 h-5 rounded-full inline-flex items-center justify-center mr-1 text-[11px] ${step >= 2 ? 'bg-[#8B9A6E] text-white' : 'bg-stone-300 text-stone-700'}`}>2</span>
              Cover Selection
            </span>
            <span className="text-stone-300">→</span>
            <span className={step >= 3 ? 'text-[#5A6644] font-bold flex items-center space-x-1' : ''}>
              <span className={`w-5 h-5 rounded-full inline-flex items-center justify-center mr-1 text-[11px] ${step >= 3 ? 'bg-[#8B9A6E] text-white' : 'bg-stone-300 text-stone-700'}`}>3</span>
              Beneficiaries
            </span>
            <span className="text-stone-300">→</span>
            <span className={step >= 4 ? 'text-[#5A6644] font-bold flex items-center space-x-1' : ''}>
              <span className={`w-5 h-5 rounded-full inline-flex items-center justify-center mr-1 text-[11px] ${step >= 4 ? 'bg-[#8B9A6E] text-white' : 'bg-stone-300 text-stone-700'}`}>4</span>
              Review
            </span>
          </div>
        </div>

        {/* Modal Body - Scrollable Content */}
        <div className="p-6 overflow-y-auto flex-1">
          {generalError && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-500" />
              <span>{generalError}</span>
            </div>
          )}

          {/* STEP 1: CAMPAIGN CODE */}
          {/* STEP 1: CAMPAIGN CODE & SPOKEN KEY */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="p-4 bg-[#EAE2D6]/40 rounded-xl border border-[#EAE2D6]">
                <div className="flex items-center space-x-2 text-sm font-semibold text-[#2E3523] mb-1">
                  <Building2 className="w-4 h-4 text-[#8B9A6E]" />
                  <span>Apex Trust Bank Campaign Code & Spoken Key</span>
                </div>
                <p className="text-xs text-stone-600">
                  Enter the unique campaign code and spoken key generated by Aman's Campaign Module to unlock your enrollment rate.
                </p>
              </div>

              {/* Campaign Code */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-1.5">
                  Campaign Code
                </label>
                <input
                  type="text"
                  value={campaignCode}
                  onChange={(e) => {
                    setCampaignCode(e.target.value.toUpperCase());
                    setCodeValid(null);
                    setCodeError('');
                  }}
                  placeholder="e.g. ADD-FALL-2026"
                  className="w-full px-4 py-2.5 bg-white border border-[#D8CBB9] rounded-xl text-stone-900 font-mono tracking-wider focus:ring-2 focus:ring-[#8B9A6E] focus:outline-none uppercase text-sm"
                />
              </div>

              {/* Spoken Key */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold uppercase tracking-wider text-stone-700">
                    Spoken Key
                  </label>
                  <span className="text-[10px] text-stone-500 font-semibold uppercase tracking-wider">
                    Telemarketing / Verbal Channel ID
                  </span>
                </div>
                <input
                  type="text"
                  value={spokenKey}
                  onChange={(e) => {
                    setSpokenKey(e.target.value.toUpperCase());
                    setCodeValid(null);
                    setCodeError('');
                  }}
                  placeholder="e.g. INS-APEX-TX or UI-APEX-CA"
                  className="w-full px-4 py-2.5 bg-white border border-[#D8CBB9] rounded-xl text-stone-900 font-mono tracking-wider focus:ring-2 focus:ring-[#8B9A6E] focus:outline-none uppercase text-sm"
                />
                <p className="mt-1 text-[11px] text-stone-500">
                  Enter the verbal spoken key provided on your promotional letter or by your customer service agent.
                </p>
              </div>

              {/* Verify Code Button */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleValidateCode}
                  disabled={isValidatingCode}
                  className="w-full bg-[#8B9A6E] hover:bg-[#738258] text-white py-3 px-5 rounded-xl text-sm font-semibold transition flex items-center justify-center space-x-2 shadow-sm disabled:opacity-50"
                >
                  <span>{isValidatingCode ? 'Checking DB & Validating...' : 'Verify Code'}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>

              {codeError && (
                <p className="mt-2 text-xs text-red-600 flex items-center space-x-1 font-medium bg-red-50 p-2.5 rounded-lg border border-red-200">
                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>{codeError}</span>
                </p>
              )}
              {codeValid && (
                <p className="mt-2 text-xs text-emerald-700 flex items-center space-x-1 font-semibold bg-emerald-50 p-2.5 rounded-lg border border-emerald-200">
                  <Check className="w-4 h-4 flex-shrink-0" />
                  <span>Valid campaign code & spoken key confirmed! Proceeding to cover selection...</span>
                </p>
              )}
            </div>
          )}

          {/* STEP 2: COVER SELECTION (INS-15 Rating Engine) */}
          {step === 2 && (
            <div className="space-y-6">
              <CoverageCalculator
                coverAmount={coverAmount}
                onCoverChange={setCoverAmount}
              />

              {/* Action Buttons */}
              <div className="flex justify-between items-center pt-4 border-t border-[#EAE2D6]">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="flex items-center space-x-1.5 text-xs font-semibold text-stone-600 hover:text-stone-900"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back</span>
                </button>
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className="bg-[#8B9A6E] hover:bg-[#738258] text-white px-6 py-2.5 rounded-xl text-sm font-semibold transition flex items-center space-x-1.5 shadow-sm"
                >
                  <span>Continue to Beneficiaries</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: ADDRESS & BENEFICIARIES */}
          {step === 3 && (
            <div className="space-y-6">
              {/* Address Form */}
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wider text-[#2E3523] mb-3 flex items-center space-x-1.5">
                  <Building2 className="w-4 h-4 text-[#8B9A6E]" />
                  <span>Residential Mailing Address</span>
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="sm:col-span-2">
                    <label className="block text-stone-700 font-semibold mb-1">Street Address</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. 123 Main Street"
                      value={addressLine1}
                      onChange={(e) => setAddressLine1(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-[#D8CBB9] rounded-lg focus:ring-1 focus:ring-[#8B9A6E] focus:outline-none"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-stone-700 font-semibold mb-1">Apt, Suite, Unit (Optional)</label>
                    <input
                      type="text"
                      placeholder="e.g. Apt 4B"
                      value={addressLine2}
                      onChange={(e) => setAddressLine2(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-[#D8CBB9] rounded-lg focus:ring-1 focus:ring-[#8B9A6E] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-stone-700 font-semibold mb-1">City</label>
                    <input
                      type="text"
                      required
                      placeholder="City"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-[#D8CBB9] rounded-lg focus:ring-1 focus:ring-[#8B9A6E] focus:outline-none"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-stone-700 font-semibold mb-1">State</label>
                      <input
                        type="text"
                        required
                        placeholder="State"
                        value={state}
                        onChange={(e) => setState(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-[#D8CBB9] rounded-lg focus:ring-1 focus:ring-[#8B9A6E] focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-stone-700 font-semibold mb-1">Postal Code</label>
                      <input
                        type="text"
                        required
                        placeholder="Zip"
                        value={zipCode}
                        onChange={(e) => setZipCode(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-[#D8CBB9] rounded-lg focus:ring-1 focus:ring-[#8B9A6E] focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Beneficiaries Form */}
              <div className="pt-3 border-t border-[#EAE2D6]">
                <BeneficiaryManager
                  beneficiaries={beneficiaries}
                  onChange={setBeneficiaries}
                />
              </div>

              {/* Action Buttons */}
              <div className="flex justify-between items-center pt-4 border-t border-[#EAE2D6]">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="flex items-center space-x-1.5 text-xs font-semibold text-stone-600 hover:text-stone-900"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back</span>
                </button>
                <button
                  type="button"
                  onClick={handleGoToReview}
                  className="bg-[#8B9A6E] hover:bg-[#738258] text-white px-6 py-2.5 rounded-xl text-sm font-semibold transition flex items-center space-x-1.5 shadow-sm"
                >
                  <span>Review Summary</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 4: REVIEW & ENROLL */}
          {step === 4 && (
            <div className="space-y-5">
              <div>
                <h3 className="text-lg font-bold text-[#2E3523]">Review Policy & Finalize Enrollment</h3>
                <p className="text-xs text-stone-600">
                  Review your coverage details before writing to the database.
                </p>
              </div>

              {/* Policy Summary Card */}
              <div className="p-4 bg-[#EAE2D6] rounded-2xl border border-[#D8CBB9] space-y-3">
                <div className="flex justify-between items-center pb-3 border-b border-[#D8CBB9]">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#5A6644]">Product</span>
                    <p className="font-bold text-stone-900">Accidental Death & Dismemberment (AD&D)</p>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-stone-500">Campaign Code</span>
                    <p className="font-mono font-bold text-[#2E3523]">{campaignCode}</p>
                    {spokenKey && (
                      <p className="text-[10px] font-mono font-semibold text-[#5A6644] mt-0.5">Key: {spokenKey}</p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 pb-3 border-b border-[#D8CBB9]">
                  <div>
                    <span className="text-xs text-stone-500">Principal Cover Sum:</span>
                    <p className="text-xl font-extrabold text-[#2E3523]">${coverAmount.toLocaleString()}</p>
                  </div>
                  <div>
                    <span className="text-xs text-stone-500">Monthly Premium:</span>
                    <p className="text-xl font-extrabold text-[#5A6644]">${monthlyPremium.toFixed(2)}/mo</p>
                  </div>
                </div>

                <div>
                  <span className="text-xs font-semibold text-stone-700">Designated Beneficiaries:</span>
                  <div className="mt-2 space-y-1.5">
                    {beneficiaries.map((b, idx) => (
                      <div key={idx} className="flex items-center justify-between text-xs bg-white/70 p-2 rounded-xl border border-[#D8CBB9]/60">
                        <div className="flex items-center space-x-2">
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${b.isPrimary !== false ? 'bg-[#8B9A6E] text-white' : 'bg-stone-700 text-white'}`}>
                            {b.isPrimary !== false ? 'Primary' : 'Contingent'}
                          </span>
                          <span className="font-semibold text-stone-900">{b.firstName} {b.lastName}</span>
                          <span className="text-stone-500">({b.relationship})</span>
                          {b.guardianName && (
                            <span className="text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded text-[10px] border border-amber-200">
                              Guardian: {b.guardianName}
                            </span>
                          )}
                        </div>
                        <span className="font-mono font-bold text-[#2E3523]">{b.percentage}% share</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="text-xs text-stone-600 pt-2 border-t border-[#D8CBB9]">
                  <span className="font-semibold text-stone-700">Mailing Address: </span>
                  {addressLine1}, {addressLine2 ? `${addressLine2}, ` : ''}{city}, {state} {zipCode}
                </div>
              </div>

              {/* Enrollment Guarantee Note */}
              <div className="p-3 bg-white rounded-xl border border-[#EEEEEE] flex items-start space-x-2.5">
                <Sparkles className="w-4 h-4 text-[#8B9A6E] flex-shrink-0 mt-0.5" />
                <p className="text-xs text-stone-600">
                  By clicking <strong>"Authorize & Write Policy to Database"</strong>, a row will be inserted into the <code>policies</code> table in PostgreSQL, linked to your customer ID, and marked ACTIVE.
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-between items-center pt-4 border-t border-[#EAE2D6]">
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  disabled={isSubmitting}
                  className="flex items-center space-x-1.5 text-xs font-semibold text-stone-600 hover:text-stone-900"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back</span>
                </button>
                <button
                  type="button"
                  onClick={handleSubmitEnrollment}
                  disabled={isSubmitting}
                  className="bg-[#8B9A6E] hover:bg-[#738258] text-white px-7 py-3 rounded-xl text-sm font-bold transition flex items-center space-x-2 shadow-md hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <span>Inserting into PostgreSQL...</span>
                  ) : (
                    <>
                      <ShieldCheck className="w-4 h-4" />
                      <span>Authorize & Write Policy to Database</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
