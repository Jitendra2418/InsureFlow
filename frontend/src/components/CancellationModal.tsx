import React, { useState, useEffect } from 'react';
import { Policy } from '../types';
import { apiRequest } from '../api';
import {
  X,
  AlertTriangle,
  ShieldOff,
  CheckCircle2,
  ChevronRight,
  Loader2,
  AlertCircle,
  Info,
  DollarSign,
  Calendar,
  Users,
} from 'lucide-react';

interface CancellationModalProps {
  isOpen: boolean;
  policy: Policy | null;
  onClose: () => void;
  onCancelled: (policyId: string) => void;
}

type Step = 'reason' | 'impact' | 'confirm';

const CANCEL_REASONS = [
  { id: 'no_longer_needed', label: 'Coverage No Longer Needed', description: 'My circumstances have changed and I no longer require this policy.' },
  { id: 'too_expensive', label: 'Premium Cost Too High', description: 'The monthly premium no longer fits my budget.' },
  { id: 'found_better', label: 'Found Better Coverage Elsewhere', description: 'I have secured equivalent or superior coverage with another provider.' },
  { id: 'duplicate_coverage', label: 'Duplicate Coverage', description: 'I already have coverage that overlaps with this policy.' },
  { id: 'financial_hardship', label: 'Financial Hardship', description: 'I am experiencing financial difficulties and must reduce expenses.' },
  { id: 'other', label: 'Other Reason', description: 'Please describe your reason below.' },
];

const IMPACT_ITEMS = [
  {
    icon: ShieldOff,
    color: 'text-red-600',
    bg: 'bg-red-50',
    border: 'border-red-200',
    title: 'Immediate Loss of Protection',
    body: 'Your AD&D coverage will be terminated. Any accidental death or dismemberment after cancellation will not be covered.',
  },
  {
    icon: DollarSign,
    color: 'text-amber-600',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    title: 'No Partial Premium Refund',
    body: 'Per policy terms, premiums already paid are non-refundable. Future billing will be stopped immediately upon cancellation.',
  },
  {
    icon: Users,
    color: 'text-orange-600',
    bg: 'bg-orange-50',
    border: 'border-orange-200',
    title: 'Beneficiaries Lose Entitlement',
    body: 'All designated beneficiaries will lose their right to claim the principal sum benefit upon your accidental death.',
  },
  {
    icon: Calendar,
    color: 'text-purple-600',
    bg: 'bg-purple-50',
    border: 'border-purple-200',
    title: 'Re-enrollment Requires New Verification',
    body: 'If you wish to re-enroll in the future, a new campaign code, underwriting review, and eligibility verification will be required.',
  },
];

