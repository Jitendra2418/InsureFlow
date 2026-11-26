import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Client } from '../types';
import { apiRequest } from '../api';
import { 
  Building2, Megaphone, ShieldCheck, PlusCircle, Search, RefreshCw, 
  LogOut, CheckCircle2, AlertCircle, MapPin, 
  Sparkles, Sliders, Hash, Pencil, Trash2, X, AlertTriangle,
  Tag, Calendar, Users, ArrowRight
} from 'lucide-react';

const US_STATES = [
  'Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado', 'Connecticut', 
  'Delaware', 'Florida', 'Georgia', 'Hawaii', 'Idaho', 'Illinois', 'Indiana', 'Iowa', 
  'Kansas', 'Kentucky', 'Louisiana', 'Maine', 'Maryland', 'Massachusetts', 'Michigan', 
  'Minnesota', 'Mississippi', 'Missouri', 'Montana', 'Nebraska', 'Nevada', 'New Hampshire', 
  'New Jersey', 'New Mexico', 'New York', 'North Carolina', 'North Dakota', 'Ohio', 
  'Oklahoma', 'Oregon', 'Pennsylvania', 'Rhode Island', 'South Carolina', 'South Dakota', 
  'Tennessee', 'Texas', 'Utah', 'Vermont', 'Virginia', 'Washington', 'West Virginia', 
  'Wisconsin', 'Wyoming'
];

