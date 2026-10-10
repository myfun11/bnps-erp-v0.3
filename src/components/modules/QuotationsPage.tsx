import React, { useState, useEffect } from 'react';
import { erpStore } from '../../services/erpStore';
import { quotationService, isMissingSchemaError } from '../../services/quotationService';
import { useAuth } from '../../context/AuthContext';
import { isSupabaseConfigured } from '../../lib/supabaseClient';
import { BRANCHES_LIST } from '../../services/mockData';
import { Quotation, QuotationStatusType, Lead } from '../../types/database';
import { QuotationBuilderForm } from './quotations/QuotationBuilderForm';
import { QuotationLetterheadDoc } from './quotations/QuotationLetterheadDoc';
import { downloadQuotationTextDoc, triggerPrintQuotation } from '../../lib/quotationExport';
import { 
  FileText, 
  Plus, 
  Table, 
  Eye, 
  Search, 
  Filter, 
  Building2, 
  Phone, 
  MapPin, 
  Check, 
  Share2, 
  FileCheck,
  CheckCircle2,
  Printer,
  Download,
  Save,
  ArrowLeft,
  X,
  Sparkles,
  ShieldAlert
} from 'lucide-react';

interface QuotationsPageProps {
  initialLead?: Lead | null;
  onClearInitialLead?: () => void;
}