export const CancellationModal: React.FC<CancellationModalProps> = ({
  isOpen,
  policy,
  onClose,
  onCancelled,
}) => {
  const [step, setStep] = useState<Step>('reason');
  const [selectedReason, setSelectedReason] = useState<string>('');
  const [customReason, setCustomReason] = useState<string>('');
  const [impactChecks, setImpactChecks] = useState<boolean[]>([false, false, false, false]);
  const [confirmText, setConfirmText] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setStep('reason');
      setSelectedReason('');
      setCustomReason('');
      setImpactChecks([false, false, false, false]);
      setConfirmText('');
      setError(null);
      setIsLoading(false);
    }
  }, [isOpen]);

  if (!isOpen || !policy) return null;

  const CONFIRM_PHRASE = 'CANCEL POLICY';
  const allImpactsAcknowledged = impactChecks.every(Boolean);
  const confirmMatch = confirmText.trim().toUpperCase() === CONFIRM_PHRASE;

  const finalReason =
    selectedReason === 'other'
      ? customReason.trim() || 'Other'
      : CANCEL_REASONS.find((r) => r.id === selectedReason)?.label || selectedReason;

  const handleStep1Next = () => {
    if (!selectedReason) return;
    if (selectedReason === 'other' && !customReason.trim()) return;
    setStep('impact');
  };

  const handleStep2Next = () => {
    if (!allImpactsAcknowledged) return;
    setStep('confirm');
  };

  const toggleImpactCheck = (index: number) => {
    setImpactChecks((prev) => prev.map((v, i) => (i === index ? !v : v)));
  };

  const handleFinalCancel = async () => {
    if (!confirmMatch) return;
    setIsLoading(true);
    setError(null);
    try {
      await apiRequest(`/policies/${policy.id}`, {
        method: 'DELETE',
        body: JSON.stringify({ cancellationReason: finalReason }),
      });
      onCancelled(policy.id);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel policy. Please try again.');
      setIsLoading(false);
    }
  };

  const stepIndex = step === 'reason' ? 0 : step === 'impact' ? 1 : 2;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-6 bg-stone-900/70 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-red-200 overflow-hidden my-3 flex flex-col max-h-[94vh] animate-fade-in">

        {/* ── Header ── */}
        <div className="bg-gradient-to-r from-red-600 to-red-700 px-6 py-4 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-sm font-extrabold text-white tracking-tight">Cancel Insurance Policy</h2>
              <p className="text-xs text-red-200 font-medium font-mono">{policy.policyNumber}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-red-200 hover:text-white rounded-lg hover:bg-white/20 transition"
            disabled={isLoading}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ── Step Progress Bar ── */}
        <div className="flex border-b border-stone-200 bg-stone-50 flex-shrink-0">
          {(['reason', 'impact', 'confirm'] as Step[]).map((s, i) => (
            <div
              key={s}
              className={`flex-1 py-2.5 px-3 flex items-center justify-center space-x-1.5 text-[11px] font-bold uppercase tracking-wider border-b-2 transition ${
                step === s
                  ? 'border-red-500 text-red-700 bg-red-50'
                  : i < stepIndex
                  ? 'border-emerald-500 text-emerald-700 bg-emerald-50'
                  : 'border-transparent text-stone-400'
              }`}
            >
              <span className={`w-4 h-4 rounded-full text-[9px] font-extrabold flex items-center justify-center ${
                i < stepIndex ? 'bg-emerald-600 text-white' : step === s ? 'bg-red-600 text-white' : 'bg-stone-300 text-white'
              }`}>
                {i < stepIndex ? '✓' : i + 1}
              </span>
              <span className="hidden sm:inline">
                {s === 'reason' ? 'Reason' : s === 'impact' ? 'Impact Review' : 'Confirm'}
              </span>
            </div>
          ))}
        </div>

        {/* ── Scrollable Body ── */}
        <div className="p-6 overflow-y-auto flex-1 space-y-5">

          {/* STEP 1 — Reason Selection */}
          {step === 'reason' && (
            <div className="space-y-4 animate-fade-in">
              <div>
                <h3 className="text-base font-extrabold text-stone-900">Why are you cancelling?</h3>
                <p className="text-xs text-stone-500 mt-0.5">
                  Your feedback helps InsureFlow improve. Select the primary reason for cancellation.
                </p>
              </div>

              {/* Policy being cancelled */}
              <div className="p-3.5 bg-red-50 rounded-2xl border border-red-200 flex items-center space-x-3">
                <ShieldOff className="w-5 h-5 text-red-500 flex-shrink-0" />
                <div className="text-xs">
                  <p className="font-bold text-red-800">{policy.productName}</p>
                  <p className="text-red-600 font-mono">
                    #{policy.policyNumber} &bull; ${policy.coverAmount.toLocaleString()} Cover &bull; ${policy.monthlyPremium.toFixed(2)}/mo
                  </p>
                </div>
              </div>

              {/* Reason tiles */}
              <div className="space-y-2">
                {CANCEL_REASONS.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setSelectedReason(r.id)}
                    className={`w-full text-left p-3.5 rounded-xl border-2 transition ${
                      selectedReason === r.id
                        ? 'border-red-500 bg-red-50'
                        : 'border-stone-200 hover:border-stone-300 bg-white hover:bg-stone-50'
                    }`}
                  >
                    <div className="flex items-start space-x-3">
                      <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 mt-0.5 flex items-center justify-center transition ${
                        selectedReason === r.id ? 'border-red-600 bg-red-600' : 'border-stone-400'
                      }`}>
                        {selectedReason === r.id && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </div>
                      <div>
                        <p className={`text-xs font-bold ${selectedReason === r.id ? 'text-red-800' : 'text-stone-800'}`}>
                          {r.label}
                        </p>
                        <p className="text-[11px] text-stone-500 mt-0.5">{r.description}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>

              {/* Free-text for "other" */}
              {selectedReason === 'other' && (
                <div className="animate-fade-in">
                  <label className="block text-xs font-bold text-stone-700 mb-1.5">
                    Please describe your reason <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={customReason}
                    onChange={(e) => setCustomReason(e.target.value)}
                    rows={3}
                    maxLength={300}
                    placeholder="Describe your reason for cancellation..."
                    className="w-full px-3.5 py-2.5 text-sm bg-white border-2 border-stone-200 focus:border-red-400 rounded-xl outline-none resize-none font-medium text-stone-800 placeholder-stone-400 transition"
                  />
                  <p className="text-[11px] text-stone-400 text-right mt-0.5">{customReason.length}/300</p>
                </div>
              )}

              {/* Info notice */}
              <div className="flex items-start space-x-2 p-3 bg-blue-50 rounded-xl border border-blue-200">
                <Info className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
                <p className="text-[11px] text-blue-700 font-medium">
                  Cancellation is permanent and takes effect immediately in our PostgreSQL database. This action cannot be undone.
                </p>
              </div>
            </div>
          )}

          {/* STEP 2 — Impact Acknowledgment */}
          {step === 'impact' && (
            <div className="space-y-4 animate-fade-in">
              <div>
                <h3 className="text-base font-extrabold text-stone-900">Understand the impact</h3>
                <p className="text-xs text-stone-500 mt-0.5">
                  Please acknowledge each consequence before proceeding. Check all boxes to continue.
                </p>
              </div>

              {/* Cover amount highlight */}
              <div className="p-3.5 bg-gradient-to-r from-red-50 to-orange-50 rounded-2xl border border-red-200 text-center">
                <p className="text-[11px] font-bold uppercase tracking-wider text-red-700 mb-0.5">You are about to lose</p>
                <p className="text-3xl font-black text-red-700">${policy.coverAmount.toLocaleString()}</p>
                <p className="text-xs text-red-600 font-semibold">Principal Sum AD&D Coverage</p>
                <p className="text-[11px] text-stone-500 mt-1">
                  {policy.beneficiaries.length} beneficiar{policy.beneficiaries.length === 1 ? 'y' : 'ies'} will lose all entitlement
                </p>
              </div>

              <div className="space-y-2.5">
                {IMPACT_ITEMS.map((item, idx) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => toggleImpactCheck(idx)}
                      className={`w-full text-left p-3.5 rounded-xl border-2 transition ${
                        impactChecks[idx]
                          ? 'border-emerald-400 bg-emerald-50'
                          : `border-stone-200 ${item.bg} hover:border-stone-300`
                      }`}
                    >
                      <div className="flex items-start space-x-3">
                        <div className={`w-5 h-5 rounded flex-shrink-0 mt-0.5 flex items-center justify-center border-2 transition ${
                          impactChecks[idx] ? 'bg-emerald-600 border-emerald-600' : `${item.border} bg-white`
                        }`}>
                          {impactChecks[idx] && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center space-x-2">
                            <Icon className={`w-3.5 h-3.5 ${impactChecks[idx] ? 'text-emerald-600' : item.color} flex-shrink-0`} />
                            <p className={`text-xs font-bold ${impactChecks[idx] ? 'text-emerald-800' : 'text-stone-800'}`}>
                              {item.title}
                            </p>
                          </div>
                          <p className="text-[11px] text-stone-500 mt-1 leading-relaxed pl-5">{item.body}</p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              {!allImpactsAcknowledged && (
                <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 px-3 py-2 rounded-lg font-medium flex items-center space-x-1.5">
                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>Please check all {impactChecks.filter(Boolean).length}/{IMPACT_ITEMS.length} impact acknowledgments to continue.</span>
                </p>
              )}
            </div>
          )}

          {/* STEP 3 — Type-to-Confirm */}
          {step === 'confirm' && (
            <div className="space-y-4 animate-fade-in">
              <div>
                <h3 className="text-base font-extrabold text-stone-900">Final Confirmation</h3>
                <p className="text-xs text-stone-500 mt-0.5">
                  This is your last chance to review before permanent cancellation.
                </p>
              </div>

              {/* Cancellation summary card */}
              <div className="p-4 bg-stone-50 rounded-2xl border border-stone-200 space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-stone-500 font-medium">Policy Number:</span>
                  <span className="font-mono font-bold text-stone-900">{policy.policyNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-500 font-medium">Product:</span>
                  <span className="font-semibold text-stone-900">{policy.productName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-500 font-medium">Cover Amount:</span>
                  <span className="font-bold text-red-700">${policy.coverAmount.toLocaleString()} (FORFEITED)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-500 font-medium">Cancellation Reason:</span>
                  <span className="font-semibold text-stone-900 text-right max-w-[55%]">{finalReason}</span>
                </div>
                <div className="flex justify-between pt-2 border-t border-stone-200">
                  <span className="text-stone-500 font-medium">Effective:</span>
                  <span className="font-bold text-red-700">Immediately upon confirmation</span>
                </div>
              </div>

              {/* Type-to-confirm input */}
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-2">
                  Type{' '}
                  <code className="bg-red-100 text-red-800 px-1.5 py-0.5 rounded font-mono font-extrabold tracking-wider">
                    {CONFIRM_PHRASE}
                  </code>{' '}
                  to permanently cancel this policy:
                </label>
                <input
                  type="text"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder={CONFIRM_PHRASE}
                  autoFocus
                  className={`w-full px-4 py-3 text-sm font-mono font-bold border-2 rounded-xl outline-none transition tracking-wider ${
                    confirmText.trim() === ''
                      ? 'border-stone-200 bg-white text-stone-800'
                      : confirmMatch
                      ? 'border-red-500 bg-red-50 text-red-800'
                      : 'border-amber-400 bg-amber-50 text-amber-800'
                  }`}
                />
                {confirmText.trim() !== '' && !confirmMatch && (
                  <p className="text-[11px] text-amber-600 mt-1.5 font-medium flex items-center space-x-1">
                    <AlertCircle className="w-3 h-3" />
                    <span>Text must match exactly: <strong>{CONFIRM_PHRASE}</strong></span>
                  </p>
                )}
                {confirmMatch && (
                  <p className="text-[11px] text-red-600 mt-1.5 font-bold flex items-center space-x-1">
                    <AlertTriangle className="w-3 h-3" />
                    <span>Confirmed. Click the button below to permanently cancel.</span>
                  </p>
                )}
              </div>

              {/* Error banner */}
              {error && (
                <div className="p-3 bg-red-50 border border-red-300 rounded-xl text-xs text-red-800 font-semibold flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Footer Actions — Fixed ── */}
        <div className="bg-stone-50 px-6 py-4 border-t border-stone-200 flex items-center justify-between gap-3 flex-shrink-0">

          {/* Back / Cancel */}
          <button
            type="button"
            onClick={() => {
              if (step === 'reason') onClose();
              else if (step === 'impact') setStep('reason');
              else setStep('impact');
            }}
            disabled={isLoading}
            className="text-xs font-bold text-stone-600 hover:text-stone-900 bg-white hover:bg-stone-100 px-4 py-2.5 rounded-xl border border-stone-200 transition disabled:opacity-50"
          >
            {step === 'reason' ? 'Keep My Policy' : '← Back'}
          </button>

          {/* Primary action */}
          {step === 'reason' && (
            <button
              type="button"
              onClick={handleStep1Next}
              disabled={!selectedReason || (selectedReason === 'other' && !customReason.trim())}
              className="inline-flex items-center space-x-1.5 text-xs font-bold bg-stone-800 hover:bg-stone-900 text-white px-5 py-2.5 rounded-xl transition disabled:opacity-40 disabled:cursor-not-allowed shadow"
            >
              <span>Review Impact</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          )}

          {step === 'impact' && (
            <button
              type="button"
              onClick={handleStep2Next}
              disabled={!allImpactsAcknowledged}
              className="inline-flex items-center space-x-1.5 text-xs font-bold bg-red-600 hover:bg-red-700 text-white px-5 py-2.5 rounded-xl transition disabled:opacity-40 disabled:cursor-not-allowed shadow"
            >
              <span>I Understand, Proceed</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          )}

          {step === 'confirm' && (
            <button
              type="button"
              onClick={handleFinalCancel}
              disabled={!confirmMatch || isLoading}
              className="inline-flex items-center space-x-2 text-xs font-extrabold bg-red-700 hover:bg-red-800 text-white px-5 py-2.5 rounded-xl transition disabled:opacity-40 disabled:cursor-not-allowed shadow"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Cancelling...</span>
                </>
              ) : (
                <>
                  <ShieldOff className="w-4 h-4" />
                  <span>Permanently Cancel Policy</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
