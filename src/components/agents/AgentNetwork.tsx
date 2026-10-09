import React, { useState, useEffect } from 'react';
import { Agent, BranchLocation, DocumentRecord } from '../../types/database';
import { agentNetworkService } from '../../services/agentNetworkService';
import { documentService } from '../../services/documentService';
import { erpStore } from '../../services/erpStore';
import { useAuth } from '../../context/AuthContext';
import { STANDARD_COMMISSION_RATES } from '../../lib/constants';
import { BRANCHES_LIST } from '../../services/mockData';
import { 
  Layers, 
  Users, 
  ShieldCheck, 
  Plus, 
  Building, 
  Award, 
  EyeOff, 
  Copy, 
  Check, 
  Search, 
  Filter, 
  Phone, 
  Mail, 
  MapPin, 
  Lock, 
  Wallet, 
  ExternalLink,
  FileText,
  Upload,
  CheckCircle2,
  XCircle,
  Clock,
  X,
  FileCheck,
  Eye,
  AlertCircle
} from 'lucide-react';

export const AgentNetwork: React.FC = () => {
  const { userRole, canViewSensitiveAgentPii } = useAuth();
  const [agents, setAgents] = useState<Agent[]>(erpStore.getAgents());
  const [showNewAgentModal, setShowNewAgentModal] = useState(false);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [newlyCreatedAgent, setNewlyCreatedAgent] = useState<Agent | null>(null);

  // Search & Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [branchFilter, setBranchFilter] = useState<string>('ALL');
  const [levelFilter, setLevelFilter] = useState<string>('ALL');
  const [showCommissionRules, setShowCommissionRules] = useState(false);

  // Selected Agent for KYC & Documents Drawer
  const [selectedAgentForKyc, setSelectedAgentForKyc] = useState<Agent | null>(null);
  const [drawerDocCategory, setDrawerDocCategory] = useState<string>('aadhaar');
  const [drawerDocFile, setDrawerDocFile] = useState<File | null>(null);
  const [isUploadingDrawerDoc, setIsUploadingDrawerDoc] = useState(false);

  // Rejection modal in drawer
  const [rejectDocId, setRejectDocId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  // Form state without manual hierarchy position (Automatic Sponsor replacement rule)
  const [newAgentForm, setNewAgentForm] = useState({
    full_name: '',
    phone: '',
    email: '',
    branch: 'Jaijaipur' as BranchLocation,
    sponsor_agent_id: '',
    login_password: '',
    pan_number: '',
    bank_account_no: '',
    bank_name: '',
    bank_ifsc: '',
    tds_percentage: 5.0,
  });

  // Required KYC Documents for Agent Onboarding
  const [panFile, setPanFile] = useState<File | null>(null);
  const [aadhaarFrontFile, setAadhaarFrontFile] = useState<File | null>(null);
  const [aadhaarBackFile, setAadhaarBackFile] = useState<File | null>(null);
  const [bankProofFile, setBankProofFile] = useState<File | null>(null);

  const [isSubmittingOnboarding, setIsSubmittingOnboarding] = useState(false);

  const loadData = async () => {
    try {
      const rows = await agentNetworkService.list();
      setAgents(rows);
    } catch (error: any) {
      console.error('Agent Network load error:', error);
      setErrorBanner(error?.message || 'Failed to load agent network from Supabase backend.');
    }
  };

  useEffect(() => {
    // Authoritative single-store sync
    setAgents(erpStore.getAgents());
    const unsub = erpStore.subscribe(() => {
      setAgents(erpStore.getAgents());
    });
    void loadData();
    return unsub;
  }, []);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  const handleCreateAgent = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorBanner(null);

    if (!newAgentForm.full_name || !newAgentForm.phone || !newAgentForm.email) {
      alert('Please enter agent full name, mobile number, and email address.');
      return;
    }

    if (!newAgentForm.pan_number) {
      alert('PAN Card Number is mandatory for agent statutory TDS registration.');
      return;
    }

    // Mandatory document checks per business rule (Sections 7-11)
    if (!panFile) {
      alert('PAN Card document upload is mandatory for agent onboarding.');
      return;
    }
    if (!aadhaarFrontFile) {
      alert('Aadhaar Card Front document upload is mandatory.');
      return;
    }
    if (!aadhaarBackFile) {
      alert('Aadhaar Card Back document upload is mandatory.');
      return;
    }
    if (!bankProofFile) {
      alert('Bank Proof (Passbook or Cancelled Cheque) document upload is mandatory.');
      return;
    }

    setIsSubmittingOnboarding(true);

    const defaultPwd =
      newAgentForm.login_password ||
      `${newAgentForm.full_name.split(' ')[0]}@${newAgentForm.branch}2026`;

    try {
      // 1. Create Agent record
      const result = await agentNetworkService.create({
        full_name: newAgentForm.full_name,
        phone: newAgentForm.phone,
        email: newAgentForm.email,
        branch: newAgentForm.branch,
        sponsor_agent_id: newAgentForm.sponsor_agent_id || undefined,
        password: defaultPwd,
        pan_number: newAgentForm.pan_number || undefined,
        bank_account_no: newAgentForm.bank_account_no || undefined,
        bank_name: newAgentForm.bank_name || undefined,
        bank_ifsc: newAgentForm.bank_ifsc || undefined,
        tds_percentage: Number(newAgentForm.tds_percentage),
      });

      const agentId = result.agent_id;

      // 2. Upload mandatory KYC documents in parallel
      await Promise.all([
        documentService.uploadDocument(panFile, 'agents', agentId, 'pan', false),
        documentService.uploadDocument(aadhaarFrontFile, 'agents', agentId, 'aadhaar_front', false),
        documentService.uploadDocument(aadhaarBackFile, 'agents', agentId, 'aadhaar_back', false),
        documentService.uploadDocument(bankProofFile, 'agents', agentId, 'bank_proof', false),
      ]);

      await loadData();

      const createdAgent = erpStore.getAgents().find(
        (agent) => agent.id === agentId
      );

      if (createdAgent) {
        setNewlyCreatedAgent(createdAgent);
      }

      setShowNewAgentModal(false);
      setSuccessBanner(
        `Agent ${result.agent_code} (${newAgentForm.full_name}) successfully onboarded with 4 verified KYC documents!`
      );
      setTimeout(() => setSuccessBanner(null), 6000);

      // Reset form
      setNewAgentForm({
        full_name: '',
        phone: '',
        email: '',
        branch: 'Jaijaipur',
        sponsor_agent_id: '',
        login_password: '',
        pan_number: '',
        bank_account_no: '',
        bank_name: '',
        bank_ifsc: '',
        tds_percentage: 5.0,
      });
      setPanFile(null);
      setAadhaarFrontFile(null);
      setAadhaarBackFile(null);
      setBankProofFile(null);
    } catch (error) {
      console.error('Agent onboarding failed:', error);
      setErrorBanner(error instanceof Error ? error.message : 'Agent onboarding failed.');
    } finally {
      setIsSubmittingOnboarding(false);
    }
  };

  const handleUploadDrawerDoc = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAgentForKyc || !drawerDocFile) {
      alert('Please select a document file.');
      return;
    }

    setIsUploadingDrawerDoc(true);
    try {
      await documentService.uploadDocument(
        drawerDocFile,
        'agents',
        selectedAgentForKyc.id,
        drawerDocCategory,
        false
      );
      setDrawerDocFile(null);
      alert('Document uploaded successfully to Agent KYC Vault.');
    } catch (err: any) {
      console.error('Drawer document upload failed:', err);
      alert(err?.message || 'Failed to upload document.');
    } finally {
      setIsUploadingDrawerDoc(false);
    }
  };

  const handleVerifyAgentDoc = async (docId: string) => {
    try {
      await documentService.verifyDocument(docId);
      alert('Document marked as VERIFIED.');
    } catch (err: any) {
      alert(err?.message || 'Verification failed.');
    }
  };

  const handleRejectAgentDocConfirm = async () => {
    if (!rejectDocId || !rejectReason.trim()) {
      alert('Please specify rejection reason.');
      return;
    }
    try {
      await documentService.rejectDocument(rejectDocId, rejectReason.trim());
      setRejectDocId(null);
      setRejectReason('');
      alert('Document marked as REJECTED.');
    } catch (err: any) {
      alert(err?.message || 'Rejection failed.');
    }
  };

  // Filtered Agent List
  const filteredAgents = agents.filter((agent) => {
    const q = searchQuery.toLowerCase();
    const sponsor = agents.find((a) => a.id === agent.sponsor_agent_id);

    const matchesSearch = 
      agent.agent_code.toLowerCase().includes(q) ||
      (agent.profile?.full_name || '').toLowerCase().includes(q) ||
      (agent.profile?.phone || '').includes(q) ||
      (agent.profile?.email || '').toLowerCase().includes(q) ||
      (agent.branch || '').toLowerCase().includes(q) ||
      (sponsor?.profile?.full_name || '').toLowerCase().includes(q);

    const matchesBranch = branchFilter === 'ALL' || agent.branch === branchFilter;
    const matchesLevel = levelFilter === 'ALL' || String(agent.hierarchy_level) === levelFilter;

    return matchesSearch && matchesBranch && matchesLevel;
  });

  // Current documents for selected drawer agent
  const selectedAgentDocuments = selectedAgentForKyc
    ? erpStore.getDocuments({ entityType: 'agents', entityId: selectedAgentForKyc.id })
    : [];

  return (
    <div className="space-y-6 animate-fade-in font-sans">
      {/* Toast / Success Notification */}
      {errorBanner && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex items-center justify-between">
          <span>{errorBanner}</span>
          <button onClick={() => setErrorBanner(null)} className="text-red-400 hover:text-white">✕</button>
        </div>
      )}

      {successBanner && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center justify-between">
          <span>{successBanner}</span>
          <button onClick={() => setSuccessBanner(null)} className="text-emerald-400 hover:text-white">✕</button>
        </div>
      )}

      {/* Newly Created Agent Credentials Banner */}
      {newlyCreatedAgent && (
        <div className="p-5 rounded-2xl bg-gradient-to-r from-emerald-950/80 to-slate-900 border-2 border-emerald-500/50 shadow-xl space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              <h3 className="text-sm font-bold text-emerald-300">
                Agent Successfully Registered with Full KYC Documentation
              </h3>
            </div>
            <button onClick={() => setNewlyCreatedAgent(null)} className="text-slate-400 hover:text-white text-xs">
              Dismiss
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-950/70 p-3 rounded-xl border border-emerald-500/30 text-xs font-mono">
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-sans">Agent Code</span>
              <span className="text-amber-400 font-bold">{newlyCreatedAgent.agent_code}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-sans">Branch</span>
              <span className="text-slate-200">{newlyCreatedAgent.branch}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-sans">Phone</span>
              <span className="text-slate-200">{newlyCreatedAgent.profile?.phone}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-sans">Login Email</span>
              <span className="text-emerald-400 font-bold bg-emerald-950/50 px-2 py-0.5 rounded">
                {newlyCreatedAgent.profile?.email || 'Invitation flow'}
              </span>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <button
              onClick={() => setSelectedAgentForKyc(newlyCreatedAgent)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 text-xs font-bold border border-slate-700"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>View Uploaded KYC Documents</span>
            </button>
            <button
              onClick={() => handleCopy(
                `BNPS ERP Agent Login Credentials:\nBranch: ${newlyCreatedAgent.branch}\nAgent ID: ${newlyCreatedAgent.agent_code}\nName: ${newlyCreatedAgent.profile?.full_name}\nLogin: ${newlyCreatedAgent.profile?.phone} / ${newlyCreatedAgent.profile?.email}\nLogin email: ${newlyCreatedAgent.profile?.email || 'Invitation sent'}`,
                newlyCreatedAgent.id
              )}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow transition-all cursor-pointer"
            >
              {copiedId === newlyCreatedAgent.id ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedId === newlyCreatedAgent.id ? 'Copied to Clipboard!' : 'Copy Agent Credentials'}</span>
            </button>
          </div>
        </div>
      )}

      {/* Header & Hierarchy Overview */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-900/80 p-4 rounded-xl border border-slate-800">
        <div>
          <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
            <Layers className="w-5 h-5 text-amber-400" />
            <span>Agent Network Roster (Authoritative Operational Master)</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-amber-400 font-mono font-bold border border-slate-700">
              {filteredAgents.length} Active Operational Agents
            </span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Synchronized with ERP Master • Single authoritative dataset for Sidebar, Tree View, and Agent Master
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowCommissionRules(!showCommissionRules)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700 transition-all cursor-pointer"
          >
            <Award className="w-4 h-4 text-amber-400" />
            <span>{showCommissionRules ? 'Hide 10-Tier Rules' : '10-Tier Rules'}</span>
          </button>

          <button
            onClick={() => setShowNewAgentModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold shadow-md shadow-amber-500/20 whitespace-nowrap transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>+ Onboard New Agent (with KYC)</span>
          </button>
        </div>
      </div>

      {/* Collapsible Commission Structure Rules */}
      {showCommissionRules && (
        <div className="bg-slate-900/90 rounded-xl p-4 border border-slate-800 animate-fade-in">
          <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-2">
            <Award className="w-4 h-4 text-amber-400" />
            <span>Active 10-Tier Commission Rules (BNPS Specification)</span>
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
            {Object.entries(STANDARD_COMMISSION_RATES).map(([pos, data]) => (
              <div key={pos} className="p-2.5 rounded-lg bg-slate-800/70 border border-slate-700/60">
                <div className="flex justify-between items-center">
                  <span className="font-mono text-amber-400 font-bold">Level {pos}</span>
                  <span className="font-mono text-emerald-400 font-bold bg-emerald-950/60 px-1.5 py-0.5 rounded text-[11px]">
                    {data.ratePercent}%
                  </span>
                </div>
                <div className="text-[11px] text-slate-400 mt-1 truncate" title={data.title}>
                  {pos === '10' ? 'Direct Sourcing Agent' : pos === '9' ? 'Immediate Sponsor' : `Upline Level ${pos}`}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sensitive PII Status Alert */}
      <div className={`p-3.5 rounded-xl border flex items-center justify-between text-xs ${
        canViewSensitiveAgentPii
          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
          : 'bg-amber-500/10 border-amber-500/30 text-amber-300'
      }`}>
        <div className="flex items-center gap-2.5">
          {canViewSensitiveAgentPii ? (
            <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
          ) : (
            <EyeOff className="w-5 h-5 text-amber-400 shrink-0" />
          )}
          <div>
            <span className="font-bold block">
              {canViewSensitiveAgentPii
                ? 'Role Privilege Active: Authorized to view Sensitive Agent Financial & PII Data'
                : 'Security Shield Active: Sensitive Banking & PAN Data Protected'}
            </span>
            <span className="text-[11px] opacity-80">
              {canViewSensitiveAgentPii
                ? `Logged in as ${userRole.toUpperCase()}. Sensitive fields (PAN, Bank Account, IFSC) unmasked.`
                : 'Agents and non-admin roles cannot view downline banking credentials or PAN numbers.'}
            </span>
          </div>
        </div>

        <span className="font-mono text-[10px] px-2 py-1 rounded bg-slate-900 border border-slate-700 text-slate-300">
          Role: {userRole}
        </span>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="bg-slate-900/90 rounded-xl p-4 border border-slate-800 flex flex-col md:flex-row items-center gap-3 shadow-md">
        {/* Instant Search Bar */}
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-amber-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search particular agent by full name, code, phone number, branch, or sponsor..."
            className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-9 pr-20 py-2.5 text-xs text-slate-100 placeholder-slate-400 focus:outline-none focus:border-amber-400 shadow-inner"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-slate-400 hover:text-white bg-slate-800 px-2 py-0.5 rounded cursor-pointer"
            >
              Clear
            </button>
          )}
        </div>

        {/* Branch Filter */}
        <div className="flex items-center gap-2 w-full md:w-auto">
          <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-2 text-xs">
            <Building className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={branchFilter}
              onChange={(e) => setBranchFilter(e.target.value)}
              className="bg-transparent text-slate-200 focus:outline-none text-xs"
            >
              <option value="ALL">All Branches (Chhattisgarh)</option>
              {BRANCHES_LIST.map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </div>

          {/* Level Filter */}
          <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-2 text-xs">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={levelFilter}
              onChange={(e) => setLevelFilter(e.target.value)}
              className="bg-transparent text-slate-200 focus:outline-none text-xs"
            >
              <option value="ALL">All Tiers (1-10)</option>
              <option value="10">Tier 10 (Direct Agent - 7%)</option>
              <option value="9">Tier 9 (Immediate Sponsor - 1%)</option>
              <option value="8">Tier 8 (Upline - 1%)</option>
              <option value="7">Tier 7 (Upline - 1%)</option>
              <option value="6">Tier 6 (Upline - 1%)</option>
              <option value="5">Tier 5 (Upline - 1%)</option>
              <option value="4">Tier 4 (Upline - 1%)</option>
              <option value="3">Tier 3 (Upline - 0.5%)</option>
              <option value="2">Tier 2 (Upline - 0.5%)</option>
              <option value="1">Tier 1 (Super Upline - 0.5%)</option>
            </select>
          </div>
        </div>
      </div>

      {/* AGENT ROW TABLE */}
      <div className="overflow-x-auto border border-slate-800 rounded-2xl shadow-xl bg-slate-900/90">
        <table className="w-full text-xs text-left">
          <thead className="bg-slate-950 text-slate-400 font-semibold border-b border-slate-800 text-[11px] uppercase tracking-wider">
            <tr>
              <th className="p-3.5">Agent Code / Tier</th>
              <th className="p-3.5">Full Name & Contact</th>
              <th className="p-3.5">Branch Location</th>
              <th className="p-3.5">Upline Sponsor</th>
              <th className="p-3.5 text-right">Commission Earned</th>
              <th className="p-3.5 text-right">Paid Out</th>
              <th className="p-3.5 text-right">Advance Balance</th>
              <th className="p-3.5">Banking & PAN</th>
              <th className="p-3.5 text-center">Status</th>
              <th className="p-3.5 text-center">Actions & KYC</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/80 text-slate-200">
            {filteredAgents.length === 0 ? (
              <tr>
                <td colSpan={10} className="p-12 text-center text-slate-500">
                  No agents found matching your search query or filters.
                </td>
              </tr>
            ) : (
              filteredAgents.map((agent) => {
                const sponsor = agents.find((a) => a.id === agent.sponsor_agent_id);
                const isOwnProfile = agent.id === 'ag-mukesh-101' && userRole === 'agent';
                const canViewPii = canViewSensitiveAgentPii || isOwnProfile;
                const agentDocs = erpStore.getDocuments({ entityType: 'agents', entityId: agent.id });

                return (
                  <tr key={agent.id} className="hover:bg-slate-800/40 transition-colors">
                    {/* Code & Tier */}
                    <td className="p-3.5">
                      <div className="font-mono font-bold text-amber-400">{agent.agent_code}</div>
                      <span className="inline-block mt-1 text-[10px] px-2 py-0.5 rounded font-mono font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                        Tier {agent.hierarchy_level}
                      </span>
                    </td>

                    {/* Name & Contact */}
                    <td className="p-3.5">
                      <div 
                        onClick={() => setSelectedAgentForKyc(agent)}
                        className="font-bold text-slate-100 text-sm hover:text-amber-400 cursor-pointer flex items-center gap-1.5"
                      >
                        <span>{agent.profile?.full_name}</span>
                        <ExternalLink className="w-3 h-3 text-slate-500 hover:text-amber-400" />
                      </div>
                      <div className="text-xs text-slate-400 flex items-center gap-1 font-mono mt-0.5">
                        <Phone className="w-3 h-3 text-slate-500" />
                        <span>{agent.profile?.phone}</span>
                      </div>
                      {agent.profile?.email && (
                        <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                          <Mail className="w-3 h-3 text-slate-500" />
                          <span>{agent.profile.email}</span>
                        </div>
                      )}
                    </td>

                    {/* Branch */}
                    <td className="p-3.5">
                      <div className="flex items-center gap-1 text-slate-200 font-medium">
                        <MapPin className="w-3 h-3 text-amber-400 shrink-0" />
                        <span>{agent.branch || 'Jaijaipur'}</span>
                      </div>
                      <span className="text-[10px] text-slate-500">Chhattisgarh</span>
                    </td>

                    {/* Sponsor */}
                    <td className="p-3.5">
                      {sponsor ? (
                        <div>
                          <div className="text-slate-200 font-semibold">{sponsor.profile?.full_name}</div>
                          <div className="text-[10px] font-mono text-slate-400">{sponsor.agent_code}</div>
                        </div>
                      ) : (
                        <span className="text-[11px] text-emerald-400 font-mono">Company (Direct Root)</span>
                      )}
                    </td>

                    {/* Commission Earned */}
                    <td className="p-3.5 text-right font-mono font-bold text-emerald-400">
                      ₹{agent.total_commission_earned.toLocaleString('en-IN')}
                    </td>

                    {/* Paid Out */}
                    <td className="p-3.5 text-right font-mono text-slate-300">
                      ₹{agent.total_commission_paid.toLocaleString('en-IN')}
                    </td>

                    {/* Advance */}
                    <td className="p-3.5 text-right font-mono text-amber-400 font-semibold">
                      ₹{agent.outstanding_advance.toLocaleString('en-IN')}
                    </td>

                    {/* Banking & PAN */}
                    <td className="p-3.5 text-[11px]">
                      {canViewPii ? (
                        <div className="space-y-0.5">
                          <div>PAN: <span className="font-mono text-slate-300">{agent.pan_number || 'N/A'}</span></div>
                          <div>Bank: <span className="font-mono text-slate-400">{agent.bank_name || 'PNB'} ({agent.bank_account_no?.slice(-4) ? `••${agent.bank_account_no.slice(-4)}` : 'N/A'})</span></div>
                        </div>
                      ) : (
                        <span className="text-slate-500 italic text-[10px]">•••• Protected</span>
                      )}
                    </td>

                    {/* Status */}
                    <td className="p-3.5 text-center">
                      <span className="inline-block px-2 py-0.5 rounded-full font-mono text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                        Active
                      </span>
                    </td>

                    {/* Actions & KYC */}
                    <td className="p-3.5 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        {/* View Profile & KYC Documents Button */}
                        <button
                          onClick={() => setSelectedAgentForKyc(agent)}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500 text-amber-300 hover:text-slate-950 font-bold text-[11px] border border-amber-500/30 transition cursor-pointer"
                          title="View Profile & KYC Documents"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          <span>KYC ({agentDocs.length})</span>
                        </button>

                        <button
                          onClick={() => handleCopy(
                            `Agent: ${agent.agent_code} (${agent.profile?.full_name})\nPhone: ${agent.profile?.phone}\nBranch: ${agent.branch}\nTier: ${agent.hierarchy_level}`,
                            agent.id
                          )}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition cursor-pointer"
                          title="Copy Agent Details"
                        >
                          {copiedId === agent.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
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

      {/* ONBOARD AGENT MODAL (WITH FULL MANDATORY KYC DOCUMENT UPLOADS) */}
      {showNewAgentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in overflow-y-auto">
          <div className="w-full max-w-2xl bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden my-6">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/90">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center">
                  <Plus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-100">Onboard New Solar Agent (Solar Mitra)</h3>
                  <p className="text-xs text-slate-400">Complete Basic Info, Statutory PAN, Banking & Mandatory KYC Documents</p>
                </div>
              </div>
              <button 
                onClick={() => setShowNewAgentModal(false)} 
                className="text-slate-400 hover:text-white p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateAgent} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto custom-scrollbar">
              {/* Basic Information */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5" />
                  <span>1. Agent Identity & Contact</span>
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Agent Full Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Rameshwar Kashyap"
                      value={newAgentForm.full_name}
                      onChange={(e) => setNewAgentForm({ ...newAgentForm, full_name: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-400"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Mobile Number (WhatsApp) *</label>
                    <input
                      type="tel"
                      required
                      maxLength={10}
                      placeholder="e.g. 9826012345"
                      value={newAgentForm.phone}
                      onChange={(e) => setNewAgentForm({ ...newAgentForm, phone: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-xs font-mono text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-400"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Email Address *</label>
                    <input
                      type="email"
                      required
                      placeholder="e.g. rameshwar.solar@gmail.com"
                      value={newAgentForm.email}
                      onChange={(e) => setNewAgentForm({ ...newAgentForm, email: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-400"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Branch Location (Chhattisgarh) *</label>
                    <select
                      value={newAgentForm.branch}
                      onChange={(e) => setNewAgentForm({ ...newAgentForm, branch: e.target.value as BranchLocation })}
                      className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-xs text-slate-100 focus:outline-none focus:border-amber-400"
                    >
                      {BRANCHES_LIST.map((b) => (
                        <option key={b} value={b}>{b === 'Jaijaipur' ? 'Jaijaipur (HQ)' : b}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Upline Sponsor (Automatic 10-Tier Placement)
                  </label>
                  <select
                    value={newAgentForm.sponsor_agent_id}
                    onChange={(e) => setNewAgentForm({ ...newAgentForm, sponsor_agent_id: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-xs text-slate-100 focus:outline-none focus:border-amber-400"
                  >
                    <option value="">No Sponsor — Direct Company Root (Level 10)</option>
                    {agents.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.agent_code} • {a.profile?.full_name} (Tier {a.hierarchy_level} - {a.branch})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Banking & Statutory Details */}
              <div className="space-y-3 pt-3 border-t border-slate-800">
                <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Wallet className="w-3.5 h-3.5" />
                  <span>2. Financial & TDS Credentials</span>
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">PAN Card Number *</label>
                    <input
                      type="text"
                      required
                      maxLength={10}
                      value={newAgentForm.pan_number}
                      onChange={(e) => setNewAgentForm({ ...newAgentForm, pan_number: e.target.value.toUpperCase() })}
                      placeholder="ABCDE1234F"
                      className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-xs font-mono text-slate-100 placeholder-slate-500 uppercase focus:outline-none focus:border-amber-400"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">TDS Withholding Rate (%)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={newAgentForm.tds_percentage}
                      onChange={(e) => setNewAgentForm({ ...newAgentForm, tds_percentage: Number(e.target.value) })}
                      className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-xs font-mono text-slate-100 focus:outline-none focus:border-amber-400"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Bank Name</label>
                    <input
                      type="text"
                      value={newAgentForm.bank_name}
                      onChange={(e) => setNewAgentForm({ ...newAgentForm, bank_name: e.target.value })}
                      placeholder="e.g. State Bank of India"
                      className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-xs text-slate-100 focus:outline-none focus:border-amber-400"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Account Number</label>
                    <input
                      type="text"
                      value={newAgentForm.bank_account_no}
                      onChange={(e) => setNewAgentForm({ ...newAgentForm, bank_account_no: e.target.value })}
                      placeholder="A/C Number"
                      className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-xs font-mono text-slate-100 focus:outline-none focus:border-amber-400"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">IFSC Code</label>
                    <input
                      type="text"
                      value={newAgentForm.bank_ifsc}
                      onChange={(e) => setNewAgentForm({ ...newAgentForm, bank_ifsc: e.target.value.toUpperCase() })}
                      placeholder="SBIN0001234"
                      className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-xs font-mono text-slate-100 uppercase focus:outline-none focus:border-amber-400"
                    />
                  </div>
                </div>
              </div>

              {/* MANDATORY KYC DOCUMENTS (SECTIONS 7-11) */}
              <div className="space-y-3 pt-3 border-t border-slate-800 bg-slate-950/50 p-4 rounded-xl border border-slate-800">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                    <FileCheck className="w-4 h-4 text-emerald-400" />
                    <span>3. Mandatory KYC Document Uploads *</span>
                  </h4>
                  <span className="text-[10px] text-emerald-400 font-mono bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-500/30">
                    4 Documents Required
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {/* Document 1: PAN Card */}
                  <div className="p-3 bg-slate-900 rounded-lg border border-slate-800 space-y-1.5">
                    <label className="block text-[11px] font-semibold text-slate-200">
                      1. PAN Card Document (Identity & TDS) *
                    </label>
                    <input
                      type="file"
                      required
                      accept="application/pdf,image/jpeg,image/png"
                      onChange={(e) => setPanFile(e.target.files?.[0] || null)}
                      className="w-full text-[11px] text-slate-300 file:mr-2 file:py-1 file:px-2.5 file:rounded file:border-0 file:text-[11px] file:font-semibold file:bg-slate-800 file:text-amber-400 bg-slate-950 border border-slate-700 rounded p-1 cursor-pointer"
                    />
                    {panFile && (
                      <span className="text-[10px] text-emerald-400 flex items-center gap-1">
                        <Check className="w-3 h-3" /> {panFile.name} ({(panFile.size / 1024).toFixed(0)} KB)
                      </span>
                    )}
                  </div>

                  {/* Document 2: Bank Proof */}
                  <div className="p-3 bg-slate-900 rounded-lg border border-slate-800 space-y-1.5">
                    <label className="block text-[11px] font-semibold text-slate-200">
                      2. Bank Proof (Passbook / Cheque) *
                    </label>
                    <input
                      type="file"
                      required
                      accept="application/pdf,image/jpeg,image/png"
                      onChange={(e) => setBankProofFile(e.target.files?.[0] || null)}
                      className="w-full text-[11px] text-slate-300 file:mr-2 file:py-1 file:px-2.5 file:rounded file:border-0 file:text-[11px] file:font-semibold file:bg-slate-800 file:text-amber-400 bg-slate-950 border border-slate-700 rounded p-1 cursor-pointer"
                    />
                    {bankProofFile && (
                      <span className="text-[10px] text-emerald-400 flex items-center gap-1">
                        <Check className="w-3 h-3" /> {bankProofFile.name} ({(bankProofFile.size / 1024).toFixed(0)} KB)
                      </span>
                    )}
                  </div>

                  {/* Document 3: Aadhaar Front */}
                  <div className="p-3 bg-slate-900 rounded-lg border border-slate-800 space-y-1.5">
                    <label className="block text-[11px] font-semibold text-slate-200">
                      3. Aadhaar Card (Front Side) *
                    </label>
                    <input
                      type="file"
                      required
                      accept="application/pdf,image/jpeg,image/png"
                      onChange={(e) => setAadhaarFrontFile(e.target.files?.[0] || null)}
                      className="w-full text-[11px] text-slate-300 file:mr-2 file:py-1 file:px-2.5 file:rounded file:border-0 file:text-[11px] file:font-semibold file:bg-slate-800 file:text-amber-400 bg-slate-950 border border-slate-700 rounded p-1 cursor-pointer"
                    />
                    {aadhaarFrontFile && (
                      <span className="text-[10px] text-emerald-400 flex items-center gap-1">
                        <Check className="w-3 h-3" /> {aadhaarFrontFile.name} ({(aadhaarFrontFile.size / 1024).toFixed(0)} KB)
                      </span>
                    )}
                  </div>

                  {/* Document 4: Aadhaar Back */}
                  <div className="p-3 bg-slate-900 rounded-lg border border-slate-800 space-y-1.5">
                    <label className="block text-[11px] font-semibold text-slate-200">
                      4. Aadhaar Card (Back Side / Address) *
                    </label>
                    <input
                      type="file"
                      required
                      accept="application/pdf,image/jpeg,image/png"
                      onChange={(e) => setAadhaarBackFile(e.target.files?.[0] || null)}
                      className="w-full text-[11px] text-slate-300 file:mr-2 file:py-1 file:px-2.5 file:rounded file:border-0 file:text-[11px] file:font-semibold file:bg-slate-800 file:text-amber-400 bg-slate-950 border border-slate-700 rounded p-1 cursor-pointer"
                    />
                    {aadhaarBackFile && (
                      <span className="text-[10px] text-emerald-400 flex items-center gap-1">
                        <Check className="w-3 h-3" /> {aadhaarBackFile.name} ({(aadhaarBackFile.size / 1024).toFixed(0)} KB)
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowNewAgentModal(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingOnboarding}
                  className="px-6 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-xs text-slate-950 font-bold shadow-lg shadow-amber-500/20 cursor-pointer"
                >
                  {isSubmittingOnboarding ? 'Saving & Uploading Documents...' : 'Confirm & Onboard Agent with KYC'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* AGENT PROFILE & KYC DOCUMENTS DRAWER */}
      {selectedAgentForKyc && (
        <div className="fixed inset-0 z-50 flex items-center justify-end bg-slate-950/75 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-xl h-full bg-slate-900 border-l border-slate-700 shadow-2xl flex flex-col overflow-hidden animate-slide-left">
            {/* Drawer Header */}
            <div className="p-6 border-b border-slate-800 bg-slate-900/90 flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded font-mono font-bold text-xs bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    {selectedAgentForKyc.agent_code}
                  </span>
                  <span className="px-2 py-0.5 rounded font-mono text-xs bg-purple-500/20 text-purple-300 border border-purple-500/30">
                    Tier {selectedAgentForKyc.hierarchy_level}
                  </span>
                </div>
                <h3 className="text-lg font-bold text-slate-100 mt-1">
                  {selectedAgentForKyc.profile?.full_name}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Branch: <strong className="text-slate-200">{selectedAgentForKyc.branch || 'Jaijaipur'}</strong> • Chhattisgarh
                </p>
              </div>

              <button
                onClick={() => setSelectedAgentForKyc(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Drawer Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar text-xs">
              {/* Financial & Banking Credentials */}
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
                <h4 className="font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Wallet className="w-4 h-4" />
                  <span>Financial & Statutory Credentials</span>
                </h4>

                {canViewSensitiveAgentPii ? (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <span className="text-slate-400 block text-[11px]">PAN Number</span>
                      <span className="font-mono text-slate-100 font-bold">{selectedAgentForKyc.pan_number || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[11px]">TDS Rate</span>
                      <span className="font-mono text-emerald-400 font-bold">{selectedAgentForKyc.tds_percentage}%</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[11px]">Bank Name</span>
                      <span className="text-slate-200">{selectedAgentForKyc.bank_name || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[11px]">Account Number</span>
                      <span className="font-mono text-slate-200 font-semibold">{selectedAgentForKyc.bank_account_no || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[11px]">IFSC Code</span>
                      <span className="font-mono text-slate-200">{selectedAgentForKyc.bank_ifsc || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[11px]">Aadhaar (Masked)</span>
                      <span className="font-mono text-slate-200">{selectedAgentForKyc.aadhaar_masked || 'XXXX-XXXX-Verified'}</span>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg text-amber-300 text-[11px]">
                    <ShieldCheck className="w-4 h-4 inline mr-1" />
                    Sensitive Banking & PAN Credentials are protected. Unmasked viewing requires administrative privilege.
                  </div>
                )}
              </div>

              {/* KYC Documents Checklist */}
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                    <FileCheck className="w-4 h-4 text-emerald-400" />
                    <span>Agent KYC Documents Vault</span>
                  </h4>
                  <span className="text-[11px] font-mono text-slate-400">
                    {selectedAgentDocuments.length} Documents Uploaded
                  </span>
                </div>

                {/* Upload Form Inside Drawer */}
                <form onSubmit={handleUploadDrawerDoc} className="p-3 bg-slate-900 rounded-lg border border-slate-800 space-y-2">
                  <div className="text-[11px] font-semibold text-slate-300">Upload Additional / Updated KYC Document:</div>
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      value={drawerDocCategory}
                      onChange={(e) => setDrawerDocCategory(e.target.value)}
                      className="bg-slate-950 border border-slate-700 rounded px-2 py-1.5 text-xs text-slate-200 outline-none"
                    >
                      <option value="pan">PAN Card Document</option>
                      <option value="aadhaar_front">Aadhaar Card Front</option>
                      <option value="aadhaar_back">Aadhaar Card Back</option>
                      <option value="bank_proof">Bank Passbook / Cheque</option>
                      <option value="agent_agreement">Agent Agreement</option>
                    </select>
                    <input
                      type="file"
                      required
                      accept="application/pdf,image/jpeg,image/png"
                      onChange={(e) => setDrawerDocFile(e.target.files?.[0] || null)}
                      className="text-[11px] text-slate-300 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:bg-slate-800 file:text-amber-400 bg-slate-950 border border-slate-700 rounded p-1"
                    />
                  </div>
                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={isUploadingDrawerDoc}
                      className="px-3 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded text-xs"
                    >
                      {isUploadingDrawerDoc ? 'Uploading...' : '+ Upload to Vault'}
                    </button>
                  </div>
                </form>

                {/* List of KYC Documents */}
                <div className="space-y-2">
                  {selectedAgentDocuments.length === 0 ? (
                    <div className="p-4 text-center text-slate-500 text-xs">
                      No documents currently found in vault for this agent.
                    </div>
                  ) : (
                    selectedAgentDocuments.map((doc) => (
                      <div key={doc.id} className="p-3 bg-slate-900 rounded-lg border border-slate-800 flex items-center justify-between gap-3">
                        <div>
                          <div className="font-semibold text-slate-100 flex items-center gap-1.5">
                            <FileText className="w-3.5 h-3.5 text-amber-400" />
                            <span>{doc.file_name}</span>
                          </div>
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            Category: <strong className="text-slate-300 uppercase font-mono">{doc.doc_category.replace(/_/g, ' ')}</strong> • {new Date(doc.created_at).toLocaleDateString()}
                          </div>
                          {doc.rejection_reason && (
                            <div className="text-[10px] text-rose-400 mt-0.5 italic">
                              Rejection: {doc.rejection_reason}
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          {doc.status === 'VERIFIED' && (
                            <span className="px-2 py-0.5 rounded font-mono font-bold text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                              Verified
                            </span>
                          )}
                          {doc.status === 'UPLOADED' && (
                            <span className="px-2 py-0.5 rounded font-mono font-bold text-[10px] bg-amber-500/20 text-amber-400 border border-amber-500/30">
                              Pending Review
                            </span>
                          )}
                          {doc.status === 'REJECTED' && (
                            <span className="px-2 py-0.5 rounded font-mono font-bold text-[10px] bg-rose-500/20 text-rose-400 border border-rose-500/30">
                              Rejected
                            </span>
                          )}

                          {/* Quick Verify / Reject Actions for Staff */}
                          {doc.status !== 'VERIFIED' && (
                            <button
                              onClick={() => handleVerifyAgentDoc(doc.id)}
                              className="p-1 rounded bg-emerald-500/20 hover:bg-emerald-500 text-emerald-400 hover:text-slate-950 transition"
                              title="Verify this KYC Document"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {doc.status !== 'REJECTED' && (
                            <button
                              onClick={() => {
                                setRejectDocId(doc.id);
                                setRejectReason('');
                              }}
                              className="p-1 rounded bg-rose-500/20 hover:bg-rose-500 text-rose-400 hover:text-white transition"
                              title="Reject this KYC Document"
                            >
                              <XCircle className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Drawer Footer */}
            <div className="p-4 border-t border-slate-800 bg-slate-900/90 flex justify-end">
              <button
                onClick={() => setSelectedAgentForKyc(null)}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300"
              >
                Close Profile
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DOCUMENT REJECTION REASON MODAL */}
      {rejectDocId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-6 space-y-4">
            <div className="flex items-center gap-2.5 text-rose-400">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <h3 className="text-sm font-bold text-slate-100">Specify KYC Document Rejection Reason</h3>
            </div>
            <p className="text-xs text-slate-400">
              Explain why this agent document is rejected (e.g. Unreadable scan, Name mismatch, Expired or altered certificate).
            </p>
            <textarea
              rows={3}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="e.g. PAN name does not match agent bank account title."
              className="w-full rounded-lg bg-slate-950 border border-slate-700 p-3 text-xs text-slate-100 placeholder-slate-500 outline-none focus:border-rose-400 font-sans"
            />
            <div className="flex justify-end gap-2.5">
              <button
                onClick={() => setRejectDocId(null)}
                className="px-3 py-1.5 rounded-lg bg-slate-800 text-xs text-slate-300"
              >
                Cancel
              </button>
              <button
                onClick={handleRejectAgentDocConfirm}
                className="px-4 py-1.5 rounded-lg bg-rose-500 hover:bg-rose-600 text-white font-bold text-xs shadow"
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
