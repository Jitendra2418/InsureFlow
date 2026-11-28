import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Navbar } from '../components/Navbar';
import { EnrollmentModal } from '../components/EnrollmentModal';
import { EditPolicyModal } from '../components/EditPolicyModal';
import { PolicyDetailsModal } from '../components/PolicyDetailsModal';
import { CancellationModal } from '../components/CancellationModal';
import { Policy } from '../types';
import { generateInsuranceCertificate } from '../utils/pdfCertificate';
import { 
  ShieldCheck, FileText, Download, CheckCircle, 
  Calendar, Users, ArrowUpRight, 
  Sparkles, Layers, DollarSign, Clock, ShieldAlert,
  Edit3, MapPin, Eye
} from 'lucide-react';

export const CustomerDashboard: React.FC = () => {
  const { user, policies, cancelPolicy } = useAuth();
  const [isEnrollModalOpen, setIsEnrollModalOpen] = useState<boolean>(false);
  const [editingPolicy, setEditingPolicy] = useState<Policy | null>(null);
  const [viewingPolicy, setViewingPolicy] = useState<Policy | null>(null);
  const [cancellingPolicy, setCancellingPolicy] = useState<Policy | null>(null);
  const [justEnrolledNumber, setJustEnrolledNumber] = useState<string | null>(null);
  const [downloadNotice, setDownloadNotice] = useState<string | null>(null);
  const [updateNotice, setUpdateNotice] = useState<string | null>(null);
  const [cancelNotice, setCancelNotice] = useState<string | null>(null);

  // Quick Stats
  const activePolicies = policies.filter(p => p.status === 'ACTIVE');
  const totalCoverage = activePolicies.reduce((sum, p) => sum + p.coverAmount, 0);
  const totalMonthlyPremium = activePolicies.reduce((sum, p) => sum + p.monthlyPremium, 0);

  const handleEnrollSuccess = (policyNumber: string) => {
    setJustEnrolledNumber(policyNumber);
    setTimeout(() => {
      setJustEnrolledNumber(null);
    }, 8000);
  };

  const handlePolicyCancelled = (policyId: string) => {
    cancelPolicy(policyId);
    const cancelled = policies.find((p) => p.id === policyId);
    setCancelNotice(
      cancelled
        ? `Policy #${cancelled.policyNumber} has been cancelled and removed from your active coverage.`
        : 'Policy has been successfully cancelled.'
    );
    setTimeout(() => setCancelNotice(null), 8000);
  };

  const scrollToPolicies = () => {
    const el = document.getElementById('policies-section');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleDownloadCertificate = (target: Policy | string) => {
    const policy = typeof target === 'string'
      ? policies.find(p => p.policyNumber === target)
      : target;

    if (!policy) return;

    setDownloadNotice(`Rendering official PDF Certificate for Policy #${policy.policyNumber}...`);
    setTimeout(() => {
      generateInsuranceCertificate(policy, user);
      setDownloadNotice(null);
    }, 600);
  };

  return (
    <div className="min-h-screen bg-[#F7F2EB] flex flex-col">
      <Navbar onOpenEnroll={() => setIsEnrollModalOpen(true)} onMyPoliciesClick={scrollToPolicies} />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        
        {/* Policy Cancelled Notice */}
        {cancelNotice && (
          <div className="p-4 bg-red-50 border border-red-300 rounded-2xl flex items-center justify-between shadow-sm animate-fade-in">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-red-600 text-white flex items-center justify-center">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-red-900">Policy Cancelled</h4>
                <p className="text-xs text-red-700 font-medium">{cancelNotice}</p>
              </div>
            </div>
            <button
              onClick={() => setCancelNotice(null)}
              className="text-red-700 hover:text-red-900 text-xs font-bold underline"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Policy Successfully Updated Notice */}
        {updateNotice && (
          <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-2xl flex items-center justify-between shadow-sm animate-fade-in">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center">
                <CheckCircle className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-emerald-900">
                  Policy Successfully Updated in PostgreSQL!
                </h4>
                <p className="text-xs text-emerald-700 font-medium">
                  {updateNotice}
                </p>
              </div>
            </div>
            <button
              onClick={() => setUpdateNotice(null)}
              className="text-emerald-700 hover:text-emerald-900 text-xs font-bold underline"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Success Alert Banner on Fresh Enrollment */}
        {justEnrolledNumber && (
          <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-2xl flex items-center justify-between shadow-sm animate-fade-in">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center">
                <CheckCircle className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-emerald-900">
                  Congratulations! Policy #{justEnrolledNumber} is now Active!
                </h4>
                <p className="text-xs text-emerald-700">
                  Your AD&D protection has been bound. A welcome packet and PDF certificate are ready in your dashboard.
                </p>
              </div>
            </div>
            <button
              onClick={() => handleDownloadCertificate(justEnrolledNumber)}
              className="bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold px-3.5 py-2 rounded-xl transition shadow"
            >
              Download PDF Schedule
            </button>
          </div>
        )}

        {/* Certificate download notice */}
        {downloadNotice && (
          <div className="p-3 bg-[#EAE2D6] border border-[#D8CBB9] rounded-xl text-xs text-[#2E3523] flex items-center space-x-2 font-medium">
            <Download className="w-4 h-4 text-[#8B9A6E] animate-bounce" />
            <span>{downloadNotice}</span>
          </div>
        )}

        {/* Hero Welcome Banner */}
        <section className="bg-gradient-to-r from-[#EAE2D6] via-[#F3EFE8] to-[#EAE2D6] rounded-3xl p-6 sm:p-8 border border-[#D8CBB9] shadow-sm relative overflow-hidden">
          <div className="relative z-10 max-w-2xl">
            <div className="inline-flex items-center space-x-2 bg-white/80 backdrop-blur-sm px-3 py-1 rounded-full text-xs font-bold text-[#5A6644] mb-3 border border-[#D8CBB9]">
              <Sparkles className="w-3.5 h-3.5 text-[#8B9A6E]" />
              <span>Partner Campaign: Apex Trust Bank AD&D Plan</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-[#2E3523] tracking-tight">
              Welcome back, {user?.firstName || 'Valued Customer'}
            </h1>
            <p className="mt-2 text-sm text-stone-600 leading-relaxed font-medium">
              Manage your active policy schedules, add designated beneficiaries, or enroll in additional accidental death & dismemberment coverage options.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <button
                onClick={() => setIsEnrollModalOpen(true)}
                className="bg-[#8B9A6E] hover:bg-[#738258] text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-md transition hover:scale-[1.02] active:scale-[0.98] flex items-center space-x-2"
              >
                <Sparkles className="w-4 h-4" />
                <span>Enroll in AD&D Coverage</span>
              </button>
              <a
                href="#policies-section"
                className="bg-white hover:bg-[#EEEEEE] text-stone-800 px-5 py-2.5 rounded-xl text-sm font-semibold border border-[#D8CBB9] transition shadow-sm"
              >
                View My Policies ({activePolicies.length})
              </a>
            </div>
          </div>
        </section>

        {/* Top Metrics Cards */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-[#EAE2D6] p-5 rounded-2xl border border-[#D8CBB9] shadow-sm flex items-center space-x-4">
            <div className="w-12 h-12 rounded-xl bg-[#8B9A6E] text-white flex items-center justify-center shadow-sm">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-stone-600">Active Policies</p>
              <p className="text-2xl font-extrabold text-[#2E3523]">{activePolicies.length}</p>
              <p className="text-[11px] text-[#5A6644] font-medium">Underwritten & Active</p>
            </div>
          </div>

          <div className="bg-[#EAE2D6] p-5 rounded-2xl border border-[#D8CBB9] shadow-sm flex items-center space-x-4">
            <div className="w-12 h-12 rounded-xl bg-[#8B9A6E] text-white flex items-center justify-center shadow-sm">
              <DollarSign className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-stone-600">Total Cover Amount</p>
              <p className="text-2xl font-extrabold text-[#2E3523]">
                ${totalCoverage.toLocaleString()}
              </p>
              <p className="text-[11px] text-[#5A6644] font-medium">Principal Sum Benefit</p>
            </div>
          </div>

          <div className="bg-[#EAE2D6] p-5 rounded-2xl border border-[#D8CBB9] shadow-sm flex items-center space-x-4">
            <div className="w-12 h-12 rounded-xl bg-[#8B9A6E] text-white flex items-center justify-center shadow-sm">
              <Layers className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-stone-600">Monthly Premium</p>
              <p className="text-2xl font-extrabold text-[#2E3523]">
                ${totalMonthlyPremium.toFixed(2)}
              </p>
              <p className="text-[11px] text-[#5A6644] font-medium">Auto-deducted monthly</p>
            </div>
          </div>

          <div className="bg-[#EAE2D6] p-5 rounded-2xl border border-[#D8CBB9] shadow-sm flex items-center space-x-4">
            <div className="w-12 h-12 rounded-xl bg-[#8B9A6E] text-white flex items-center justify-center shadow-sm">
              <Clock className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-stone-600">Next Billing Cycle</p>
              <p className="text-2xl font-extrabold text-[#2E3523]">Dec 01</p>
              <p className="text-[11px] text-[#5A6644] font-medium">Spring @Scheduled Job</p>
            </div>
          </div>
        </section>

        {/* My Enrolled Policies Section */}
        <section id="policies-section" className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-[#2E3523]">My Enrolled Insurance Policies</h2>
              <p className="text-xs text-stone-600">
                Managed under Jitendra's Enrollment & Policy Module (P0)
              </p>
            </div>
            <button
              onClick={() => setIsEnrollModalOpen(true)}
              className="inline-flex items-center space-x-1.5 text-xs font-bold text-[#5A6644] bg-[#EAE2D6] hover:bg-[#D8CBB9] px-3.5 py-2 rounded-xl border border-[#D8CBB9] transition"
            >
              <span>+ Enroll Another Policy</span>
            </button>
          </div>

          {policies.length === 0 ? (
            <div className="bg-white rounded-3xl p-12 text-center border border-[#EAE2D6] shadow-sm space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-[#EEEEEE] text-stone-400 flex items-center justify-center mx-auto">
                <ShieldAlert className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold text-stone-800">No Insurance Policies Enrolled Yet</h3>
              <p className="text-xs text-stone-500 max-w-md mx-auto">
                You haven't activated your Accidental Death & Dismemberment cover yet. Use your partner campaign code to get started today.
              </p>
              <button
                onClick={() => setIsEnrollModalOpen(true)}
                className="bg-[#8B9A6E] hover:bg-[#738258] text-white px-6 py-2.5 rounded-xl text-xs font-bold shadow transition"
              >
                Enroll Now in AD&D
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {policies.map((policy) => (
                <div
                  key={policy.id}
                  className="bg-white rounded-3xl p-6 border border-[#EAE2D6] shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
                >
                  <div>
                    {/* Top row: Status & Policy Number */}
                    <div className="flex items-center justify-between pb-4 border-b border-[#EEEEEE]">
                      <button
                        type="button"
                        onClick={() => setViewingPolicy(policy)}
                        className="flex items-center space-x-2.5 text-left group cursor-pointer"
                      >
                        <div className="w-10 h-10 rounded-xl bg-[#8B9A6E]/15 text-[#5A6644] group-hover:bg-[#8B9A6E] group-hover:text-white transition flex items-center justify-center">
                          <FileText className="w-5 h-5 stroke-[2.2]" />
                        </div>
                        <div>
                          <p className="text-[11px] font-mono font-bold text-stone-500 uppercase tracking-wider group-hover:text-[#5A6644] transition flex items-center space-x-1">
                            <span>Policy #{policy.policyNumber}</span>
                            <Eye className="w-3 h-3 text-stone-400 group-hover:text-[#5A6644]" />
                          </p>
                          <h3 className="text-base font-bold text-[#2E3523] leading-snug group-hover:underline">
                            {policy.productName}
                          </h3>
                        </div>
                      </button>

                      <span className={`px-2.5 py-1 rounded-full text-xs font-bold tracking-wide ${
                        policy.status === 'ACTIVE'
                          ? 'bg-[#8B9A6E]/15 text-[#5A6644] border border-[#8B9A6E]/30'
                          : 'bg-stone-200 text-stone-600'
                      }`}>
                        {policy.status}
                      </span>
                    </div>

                    {/* Coverage & Premium Grid */}
                    <div className="grid grid-cols-2 gap-4 py-4 border-b border-[#EEEEEE]">
                      <div className="bg-[#F7F2EB] p-3 rounded-xl border border-[#EAE2D6]">
                        <p className="text-[11px] font-bold uppercase text-stone-500">Cover Amount</p>
                        <p className="text-xl font-extrabold text-[#2E3523]">
                          ${policy.coverAmount.toLocaleString()}
                        </p>
                        <p className="text-[10px] text-[#5A6644] font-medium">Principal Sum</p>
                      </div>

                      <div className="bg-[#F7F2EB] p-3 rounded-xl border border-[#EAE2D6]">
                        <p className="text-[11px] font-bold uppercase text-stone-500">Monthly Premium</p>
                        <p className="text-xl font-extrabold text-[#5A6644]">
                          ${policy.monthlyPremium.toFixed(2)}<span className="text-xs text-stone-400 font-normal">/mo</span>
                        </p>
                        <p className="text-[10px] text-stone-500">Formula: $0.60 per $1k</p>
                      </div>
                    </div>

                    {/* Policy Details List */}
                    <div className="py-3 space-y-2 text-xs text-stone-600">
                      <div className="flex items-center space-x-2">
                        <Calendar className="w-3.5 h-3.5 text-stone-400" />
                        <span><strong>Effective Date:</strong> {policy.effectiveDate}</span>
                      </div>

                      {policy.addressLine1 && (
                        <div className="flex items-start space-x-2">
                          <MapPin className="w-3.5 h-3.5 text-stone-400 mt-0.5 flex-shrink-0" />
                          <span>
                            <strong>Mailing Address:</strong> {policy.addressLine1}{policy.addressLine2 ? `, ${policy.addressLine2}` : ''}, {policy.city}, {policy.state} {policy.zipCode}
                          </span>
                        </div>
                      )}

                      <div className="flex items-start space-x-2">
                        <Users className="w-3.5 h-3.5 text-stone-400 mt-0.5 flex-shrink-0" />
                        <div>
                          <strong>Beneficiaries: </strong>
                          <div className="inline-flex flex-wrap gap-1.5 mt-0.5">
                            {policy.beneficiaries.map((b, i) => (
                              <span key={i} className="inline-flex items-center space-x-1 bg-[#F7F2EB] px-2 py-0.5 rounded-lg border border-[#EAE2D6] text-[11px]">
                                <span className={`w-1.5 h-1.5 rounded-full ${b.isPrimary !== false ? 'bg-[#8B9A6E]' : 'bg-stone-500'}`} />
                                <span className="font-semibold text-stone-900">{b.firstName} {b.lastName}</span>
                                <span className="text-stone-500">({b.relationship})</span>
                                <span className="font-mono font-bold text-[#5A6644]">{b.percentage}%</span>
                                {b.guardianName && (
                                  <span className="text-[10px] text-amber-800 bg-amber-50 px-1 rounded border border-amber-200">
                                    Guardian: {b.guardianName}
                                  </span>
                                )}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Actions Bar */}
                  <div className="pt-4 border-t border-[#EEEEEE] flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        onClick={() => setViewingPolicy(policy)}
                        className="inline-flex items-center space-x-1.5 text-xs font-bold text-[#2E3523] bg-[#EAE2D6] hover:bg-[#D8CBB9] px-3.5 py-2 rounded-xl transition border border-[#D8CBB9] shadow-xs cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5 text-[#8B9A6E]" />
                        <span>View Policy Details</span>
                      </button>

                      <button
                        onClick={() => handleDownloadCertificate(policy)}
                        className="inline-flex items-center space-x-1.5 text-xs font-bold text-[#5A6644] hover:text-[#2E3523] bg-white hover:bg-[#F7F2EB] px-3.5 py-2 rounded-xl transition border border-[#D8CBB9]"
                      >
                        <Download className="w-3.5 h-3.5 text-[#8B9A6E]" />
                        <span>Download Certificate</span>
                      </button>

                      {policy.status === 'ACTIVE' && (
                        <button
                          onClick={() => setEditingPolicy(policy)}
                          className="inline-flex items-center space-x-1.5 text-xs font-bold text-stone-700 hover:text-stone-900 bg-white hover:bg-[#F7F2EB] px-3 py-2 rounded-xl transition border border-[#D8CBB9] shadow-xs"
                        >
                          <Edit3 className="w-3.5 h-3.5 text-[#8B9A6E]" />
                          <span>Edit</span>
                        </button>
                      )}
                    </div>

                    {policy.status === 'ACTIVE' && (
                      <button
                        onClick={() => setCancellingPolicy(policy)}
                        className="text-xs font-semibold text-stone-400 hover:text-red-600 transition py-1 px-2 cursor-pointer"
                      >
                        Cancel Policy
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Product Catalog Section */}
        <section className="space-y-4 pt-4 border-t border-[#EAE2D6]">
          <div>
            <h2 className="text-xl font-bold text-[#2E3523]">Explore Product Catalog</h2>
            <p className="text-xs text-stone-600">
              Integrated insurance covers per System Architecture Section 5 (Products Table)
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* AD&D - Flagship */}
            <div className="bg-[#EAE2D6] rounded-3xl p-6 border-2 border-[#8B9A6E] shadow-sm flex flex-col justify-between relative overflow-hidden">
              <div className="absolute top-4 right-4 bg-[#8B9A6E] text-white text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full tracking-wider">
                Flagship
              </div>
              <div>
                <span className="text-xs font-mono font-bold text-[#5A6644]">CODE: DD</span>
                <h3 className="text-lg font-bold text-[#2E3523] mt-1">
                  Accidental Death & Dismemberment
                </h3>
                <p className="text-xs text-stone-600 mt-2 leading-relaxed">
                  Comprehensive 24/7 protection covering accidental death, loss of limbs, eyesight, and severe injuries from unforeseen accidents worldwide.
                </p>
                <div className="mt-4 p-3 bg-white/80 rounded-xl border border-[#D8CBB9] text-xs space-y-1">
                  <div className="flex justify-between text-stone-600">
                    <span>Cover Range:</span>
                    <strong className="text-stone-800">$10,000 – $300,000</strong>
                  </div>
                  <div className="flex justify-between text-stone-600">
                    <span>Premium Rate:</span>
                    <strong className="text-[#5A6644]">$0.60 per $1,000 / mo</strong>
                  </div>
                </div>
              </div>

              <div className="mt-5">
                <button
                  onClick={() => setIsEnrollModalOpen(true)}
                  className="w-full bg-[#8B9A6E] hover:bg-[#738258] text-white py-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center space-x-1.5 shadow"
                >
                  <span>Enroll in AD&D</span>
                  <ArrowUpRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Hospital Accident Plan */}
            <div className="bg-white rounded-3xl p-6 border border-[#EAE2D6] shadow-sm flex flex-col justify-between opacity-80">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-bold text-stone-400">CODE: HP</span>
                  <span className="bg-[#EEEEEE] text-stone-600 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full">
                    Coming Soon
                  </span>
                </div>
                <h3 className="text-lg font-bold text-stone-800 mt-2">
                  Hospital Accident Plan
                </h3>
                <p className="text-xs text-stone-500 mt-2 leading-relaxed">
                  Direct cash payouts for overnight hospital stays and emergency room visits resulting directly from covered accidental injuries.
                </p>
                <div className="mt-4 p-3 bg-[#F7F2EB] rounded-xl border border-[#EAE2D6] text-xs space-y-1">
                  <div className="flex justify-between text-stone-500">
                    <span>Daily Stays:</span>
                    <span className="font-semibold text-stone-700">Up to $500/day</span>
                  </div>
                  <div className="flex justify-between text-stone-500">
                    <span>ER Benefit:</span>
                    <span className="font-semibold text-stone-700">Lump sum reimbursement</span>
                  </div>
                </div>
              </div>
              <div className="mt-5">
                <button
                  disabled
                  className="w-full bg-[#EEEEEE] text-stone-400 py-2.5 rounded-xl text-xs font-semibold cursor-not-allowed"
                >
                  Notify Me on Launch
                </button>
              </div>
            </div>

            {/* Recuperative Care */}
            <div className="bg-white rounded-3xl p-6 border border-[#EAE2D6] shadow-sm flex flex-col justify-between opacity-80">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-bold text-stone-400">CODE: RC</span>
                  <span className="bg-[#EEEEEE] text-stone-600 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full">
                    Coming Soon
                  </span>
                </div>
                <h3 className="text-lg font-bold text-stone-800 mt-2">
                  Recuperative Care
                </h3>
                <p className="text-xs text-stone-500 mt-2 leading-relaxed">
                  Post-discharge convalescent support and daily recovery assistance for qualifying accident or illness discharge.
                </p>
                <div className="mt-4 p-3 bg-[#F7F2EB] rounded-xl border border-[#EAE2D6] text-xs space-y-1">
                  <div className="flex justify-between text-stone-500">
                    <span>Home Care:</span>
                    <span className="font-semibold text-stone-700">Daily living allowance</span>
                  </div>
                  <div className="flex justify-between text-stone-500">
                    <span>Duration:</span>
                    <span className="font-semibold text-stone-700">Up to 90 continuous days</span>
                  </div>
                </div>
              </div>
              <div className="mt-5">
                <button
                  disabled
                  className="w-full bg-[#EEEEEE] text-stone-400 py-2.5 rounded-xl text-xs font-semibold cursor-not-allowed"
                >
                  Notify Me on Launch
                </button>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="mt-12 bg-[#EAE2D6] border-t border-[#D8CBB9] py-8 text-xs text-stone-600">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center space-x-2">
            <span className="font-bold text-[#2E3523]">InsureFlow</span>
            <span>&bull;</span>
            <span>Accidental Death & Dismemberment Insurance Platform</span>
          </div>
          <div className="flex items-center space-x-4 text-stone-500">
            <span>Team Jitendra & Aman</span>
            <span>&bull;</span>
            <span>PostgreSQL 16 &bull; Spring Boot 3 &bull; React 18</span>
          </div>
        </div>
      </footer>

      {/* Enrollment Modal */}
      <EnrollmentModal
        isOpen={isEnrollModalOpen}
        onClose={() => setIsEnrollModalOpen(false)}
        onSuccess={handleEnrollSuccess}
      />

      {/* Edit Policy Modal */}
      <EditPolicyModal
        isOpen={!!editingPolicy}
        policy={editingPolicy}
        onClose={() => setEditingPolicy(null)}
        onSuccess={(msg) => {
          setUpdateNotice(msg);
          setTimeout(() => setUpdateNotice(null), 8000);
        }}
      />

      {/* Policy Details Modal (INS-19) */}
      <PolicyDetailsModal
        isOpen={!!viewingPolicy}
        policy={viewingPolicy}
        onClose={() => setViewingPolicy(null)}
        onEditPolicy={(p) => setEditingPolicy(p)}
      />

      {/* Cancellation Confirmation Modal (INS-21) */}
      <CancellationModal
        isOpen={!!cancellingPolicy}
        policy={cancellingPolicy}
        onClose={() => setCancellingPolicy(null)}
        onCancelled={handlePolicyCancelled}
      />
    </div>
  );
};
