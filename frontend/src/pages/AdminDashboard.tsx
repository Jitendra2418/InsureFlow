import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Client, Product, Campaign, CampaignEvent, Segment, CustomerStats } from '../types';
import { apiRequest } from '../api';
import { 
  Building2, Megaphone, ShieldCheck, PlusCircle, Search, RefreshCw, 
  LogOut, CheckCircle2, AlertCircle, MapPin, 
  Sparkles, Sliders, Hash, Pencil, Trash2, X, AlertTriangle,
  Calendar, CalendarDays, Send, ArrowRight, Layers, Target, Users
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

  // Active top-level tab: 'clients' | 'campaigns' | 'events' | 'segments'
  const [activeTab, setActiveTab] = useState<'clients' | 'campaigns' | 'events' | 'segments'>('clients');

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

  // Global feedback state (clients tab)
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [formSuccess, setFormSuccess] = useState<string>('');
  const [formError, setFormError] = useState<string>('');

  // ── Campaign tab state ──────────────────────────────────────────
  const [products, setProducts] = useState<Product[]>([]);
  const [isProductsLoading, setIsProductsLoading] = useState<boolean>(false);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [isCampaignsLoading, setIsCampaignsLoading] = useState<boolean>(false);

  // Campaign form fields
  const [campClient, setCampClient] = useState<string>('');
  const [campProduct, setCampProduct] = useState<string>('');
  const [campDescription, setCampDescription] = useState<string>('');
  const [campStartMonth, setCampStartMonth] = useState<string>('');
  const [campEndMonth, setCampEndMonth] = useState<string>('');
  const [campStatus, setCampStatus] = useState<string>('PLANNED');
  const [generatedCampaignId, setGeneratedCampaignId] = useState<string>('');

  // Campaign form feedback
  const [campFormSuccess, setCampFormSuccess] = useState<string>('');
  const [campFormError, setCampFormError] = useState<string>('');
  const [isCampSubmitting, setIsCampSubmitting] = useState<boolean>(false);

  // Campaign search
  const [campSearchTerm, setCampSearchTerm] = useState<string>('');

  // Auto-generate Campaign ID when client or startMonth changes
  const getQuarter = (monthStr: string): string => {
    const month = parseInt(monthStr.split('-')[1], 10);
    if (month <= 3) return 'Q1';
    if (month <= 6) return 'Q2';
    if (month <= 9) return 'Q3';
    return 'Q4';
  };

  // Recompute generated campaign ID whenever client or start month changes
  React.useEffect(() => {
    if (!campClient || !campStartMonth) {
      setGeneratedCampaignId('');
      return;
    }
    const selectedClient = clients.find(c => c.id === campClient);
    const clientShortName = selectedClient ? selectedClient.name.split(' ')[0] : 'CLI';
    const year = campStartMonth.split('-')[0];
    const quarter = getQuarter(campStartMonth);
    setGeneratedCampaignId(`${clientShortName}-${quarter}-${year}`);
  }, [campClient, campStartMonth, clients]);

  // Load products (handles both public /products and /admin/products)
  const loadProducts = async () => {
    setIsProductsLoading(true);
    try {
      let data: Product[] = [];
      try {
        data = await apiRequest<Product[]>('/products');
      } catch (err1) {
        console.warn('GET /products failed, falling back to /admin/products...', err1);
        data = await apiRequest<Product[]>('/admin/products');
      }
      if (Array.isArray(data)) {
        setProducts(data);
      }
    } catch (err) {
      console.error('Failed to load products from database:', err);
    } finally {
      setIsProductsLoading(false);
    }
  };

  // Load campaigns
  const loadCampaigns = async () => {
    setIsCampaignsLoading(true);
    try {
      const data = await apiRequest<Campaign[]>('/admin/campaigns');
      setCampaigns(data);
    } catch (err) {
      console.error('Failed to load campaigns:', err);
    } finally {
      setIsCampaignsLoading(false);
    }
  };

  // Handle Campaign form submit
  const handleCreateCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    setCampFormError('');
    setCampFormSuccess('');

    if (!campClient) { setCampFormError('Please select a client.'); return; }
    if (!campProduct) { setCampFormError('Please select a product.'); return; }
    if (!campStartMonth) { setCampFormError('Please select a start month.'); return; }
    if (!campEndMonth) { setCampFormError('Please select an end month.'); return; }
    if (campStartMonth > campEndMonth) { setCampFormError('Start month cannot be after end month.'); return; }
    if (!generatedCampaignId) { setCampFormError('Campaign ID could not be generated. Select a client and start month.'); return; }

    setIsCampSubmitting(true);
    try {
      const res = await apiRequest<{ message: string; campaign: Campaign }>('/admin/campaigns', {
        method: 'POST',
        body: JSON.stringify({
          clientId: campClient,
          productId: campProduct,
          campaignId: generatedCampaignId,
          name: generatedCampaignId,
          description: campDescription.trim(),
          startMonth: campStartMonth,
          endMonth: campEndMonth,
          status: campStatus
        })
      });
      setCampFormSuccess(res.message || `Campaign "${generatedCampaignId}" successfully created!`);
      // Reset form
      setCampClient('');
      setCampProduct('');
      setCampDescription('');
      setCampStartMonth('');
      setCampEndMonth('');
      setCampStatus('PLANNED');
      setGeneratedCampaignId('');
      await loadCampaigns();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create campaign.';
      setCampFormError(msg);
    } finally {
      setIsCampSubmitting(false);
    }
  };

  // ── Events tab state ──────────────────────────────────────────
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [events, setEvents] = useState<CampaignEvent[]>([]);
  const [isEventsLoading, setIsEventsLoading] = useState<boolean>(false);
  const [eventViewFilter, setEventViewFilter] = useState<'CURRENT' | 'ALL'>('CURRENT');

  // Helper to generate a new Event ID
  const generateNewEventId = (campaignCode?: string) => {
    const randomDigits = Math.floor(100000 + Math.random() * 900000);
    if (campaignCode) {
      const prefix = campaignCode.split('-')[0] || 'EVT';
      return `${prefix}-EVT-${randomDigits.toString().slice(-4)}`;
    }
    return `EVT-${randomDigits}`;
  };

  // Event form fields
  const [eventCampaignId, setEventCampaignId] = useState<string>('');
  const [eventChannel, setEventChannel] = useState<string>('Telemarketting');
  const [eventMedia, setEventMedia] = useState<string>('mail');
  const [eventScheduledDrop, setEventScheduledDrop] = useState<string>('');
  const [eventFinalDescription, setEventFinalDescription] = useState<string>('');
  const [eventType, setEventType] = useState<string>('mailing');
  const [eventId, setEventId] = useState<string>(generateNewEventId());
  const [eventQuantity, setEventQuantity] = useState<string>('');

  // Event feedback
  const [eventFormSuccess, setEventFormSuccess] = useState<string>('');
  const [eventFormError, setEventFormError] = useState<string>('');
  const [isEventSubmitting, setIsEventSubmitting] = useState<boolean>(false);
  const [eventSearchTerm, setEventSearchTerm] = useState<string>('');

  // Select campaign for events and jump to events tab
  const handleSelectCampaignForEvents = (camp: Campaign) => {
    setSelectedCampaign(camp);
    setEventCampaignId(camp.id);
    setEventId(generateNewEventId(camp.campaignId));
    setActiveTab('events');
  };

  // Load events from backend
  const loadEvents = async (campaignIdToLoad?: string) => {
    setIsEventsLoading(true);
    try {
      const targetId = campaignIdToLoad !== undefined ? campaignIdToLoad : (eventViewFilter === 'CURRENT' && selectedCampaign ? selectedCampaign.id : '');
      const url = targetId ? `/admin/events?campaignId=${targetId}` : '/admin/events';
      const data = await apiRequest<CampaignEvent[]>(url);
      setEvents(data);
    } catch (err) {
      console.error('Failed to load events:', err);
    } finally {
      setIsEventsLoading(false);
    }
  };

  // Handle Event form submit
  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    setEventFormError('');
    setEventFormSuccess('');

    if (!eventCampaignId) {
      setEventFormError('Please select a campaign for this event.');
      return;
    }
    if (!eventScheduledDrop) {
      setEventFormError('Please select a scheduled drop date.');
      return;
    }
    if (!eventQuantity || parseInt(eventQuantity, 10) < 0) {
      setEventFormError('Please enter a valid quantity.');
      return;
    }

    setIsEventSubmitting(true);
    try {
      const res = await apiRequest<{ message: string; event: CampaignEvent }>('/admin/events', {
        method: 'POST',
        body: JSON.stringify({
          campaignId: eventCampaignId,
          eventId,
          channel: eventChannel,
          media: eventMedia,
          scheduledDrop: eventScheduledDrop,
          finalDescription: eventFinalDescription.trim(),
          type: eventType,
          quantity: parseInt(eventQuantity, 10)
        })
      });

      setEventFormSuccess(res.message || `Event "${eventId}" successfully created in database!`);
      // Reset form fields
      setEventFinalDescription('');
      setEventScheduledDrop('');
      setEventQuantity('');
      setEventId(generateNewEventId(selectedCampaign?.campaignId));
      await loadEvents();
      await loadCampaigns();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create event in database.';
      setEventFormError(msg);
    } finally {
      setIsEventSubmitting(false);
    }
  };

  // ── Segments tab state (INS-6) ──────────────────────────────────
  const [selectedEvent, setSelectedEvent] = useState<CampaignEvent | null>(null);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [isSegmentsLoading, setIsSegmentsLoading] = useState<boolean>(false);
  const [segmentViewFilter, setSegmentViewFilter] = useState<'CURRENT' | 'ALL'>('CURRENT');
  const [customerStats, setCustomerStats] = useState<CustomerStats>({ insuredCount: 0, uninsuredCount: 0, totalCustomers: 0 });

  // Segment form fields
  const [segmentInsuranceStatus, setSegmentInsuranceStatus] = useState<'I' | 'UI'>('UI');
  const [segmentClientId, setSegmentClientId] = useState<string>('');
  const [segmentTarget, setSegmentTarget] = useState<string>('');
  const [segmentDescription, setSegmentDescription] = useState<string>('');

  // Segment feedback
  const [segmentFormSuccess, setSegmentFormSuccess] = useState<string>('');
  const [segmentFormError, setSegmentFormError] = useState<string>('');
  const [isSegmentSubmitting, setIsSegmentSubmitting] = useState<boolean>(false);
  const [segmentSearchTerm, setSegmentSearchTerm] = useState<string>('');

  // Select event for segments and jump to segments tab
  const handleSelectEventForSegments = (ev: CampaignEvent) => {
    setSelectedEvent(ev);
    setActiveTab('segments');
  };

  // Calculate live spoken key preview
  const selectedSegmentClient = clients.find(c => c.id === segmentClientId);
  const clientStateCode = (selectedSegmentClient?.state && selectedSegmentClient.state.trim()) 
    ? selectedSegmentClient.state.trim().toUpperCase() 
    : 'ALL';
  const clientBankCode = selectedSegmentClient 
    ? (selectedSegmentClient.name || selectedSegmentClient.code).replace(/[^a-zA-Z0-9]/g, '').toUpperCase() 
    : 'BANK';
  const spokenKeyPreview = `${segmentInsuranceStatus}-${clientBankCode}-${clientStateCode}`;

  // Calculate remaining target capacity for selected event
  const currentEventSegments = selectedEvent ? segments.filter(s => s.eventId === selectedEvent.id) : [];
  const currentEventAllocatedTarget = currentEventSegments.reduce((sum, s) => sum + (s.target || 0), 0);
  const currentEventCapacity = selectedEvent ? selectedEvent.quantity : 0;
  const currentEventRemainingTarget = Math.max(0, currentEventCapacity - currentEventAllocatedTarget);

  // Load customer stats
  const loadCustomerStats = async () => {
    try {
      const stats = await apiRequest<CustomerStats>('/admin/segments/customer-stats');
      setCustomerStats(stats);
    } catch (err) {
      console.error('Failed to load customer stats:', err);
    }
  };

  // Load segments
  const loadSegments = async (eventIdToLoad?: string) => {
    setIsSegmentsLoading(true);
    try {
      const targetId = eventIdToLoad !== undefined 
        ? eventIdToLoad 
        : (segmentViewFilter === 'CURRENT' && selectedEvent ? selectedEvent.id : '');
      const url = targetId ? `/admin/segments?eventId=${targetId}` : '/admin/segments';
      const data = await apiRequest<Segment[]>(url);
      setSegments(data);
    } catch (err) {
      console.error('Failed to load segments:', err);
    } finally {
      setIsSegmentsLoading(false);
    }
  };

  // Handle Segment form submit
  const handleCreateSegment = async (e: React.FormEvent) => {
    e.preventDefault();
    setSegmentFormError('');
    setSegmentFormSuccess('');

    if (!selectedEvent) {
      setSegmentFormError('Please select an event first before creating segments.');
      return;
    }
    if (!segmentClientId) {
      setSegmentFormError('Please select a Bank (Client).');
      return;
    }
    const parsedTarget = parseInt(segmentTarget, 10);
    if (isNaN(parsedTarget) || parsedTarget <= 0) {
      setSegmentFormError('Target must be a positive number greater than 0.');
      return;
    }
    if (currentEventAllocatedTarget + parsedTarget > currentEventCapacity) {
      setSegmentFormError(
        `Target (${parsedTarget.toLocaleString()}) exceeds available event capacity! Already allocated: ${currentEventAllocatedTarget.toLocaleString()}, Event quantity: ${currentEventCapacity.toLocaleString()}, Remaining: ${currentEventRemainingTarget.toLocaleString()}.`
      );
      return;
    }

    setIsSegmentSubmitting(true);
    try {
      const res = await apiRequest<{ message: string; segment: Segment }>('/admin/segments', {
        method: 'POST',
        body: JSON.stringify({
          eventId: selectedEvent.id,
          insuranceStatus: segmentInsuranceStatus,
          clientId: segmentClientId,
          target: parsedTarget,
          description: segmentDescription.trim()
        })
      });

      setSegmentFormSuccess(res.message || `Segment "${spokenKeyPreview}" created successfully!`);
      setSegmentTarget('');
      setSegmentDescription('');
      await loadSegments();
      await loadEvents();
      await loadCustomerStats();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to create segment in database.';
      setSegmentFormError(msg);
    } finally {
      setIsSegmentSubmitting(false);
    }
  };

  // ── Fetch clients from backend ──────────────────────────────────
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
    loadProducts();
    loadCampaigns();
  }, []);

  // Re-fetch data every time the active tab changes
  useEffect(() => {
    if (activeTab === 'campaigns') {
      loadProducts();
      loadCampaigns();
    } else if (activeTab === 'events') {
      loadCampaigns();
      loadEvents();
    } else if (activeTab === 'segments') {
      loadClients();
      loadEvents();
      loadSegments();
      loadCustomerStats();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

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
              {campaigns.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('events')}
            className={`inline-flex items-center space-x-2.5 px-6 py-3 rounded-2xl text-sm font-bold transition-all ${
              activeTab === 'events'
                ? 'bg-[#5A6644] text-white shadow-md shadow-[#5A6644]/25 scale-[1.01]'
                : 'bg-[#EAE2D6] text-stone-700 hover:bg-[#ded4c6] hover:text-stone-900 border border-[#D8CBB9]'
            }`}
          >
            <CalendarDays className="w-4 h-4" />
            <span>Events</span>
            {selectedCampaign ? (
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-600 text-white border border-emerald-400">
                {selectedCampaign.campaignId}
              </span>
            ) : (
              <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                activeTab === 'events' ? 'bg-white/20 text-white' : 'bg-[#D8CBB9] text-stone-700'
              }`}>
                {events.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('segments')}
            className={`inline-flex items-center space-x-2.5 px-6 py-3 rounded-2xl text-sm font-bold transition-all ${
              activeTab === 'segments'
                ? 'bg-[#5A6644] text-white shadow-md shadow-[#5A6644]/25 scale-[1.01]'
                : 'bg-[#EAE2D6] text-stone-700 hover:bg-[#ded4c6] hover:text-stone-900 border border-[#D8CBB9]'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Segment</span>
            {selectedEvent ? (
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-600 text-white border border-emerald-400">
                {selectedEvent.eventId}
              </span>
            ) : (
              <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                activeTab === 'segments' ? 'bg-white/20 text-white' : 'bg-[#D8CBB9] text-stone-700'
              }`}>
                {segments.length}
              </span>
            )}
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

            {/* Campaign feedback banners */}
            {campFormSuccess && (
              <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm rounded-2xl flex items-center justify-between shadow-sm">
                <div className="flex items-center space-x-2">
                  <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-emerald-600" />
                  <span>{campFormSuccess}</span>
                </div>
                <button onClick={() => setCampFormSuccess('')} className="text-emerald-700 hover:text-emerald-900 p-1">
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {campFormError && (
              <div className="p-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-2xl flex items-center justify-between shadow-sm">
                <div className="flex items-center space-x-2">
                  <AlertCircle className="w-5 h-5 flex-shrink-0 text-red-500" />
                  <span>{campFormError}</span>
                </div>
                <button onClick={() => setCampFormError('')} className="text-red-700 hover:text-red-900 p-1">
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Create Campaign Form */}
            <div className="bg-[#EAE2D6] rounded-3xl p-6 sm:p-8 border border-[#D8CBB9] shadow-md">
              <div className="flex items-center space-x-2 text-[#5A6644] text-xs font-bold uppercase tracking-wider mb-1">
                <Megaphone className="w-4 h-4" />
                <span>New Campaign</span>
              </div>
              <h2 className="text-2xl font-bold text-[#2E3523]">Create Campaign</h2>
              <p className="text-xs text-stone-600 mt-0.5 mb-6">
                Fill out the details below to register a marketing campaign linked to a partner client and product.
              </p>

              <form onSubmit={handleCreateCampaign} className="space-y-5">
                {/* Row 1: Client + Product */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {/* Client Dropdown */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-1.5">
                      Client <span className="text-red-500">*</span>
                    </label>
                    <select
                      required
                      value={campClient}
                      onChange={(e) => setCampClient(e.target.value)}
                      className="block w-full px-3 py-2.5 bg-white border border-[#D8CBB9] rounded-xl text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#8B9A6E] text-sm font-medium"
                    >
                      <option value="">— Select Partner Client —</option>
                      {clients.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} ({c.clientId})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Product Dropdown */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-bold uppercase tracking-wider text-stone-700">
                        Product <span className="text-red-500">*</span>
                      </label>
                      <button
                        type="button"
                        onClick={loadProducts}
                        disabled={isProductsLoading}
                        title="Reload products from database"
                        className="text-[11px] font-bold text-[#5A6644] hover:underline flex items-center space-x-1"
                      >
                        <RefreshCw className={`w-3 h-3 ${isProductsLoading ? 'animate-spin' : ''}`} />
                        <span>{isProductsLoading ? 'Fetching...' : 'Reload'}</span>
                      </button>
                    </div>
                    <select
                      required
                      value={campProduct}
                      onChange={(e) => setCampProduct(e.target.value)}
                      onClick={() => {
                        if (products.length === 0) {
                          loadProducts();
                        }
                      }}
                      onFocus={() => {
                        if (products.length === 0) {
                          loadProducts();
                        }
                      }}
                      onMouseDown={() => {
                        if (products.length === 0) {
                          loadProducts();
                        }
                      }}
                      className="block w-full px-3 py-2.5 bg-white border border-[#D8CBB9] rounded-xl text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#8B9A6E] text-sm font-medium"
                    >
                      <option value="">
                        {isProductsLoading
                          ? 'Loading products from database...'
                          : products.length === 0
                            ? '— Click to load products —'
                            : '— Select Product —'}
                      </option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} [{p.code}] {p.status ? `• ${p.status}` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Row 2: Start Month + End Month */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-1.5">
                      Start Month <span className="text-red-500">*</span>
                    </label>
                    <div className="relative rounded-xl shadow-sm">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-stone-400">
                        <Calendar className="h-4 w-4" />
                      </div>
                      <input
                        type="month"
                        required
                        value={campStartMonth}
                        onChange={(e) => setCampStartMonth(e.target.value)}
                        className="block w-full pl-10 pr-3 py-2.5 bg-white border border-[#D8CBB9] rounded-xl text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#8B9A6E] text-sm"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-1.5">
                      End Month <span className="text-red-500">*</span>
                    </label>
                    <div className="relative rounded-xl shadow-sm">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-stone-400">
                        <Calendar className="h-4 w-4" />
                      </div>
                      <input
                        type="month"
                        required
                        value={campEndMonth}
                        min={campStartMonth || undefined}
                        onChange={(e) => setCampEndMonth(e.target.value)}
                        className="block w-full pl-10 pr-3 py-2.5 bg-white border border-[#D8CBB9] rounded-xl text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#8B9A6E] text-sm"
                      />
                    </div>
                  </div>
                </div>

                {/* Row 3: Campaign ID (auto) + Status */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {/* Auto-generated Campaign ID */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-1.5">
                      Campaign ID <span className="text-stone-400 font-normal lowercase">(auto-generated)</span>
                    </label>
                    <div className="relative rounded-xl shadow-sm">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-stone-400">
                        <Hash className="h-4 w-4" />
                      </div>
                      <input
                        type="text"
                        readOnly
                        value={generatedCampaignId || '— select client & start month —'}
                        className="block w-full pl-10 pr-3 py-2.5 bg-stone-100 border border-[#D8CBB9] rounded-xl text-stone-700 font-mono text-sm cursor-not-allowed font-semibold"
                      />
                    </div>
                    {generatedCampaignId && (
                      <p className="text-[11px] text-[#5A6644] mt-1 font-medium">
                        Format: {'{Client}-Q{Quarter}-{Year}'}
                      </p>
                    )}
                  </div>

                  {/* Status */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-1.5">
                      Status
                    </label>
                    <select
                      value={campStatus}
                      onChange={(e) => setCampStatus(e.target.value)}
                      className="block w-full px-3 py-2.5 bg-white border border-[#D8CBB9] rounded-xl text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#8B9A6E] text-sm font-medium"
                    >
                      <option value="PLANNED">PLANNED</option>
                      <option value="ACTIVE">ACTIVE</option>
                      <option value="INACTIVE">INACTIVE</option>
                    </select>
                  </div>
                </div>

                {/* Description */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-1.5">
                    Description
                  </label>
                  <textarea
                    rows={3}
                    value={campDescription}
                    onChange={(e) => setCampDescription(e.target.value)}
                    placeholder="Optional — brief notes about this campaign's goals, audience, or scope."
                    className="block w-full px-3 py-2.5 bg-white border border-[#D8CBB9] rounded-xl text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-[#8B9A6E] text-sm resize-none"
                  />
                </div>

                {/* Submit */}
                <div className="pt-2 flex justify-end">
                  <button
                    type="submit"
                    disabled={isCampSubmitting}
                    className="w-full sm:w-auto inline-flex justify-center items-center space-x-2 py-3 px-6 border border-transparent rounded-xl shadow-md text-sm font-bold text-white bg-[#5A6644] hover:bg-[#495436] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#5A6644] transition hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
                  >
                    <Megaphone className="w-4 h-4" />
                    <span>{isCampSubmitting ? 'Creating Campaign...' : 'Create Campaign'}</span>
                  </button>
                </div>
              </form>
            </div>

            {/* Campaign Directory Table */}
            <div className="bg-[#EAE2D6] rounded-3xl p-6 sm:p-8 border border-[#D8CBB9] shadow-md">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                <div>
                  <h3 className="text-xl font-bold text-[#2E3523]">Campaign Directory</h3>
                  <p className="text-xs text-stone-600 mt-0.5">
                    All marketing campaigns stored in PostgreSQL — linked to partner clients and products.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
                  <div className="relative flex-1 sm:w-60">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-stone-400" />
                    <input
                      type="text"
                      placeholder="Search campaigns..."
                      value={campSearchTerm}
                      onChange={(e) => setCampSearchTerm(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 bg-white border border-[#D8CBB9] rounded-xl text-xs text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-[#8B9A6E]"
                    />
                  </div>
                  <button
                    onClick={loadCampaigns}
                    disabled={isCampaignsLoading}
                    title="Refresh Campaigns"
                    className="p-2 bg-white border border-[#D8CBB9] rounded-xl text-stone-600 hover:text-[#5A6644] hover:bg-stone-50 transition"
                  >
                    <RefreshCw className={`w-4 h-4 ${isCampaignsLoading ? 'animate-spin' : ''}`} />
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-[#D8CBB9] text-[11px] font-bold uppercase tracking-wider text-stone-600">
                      <th className="py-3 px-4">Campaign ID</th>
                      <th className="py-3 px-4">Client</th>
                      <th className="py-3 px-4">Product</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Start Month</th>
                      <th className="py-3 px-4">End Month</th>
                      <th className="py-3 px-4">Description</th>
                      <th className="py-3 px-4">Created On</th>
                      <th className="py-3 px-4 text-center">Events</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#D8CBB9]/60 text-xs text-stone-800">
                    {isCampaignsLoading ? (
                      <tr>
                        <td colSpan={10} className="py-8 text-center text-stone-500">
                          <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-[#5A6644]" />
                          Loading campaigns from PostgreSQL database...
                        </td>
                      </tr>
                    ) : campaigns.filter(c =>
                        c.campaignId.toLowerCase().includes(campSearchTerm.toLowerCase()) ||
                        c.clientName.toLowerCase().includes(campSearchTerm.toLowerCase()) ||
                        c.productName.toLowerCase().includes(campSearchTerm.toLowerCase()) ||
                        (c.description || '').toLowerCase().includes(campSearchTerm.toLowerCase())
                      ).length === 0 ? (
                      <tr>
                        <td colSpan={10} className="py-8 text-center text-stone-500">
                          {campSearchTerm ? 'No campaigns match your search.' : 'No campaigns yet. Create one above!'}
                        </td>
                      </tr>
                    ) : (
                      campaigns
                        .filter(c =>
                          c.campaignId.toLowerCase().includes(campSearchTerm.toLowerCase()) ||
                          c.clientName.toLowerCase().includes(campSearchTerm.toLowerCase()) ||
                          c.productName.toLowerCase().includes(campSearchTerm.toLowerCase()) ||
                          (c.description || '').toLowerCase().includes(campSearchTerm.toLowerCase())
                        )
                        .map((camp) => {
                          const statusColors: Record<string, string> = {
                            ACTIVE: 'bg-emerald-100 text-emerald-800 border border-emerald-300',
                            INACTIVE: 'bg-stone-200 text-stone-700 border border-stone-300',
                            PLANNED: 'bg-blue-100 text-blue-800 border border-blue-300',
                          };
                          const statusClass = statusColors[camp.status] || 'bg-stone-100 text-stone-600 border border-stone-200';
                          const fmtMonth = (d: string) => {
                            if (!d) return '—';
                            const dt = new Date(d);
                            return dt.toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
                          };
                          const isSelected = selectedCampaign?.id === camp.id;
                          return (
                            <tr key={camp.id} className={`hover:bg-white/40 transition ${isSelected ? 'bg-[#8B9A6E]/15 border-l-4 border-l-[#5A6644]' : ''}`}>
                              <td className="py-3.5 px-4 font-mono font-bold text-stone-700">
                                <span className="bg-white/80 border border-[#D8CBB9] px-2 py-0.5 rounded-md">
                                  {camp.campaignId}
                                </span>
                              </td>
                              <td className="py-3.5 px-4 font-bold text-[#2E3523]">{camp.clientName}</td>
                              <td className="py-3.5 px-4">
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#8B9A6E]/15 text-[#3D472E]">
                                  {camp.productName}
                                </span>
                              </td>
                              <td className="py-3.5 px-4">
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold ${statusClass}`}>
                                  {camp.status}
                                </span>
                              </td>
                              <td className="py-3.5 px-4 text-stone-600">{fmtMonth(camp.startDate)}</td>
                              <td className="py-3.5 px-4 text-stone-600">{fmtMonth(camp.endDate)}</td>
                              <td className="py-3.5 px-4 text-stone-500 max-w-xs truncate" title={camp.description}>
                                {camp.description || '—'}
                              </td>
                              <td className="py-3.5 px-4 text-stone-500 text-[11px]">
                                {camp.createdAt ? new Date(camp.createdAt).toLocaleDateString() : '—'}
                              </td>
                              <td className="py-3.5 px-4 text-center">
                                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${
                                  (camp.eventsCount ?? 0) > 0
                                    ? 'bg-blue-100 text-blue-800 border border-blue-300'
                                    : 'bg-stone-100 text-stone-500 border border-stone-200'
                                }`}>
                                  {camp.eventsCount ?? 0} {(camp.eventsCount ?? 0) === 1 ? 'event' : 'events'}
                                </span>
                              </td>
                              <td className="py-3.5 px-4 text-right">
                                <button
                                  type="button"
                                  onClick={() => handleSelectCampaignForEvents(camp)}
                                  className={`inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition shadow-sm ${
                                    isSelected
                                      ? 'bg-emerald-700 hover:bg-emerald-800 text-white'
                                      : 'bg-[#5A6644] hover:bg-[#495436] text-white'
                                  }`}
                                  title="Select this campaign to create or view its events"
                                >
                                  <CalendarDays className="w-3.5 h-3.5" />
                                  <span>{isSelected ? 'Active (Events)' : 'Manage Events'}</span>
                                  <ArrowRight className="w-3 h-3" />
                                </button>
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

        {/* TAB 3: EVENTS */}
        {activeTab === 'events' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            {/* Active Campaign Context Banner */}
            <div className={`rounded-3xl p-6 sm:p-7 border shadow-md transition-all ${
              selectedCampaign 
                ? 'bg-gradient-to-r from-[#5A6644] to-[#454f34] text-white border-[#5A6644]'
                : 'bg-[#EAE2D6] border-[#D8CBB9] text-stone-800'
            }`}>
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2 text-xs font-bold uppercase tracking-wider">
                    <CalendarDays className="w-4 h-4" />
                    <span className={selectedCampaign ? 'text-[#D8E2C8]' : 'text-[#5A6644]'}>
                      {selectedCampaign ? 'Target Campaign for Events' : 'No Campaign Selected Yet'}
                    </span>
                  </div>

                  {selectedCampaign ? (
                    <div>
                      <h2 className="text-2xl font-extrabold tracking-tight">
                        {selectedCampaign.campaignId} <span className="text-sm font-normal text-[#E2EBD3]">({selectedCampaign.name})</span>
                      </h2>
                      <div className="flex flex-wrap items-center gap-3 mt-1.5 text-xs text-[#E2EBD3]">
                        <span>Client: <strong className="text-white">{selectedCampaign.clientName}</strong></span>
                        <span>•</span>
                        <span>Product: <strong className="text-white">{selectedCampaign.productName}</strong></span>
                        <span>•</span>
                        <span>Status: <strong className="text-white">{selectedCampaign.status}</strong></span>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <h2 className="text-xl font-bold text-[#2E3523]">
                        Select a Campaign to Start Creating Events
                      </h2>
                      <p className="text-xs text-stone-600 mt-1 max-w-xl">
                        Events are organized under a parent campaign. Select one using the dropdown below or pick one from the Campaign tab.
                      </p>
                    </div>
                  )}
                </div>

                {/* Quick Campaign Switcher / Selector */}
                <div className="flex items-center space-x-2.5 w-full md:w-auto">
                  <div className="bg-white/95 rounded-2xl p-1.5 border border-[#D8CBB9] shadow-sm flex items-center space-x-2 text-stone-800 w-full sm:w-auto">
                    <span className="text-xs font-bold text-stone-600 pl-2 hidden sm:inline">Campaign:</span>
                    <select
                      value={eventCampaignId}
                      onChange={(e) => {
                        const campId = e.target.value;
                        setEventCampaignId(campId);
                        const found = campaigns.find(c => c.id === campId) || null;
                        setSelectedCampaign(found);
                        if (found) {
                          setEventId(generateNewEventId(found.campaignId));
                          loadEvents(found.id);
                        } else {
                          loadEvents();
                        }
                      }}
                      className="bg-transparent text-xs font-bold text-[#2E3523] px-2 py-1.5 focus:outline-none cursor-pointer"
                    >
                      <option value="">— Select Target Campaign —</option>
                      {campaigns.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.campaignId} ({c.clientName} - {c.productName})
                        </option>
                      ))}
                    </select>
                  </div>

                  <button
                    onClick={() => setActiveTab('campaigns')}
                    className={`px-3.5 py-2.5 rounded-2xl text-xs font-bold transition shadow-sm whitespace-nowrap flex items-center space-x-1 ${
                      selectedCampaign 
                        ? 'bg-white/20 hover:bg-white/30 text-white border border-white/30' 
                        : 'bg-[#5A6644] hover:bg-[#495436] text-white'
                    }`}
                  >
                    <span>View Campaigns</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Event Form Feedback Banners */}
            {eventFormSuccess && (
              <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm rounded-2xl flex items-center justify-between shadow-sm">
                <div className="flex items-center space-x-2">
                  <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-emerald-600" />
                  <span>{eventFormSuccess}</span>
                </div>
                <button onClick={() => setEventFormSuccess('')} className="text-emerald-700 hover:text-emerald-900 p-1">
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {eventFormError && (
              <div className="p-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-2xl flex items-center justify-between shadow-sm">
                <div className="flex items-center space-x-2">
                  <AlertCircle className="w-5 h-5 flex-shrink-0 text-red-500" />
                  <span>{eventFormError}</span>
                </div>
                <button onClick={() => setEventFormError('')} className="text-red-700 hover:text-red-900 p-1">
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Create Campaign Event Form */}
            <div className="bg-[#EAE2D6] rounded-3xl p-6 sm:p-8 border border-[#D8CBB9] shadow-md">
              <div className="flex items-center space-x-2 text-[#5A6644] text-xs font-bold uppercase tracking-wider mb-1">
                <CalendarDays className="w-4 h-4" />
                <span>Event Registration</span>
              </div>
              <h2 className="text-2xl font-bold text-[#2E3523]">Register Campaign Event</h2>
              <p className="text-xs text-stone-600 mt-0.5 mb-6">
                Fill in the event channel, media delivery, drop date, type, and volume under{' '}
                <strong className="text-[#2E3523]">{selectedCampaign ? selectedCampaign.campaignId : 'the selected campaign'}</strong>.
              </p>

              <form onSubmit={handleCreateEvent} className="space-y-5">
                {/* Row 1: Target Campaign + Event ID */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {/* Campaign Dropdown */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-1.5">
                      Parent Campaign <span className="text-red-500">*</span>
                    </label>
                    <select
                      required
                      value={eventCampaignId}
                      onChange={(e) => {
                        const campId = e.target.value;
                        setEventCampaignId(campId);
                        const found = campaigns.find(c => c.id === campId) || null;
                        setSelectedCampaign(found);
                        if (found) {
                          setEventId(generateNewEventId(found.campaignId));
                        }
                      }}
                      className="block w-full px-3 py-2.5 bg-white border border-[#D8CBB9] rounded-xl text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#8B9A6E] text-sm font-medium"
                    >
                      <option value="">— Select Campaign —</option>
                      {campaigns.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.campaignId} — {c.clientName} [{c.productName}]
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Event ID (Auto Generated) */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-bold uppercase tracking-wider text-stone-700">
                        Event ID <span className="text-stone-400 font-normal lowercase">(auto generated)</span>
                      </label>
                      <button
                        type="button"
                        onClick={() => setEventId(generateNewEventId(selectedCampaign?.campaignId))}
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
                        value={eventId}
                        className="block w-full pl-10 pr-3 py-2.5 bg-stone-100 border border-[#D8CBB9] rounded-xl text-stone-700 font-mono text-sm cursor-not-allowed font-semibold"
                      />
                    </div>
                  </div>
                </div>

                {/* Row 2: Channel + Media */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {/* Channel Dropdown */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-1.5">
                      Channel <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={eventChannel}
                      onChange={(e) => setEventChannel(e.target.value)}
                      className="block w-full px-3 py-2.5 bg-white border border-[#D8CBB9] rounded-xl text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#8B9A6E] text-sm font-medium"
                    >
                      <option value="Telemarketting">Telemarketting</option>
                      <option value="Banner">Banner</option>
                      <option value="Collection">Collection</option>
                      <option value="Letter">Letter</option>
                      <option value="NewsLetter">NewsLetter</option>
                    </select>
                  </div>

                  {/* Media Dropdown */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-1.5">
                      Media <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={eventMedia}
                      onChange={(e) => setEventMedia(e.target.value)}
                      className="block w-full px-3 py-2.5 bg-white border border-[#D8CBB9] rounded-xl text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#8B9A6E] text-sm font-medium"
                    >
                      <option value="mail">mail</option>
                      <option value="direct mail">direct mail</option>
                    </select>
                  </div>
                </div>

                {/* Row 3: Scheduled Drop Date + Type + Quantity */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                  {/* Scheduled Drop Date */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-1.5">
                      Scheduled Drop <span className="text-red-500">*</span>
                    </label>
                    <div className="relative rounded-xl shadow-sm">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-stone-400">
                        <Calendar className="h-4 w-4" />
                      </div>
                      <input
                        type="date"
                        required
                        value={eventScheduledDrop}
                        onChange={(e) => setEventScheduledDrop(e.target.value)}
                        className="block w-full pl-10 pr-3 py-2.5 bg-white border border-[#D8CBB9] rounded-xl text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#8B9A6E] text-sm"
                      />
                    </div>
                  </div>

                  {/* Type Dropdown */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-1.5">
                      Type <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={eventType}
                      onChange={(e) => setEventType(e.target.value)}
                      className="block w-full px-3 py-2.5 bg-white border border-[#D8CBB9] rounded-xl text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#8B9A6E] text-sm font-medium"
                    >
                      <option value="mailing">mailing</option>
                      <option value="Remailing">Remailing</option>
                      <option value="follow up mail">follow up mail</option>
                      <option value="BSM(benefit statement mailing)">BSM(benefit statement mailing)</option>
                    </select>
                  </div>

                  {/* Quantity */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-1.5">
                      Quantity <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      required
                      min="0"
                      placeholder="e.g. 10000"
                      value={eventQuantity}
                      onChange={(e) => setEventQuantity(e.target.value)}
                      className="block w-full px-3 py-2.5 bg-white border border-[#D8CBB9] rounded-xl text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#8B9A6E] text-sm font-medium"
                    />
                  </div>
                </div>

                {/* Final Description */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-1.5">
                    Final Description
                  </label>
                  <textarea
                    rows={3}
                    value={eventFinalDescription}
                    onChange={(e) => setEventFinalDescription(e.target.value)}
                    placeholder="Enter final event description, delivery instructions, creative versions, or target audience details..."
                    className="block w-full px-3 py-2.5 bg-white border border-[#D8CBB9] rounded-xl text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-[#8B9A6E] text-sm resize-none"
                  />
                </div>

                {/* Submit */}
                <div className="pt-2 flex justify-end">
                  <button
                    type="submit"
                    disabled={isEventSubmitting}
                    className="w-full sm:w-auto inline-flex justify-center items-center space-x-2 py-3 px-6 border border-transparent rounded-xl shadow-md text-sm font-bold text-white bg-[#5A6644] hover:bg-[#495436] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#5A6644] transition hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
                  >
                    <Send className="w-4 h-4" />
                    <span>{isEventSubmitting ? 'Registering Event...' : 'Create Campaign Event'}</span>
                  </button>
                </div>
              </form>
            </div>

            {/* Campaign Events Directory Table */}
            <div className="bg-[#EAE2D6] rounded-3xl p-6 sm:p-8 border border-[#D8CBB9] shadow-md">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                <div>
                  <h3 className="text-xl font-bold text-[#2E3523]">Campaign Events Directory</h3>
                  <p className="text-xs text-stone-600 mt-0.5">
                    {selectedCampaign 
                      ? `Events under campaign "${selectedCampaign.campaignId}" (${selectedCampaign.clientName}).`
                      : 'All marketing drop and communication events registered across campaigns in PostgreSQL.'}
                  </p>
                </div>

                {/* Filters, Search, Refresh */}
                <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
                  {selectedCampaign && (
                    <select
                      value={eventViewFilter}
                      onChange={(e) => {
                        const val = e.target.value as 'CURRENT' | 'ALL';
                        setEventViewFilter(val);
                        if (val === 'CURRENT') {
                          loadEvents(selectedCampaign.id);
                        } else {
                          loadEvents('');
                        }
                      }}
                      className="bg-white border border-[#D8CBB9] rounded-xl px-3 py-2 text-xs text-stone-800 font-medium focus:outline-none focus:ring-2 focus:ring-[#8B9A6E]"
                    >
                      <option value="CURRENT">This Campaign Only ({selectedCampaign.campaignId})</option>
                      <option value="ALL">All Campaigns</option>
                    </select>
                  )}

                  <div className="relative flex-1 sm:w-56">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-stone-400" />
                    <input
                      type="text"
                      placeholder="Search events, channels, types..."
                      value={eventSearchTerm}
                      onChange={(e) => setEventSearchTerm(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 bg-white border border-[#D8CBB9] rounded-xl text-xs text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-[#8B9A6E]"
                    />
                  </div>

                  <button
                    onClick={() => loadEvents()}
                    disabled={isEventsLoading}
                    title="Refresh Events"
                    className="p-2 bg-white border border-[#D8CBB9] rounded-xl text-stone-600 hover:text-[#5A6644] hover:bg-stone-50 transition"
                  >
                    <RefreshCw className={`w-4 h-4 ${isEventsLoading ? 'animate-spin' : ''}`} />
                  </button>
                </div>
              </div>

              {/* Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-[#D8CBB9] text-[11px] font-bold uppercase tracking-wider text-stone-600">
                      <th className="py-3 px-4">Event ID</th>
                      <th className="py-3 px-4">Parent Campaign</th>
                      <th className="py-3 px-4">Channel</th>
                      <th className="py-3 px-4">Media</th>
                      <th className="py-3 px-4">Type</th>
                      <th className="py-3 px-4">Scheduled Drop</th>
                      <th className="py-3 px-4">Quantity</th>
                      <th className="py-3 px-4">Final Description</th>
                      <th className="py-3 px-4">Created On</th>
                      <th className="py-3 px-4 text-center">Segments</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#D8CBB9]/60 text-xs text-stone-800">
                    {isEventsLoading ? (
                      <tr>
                        <td colSpan={11} className="py-8 text-center text-stone-500">
                          <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-[#5A6644]" />
                          Loading campaign events from PostgreSQL database...
                        </td>
                      </tr>
                    ) : events.filter(ev =>
                        ev.eventId.toLowerCase().includes(eventSearchTerm.toLowerCase()) ||
                        (ev.campaignCode || '').toLowerCase().includes(eventSearchTerm.toLowerCase()) ||
                        ev.channel.toLowerCase().includes(eventSearchTerm.toLowerCase()) ||
                        ev.media.toLowerCase().includes(eventSearchTerm.toLowerCase()) ||
                        ev.eventType.toLowerCase().includes(eventSearchTerm.toLowerCase()) ||
                        (ev.finalDescription || '').toLowerCase().includes(eventSearchTerm.toLowerCase())
                      ).length === 0 ? (
                      <tr>
                        <td colSpan={11} className="py-8 text-center text-stone-500">
                          {eventSearchTerm 
                            ? 'No events match your search.' 
                            : selectedCampaign
                              ? `No events registered under "${selectedCampaign.campaignId}" yet. Use the form above to add one!`
                              : 'No events registered yet. Select a campaign and create one above!'}
                        </td>
                      </tr>
                    ) : (
                      events
                        .filter(ev =>
                          ev.eventId.toLowerCase().includes(eventSearchTerm.toLowerCase()) ||
                          (ev.campaignCode || '').toLowerCase().includes(eventSearchTerm.toLowerCase()) ||
                          ev.channel.toLowerCase().includes(eventSearchTerm.toLowerCase()) ||
                          ev.media.toLowerCase().includes(eventSearchTerm.toLowerCase()) ||
                          ev.eventType.toLowerCase().includes(eventSearchTerm.toLowerCase()) ||
                          (ev.finalDescription || '').toLowerCase().includes(eventSearchTerm.toLowerCase())
                        )
                        .map((ev) => (
                          <tr key={ev.id} className="hover:bg-white/40 transition">
                            <td className="py-3.5 px-4 font-mono font-bold text-stone-700">
                              <span className="bg-white/80 border border-[#D8CBB9] px-2 py-0.5 rounded-md">
                                {ev.eventId}
                              </span>
                            </td>
                            <td className="py-3.5 px-4 font-bold text-[#2E3523]">
                              <div className="flex flex-col">
                                <span>{ev.campaignCode || '—'}</span>
                                {ev.clientName && (
                                  <span className="text-[11px] font-normal text-stone-500">
                                    {ev.clientName}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="py-3.5 px-4">
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#8B9A6E]/15 text-[#3D472E]">
                                {ev.channel}
                              </span>
                            </td>
                            <td className="py-3.5 px-4">
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-stone-200 text-stone-700">
                                {ev.media}
                              </span>
                            </td>
                            <td className="py-3.5 px-4 font-medium text-stone-800">
                              <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-blue-50 text-blue-800 border border-blue-200">
                                {ev.eventType}
                              </span>
                            </td>
                            <td className="py-3.5 px-4 font-mono text-stone-700">
                              {ev.scheduledDrop ? new Date(ev.scheduledDrop).toLocaleDateString() : '—'}
                            </td>
                            <td className="py-3.5 px-4 font-bold text-stone-800">
                              {ev.quantity ? ev.quantity.toLocaleString() : '0'}
                            </td>
                            <td className="py-3.5 px-4 text-stone-500 max-w-xs truncate" title={ev.finalDescription}>
                              {ev.finalDescription || '—'}
                            </td>
                            <td className="py-3.5 px-4 text-stone-500 text-[11px]">
                              {ev.createdAt ? new Date(ev.createdAt).toLocaleDateString() : '—'}
                            </td>
                            <td className="py-3.5 px-4 text-center">
                              <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${
                                (ev.segmentsCount ?? 0) > 0
                                  ? 'bg-blue-100 text-blue-800 border border-blue-300'
                                  : 'bg-stone-100 text-stone-500 border border-stone-200'
                              }`}>
                                {ev.segmentsCount ?? 0} {(ev.segmentsCount ?? 0) === 1 ? 'segment' : 'segments'}
                              </span>
                            </td>
                            <td className="py-3.5 px-4 text-right">
                              <button
                                type="button"
                                onClick={() => handleSelectEventForSegments(ev)}
                                className={`inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition shadow-sm ${
                                  selectedEvent?.id === ev.id
                                    ? 'bg-emerald-700 hover:bg-emerald-800 text-white'
                                    : 'bg-[#5A6644] hover:bg-[#495436] text-white'
                                }`}
                                title="Select this event to manage its segments"
                              >
                                <Layers className="w-3.5 h-3.5" />
                                <span>{selectedEvent?.id === ev.id ? 'Active (Segment)' : 'Manage Segments'}</span>
                                <ArrowRight className="w-3 h-3" />
                              </button>
                            </td>
                          </tr>
                        ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: SEGMENT (INS-6) */}
        {activeTab === 'segments' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            {/* Active Event Context Banner */}
            <div className={`rounded-3xl p-6 sm:p-7 border shadow-md transition-all ${
              selectedEvent 
                ? 'bg-gradient-to-r from-[#5A6644] to-[#454f34] text-white border-[#5A6644]'
                : 'bg-[#EAE2D6] border-[#D8CBB9] text-stone-800'
            }`}>
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full ${
                      selectedEvent ? 'bg-emerald-500/20 text-emerald-200 border border-emerald-400/40' : 'bg-stone-300 text-stone-700'
                    }`}>
                      {selectedEvent ? 'Active Parent Event' : 'No Event Selected'}
                    </span>
                    {selectedEvent && (
                      <span className="text-xs font-mono font-bold text-white bg-white/20 px-2 py-0.5 rounded-md">
                        {selectedEvent.eventId}
                      </span>
                    )}
                  </div>
                  <h2 className="text-xl sm:text-2xl font-black tracking-tight">
                    {selectedEvent ? (
                      <>Segments for Event: <span className="underline decoration-[#8B9A6E]">{selectedEvent.eventId}</span></>
                    ) : (
                      'Please Select an Event to Manage Segments'
                    )}
                  </h2>
                  <p className={`text-xs max-w-2xl ${selectedEvent ? 'text-[#D8E2C8]' : 'text-stone-600'}`}>
                    {selectedEvent 
                      ? `Parent Campaign: ${selectedEvent.campaignCode || selectedEvent.campaignName || '—'} • Channel: ${selectedEvent.channel} • Media: ${selectedEvent.media} • Total Event Quantity: ${selectedEvent.quantity.toLocaleString()}`
                      : 'Each event can have multiple targeted segments. Go to the Events tab and click "Manage Segments" or select an event below to allocate audience targets.'
                    }
                  </p>
                </div>

                {selectedEvent && (
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="bg-white/10 backdrop-blur-md px-4 py-2 rounded-2xl border border-white/20 text-right">
                      <p className="text-[10px] uppercase font-bold text-[#D8E2C8]">Capacity Allocated</p>
                      <p className="text-sm font-extrabold text-white">
                        {currentEventAllocatedTarget.toLocaleString()} / {currentEventCapacity.toLocaleString()}
                        <span className="text-xs font-normal text-emerald-300 ml-1.5">
                          ({currentEventCapacity > 0 ? Math.round((currentEventAllocatedTarget / currentEventCapacity) * 100) : 0}%)
                        </span>
                      </p>
                      <p className="text-[10px] text-stone-200">
                        Remaining: <span className="font-bold text-emerald-300">{currentEventRemainingTarget.toLocaleString()}</span>
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveTab('events')}
                      className="px-3 py-2 bg-white/20 hover:bg-white/30 text-white rounded-xl text-xs font-bold transition flex items-center space-x-1"
                    >
                      <span>Switch Event</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Customer Stats Cards Banner (Insured vs Uninsured) */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-[#EAE2D6] p-4 rounded-2xl border border-[#D8CBB9] shadow-sm flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-stone-600">Total Enrolled / Insured (I)</p>
                  <p className="text-xl font-black text-emerald-700 mt-1">{customerStats.insuredCount.toLocaleString()}</p>
                  <p className="text-[10px] text-stone-500 mt-0.5">Customers enrolled in policies</p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-emerald-100 border border-emerald-300 flex items-center justify-center text-emerald-700">
                  <ShieldCheck className="w-5 h-5" />
                </div>
              </div>

              <div className="bg-[#EAE2D6] p-4 rounded-2xl border border-[#D8CBB9] shadow-sm flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-stone-600">Uninsured Users (UI)</p>
                  <p className="text-xl font-black text-amber-700 mt-1">{customerStats.uninsuredCount.toLocaleString()}</p>
                  <p className="text-[10px] text-stone-500 mt-0.5">Logged-in users without policy</p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-amber-100 border border-amber-300 flex items-center justify-center text-amber-700">
                  <Users className="w-5 h-5" />
                </div>
              </div>

              <div className="bg-[#EAE2D6] p-4 rounded-2xl border border-[#D8CBB9] shadow-sm flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-stone-600">Total Customers</p>
                  <p className="text-xl font-black text-[#2E3523] mt-1">{customerStats.totalCustomers.toLocaleString()}</p>
                  <p className="text-[10px] text-stone-500 mt-0.5">All customer accounts in system</p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-[#8B9A6E]/20 border border-[#8B9A6E]/40 flex items-center justify-center text-[#5A6644]">
                  <Target className="w-5 h-5" />
                </div>
              </div>
            </div>

            {/* Segment Creation Card */}
            <div className="bg-[#EAE2D6] border border-[#D8CBB9] rounded-3xl p-6 sm:p-8 shadow-sm">
              <div className="flex items-center justify-between pb-5 border-b border-[#D8CBB9]/80 mb-6">
                <div>
                  <h3 className="text-lg font-bold text-[#2E3523] flex items-center space-x-2">
                    <PlusCircle className="w-5 h-5 text-[#5A6644]" />
                    <span>Create Segment for Event</span>
                  </h3>
                  <p className="text-xs text-stone-600 mt-0.5">
                    Define targeted audience segments with insurance status, bank, and state. The target sum must not exceed event quantity.
                  </p>
                </div>
                {selectedEvent && (
                  <span className="hidden sm:inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-[#8B9A6E]/20 text-[#3D472E] border border-[#8B9A6E]/40 font-mono">
                    Event: {selectedEvent.eventId}
                  </span>
                )}
              </div>

              {/* Feedback Alerts */}
              {segmentFormError && (
                <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 text-xs rounded-2xl flex items-center space-x-2.5">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-500" />
                  <span>{segmentFormError}</span>
                </div>
              )}
              {segmentFormSuccess && (
                <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-2xl flex items-center space-x-2.5">
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-600" />
                  <span>{segmentFormSuccess}</span>
                </div>
              )}

              {/* Segment Creation Form */}
              <form onSubmit={handleCreateSegment} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {/* Parent Event (Dropdown or locked) */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-1.5">
                      Parent Event <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={selectedEvent?.id || ''}
                      onChange={(e) => {
                        const found = events.find(ev => ev.id === e.target.value);
                        setSelectedEvent(found || null);
                      }}
                      className="w-full px-3.5 py-2.5 bg-white border border-[#D8CBB9] rounded-xl text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#8B9A6E] font-medium"
                    >
                      <option value="">-- Choose Campaign Event --</option>
                      {events.map((ev) => (
                        <option key={ev.id} value={ev.id}>
                          {ev.eventId} ({ev.campaignCode || 'No Campaign'} • {ev.channel} • Qty: {ev.quantity.toLocaleString()})
                        </option>
                      ))}
                    </select>
                    <p className="text-[10px] text-stone-500 mt-1">
                      {selectedEvent 
                        ? `Available capacity: ${currentEventRemainingTarget.toLocaleString()} of ${currentEventCapacity.toLocaleString()}`
                        : 'Select an event to attach segments to.'}
                    </p>
                  </div>

                  {/* Insurance Status (Dropdown I vs UI) */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-1.5">
                      Insurance Status <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={segmentInsuranceStatus}
                      onChange={(e) => setSegmentInsuranceStatus(e.target.value as 'I' | 'UI')}
                      className="w-full px-3.5 py-2.5 bg-white border border-[#D8CBB9] rounded-xl text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#8B9A6E] font-medium"
                    >
                      <option value="UI">UI - Uninsured (Logged-in users without policy)</option>
                      <option value="I">I - Insured (Users enrolled in insurance policy)</option>
                    </select>
                    <p className="text-[10px] text-stone-500 mt-1">
                      {segmentInsuranceStatus === 'I' 
                        ? `Enrolled customers currently in database: ${customerStats.insuredCount}`
                        : `Uninsured customer accounts in database: ${customerStats.uninsuredCount}`}
                    </p>
                  </div>

                  {/* Bank (Client dropdown) */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-1.5">
                      Bank (Client) <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={segmentClientId}
                      onChange={(e) => setSegmentClientId(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-white border border-[#D8CBB9] rounded-xl text-xs text-stone-900 focus:outline-none focus:ring-2 focus:ring-[#8B9A6E] font-medium"
                      required
                    >
                      <option value="">-- Select Partner Bank --</option>
                      {clients.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} ({c.state || 'No State'} • {c.code})
                        </option>
                      ))}
                    </select>
                    <p className="text-[10px] text-stone-500 mt-1">
                      {selectedSegmentClient 
                        ? `Selected: ${selectedSegmentClient.name} • State: ${selectedSegmentClient.state || 'Not specified'}`
                        : 'Select client to load bank name & state'}
                    </p>
                  </div>

                  {/* State (Auto-derived from Client, Read-only display) */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-1.5">
                      State (From Bank Profile)
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        readOnly
                        value={selectedSegmentClient?.state || (segmentClientId ? 'ALL' : '—')}
                        className="w-full px-3.5 py-2.5 bg-stone-100 border border-[#D8CBB9] rounded-xl text-xs font-bold text-stone-700 cursor-not-allowed"
                      />
                      <MapPin className="w-4 h-4 text-stone-400 absolute right-3 top-3" />
                    </div>
                    <p className="text-[10px] text-stone-500 mt-1">
                      State is automatically extracted from the bank's registered profile.
                    </p>
                  </div>

                  {/* Spoken Key (Auto-generated preview) */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-1.5">
                      Spoken Key (Auto-Generated)
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        readOnly
                        value={segmentClientId ? spokenKeyPreview : '—'}
                        placeholder="e.g. UI-AXIS-TX"
                        className="w-full px-3.5 py-2.5 bg-emerald-50/70 border border-emerald-300 rounded-xl text-xs font-mono font-bold text-emerald-900 cursor-not-allowed"
                      />
                      <Sparkles className="w-4 h-4 text-emerald-600 absolute right-3 top-3" />
                    </div>
                    <p className="text-[10px] text-emerald-700 font-medium mt-1">
                      Format: [Status]-[Bank]-[State] (e.g. {spokenKeyPreview})
                    </p>
                  </div>

                  {/* Target (Numerical input with max validation) */}
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-1.5">
                      Target Audience Count <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      min="1"
                      max={currentEventRemainingTarget > 0 ? currentEventRemainingTarget : undefined}
                      value={segmentTarget}
                      onChange={(e) => setSegmentTarget(e.target.value)}
                      placeholder={selectedEvent ? `Max remaining: ${currentEventRemainingTarget}` : 'Enter target quantity'}
                      className={`w-full px-3.5 py-2.5 bg-white border rounded-xl text-xs text-stone-900 focus:outline-none focus:ring-2 font-medium ${
                        selectedEvent && parseInt(segmentTarget || '0', 10) > currentEventRemainingTarget
                          ? 'border-red-400 focus:ring-red-400 bg-red-50/30'
                          : 'border-[#D8CBB9] focus:ring-[#8B9A6E]'
                      }`}
                      required
                    />
                    <div className="flex justify-between items-center text-[10px] mt-1">
                      <span className="text-stone-500">
                        Remaining Capacity: <strong className="text-emerald-700">{currentEventRemainingTarget.toLocaleString()}</strong>
                      </span>
                      {selectedEvent && parseInt(segmentTarget || '0', 10) > currentEventRemainingTarget && (
                        <span className="text-red-600 font-bold">Exceeds event quantity!</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Description (Optional) */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-stone-700 mb-1.5">
                    Segment Description / Targeting Notes
                  </label>
                  <textarea
                    rows={2}
                    value={segmentDescription}
                    onChange={(e) => setSegmentDescription(e.target.value)}
                    placeholder="Enter any specific cohort targeting criteria, demographic filters, or special notes..."
                    className="w-full px-3.5 py-2.5 bg-white border border-[#D8CBB9] rounded-xl text-xs text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-[#8B9A6E]"
                  />
                </div>

                {/* Submit Button */}
                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    disabled={isSegmentSubmitting || !selectedEvent || currentEventRemainingTarget <= 0}
                    className={`inline-flex items-center space-x-2 px-6 py-3 rounded-2xl text-xs font-bold text-white transition shadow-md ${
                      isSegmentSubmitting || !selectedEvent || currentEventRemainingTarget <= 0
                        ? 'bg-stone-400 cursor-not-allowed opacity-70'
                        : 'bg-[#5A6644] hover:bg-[#495436] shadow-[#5A6644]/20'
                    }`}
                  >
                    {isSegmentSubmitting ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Saving Segment to Database...</span>
                      </>
                    ) : (
                      <>
                        <PlusCircle className="w-4 h-4" />
                        <span>Create Segment ({spokenKeyPreview})</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>

            {/* Segments Directory Table */}
            <div className="bg-[#EAE2D6] border border-[#D8CBB9] rounded-3xl p-6 sm:p-8 shadow-sm space-y-5">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-[#D8CBB9]/80">
                <div>
                  <h3 className="text-lg font-bold text-[#2E3523] flex items-center space-x-2">
                    <Layers className="w-5 h-5 text-[#5A6644]" />
                    <span>Segment Directory</span>
                  </h3>
                  <p className="text-xs text-stone-600 mt-0.5">
                    {selectedEvent 
                      ? `Viewing segments for event ${selectedEvent.eventId} (${currentEventSegments.length} segments, ${currentEventAllocatedTarget.toLocaleString()}/${currentEventCapacity.toLocaleString()} target allocated)`
                      : 'All segments stored in PostgreSQL database across events.'}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
                  {selectedEvent && (
                    <div className="flex rounded-xl bg-white border border-[#D8CBB9] p-0.5 text-xs font-bold">
                      <button
                        type="button"
                        onClick={() => { setSegmentViewFilter('CURRENT'); loadSegments(selectedEvent.id); }}
                        className={`px-3 py-1.5 rounded-lg transition ${
                          segmentViewFilter === 'CURRENT' ? 'bg-[#5A6644] text-white shadow-sm' : 'text-stone-600 hover:text-stone-900'
                        }`}
                      >
                        This Event Only
                      </button>
                      <button
                        type="button"
                        onClick={() => { setSegmentViewFilter('ALL'); loadSegments(''); }}
                        className={`px-3 py-1.5 rounded-lg transition ${
                          segmentViewFilter === 'ALL' ? 'bg-[#5A6644] text-white shadow-sm' : 'text-stone-600 hover:text-stone-900'
                        }`}
                      >
                        All Events
                      </button>
                    </div>
                  )}

                  <div className="relative flex-1 sm:w-64">
                    <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-3" />
                    <input
                      type="text"
                      placeholder="Search spoken key, bank, state..."
                      value={segmentSearchTerm}
                      onChange={(e) => setSegmentSearchTerm(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 bg-white border border-[#D8CBB9] rounded-xl text-xs text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-[#8B9A6E]"
                    />
                  </div>

                  <button
                    onClick={() => { loadSegments(); loadCustomerStats(); }}
                    disabled={isSegmentsLoading}
                    title="Refresh Segments"
                    className="p-2 bg-white border border-[#D8CBB9] rounded-xl text-stone-600 hover:text-[#5A6644] hover:bg-stone-50 transition"
                  >
                    <RefreshCw className={`w-4 h-4 ${isSegmentsLoading ? 'animate-spin' : ''}`} />
                  </button>
                </div>
              </div>

              {/* Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-[#D8CBB9] text-[11px] font-bold uppercase tracking-wider text-stone-600">
                      <th className="py-3 px-4">Spoken Key</th>
                      <th className="py-3 px-4">Insurance Status</th>
                      <th className="py-3 px-4">Bank / Client</th>
                      <th className="py-3 px-4">State</th>
                      <th className="py-3 px-4">Target Audience</th>
                      <th className="py-3 px-4">Parent Event</th>
                      <th className="py-3 px-4">Campaign</th>
                      <th className="py-3 px-4">Description</th>
                      <th className="py-3 px-4">Created On</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#D8CBB9]/60 text-xs text-stone-800">
                    {isSegmentsLoading ? (
                      <tr>
                        <td colSpan={9} className="py-8 text-center text-stone-500">
                          <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-[#5A6644]" />
                          Loading segments from PostgreSQL database...
                        </td>
                      </tr>
                    ) : segments.filter(seg =>
                        seg.spokenKey.toLowerCase().includes(segmentSearchTerm.toLowerCase()) ||
                        (seg.clientName || '').toLowerCase().includes(segmentSearchTerm.toLowerCase()) ||
                        (seg.state || '').toLowerCase().includes(segmentSearchTerm.toLowerCase()) ||
                        (seg.eventCode || '').toLowerCase().includes(segmentSearchTerm.toLowerCase()) ||
                        (seg.campaignCode || '').toLowerCase().includes(segmentSearchTerm.toLowerCase()) ||
                        (seg.description || '').toLowerCase().includes(segmentSearchTerm.toLowerCase())
                      ).length === 0 ? (
                      <tr>
                        <td colSpan={9} className="py-8 text-center text-stone-500">
                          {segmentSearchTerm 
                            ? 'No segments match your search.' 
                            : selectedEvent
                              ? `No segments registered under "${selectedEvent.eventId}" yet. Use the form above to add one!`
                              : 'No segments registered yet. Select an event and create one above!'}
                        </td>
                      </tr>
                    ) : (
                      segments
                        .filter(seg =>
                          seg.spokenKey.toLowerCase().includes(segmentSearchTerm.toLowerCase()) ||
                          (seg.clientName || '').toLowerCase().includes(segmentSearchTerm.toLowerCase()) ||
                          (seg.state || '').toLowerCase().includes(segmentSearchTerm.toLowerCase()) ||
                          (seg.eventCode || '').toLowerCase().includes(segmentSearchTerm.toLowerCase()) ||
                          (seg.campaignCode || '').toLowerCase().includes(segmentSearchTerm.toLowerCase()) ||
                          (seg.description || '').toLowerCase().includes(segmentSearchTerm.toLowerCase())
                        )
                        .map((seg) => (
                          <tr key={seg.id} className="hover:bg-white/40 transition">
                            <td className="py-3.5 px-4 font-mono font-bold text-stone-700">
                              <span className="bg-emerald-50 text-emerald-900 border border-emerald-300 px-2.5 py-1 rounded-lg">
                                {seg.spokenKey}
                              </span>
                            </td>
                            <td className="py-3.5 px-4">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold ${
                                seg.insuranceStatus === 'I'
                                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                  : 'bg-amber-100 text-amber-800 border border-amber-300'
                              }`}>
                                {seg.insuranceStatus === 'I' ? 'I - Insured' : 'UI - Uninsured'}
                              </span>
                            </td>
                            <td className="py-3.5 px-4 font-bold text-[#2E3523]">
                              {seg.clientName || '—'}
                            </td>
                            <td className="py-3.5 px-4">
                              <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-mono font-semibold bg-stone-100 text-stone-700 border border-stone-200">
                                {seg.state || 'ALL'}
                              </span>
                            </td>
                            <td className="py-3.5 px-4 font-bold text-stone-800">
                              <span className="bg-white/80 px-2 py-0.5 rounded border border-[#D8CBB9]">
                                {seg.target ? seg.target.toLocaleString() : '0'}
                              </span>
                            </td>
                            <td className="py-3.5 px-4 font-mono text-stone-700">
                              <span className="bg-white/80 border border-[#D8CBB9] px-2 py-0.5 rounded-md text-[11px]">
                                {seg.eventCode || '—'}
                              </span>
                            </td>
                            <td className="py-3.5 px-4 text-stone-700">
                              {seg.campaignCode || '—'}
                            </td>
                            <td className="py-3.5 px-4 text-stone-500 max-w-xs truncate" title={seg.description}>
                              {seg.description || '—'}
                            </td>
                            <td className="py-3.5 px-4 text-stone-500 text-[11px]">
                              {seg.createdAt ? new Date(seg.createdAt).toLocaleDateString() : '—'}
                            </td>
                          </tr>
                        ))
                    )}
                  </tbody>
                </table>
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