export const QuotationsPage: React.FC<QuotationsPageProps> = ({
  initialLead,
  onClearInitialLead,
}) => {
  const { 
    currentProfile, 
    currentAgent,
    userRole, 
    canViewQuotations, 
    canCreateQuotations, 
    canUpdateQuotations, 
    canConvertQuotations 
  } = useAuth();

  const isBranchScoped = ['branch_manager', 'field_officer'].includes(userRole);
  const userBranch = currentProfile?.branch;

  const [quotations, setQuotations] = useState<Quotation[]>([]);
  
  // Default view is BUILDER (Create Quotation) if permitted or initialLead provided, otherwise REGISTER
  const [activeView, setActiveView] = useState<'BUILDER' | 'REGISTER' | 'PREVIEW'>(
    initialLead || canCreateQuotations ? 'BUILDER' : 'REGISTER'
  );
  const [selectedQuotation, setSelectedQuotation] = useState<Quotation | null>(null);

  // When an initialLead is provided from LeadList "Quote", automatically open BUILDER view
  useEffect(() => {
    if (initialLead) {
      setActiveView('BUILDER');
    }
  }, [initialLead]);

  // Filters for Quotation Register Table
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [branchFilter, setBranchFilter] = useState<string>(
    isBranchScoped && userBranch ? userBranch : 'ALL'
  );
  const [originFilter, setOriginFilter] = useState<'ALL' | 'LEADS_ONLY' | 'CONVERTED_ONLY'>('ALL');

  // Toast & Database Error State
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);
  const [dbError, setDbError] = useState<{ message: string; code?: string; isSchemaMissing: boolean } | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);

  const fetchQuotations = async () => {
    setIsRetrying(true);
    try {
      const data = await quotationService.list();
      setQuotations(data);
      setDbError(null);
    } catch (err: any) {
      console.error('[QuotationsPage.fetchQuotations] Database error:', err);
      // Fail closed: never replace a failed Supabase read with local or mock quotations.
      setQuotations([]);
      const isMissing = isMissingSchemaError(err);
      setDbError({
        message: err?.message || 'Failed to load quotations from Supabase',
        code: err?.code || (isMissing ? 'PGRST205' : 'DB_ERROR'),
        isSchemaMissing: isMissing,
      });
    } finally {
      setIsRetrying(false);
    }
  };

  useEffect(() => {
    fetchQuotations();

  }, []);

  const showToast = (msg: string) => {
    setActionSuccessMsg(msg);
    setTimeout(() => setActionSuccessMsg(null), 5000);
  };

  const handleSaveQuotation = async (newQuot: Quotation) => {
    if (!canCreateQuotations) {
      alert('Your role does not have permission to create quotations.');
      return;
    }
    if (isBranchScoped && userBranch && newQuot.branch?.toLowerCase().trim() !== userBranch.toLowerCase().trim()) {
      alert(`Cross-branch quotation creation is forbidden. Quotation must be for your branch (${userBranch}).`);
      return;
    }
    try {
      const created = await quotationService.create(newQuot);
      // Consume prefill lead ONLY after confirmed successful database write
      if (onClearInitialLead) {
        onClearInitialLead();
      }
      await fetchQuotations();
      setSelectedQuotation(created);
      setActiveView('PREVIEW');
      showToast(`Quotation ${created.quotation_no} created and persisted to database successfully!`);
    } catch (err: any) {
      console.error('[QuotationsPage.handleSaveQuotation] Database write failed:', err);
      alert(`DATABASE WRITE FAILED: ${err?.message || 'Database error'}\n\nOperation was NOT saved to the authoritative database. Your form input has been preserved.`);
    }
  };

  const handleConvertToProject = async (q: Quotation) => {
    if (!canConvertQuotations) {
      alert('Your role does not have permission to convert quotations.');
      return;
    }
    if (isBranchScoped && userBranch && q.branch?.toLowerCase().trim() !== userBranch.toLowerCase().trim()) {
      alert(`Cross-branch quotation conversion is forbidden. You can only convert quotations for ${userBranch}.`);
      return;
    }
    try {
      const res = await quotationService.convertToCustomer(q.id, currentProfile.id);
      await fetchQuotations();
      if (selectedQuotation && selectedQuotation.id === q.id) {
        setSelectedQuotation({ ...selectedQuotation, status: 'CONVERTED' });
      }
      showToast(`Quotation converted to Live Customer & Project successfully!`);
    } catch (err: any) {
      alert(err?.message || 'Failed to convert quotation');
    }
  };

  const handleStatusChange = async (qId: string, status: QuotationStatusType) => {
    if (!canUpdateQuotations) {
      alert('Your role does not have permission to update quotation status.');
      return;
    }
    const targetQ = quotations.find((item) => item.id === qId);
    if (isBranchScoped && userBranch && targetQ?.branch?.toLowerCase().trim() !== userBranch.toLowerCase().trim()) {
      alert(`Cross-branch quotation update is forbidden. You can only update quotations for ${userBranch}.`);
      return;
    }
    try {
      await quotationService.updateStatus(qId, status);
      await fetchQuotations();
      if (selectedQuotation && selectedQuotation.id === qId) {
        setSelectedQuotation({ ...selectedQuotation, status });
      }
      showToast(`Status updated to ${status}`);
    } catch (err: any) {
      alert(err?.message || 'Failed to update quotation status');
    }
  };

  const handleShareWhatsApp = (q: Quotation) => {
    const text = encodeURIComponent(
      `*BHUMI NIDHI POWAR SOLUTION - PM SURYA GHAR QUOTATION*\n` +
      `Dear ${q.customer_name},\n` +
      `Your official rooftop solar quotation is ready:\n\n` +
      `📌 Quotation No: ${q.quotation_no}\n` +
      `⚡ Capacity: ${q.capacity_kw} kW (${q.solar_brand || 'Tier-1'} ${q.module_quantity || 6} Panels)\n` +
      `💰 Total Project Cost (Payable to BNPS): ₹${q.total_project_cost.toLocaleString('en-IN')}\n` +
      `✅ *Net Customer Payable to Vendor: ₹${q.total_project_cost.toLocaleString('en-IN')}*\n` +
      `🎁 Govt DBT Subsidy Benefit: ₹${(q.central_subsidy_amount + q.state_subsidy_amount).toLocaleString('en-IN')} (Center: ₹${q.central_subsidy_amount.toLocaleString('en-IN')}, CG State: ₹${q.state_subsidy_amount.toLocaleString('en-IN')})\n` +
      `ℹ️ Note: Govt subsidy is credited directly to customer's bank account via DBT post-commissioning.\n` +
      `💡 Monthly Bill Savings: ~₹${q.monthly_savings_est.toLocaleString('en-IN')}/month\n` +
      `🏦 Bank Loan EMI: ~₹${(q.est_monthly_emi || 1650).toLocaleString('en-IN')}/month\n\n` +
      `Head Office: Near By HDFC Bank, Jaijaipur, Chhattisgarh\n` +
      `Helpline: 9691762929, 9131040126, 8305218826`
    );
    window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
  };

  // Direct print from table
  const handlePrintQuotation = (q: Quotation) => {
    setSelectedQuotation(q);
    setActiveView('PREVIEW');
    setTimeout(() => {
      triggerPrintQuotation();
    }, 300);
  };

  // Direct download docket from table
  const handleDownloadQuotation = (q: Quotation) => {
    downloadQuotationTextDoc(q);
    showToast(`Quotation ${q.quotation_no} docket downloaded successfully!`);
  };

  // Filtered list
  const filteredQuotations = quotations.filter((q) => {
    const matchesSearch = 
      q.quotation_no.toLowerCase().includes(searchQuery.toLowerCase()) ||
      q.customer_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      q.phone.includes(searchQuery) ||
      (q.consumer_number && q.consumer_number.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesStatus = statusFilter === 'ALL' || q.status === statusFilter;
    
    // Strict branch scoping: branch_manager and field_officer are strictly isolated to their authorized branch
    const matchesBranch = isBranchScoped
      ? Boolean(userBranch && q.branch && q.branch.toLowerCase().trim() === userBranch.toLowerCase().trim())
      : (branchFilter === 'ALL' || q.branch === branchFilter);

    // Agent isolation: agents may only view quotations for their own assigned leads
    const matchesAgent = userRole === 'agent'
      ? Boolean(
          (q.lead_id && erpStore.getLeads().some(l => l.id === q.lead_id && (l.source_agent_id === currentAgent?.id || l.source_agent_id === currentProfile?.id || l.assigned_officer_id === currentProfile?.id)))
          || (q.prepared_by && currentProfile?.full_name && q.prepared_by.toLowerCase().includes(currentProfile.full_name.toLowerCase()))
        )
      : true;

    // Origin logic:
    // LEADS_ONLY: quotations belonging to leads (lead_id is set and not yet converted to customer)
    // CONVERTED_ONLY: quotations with an active customer (customer_id is set or status is CONVERTED)
    const matchesOrigin = 
      originFilter === 'ALL' ||
      (originFilter === 'LEADS_ONLY' && (Boolean(q.lead_id || q.lead_code) && !q.customer_id && q.status !== 'CONVERTED')) ||
      (originFilter === 'CONVERTED_ONLY' && (Boolean(q.customer_id) || q.status === 'CONVERTED'));

    return matchesSearch && matchesStatus && matchesBranch && matchesOrigin && matchesAgent;
  });

  const totalPipeline = quotations.reduce((acc, q) => acc + q.total_project_cost, 0);
  const totalSubsidiesSaved = quotations.reduce((acc, q) => acc + q.central_subsidy_amount + q.state_subsidy_amount, 0);
  const convertedCount = quotations.filter((q) => q.status === 'CONVERTED').length;

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case 'ACCEPTED':
        return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
      case 'CONVERTED':
        return 'bg-sky-500/20 text-sky-300 border-sky-500/30';
      case 'DRAFT':
        return 'bg-slate-700 text-slate-300 border-slate-600';
      case 'EXPIRED':
        return 'bg-red-500/20 text-red-300 border-red-500/30';
      case 'SENT':
      default:
        return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
    }
  };

  // Access Denied guard for roles with all quotation permissions strictly blocked (operational_manager, technician, receptionist, etc.)
  if (!canViewQuotations) {
    return (
      <div className="p-8 bg-slate-900/80 rounded-2xl border border-red-500/30 text-center max-w-lg mx-auto my-12 space-y-4 animate-fade-in shadow-xl">
        <ShieldAlert className="w-12 h-12 text-red-400 mx-auto" />
        <h3 className="text-lg font-bold text-slate-100">Access Denied</h3>
        <p className="text-xs text-slate-400">
          Your role (<span className="text-amber-400 font-semibold">{userRole || 'unassigned'}</span>) does not have permission to view or manage solar quotations in BNPS ERP v0.3.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Toast Notification */}
      {actionSuccessMsg && (
        <div className="fixed top-20 right-6 z-50 bg-emerald-500 text-slate-950 font-bold px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 border border-emerald-300 animate-bounce print:hidden">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm">{actionSuccessMsg}</span>
          <button onClick={() => setActionSuccessMsg(null)} className="ml-2 hover:opacity-75">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Main Page Top Navigation & Switcher Header */}
      <div className="bg-slate-900/90 rounded-2xl p-5 border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-lg print:hidden">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-slate-100">
                  {activeView === 'BUILDER' && 'Create Solar Quotation'}
                  {activeView === 'REGISTER' && 'Quotation Register (Table View)'}
                  {activeView === 'PREVIEW' && 'Official Quotation Document Preview'}
                </h2>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-mono font-bold">
                  PM Surya Ghar Subsidy
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Bhumi Nidhi Powar Solution • Customer Quotation, Hardware BOM & Bank Estimate Suite
              </p>
            </div>
          </div>
        </div>

        {/* View Switcher: Front page shows Create Quotation (if authorized), and View Quotation Register button opens the table */}
        <div className="flex items-center gap-2.5 w-full md:w-auto">
          {activeView !== 'BUILDER' && canCreateQuotations && (
            <button
              onClick={() => {
                if (onClearInitialLead) onClearInitialLead();
                setActiveView('BUILDER');
              }}
              className="flex-1 md:flex-initial flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-md shadow-amber-500/20 transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>+ Create Quotation</span>
            </button>
          )}

          {activeView !== 'REGISTER' && (
            <button
              onClick={() => setActiveView('REGISTER')}
              className="flex-1 md:flex-initial flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md shadow-blue-600/20 transition cursor-pointer"
            >
              <Table className="w-4 h-4" />
              <span>View Quotation Register ({quotations.length})</span>
            </button>
          )}

          {activeView === 'REGISTER' && selectedQuotation && (
            <button
              onClick={() => setActiveView('PREVIEW')}
              className="flex-1 md:flex-initial flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs border border-slate-700 transition cursor-pointer"
            >
              <Eye className="w-4 h-4 text-amber-400" />
              <span>View Letterhead ({selectedQuotation.quotation_no})</span>
            </button>
          )}
        </div>
      </div>

      {/* Demo / Offline In-Memory Storage Indicator */}
      {!isSupabaseConfigured && (
        <div className="flex items-center gap-2.5 p-3 rounded-xl bg-slate-900 border border-amber-500/30 text-xs text-slate-300 shadow-sm animate-fade-in">
          <span className="px-2 py-0.5 rounded font-mono font-bold text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30 uppercase tracking-wide shrink-0">
            Demo Mode
          </span>
          <span className="text-slate-400">
            Supabase credentials are not configured. Quotation listing, creation, status updates, and conversion are disabled until the authoritative database connection is configured.
          </span>
        </div>
      )}

      {/* Database Setup Required / Error State with Manual Retry */}
      {dbError && (
        <div className="p-4 rounded-2xl bg-red-950/40 border-2 border-red-500/50 text-xs text-red-200 shadow-xl space-y-3 animate-fade-in">
          <div className="flex items-start justify-between gap-3 flex-wrap sm:flex-nowrap">
            <div className="flex items-start gap-3">
              <ShieldAlert className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <div className="font-bold text-sm text-red-100 flex items-center gap-2">
                  <span>Authoritative Database Schema Missing</span>
                  {dbError.code && (
                    <span className="px-1.5 py-0.5 rounded font-mono text-[10px] bg-red-900/60 text-red-300 border border-red-700/60">
                      {dbError.code}
                    </span>
                  )}
                </div>
                <p className="text-red-300 leading-relaxed">
                  {dbError.isSchemaMissing ? (
                    <>
                      The table <code className="text-amber-300 bg-black/40 px-1 py-0.5 rounded font-mono">public.quotations</code> was not found in the connected Supabase database schema cache.
                      Migration <strong className="text-white font-mono">database/10_quotations_table_ddl_and_rpc.sql</strong> must be executed in your Supabase project SQL Editor before quotations can be stored remotely.
                    </>
                  ) : (
                    dbError.message
                  )}
                </p>
                <p className="text-[11px] text-red-400/90 italic">
                  * Authoritative production mode is active. Data is NOT silently saved to local storage to prevent divergence. Execute the migration in Supabase, then click Retry.
                </p>
              </div>
            </div>

            <button
              onClick={() => fetchQuotations()}
              disabled={isRetrying}
              className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs shadow-md transition cursor-pointer disabled:opacity-50 shrink-0 flex items-center gap-1.5 self-start sm:self-center"
            >
              <span>{isRetrying ? 'Checking Supabase...' : 'Retry Database Connection'}</span>
            </button>
          </div>
        </div>
      )}

      {/* VIEW 1: FRONT PAGE = CREATE QUOTATION (BUILDER) */}
      {activeView === 'BUILDER' && (
        <div className="space-y-4">
          <div className="bg-gradient-to-r from-amber-500/10 via-slate-900 to-slate-900 rounded-2xl p-4 border border-amber-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow">
            <div className="flex items-center gap-3">
              <Sparkles className="w-5 h-5 text-amber-400 shrink-0" />
              <div className="text-xs text-slate-300">
                <strong className="text-slate-100">Create Solar Quotation:</strong> Enter customer name, address, capacity (kW), panel & inverter brands, equipment, installation, and transport charges. The system automatically computes the live estimate and generates official letterheads ready to print, save, or download.
              </div>
            </div>

            <button
              type="button"
              onClick={() => setActiveView('REGISTER')}
              className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-400 font-semibold text-xs border border-slate-700"
            >
              <Table className="w-3.5 h-3.5" />
              <span>View Registered Quotations ({quotations.length})</span>
            </button>
          </div>

          {/* Quotation Builder Component with All Requested Fields and Live Estimate */}
          <QuotationBuilderForm
            initialLead={initialLead}
            onSave={handleSaveQuotation}
            onCancel={() => {
              if (onClearInitialLead) onClearInitialLead();
              setActiveView('REGISTER');
            }}
          />
        </div>
      )}

      {/* VIEW 2: QUOTATION REGISTER (CLEAN ROW TABLE AS REQUESTED) */}
      {activeView === 'REGISTER' && (
        <div className="space-y-4">
          {/* Top Metrics Row in Register View */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 print:hidden">
            <div className="bg-slate-900/80 rounded-xl p-3.5 border border-slate-800 shadow">
              <div className="text-xs text-slate-400">Total Registered Quotations</div>
              <div className="text-xl font-bold font-mono text-slate-100 mt-1">{quotations.length}</div>
              <div className="text-[11px] text-amber-400 mt-0.5">Across 7 CG Branches</div>
            </div>
            <div className="bg-slate-900/80 rounded-xl p-3.5 border border-slate-800 shadow">
              <div className="text-xs text-slate-400">Pipeline Gross Turnkey</div>
              <div className="text-xl font-bold font-mono text-amber-400 mt-1">₹{(totalPipeline / 100000).toFixed(2)} Lakh</div>
              <div className="text-[11px] text-slate-400 mt-0.5">Solar Project Value</div>
            </div>
            <div className="bg-slate-900/80 rounded-xl p-3.5 border border-slate-800 shadow">
              <div className="text-xs text-slate-400">Total Subsidies Benefit</div>
              <div className="text-xl font-bold font-mono text-emerald-400 mt-1">₹{(totalSubsidiesSaved / 100000).toFixed(2)} Lakh</div>
              <div className="text-[11px] text-emerald-400 mt-0.5">Central DBT + State CG</div>
            </div>
            <div className="bg-slate-900/80 rounded-xl p-3.5 border border-slate-800 shadow">
              <div className="text-xs text-slate-400">Converted to Projects</div>
              <div className="text-xl font-bold font-mono text-sky-400 mt-1">{convertedCount}</div>
              <div className="text-[11px] text-sky-400 mt-0.5">Installation Active</div>
            </div>
          </div>

          {/* Search & Filter Toolbar */}
          <div className="bg-slate-900/80 rounded-xl p-4 border border-slate-800 flex flex-col md:flex-row items-center gap-3">
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by customer name, phone, quotation number (BNPS/QTN/...), or CSPDCL consumer no..."
                className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-4 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500"
              />
            </div>

            <div className="flex items-center gap-2 w-full md:w-auto">
              <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs">
                <Building2 className="w-3.5 h-3.5 text-slate-400" />
                <select
                  value={isBranchScoped ? (userBranch || 'Jaijaipur') : branchFilter}
                  onChange={(e) => setBranchFilter(e.target.value)}
                  disabled={isBranchScoped}
                  className={`bg-transparent text-slate-200 focus:outline-none text-xs ${isBranchScoped ? 'opacity-70 cursor-not-allowed' : ''}`}
                >
                  {!isBranchScoped && <option value="ALL">All Branches ({BRANCHES_LIST.length})</option>}
                  {BRANCHES_LIST.filter(b => !isBranchScoped || (userBranch && b.toLowerCase().trim() === userBranch.toLowerCase().trim())).map((b) => (
                    <option key={b} value={b}>
                      {b === 'Jaijaipur' ? 'HQ Jaijaipur' : b}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 rounded-lg p-1 text-xs">
                <button
                  type="button"
                  onClick={() => setOriginFilter('ALL')}
                  className={`px-2.5 py-1 rounded text-[11px] font-semibold transition cursor-pointer ${
                    originFilter === 'ALL'
                      ? 'bg-amber-500 text-slate-950 font-bold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  All ({quotations.length})
                </button>
                <button
                  type="button"
                  onClick={() => setOriginFilter('LEADS_ONLY')}
                  className={`px-2.5 py-1 rounded text-[11px] font-semibold transition cursor-pointer ${
                    originFilter === 'LEADS_ONLY'
                      ? 'bg-amber-500 text-slate-950 font-bold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                  title="Quotations issued to Leads (pending conversion)"
                >
                  Lead Quotes ({quotations.filter(q => (q.lead_id || q.lead_code) && !q.customer_id && q.status !== 'CONVERTED').length})
                </button>
                <button
                  type="button"
                  onClick={() => setOriginFilter('CONVERTED_ONLY')}
                  className={`px-2.5 py-1 rounded text-[11px] font-semibold transition cursor-pointer ${
                    originFilter === 'CONVERTED_ONLY'
                      ? 'bg-emerald-500 text-slate-950 font-bold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                  title="Quotations linked to Converted Customers / Projects"
                >
                  Customer Quotes ({quotations.filter(q => q.customer_id || q.status === 'CONVERTED').length})
                </button>
              </div>

              <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs">
                <Filter className="w-3.5 h-3.5 text-slate-400" />
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="bg-transparent text-slate-200 focus:outline-none text-xs"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="SENT">Sent to Customer</option>
                  <option value="ACCEPTED">Customer Accepted</option>
                  <option value="CONVERTED">Converted to Project</option>
                  <option value="DRAFT">Draft</option>
                </select>
              </div>
            </div>
          </div>

          {/* Clean Row Table View */}
          <div className="overflow-x-auto border border-slate-800 rounded-2xl shadow-xl bg-slate-900/90">
            <table className="w-full text-xs text-left">
              <thead className="bg-slate-950 text-slate-400 font-semibold border-b border-slate-800 text-[11px] uppercase tracking-wider">
                <tr>
                  <th className="p-3.5">Quotation No / Date</th>
                  <th className="p-3.5">Customer Details</th>
                  <th className="p-3.5">System Size & Type</th>
                  <th className="p-3.5">Brand & Hardware</th>
                  <th className="p-3.5 text-right">Project Cost</th>
                  <th className="p-3.5 text-right">Govt DBT Subsidy</th>
                  <th className="p-3.5 text-right">Net Payable to BNPS</th>
                  <th className="p-3.5 text-center">Status</th>
                  <th className="p-3.5 text-center min-w-[210px]">Print / Save / Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80 text-slate-200">
                {filteredQuotations.map((q) => (
                  <tr key={q.id} className="hover:bg-slate-800/40 transition-colors">
                    {/* Quotation No & Date */}
                    <td className="p-3.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-mono font-bold text-amber-400">{q.quotation_no}</span>
                        {(q.lead_id || q.lead_code) && !q.customer_id && q.status !== 'CONVERTED' ? (
                          <span className="px-1.5 py-0.2 rounded font-mono text-[9px] bg-amber-500/15 text-amber-300 border border-amber-500/30">
                            LEAD QUOTE
                          </span>
                        ) : (q.customer_id || q.status === 'CONVERTED') ? (
                          <span className="px-1.5 py-0.2 rounded font-mono text-[9px] bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                            CUSTOMER
                          </span>
                        ) : null}
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        {new Date(q.created_at || Date.now()).toLocaleDateString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric'
                        })}
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono">
                        Valid: {q.valid_until || '30 Days'}
                      </div>
                    </td>

                    {/* Customer Details */}
                    <td className="p-3.5">
                      <div className="font-bold text-slate-100 text-sm">{q.customer_name}</div>
                      <div className="text-xs text-slate-400 flex items-center gap-1 mt-0.5 font-mono">
                        <Phone className="w-3 h-3 text-slate-500" />
                        <span>{q.phone}</span>
                      </div>
                      <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                        <MapPin className="w-3 h-3 text-amber-400 shrink-0" />
                        <span className="truncate max-w-[180px]">{q.address_line || q.district || 'Chhattisgarh'} ({q.branch || 'Sakti'})</span>
                      </div>
                      {q.consumer_number && (
                        <div className="text-[10px] font-mono text-slate-500 mt-0.5">
                          BP: {q.consumer_number}
                        </div>
                      )}
                    </td>

                    {/* System Size & Type */}
                    <td className="p-3.5">
                      <div className="inline-block px-2 py-0.5 rounded font-mono font-bold text-xs bg-amber-500/10 text-amber-300 border border-amber-500/30">
                        {q.capacity_kw} kW Plant
                      </div>
                      <div className="text-[11px] text-slate-300 mt-1 font-medium">
                        {q.system_type || 'On-Grid'}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {q.cell_type || 'Bifacial DCR'}
                      </div>
                    </td>

                    {/* Hardware Brand */}
                    <td className="p-3.5">
                      <div className="font-medium text-slate-200">
                        {q.solar_brand || 'Tier-1 Solar'}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {q.module_quantity || 6} Panels ({q.module_wattage_wp || 550}Wp)
                      </div>
                      <div className="text-[11px] text-amber-400/90 mt-0.5 truncate max-w-[160px]">
                        Inv: {q.inverter_brand || 'Growatt'} ({q.inverter_kw || q.capacity_kw} kW)
                      </div>
                    </td>

                    {/* Turnkey Project Cost */}
                    <td className="p-3.5 text-right font-mono font-semibold text-slate-100">
                      ₹{q.total_project_cost.toLocaleString('en-IN')}
                    </td>

                    {/* Subsidies */}
                    <td className="p-3.5 text-right">
                      <div className="font-mono text-emerald-400 font-bold">
                        ₹{(q.central_subsidy_amount + q.state_subsidy_amount).toLocaleString('en-IN')}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        DBT to Customer A/C
                      </div>
                    </td>

                    {/* Net Customer Cost */}
                    <td className="p-3.5 text-right">
                      <div className="font-mono font-bold text-amber-300 text-sm">
                        ₹{q.total_project_cost.toLocaleString('en-IN')}
                      </div>
                      <div className="text-[10px] text-sky-400">
                        EMI: ~₹{(q.est_monthly_emi || 1650).toLocaleString('en-IN')}/mo
                      </div>
                    </td>

                    {/* Status */}
                    <td className="p-3.5 text-center">
                      <span className={`inline-block px-2.5 py-0.5 rounded-full font-mono text-[10px] font-bold border ${getStatusBadge(q.status)}`}>
                        {q.status || 'SENT'}
                      </span>
                      {canUpdateQuotations && (!isBranchScoped || (userBranch && q.branch?.toLowerCase().trim() === userBranch.toLowerCase().trim())) && (
                        <div className="mt-1">
                          <select
                            value={q.status || 'SENT'}
                            onChange={(e) => handleStatusChange(q.id, e.target.value as QuotationStatusType)}
                            className="bg-slate-950 border border-slate-800 rounded px-1.5 py-0.5 text-[10px] text-slate-300 focus:outline-none cursor-pointer"
                          >
                            <option value="SENT">Sent</option>
                            <option value="ACCEPTED">Accepted</option>
                            <option value="CONVERTED">Converted</option>
                            <option value="DRAFT">Draft</option>
                          </select>
                        </div>
                      )}
                    </td>

                    {/* Print / Save / Download / Actions */}
                    <td className="p-3.5 text-center">
                      <div className="flex items-center justify-center gap-1.5 flex-wrap">
                        {/* View Letterhead */}
                        <button
                          onClick={() => {
                            setSelectedQuotation(q);
                            setActiveView('PREVIEW');
                          }}
                          className="p-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold transition shadow-sm"
                          title="View Official Letterhead"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>

                        {/* Print */}
                        <button
                          onClick={() => handlePrintQuotation(q)}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 transition"
                          title="Print Quotation"
                        >
                          <Printer className="w-3.5 h-3.5" />
                        </button>

                        {/* Save as PDF */}
                        <button
                          onClick={() => handlePrintQuotation(q)}
                          className="p-1.5 rounded-lg bg-blue-600/30 hover:bg-blue-600 text-blue-300 hover:text-white border border-blue-500/40 transition"
                          title="Save as PDF"
                        >
                          <Save className="w-3.5 h-3.5" />
                        </button>

                        {/* Download File */}
                        <button
                          onClick={() => handleDownloadQuotation(q)}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-slate-700 transition"
                          title="Download Quotation Docket (.txt)"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>

                        {/* WhatsApp Share */}
                        <button
                          onClick={() => handleShareWhatsApp(q)}
                          className="p-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition"
                          title="Share on WhatsApp"
                        >
                          <Share2 className="w-3.5 h-3.5" />
                        </button>

                        {/* Convert to Project */}
                        {q.status !== 'CONVERTED' ? (
                          canConvertQuotations && (!isBranchScoped || (userBranch && q.branch?.toLowerCase().trim() === userBranch.toLowerCase().trim())) ? (
                            <button
                              onClick={() => handleConvertToProject(q)}
                              className="p-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white transition cursor-pointer"
                              title="Convert to Live Project & Customer"
                            >
                              <FileCheck className="w-3.5 h-3.5" />
                            </button>
                          ) : null
                        ) : (
                          <span className="p-1 text-emerald-400" title="Project Created">
                            <Check className="w-3.5 h-3.5" />
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredQuotations.length === 0 && (
            <div className="p-12 text-center bg-slate-900/60 rounded-2xl border border-slate-800 text-slate-400 space-y-3">
              <FileText className="w-12 h-12 text-slate-600 mx-auto" />
              <div className="text-base font-semibold text-slate-200">No Quotations Found in Register</div>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                No solar quotations match your current search query or filter. Click below to create a new quotation.
              </p>
              <button
                onClick={() => setActiveView('BUILDER')}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500 text-slate-950 font-bold text-xs"
              >
                <Plus className="w-4 h-4" />
                <span>+ Create New Quotation</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* VIEW 3: OFFICIAL LETTERHEAD DOCUMENT PREVIEW WITH PRINT / SAVE / DOWNLOAD */}
      {activeView === 'PREVIEW' && selectedQuotation && (
        <QuotationLetterheadDoc
          quotation={selectedQuotation}
          onPrint={() => triggerPrintQuotation()}
          onShareWhatsApp={handleShareWhatsApp}
          onConvertToProject={handleConvertToProject}
          onBack={() => setActiveView('REGISTER')}
        />
      )}
    </div>
  );
};
