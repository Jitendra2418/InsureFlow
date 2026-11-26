import React, { useState, useEffect } from 'react';
import { Policy, Beneficiary } from '../types';
import { useAuth } from '../context/AuthContext';
import { 
  X, ShieldCheck, DollarSign, Building2, HeartHandshake, 
  UserPlus, Trash2, AlertCircle, Save 
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
          ? policy.beneficiaries.map(b => ({ ...b }))
          : [{ firstName: '', lastName: '', relationship: 'Spouse', percentage: 100, phone: '' }]
      );
      setError('');
    }
  }, [policy, isOpen]);

  if (!isOpen || !policy) return null;

  // Monthly Premium Formula: (cover_amount / 1000) * 0.60
  const monthlyPremium = (coverAmount / 1000) * 0.60;
  const totalPercentage = beneficiaries.reduce((sum, b) => sum + (Number(b.percentage) || 0), 0);

  // Beneficiary Management
  const handleAddBeneficiary = () => {
    setBeneficiaries([
      ...beneficiaries,
      { firstName: '', lastName: '', relationship: 'Child', percentage: 0, phone: '' }
    ]);
  };

  const handleRemoveBeneficiary = (index: number) => {
    if (beneficiaries.length <= 1) return;
    setBeneficiaries(beneficiaries.filter((_, i) => i !== index));
  };

  const handleBeneficiaryChange = (index: number, field: keyof Beneficiary, value: string | number) => {
    const updated = [...beneficiaries];
    updated[index] = { ...updated[index], [field]: value };
    setBeneficiaries(updated);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validations
    if (!addressLine1.trim() || !city.trim() || !state.trim() || !zipCode.trim()) {
      setActiveTab('address');
      setError('Please provide a complete residential mailing address.');
      return;
    }

    if (Math.abs(totalPercentage - 100) > 0.01) {
      setActiveTab('beneficiaries');
      setError(`Beneficiary allocation must equal 100%. Current total: ${totalPercentage}%`);
      return;
    }

    for (const b of beneficiaries) {
      if (!b.firstName.trim() || !b.lastName.trim()) {
        setActiveTab('beneficiaries');
        setError('First and last name are required for every beneficiary.');
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/50 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-[#F7F2EB] rounded-3xl shadow-2xl border border-[#D8CBB9] overflow-hidden my-8">
        
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
        <form onSubmit={handleSave} className="p-6 space-y-6">

          {/* TAB 1: COVER AMOUNT */}
          {activeTab === 'cover' && (
            <div className="space-y-5 animate-fade-in">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-[#8B9A6E] bg-[#8B9A6E]/10 px-2 py-0.5 rounded">
                  Policy Limit Modification
                </span>
                <h3 className="text-base font-bold text-[#2E3523] mt-1">
                  Adjust Principal Sum Coverage
                </h3>
                <p className="text-xs text-stone-600">
                  Update coverage between $10,000 and $300,000 in $5,000 increments. Monthly premium will be automatically recalculated.
                </p>
              </div>

              {/* Dynamic Rate Card */}
              <div className="p-6 bg-[#EAE2D6] rounded-2xl border border-[#D8CBB9] text-center">
                <p className="text-xs font-bold uppercase tracking-wider text-stone-600 mb-1">
                  Selected Principal Sum
                </p>
                <div className="text-4xl font-extrabold text-[#2E3523] tracking-tight">
                  ${coverAmount.toLocaleString()}
                </div>
                <div className="mt-3 inline-flex items-center space-x-2 bg-white px-4 py-1.5 rounded-full border border-[#D8CBB9] shadow-sm">
                  <span className="text-xs text-stone-500 font-medium">New Monthly Premium:</span>
                  <span className="text-sm font-bold text-[#5A6644]">
                    ${monthlyPremium.toFixed(2)} / month
                  </span>
                </div>
                {policy.coverAmount !== coverAmount && (
                  <p className="mt-2 text-[11px] text-[#5A6644] font-semibold">
                    Current: ${policy.coverAmount.toLocaleString()} (${policy.monthlyPremium.toFixed(2)}/mo) &rarr; Change will be saved in audit log
                  </p>
                )}
              </div>

              {/* Slider */}
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

              {/* Quick Picks */}
              <div className="grid grid-cols-4 gap-2">
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
                    ${amount / 1000}k Cover
                  </button>
                ))}
              </div>
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
            <div className="space-y-4 animate-fade-in">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-wider text-[#2E3523] flex items-center space-x-1.5">
                    <HeartHandshake className="w-4 h-4 text-[#8B9A6E]" />
                    <span>Beneficiary Designation</span>
                  </h3>
                  <p className="text-[11px] text-stone-500">
                    Rule: Total percentage allocation must equal exactly 100%.
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

              <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                {beneficiaries.map((b, index) => (
                  <div key={index} className="p-3 bg-white rounded-xl border border-[#D8CBB9] space-y-2 shadow-sm">
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
                        <label className="block text-stone-600 mb-0.5 font-medium">First Name</label>
                        <input
                          type="text"
                          required
                          placeholder="First name"
                          value={b.firstName}
                          onChange={(e) => handleBeneficiaryChange(index, 'firstName', e.target.value)}
                          className="w-full px-2.5 py-1.5 border border-[#D8CBB9] rounded-lg focus:ring-1 focus:ring-[#8B9A6E] text-stone-900"
                        />
                      </div>
                      <div>
                        <label className="block text-stone-600 mb-0.5 font-medium">Last Name</label>
                        <input
                          type="text"
                          required
                          placeholder="Last name"
                          value={b.lastName}
                          onChange={(e) => handleBeneficiaryChange(index, 'lastName', e.target.value)}
                          className="w-full px-2.5 py-1.5 border border-[#D8CBB9] rounded-lg focus:ring-1 focus:ring-[#8B9A6E] text-stone-900"
                        />
                      </div>
                      <div>
                        <label className="block text-stone-600 mb-0.5 font-medium">Relationship</label>
                        <select
                          value={b.relationship}
                          onChange={(e) => handleBeneficiaryChange(index, 'relationship', e.target.value)}
                          className="w-full px-2 py-1.5 border border-[#D8CBB9] rounded-lg focus:ring-1 focus:ring-[#8B9A6E] bg-white text-stone-900"
                        >
                          <option>Spouse</option>
                          <option>Child</option>
                          <option>Parent</option>
                          <option>Sibling</option>
                          <option>Trust/Estate</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-stone-600 mb-0.5 font-medium">Share (%)</label>
                        <input
                          type="number"
                          min="1"
                          max="100"
                          value={b.percentage}
                          onChange={(e) => handleBeneficiaryChange(index, 'percentage', Number(e.target.value))}
                          className="w-full px-2.5 py-1.5 border border-[#D8CBB9] rounded-lg focus:ring-1 focus:ring-[#8B9A6E] text-stone-900 font-bold"
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
                disabled={isSubmitting || Math.abs(totalPercentage - 100) > 0.01}
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
