import React, { useState, useEffect } from 'react';
import { Agent, Lead, LeadStageType } from '../../types/database';
import { agentNetworkService } from '../../services/agentNetworkService';
import { erpStore } from '../../services/erpStore';
import { leadService } from '../../services/leadService';
import { useAuth } from '../../context/AuthContext';
import { LEAD_STAGES } from '../../lib/constants';
import { isSupabaseConfigured } from '../../lib/supabaseClient';
import { ConvertLeadModal } from './ConvertLeadModal';
import { CHHATTISGARH_DISTRICTS } from '../../services/mockData';
import { 
  UserPlus, 
  Search, 
  Filter, 
  ArrowRight, 
  Phone, 
  MapPin, 
  Zap, 
  CheckCircle, 
  XCircle,
  Plus,
  Building,
  Home,
  FileText
} from 'lucide-react';

interface LeadListProps {
  onOpenCustomer: (customerId: string) => void;
  onQuoteLead?: (lead: Lead) => void;
  openNewLeadDirectly?: boolean;
  onCloseNewLeadDirectly?: () => void;
}

export const LeadList: React.FC<LeadListProps> = ({ 
  onOpenCustomer, 
  onQuoteLead,
  openNewLeadDirectly = false,
  onCloseNewLeadDirectly 
}) => {
  const { currentProfile, currentAgent, userRole, canConvertLeads } = useAuth();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [availableAgents, setAvailableAgents] = useState<Agent[]>([]);
  const [showPortalAction, setShowPortalAction] = useState(false);
  const [selectedStage, setSelectedStage] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [showTestLeads, setShowTestLeads] = useState(false);
  const [convertTargetLead, setConvertTargetLead] = useState<Lead | null>(null);
  const [showNewLeadModal, setShowNewLeadModal] = useState(openNewLeadDirectly);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);

  // Sync external open trigger
  useEffect(() => {
    if (openNewLeadDirectly) {
      setShowNewLeadModal(true);
    }
  }, [openNewLeadDirectly]);

  // Form state for new lead with Chhattisgarh Address Hierarchy
  const [newLeadForm, setNewLeadForm] = useState({
    source_agent_id: '',
    full_name: '',
    father_name: '',
    dob: '',
    mobile: '',
    alternate_phone: '',
    email: '',
    discom_name: 'CSPDCL (Raipur City Circle)',
    consumer_number: '',
    proposed_capacity_kw: 3.3,
    sanctioned_load_kw: 5.0,
    address_line: '',
    state: 'Chhattisgarh',
    district: 'Janjgir-Champa',
    tehsil: 'Jaijaipur',
    block: 'Jaijaipur',
    panchayat_village: '',
    pincode: '495690',
    notes: '',
  });

  const loadData = async () => {
    try {
      const data = await leadService.fetchLeads();
      if (userRole === 'agent' && currentAgent?.id) {
        setLeads(data.filter((l) => l.source_agent_id === currentAgent.id));
      } else {
        setLeads(data);
      }
    } catch (err) {
      console.error('Failed to fetch leads from authoritative backend:', err);
      if (leadService.isConfigured()) {
        setLeads([]);
        return;
      }
      if (userRole === 'agent') {
        if (!currentAgent?.id) {
          setLeads([]);
          return;
        }
        setLeads(erpStore.getLeadsForAgent(currentAgent.id));
        return;
      }
      setLeads(erpStore.getLeads());
    }
  };

  useEffect(() => {
    void loadData();
    if (userRole !== 'agent') {
      agentNetworkService.list()
        .then((rows) => setAvailableAgents(rows))
        .catch((err) => console.error('Failed to load agent options:', err));
    }
    if (!leadService.isConfigured()) {
      const unsubscribe = erpStore.subscribe(loadData);
      return () => unsubscribe();
    }
    return undefined;
  }, [userRole, currentAgent?.id]);

  // Test records are excluded from operational views unless an admin explicitly opts in.
  const canInspectTestRecords = userRole === 'super_admin' || userRole === 'office_admin';
  const visibleLeads = leads.filter((lead) => !lead.is_test || (canInspectTestRecords && showTestLeads));

  // Filter leads
  const filteredLeads = visibleLeads.filter((lead) => {
    const matchesStage = selectedStage === 'ALL' || lead.stage === selectedStage;
    const q = searchQuery.toLowerCase();
    const matchesQuery = 
      lead.full_name.toLowerCase().includes(q) ||
      lead.lead_code.toLowerCase().includes(q) ||
      lead.mobile.includes(q) ||
      (lead.district && lead.district.toLowerCase().includes(q)) ||
      (lead.consumer_number && lead.consumer_number.includes(q));
    return matchesStage && matchesQuery;
  });

  const handleStageChange = async (leadId: string, stage: LeadStageType) => {
    try {
      if (leadService.isConfigured()) {
        await leadService.updateLeadStage(leadId, stage);
        await loadData();
        return;
      }

      // Disconnected verification mode only; never use the local store after a live failure.
      const res = erpStore.updateLeadStage(leadId, stage, undefined, currentProfile.id);
      if (!res.success) {
        alert(res.message);
      }
    } catch (err) {
      console.error('[LeadList.handleStageChange] Stage update failed:', err);
      alert(err instanceof Error ? err.message : 'Lead stage could not be updated in the authoritative backend.');
    }
  };

  const handleCreateLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLeadForm.full_name.trim() || !newLeadForm.mobile.trim()) {
      alert('Please enter applicant name and mobile number');
      return;
    }
    if (!newLeadForm.father_name.trim() || !newLeadForm.dob) {
      alert('Please enter the customer father name and date of birth for KYC matching.');
      return;
    }

    const leadInput = {
      source_agent_id: userRole === 'agent' ? currentAgent?.id : (newLeadForm.source_agent_id || undefined),
      assigned_officer_id: userRole === 'agent' ? undefined : (currentProfile.id || undefined),
      full_name: newLeadForm.full_name.trim(),
      father_name: newLeadForm.father_name.trim(),
      dob: newLeadForm.dob,
      mobile: newLeadForm.mobile.trim(),
      alternate_phone: newLeadForm.alternate_phone || undefined,
      email: newLeadForm.email || undefined,
      discom_name: newLeadForm.discom_name,
      consumer_number: newLeadForm.consumer_number || undefined,
      sanctioned_load_kw: Number(newLeadForm.sanctioned_load_kw),
      proposed_capacity_kw: Number(newLeadForm.proposed_capacity_kw),
      address_line: newLeadForm.address_line,
      state: newLeadForm.state,
      district: newLeadForm.district,
      tehsil: newLeadForm.tehsil,
      block: newLeadForm.block,
      panchayat_village: newLeadForm.panchayat_village,
      pincode: newLeadForm.pincode,
      stage: 'NEW' as const,
      notes: newLeadForm.notes,
      is_test: false,
    };

    try {
      const lead = leadService.isConfigured()
        ? await leadService.createLead(leadInput)
        : (await erpStore.createLead(leadInput, currentProfile.id)).lead;
      if (!lead) throw new Error('Lead was not returned by the selected backend.');

      setShowNewLeadModal(false);
      if (onCloseNewLeadDirectly) onCloseNewLeadDirectly();
      setSuccessBanner(`New lead ${lead.lead_code} (District: ${newLeadForm.district}) registered successfully!`);
      setTimeout(() => setSuccessBanner(null), 4000);
      setNewLeadForm({
        source_agent_id: '',
        full_name: '',
        father_name: '',
        dob: '',
        mobile: '',
        alternate_phone: '',
        email: '',
        discom_name: 'CSPDCL (Raipur City Circle)',
        consumer_number: '',
        proposed_capacity_kw: 3.3,
        sanctioned_load_kw: 5.0,
        address_line: '',
        state: 'Chhattisgarh',
        district: 'Janjgir-Champa',
        tehsil: 'Jaijaipur',
        block: 'Jaijaipur',
        panchayat_village: '',
        pincode: '495690',
        notes: '',
      });
      await loadData();
    } catch (err) {
      console.error('[LeadList.handleCreateLead] Lead creation failed:', err);
      alert(err instanceof Error ? err.message : 'Lead could not be created in the authoritative backend.');
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Top Banner Message */}
      {successBanner && (
        <div className="p-3.5 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-emerald-400" />
            <span className="font-semibold">{successBanner}</span>
          </div>
          <div className="flex items-center gap-3">
            {showPortalAction && (
              <a href="https://consumer.pmsuryaghar.gov.in/consumer/#/login" target="_blank" rel="noopener noreferrer" onClick={() => setShowPortalAction(false)} className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold whitespace-nowrap">Open PM Surya Ghar Portal</a>
            )}
            <button onClick={() => { setSuccessBanner(null); setShowPortalAction(false); }} className="text-emerald-400 hover:text-emerald-200">Dismiss</button>
          </div>
        </div>
      )}

      {/* Action Bar & Summary */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-900/80 p-4 rounded-xl border border-slate-800">
        <div>
          <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-amber-400" />
            <span>PM Surya Ghar Lead Pipeline (Chhattisgarh)</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
              {visibleLeads.length} Operational Leads
            </span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            CSPDCL Sub-divisions • State, District, Tehsil, Block & Panchayat / Village Geocoding
          </p>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          {isSupabaseConfigured && canInspectTestRecords && (
            <label className="flex items-center gap-2 rounded-lg border border-amber-500/30 px-2.5 py-2 text-xs text-amber-200 whitespace-nowrap">
              <input type="checkbox" checked={showTestLeads} onChange={(e) => setShowTestLeads(e.target.checked)} className="accent-amber-500" />
              <span>Show TEST ONLY</span>
            </label>
          )}
          <div className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by Name, District, Mobile..."
              className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-400"
            />
          </div>

          <button
            onClick={() => setShowNewLeadModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold shadow-md shadow-emerald-500/20 whitespace-nowrap transition-all"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>+ New Solar Lead</span>
          </button>
        </div>
      </div>

      {/* Stage Filters Bar */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        <button
          onClick={() => setSelectedStage('ALL')}
          className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
            selectedStage === 'ALL'
              ? 'bg-amber-500 text-slate-950 font-bold'
              : 'bg-slate-800/80 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
          }`}
        >
          All Stages ({visibleLeads.length})
        </button>
        {(Object.keys(LEAD_STAGES) as LeadStageType[]).map((st) => {
          const count = visibleLeads.filter((l) => l.stage === st).length;
          const isSelected = selectedStage === st;
          return (
            <button
              key={st}
              onClick={() => setSelectedStage(st)}
              className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                isSelected
                  ? 'bg-amber-500 text-slate-950 font-bold'
                  : 'bg-slate-800/80 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              <span>{LEAD_STAGES[st].label}</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${isSelected ? 'bg-slate-950 text-amber-300' : 'bg-slate-700 text-slate-300'}`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Leads Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredLeads.length === 0 ? (
          <div className="col-span-full py-16 text-center text-slate-500 text-sm bg-slate-900/40 rounded-xl border border-dashed border-slate-800">
            No leads matching the current filter.
          </div>
        ) : (
          filteredLeads.map((lead) => {
            const isConverted = lead.stage === 'CONVERTED';
            const isLost = lead.stage === 'LOST';

            return (
              <div
                key={lead.id}
                className={`p-4 rounded-xl border transition-all flex flex-col justify-between ${
                  isConverted
                    ? 'bg-slate-900/40 border-emerald-900/40 opacity-90'
                    : 'bg-slate-900/90 border-slate-800 hover:border-slate-700 shadow-md'
                }`}
              >
                <div>
                  {/* Lead Header */}
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <span className="text-[11px] font-mono text-amber-400 font-semibold">{lead.lead_code}</span>
                      <h4 className="text-sm font-bold text-slate-100">{lead.full_name}</h4>
                    </div>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${LEAD_STAGES[lead.stage].color}`}>
                      {LEAD_STAGES[lead.stage].label}
                    </span>
                  </div>

                  {/* Core Details with Chhattisgarh Address */}
                  <div className="space-y-1.5 text-xs text-slate-300 mt-2">
                    <div className="flex items-center gap-2">
                      <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="font-mono">{lead.mobile}</span>
                      {lead.alternate_phone && <span className="text-slate-500 font-mono">/ {lead.alternate_phone}</span>}
                    </div>

                    <div className="flex items-center gap-2">
                      <MapPin className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span className="font-medium text-slate-200">
                        {lead.district || 'Raipur'}, {lead.state || 'Chhattisgarh'}
                      </span>
                    </div>

                    {/* Tehsil, Block, Village Info Pill */}
                    {(lead.tehsil || lead.block || lead.panchayat_village) && (
                      <div className="text-[11px] text-slate-400 bg-slate-950/60 px-2 py-1 rounded border border-slate-800 flex flex-wrap gap-x-2">
                        {lead.tehsil && <span>Teh: <strong className="text-slate-300">{lead.tehsil}</strong></span>}
                        {lead.block && <span>Block: <strong className="text-slate-300">{lead.block}</strong></span>}
                        {lead.panchayat_village && <span>GP/Vill: <strong className="text-amber-300">{lead.panchayat_village}</strong></span>}
                      </div>
                    )}

                    {/* KYC Master Info if populated */}
                    {(lead.father_name || lead.dob) && (
                      <div className="text-[11px] text-slate-400 flex items-center gap-2 bg-slate-950/40 px-2 py-0.5 rounded border border-slate-800/80">
                        {lead.father_name && <span>Father: <strong className="text-slate-300">{lead.father_name}</strong></span>}
                        {lead.dob && <span>DOB: <strong className="text-slate-300 font-mono">{lead.dob}</strong></span>}
                      </div>
                    )}

                    <div className="flex items-center gap-2">
                      <Zap className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span>Capacity: <strong className="text-slate-100">{lead.proposed_capacity_kw || 3.3} kW</strong></span>
                      {lead.consumer_number && (
                        <span className="text-[11px] font-mono text-slate-400 ml-auto bg-slate-800 px-1.5 py-0.5 rounded">
                          BP: {lead.consumer_number}
                        </span>
                      )}
                    </div>

                    <div className="text-[11px] text-slate-500">
                      Discom: <span className="text-slate-400">{lead.discom_name}</span>
                    </div>

                    {lead.notes && (
                      <p className="text-[11px] text-slate-400 bg-slate-800/60 p-2 rounded border border-slate-700/50 mt-1">
                        {lead.notes}
                      </p>
                    )}
                  </div>
                </div>

                {/* Card Actions & Stage Controls */}
                <div className="pt-3 mt-3 border-t border-slate-800 flex items-center justify-between gap-2">
                  {isConverted ? (
                    <div className="w-full flex items-center justify-between">
                      <span className="text-xs text-emerald-400 font-medium flex items-center gap-1">
                        <CheckCircle className="w-3.5 h-3.5" />
                        Customer Converted
                      </span>
                      {lead.converted_customer_id && (
                        <button
                          onClick={() => onOpenCustomer(lead.converted_customer_id!)}
                          className="text-xs text-amber-400 hover:text-amber-300 font-semibold underline flex items-center gap-1"
                        >
                          View Master <ArrowRight className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  ) : isLost ? (
                    <span className="text-xs text-rose-400 font-medium flex items-center gap-1">
                      <XCircle className="w-3.5 h-3.5" />
                      Lost / Disqualified
                    </span>
                  ) : (
                    <>
                      {/* Advance Stage Dropdown */}
                      <select
                        value={lead.stage}
                        onChange={(e) => handleStageChange(lead.id, e.target.value as LeadStageType)}
                        className="text-xs bg-slate-800 text-slate-300 border border-slate-700 rounded px-2 py-1 outline-none"
                      >
                        <option value="NEW">New</option>
                        <option value="CONTACTED">Contacted</option>
                        <option value="INTERESTED">Interested</option>
                        <option value="DOCUMENT_PENDING">Docs Pending</option>
                        <option value="READY_FOR_REGISTRATION">Ready for Portal</option>
                        <option value="LOST">Lost</option>
                      </select>

                      {/* Quotation Button (Lead -> Quotation Lifecycle Step) */}
                      <button
                        onClick={() => {
                          if (onQuoteLead) {
                            onQuoteLead(lead);
                          }
                        }}
                        className="flex items-center gap-1 px-2.5 py-1 rounded bg-amber-500/15 hover:bg-amber-500 text-amber-300 hover:text-slate-950 font-semibold text-xs border border-amber-500/30 transition-all cursor-pointer"
                        title="Generate Solar Quotation / Proposal for this Lead"
                      >
                        <FileText className="w-3 h-3" />
                        <span>Quote</span>
                      </button>

                      {/* Convert Button */}
                      {canConvertLeads && (
                        <button
                          onClick={() => setConvertTargetLead(lead)}
                          className="flex items-center gap-1 px-3 py-1 rounded bg-emerald-500/20 hover:bg-emerald-500 text-emerald-300 hover:text-slate-950 font-bold text-xs border border-emerald-500/40 transition-all shadow-sm cursor-pointer"
                        >
                          <span>Convert</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Convert Lead Modal */}
      <ConvertLeadModal
        lead={convertTargetLead}
        isOpen={!!convertTargetLead}
        onClose={() => setConvertTargetLead(null)}
        onConversionSuccess={(customerCode) => {
          setSuccessBanner(`Successfully converted! Customer Code: ${customerCode}. Open the PM Surya Ghar Consumer Portal to continue the customer’s registration.`);
          setShowPortalAction(true);
          setTimeout(() => setSuccessBanner(null), 15000);
        }}
      />

      {/* NEW SOLAR LEAD REGISTRATION MODAL (CHHATTISGARH ADDRESS HIERARCHY) */}
      {showNewLeadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in overflow-y-auto">
          <div className="w-full max-w-2xl bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden my-8">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/90">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-100">
                    New Solar Lead Registration
                  </h3>
                  <p className="text-xs text-slate-400">
                    Chhattisgarh PM Surya Ghar Rooftop Solar Lead Engine
                  </p>
                </div>
              </div>

              <button 
                onClick={() => {
                  setShowNewLeadModal(false);
                  if (onCloseNewLeadDirectly) onCloseNewLeadDirectly();
                }} 
                className="text-slate-400 hover:text-white p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateLead} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto custom-scrollbar">
              {userRole !== 'agent' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Register Lead Under Agent</label>
                  <select
                    value={newLeadForm.source_agent_id}
                    onChange={(e) => setNewLeadForm({ ...newLeadForm, source_agent_id: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-xs text-slate-100 focus:outline-none"
                  >
                    <option value="">Company / Office Lead (no agent)</option>
                    {availableAgents.map((agent) => (
                      <option key={agent.id} value={agent.id}>{agent.agent_code} — {agent.profile?.full_name || 'Agent'} ({agent.branch})</option>
                    ))}
                  </select>
                </div>
              )}
              {/* Personal Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Applicant Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={newLeadForm.full_name}
                    onChange={(e) => setNewLeadForm({ ...newLeadForm, full_name: e.target.value })}
                    placeholder="e.g. Ramesh Kumar Sahu"
                    className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-xs text-slate-100 focus:outline-none focus:border-amber-400"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Father's / Husband's Name
                  </label>
                  <input
                    type="text"
                    value={newLeadForm.father_name}
                    onChange={(e) => setNewLeadForm({ ...newLeadForm, father_name: e.target.value })}
                    placeholder="e.g. Ram Prasad Sahu"
                    className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-xs text-slate-100 focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Date of Birth (DOB)
                  </label>
                  <input
                    type="date"
                    value={newLeadForm.dob}
                    onChange={(e) => setNewLeadForm({ ...newLeadForm, dob: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-xs text-slate-100 focus:outline-none focus:border-amber-400"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Primary Mobile *
                  </label>
                  <input
                    type="tel"
                    required
                    pattern="[0-9]{10}"
                    value={newLeadForm.mobile}
                    onChange={(e) => setNewLeadForm({ ...newLeadForm, mobile: e.target.value })}
                    placeholder="10-digit mobile"
                    className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-xs text-slate-100 focus:outline-none focus:border-amber-400 font-mono"
                  />
                </div>
              </div>

              {/* CSPDCL & Connection Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Discom Circle (CSPDCL Powar Circle) *
                  </label>
                  <select
                    value={newLeadForm.discom_name}
                    onChange={(e) => setNewLeadForm({ ...newLeadForm, discom_name: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-xs text-slate-100 focus:outline-none"
                  >
                    <option value="CSPDCL (Raipur City Circle)">CSPDCL (Raipur City Circle)</option>
                    <option value="CSPDCL (Raipur Rural Circle)">CSPDCL (Raipur Rural Circle)</option>
                    <option value="CSPDCL (Durg Circle)">CSPDCL (Durg Circle)</option>
                    <option value="CSPDCL (Bilaspur Circle)">CSPDCL (Bilaspur Circle)</option>
                    <option value="CSPDCL (Rajnandgaon Circle)">CSPDCL (Rajnandgaon Circle)</option>
                    <option value="CSPDCL (Korba Circle)">CSPDCL (Korba Circle)</option>
                    <option value="CSPDCL (Bastar / Jagdalpur)">CSPDCL (Bastar / Jagdalpur)</option>
                    <option value="CSPDCL (Surguja / Ambikapur)">CSPDCL (Surguja / Ambikapur)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Electricity Consumer Number (BP No / Consumer No)
                  </label>
                  <input
                    type="text"
                    value={newLeadForm.consumer_number}
                    onChange={(e) => setNewLeadForm({ ...newLeadForm, consumer_number: e.target.value })}
                    placeholder="e.g. 10029485731 (from electricity bill)"
                    className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-xs text-slate-100 focus:outline-none focus:border-amber-400 font-mono"
                  />
                </div>
              </div>

              {/* Solar Proposed Specs */}
              <div className="grid grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Proposed Solar Capacity (Proposed kW)
                  </label>
                  <select
                    value={newLeadForm.proposed_capacity_kw}
                    onChange={(e) => setNewLeadForm({ ...newLeadForm, proposed_capacity_kw: parseFloat(e.target.value) })}
                    className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-xs text-slate-100 focus:outline-none font-semibold text-amber-400"
                  >
                    <option value="1.0">1.0 kW (Subsidy: ₹30,000)</option>
                    <option value="2.0">2.0 kW (Subsidy: ₹60,000)</option>
                    <option value="3.0">3.0 kW (Subsidy: ₹78,000 Max)</option>
                    <option value="3.3">3.3 kW (Subsidy: ₹78,000)</option>
                    <option value="4.0">4.0 kW (Subsidy: ₹78,000)</option>
                    <option value="5.0">5.0 kW (Subsidy: ₹78,000)</option>
                    <option value="10.0">10.0 kW Commercial / Residential</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Current Sanctioned Load (kW)
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    value={newLeadForm.sanctioned_load_kw}
                    onChange={(e) => setNewLeadForm({ ...newLeadForm, sanctioned_load_kw: parseFloat(e.target.value) })}
                    className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-xs text-slate-100 focus:outline-none"
                  />
                </div>
              </div>

              {/* CHHATTISGARH ADDRESS HIERARCHY (AS REQUESTED) */}
              <div className="bg-slate-950/70 p-4 rounded-xl border border-slate-800 space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold text-amber-400 uppercase tracking-wider">
                  <MapPin className="w-4 h-4" />
                  <span>Geographic Location Hierarchy (State, District, Tehsil, Block, Village)</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">State *</label>
                    <input
                      type="text"
                      required
                      value={newLeadForm.state}
                      onChange={(e) => setNewLeadForm({ ...newLeadForm, state: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-xs text-slate-100 font-semibold focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">District *</label>
                    <select
                      value={newLeadForm.district}
                      onChange={(e) => setNewLeadForm({ ...newLeadForm, district: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-xs text-slate-100 focus:outline-none font-semibold text-amber-300"
                    >
                      {CHHATTISGARH_DISTRICTS.map((dist) => (
                        <option key={dist} value={dist}>{dist}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Tehsil *
                    </label>
                    <input
                      type="text"
                      required
                      value={newLeadForm.tehsil}
                      onChange={(e) => setNewLeadForm({ ...newLeadForm, tehsil: e.target.value })}
                      placeholder="e.g. Jaijaipur / Sakti"
                      className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-xs text-slate-100 focus:outline-none focus:border-amber-400"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Block *
                    </label>
                    <input
                      type="text"
                      required
                      value={newLeadForm.block}
                      onChange={(e) => setNewLeadForm({ ...newLeadForm, block: e.target.value })}
                      placeholder="e.g. Jaijaipur / Sakti"
                      className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-xs text-slate-100 focus:outline-none focus:border-amber-400"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Panchayat / Village *
                    </label>
                    <input
                      type="text"
                      required
                      value={newLeadForm.panchayat_village}
                      onChange={(e) => setNewLeadForm({ ...newLeadForm, panchayat_village: e.target.value })}
                      placeholder="e.g. Baradwar / Ourda"
                      className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-xs text-slate-100 focus:outline-none focus:border-amber-400"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      House / Street Address
                    </label>
                    <input
                      type="text"
                      value={newLeadForm.address_line}
                      onChange={(e) => setNewLeadForm({ ...newLeadForm, address_line: e.target.value })}
                      placeholder="House No, Main Road, Landmark"
                      className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-xs text-slate-100 focus:outline-none focus:border-amber-400"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Pincode
                    </label>
                    <input
                      type="text"
                      maxLength={6}
                      value={newLeadForm.pincode}
                      onChange={(e) => setNewLeadForm({ ...newLeadForm, pincode: e.target.value })}
                      placeholder="e.g. 495690"
                      className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-xs text-slate-100 font-mono focus:outline-none focus:border-amber-400"
                    />
                  </div>
                </div>
              </div>

              {/* Rooftop notes */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Site Notes / Rooftop Conditions
                </label>
                <textarea
                  rows={2}
                  value={newLeadForm.notes}
                  onChange={(e) => setNewLeadForm({ ...newLeadForm, notes: e.target.value })}
                  placeholder="Shadow-free rooftop area, tin shed / RCC roof, electricity bill history..."
                  className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-xs text-slate-100 focus:outline-none focus:border-amber-400"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setShowNewLeadModal(false);
                    if (onCloseNewLeadDirectly) onCloseNewLeadDirectly();
                  }}
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-xs font-bold text-slate-950 shadow-lg shadow-emerald-500/20"
                >
                  Save Lead
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