export const AdminDashboard: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  // Active top-level tab: 'clients' or 'campaigns'
  const [activeTab, setActiveTab] = useState<'clients' | 'campaigns'>('clients');

  // Helper to generate a random client ID
  const generateNewClientId = () => {
    const randomNum = Math.floor(100000 + Math.random() * 900000);
    return `CLI-${randomNum}`;
  };

  // Clients state
  const [clients, setClients] = useState<Client[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Add form state
  const [clientName, setClientName] = useState<string>('');
  const [clientId, setClientId] = useState<string>(generateNewClientId());
  const [businessType, setBusinessType] = useState<string>('Bank');
  const [status, setStatus] = useState<string>('A-ACTIVE');
  const [address, setAddress] = useState<string>('');
  const [state, setState] = useState<string>('New York');

  // Edit modal state
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [editName, setEditName] = useState<string>('');
  const [editBusinessType, setEditBusinessType] = useState<string>('Bank');
  const [editStatus, setEditStatus] = useState<string>('A-ACTIVE');
  const [editAddress, setEditAddress] = useState<string>('');
  const [editState, setEditState] = useState<string>('New York');
  const [isUpdating, setIsUpdating] = useState<boolean>(false);
  const [editError, setEditError] = useState<string>('');

  // Delete modal state
  const [deletingClient, setDeletingClient] = useState<Client | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  // Global feedback state
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [formSuccess, setFormSuccess] = useState<string>('');
  const [formError, setFormError] = useState<string>('');

  // Fetch clients from backend
  const loadClients = async () => {
    setIsLoading(true);
    try {
      const data = await apiRequest<Client[]>('/admin/clients');
      setClients(data);
    } catch (err: unknown) {
      console.error('Failed to load clients:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadClients();
  }, []);

  // Handle Add Client
  const handleAddClient = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    setFormSuccess('');

    if (!clientName.trim()) {
      setFormError('Please enter the client name.');
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await apiRequest<{ message: string; client: Client }>('/admin/clients', {
        method: 'POST',
        body: JSON.stringify({
          name: clientName.trim(),
          clientId: clientId.trim(),
          businessType,
          status,
          address: address.trim(),
          state: state.trim()
        })
      });

      setFormSuccess(`Client "${res.client.name}" (${res.client.clientId}) successfully added to PostgreSQL!`);
      // Reset form and roll a new client id for next addition
      setClientName('');
      setAddress('');
      setClientId(generateNewClientId());
      setBusinessType('Bank');
      setStatus('A-ACTIVE');
      setState('New York');

      // Refresh table
      await loadClients();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create client in database.';
      setFormError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Open Edit Modal
  const openEditModal = (client: Client) => {
    setEditingClient(client);
    setEditName(client.name);
    setEditBusinessType(client.businessType || 'Bank');
    setEditStatus(client.status || 'A-ACTIVE');
    setEditAddress(client.address || '');
    setEditState(client.state || 'New York');
    setEditError('');
  };

  // Close Edit Modal
  const closeEditModal = () => {
    setEditingClient(null);
    setEditError('');
  };

  // Handle Update Client
  const handleUpdateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingClient) return;

    if (!editName.trim()) {
      setEditError('Client Name cannot be empty.');
      return;
    }

    setIsUpdating(true);
    setEditError('');

    try {
      const res = await apiRequest<{ message: string; client: Client }>(`/admin/clients/${editingClient.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: editName.trim(),
          businessType: editBusinessType,
          status: editStatus,
          address: editAddress.trim(),
          state: editState.trim()
        })
      });

      setFormSuccess(`Client "${res.client.name}" (${res.client.clientId}) successfully updated!`);
      closeEditModal();
      await loadClients();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update client in database.';
      setEditError(msg);
    } finally {
      setIsUpdating(false);
    }
  };

  // Open Delete Modal
  const openDeleteModal = (client: Client) => {
    setDeletingClient(client);
  };

  // Close Delete Modal
  const closeDeleteModal = () => {
    setDeletingClient(null);
  };

  // Handle Delete Client
  const handleDeleteClient = async () => {
    if (!deletingClient) return;
    setIsDeleting(true);

    try {
      const res = await apiRequest<{ message: string; deletedId: string }>(`/admin/clients/${deletingClient.id}`, {
        method: 'DELETE'
      });

      setFormSuccess(res.message || `Client "${deletingClient.name}" successfully deleted.`);
      closeDeleteModal();
      await loadClients();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to delete client from database.';
      setFormError(msg);
      closeDeleteModal();
    } finally {
      setIsDeleting(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/admin/login');
  };

  // Filtered clients list
  const filteredClients = clients.filter((c) => {
    const matchesSearch = 
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.clientId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.state && c.state.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesStatus = statusFilter === 'ALL' || c.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Metric stats
  const totalCount = clients.length;
  const activeCount = clients.filter(c => c.status === 'A-ACTIVE' || c.isActive).length;
  const inactiveCount = totalCount - activeCount;

  return (
    <div className="min-h-screen bg-[#F7F2EB] flex flex-col font-sans">
      {/* Top Navigation */}
      <header className="sticky top-0 z-40 bg-[#F7F2EB]/95 backdrop-blur-md border-b border-[#EAE2D6]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-11 h-11 rounded-2xl bg-[#5A6644] flex items-center justify-center text-white shadow-md shadow-[#5A6644]/20">
              <ShieldCheck className="w-6 h-6 stroke-[2.2]" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-2xl font-bold tracking-tight text-[#2E3523]">Insure<span className="text-[#8B9A6E]">Flow</span></span>
                <span className="text-[10px] font-bold uppercase tracking-wider bg-[#5A6644]/15 text-[#3D472E] px-2 py-0.5 rounded-full border border-[#5A6644]/30">
                  {user?.role === 'OPERATIONS' ? 'Operations Portal' : 'Admin Portal'}
                </span>
              </div>
              <p className="text-xs text-stone-500 font-medium hidden sm:block">Administrative & Operations Command Center</p>
            </div>
          </div>

          <div className="flex items-center space-x-3 sm:space-x-5">
            {/* User Profile Pill */}
            <div className="flex items-center space-x-2 bg-[#EAE2D6] px-3.5 py-1.5 rounded-full border border-[#D8CBB9]">
              <div className="w-7 h-7 rounded-full bg-[#5A6644] text-white flex items-center justify-center text-xs font-bold">
                {user?.firstName?.charAt(0) || 'A'}{user?.lastName?.charAt(0) || 'D'}
              </div>
              <div className="text-xs text-left hidden sm:block">
                <p className="font-bold text-stone-800 leading-tight">{user?.firstName} {user?.lastName}</p>
                <p className="text-[10px] text-[#5A6644] font-bold uppercase tracking-wider">{user?.role}</p>
              </div>
            </div>

            {/* Logout Button */}
            <button
              onClick={handleLogout}
              className="flex items-center space-x-1 text-xs font-semibold text-stone-600 hover:text-red-700 bg-white hover:bg-stone-50 border border-[#D8CBB9] px-3 py-2 rounded-xl transition shadow-sm"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Welcome Banner */}
        <div className="bg-gradient-to-r from-[#5A6644] to-[#454f34] rounded-3xl p-6 sm:p-8 text-white shadow-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <div className="flex items-center space-x-2 text-[#D8E2C8] text-xs font-bold uppercase tracking-wider mb-2">
              <ShieldCheck className="w-4 h-4" />
              <span>Administrative Operations</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Welcome back, {user?.firstName} {user?.lastName}
            </h1>
            <p className="mt-1 text-xs sm:text-sm text-[#E2EBD3] max-w-xl">
              Configure partner banks and institutions under Clients, and coordinate marketing promotions under Campaign.
            </p>
          </div>

          <div className="bg-white/10 backdrop-blur-md px-4 py-3 rounded-2xl border border-white/20 text-xs">
            <p className="font-bold text-white flex items-center space-x-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>PostgreSQL Database Active</span>
            </p>
            <p className="text-[#D8E2C8] text-[11px] mt-0.5">Port 5433 • Connected</p>
          </div>
        </div>

        {/* Dashboard Navigation Tabs */}
        <div className="flex items-center space-x-3 border-b border-[#D8CBB9]/80 pb-4">
          <button
            onClick={() => setActiveTab('clients')}
            className={`inline-flex items-center space-x-2.5 px-6 py-3 rounded-2xl text-sm font-bold transition-all ${
              activeTab === 'clients'
                ? 'bg-[#5A6644] text-white shadow-md shadow-[#5A6644]/25 scale-[1.01]'
                : 'bg-[#EAE2D6] text-stone-700 hover:bg-[#ded4c6] hover:text-stone-900 border border-[#D8CBB9]'
            }`}
          >
            <Building2 className="w-4 h-4" />
            <span>Clients</span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
              activeTab === 'clients' ? 'bg-white/20 text-white' : 'bg-[#D8CBB9] text-stone-700'
            }`}>
              {totalCount}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('campaigns')}
            className={`inline-flex items-center space-x-2.5 px-6 py-3 rounded-2xl text-sm font-bold transition-all ${
              activeTab === 'campaigns'
                ? 'bg-[#5A6644] text-white shadow-md shadow-[#5A6644]/25 scale-[1.01]'
                : 'bg-[#EAE2D6] text-stone-700 hover:bg-[#ded4c6] hover:text-stone-900 border border-[#D8CBB9]'
            }`}
          >
            <Megaphone className="w-4 h-4" />
            <span>Campaign</span>
            <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
              activeTab === 'campaigns' ? 'bg-white/20 text-white' : 'bg-emerald-100 text-emerald-800 border border-emerald-300'
            }`}>
              New
            </span>
          </button>
        </div>

        {/* TAB 1: CLIENTS */}
        {activeTab === 'clients' && (
          <div className="space-y-8 animate-in fade-in duration-200">
            {/* Metric Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-[#EAE2D6] p-5 rounded-2xl border border-[#D8CBB9] shadow-sm">
                <div className="flex items-center justify-between text-stone-600 text-xs font-bold uppercase tracking-wider">
                  <span>Total Clients</span>
                  <Building2 className="w-4 h-4 text-[#5A6644]" />
                </div>
                <p className="text-3xl font-black text-[#2E3523] mt-2">{totalCount}</p>
                <p className="text-xs text-stone-500 mt-1">Configured in InsureFlow</p>
              </div>

              <div className="bg-[#EAE2D6] p-5 rounded-2xl border border-[#D8CBB9] shadow-sm">
                <div className="flex items-center justify-between text-emerald-800 text-xs font-bold uppercase tracking-wider">
                  <span>Active Partners (A-ACTIVE)</span>
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                </div>
                <p className="text-3xl font-black text-emerald-800 mt-2">{activeCount}</p>
                <p className="text-xs text-stone-500 mt-1">Live coverage campaigns allowed</p>
              </div>

              <div className="bg-[#EAE2D6] p-5 rounded-2xl border border-[#D8CBB9] shadow-sm">
                <div className="flex items-center justify-between text-stone-600 text-xs font-bold uppercase tracking-wider">
                  <span>Inactive Partners (IA-INACTIVE)</span>
                  <Sliders className="w-4 h-4 text-stone-500" />
                </div>
                <p className="text-3xl font-black text-stone-700 mt-2">{inactiveCount}</p>
                <p className="text-xs text-stone-500 mt-1">Suspended or draft stage</p>
              </div>
            </div>

            {/* Global Success / Error Banners */}
            {formSuccess && (
              <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm rounded-2xl flex items-center justify-between shadow-sm">
                <div className="flex items-center space-x-2">
                  <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-emerald-600" />
                  <span>{formSuccess}</span>
                </div>
                <button onClick={() => setFormSuccess('')} className="text-emerald-700 hover:text-emerald-900 p-1">
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {formError && (
              <div className="p-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-2xl flex items-center justify-between shadow-sm">
                <div className="flex items-center space-x-2">
                  <AlertCircle className="w-5 h-5 flex-shrink-0 text-red-500" />
                  <span>{formError}</span>
                </div>
                <button onClick={() => setFormError('')} className="text-red-700 hover:text-red-900 p-1">
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Feature 1: Register Client Profile (Add Client Form Section) */}
            <div className="bg-[#EAE2D6] rounded-3xl p-6 sm:p-8 border border-[#D8CBB9] shadow-md">
              <div className="flex items-center space-x-2 text-[#5A6644] text-xs font-bold uppercase tracking-wider mb-1">
                <PlusCircle className="w-4 h-4" />
                <span>Registering Client Profile</span>
              </div>
              <h2 className="text-2xl font-bold text-[#2E3523]">Register Client Profile</h2>
              <p className="text-xs text-stone-600 mt-0.5 mb-6">
                Provide the partner organization details below to create an active client record in PostgreSQL.
              </p>

              <form onSubmit={handleAddClient} className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {/* Client Name */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-1.5">
                      Client Name <span className="text-red-500">*</span>
                    </label>
                    <div className="relative rounded-xl shadow-sm">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-stone-400">
                        <Building2 className="h-4 w-4" />
                      </div>
                      <input
                        type="text"
                        required
                        value={clientName}
                        onChange={(e) => setClientName(e.target.value)}
                        placeholder="e.g. Apex Trust Bank"
                        className="block w-full pl-10 pr-3 py-2.5 bg-white border border-[#D8CBB9] rounded-xl text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-[#8B9A6E] text-sm"
                      />
                    </div>
                  </div>

                  {/* Client ID (Auto Generated) */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-bold uppercase tracking-wider text-stone-700">
                        Client ID <span className="text-stone-400 font-normal lowercase">(auto generated)</span>
                      </label>
                      <button
                        type="button"
                        onClick={() => setClientId(generateNewClientId())}
                        className="text-[11px] font-bold text-[#5A6644] hover:underline flex items-center space-x-1"
                      >
                        <RefreshCw className="w-3 h-3" />
                        <span>Regenerate ID</span>
                      </button>
                    </div>
                    <div className="relative rounded-xl shadow-sm">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-stone-400">
                        <Hash className="h-4 w-4" />
                      </div>
                      <input
                        type="text"
                        readOnly
                        value={clientId}
                        className="block w-full pl-10 pr-3 py-2.5 bg-stone-100 border border-[#D8CBB9] rounded-xl text-stone-700 font-mono text-sm cursor-not-allowed font-semibold"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {/* Business Type Dropdown */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-1.5">
                      Business Type
                    </label>
                    <select
                      value={businessType}
                      onChange={(e) => setBusinessType(e.target.value)}
                      className="block w-full px-3 py-2.5 bg-white border border-[#D8CBB9] rounded-xl text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#8B9A6E] text-sm font-medium"
                    >
                      <option value="Bank">Bank</option>
                      <option value="Creditunion">Creditunion</option>
                      <option value="Affinity partner">Affinity partner</option>
                      <option value="Association">Association</option>
                    </select>
                  </div>

                  {/* Status Dropdown */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-1.5">
                      Status
                    </label>
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value)}
                      className="block w-full px-3 py-2.5 bg-white border border-[#D8CBB9] rounded-xl text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#8B9A6E] text-sm font-medium"
                    >
                      <option value="A-ACTIVE">A-ACTIVE (Active Partner)</option>
                      <option value="IA-INACTIVE">IA-INACTIVE (Inactive / Suspended)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                  {/* Address Field */}
                  <div className="md:col-span-2">
                    <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-1.5">
                      Address
                    </label>
                    <div className="relative rounded-xl shadow-sm">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-stone-400">
                        <MapPin className="h-4 w-4" />
                      </div>
                      <input
                        type="text"
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        placeholder="e.g. 100 Financial Way, Suite 400"
                        className="block w-full pl-10 pr-3 py-2.5 bg-white border border-[#D8CBB9] rounded-xl text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-[#8B9A6E] text-sm"
                      />
                    </div>
                  </div>

                  {/* State of Country Dropdown */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-1.5">
                      State
                    </label>
                    <select
                      value={state}
                      onChange={(e) => setState(e.target.value)}
                      className="block w-full px-3 py-2.5 bg-white border border-[#D8CBB9] rounded-xl text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#8B9A6E] text-sm font-medium"
                    >
                      {US_STATES.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full sm:w-auto inline-flex justify-center items-center space-x-2 py-3 px-6 border border-transparent rounded-xl shadow-md text-sm font-bold text-white bg-[#5A6644] hover:bg-[#495436] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#5A6644] transition hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>{isSubmitting ? 'Saving Client to Database...' : 'Register Client Profile'}</span>
                  </button>
                </div>
              </form>
            </div>

            {/* Feature 2: Partner Client Directory (Table with search, edit & delete) */}
            <div className="bg-[#EAE2D6] rounded-3xl p-6 sm:p-8 border border-[#D8CBB9] shadow-md">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                <div>
                  <h3 className="text-xl font-bold text-[#2E3523]">Partner Client Directory</h3>
                  <p className="text-xs text-stone-600 mt-0.5">
                    All bank and institutional partners stored in the PostgreSQL database. You can edit details or remove clients.
                  </p>
                </div>

                {/* Search and Status Filters */}
                <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
                  <div className="relative flex-1 sm:w-60">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-stone-400" />
                    <input
                      type="text"
                      placeholder="Search name, ID, or state..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 bg-white border border-[#D8CBB9] rounded-xl text-xs text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-[#8B9A6E]"
                    />
                  </div>

                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="bg-white border border-[#D8CBB9] rounded-xl px-3 py-2 text-xs text-stone-800 font-medium focus:outline-none focus:ring-2 focus:ring-[#8B9A6E]"
                  >
                    <option value="ALL">All Statuses</option>
                    <option value="A-ACTIVE">A-ACTIVE Only</option>
                    <option value="IA-INACTIVE">IA-INACTIVE Only</option>
                  </select>

                  <button
                    onClick={loadClients}
                    disabled={isLoading}
                    title="Refresh Table"
                    className="p-2 bg-white border border-[#D8CBB9] rounded-xl text-stone-600 hover:text-[#5A6644] hover:bg-stone-50 transition"
                  >
                    <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                  </button>
                </div>
              </div>

              {/* Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-[#D8CBB9] text-[11px] font-bold uppercase tracking-wider text-stone-600">
                      <th className="py-3 px-4">Client ID</th>
                      <th className="py-3 px-4">Client Name</th>
                      <th className="py-3 px-4">Business Type</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">State</th>
                      <th className="py-3 px-4">Address</th>
                      <th className="py-3 px-4">Added On</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#D8CBB9]/60 text-xs text-stone-800">
                    {isLoading ? (
                      <tr>
                        <td colSpan={8} className="py-8 text-center text-stone-500">
                          <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-[#5A6644]" />
                          Loading clients from PostgreSQL database...
                        </td>
                      </tr>
                    ) : filteredClients.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-8 text-center text-stone-500">
                          No partner clients found matching your search. Add one above!
                        </td>
                      </tr>
                    ) : (
                      filteredClients.map((client) => {
                        const isActive = client.status === 'A-ACTIVE' || client.isActive;
                        return (
                          <tr key={client.id} className="hover:bg-white/40 transition">
                            <td className="py-3.5 px-4 font-mono font-bold text-stone-700">
                              <span className="bg-white/80 border border-[#D8CBB9] px-2 py-0.5 rounded-md">
                                {client.clientId}
                              </span>
                            </td>
                            <td className="py-3.5 px-4 font-bold text-[#2E3523]">
                              {client.name}
                            </td>
                            <td className="py-3.5 px-4">
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#8B9A6E]/15 text-[#3D472E]">
                                {client.businessType}
                              </span>
                            </td>
                            <td className="py-3.5 px-4">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                                isActive
                                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                  : 'bg-stone-200 text-stone-700 border border-stone-300'
                              }`}>
                                {client.status}
                              </span>
                            </td>
                            <td className="py-3.5 px-4 font-medium text-stone-700">
                              {client.state || '—'}
                            </td>
                            <td className="py-3.5 px-4 text-stone-600 max-w-xs truncate" title={client.address}>
                              {client.address || '—'}
                            </td>
                            <td className="py-3.5 px-4 text-stone-500 text-[11px]">
                              {client.createdAt ? new Date(client.createdAt).toLocaleDateString() : '—'}
                            </td>
                            <td className="py-3.5 px-4 text-right">
                              <div className="flex items-center justify-end space-x-1.5">
                                <button
                                  onClick={() => openEditModal(client)}
                                  title="Edit Client"
                                  className="p-1.5 text-stone-600 hover:text-white hover:bg-[#5A6644] rounded-lg transition border border-[#D8CBB9] bg-white shadow-sm"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => openDeleteModal(client)}
                                  title="Delete Client"
                                  className="p-1.5 text-red-600 hover:text-white hover:bg-red-600 rounded-lg transition border border-red-200 bg-white shadow-sm"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: CAMPAIGN */}
        {activeTab === 'campaigns' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            {/* Campaign Header Card */}
            <div className="bg-[#EAE2D6] rounded-3xl p-6 sm:p-8 border border-[#D8CBB9] shadow-md">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-6 border-b border-[#D8CBB9]/80">
                <div>
                  <div className="flex items-center space-x-2 text-[#5A6644] text-xs font-bold uppercase tracking-wider mb-1">
                    <Megaphone className="w-4 h-4" />
                    <span>Marketing & Promo Operations</span>
                  </div>
                  <h2 className="text-2xl font-bold text-[#2E3523]">Campaign Management</h2>
                  <p className="text-xs text-stone-600 mt-1 max-w-2xl">
                    Configure bank partner marketing campaigns, events, digital and direct mail drops, promo redemption codes, and audience segments.
                  </p>
                </div>

                <div className="inline-flex items-center space-x-2 bg-white/80 border border-[#D8CBB9] px-3.5 py-2 rounded-2xl text-xs font-bold text-[#5A6644] shadow-sm">
                  <Sparkles className="w-4 h-4 text-[#8B9A6E]" />
                  <span>Ready for Next Features</span>
                </div>
              </div>

              {/* Campaign Highlights Grid */}
              <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white/80 p-5 rounded-2xl border border-[#D8CBB9]/80 shadow-sm flex flex-col justify-between">
                  <div>
                    <div className="w-9 h-9 rounded-xl bg-[#5A6644]/15 text-[#5A6644] flex items-center justify-center mb-3">
                      <Megaphone className="w-5 h-5" />
                    </div>
                    <h4 className="font-bold text-sm text-[#2E3523]">Partner Campaigns</h4>
                    <p className="text-[11px] text-stone-500 mt-1">
                      Link active bank clients to AD&D Flagship and upcoming plans.
                    </p>
                  </div>
                  <div className="mt-4 pt-3 border-t border-[#D8CBB9]/40 text-[11px] font-semibold text-emerald-700">
                    ● Ready to Configure
                  </div>
                </div>

                <div className="bg-white/80 p-5 rounded-2xl border border-[#D8CBB9]/80 shadow-sm flex flex-col justify-between">
                  <div>
                    <div className="w-9 h-9 rounded-xl bg-[#5A6644]/15 text-[#5A6644] flex items-center justify-center mb-3">
                      <Tag className="w-5 h-5" />
                    </div>
                    <h4 className="font-bold text-sm text-[#2E3523]">Promo Codes</h4>
                    <p className="text-[11px] text-stone-500 mt-1">
                      Generate, validate, and track promo redemption codes.
                    </p>
                  </div>
                  <div className="mt-4 pt-3 border-t border-[#D8CBB9]/40 text-[11px] font-semibold text-emerald-700">
                    ● Ready to Configure
                  </div>
                </div>

                <div className="bg-white/80 p-5 rounded-2xl border border-[#D8CBB9]/80 shadow-sm flex flex-col justify-between">
                  <div>
                    <div className="w-9 h-9 rounded-xl bg-[#5A6644]/15 text-[#5A6644] flex items-center justify-center mb-3">
                      <Calendar className="w-5 h-5" />
                    </div>
                    <h4 className="font-bold text-sm text-[#2E3523]">Events & Drops</h4>
                    <p className="text-[11px] text-stone-500 mt-1">
                      Direct mail runs, digital campaigns, and delivery dates.
                    </p>
                  </div>
                  <div className="mt-4 pt-3 border-t border-[#D8CBB9]/40 text-[11px] font-semibold text-emerald-700">
                    ● Ready to Configure
                  </div>
                </div>

                <div className="bg-white/80 p-5 rounded-2xl border border-[#D8CBB9]/80 shadow-sm flex flex-col justify-between">
                  <div>
                    <div className="w-9 h-9 rounded-xl bg-[#5A6644]/15 text-[#5A6644] flex items-center justify-center mb-3">
                      <Users className="w-5 h-5" />
                    </div>
                    <h4 className="font-bold text-sm text-[#2E3523]">Audience Segments</h4>
                    <p className="text-[11px] text-stone-500 mt-1">
                      Target counts, demographic filters, and client segments.
                    </p>
                  </div>
                  <div className="mt-4 pt-3 border-t border-[#D8CBB9]/40 text-[11px] font-semibold text-emerald-700">
                    ● Ready to Configure
                  </div>
                </div>
              </div>

              {/* Ready banner */}
              <div className="mt-6 p-5 bg-[#F7F2EB] rounded-2xl border border-[#D8CBB9] flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center space-x-3 text-xs text-stone-700">
                  <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
                    ✓
                  </div>
                  <div>
                    <p className="font-bold text-stone-900">Campaign module tab workspace is ready!</p>
                    <p className="text-stone-500 text-[11px]">You can now specify campaign creation forms, code generators, and tracking tables.</p>
                  </div>
                </div>

                <button
                  onClick={() => setActiveTab('clients')}
                  className="px-4 py-2 bg-white hover:bg-stone-50 border border-[#D8CBB9] rounded-xl text-xs font-bold text-[#5A6644] transition shadow-sm inline-flex items-center space-x-1"
                >
                  <span>Back to Clients Directory</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Edit Client Modal */}
      {editingClient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#EAE2D6] border border-[#D8CBB9] rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl relative">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-[#D8CBB9]/80">
              <div className="flex items-center space-x-2 text-[#5A6644]">
                <Pencil className="w-5 h-5" />
                <h3 className="text-xl font-bold text-[#2E3523]">Edit Client Profile</h3>
              </div>
              <button 
                onClick={closeEditModal} 
                className="text-stone-500 hover:text-stone-800 p-1 rounded-lg hover:bg-white/60 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {editError && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-500" />
                <span>{editError}</span>
              </div>
            )}

            <form onSubmit={handleUpdateClient} className="mt-5 space-y-4">
              {/* Client ID (Read-only) */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-1">
                  Client ID (Fixed)
                </label>
                <div className="relative rounded-xl shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-stone-400">
                    <Hash className="h-4 w-4" />
                  </div>
                  <input
                    type="text"
                    readOnly
                    value={editingClient.clientId}
                    className="block w-full pl-9 pr-3 py-2 bg-stone-100 border border-[#D8CBB9] rounded-xl text-stone-600 font-mono text-xs cursor-not-allowed font-semibold"
                  />
                </div>
              </div>

              {/* Client Name */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-1">
                  Client Name <span className="text-red-500">*</span>
                </label>
                <div className="relative rounded-xl shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-stone-400">
                    <Building2 className="h-4 w-4" />
                  </div>
                  <input
                    type="text"
                    required
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="block w-full pl-9 pr-3 py-2 bg-white border border-[#D8CBB9] rounded-xl text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#8B9A6E] text-xs font-medium"
                  />
                </div>
              </div>

              {/* Business Type & Status */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-1">
                    Business Type
                  </label>
                  <select
                    value={editBusinessType}
                    onChange={(e) => setEditBusinessType(e.target.value)}
                    className="block w-full px-3 py-2 bg-white border border-[#D8CBB9] rounded-xl text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#8B9A6E] text-xs font-medium"
                  >
                    <option value="Bank">Bank</option>
                    <option value="Creditunion">Creditunion</option>
                    <option value="Affinity partner">Affinity partner</option>
                    <option value="Association">Association</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-1">
                    Status
                  </label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value)}
                    className="block w-full px-3 py-2 bg-white border border-[#D8CBB9] rounded-xl text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#8B9A6E] text-xs font-medium"
                  >
                    <option value="A-ACTIVE">A-ACTIVE (Active Partner)</option>
                    <option value="IA-INACTIVE">IA-INACTIVE (Inactive / Suspended)</option>
                  </select>
                </div>
              </div>

              {/* State */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-1">
                  State
                </label>
                <select
                  value={editState}
                  onChange={(e) => setEditState(e.target.value)}
                  className="block w-full px-3 py-2 bg-white border border-[#D8CBB9] rounded-xl text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#8B9A6E] text-xs font-medium"
                >
                  {US_STATES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              {/* Address */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-1">
                  Address
                </label>
                <div className="relative rounded-xl shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-stone-400">
                    <MapPin className="h-4 w-4" />
                  </div>
                  <input
                    type="text"
                    value={editAddress}
                    onChange={(e) => setEditAddress(e.target.value)}
                    className="block w-full pl-9 pr-3 py-2 bg-white border border-[#D8CBB9] rounded-xl text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#8B9A6E] text-xs"
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="pt-3 border-t border-[#D8CBB9]/80 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={closeEditModal}
                  className="px-4 py-2 border border-[#D8CBB9] rounded-xl text-xs font-bold text-stone-700 hover:bg-stone-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUpdating}
                  className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-[#5A6644] hover:bg-[#495436] transition shadow disabled:opacity-50"
                >
                  {isUpdating ? 'Saving Changes...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingClient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#EAE2D6] border border-[#D8CBB9] rounded-3xl p-6 sm:p-7 max-w-md w-full shadow-2xl relative text-center">
            <div className="w-12 h-12 rounded-2xl bg-red-100 border border-red-200 text-red-600 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <h3 className="text-xl font-bold text-[#2E3523]">Delete Client Profile?</h3>
            <p className="text-xs text-stone-600 mt-2 leading-relaxed">
              Are you sure you want to delete <span className="font-bold text-stone-800">"{deletingClient.name}"</span> ({deletingClient.clientId})? 
              This will permanently remove the partner client from the PostgreSQL database.
            </p>

            <div className="mt-6 flex justify-center space-x-3">
              <button
                type="button"
                onClick={closeDeleteModal}
                disabled={isDeleting}
                className="px-4 py-2.5 border border-[#D8CBB9] rounded-xl text-xs font-bold text-stone-700 hover:bg-stone-50 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteClient}
                disabled={isDeleting}
                className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-red-600 hover:bg-red-700 transition shadow disabled:opacity-50 inline-flex items-center space-x-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isDeleting ? 'Deleting...' : 'Yes, Delete Client'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default AdminDashboard;
