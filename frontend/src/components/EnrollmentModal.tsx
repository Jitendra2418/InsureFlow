import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Beneficiary } from '../types';
import { apiRequest } from '../api';
import { 
  X, Check, ShieldCheck, ArrowRight, ArrowLeft, 
  Sparkles, AlertCircle, Building2, UserPlus, Trash2, HeartHandshake
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

  // Step 1: Validate Campaign Code against PostgreSQL
  const handleValidateCode = async () => {
    setCodeError('');
    if (!campaignCode.trim()) {
      setCodeError('Please enter a campaign code.');
      return;
    }

    setIsValidatingCode(true);
    try {
      const res = await apiRequest<{ valid: boolean; code: string; error?: string }>('/enrollment/validate-code', {
        method: 'POST',
        body: JSON.stringify({ code: campaignCode.trim().toUpperCase() })
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
      const errMsg = err instanceof Error ? err.message : 'Invalid code.';
      setCodeError(errMsg);
    } finally {
      setIsValidatingCode(false);
    }
  };

  // Beneficiary Management
  const handleAddBeneficiary = () => {
    setBeneficiaries([
      ...beneficiaries,
      { firstName: '', lastName: '', relationship: 'Child', percentage: 0, phone: '' }
    ]);
  };

  const handleRemoveBeneficiary = (index: number) => {
    if (beneficiaries.length === 1) return;
    setBeneficiaries(beneficiaries.filter((_, i) => i !== index));
  };

  const handleBeneficiaryChange = (index: number, field: keyof Beneficiary, value: string | number) => {
    const updated = [...beneficiaries];
    updated[index] = { ...updated[index], [field]: value };
    setBeneficiaries(updated);
  };

  const totalPercentage = beneficiaries.reduce((sum, b) => sum + (Number(b.percentage) || 0), 0);

  // Step 3 Validation before Review
  const handleGoToReview = () => {
    setGeneralError('');
    if (!addressLine1.trim() || !city.trim() || !state.trim() || !zipCode.trim()) {
      setGeneralError('Please fill out all required address fields.');
      return;
    }
    if (totalPercentage !== 100) {
      setGeneralError(`Beneficiary percentages must sum to exactly 100%. Current total: ${totalPercentage}%`);
      return;
    }
    for (const b of beneficiaries) {
      if (!b.firstName.trim() || !b.lastName.trim()) {
        setGeneralError('Please provide both first and last name for each beneficiary.');
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/50 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-[#F7F2EB] rounded-2xl shadow-2xl border border-[#EAE2D6] overflow-hidden my-8">
        
        {/* Header */}
        <div className="bg-[#EAE2D6] px-6 py-5 border-b border-[#D8CBB9] flex items-center justify-between">
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

        {/* Wizard Step Indicator */}
        <div className="px-6 py-3 bg-[#EEEEEE] border-b border-[#EAE2D6]">
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

        {/* Modal Body */}
        <div className="p-6">
          {generalError && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-500" />
              <span>{generalError}</span>
            </div>
          )}

          {/* STEP 1: CAMPAIGN CODE */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="p-4 bg-[#EAE2D6]/40 rounded-xl border border-[#EAE2D6]">
                <div className="flex items-center space-x-2 text-sm font-semibold text-[#2E3523] mb-1">
                  <Building2 className="w-4 h-4 text-[#8B9A6E]" />
                  <span>Apex Trust Bank Campaign Code</span>
                </div>
                <p className="text-xs text-stone-600">
                  Enter the unique campaign code generated by Aman's Campaign Module to unlock your enrollment rate.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-1.5">
                  Campaign Code
                </label>
                <div className="flex space-x-2">
                  <input
                    type="text"
                    value={campaignCode}
                    onChange={(e) => {
                      setCampaignCode(e.target.value.toUpperCase());
                      setCodeValid(null);
                      setCodeError('');
                    }}
                    placeholder="e.g. ADD-FALL-2026"
                    className="flex-1 px-4 py-2.5 bg-white border border-[#D8CBB9] rounded-xl text-stone-900 font-mono tracking-wider focus:ring-2 focus:ring-[#8B9A6E] focus:outline-none uppercase text-sm"
                  />
                  <button
                    onClick={handleValidateCode}
                    disabled={isValidatingCode}
                    className="bg-[#8B9A6E] hover:bg-[#738258] text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition flex items-center space-x-1.5 shadow-sm disabled:opacity-50"
                  >
                    <span>{isValidatingCode ? 'Checking DB...' : 'Verify Code'}</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
                {codeError && (
                  <p className="mt-2 text-xs text-red-600 flex items-center space-x-1 font-medium">
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>{codeError}</span>
                  </p>
                )}
                {codeValid && (
                  <p className="mt-2 text-xs text-emerald-700 flex items-center space-x-1 font-semibold">
                    <Check className="w-4 h-4" />
                    <span>Valid code confirmed in database! Proceeding...</span>
                  </p>
                )}
              </div>
            </div>
          )}

          {/* STEP 2: COVER SELECTION */}
          {step === 2 && (
            <div className="space-y-6">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-[#8B9A6E] bg-[#8B9A6E]/10 px-2 py-0.5 rounded">
                  Accidental Death & Dismemberment
                </span>
                <h3 className="text-lg font-bold text-[#2E3523] mt-1">Select Principal Sum Coverage</h3>
                <p className="text-xs text-stone-600">
                  Select coverage between $10,000 and $300,000 in $5,000 steps.
                </p>
              </div>

              {/* Cover Amount Highlight Box */}
              <div className="p-6 bg-[#EAE2D6] rounded-2xl border border-[#D8CBB9] text-center">
                <p className="text-xs font-bold uppercase tracking-wider text-stone-600 mb-1">Chosen Cover Amount</p>
                <div className="text-4xl font-extrabold text-[#2E3523] tracking-tight">
                  ${coverAmount.toLocaleString()}
                </div>
                <div className="mt-3 inline-flex items-center space-x-2 bg-white px-4 py-1.5 rounded-full border border-[#D8CBB9] shadow-sm">
                  <span className="text-xs text-stone-500 font-medium">Monthly Premium:</span>
                  <span className="text-sm font-bold text-[#5A6644]">${monthlyPremium.toFixed(2)} / month</span>
                </div>
              </div>

              {/* Range Slider */}
              <div>
                <div className="flex justify-between text-xs font-semibold text-stone-600 mb-2">
                  <span>Min: $10,000</span>
                  <span className="text-[#8B9A6E] font-bold">Step: $5,000</span>
                  <span>Max: $300,000</span>
                </div>
                <input
                  type="range"
                  min="10000"
                  max="300000"
                  step="5000"
                  value={coverAmount}
                  onChange={(e) => setCoverAmount(Number(e.target.value))}
                  className="w-full h-2.5 bg-[#EEEEEE] rounded-lg appearance-none cursor-pointer accent-[#8B9A6E]"
                />
              </div>

              {/* Quick Pick Buttons */}
              <div className="grid grid-cols-4 gap-2 pt-2">
                {[50000, 100000, 150000, 250000].map((amount) => (
                  <button
                    key={amount}
                    type="button"
                    onClick={() => setCoverAmount(amount)}
                    className={`py-2 px-3 text-xs font-bold rounded-xl border transition ${
                      coverAmount === amount
                        ? 'bg-[#8B9A6E] text-white border-[#8B9A6E]'
                        : 'bg-white hover:bg-[#EAE2D6] text-stone-700 border-[#D8CBB9]'
                    }`}
                  >
                    ${(amount / 1000)}k Cover
                  </button>
                ))}
              </div>

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
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="text-sm font-bold uppercase tracking-wider text-[#2E3523] flex items-center space-x-1.5">
                      <HeartHandshake className="w-4 h-4 text-[#8B9A6E]" />
                      <span>Beneficiary Designation</span>
                    </h3>
                    <p className="text-[11px] text-stone-500">
                      Rule: Percentage split must sum up to exactly 100%.
                    </p>
                  </div>
                  <div className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                    totalPercentage === 100 
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' 
                      : 'bg-amber-100 text-amber-800 border border-amber-300'
                  }`}>
                    Total: {totalPercentage}%
                  </div>
                </div>

                <div className="space-y-3">
                  {beneficiaries.map((b, index) => (
                    <div key={index} className="p-3 bg-white rounded-xl border border-[#D8CBB9] space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-stone-700">Beneficiary #{index + 1}</span>
                        {beneficiaries.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveBeneficiary(index)}
                            className="text-stone-400 hover:text-red-600 transition"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                        <div>
                          <label className="block text-stone-600 mb-0.5">First Name</label>
                          <input
                            type="text"
                            required
                            placeholder="First name"
                            value={b.firstName}
                            onChange={(e) => handleBeneficiaryChange(index, 'firstName', e.target.value)}
                            className="w-full px-2 py-1.5 border border-[#D8CBB9] rounded-md focus:ring-1 focus:ring-[#8B9A6E]"
                          />
                        </div>
                        <div>
                          <label className="block text-stone-600 mb-0.5">Last Name</label>
                          <input
                            type="text"
                            required
                            placeholder="Last name"
                            value={b.lastName}
                            onChange={(e) => handleBeneficiaryChange(index, 'lastName', e.target.value)}
                            className="w-full px-2 py-1.5 border border-[#D8CBB9] rounded-md focus:ring-1 focus:ring-[#8B9A6E]"
                          />
                        </div>
                        <div>
                          <label className="block text-stone-600 mb-0.5">Relationship</label>
                          <select
                            value={b.relationship}
                            onChange={(e) => handleBeneficiaryChange(index, 'relationship', e.target.value)}
                            className="w-full px-2 py-1.5 border border-[#D8CBB9] rounded-md focus:ring-1 focus:ring-[#8B9A6E] bg-white"
                          >
                            <option>Spouse</option>
                            <option>Child</option>
                            <option>Parent</option>
                            <option>Sibling</option>
                            <option>Trust/Estate</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-stone-600 mb-0.5">Share (%)</label>
                          <input
                            type="number"
                            min="1"
                            max="100"
                            value={b.percentage}
                            onChange={(e) => handleBeneficiaryChange(index, 'percentage', Number(e.target.value))}
                            className="w-full px-2 py-1.5 border border-[#D8CBB9] rounded-md focus:ring-1 focus:ring-[#8B9A6E]"
                          />
                        </div>
                      </div>
                    </div>
                  ))}

                  <button
                    type="button"
                    onClick={handleAddBeneficiary}
                    className="w-full py-2 text-xs font-semibold text-[#5A6644] bg-[#EAE2D6]/60 hover:bg-[#EAE2D6] rounded-xl border border-dashed border-[#D8CBB9] flex items-center justify-center space-x-1.5 transition"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span>Add Another Beneficiary</span>
                  </button>
                </div>
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
                  <div className="mt-1 space-y-1">
                    {beneficiaries.map((b, idx) => (
                      <div key={idx} className="flex justify-between text-xs text-stone-600">
                        <span>{b.firstName} {b.lastName} ({b.relationship})</span>
                        <span className="font-semibold text-stone-800">{b.percentage}% share</span>
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
