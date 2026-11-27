import React, { useState, useEffect } from 'react';
import { Policy, Beneficiary } from '../types';
import { useAuth } from '../context/AuthContext';
import { CoverageCalculator } from './CoverageCalculator';
import { BeneficiaryManager } from './BeneficiaryManager';
import { 
  X, ShieldCheck, DollarSign, Building2, HeartHandshake, 
  AlertCircle, Save 
} from 'lucide-react';

interface EditPolicyModalProps {
  isOpen: boolean;
  onClose: () => void;
  policy: Policy | null;
  onSuccess: (message: string) => void;
}

export const EditPolicyModal: React.FC<EditPolicyModalProps> = ({
  isOpen,
  onClose,
  policy,
  onSuccess
}) => {
  const { updatePolicy } = useAuth();

  const [activeTab, setActiveTab] = useState<'cover' | 'address' | 'beneficiaries'>('cover');

  // Cover Amount state
  const [coverAmount, setCoverAmount] = useState<number>(100000);

  // Address state
  const [addressLine1, setAddressLine1] = useState<string>('');
  const [addressLine2, setAddressLine2] = useState<string>('');
  const [city, setCity] = useState<string>('');
  const [state, setState] = useState<string>('');
  const [zipCode, setZipCode] = useState<string>('');

  // Beneficiaries state
  const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([]);

  // Feedback states
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  // Initialize form when policy changes
  useEffect(() => {
    if (policy) {
      setCoverAmount(policy.coverAmount || 100000);
      setAddressLine1(policy.addressLine1 || '');
      setAddressLine2(policy.addressLine2 || '');
      setCity(policy.city || '');
      setState(policy.state || '');
      setZipCode(policy.zipCode || '');
      setBeneficiaries(
        policy.beneficiaries && policy.beneficiaries.length > 0
          ? policy.beneficiaries.map(b => ({
              ...b,
              isPrimary: b.isPrimary !== false,
              guardianName: b.guardianName || ''
            }))
          : [{ firstName: '', lastName: '', relationship: 'Spouse', percentage: 100, phone: '', isPrimary: true, guardianName: '' }]
      );
      setError('');
    }
  }, [policy, isOpen]);

  if (!isOpen || !policy) return null;

  // Monthly Premium Formula: (cover_amount / 1000) * 0.60
  const monthlyPremium = (coverAmount / 1000) * 0.60;
  const primaryBens = beneficiaries.filter(b => b.isPrimary !== false);
  const primaryTotal = primaryBens.reduce((sum, b) => sum + (Number(b.percentage) || 0), 0);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validations
    if (!addressLine1.trim() || !city.trim() || !state.trim() || !zipCode.trim()) {
      setActiveTab('address');
      setError('Please provide a complete residential mailing address.');
      return;
    }

    const primary = beneficiaries.filter(b => b.isPrimary !== false);
    const contingent = beneficiaries.filter(b => b.isPrimary === false);

    if (primary.length === 0) {
      setActiveTab('beneficiaries');
      setError('At least one Primary beneficiary must be designated.');
      return;
    }

    const pTotal = primary.reduce((sum, b) => sum + (Number(b.percentage) || 0), 0);
    if (Math.abs(pTotal - 100) > 0.01) {
      setActiveTab('beneficiaries');
      setError(`Primary beneficiary allocation must equal 100%. Current total: ${pTotal.toFixed(1)}%`);
      return;
    }

    if (contingent.length > 0) {
      const cTotal = contingent.reduce((sum, b) => sum + (Number(b.percentage) || 0), 0);
      if (Math.abs(cTotal - 100) > 0.01) {
        setActiveTab('beneficiaries');
        setError(`Contingent beneficiary allocation must equal 100%. Current total: ${cTotal.toFixed(1)}%`);
        return;
      }
    }

    for (const b of beneficiaries) {
      if (!b.firstName.trim() || !b.lastName.trim()) {
        setActiveTab('beneficiaries');
        setError('First and last name are required for every beneficiary.');
        return;
      }
      const isMinor = b.relationship === 'Child (Minor under 18)' || b.relationship === 'Child';
      if (isMinor && (!b.guardianName || !b.guardianName.trim())) {
        setActiveTab('beneficiaries');
        setError(`Legal Guardian/Trustee name is required for minor beneficiary ${b.firstName} ${b.lastName}.`);
        return;
      }
    }

    setIsSubmitting(true);

    try {
      const res = await updatePolicy(policy.id, {
        coverAmount,
        addressLine1: addressLine1.trim(),
        addressLine2: addressLine2.trim() || null,
        city: city.trim(),
        state: state.trim(),
        zipCode: zipCode.trim(),
        beneficiaries
      });

      if (res.success) {
        onSuccess(`Policy #${policy.policyNumber} details were successfully updated and recorded in the audit history!`);
        onClose();
      } else {
        setError(res.error || 'Failed to update policy in database.');
      }
    } catch {
      setError('An unexpected error occurred while saving changes to PostgreSQL.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-3 sm:p-6 bg-stone-900/60 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-[#F7F2EB] rounded-3xl shadow-2xl border border-[#D8CBB9] overflow-hidden my-3 sm:my-6 flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className="bg-[#EAE2D6] px-6 py-5 border-b border-[#D8CBB9] flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-[#8B9A6E] flex items-center justify-center text-white shadow-sm">
              <ShieldCheck className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[#2E3523]">Edit Policy #{policy.policyNumber}</h2>
              <p className="text-xs text-stone-600 font-medium">
                Update coverage amount, mailing address, or beneficiary designations
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-stone-500 hover:text-stone-800 rounded-lg hover:bg-[#F7F2EB] transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-[#D8CBB9] bg-[#EEEEEE] text-xs font-bold">
          <button
            type="button"
            onClick={() => setActiveTab('cover')}
            className={`flex-1 py-3 px-4 flex items-center justify-center space-x-2 transition border-b-2 ${
              activeTab === 'cover'
                ? 'bg-[#F7F2EB] text-[#2E3523] border-[#8B9A6E]'
                : 'text-stone-600 border-transparent hover:text-stone-900'
            }`}
          >
            <DollarSign className="w-4 h-4 text-[#8B9A6E]" />
            <span>1. Cover Amount</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('address')}
            className={`flex-1 py-3 px-4 flex items-center justify-center space-x-2 transition border-b-2 ${
              activeTab === 'address'
                ? 'bg-[#F7F2EB] text-[#2E3523] border-[#8B9A6E]'
                : 'text-stone-600 border-transparent hover:text-stone-900'
            }`}
          >
            <Building2 className="w-4 h-4 text-[#8B9A6E]" />
            <span>2. Mailing Address</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('beneficiaries')}
            className={`flex-1 py-3 px-4 flex items-center justify-center space-x-2 transition border-b-2 ${
              activeTab === 'beneficiaries'
                ? 'bg-[#F7F2EB] text-[#2E3523] border-[#8B9A6E]'
                : 'text-stone-600 border-transparent hover:text-stone-900'
            }`}
          >
            <HeartHandshake className="w-4 h-4 text-[#8B9A6E]" />
            <span>3. Beneficiaries</span>
          </button>
        </div>

        {/* Error Notification */}
        {error && (
          <div className="m-6 mb-0 p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-500" />
            <span>{error}</span>
          </div>
        )}

        {/* Modal Form */}
        <form onSubmit={handleSave} className="p-6 space-y-6 overflow-y-auto flex-1">

          {/* TAB 1: COVER AMOUNT (INS-15 Actuarial Rating Engine) */}
          {activeTab === 'cover' && (
            <div className="space-y-4 animate-fade-in">
              <CoverageCalculator
                coverAmount={coverAmount}
                onCoverChange={setCoverAmount}
              />

              {policy.coverAmount !== coverAmount && (
                <div className="p-3 bg-[#EAE2D6] rounded-xl border border-[#D8CBB9] text-xs font-semibold text-[#5A6644] flex items-center justify-between">
                  <span>Current: ${policy.coverAmount.toLocaleString()} (${policy.monthlyPremium.toFixed(2)}/mo)</span>
                  <span>&rarr; New: ${coverAmount.toLocaleString()} (${monthlyPremium.toFixed(2)}/mo) [Audit Logged]</span>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: MAILING ADDRESS */}
          {activeTab === 'address' && (
            <div className="space-y-4 animate-fade-in">
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wider text-[#2E3523] mb-1 flex items-center space-x-1.5">
                  <Building2 className="w-4 h-4 text-[#8B9A6E]" />
                  <span>Residential Mailing Address</span>
                </h3>
                <p className="text-xs text-stone-600">
                  Update where policy certificates and claims correspondence will be mailed.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="sm:col-span-2">
                  <label className="block text-stone-700 font-semibold mb-1">Street Address</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. 123 Main Street"
                    value={addressLine1}
                    onChange={(e) => setAddressLine1(e.target.value)}
                    className="w-full px-3 py-2.5 bg-white border border-[#D8CBB9] rounded-xl text-stone-900 focus:ring-2 focus:ring-[#8B9A6E] focus:outline-none"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-stone-700 font-semibold mb-1">Apt, Suite, Unit (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. Apt 4B"
                    value={addressLine2}
                    onChange={(e) => setAddressLine2(e.target.value)}
                    className="w-full px-3 py-2.5 bg-white border border-[#D8CBB9] rounded-xl text-stone-900 focus:ring-2 focus:ring-[#8B9A6E] focus:outline-none"
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
                    className="w-full px-3 py-2.5 bg-white border border-[#D8CBB9] rounded-xl text-stone-900 focus:ring-2 focus:ring-[#8B9A6E] focus:outline-none"
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
                      className="w-full px-3 py-2.5 bg-white border border-[#D8CBB9] rounded-xl text-stone-900 focus:ring-2 focus:ring-[#8B9A6E] focus:outline-none"
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
                      className="w-full px-3 py-2.5 bg-white border border-[#D8CBB9] rounded-xl text-stone-900 focus:ring-2 focus:ring-[#8B9A6E] focus:outline-none"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: BENEFICIARIES */}
          {activeTab === 'beneficiaries' && (
            <div className="space-y-4 animate-fade-in max-h-96 overflow-y-auto pr-1">
              <BeneficiaryManager
                beneficiaries={beneficiaries}
                onChange={setBeneficiaries}
              />
            </div>
          )}

          {/* Footer Actions */}
          <div className="pt-4 border-t border-[#D8CBB9] flex items-center justify-between">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-semibold text-stone-600 hover:text-stone-900 rounded-xl transition"
            >
              Cancel
            </button>

            <div className="flex space-x-3">
              <button
                type="submit"
                disabled={isSubmitting || Math.abs(primaryTotal - 100) > 0.01}
                className="bg-[#8B9A6E] hover:bg-[#738258] text-white px-6 py-2.5 rounded-xl text-xs font-bold transition flex items-center space-x-2 shadow-md hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                <span>{isSubmitting ? 'Updating Database...' : 'Save Changes to Database'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
