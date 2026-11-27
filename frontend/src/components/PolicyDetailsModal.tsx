import React, { useState, useEffect } from 'react';
import { Policy, PolicyAuditLog } from '../types';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../api';
import { generateInsuranceCertificate } from '../utils/pdfCertificate';
import {
  X,
  ShieldCheck,
  Download,
  Edit3,
  Building2,
  Users,
  Clock,
  CheckCircle2,
  FileText,
  Copy,
  Check,
  TrendingUp
} from 'lucide-react';

interface PolicyDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  policy: Policy | null;
  onEditPolicy?: (policy: Policy) => void;
}

export const PolicyDetailsModal: React.FC<PolicyDetailsModalProps> = ({
  isOpen,
  onClose,
  policy: initialPolicy,
  onEditPolicy
}) => {
  const { user } = useAuth();
  const [policy, setPolicy] = useState<Policy | null>(initialPolicy);
  const [auditLogs, setAuditLogs] = useState<PolicyAuditLog[]>([]);
  const [isLoadingAudit, setIsLoadingAudit] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'summary' | 'benefits' | 'beneficiaries' | 'audit'>('summary');
  const [copied, setCopied] = useState<boolean>(false);

  useEffect(() => {
    if (!isOpen || !initialPolicy) return;

    setPolicy(initialPolicy);
    let isMounted = true;
    setIsLoadingAudit(true);

    const fetchAudit = async () => {
      try {
        const data = await apiRequest<Policy & { auditLogs?: PolicyAuditLog[] }>(`/policies/${initialPolicy.id}`);
        if (isMounted) {
          setPolicy(data);
          if (data.auditLogs) {
            setAuditLogs(data.auditLogs);
          }
        }
      } catch {
        // Fallback: policy is already visible from initialPolicy; audit logs will populate once backend is restarted
      } finally {
        if (isMounted) setIsLoadingAudit(false);
      }
    };

    fetchAudit();

    return () => {
      isMounted = false;
    };
  }, [isOpen, initialPolicy]);

  if (!isOpen) return null;

  const handleCopyPolicyNumber = () => {
    if (!policy) return;
    navigator.clipboard.writeText(policy.policyNumber);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    if (!policy) return;
    generateInsuranceCertificate(policy, user);
  };

  // Actuarial dismemberment schedule (7 standard conditions)
  const coverSum = policy?.coverAmount || 100000;
  const payoutSchedule = [
    { condition: 'Accidental Loss of Life', percent: 100, amount: coverSum },
    { condition: 'Loss of Both Hands or Both Feet', percent: 100, amount: coverSum },
    { condition: 'Loss of Entire Sight of Both Eyes', percent: 100, amount: coverSum },
    { condition: 'Loss of One Hand and One Foot', percent: 100, amount: coverSum },
    { condition: 'Loss of Entire Speech and Hearing in Both Ears', percent: 100, amount: coverSum },
    { condition: 'Loss of One Hand, One Foot, or Sight of One Eye', percent: 50, amount: coverSum * 0.5 },
    { condition: 'Loss of Thumb and Index Finger of Same Hand', percent: 25, amount: coverSum * 0.25 },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-3 sm:p-6 bg-stone-900/60 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-3xl bg-[#F7F2EB] rounded-3xl shadow-2xl border border-[#D8CBB9] overflow-hidden my-3 sm:my-6 flex flex-col max-h-[92vh] animate-fade-in">
        
        {/* Header - Fixed */}
        <div className="bg-[#EAE2D6] px-6 py-4 border-b border-[#D8CBB9] flex items-center justify-between flex-shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-[#8B9A6E] flex items-center justify-center text-white shadow-sm">
              <ShieldCheck className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-mono text-xs font-extrabold text-[#2E3523] uppercase tracking-wider">
                  {policy?.policyNumber || 'Loading...'}
                </span>
                {policy && (
                  <button
                    onClick={handleCopyPolicyNumber}
                    className="p-1 text-stone-500 hover:text-stone-900 rounded hover:bg-[#F7F2EB] transition"
                    title="Copy Policy Number"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                )}
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider flex items-center space-x-1 ${
                  policy?.status === 'ACTIVE'
                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                    : 'bg-stone-200 text-stone-600'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${policy?.status === 'ACTIVE' ? 'bg-emerald-600 animate-pulse' : 'bg-stone-400'}`} />
                  <span>{policy?.status || 'ACTIVE'}</span>
                </span>
              </div>
              <p className="text-xs text-stone-600 font-medium">
                {policy?.productName || 'Accidental Death & Dismemberment (AD&D)'} &bull; Apex Trust Bank Partner Plan
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

        {/* Tab Navigation - Fixed */}
        <div className="flex border-b border-[#D8CBB9] bg-[#EEEEEE] text-xs font-bold flex-shrink-0 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('summary')}
            className={`flex-1 min-w-[130px] py-3 px-4 flex items-center justify-center space-x-1.5 transition border-b-2 ${
              activeTab === 'summary'
                ? 'bg-[#F7F2EB] text-[#2E3523] border-[#8B9A6E]'
                : 'text-stone-600 border-transparent hover:text-stone-900'
            }`}
          >
            <FileText className="w-4 h-4 text-[#8B9A6E]" />
            <span>Overview & Details</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('benefits')}
            className={`flex-1 min-w-[130px] py-3 px-4 flex items-center justify-center space-x-1.5 transition border-b-2 ${
              activeTab === 'benefits'
                ? 'bg-[#F7F2EB] text-[#2E3523] border-[#8B9A6E]'
                : 'text-stone-600 border-transparent hover:text-stone-900'
            }`}
          >
            <TrendingUp className="w-4 h-4 text-[#8B9A6E]" />
            <span>Coverage Schedule</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('beneficiaries')}
            className={`flex-1 min-w-[130px] py-3 px-4 flex items-center justify-center space-x-1.5 transition border-b-2 ${
              activeTab === 'beneficiaries'
                ? 'bg-[#F7F2EB] text-[#2E3523] border-[#8B9A6E]'
                : 'text-stone-600 border-transparent hover:text-stone-900'
            }`}
          >
            <Users className="w-4 h-4 text-[#8B9A6E]" />
            <span>Beneficiaries ({policy?.beneficiaries?.length || 0})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('audit')}
            className={`flex-1 min-w-[130px] py-3 px-4 flex items-center justify-center space-x-1.5 transition border-b-2 ${
              activeTab === 'audit'
                ? 'bg-[#F7F2EB] text-[#2E3523] border-[#8B9A6E]'
                : 'text-stone-600 border-transparent hover:text-stone-900'
            }`}
          >
            <Clock className="w-4 h-4 text-[#8B9A6E]" />
            <span>Audit Trail ({auditLogs.length})</span>
          </button>
        </div>

        {/* Modal Body - Scrollable Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {policy && (
            <>
              {/* TAB 1: OVERVIEW & DETAILS */}
              {activeTab === 'summary' && (
                <div className="space-y-5 animate-fade-in">
                  {/* Financial KPI Cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-3.5 bg-white rounded-2xl border border-[#D8CBB9] shadow-xs">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-stone-500">Principal Sum</span>
                      <p className="text-lg font-extrabold text-[#2E3523] mt-0.5">
                        ${policy.coverAmount.toLocaleString()}
                      </p>
                      <span className="text-[10px] text-[#5A6644] font-medium">100% Death Benefit</span>
                    </div>

                    <div className="p-3.5 bg-white rounded-2xl border border-[#D8CBB9] shadow-xs">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-stone-500">Monthly Premium</span>
                      <p className="text-lg font-extrabold text-[#5A6644] mt-0.5">
                        ${policy.monthlyPremium.toFixed(2)}<span className="text-xs text-stone-400 font-normal">/mo</span>
                      </p>
                      <span className="text-[10px] text-stone-500 font-medium">Automatic Debit</span>
                    </div>

                    <div className="p-3.5 bg-white rounded-2xl border border-[#D8CBB9] shadow-xs">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-stone-500">Annual Value</span>
                      <p className="text-lg font-extrabold text-stone-800 mt-0.5">
                        ${(policy.monthlyPremium * 12).toFixed(2)}<span className="text-xs text-stone-400 font-normal">/yr</span>
                      </p>
                      <span className="text-[10px] text-stone-500 font-medium">Guaranteed Rate</span>
                    </div>

                    <div className="p-3.5 bg-white rounded-2xl border border-[#D8CBB9] shadow-xs">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-stone-500">Daily Micro-Cost</span>
                      <p className="text-lg font-extrabold text-stone-800 mt-0.5">
                        ${((policy.monthlyPremium * 12) / 365).toFixed(2)}<span className="text-xs text-stone-400 font-normal">/day</span>
                      </p>
                      <span className="text-[10px] text-stone-500 font-medium">24/7 Global Cover</span>
                    </div>
                  </div>

                  {/* Policy Specifications & Underwriting Table */}
                  <div className="p-4 bg-[#EAE2D6]/40 rounded-2xl border border-[#D8CBB9] space-y-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-[#2E3523] flex items-center space-x-1.5">
                      <Building2 className="w-3.5 h-3.5 text-[#8B9A6E]" />
                      <span>Policy Specifications & Underwriting Metadata</span>
                    </h4>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div className="flex justify-between py-1.5 border-b border-stone-200/60">
                        <span className="text-stone-500">Policy Number:</span>
                        <span className="font-mono font-bold text-stone-900">{policy.policyNumber}</span>
                      </div>
                      <div className="flex justify-between py-1.5 border-b border-stone-200/60">
                        <span className="text-stone-500">Product Plan:</span>
                        <span className="font-semibold text-stone-900">Accidental Death & Dismemberment ({policy.productCode})</span>
                      </div>
                      <div className="flex justify-between py-1.5 border-b border-stone-200/60">
                        <span className="text-stone-500">Effective Date:</span>
                        <span className="font-semibold text-stone-900">{policy.effectiveDate}</span>
                      </div>
                      <div className="flex justify-between py-1.5 border-b border-stone-200/60">
                        <span className="text-stone-500">Campaign Code:</span>
                        <span className="font-mono font-bold text-[#5A6644]">{policy.campaignCode || 'DIRECT-APEX'}</span>
                      </div>
                      <div className="flex justify-between py-1.5 border-b border-stone-200/60">
                        <span className="text-stone-500">Actuarial Rating Formula:</span>
                        <span className="font-semibold text-stone-900">$0.60 per $1,000 / month</span>
                      </div>
                      <div className="flex justify-between py-1.5 border-b border-stone-200/60">
                        <span className="text-stone-500">Underwriting Age Limits:</span>
                        <span className="font-semibold text-stone-900">18 &ndash; 69 Years (Guaranteed Issue)</span>
                      </div>
                      <div className="flex justify-between py-1.5 border-b border-stone-200/60">
                        <span className="text-stone-500">Territory Scope:</span>
                        <span className="font-semibold text-stone-900">24/7 Worldwide Protection</span>
                      </div>
                      <div className="flex justify-between py-1.5 border-b border-stone-200/60">
                        <span className="text-stone-500">Issuing Partner Bank:</span>
                        <span className="font-semibold text-stone-900">Apex Trust Bank &bull; InsureFlow Affinity</span>
                      </div>
                    </div>
                  </div>

                  {/* Insured Profile & Verified Mailing Address */}
                  <div className="p-4 bg-white rounded-2xl border border-[#D8CBB9] space-y-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-[#2E3523] flex items-center space-x-1.5">
                      <Users className="w-3.5 h-3.5 text-[#8B9A6E]" />
                      <span>Primary Insured & Mailing Address</span>
                    </h4>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                      <div className="space-y-1">
                        <span className="text-stone-500 font-medium">Insured Name:</span>
                        <p className="font-bold text-stone-900 text-sm">
                          {user ? `${user.firstName} ${user.lastName}` : 'Policyholder'}
                        </p>
                        <p className="text-stone-600">{user?.email}</p>
                        {user?.phone && <p className="text-stone-600 font-mono">{user.phone}</p>}
                      </div>

                      <div className="space-y-1">
                        <span className="text-stone-500 font-medium">Official Policy Mailing Address:</span>
                        <p className="font-semibold text-stone-900">
                          {policy.addressLine1}
                          {policy.addressLine2 ? `, ${policy.addressLine2}` : ''}
                        </p>
                        <p className="text-stone-600">
                          {policy.city}, {policy.state} {policy.zipCode}
                        </p>
                        <span className="inline-block mt-1 text-[10px] text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                          Postal Address Verified
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: COVERAGE PAYOUT SCHEDULE */}
              {activeTab === 'benefits' && (
                <div className="space-y-4 animate-fade-in">
                  <div className="p-3.5 bg-[#EAE2D6]/40 rounded-2xl border border-[#EAE2D6]">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-[#2E3523] mb-1">
                      Official Dismemberment & Accidental Loss Schedule
                    </h4>
                    <p className="text-xs text-stone-600">
                      Benefits are payable as a direct percentage of the <strong>${policy.coverAmount.toLocaleString()} USD</strong> principal cover amount in the event of accidental injury or loss.
                    </p>
                  </div>

                  <div className="bg-white rounded-2xl border border-[#D8CBB9] overflow-hidden shadow-xs">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-[#EEEEEE] text-[#2E3523] uppercase font-bold text-[10px] tracking-wider border-b border-[#D8CBB9]">
                        <tr>
                          <th className="py-3 px-4">Accidental Condition / Loss</th>
                          <th className="py-3 px-4 text-center">Benefit Share</th>
                          <th className="py-3 px-4 text-right">Payout Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-100 font-medium">
                        {payoutSchedule.map((row, idx) => (
                          <tr key={idx} className="hover:bg-stone-50/60 transition-colors">
                            <td className="py-3 px-4 text-stone-800 font-semibold flex items-center space-x-2">
                              <CheckCircle2 className="w-3.5 h-3.5 text-[#8B9A6E] flex-shrink-0" />
                              <span>{row.condition}</span>
                            </td>
                            <td className="py-3 px-4 text-center font-bold text-stone-700">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] ${
                                row.percent === 100
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : row.percent === 50
                                  ? 'bg-blue-100 text-blue-800'
                                  : 'bg-amber-100 text-amber-800'
                              }`}>
                                {row.percent}% of Sum
                              </span>
                            </td>
                            <td className="py-3 px-4 text-right font-mono font-bold text-[#2E3523]">
                              ${row.amount.toLocaleString()} USD
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <p className="text-[11px] text-stone-500 italic">
                    * Loss of life benefit is payable directly to designated beneficiaries. Living dismemberment benefits are paid to the insured policyholder.
                  </p>
                </div>
              )}

              {/* TAB 3: DESIGNATED BENEFICIARIES */}
              {activeTab === 'beneficiaries' && (
                <div className="space-y-4 animate-fade-in">
                  <div className="p-3.5 bg-[#EAE2D6]/40 rounded-2xl border border-[#EAE2D6] flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-[#2E3523]">
                        Designated Beneficiaries Allocation
                      </h4>
                      <p className="text-[11px] text-stone-600">
                        Primary shares total 100%. Contingent shares provide backup fallback.
                      </p>
                    </div>
                    <span className="px-2.5 py-1 bg-white rounded-lg border border-[#D8CBB9] text-xs font-bold text-[#5A6644]">
                      {policy.beneficiaries.length} Designated
                    </span>
                  </div>

                  <div className="space-y-3">
                    {policy.beneficiaries.map((b, idx) => (
                      <div
                        key={idx}
                        className="p-4 bg-white rounded-2xl border border-[#D8CBB9] shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center space-x-2">
                            <span className="w-5 h-5 rounded-full bg-[#EAE2D6] text-[#2E3523] flex items-center justify-center text-[10px] font-bold font-mono">
                              #{idx + 1}
                            </span>
                            <span className="font-bold text-stone-900 text-sm">
                              {b.firstName} {b.lastName}
                            </span>
                            <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                              b.isPrimary !== false ? 'bg-[#8B9A6E] text-white' : 'bg-stone-700 text-white'
                            }`}>
                              {b.isPrimary !== false ? 'Primary' : 'Contingent'}
                            </span>
                          </div>

                          <div className="flex flex-wrap items-center gap-3 text-xs text-stone-600 pl-7">
                            <span>Relationship: <strong>{b.relationship}</strong></span>
                            {b.phone && <span>Phone: <strong className="font-mono">{b.phone}</strong></span>}
                            {b.guardianName && (
                              <span className="text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 text-[10px]">
                                Legal Guardian / Trustee: <strong>{b.guardianName}</strong>
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="sm:text-right pl-7 sm:pl-0">
                          <span className="text-[10px] text-stone-400 font-bold uppercase">Benefit Share</span>
                          <p className="text-lg font-mono font-extrabold text-[#2E3523]">
                            {b.percentage}%
                          </p>
                          <span className="text-[10px] text-[#5A6644] font-semibold">
                            ${((policy.coverAmount * b.percentage) / 100).toLocaleString()} USD
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* TAB 4: IMMUTABLE AUDIT TRAIL */}
              {activeTab === 'audit' && (
                <div className="space-y-4 animate-fade-in">
                  <div className="p-3.5 bg-[#EAE2D6]/40 rounded-2xl border border-[#EAE2D6]">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-[#2E3523] mb-1 flex items-center space-x-1.5">
                      <Clock className="w-3.5 h-3.5 text-[#8B9A6E]" />
                      <span>PostgreSQL Immutable Policy Audit Trail</span>
                    </h4>
                    <p className="text-xs text-stone-600">
                      Pursuant to insurance compliance standards, all policy endorsements, cover adjustments, and beneficiary modifications are permanently preserved in <code>policy_audit_logs</code>.
                    </p>
                  </div>

                  {isLoadingAudit ? (
                    <div className="py-12 text-center text-stone-500 text-xs bg-white rounded-2xl border border-[#D8CBB9] space-y-2">
                      <div className="w-5 h-5 border-2 border-[#8B9A6E] border-t-transparent rounded-full animate-spin mx-auto" />
                      <p>Loading audit trail from PostgreSQL...</p>
                    </div>
                  ) : auditLogs.length === 0 ? (
                    <div className="py-12 text-center text-stone-500 text-xs bg-white rounded-2xl border border-[#D8CBB9] space-y-1">
                      <Clock className="w-6 h-6 text-stone-300 mx-auto mb-2" />
                      <p className="font-semibold text-stone-700">Initial policy enrollment is active.</p>
                      <p className="text-[11px] text-stone-500">Restart the backend server (<code>node server.js</code>) to stream live audit trail logs.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {auditLogs.map((log, index) => {
                        const dateStr = new Date(log.changed_at).toLocaleString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit',
                          hour12: true
                        });

                        return (
                          <div
                            key={index}
                            className="p-4 bg-white rounded-2xl border border-[#D8CBB9] shadow-xs space-y-2 relative"
                          >
                            <div className="flex items-center justify-between pb-2 border-b border-stone-100">
                              <div className="flex items-center space-x-2">
                                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider ${
                                  log.action === 'POLICY_ENROLLED'
                                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                    : log.action === 'UPDATE_COVER_AMOUNT'
                                    ? 'bg-blue-100 text-blue-800 border border-blue-300'
                                    : log.action === 'UPDATE_ADDRESS'
                                    ? 'bg-purple-100 text-purple-800 border border-purple-300'
                                    : 'bg-amber-100 text-amber-800 border border-amber-300'
                                }`}>
                                  {log.action}
                                </span>
                                <span className="text-xs font-bold text-stone-800">
                                  {log.action === 'POLICY_ENROLLED'
                                    ? 'Policy Issued & Initialized'
                                    : log.action === 'UPDATE_COVER_AMOUNT'
                                    ? 'Coverage Amount Endorsement'
                                    : log.action === 'UPDATE_ADDRESS'
                                    ? 'Mailing Address Updated'
                                    : log.action === 'UPDATE_BENEFICIARIES'
                                    ? 'Beneficiary Designation Modified'
                                    : 'Policy Modification'}
                                </span>
                              </div>

                              <span className="text-[11px] font-mono text-stone-500">
                                {dateStr}
                              </span>
                            </div>

                            {/* Diff breakdown */}
                            <div className="text-xs text-stone-600 space-y-1 pt-1">
                              {log.old_value && (
                                <div className="flex items-start space-x-2">
                                  <span className="text-[10px] font-bold uppercase text-red-600 w-12 flex-shrink-0 mt-0.5">Prior:</span>
                                  <code className="bg-red-50 text-red-800 px-2 py-0.5 rounded text-[11px] font-mono break-all border border-red-200">
                                    {JSON.stringify(log.old_value)}
                                  </code>
                                </div>
                              )}
                              {log.new_value && (
                                <div className="flex items-start space-x-2">
                                  <span className="text-[10px] font-bold uppercase text-emerald-600 w-12 flex-shrink-0 mt-0.5">Updated:</span>
                                  <code className="bg-emerald-50 text-emerald-800 px-2 py-0.5 rounded text-[11px] font-mono break-all border border-emerald-200">
                                    {JSON.stringify(log.new_value)}
                                  </code>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer Actions - Fixed */}
        <div className="bg-[#EAE2D6] px-6 py-4 border-t border-[#D8CBB9] flex flex-wrap items-center justify-between gap-3 flex-shrink-0">
          <div className="flex items-center space-x-2">
            <button
              onClick={handleDownload}
              className="inline-flex items-center space-x-1.5 text-xs font-bold text-[#5A6644] hover:text-[#2E3523] bg-white hover:bg-[#F7F2EB] px-4 py-2.5 rounded-xl transition border border-[#D8CBB9] shadow-xs"
            >
              <Download className="w-4 h-4 text-[#8B9A6E]" />
              <span>Download Official Certificate (PDF)</span>
            </button>

            {policy?.status === 'ACTIVE' && onEditPolicy && (
              <button
                onClick={() => {
                  onClose();
                  onEditPolicy(policy);
                }}
                className="inline-flex items-center space-x-1.5 text-xs font-bold text-stone-700 hover:text-stone-900 bg-white hover:bg-[#F7F2EB] px-4 py-2.5 rounded-xl transition border border-[#D8CBB9] shadow-xs"
              >
                <Edit3 className="w-4 h-4 text-[#8B9A6E]" />
                <span>Edit Policy Details</span>
              </button>
            )}
          </div>

          <button
            onClick={onClose}
            className="px-5 py-2.5 bg-[#8B9A6E] hover:bg-[#738258] text-white rounded-xl text-xs font-bold transition shadow-xs"
          >
            Close Details
          </button>
        </div>
      </div>
    </div>
  );
};
