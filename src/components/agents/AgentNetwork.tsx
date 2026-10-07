import React, { useState, useEffect } from 'react';
import { Agent, BranchLocation } from '../../types/database';
import { agentNetworkService } from '../../services/agentNetworkService';
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
  ExternalLink
} from 'lucide-react';

export const AgentNetwork: React.FC = () => {
  const { userRole, canViewSensitiveAgentPii } = useAuth();
  const [agents, setAgents] = useState<Agent[]>([]);
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

  const loadData = async () => {
    try {
      const rows = await agentNetworkService.list();
      setAgents(rows);
    } catch (error) {
      console.error('Agent Network load failed:', error);
      setErrorBanner(error instanceof Error ? error.message : 'Unable to load Agent Network.');
    }
  };

  useEffect(() => {
    void loadData();
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

    const defaultPwd =
      newAgentForm.login_password ||
      `${newAgentForm.full_name.split(' ')[0]}@${newAgentForm.branch}2026`;

    try {
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

      await loadData();

      const createdAgent = (await agentNetworkService.list()).find(
        (agent) => agent.id === result.agent_id
      );

      if (createdAgent) {
        setNewlyCreatedAgent(createdAgent);
      }

      setShowNewAgentModal(false);
      setSuccessBanner(
        `Agent ${result.agent_code} (${newAgentForm.full_name}) successfully onboarded!${result.invite_sent ? ' Invitation sent to the registered email.' : ''}`
      );
      setTimeout(() => setSuccessBanner(null), 5000);

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
    } catch (error) {
      console.error('Agent onboarding failed:', error);
      setErrorBanner(error instanceof Error ? error.message : 'Agent onboarding failed.');
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
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
              <h3 className="font-bold text-sm text-slate-100">
                Agent Onboarding Completed ({newlyCreatedAgent.agent_code})
              </h3>
            </div>
            <button onClick={() => setNewlyCreatedAgent(null)} className="text-slate-400 hover:text-white">✕</button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-950/70 p-3 rounded-xl border border-slate-800 text-xs font-mono">
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-sans">Agent Code</span>
              <span className="text-amber-400 font-bold">{newlyCreatedAgent.agent_code}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-sans">Branch</span>
              <span className="text-slate-100 font-bold">{newlyCreatedAgent.branch || 'Jaijaipur'}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-sans">Login Mobile</span>
              <span className="text-slate-200">{newlyCreatedAgent.profile?.phone}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-sans">Login Email</span>
              <span className="text-emerald-400 font-bold bg-emerald-950/50 px-2 py-0.5 rounded">
                {newlyCreatedAgent.profile?.email || 'Invitation flow'}
              </span>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              onClick={() => handleCopy(
                `BNPS ERP Agent Login Credentials:\nBranch: ${newlyCreatedAgent.branch}\nAgent ID: ${newlyCreatedAgent.agent_code}\nName: ${newlyCreatedAgent.profile?.full_name}\nLogin: ${newlyCreatedAgent.profile?.phone} / ${newlyCreatedAgent.profile?.email}\nLogin email: ${newlyCreatedAgent.profile?.email || 'Invitation sent'}`,
                newlyCreatedAgent.id
              )}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow transition-all cursor-pointer"
            >
              {copiedId === newlyCreatedAgent.id ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedId === newlyCreatedAgent.id ? 'Copied to Clipboard!' : 'Copy Agent Credentials to Share'}</span>
            </button>
          </div>
        </div>
      )}

      {/* Header & Hierarchy Overview */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-900/80 p-4 rounded-xl border border-slate-800">
        <div>
          <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
            <Layers className="w-5 h-5 text-amber-400" />
            <span>Agent Network Roster (Row List View)</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-amber-400 font-mono font-bold border border-slate-700">
              {filteredAgents.length} of {agents.length} Agents
            </span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Full Row List Master View • Search & find particular agent by name, code, phone, branch, or sponsor
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
            <span>+ Onboard New Agent</span>
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
            placeholder="Search particular agent by full name, code (e.g. AG-SKT-001, AGT00010), phone number, branch, or sponsor..."
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

      {/* AGENT ROW TABLE (Replaces Box Cards as Requested) */}
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
              <th className="p-3.5 text-center">Actions</th>
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
                      <div className="font-bold text-slate-100 text-sm">{agent.profile?.full_name}</div>
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

                    {/* Actions */}
                    <td className="p-3.5 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => handleCopy(
                            `Agent: ${agent.agent_code} (${agent.profile?.full_name})\nPhone: ${agent.profile?.phone}\nBranch: ${agent.branch}\nTier: ${agent.hierarchy_level}`,
                            agent.id
                          )}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-400 border border-slate-700 transition cursor-pointer"
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

      {/* Onboard Agent Modal */}
      {showNewAgentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/90">
              <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <Plus className="w-5 h-5 text-amber-400" />
                <span>Onboard New Agent & Link Sponsor</span>
              </h3>
              <button onClick={() => setShowNewAgentModal(false)} className="text-slate-400 hover:text-white">
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateAgent} className="p-6 space-y-3.5 max-h-[75vh] overflow-y-auto custom-scrollbar">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Agent Full Name *</label>
                  <input
                    type="text"
                    required
                    value={newAgentForm.full_name}
                    onChange={(e) => setNewAgentForm({ ...newAgentForm, full_name: e.target.value })}
                    placeholder="e.g. Suraj Kumar Sahu"
                    className="w-full px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-xs text-slate-100 focus:outline-none focus:border-amber-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Mobile Phone (Login ID) *</label>
                  <input
                    type="tel"
                    required
                    pattern="[0-9]{10}"
                    value={newAgentForm.phone}
                    onChange={(e) => setNewAgentForm({ ...newAgentForm, phone: e.target.value })}
                    placeholder="10-digit mobile"
                    className="w-full px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-xs text-slate-100 focus:outline-none focus:border-amber-400 font-mono"
                  />
                </div>
              </div>

              {/* Branch Selection & Sponsor Selection */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Branch *</label>
                  <select
                    value={newAgentForm.branch}
                    onChange={(e) => setNewAgentForm({ ...newAgentForm, branch: e.target.value as BranchLocation })}
                    className="w-full px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-xs text-amber-400 font-bold focus:outline-none"
                  >
                    {BRANCHES_LIST.map((b) => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Immediate Sponsor (Upline) *
                  </label>
                  <select
                    value={newAgentForm.sponsor_agent_id}
                    onChange={(e) => setNewAgentForm({ ...newAgentForm, sponsor_agent_id: e.target.value })}
                    className="w-full px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-xs text-slate-100 focus:outline-none"
                  >
                    <option value="">Direct to Company (Root)</option>
                    {agents.map((ag) => (
                      <option key={ag.id} value={ag.id}>
                        {ag.agent_code} - {ag.profile?.full_name} ({ag.branch || 'Jaijaipur'})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Automatic Hierarchy Placement Note */}
              <div className="p-3 bg-slate-950/70 rounded-xl border border-slate-800 text-[11px] text-slate-400 flex items-start gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-slate-200 block">Automatic Direct Placement:</strong>
                  Hierarchy position is assigned automatically based on the chosen sponsor (Direct Downline Level 10).
                </div>
              </div>

              {/* Admin Issued Login Password & Email */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Login Password (Admin Assigned) *
                  </label>
                  <input
                    type="text"
                    value={newAgentForm.login_password}
                    onChange={(e) => setNewAgentForm({ ...newAgentForm, login_password: e.target.value })}
                    placeholder="Leave empty for auto-generated"
                    className="w-full px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-xs font-mono text-emerald-400 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Email Address *
                  </label>
                  <input
                    type="email"
                    required
                    value={newAgentForm.email}
                    onChange={(e) => setNewAgentForm({ ...newAgentForm, email: e.target.value })}
                    placeholder="agent@example.com"
                    className="w-full px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-xs text-slate-100 focus:outline-none"
                  />
                </div>
              </div>

              {/* Banking & Compliance Fields */}
              <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 space-y-2.5">
                <div className="text-[11px] font-bold text-amber-400 uppercase tracking-wide">
                  Bank Account & PAN (TDS Compliance)
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] text-slate-400">PAN Card Number</label>
                    <input
                      type="text"
                      maxLength={10}
                      value={newAgentForm.pan_number}
                      onChange={(e) => setNewAgentForm({ ...newAgentForm, pan_number: e.target.value.toUpperCase() })}
                      placeholder="ABCDE1234F"
                      className="w-full px-2.5 py-1 rounded bg-slate-900 border border-slate-700 text-xs font-mono text-slate-200 focus:outline-none uppercase"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400">TDS Rate (%)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={newAgentForm.tds_percentage}
                      onChange={(e) => setNewAgentForm({ ...newAgentForm, tds_percentage: Number(e.target.value) })}
                      className="w-full px-2.5 py-1 rounded bg-slate-900 border border-slate-700 text-xs font-mono text-slate-200 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[11px] text-slate-400">Bank Name</label>
                    <input
                      type="text"
                      value={newAgentForm.bank_name}
                      onChange={(e) => setNewAgentForm({ ...newAgentForm, bank_name: e.target.value })}
                      placeholder="e.g. PNB / SBI"
                      className="w-full px-2.5 py-1 rounded bg-slate-900 border border-slate-700 text-xs text-slate-200 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400">Account Number</label>
                    <input
                      type="text"
                      value={newAgentForm.bank_account_no}
                      onChange={(e) => setNewAgentForm({ ...newAgentForm, bank_account_no: e.target.value })}
                      placeholder="A/C No"
                      className="w-full px-2.5 py-1 rounded bg-slate-900 border border-slate-700 text-xs font-mono text-slate-200 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400">IFSC Code</label>
                    <input
                      type="text"
                      value={newAgentForm.bank_ifsc}
                      onChange={(e) => setNewAgentForm({ ...newAgentForm, bank_ifsc: e.target.value.toUpperCase() })}
                      placeholder="PUNB0..."
                      className="w-full px-2.5 py-1 rounded bg-slate-900 border border-slate-700 text-xs font-mono text-slate-200 focus:outline-none uppercase"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowNewAgentModal(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-xs text-slate-950 font-bold shadow-lg shadow-amber-500/20 cursor-pointer"
                >
                  Confirm & Onboard Agent
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
