import React, { useState, useEffect } from 'react';
import { Policy, Claim } from '../types';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../api';
import {
  X,
  FileText,
  Calendar,
  User,
  Building2,
  FileCheck2,
  UploadCloud,
  File,
  Trash2,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Info,
  Copy,
  Check,
  Loader2,
  Plus
} from 'lucide-react';

interface ClaimInsuranceModalProps {
  isOpen: boolean;
  onClose: () => void;
  policy: Policy | null;
  existingClaim?: Claim | null;
  onClaimSubmitted?: (newClaim: Claim) => void;
}

const INCIDENT_TYPES = [
  'Accidental Injury & Hospitalization',
  'Dismemberment / Loss of Limbs or Sight',
  'Severe Fracture or Accidental Disability',
  'Accidental Loss of Life (Designated Beneficiary)',
  'Emergency Room & Trauma Care'
];

export const ClaimInsuranceModal: React.FC<ClaimInsuranceModalProps> = ({
  isOpen,
  onClose,
  policy,
  existingClaim,
  onClaimSubmitted
}) => {
  const { user } = useAuth();

  // 1. Date received: Automatically fill the date whatever is the present date
  const todayIso = new Date().toISOString().split('T')[0];
  const todayFormatted = new Date().toLocaleDateString('en-US', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });

  // 2. Claim# code state
  const [claimNumber, setClaimNumber] = useState<string>('');
  const [copiedClaimNo, setCopiedClaimNo] = useState<boolean>(false);

  // 5. Incident details state
  const [incidentDate, setIncidentDate] = useState<string>(todayIso);
  const [incidentType, setIncidentType] = useState<string>(INCIDENT_TYPES[0]);
  const [description, setDescription] = useState<string>('');

  // 7. Supporting documents state
  const [documents, setDocuments] = useState<Array<{
    fileName: string;
    fileSize: number;
    contentType: string;
    s3Key?: string;
  }>>([]);
  const [docCategory, setDocCategory] = useState<string>('Medical Certificate');

  // UI state
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [submittedClaim, setSubmittedClaim] = useState<Claim | null>(null);

  // Initialize or reset when modal opens
  useEffect(() => {
    if (isOpen) {
      if (existingClaim) {
        setSubmittedClaim(existingClaim);
      } else {
        setSubmittedClaim(null);
        // Generate Claim# code upfront: CLM-YYYY-XXXXXX
        const currentYear = new Date().getFullYear();
        const randomNum = Math.floor(100000 + Math.random() * 900000);
        setClaimNumber(`CLM-${currentYear}-${randomNum}`);
        setIncidentDate(todayIso);
        setIncidentType(INCIDENT_TYPES[0]);
        setDescription('');
        setDocuments([]);
        setErrorMessage('');
      }
    }
  }, [isOpen, existingClaim, todayIso]);

  if (!isOpen || !policy) return null;

  const handleCopyClaimNumber = (codeToCopy: string) => {
    navigator.clipboard.writeText(codeToCopy);
    setCopiedClaimNo(true);
    setTimeout(() => setCopiedClaimNo(false), 2000);
  };

  // Handle local file uploads
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const newFiles: Array<{ fileName: string; fileSize: number; contentType: string }> = [];

    Array.from(e.target.files).forEach((file) => {
      newFiles.push({
        fileName: `[${docCategory}] ${file.name}`,
        fileSize: file.size,
        contentType: file.type || 'application/pdf'
      });
    });

    setDocuments((prev) => [...prev, ...newFiles]);
    e.target.value = ''; // reset input
  };

  const handleAddTemplateDoc = (title: string) => {
    const defaultDoc = {
      fileName: `${title}_${policy.policyNumber}.pdf`,
      fileSize: 245760, // 240 KB
      contentType: 'application/pdf'
    };
    setDocuments((prev) => [...prev, defaultDoc]);
  };

  const handleRemoveDoc = (index: number) => {
    setDocuments((prev) => prev.filter((_, i) => i !== index));
  };

  // Submit Claim
  const handleSubmitClaim = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) {
      setErrorMessage('Please describe the incident details before submitting.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage('');

    try {
      const payload = {
        policyId: policy.id,
        claimNumber,
        incidentType,
        incidentDate,
        description: description.trim(),
        // 6. Amount claimed: decided by operations team, pass coverAmount as reference baseline
        claimedAmount: policy.coverAmount,
        documents: documents.length > 0 ? documents : [
          {
            fileName: `Initial_Notice_Medical_Report_${claimNumber}.pdf`,
            fileSize: 153600,
            contentType: 'application/pdf'
          }
        ]
      };

      const res = await apiRequest<{ message: string; claim: Claim }>('/claims', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      setSubmittedClaim(res.claim);
      if (onClaimSubmitted) {
        onClaimSubmitted(res.claim);
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to submit claim. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Status badge styling helper
  const renderStatusBadge = (status: string) => {
    switch (status) {
      case 'APPROVED':
        return (
          <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-black bg-emerald-100 text-emerald-800 border border-emerald-300 shadow-xs">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>APPROVED BY OPERATIONS</span>
          </span>
        );
      case 'REJECTED':
        return (
          <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-black bg-red-100 text-red-800 border border-red-300 shadow-xs">
            <AlertTriangle className="w-4 h-4 text-red-600" />
            <span>REJECTED BY OPERATIONS</span>
          </span>
        );
      case 'UNDER_REVIEW':
        return (
          <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-black bg-purple-100 text-purple-800 border border-purple-300 shadow-xs">
            <Clock className="w-4 h-4 text-purple-600 animate-spin" />
            <span>UNDER REVIEW BY OPERATIONS</span>
          </span>
        );
      case 'SUBMITTED':
      default:
        return (
          <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-black bg-amber-100 text-amber-800 border border-amber-300 shadow-xs">
            <Clock className="w-4 h-4 text-amber-600" />
            <span>PENDING OPERATIONS REVIEW</span>
          </span>
        );
    }
  };

  const activeClaim = submittedClaim || existingClaim;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-stone-900/60 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-2xl bg-[#F7F2EB] rounded-3xl shadow-2xl border border-[#D8CBB9] overflow-hidden my-3 sm:my-6 flex flex-col max-h-[92vh] animate-fade-in">

        {/* ── Modal Header ── */}
        <div className="bg-[#EAE2D6] px-6 py-4 border-b border-[#D8CBB9] flex items-center justify-between flex-shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-[#5A6644] text-white flex items-center justify-center shadow-sm">
              <FileCheck2 className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-base font-extrabold text-[#2E3523] tracking-tight">
                  {activeClaim ? 'Insurance Claim Details & Status' : 'Claim Insurance'}
                </h3>
                {activeClaim && renderStatusBadge(activeClaim.status)}
              </div>
              <p className="text-xs text-stone-600 font-medium">
                Accidental Death & Dismemberment Claim Submission & Adjudication
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-stone-500 hover:text-stone-800 rounded-lg hover:bg-white/60 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ── Modal Body (Scrollable) ── */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">

          {/* ════ VIEW MODE: CLAIM ALREADY SUBMITTED ════ */}
          {activeClaim ? (
            <div className="space-y-6 animate-fade-in">
              {/* Status Banner */}
              <div className={`p-4 rounded-2xl border flex items-start space-x-3.5 shadow-sm ${
                activeClaim.status === 'APPROVED'
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                  : activeClaim.status === 'REJECTED'
                  ? 'bg-red-50 border-red-300 text-red-900'
                  : 'bg-amber-50 border-amber-300 text-amber-900'
              }`}>
                <div className="mt-0.5">
                  {activeClaim.status === 'APPROVED' ? (
                    <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                  ) : activeClaim.status === 'REJECTED' ? (
                    <AlertTriangle className="w-6 h-6 text-red-600" />
                  ) : (
                    <Clock className="w-6 h-6 text-amber-600" />
                  )}
                </div>
                <div className="flex-1">
                  <h4 className="text-sm font-bold">
                    {activeClaim.status === 'APPROVED'
                      ? 'Congratulations! Claim Approved by Operations Team'
                      : activeClaim.status === 'REJECTED'
                      ? 'Claim Adjudication: Claim Declined'
                      : 'Claim Successfully Submitted & Awaiting Operations Review'}
                  </h4>
                  <p className="text-xs mt-1 leading-relaxed opacity-90">
                    {activeClaim.status === 'APPROVED'
                      ? `Your claim has been fully adjudicated and approved for payment. Approved Payout Amount: $${Number(activeClaim.approvedAmount || activeClaim.claimedAmount).toLocaleString()} USD.`
                      : activeClaim.status === 'REJECTED'
                      ? (activeClaim.reviewerNotes || 'The operations team was unable to approve this claim based on the submitted incident details and policy conditions.')
                      : 'Your claim request is queued in the Operations Dashboard. The operations adjudicator will review your incident details and supporting medical certificates to approve or reject according to policy metrics.'}
                  </p>
                  {activeClaim.reviewerNotes && (
                    <div className="mt-2.5 p-2.5 bg-white/80 rounded-xl border border-stone-200 text-xs text-stone-800">
                      <span className="font-bold text-stone-900">Operations Reviewer Notes: </span>
                      {activeClaim.reviewerNotes}
                    </div>
                  )}
                </div>
              </div>

              {/* Claim Overview Metadata Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* 1. Date Received */}
                <div className="p-3.5 bg-white rounded-2xl border border-[#D8CBB9] shadow-xs">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-stone-500 flex items-center space-x-1.5">
                    <Calendar className="w-3.5 h-3.5 text-[#8B9A6E]" />
                    <span>1. Date Received</span>
                  </span>
                  <p className="text-sm font-bold text-stone-900 mt-1">
                    {activeClaim.createdAt ? new Date(activeClaim.createdAt).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric'
                    }) : todayFormatted}
                  </p>
                  <span className="text-[10px] text-stone-400">Timestamped in PostgreSQL</span>
                </div>

                {/* 2. Claim Number */}
                <div className="p-3.5 bg-white rounded-2xl border border-[#D8CBB9] shadow-xs">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-stone-500 flex items-center space-x-1.5">
                    <FileText className="w-3.5 h-3.5 text-[#8B9A6E]" />
                    <span>2. Claim #</span>
                  </span>
                  <div className="flex items-center space-x-2 mt-1">
                    <p className="text-sm font-mono font-extrabold text-[#2E3523]">
                      {activeClaim.claimNumber}
                    </p>
                    <button
                      type="button"
                      onClick={() => handleCopyClaimNumber(activeClaim.claimNumber)}
                      className="p-1 text-stone-400 hover:text-stone-800 rounded transition"
                      title="Copy Claim Number"
                    >
                      {copiedClaimNo ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  <span className="text-[10px] text-stone-400">Unique Case Reference Identifier</span>
                </div>

                {/* 3. Insured Person */}
                <div className="p-3.5 bg-white rounded-2xl border border-[#D8CBB9] shadow-xs">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-stone-500 flex items-center space-x-1.5">
                    <User className="w-3.5 h-3.5 text-[#8B9A6E]" />
                    <span>3. Insured Person</span>
                  </span>
                  <p className="text-sm font-bold text-stone-900 mt-1">
                    {activeClaim.insuredName || (user ? `${user.firstName} ${user.lastName}` : 'Policyholder')}
                  </p>
                  <p className="text-xs text-stone-500 font-mono">
                    {activeClaim.insuredEmail || user?.email}
                  </p>
                </div>

                {/* 4. Product Claim */}
                <div className="p-3.5 bg-white rounded-2xl border border-[#D8CBB9] shadow-xs">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-stone-500 flex items-center space-x-1.5">
                    <Building2 className="w-3.5 h-3.5 text-[#8B9A6E]" />
                    <span>4. Product Claim</span>
                  </span>
                  <p className="text-sm font-bold text-stone-900 mt-1">
                    {policy.productName}
                  </p>
                  <p className="text-xs text-[#5A6644] font-mono font-semibold">
                    Policy #{policy.policyNumber} &bull; ${policy.coverAmount.toLocaleString()} Max Limit
                  </p>
                </div>
              </div>

              {/* 5. Incident Details */}
              <div className="p-4 bg-white rounded-2xl border border-[#D8CBB9] shadow-xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-stone-500 flex items-center space-x-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-[#8B9A6E]" />
                    <span>5. Incident Details</span>
                  </span>
                  <span className="text-xs font-bold text-[#5A6644] bg-[#EAE2D6] px-2.5 py-0.5 rounded-lg border border-[#D8CBB9]">
                    Date: {activeClaim.incidentDate}
                  </span>
                </div>
                <p className="text-xs font-bold text-stone-800">
                  Type: {activeClaim.incidentType}
                </p>
                <p className="text-xs text-stone-600 whitespace-pre-wrap leading-relaxed p-3 bg-stone-50 rounded-xl border border-stone-200">
                  {activeClaim.description || 'No additional narrative provided.'}
                </p>
              </div>

              {/* 6. Amount Claimed Notice */}
              <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-200 flex items-start space-x-3">
                <Info className="w-5 h-5 text-emerald-700 flex-shrink-0 mt-0.5" />
                <div className="text-xs">
                  <span className="font-bold uppercase tracking-wider text-emerald-900 block mb-0.5">
                    6. Amount Claimed
                  </span>
                  <p className="text-emerald-800 font-semibold text-sm">
                    (this will be decided by operations team according to the policy metrics)
                  </p>
                  <p className="text-emerald-700 mt-1">
                    Policy Maximum Underwritten Cover Limit: <strong>${policy.coverAmount.toLocaleString()} USD</strong>
                  </p>
                </div>
              </div>

              {/* 7. Supporting Documents */}
              <div className="p-4 bg-white rounded-2xl border border-[#D8CBB9] shadow-xs space-y-2.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-stone-500 flex items-center space-x-1.5">
                  <FileText className="w-3.5 h-3.5 text-[#8B9A6E]" />
                  <span>7. Supporting Documents Attached ({activeClaim.documents?.length || 0})</span>
                </span>
                {(!activeClaim.documents || activeClaim.documents.length === 0) ? (
                  <p className="text-xs text-stone-500 italic">No supporting documents attached.</p>
                ) : (
                  <div className="space-y-2">
                    {activeClaim.documents.map((doc, idx) => (
                      <div
                        key={idx}
                        className="p-2.5 bg-stone-50 rounded-xl border border-stone-200 flex items-center justify-between text-xs"
                      >
                        <div className="flex items-center space-x-2">
                          <File className="w-4 h-4 text-[#8B9A6E]" />
                          <span className="font-bold text-stone-800">{doc.fileName}</span>
                          <span className="text-[10px] text-stone-400">
                            ({doc.fileSize ? `${Math.round(doc.fileSize / 1024)} KB` : 'Verified'})
                          </span>
                        </div>
                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded border border-emerald-300">
                          Uploaded
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* ════ SUBMIT FORM MODE: NEW CLAIM SUBMISSION ════ */
            <form onSubmit={handleSubmitClaim} className="space-y-5 animate-fade-in">

              {/* ── 1. Date Received & 2. Claim # Pre-generated ── */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {/* 1. Date Received (Autofilled to present date) */}
                <div className="p-3.5 bg-white rounded-2xl border border-[#D8CBB9] shadow-xs space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-stone-500 flex items-center space-x-1">
                    <Calendar className="w-3.5 h-3.5 text-[#8B9A6E]" />
                    <span>1. Date Received (Present Date)</span>
                  </label>
                  <div className="flex items-center space-x-2">
                    <input
                      type="text"
                      readOnly
                      value={`${todayFormatted} (${todayIso})`}
                      className="w-full bg-stone-50 text-stone-800 font-semibold text-xs px-3 py-2 rounded-xl border border-stone-200 cursor-not-allowed outline-none"
                    />
                  </div>
                  <span className="text-[10px] text-[#5A6644] font-medium">Autofilled to current date</span>
                </div>

                {/* 2. Claim # (Generated upfront code) */}
                <div className="p-3.5 bg-white rounded-2xl border border-[#D8CBB9] shadow-xs space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-stone-500 flex items-center space-x-1">
                    <FileText className="w-3.5 h-3.5 text-[#8B9A6E]" />
                    <span>2. Claim # (Generated Code)</span>
                  </label>
                  <div className="flex items-center space-x-2">
                    <input
                      type="text"
                      readOnly
                      value={claimNumber}
                      className="w-full bg-emerald-50 text-[#2E3523] font-mono font-extrabold text-xs px-3 py-2 rounded-xl border border-emerald-200 cursor-not-allowed outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => handleCopyClaimNumber(claimNumber)}
                      className="p-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl transition border border-stone-200 flex-shrink-0"
                      title="Copy Claim Code"
                    >
                      {copiedClaimNo ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                  <span className="text-[10px] text-[#5A6644] font-medium">Unique case registration code</span>
                </div>
              </div>

              {/* ── 3. Insured Person (Autofill according to login data) ── */}
              <div className="p-4 bg-white rounded-2xl border border-[#D8CBB9] shadow-xs space-y-2.5">
                <div className="flex items-center justify-between border-b border-stone-100 pb-2">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-stone-500 flex items-center space-x-1.5">
                    <User className="w-3.5 h-3.5 text-[#8B9A6E]" />
                    <span>3. Insured Person (Autofilled from Login Account)</span>
                  </label>
                  <span className="text-[10px] text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 font-bold">
                    Authenticated Customer
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div>
                    <span className="text-stone-400 text-[10px] uppercase font-bold block">Full Name</span>
                    <p className="font-bold text-stone-900 text-sm mt-0.5">
                      {user ? `${user.firstName} ${user.lastName}` : 'Policyholder'}
                    </p>
                  </div>
                  <div>
                    <span className="text-stone-400 text-[10px] uppercase font-bold block">Email Address</span>
                    <p className="font-medium text-stone-700 text-xs mt-0.5 break-all">
                      {user?.email || 'customer@example.com'}
                    </p>
                  </div>
                  <div>
                    <span className="text-stone-400 text-[10px] uppercase font-bold block">Phone Number</span>
                    <p className="font-mono text-stone-700 text-xs mt-0.5">
                      {user?.phone || 'On file with policy'}
                    </p>
                  </div>
                </div>
              </div>

              {/* ── 4. Product Claim (Enrolled Insurance) ── */}
              <div className="p-4 bg-white rounded-2xl border border-[#D8CBB9] shadow-xs space-y-2.5">
                <div className="flex items-center justify-between border-b border-stone-100 pb-2">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-stone-500 flex items-center space-x-1.5">
                    <Building2 className="w-3.5 h-3.5 text-[#8B9A6E]" />
                    <span>4. Product Claim (Enrolled Insurance Coverage)</span>
                  </label>
                  <span className="text-[10px] text-[#5A6644] bg-[#EAE2D6] px-2 py-0.5 rounded border border-[#D8CBB9] font-mono font-bold">
                    Policy #{policy.policyNumber}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div>
                    <span className="text-stone-400 text-[10px] uppercase font-bold block">Enrolled Product</span>
                    <p className="font-bold text-[#2E3523] text-sm mt-0.5">
                      {policy.productName}
                    </p>
                  </div>
                  <div>
                    <span className="text-stone-400 text-[10px] uppercase font-bold block">Principal Sum Cover</span>
                    <p className="font-extrabold text-[#5A6644] text-sm mt-0.5">
                      ${policy.coverAmount.toLocaleString()} USD
                    </p>
                  </div>
                  <div>
                    <span className="text-stone-400 text-[10px] uppercase font-bold block">Issuing Channel</span>
                    <p className="text-stone-700 text-xs mt-0.5">
                      Apex Trust Bank AD&D
                    </p>
                  </div>
                </div>
              </div>

              {/* ── 5. Incident Details (Text Description & Incident Date) ── */}
              <div className="p-4 bg-white rounded-2xl border border-[#D8CBB9] shadow-xs space-y-3">
                <label className="text-[10px] font-bold uppercase tracking-wider text-stone-500 flex items-center space-x-1.5">
                  <FileText className="w-3.5 h-3.5 text-[#8B9A6E]" />
                  <span>5. Incident Details <span className="text-red-500">*</span></span>
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="block text-stone-700 font-bold mb-1">
                      Date of Incident <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={incidentDate}
                      max={todayIso}
                      onChange={(e) => setIncidentDate(e.target.value)}
                      required
                      className="w-full bg-white border border-[#D8CBB9] rounded-xl px-3 py-2 text-stone-900 font-semibold outline-none focus:ring-2 focus:ring-[#8B9A6E]"
                    />
                  </div>

                  <div>
                    <label className="block text-stone-700 font-bold mb-1">
                      Incident / Claim Category <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={incidentType}
                      onChange={(e) => setIncidentType(e.target.value)}
                      className="w-full bg-white border border-[#D8CBB9] rounded-xl px-3 py-2 text-stone-900 font-semibold outline-none focus:ring-2 focus:ring-[#8B9A6E]"
                    >
                      {INCIDENT_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-stone-700 font-bold text-xs mb-1">
                    Incident Description & Circumstances <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    rows={3}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    required
                    placeholder="Describe how the accident occurred, date and location, injuries or loss sustained, medical center/doctor attended, and treatment received..."
                    className="w-full bg-stone-50 border border-[#D8CBB9] rounded-xl p-3 text-xs text-stone-800 placeholder-stone-400 outline-none focus:bg-white focus:ring-2 focus:ring-[#8B9A6E] resize-none"
                  />
                </div>
              </div>

              {/* ── 6. Amount Claimed Notice (Exact text requested) ── */}
              <div className="p-4 bg-[#EAE2D6] rounded-2xl border border-[#D8CBB9] flex items-start space-x-3.5 shadow-xs">
                <div className="w-8 h-8 rounded-xl bg-[#5A6644] text-white flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Info className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[#2E3523]">
                    6. Amount Claimed
                  </h4>
                  <p className="text-sm font-extrabold text-[#5A6644] mt-0.5 leading-snug">
                    (this will be decided by operations team according to the policy metrics)
                  </p>
                  <p className="text-[11px] text-stone-600 mt-1">
                    Underwriting Schedule: Up to 100% of Principal Sum (${policy.coverAmount.toLocaleString()} USD) for covered accidental injuries or loss.
                  </p>
                </div>
              </div>

              {/* ── 7. Supporting Documents (Medical Certificates, etc.) ── */}
              <div className="p-4 bg-white rounded-2xl border border-[#D8CBB9] shadow-xs space-y-3">
                <div className="flex items-center justify-between border-b border-stone-100 pb-2">
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-stone-500 flex items-center space-x-1.5">
                      <FileCheck2 className="w-3.5 h-3.5 text-[#8B9A6E]" />
                      <span>7. Supporting Documents (Medical Certificates & Reports)</span>
                    </label>
                    <p className="text-[11px] text-stone-500 mt-0.5">
                      Attach doctor certificates, hospital discharge summaries, or official accident reports.
                    </p>
                  </div>
                  <span className="text-xs font-bold text-[#5A6644] bg-[#EAE2D6] px-2.5 py-0.5 rounded-lg border border-[#D8CBB9]">
                    {documents.length} Attached
                  </span>
                </div>

                {/* Upload or Quick Add Buttons */}
                <div className="flex flex-wrap items-center gap-2">
                  <label className="inline-flex items-center space-x-1.5 px-3 py-2 bg-[#5A6644] hover:bg-[#475235] text-white rounded-xl text-xs font-bold cursor-pointer transition shadow-xs">
                    <UploadCloud className="w-4 h-4" />
                    <span>Upload Certificate File</span>
                    <input
                      type="file"
                      multiple
                      accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                  </label>

                  <select
                    value={docCategory}
                    onChange={(e) => setDocCategory(e.target.value)}
                    className="text-xs font-semibold bg-stone-50 border border-[#D8CBB9] rounded-xl px-2.5 py-2 text-stone-700 outline-none"
                    title="Select Document Type"
                  >
                    <option value="Medical Certificate">Medical Certificate</option>
                    <option value="Discharge Summary">Discharge Summary</option>
                    <option value="Police / FIR Report">Police / FIR Report</option>
                    <option value="Medical Bills & Rx">Medical Bills & Rx</option>
                  </select>

                  <button
                    type="button"
                    onClick={() => handleAddTemplateDoc('Doctor_Medical_Certificate')}
                    className="inline-flex items-center space-x-1 px-2.5 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl text-xs font-semibold transition border border-stone-200"
                  >
                    <Plus className="w-3.5 h-3.5 text-[#8B9A6E]" />
                    <span>+ Add Medical Cert</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleAddTemplateDoc('Hospital_Discharge_Summary')}
                    className="inline-flex items-center space-x-1 px-2.5 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl text-xs font-semibold transition border border-stone-200"
                  >
                    <Plus className="w-3.5 h-3.5 text-[#8B9A6E]" />
                    <span>+ Add Discharge Summary</span>
                  </button>
                </div>

                {/* Document List */}
                {documents.length > 0 && (
                  <div className="space-y-2 pt-1">
                    {documents.map((doc, idx) => (
                      <div
                        key={idx}
                        className="p-2.5 bg-stone-50 rounded-xl border border-stone-200 flex items-center justify-between text-xs hover:bg-stone-100/70 transition"
                      >
                        <div className="flex items-center space-x-2.5 truncate">
                          <File className="w-4 h-4 text-[#8B9A6E] flex-shrink-0" />
                          <span className="font-bold text-stone-800 truncate">{doc.fileName}</span>
                          <span className="text-[10px] text-stone-400 font-mono flex-shrink-0">
                            ({Math.round(doc.fileSize / 1024)} KB)
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveDoc(idx)}
                          className="p-1 text-red-500 hover:text-red-700 rounded transition ml-2 flex-shrink-0"
                          title="Remove Document"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* ── 8. Status Workflow Note ── */}
              <div className="p-3.5 bg-purple-50 rounded-2xl border border-purple-200 flex items-start space-x-3 text-xs text-purple-900">
                <Clock className="w-4 h-4 text-purple-600 flex-shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold uppercase tracking-wider text-purple-950 block">
                    8. Status Workflow: Approved or Rejected by Operations
                  </span>
                  <p className="text-purple-800 text-[11px] mt-0.5">
                    Upon clicking Submit, this claim will be queued in the InsureFlow Operations Dashboard. The status will update to <strong>APPROVED</strong> or <strong>REJECTED</strong> once the operations team adjudicates the claim.
                  </p>
                </div>
              </div>

              {/* Error Banner */}
              {errorMessage && (
                <div className="p-3 bg-red-50 border border-red-300 rounded-xl text-xs text-red-800 font-semibold flex items-center space-x-2">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* ── Action Buttons ── */}
              <div className="pt-2 flex items-center justify-end space-x-3">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isSubmitting}
                  className="px-4 py-2.5 bg-white hover:bg-stone-100 text-stone-700 rounded-xl text-xs font-bold transition border border-stone-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex items-center space-x-2 px-6 py-2.5 bg-[#5A6644] hover:bg-[#475235] text-white rounded-xl text-xs font-extrabold transition shadow-md disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Submitting Claim...</span>
                    </>
                  ) : (
                    <>
                      <FileCheck2 className="w-4 h-4" />
                      <span>Submit Insurance Claim &rarr;</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* ── Modal Footer ── */}
        <div className="bg-[#EAE2D6] px-6 py-3.5 border-t border-[#D8CBB9] flex items-center justify-between text-xs text-stone-600 flex-shrink-0">
          <span className="text-[11px]">
            InsureFlow Operations & Claims Adjudication Module &bull; Section 8 Compliance
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-white hover:bg-stone-100 text-stone-800 rounded-lg text-xs font-bold border border-[#D8CBB9] transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
