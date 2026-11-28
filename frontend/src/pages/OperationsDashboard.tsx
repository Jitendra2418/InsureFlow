import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../api';
import {
  OperationsMetricsResponse
} from '../types';
import {
  Sliders,
  ShieldCheck,
  TrendingUp,
  Target,
  FileCheck2,
  AlertTriangle,
  RefreshCw,
  LogOut,
  Search,
  Building2,
  FileText,
  AlertCircle
} from 'lucide-react';

export const OperationsDashboard: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  // Active view tab: 'campaigns' | 'segments' | 'policies' | 'claims'
  const [activeTab, setActiveTab] = useState<'campaigns' | 'segments' | 'policies' | 'claims'>('campaigns');

  const [metrics, setMetrics] = useState<OperationsMetricsResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string>('');

  // Search filter states
  const [searchTerm, setSearchTerm] = useState<string>('');

  const loadOperationsMetrics = async () => {
    setIsLoading(true);
    setErrorMessage('');
    try {
      const data = await apiRequest<OperationsMetricsResponse>('/operations/metrics');
      setMetrics(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load operations metrics.';
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadOperationsMetrics();
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/admin/login');
  };

  // Filtered dataset helpers
  const filteredCampaigns = (metrics?.campaignEnrollments || []).filter(c =>
    c.campaignName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.campaignCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.clientName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredSegments = (metrics?.segmentResponseRates || []).filter(s =>
    s.spokenKey.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.segmentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.state.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredPolicies = (metrics?.activePolicies || []).filter(p =>
    p.policyNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.customerEmail.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.productName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredClaims = (metrics?.openClaims || []).filter(c =>
    c.claimNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.insuredName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.policyNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.incidentType.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#F7F2EB] text-stone-900 font-sans pb-16">
      {/* ── TOP NAVIGATION BAR ────────────────────────────────────── */}
      <header className="bg-[#EAE2D6] border-b border-[#D8CBB9] sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            
            {/* Brand Logo & Portal Tag */}
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-[#5A6644] flex items-center justify-center text-white shadow-md shadow-[#5A6644]/20">
                <Sliders className="w-5 h-5 stroke-[2.2]" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <span className="font-extrabold text-lg tracking-tight text-[#2E3523]">InsureFlow</span>
                  <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-[#5A6644]/15 text-[#3D472E] border border-[#5A6644]/30">
                    Operations Portal
                  </span>
                </div>
                <p className="text-[11px] text-stone-600 font-medium">Enterprise Servicing & Campaign Command Center</p>
              </div>
            </div>

            {/* Operator Info & Actions */}
            <div className="flex items-center space-x-3">
              {/* If user is also Admin, give quick link to Admin Dashboard */}
              {user?.role === 'ADMIN' && (
                <Link
                  to="/admin/dashboard"
                  className="hidden md:inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-[#5A6644] hover:bg-[#ded4c6] border border-[#D8CBB9] transition"
                  title="Switch to Administrator Dashboard"
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Admin Dashboard</span>
                </Link>
              )}

              <div className="flex items-center space-x-2 pl-2 border-l border-[#D8CBB9]">
                <div className="w-8 h-8 rounded-full bg-[#5A6644] text-white flex items-center justify-center text-xs font-bold shadow-xs">
                  {user ? `${user.firstName?.[0] || 'O'}${user.lastName?.[0] || 'P'}` : 'OP'}
                </div>
                <div className="hidden sm:block text-left">
                  <p className="text-xs font-bold text-stone-900 leading-tight">
                    {user ? `${user.firstName} ${user.lastName}` : 'Operations Officer'}
                  </p>
                  <p className="text-[10px] text-stone-500 uppercase tracking-wider font-semibold">
                    {user?.role || 'OPERATOR'}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleLogout}
                className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-stone-600 hover:text-stone-900 hover:bg-[#ded4c6] transition"
                title="Sign out of Operations Portal"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* ── MAIN CONTENT CONTAINER ─────────────────────────────────── */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 space-y-6">

        {/* Hero Welcome Banner */}
        <div className="bg-gradient-to-r from-[#5A6644] to-[#454f34] rounded-3xl p-6 sm:p-7 text-white shadow-md border border-[#5A6644]">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <div className="flex items-center space-x-2 text-[#D8E2C8] text-xs font-bold uppercase tracking-wider mb-1">
                <Sliders className="w-4 h-4" />
                <span>Real-Time Operational Analytics</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
                Welcome back, {user?.firstName || 'Operator'}
              </h1>
              <p className="text-xs text-[#D8E2C8] mt-1 max-w-2xl leading-relaxed">
                Monitor campaign conversion rates, analyze segment response by spoken key, track active policy enrollments, and adjudicate open incident claims.
              </p>
            </div>

            <div className="flex items-center space-x-3">
              <button
                type="button"
                onClick={loadOperationsMetrics}
                disabled={isLoading}
                className="inline-flex items-center space-x-2 px-4 py-2.5 bg-white/15 hover:bg-white/25 border border-white/30 text-white rounded-2xl text-xs font-bold transition shadow-sm backdrop-blur-sm disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                <span>{isLoading ? 'Syncing...' : 'Refresh KPIs'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Error Feedback */}
        {errorMessage && (
          <div className="p-4 bg-red-50 border border-red-200 text-red-700 text-xs rounded-2xl flex items-center justify-between space-x-2.5">
            <div className="flex items-center space-x-2.5">
              <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-500" />
              <span>{errorMessage}</span>
            </div>
            <button onClick={() => setErrorMessage('')} className="text-red-400 hover:text-red-700">✕</button>
          </div>
        )}

        {/* ── 4 KEY OPERATIONAL METRIC CARDS ───────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          
          {/* Card 1: Total Enrollments */}
          <div
            onClick={() => setActiveTab('campaigns')}
            className={`p-5 rounded-2xl border transition cursor-pointer ${
              activeTab === 'campaigns'
                ? 'bg-[#EAE2D6] border-[#5A6644] ring-2 ring-[#5A6644]/30 shadow-sm'
                : 'bg-[#EAE2D6] border-[#D8CBB9] hover:bg-[#ded4c6]'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#3D472E]">Total Enrollments</span>
              <TrendingUp className="w-4 h-4 text-[#5A6644]" />
            </div>
            <p className="text-3xl font-black text-[#2E3523] mt-2">
              {metrics ? metrics.kpis.totalEnrollments : 0}
            </p>
            <p className="text-[10px] text-stone-600 mt-1">
              Across {metrics?.kpis.totalCampaigns || 0} active campaigns
            </p>
          </div>

          {/* Card 2: Avg Response Rate */}
          <div
            onClick={() => setActiveTab('segments')}
            className={`p-5 rounded-2xl border transition cursor-pointer ${
              activeTab === 'segments'
                ? 'bg-[#EAE2D6] border-[#5A6644] ring-2 ring-[#5A6644]/30 shadow-sm'
                : 'bg-[#EAE2D6] border-[#D8CBB9] hover:bg-[#ded4c6]'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-blue-900">Avg Response Rate</span>
              <Target className="w-4 h-4 text-blue-600" />
            </div>
            <p className="text-3xl font-black text-blue-950 mt-2">
              {metrics ? `${metrics.kpis.avgResponseRate}%` : '0%'}
            </p>
            <p className="text-[10px] text-blue-800 mt-1">
              Spoken key vs audience target
            </p>
          </div>

          {/* Card 3: Active Policies */}
          <div
            onClick={() => setActiveTab('policies')}
            className={`p-5 rounded-2xl border transition cursor-pointer ${
              activeTab === 'policies'
                ? 'bg-[#EAE2D6] border-[#5A6644] ring-2 ring-[#5A6644]/30 shadow-sm'
                : 'bg-[#EAE2D6] border-[#D8CBB9] hover:bg-[#ded4c6]'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-900">Active Policies</span>
              <FileCheck2 className="w-4 h-4 text-emerald-600" />
            </div>
            <p className="text-3xl font-black text-emerald-950 mt-2">
              {metrics ? metrics.kpis.totalActivePolicies : 0}
            </p>
            <p className="text-[10px] text-emerald-800 mt-1">
              Current in-force coverage
            </p>
          </div>

          {/* Card 4: Open Claims */}
          <div
            onClick={() => setActiveTab('claims')}
            className={`p-5 rounded-2xl border transition cursor-pointer ${
              activeTab === 'claims'
                ? 'bg-[#EAE2D6] border-[#5A6644] ring-2 ring-[#5A6644]/30 shadow-sm'
                : 'bg-[#EAE2D6] border-[#D8CBB9] hover:bg-[#ded4c6]'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-amber-900">Open Claims</span>
              <AlertTriangle className="w-4 h-4 text-amber-600" />
            </div>
            <p className="text-3xl font-black text-amber-950 mt-2">
              {metrics ? metrics.kpis.totalOpenClaims : 0}
            </p>
            <p className="text-[10px] text-amber-800 mt-1">
              Submitted or Under Review
            </p>
          </div>
        </div>

        {/* ── TAB SELECTOR BUTTONS ──────────────────────────────────── */}
        <div className="flex items-center space-x-2 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => { setActiveTab('campaigns'); setSearchTerm(''); }}
            className={`inline-flex items-center space-x-2 px-5 py-2.5 rounded-2xl text-xs font-bold transition-all ${
              activeTab === 'campaigns'
                ? 'bg-[#5A6644] text-white shadow-md shadow-[#5A6644]/25 scale-[1.01]'
                : 'bg-[#EAE2D6] text-stone-700 hover:bg-[#ded4c6] border border-[#D8CBB9]'
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            <span>Campaign Enrollments</span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
              activeTab === 'campaigns' ? 'bg-white/20 text-white' : 'bg-[#D8CBB9] text-stone-700'
            }`}>
              {metrics?.campaignEnrollments.length || 0}
            </span>
          </button>

          <button
            type="button"
            onClick={() => { setActiveTab('segments'); setSearchTerm(''); }}
            className={`inline-flex items-center space-x-2 px-5 py-2.5 rounded-2xl text-xs font-bold transition-all ${
              activeTab === 'segments'
                ? 'bg-[#5A6644] text-white shadow-md shadow-[#5A6644]/25 scale-[1.01]'
                : 'bg-[#EAE2D6] text-stone-700 hover:bg-[#ded4c6] border border-[#D8CBB9]'
            }`}
          >
            <Target className="w-4 h-4" />
            <span>Segment Response Rates</span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
              activeTab === 'segments' ? 'bg-white/20 text-white' : 'bg-[#D8CBB9] text-stone-700'
            }`}>
              {metrics?.segmentResponseRates.length || 0}
            </span>
          </button>

          <button
            type="button"
            onClick={() => { setActiveTab('policies'); setSearchTerm(''); }}
            className={`inline-flex items-center space-x-2 px-5 py-2.5 rounded-2xl text-xs font-bold transition-all ${
              activeTab === 'policies'
                ? 'bg-[#5A6644] text-white shadow-md shadow-[#5A6644]/25 scale-[1.01]'
                : 'bg-[#EAE2D6] text-stone-700 hover:bg-[#ded4c6] border border-[#D8CBB9]'
            }`}
          >
            <FileCheck2 className="w-4 h-4" />
            <span>Active Policies</span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
              activeTab === 'policies' ? 'bg-white/20 text-white' : 'bg-[#D8CBB9] text-stone-700'
            }`}>
              {metrics?.activePolicies.length || 0}
            </span>
          </button>

          <button
            type="button"
            onClick={() => { setActiveTab('claims'); setSearchTerm(''); }}
            className={`inline-flex items-center space-x-2 px-5 py-2.5 rounded-2xl text-xs font-bold transition-all ${
              activeTab === 'claims'
                ? 'bg-[#5A6644] text-white shadow-md shadow-[#5A6644]/25 scale-[1.01]'
                : 'bg-[#EAE2D6] text-stone-700 hover:bg-[#ded4c6] border border-[#D8CBB9]'
            }`}
          >
            <AlertTriangle className="w-4 h-4" />
            <span>Open Claims</span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
              activeTab === 'claims' ? 'bg-white/20 text-white' : 'bg-[#D8CBB9] text-stone-700'
            }`}>
              {metrics?.openClaims.length || 0}
            </span>
          </button>
        </div>

        {/* ── TAB CONTENT PANEL ────────────────────────────────────── */}
        <div className="bg-[#EAE2D6] border border-[#D8CBB9] rounded-3xl p-6 sm:p-8 shadow-sm space-y-5">
          
          {/* Header & Search Bar inside panel */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-[#D8CBB9]/80">
            <div>
              <h2 className="text-lg font-bold text-[#2E3523] flex items-center space-x-2">
                {activeTab === 'campaigns' && <TrendingUp className="w-5 h-5 text-[#5A6644]" />}
                {activeTab === 'segments' && <Target className="w-5 h-5 text-blue-700" />}
                {activeTab === 'policies' && <FileCheck2 className="w-5 h-5 text-emerald-700" />}
                {activeTab === 'claims' && <AlertTriangle className="w-5 h-5 text-amber-700" />}

                <span>
                  {activeTab === 'campaigns' && 'Enrollments per Campaign'}
                  {activeTab === 'segments' && 'Response Rate per Segment (Spoken Key vs Target)'}
                  {activeTab === 'policies' && 'Active In-Force Policies Registry'}
                  {activeTab === 'claims' && 'Open Claims Under Adjudication'}
                </span>
              </h2>
              <p className="text-xs text-stone-600 mt-0.5">
                {activeTab === 'campaigns' && 'Total customers enrolled into insurance coverage grouped by platform campaign ID.'}
                {activeTab === 'segments' && 'Conversion rate calculated by comparing enrolled customers against target audience counts.'}
                {activeTab === 'policies' && 'Live view of all customers currently covered under an active policy.'}
                {activeTab === 'claims' && 'Claims currently submitted or under review requiring operational decision.'}
              </p>
            </div>

            {/* Quick Search Input */}
            <div className="relative w-full sm:w-72">
              <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Search table records..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-white border border-[#D8CBB9] rounded-xl text-xs text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-[#8B9A6E]"
              />
            </div>
          </div>

          {/* ════════════════════════════════════════════════════════════ */}
          {/* TAB 1: ENROLLMENTS PER CAMPAIGN                              */}
          {/* ════════════════════════════════════════════════════════════ */}
          {activeTab === 'campaigns' && (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#D8CBB9] text-[11px] font-bold uppercase tracking-wider text-stone-600">
                    <th className="py-3 px-4">Campaign ID</th>
                    <th className="py-3 px-4">Campaign Name</th>
                    <th className="py-3 px-4">Partner Bank</th>
                    <th className="py-3 px-4">Product</th>
                    <th className="py-3 px-4">Timeline</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-right">Total Enrollments</th>
                    <th className="py-3 px-4 text-right">Enrolled Cover Sum</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#D8CBB9]/60 text-xs text-stone-800">
                  {isLoading ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-stone-500">
                        <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-[#5A6644]" />
                        Computing campaign enrollments...
                      </td>
                    </tr>
                  ) : filteredCampaigns.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-stone-500">
                        No campaigns found matching your query.
                      </td>
                    </tr>
                  ) : (
                    filteredCampaigns.map((camp) => (
                      <tr key={camp.campaignId} className="hover:bg-white/40 transition">
                        {/* Campaign Code */}
                        <td className="py-3.5 px-4 font-mono font-bold text-stone-800 whitespace-nowrap">
                          <span className="bg-white/90 border border-[#D8CBB9] px-2.5 py-0.5 rounded-md">
                            {camp.campaignCode}
                          </span>
                        </td>

                        {/* Name */}
                        <td className="py-3.5 px-4 font-bold text-[#2E3523]">
                          {camp.campaignName}
                        </td>

                        {/* Client */}
                        <td className="py-3.5 px-4 font-semibold text-stone-700">
                          <div className="flex items-center space-x-1.5">
                            <Building2 className="w-3.5 h-3.5 text-[#5A6644]" />
                            <span>{camp.clientName}</span>
                          </div>
                        </td>

                        {/* Product */}
                        <td className="py-3.5 px-4">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#8B9A6E]/15 text-[#3D472E] border border-[#8B9A6E]/30">
                            {camp.productName}
                          </span>
                        </td>

                        {/* Timeline */}
                        <td className="py-3.5 px-4 text-stone-600 font-mono text-[11px] whitespace-nowrap">
                          {camp.startDate ? camp.startDate : '—'} &rarr; {camp.endDate ? camp.endDate : '—'}
                        </td>

                        {/* Status */}
                        <td className="py-3.5 px-4 text-center">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                            camp.status === 'ACTIVE'
                              ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                              : 'bg-stone-100 text-stone-700 border-stone-300'
                          }`}>
                            {camp.status}
                          </span>
                        </td>

                        {/* Enrollment Count */}
                        <td className="py-3.5 px-4 text-right">
                          <span className="font-extrabold text-base text-[#2E3523]">
                            {camp.enrollmentCount}
                          </span>
                          <span className="text-[11px] text-stone-500 ml-1">enrolled</span>
                        </td>

                        {/* Total Cover Sum */}
                        <td className="py-3.5 px-4 text-right font-bold text-stone-900">
                          ${parseFloat(String(camp.totalCoverSum)).toLocaleString()}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════ */}
          {/* TAB 2: SEGMENT RESPONSE RATES                                */}
          {/* ════════════════════════════════════════════════════════════ */}
          {activeTab === 'segments' && (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#D8CBB9] text-[11px] font-bold uppercase tracking-wider text-stone-600">
                    <th className="py-3 px-4">Spoken Key</th>
                    <th className="py-3 px-4">Segment Name</th>
                    <th className="py-3 px-4">Bank / Client</th>
                    <th className="py-3 px-4">Insurance Status</th>
                    <th className="py-3 px-4 text-right">Target Audience</th>
                    <th className="py-3 px-4 text-right">Enrolled Count</th>
                    <th className="py-3 px-4 w-48 text-center">Response Rate (%)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#D8CBB9]/60 text-xs text-stone-800">
                  {isLoading ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-stone-500">
                        <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-[#5A6644]" />
                        Calculating response rates...
                      </td>
                    </tr>
                  ) : filteredSegments.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-stone-500">
                        No segments found matching your query.
                      </td>
                    </tr>
                  ) : (
                    filteredSegments.map((seg) => {
                      const rate = parseFloat(String(seg.responseRate || 0));
                      return (
                        <tr key={seg.segmentId} className="hover:bg-white/40 transition">
                          {/* Spoken Key */}
                          <td className="py-3.5 px-4 font-mono font-bold text-stone-800 whitespace-nowrap">
                            <span className="bg-[#5A6644]/10 text-[#2E3523] border border-[#5A6644]/30 px-2.5 py-1 rounded-md text-xs tracking-wider">
                              {seg.spokenKey || '—'}
                            </span>
                          </td>

                          {/* Segment Name */}
                          <td className="py-3.5 px-4 font-bold text-[#2E3523]">
                            <div>{seg.segmentName}</div>
                            <div className="text-[10px] text-stone-500 font-mono">
                              Event: {seg.eventCode} &bull; {seg.campaignName}
                            </div>
                          </td>

                          {/* Bank */}
                          <td className="py-3.5 px-4 font-semibold text-stone-700">
                            {seg.clientName} ({seg.state})
                          </td>

                          {/* Insurance Status (I vs UI) */}
                          <td className="py-3.5 px-4">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                              seg.insuranceStatus === 'I'
                                ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                                : 'bg-orange-100 text-orange-800 border-orange-300'
                            }`}>
                              {seg.insuranceStatus === 'I' ? 'I - Insured' : 'UI - Uninsured'}
                            </span>
                          </td>

                          {/* Target Audience */}
                          <td className="py-3.5 px-4 text-right font-mono font-bold text-stone-700">
                            {seg.targetCount?.toLocaleString() || 0}
                          </td>

                          {/* Enrolled Count */}
                          <td className="py-3.5 px-4 text-right font-extrabold text-[#2E3523]">
                            {seg.enrolledCount?.toLocaleString() || 0}
                          </td>

                          {/* Response Rate Bar & Percentage */}
                          <td className="py-3.5 px-4">
                            <div className="flex items-center space-x-2">
                              <div className="flex-1 bg-white/80 rounded-full h-2.5 border border-[#D8CBB9] overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all duration-500 ${
                                    rate >= 50
                                      ? 'bg-emerald-600'
                                      : rate >= 20
                                      ? 'bg-[#5A6644]'
                                      : 'bg-amber-600'
                                  }`}
                                  style={{ width: `${Math.min(rate, 100)}%` }}
                                />
                              </div>
                              <span className="font-extrabold text-xs text-[#2E3523] w-12 text-right">
                                {rate.toFixed(1)}%
                              </span>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════ */}
          {/* TAB 3: ACTIVE POLICIES REGISTRY                              */}
          {/* ════════════════════════════════════════════════════════════ */}
          {activeTab === 'policies' && (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#D8CBB9] text-[11px] font-bold uppercase tracking-wider text-stone-600">
                    <th className="py-3 px-4">Policy #</th>
                    <th className="py-3 px-4">Customer Name</th>
                    <th className="py-3 px-4">Product</th>
                    <th className="py-3 px-4">Location</th>
                    <th className="py-3 px-4">Effective Date</th>
                    <th className="py-3 px-4 text-right">Cover Amount</th>
                    <th className="py-3 px-4 text-right">Monthly Premium</th>
                    <th className="py-3 px-4 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#D8CBB9]/60 text-xs text-stone-800">
                  {isLoading ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-stone-500">
                        <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-[#5A6644]" />
                        Loading active policies from database...
                      </td>
                    </tr>
                  ) : filteredPolicies.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-stone-500">
                        No active policies found matching your search.
                      </td>
                    </tr>
                  ) : (
                    filteredPolicies.map((pol) => (
                      <tr key={pol.id} className="hover:bg-white/40 transition">
                        {/* Policy Number */}
                        <td className="py-3.5 px-4 font-mono font-bold text-stone-800 whitespace-nowrap">
                          <span className="bg-white/90 border border-[#D8CBB9] px-2.5 py-0.5 rounded-md">
                            {pol.policyNumber}
                          </span>
                        </td>

                        {/* Customer */}
                        <td className="py-3.5 px-4 font-bold text-[#2E3523]">
                          <div>{pol.customerName}</div>
                          <div className="text-[11px] font-normal text-stone-500">{pol.customerEmail}</div>
                          {pol.customerPhone && <div className="text-[10px] text-stone-400">{pol.customerPhone}</div>}
                        </td>

                        {/* Product */}
                        <td className="py-3.5 px-4">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#8B9A6E]/15 text-[#3D472E] border border-[#8B9A6E]/30">
                            {pol.productName}
                          </span>
                        </td>

                        {/* Location */}
                        <td className="py-3.5 px-4 text-stone-700 font-medium">
                          {pol.city}, {pol.state} {pol.zipCode}
                        </td>

                        {/* Effective Date */}
                        <td className="py-3.5 px-4 font-mono text-stone-600">
                          {pol.effectiveDate ? new Date(pol.effectiveDate).toLocaleDateString() : '—'}
                        </td>

                        {/* Cover Amount */}
                        <td className="py-3.5 px-4 text-right font-extrabold text-[#2E3523]">
                          ${parseFloat(String(pol.coverAmount)).toLocaleString()}
                        </td>

                        {/* Monthly Premium */}
                        <td className="py-3.5 px-4 text-right font-bold text-stone-900">
                          ${parseFloat(String(pol.monthlyPremium)).toFixed(2)}/mo
                        </td>

                        {/* Status */}
                        <td className="py-3.5 px-4 text-center">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                            {pol.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════ */}
          {/* TAB 4: OPEN CLAIMS                                           */}
          {/* ════════════════════════════════════════════════════════════ */}
          {activeTab === 'claims' && (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#D8CBB9] text-[11px] font-bold uppercase tracking-wider text-stone-600">
                    <th className="py-3 px-4">Claim #</th>
                    <th className="py-3 px-4">Insured Person</th>
                    <th className="py-3 px-4">Product Claimed</th>
                    <th className="py-3 px-4">Incident Details</th>
                    <th className="py-3 px-4 text-right">Claimed Amount</th>
                    <th className="py-3 px-4 text-center">Documents</th>
                    <th className="py-3 px-4 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#D8CBB9]/60 text-xs text-stone-800">
                  {isLoading ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-stone-500">
                        <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-[#5A6644]" />
                        Loading claims...
                      </td>
                    </tr>
                  ) : filteredClaims.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-stone-500">
                        No claims found.
                      </td>
                    </tr>
                  ) : (
                    filteredClaims.map((clm) => (
                      <tr key={clm.id} className="hover:bg-white/40 transition">
                        {/* Claim Number */}
                        <td className="py-3.5 px-4 font-mono font-bold text-stone-800 whitespace-nowrap">
                          <span className="bg-white/90 border border-[#D8CBB9] px-2.5 py-0.5 rounded-md">
                            {clm.claimNumber}
                          </span>
                        </td>

                        {/* Insured Person */}
                        <td className="py-3.5 px-4 font-bold text-[#2E3523]">
                          <div>{clm.insuredName}</div>
                          <div className="text-[11px] font-normal text-stone-500">{clm.insuredEmail}</div>
                          <div className="text-[10px] font-mono text-stone-400">Policy: {clm.policyNumber}</div>
                        </td>

                        {/* Product */}
                        <td className="py-3.5 px-4">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#8B9A6E]/15 text-[#3D472E] border border-[#8B9A6E]/30">
                            {clm.productName}
                          </span>
                        </td>

                        {/* Incident */}
                        <td className="py-3.5 px-4 max-w-xs">
                          <div className="font-semibold text-stone-800">{clm.incidentType}</div>
                          <div className="text-[11px] text-stone-500">
                            Date: {clm.incidentDate ? new Date(clm.incidentDate).toLocaleDateString() : '—'}
                          </div>
                          {clm.description && (
                            <p className="text-[11px] text-stone-500 truncate" title={clm.description}>
                              {clm.description}
                            </p>
                          )}
                        </td>

                        {/* Claimed Amount */}
                        <td className="py-3.5 px-4 text-right font-extrabold text-[#2E3523]">
                          ${parseFloat(String(clm.claimedAmount)).toLocaleString()}
                        </td>

                        {/* Documents count */}
                        <td className="py-3.5 px-4 text-center">
                          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-md bg-white border border-[#D8CBB9] text-[11px] font-medium text-stone-700">
                            <FileText className="w-3 h-3 text-blue-600" />
                            <span>{clm.documentsCount} files</span>
                          </span>
                        </td>

                        {/* Status */}
                        <td className="py-3.5 px-4 text-center">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                            clm.status === 'APPROVED'
                              ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                              : clm.status === 'REJECTED'
                              ? 'bg-red-100 text-red-800 border-red-300'
                              : clm.status === 'UNDER_REVIEW'
                              ? 'bg-amber-100 text-amber-800 border-amber-300'
                              : 'bg-blue-100 text-blue-800 border-blue-300'
                          }`}>
                            {clm.status === 'UNDER_REVIEW' ? 'Under Review'
                              : clm.status === 'APPROVED' ? 'Approved'
                              : clm.status === 'REJECTED' ? 'Rejected'
                              : 'Submitted'}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

        </div>
      </main>
    </div>
  );
};

export default OperationsDashboard;
