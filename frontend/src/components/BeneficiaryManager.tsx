import React, { useState } from 'react';
import {
  Users,
  Plus,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  Info,
  ShieldCheck,
  Scale,
  Sparkles,
  UserCheck
} from 'lucide-react';
import { Beneficiary } from '../types';

interface BeneficiaryManagerProps {
  beneficiaries: Beneficiary[];
  onChange: (beneficiaries: Beneficiary[]) => void;
  showTitle?: boolean;
}

const RELATIONSHIP_OPTIONS = [
  'Spouse',
  'Child (Minor under 18)',
  'Adult Child',
  'Parent',
  'Sibling',
  'Domestic Partner',
  'Trust / Estate',
  'Other'
];

// Aesthetic corporate color palette for allocation segments
const SLICE_COLORS = [
  'bg-[#8B9A6E]', // Brand Sage
  'bg-[#5A6644]', // Deep Olive
  'bg-[#C2A649]', // Warm Gold
  'bg-[#6E829A]', // Slate Blue
  'bg-[#B86B52]', // Terracotta
  'bg-[#7A6B8A]', // Dusty Purple
];

export const BeneficiaryManager: React.FC<BeneficiaryManagerProps> = ({
  beneficiaries,
  onChange,
  showTitle = true,
}) => {
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'PRIMARY' | 'CONTINGENT'>('ALL');

  // Calculation helpers
  const primaryBens = beneficiaries.filter(b => b.isPrimary !== false);
  const contingentBens = beneficiaries.filter(b => b.isPrimary === false);

  const primaryTotal = primaryBens.reduce((sum, b) => sum + (Number(b.percentage) || 0), 0);
  const contingentTotal = contingentBens.reduce((sum, b) => sum + (Number(b.percentage) || 0), 0);

  // Equalize allocations across a group
  const handleEqualize = (isPrimaryGroup: boolean) => {
    const targetBens = beneficiaries.filter(b => (b.isPrimary !== false) === isPrimaryGroup);
    if (targetBens.length === 0) return;

    const count = targetBens.length;
    const baseShare = Math.floor((100 / count) * 100) / 100;
    const remainder = Math.round((100 - baseShare * count) * 100) / 100;

    let targetIndex = 0;
    const updated = beneficiaries.map(b => {
      if ((b.isPrimary !== false) === isPrimaryGroup) {
        // Give remainder to the first beneficiary to ensure exact 100.00%
        const share = targetIndex === 0 ? Number((baseShare + remainder).toFixed(2)) : baseShare;
        targetIndex++;
        return { ...b, percentage: share };
      }
      return b;
    });

    onChange(updated);
  };

  // Add a new beneficiary
  const handleAdd = (asPrimary = true) => {
    const existingGroup = beneficiaries.filter(b => (b.isPrimary !== false) === asPrimary);
    const curTotal = existingGroup.reduce((sum, b) => sum + (Number(b.percentage) || 0), 0);
    const remaining = Math.max(0, 100 - curTotal);

    const newBen: Beneficiary = {
      firstName: '',
      lastName: '',
      relationship: 'Spouse',
      percentage: remaining > 0 ? remaining : 0,
      phone: '',
      isPrimary: asPrimary,
      guardianName: ''
    };

    onChange([...beneficiaries, newBen]);
  };

  // Remove beneficiary
  const handleRemove = (index: number) => {
    if (beneficiaries.length <= 1) return;
    const updated = beneficiaries.filter((_, i) => i !== index);
    onChange(updated);
  };

  // Field change
  const handleChange = (index: number, field: keyof Beneficiary, value: unknown) => {
    const updated = [...beneficiaries];
    updated[index] = { ...updated[index], [field]: value };
    onChange(updated);
  };

  // Step percentage by delta
  const handleStepPercentage = (index: number, delta: number) => {
    const cur = Number(beneficiaries[index].percentage) || 0;
    const nextVal = Math.min(100, Math.max(0, Math.round((cur + delta) * 100) / 100));
    handleChange(index, 'percentage', nextVal);
  };

  // Balance remaining into this beneficiary
  const handleBalanceRemaining = (index: number) => {
    const isPrimary = beneficiaries[index].isPrimary !== false;
    const otherSum = beneficiaries
      .filter((b, i) => i !== index && (b.isPrimary !== false) === isPrimary)
      .reduce((sum, b) => sum + (Number(b.percentage) || 0), 0);
    const remaining = Math.max(0, Math.round((100 - otherSum) * 100) / 100);
    handleChange(index, 'percentage', remaining);
  };

  const filteredBeneficiaries = beneficiaries.map((b, originalIndex) => ({ b, originalIndex })).filter(({ b }) => {
    if (activeFilter === 'PRIMARY') return b.isPrimary !== false;
    if (activeFilter === 'CONTINGENT') return b.isPrimary === false;
    return true;
  });

  return (
    <div className="space-y-4">
      {/* Header & Filter Tabs */}
      {showTitle && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-[#EAE2D6]">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-[#2E3523] flex items-center space-x-1.5">
              <Users className="w-4 h-4 text-[#8B9A6E]" />
              <span>Beneficiary Designation & Legal Allocation</span>
            </h3>
            <p className="text-[11px] text-stone-600">
              Designate primary and contingent beneficiaries. Primary shares must total 100.0%.
            </p>
          </div>

          <div className="flex items-center space-x-1 bg-stone-200/80 p-0.5 rounded-lg text-xs font-semibold">
            <button
              type="button"
              onClick={() => setActiveFilter('ALL')}
              className={`px-2.5 py-1 rounded-md transition ${activeFilter === 'ALL' ? 'bg-white text-stone-900 shadow-xs' : 'text-stone-600 hover:text-stone-900'}`}
            >
              All ({beneficiaries.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveFilter('PRIMARY')}
              className={`px-2.5 py-1 rounded-md transition ${activeFilter === 'PRIMARY' ? 'bg-white text-stone-900 shadow-xs' : 'text-stone-600 hover:text-stone-900'}`}
            >
              Primary ({primaryBens.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveFilter('CONTINGENT')}
              className={`px-2.5 py-1 rounded-md transition ${activeFilter === 'CONTINGENT' ? 'bg-white text-stone-900 shadow-xs' : 'text-stone-600 hover:text-stone-900'}`}
            >
              Contingent ({contingentBens.length})
            </button>
          </div>
        </div>
      )}

      {/* Visual Allocation Meters */}
      <div className="p-3.5 bg-[#EAE2D6]/40 rounded-2xl border border-[#EAE2D6] space-y-3">
        {/* Primary Meter */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-[#2E3523] flex items-center space-x-1">
              <ShieldCheck className="w-3.5 h-3.5 text-[#8B9A6E]" />
              <span>Primary Allocation Meter</span>
            </span>
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={() => handleEqualize(true)}
                className="inline-flex items-center space-x-1 text-[11px] font-semibold text-[#5A6644] hover:text-[#2E3523] hover:underline"
              >
                <Scale className="w-3 h-3" />
                <span>Split Primary Equally</span>
              </button>
              <span className={`px-2 py-0.5 rounded-full font-mono text-[11px] font-bold ${
                Math.abs(primaryTotal - 100) < 0.01
                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                  : 'bg-amber-100 text-amber-800 border border-amber-300'
              }`}>
                {primaryTotal.toFixed(1)}% / 100%
              </span>
            </div>
          </div>

          {/* Stacked Progress Bar */}
          <div className="h-3 w-full bg-stone-200 rounded-full overflow-hidden flex shadow-inner">
            {primaryBens.map((b, idx) => {
              const pct = Math.max(0, Math.min(100, Number(b.percentage) || 0));
              if (pct <= 0) return null;
              const colorClass = SLICE_COLORS[idx % SLICE_COLORS.length];
              return (
                <div
                  key={idx}
                  style={{ width: `${pct}%` }}
                  className={`${colorClass} h-full transition-all duration-300 relative group`}
                  title={`${b.firstName || 'Beneficiary'} ${b.lastName}: ${pct}%`}
                />
              );
            })}
          </div>

          <div className="flex items-center justify-between text-[11px] text-stone-500">
            {Math.abs(primaryTotal - 100) < 0.01 ? (
              <span className="text-emerald-700 font-semibold flex items-center space-x-1">
                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                <span>Primary shares complete (100.0%)</span>
              </span>
            ) : primaryTotal < 100 ? (
              <span className="text-amber-700 font-semibold flex items-center space-x-1">
                <AlertTriangle className="w-3 h-3 text-amber-600" />
                <span>{(100 - primaryTotal).toFixed(1)}% unallocated (Must equal 100%)</span>
              </span>
            ) : (
              <span className="text-red-700 font-semibold flex items-center space-x-1">
                <AlertTriangle className="w-3 h-3 text-red-600" />
                <span>Overallocated by {(primaryTotal - 100).toFixed(1)}%</span>
              </span>
            )}
            <span className="text-stone-400 font-mono text-[10px]">{primaryBens.length} Primary</span>
          </div>
        </div>

        {/* Contingent Meter (if any contingent beneficiaries exist) */}
        {contingentBens.length > 0 && (
          <div className="pt-2.5 border-t border-[#D8CBB9]/60 space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-stone-700 flex items-center space-x-1">
                <UserCheck className="w-3.5 h-3.5 text-stone-500" />
                <span>Contingent (Secondary) Allocation Meter</span>
              </span>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => handleEqualize(false)}
                  className="inline-flex items-center space-x-1 text-[11px] font-semibold text-stone-600 hover:text-stone-900 hover:underline"
                >
                  <Scale className="w-3 h-3" />
                  <span>Split Contingent Equally</span>
                </button>
                <span className={`px-2 py-0.5 rounded-full font-mono text-[11px] font-bold ${
                  Math.abs(contingentTotal - 100) < 0.01
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                    : 'bg-amber-100 text-amber-800 border border-amber-300'
                }`}>
                  {contingentTotal.toFixed(1)}% / 100%
                </span>
              </div>
            </div>

            <div className="h-2.5 w-full bg-stone-200 rounded-full overflow-hidden flex shadow-inner">
              {contingentBens.map((b, idx) => {
                const pct = Math.max(0, Math.min(100, Number(b.percentage) || 0));
                if (pct <= 0) return null;
                const colorClass = SLICE_COLORS[(idx + 3) % SLICE_COLORS.length];
                return (
                  <div
                    key={idx}
                    style={{ width: `${pct}%` }}
                    className={`${colorClass} h-full transition-all duration-300`}
                    title={`${b.firstName || 'Contingent'} ${b.lastName}: ${pct}%`}
                  />
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Beneficiary Cards List */}
      <div className="space-y-3">
        {filteredBeneficiaries.map(({ b, originalIndex }) => {
          const isPrimary = b.isPrimary !== false;
          const isMinor = b.relationship === 'Child (Minor under 18)' || b.relationship === 'Child';
          const groupTotal = isPrimary ? primaryTotal : contingentTotal;
          const canBalance = groupTotal < 100;

          return (
            <div
              key={originalIndex}
              className="p-3.5 bg-white rounded-2xl border border-[#D8CBB9] shadow-sm hover:border-[#8B9A6E]/60 transition-colors space-y-3"
            >
              {/* Card Header */}
              <div className="flex items-center justify-between pb-2 border-b border-stone-100">
                <div className="flex items-center space-x-2">
                  <span className="w-6 h-6 rounded-full bg-[#EAE2D6] text-[#2E3523] flex items-center justify-center text-xs font-bold font-mono">
                    #{originalIndex + 1}
                  </span>
                  <span className="text-xs font-bold text-stone-800">
                    {b.firstName || b.lastName ? `${b.firstName} ${b.lastName}`.trim() : `Beneficiary #${originalIndex + 1}`}
                  </span>
                  
                  {/* Primary vs Contingent Toggle Pill */}
                  <div className="inline-flex rounded-lg border border-[#D8CBB9] p-0.5 bg-stone-50 text-[10px] font-bold">
                    <button
                      type="button"
                      onClick={() => handleChange(originalIndex, 'isPrimary', true)}
                      className={`px-2 py-0.5 rounded-md transition ${isPrimary ? 'bg-[#8B9A6E] text-white' : 'text-stone-500 hover:text-stone-900'}`}
                    >
                      Primary
                    </button>
                    <button
                      type="button"
                      onClick={() => handleChange(originalIndex, 'isPrimary', false)}
                      className={`px-2 py-0.5 rounded-md transition ${!isPrimary ? 'bg-stone-700 text-white' : 'text-stone-500 hover:text-stone-900'}`}
                    >
                      Contingent
                    </button>
                  </div>
                </div>

                <div className="flex items-center space-x-1">
                  {canBalance && (
                    <button
                      type="button"
                      onClick={() => handleBalanceRemaining(originalIndex)}
                      className="inline-flex items-center space-x-1 text-[11px] font-semibold text-[#5A6644] bg-[#EAE2D6]/60 hover:bg-[#EAE2D6] px-2 py-1 rounded-lg transition"
                      title="Set percentage to balance the remainder"
                    >
                      <Sparkles className="w-3 h-3 text-[#8B9A6E]" />
                      <span>Balance</span>
                    </button>
                  )}

                  {beneficiaries.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemove(originalIndex)}
                      className="p-1.5 text-stone-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition"
                      title="Remove beneficiary"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Form Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 text-xs">
                {/* First Name */}
                <div>
                  <label className="block text-stone-600 mb-1 font-semibold">First Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="Legal First Name"
                    value={b.firstName}
                    onChange={(e) => handleChange(originalIndex, 'firstName', e.target.value)}
                    className="w-full px-3 py-2 bg-stone-50/50 border border-[#D8CBB9] rounded-xl text-stone-900 focus:bg-white focus:ring-1 focus:ring-[#8B9A6E] focus:outline-none"
                  />
                </div>

                {/* Last Name */}
                <div>
                  <label className="block text-stone-600 mb-1 font-semibold">Last Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="Legal Last Name"
                    value={b.lastName}
                    onChange={(e) => handleChange(originalIndex, 'lastName', e.target.value)}
                    className="w-full px-3 py-2 bg-stone-50/50 border border-[#D8CBB9] rounded-xl text-stone-900 focus:bg-white focus:ring-1 focus:ring-[#8B9A6E] focus:outline-none"
                  />
                </div>

                {/* Relationship */}
                <div>
                  <label className="block text-stone-600 mb-1 font-semibold">Relationship</label>
                  <select
                    value={b.relationship}
                    onChange={(e) => handleChange(originalIndex, 'relationship', e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-[#D8CBB9] rounded-xl text-stone-900 focus:ring-1 focus:ring-[#8B9A6E] focus:outline-none"
                  >
                    {RELATIONSHIP_OPTIONS.map((rel) => (
                      <option key={rel} value={rel}>{rel}</option>
                    ))}
                  </select>
                </div>

                {/* Phone Number */}
                <div>
                  <label className="block text-stone-600 mb-1 font-semibold">Phone (For Claims)</label>
                  <input
                    type="tel"
                    placeholder="e.g. 555-0199"
                    value={b.phone || ''}
                    onChange={(e) => handleChange(originalIndex, 'phone', e.target.value)}
                    className="w-full px-3 py-2 bg-stone-50/50 border border-[#D8CBB9] rounded-xl text-stone-900 focus:bg-white focus:ring-1 focus:ring-[#8B9A6E] focus:outline-none"
                  />
                </div>
              </div>

              {/* Percentage Allocation Stepper / Input */}
              <div className="pt-2 border-t border-stone-100 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-semibold text-stone-600">Benefit Share:</span>
                  <div className="inline-flex items-center rounded-xl border border-[#D8CBB9] bg-stone-50 px-2 py-1">
                    <button
                      type="button"
                      onClick={() => handleStepPercentage(originalIndex, -5)}
                      className="px-1.5 py-0.5 text-xs font-bold text-stone-500 hover:text-stone-900 rounded hover:bg-stone-200 transition"
                    >
                      -5%
                    </button>
                    <input
                      type="number"
                      min="1"
                      max="100"
                      step="0.01"
                      value={b.percentage}
                      onChange={(e) => handleChange(originalIndex, 'percentage', parseFloat(e.target.value) || 0)}
                      className="w-16 text-center bg-transparent font-mono font-bold text-stone-900 text-sm focus:outline-none"
                    />
                    <span className="text-xs font-bold text-stone-500 mr-1">%</span>
                    <button
                      type="button"
                      onClick={() => handleStepPercentage(originalIndex, 5)}
                      className="px-1.5 py-0.5 text-xs font-bold text-stone-500 hover:text-stone-900 rounded hover:bg-stone-200 transition"
                    >
                      +5%
                    </button>
                  </div>
                </div>

                {/* Quick allocation chips */}
                <div className="flex items-center space-x-1.5">
                  <button
                    type="button"
                    onClick={() => handleChange(originalIndex, 'percentage', 100)}
                    className="px-2 py-1 text-[10px] font-bold bg-[#EAE2D6]/40 hover:bg-[#EAE2D6] text-stone-700 rounded-lg border border-[#D8CBB9] transition"
                  >
                    100% Solo
                  </button>
                  <button
                    type="button"
                    onClick={() => handleChange(originalIndex, 'percentage', 50)}
                    className="px-2 py-1 text-[10px] font-bold bg-[#EAE2D6]/40 hover:bg-[#EAE2D6] text-stone-700 rounded-lg border border-[#D8CBB9] transition"
                  >
                    50%
                  </button>
                  <button
                    type="button"
                    onClick={() => handleChange(originalIndex, 'percentage', 25)}
                    className="px-2 py-1 text-[10px] font-bold bg-[#EAE2D6]/40 hover:bg-[#EAE2D6] text-stone-700 rounded-lg border border-[#D8CBB9] transition"
                  >
                    25%
                  </button>
                </div>
              </div>

              {/* Minor / Trustee Field Guard */}
              {isMinor && (
                <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl space-y-2 animate-fade-in">
                  <div className="flex items-start space-x-2 text-xs text-amber-800">
                    <Info className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <strong className="font-semibold">Minor Custodian Safeguard (ERISA Compliance):</strong>
                      <p className="text-[11px] text-amber-700">
                        Life insurance benefits cannot be paid directly to minors under 18. An adult trustee or legal guardian must be designated to manage proceeds until the beneficiary reaches legal age.
                      </p>
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-amber-900 mb-1">
                      Designated Adult Trustee / Legal Guardian *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Legal Guardian Full Name"
                      value={b.guardianName || ''}
                      onChange={(e) => handleChange(originalIndex, 'guardianName', e.target.value)}
                      className="w-full px-3 py-1.5 bg-white border border-amber-300 rounded-lg text-xs text-stone-900 focus:ring-1 focus:ring-amber-500 focus:outline-none"
                    />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Add Beneficiary Action Buttons */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={() => handleAdd(true)}
            className="inline-flex items-center space-x-1.5 px-3 py-2 bg-white hover:bg-[#EAE2D6] text-[#2E3523] border border-[#D8CBB9] rounded-xl text-xs font-bold transition shadow-xs"
          >
            <Plus className="w-3.5 h-3.5 text-[#8B9A6E]" />
            <span>Add Primary Beneficiary</span>
          </button>
          <button
            type="button"
            onClick={() => handleAdd(false)}
            className="inline-flex items-center space-x-1.5 px-3 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 border border-stone-300 rounded-xl text-xs font-bold transition"
          >
            <Plus className="w-3.5 h-3.5 text-stone-500" />
            <span>Add Contingent Beneficiary</span>
          </button>
        </div>

        <div className="text-[11px] text-stone-500 italic">
          * Designations are preserved in policy audit history upon confirmation.
        </div>
      </div>
    </div>
  );
};
