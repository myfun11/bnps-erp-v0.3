import React, { useCallback, useEffect, useState } from 'react';
import { Agent, BranchLocation } from '../../types/database';
import { useAuth } from '../../context/AuthContext';
import { STANDARD_COMMISSION_RATES } from '../../lib/constants';
import { BRANCHES_LIST } from '../../services/mockData';
import { agentNetworkService } from '../../services/agentNetworkService';
import {
  Layers, ShieldCheck, Plus, Building, Award, EyeOff, Copy, Check,
  Search, Filter, Phone, Mail, MapPin, RefreshCw, AlertCircle
} from 'lucide-react';

const EMPTY_FORM = {
  full_name: '',
  phone: '',
  email: '',
  branch: 'Jaijaipur' as BranchLocation,
  sponsor_agent_id: '',
  password: '',
  pan_number: '',
  bank_account_no: '',
  bank_name: '',
  bank_ifsc: '',
  tds_percentage: 5,
};

const inputClass = 'w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-slate-200 focus:outline-none focus:border-amber-400';

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div><label className="block text-[11px] text-slate-400 mb-1">{label}</label>{children}</div>
);

export const AgentNetwork: React.FC = () => {
  const { currentProfile, userRole, canViewSensitiveAgentPii, isAuthenticated, isLiveSupabase } = useAuth();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);
  const [showNewAgentModal, setShowNewAgentModal] = useState(false);
  const [showCommissionRules, setShowCommissionRules] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [newlyCreatedAgent, setNewlyCreatedAgent] = useState<{ agent_code: string; email: string; password: string } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [branchFilter, setBranchFilter] = useState('ALL');
  const [levelFilter, setLevelFilter] = useState('ALL');
  const [newAgentForm, setNewAgentForm] = useState(EMPTY_FORM);

  const loadData = useCallback(async () => {
    if (!isLiveSupabase || !isAuthenticated) {
      setAgents([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setAgents(await agentNetworkService.list({
        search: searchQuery,
        branch: branchFilter,
        hierarchyLevel: levelFilter === 'ALL' ? undefined : Number(levelFilter),
      }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load Agent Network');
    } finally {
      setLoading(false);
    }
  }, [branchFilter, isAuthenticated, isLiveSupabase, levelFilter, searchQuery]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadData(), 250);
    return () => window.clearTimeout(timer);
  }, [loadData]);

  const handleCopy = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedId(id);
    window.setTimeout(() => setCopiedId(null), 2500);
  };

  const handleCreateAgent = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessBanner(null);

    if (!newAgentForm.full_name || !newAgentForm.phone || !newAgentForm.email || !newAgentForm.password) {
      setError('Name, mobile, email and login password are required.');
      return;
    }
    if (!/^[0-9]{10}$/.test(newAgentForm.phone)) {
      setError('Mobile number must contain exactly 10 digits.');
      return;
    }
    if (newAgentForm.password.length < 8) {
      setError('Login password must be at least 8 characters.');
      return;
    }

    setSaving(true);
    try {
      const result = await agentNetworkService.create(newAgentForm);
      const code = result.agent?.agent_code ?? 'Generated';
      setNewlyCreatedAgent({ agent_code: code, email: newAgentForm.email, password: newAgentForm.password });
      setSuccessBanner(`Agent ${code} successfully onboarded in Supabase.`);
      setShowNewAgentModal(false);
      setNewAgentForm(EMPTY_FORM);
      await loadData();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Agent onboarding failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in font-sans">
      {!isLiveSupabase && <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs">Supabase is not configured. Agent Network live mode requires VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.</div>}

      {error && <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex items-start gap-2"><AlertCircle className="w-4 h-4 shrink-0" /><span>{error}</span></div>}
      {successBanner && <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center justify-between"><span>{successBanner}</span><button onClick={() => setSuccessBanner(null)}>✕</button></div>}

      {newlyCreatedAgent && (
        <div className="p-5 rounded-2xl bg-gradient-to-r from-emerald-950/80 to-slate-900 border-2 border-emerald-500/50 shadow-xl space-y-3">
          <div className="flex items-center justify-between"><h3 className="font-bold text-sm text-slate-100 flex items-center gap-2"><ShieldCheck className="w-5 h-5 text-emerald-400" />Agent Auth Credentials Created ({newlyCreatedAgent.agent_code})</h3><button onClick={() => setNewlyCreatedAgent(null)}>✕</button></div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-950/70 p-3 rounded-xl border border-slate-800 text-xs font-mono">
            <div><span className="text-slate-400 block text-[10px] uppercase">Agent Code</span><span className="text-amber-400 font-bold">{newlyCreatedAgent.agent_code}</span></div>
            <div><span className="text-slate-400 block text-[10px] uppercase">Login Email</span><span>{newlyCreatedAgent.email}</span></div>
            <div><span className="text-slate-400 block text-[10px] uppercase">Initial Password</span><span className="text-emerald-400 font-bold">{newlyCreatedAgent.password}</span></div>
          </div>
          <div className="flex justify-end"><button onClick={() => void handleCopy(`BNPS ERP Agent Login\nAgent ID: ${newlyCreatedAgent.agent_code}\nEmail: ${newlyCreatedAgent.email}\nPassword: ${newlyCreatedAgent.password}`, newlyCreatedAgent.agent_code)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500 text-slate-950 font-bold text-xs">{copiedId === newlyCreatedAgent.agent_code ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}{copiedId === newlyCreatedAgent.agent_code ? 'Copied' : 'Copy Credentials'}</button></div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-900/80 p-4 rounded-xl border border-slate-800">
        <div><h2 className="text-lg font-bold text-slate-100 flex items-center gap-2"><Layers className="w-5 h-5 text-amber-400" />Agent Network Roster<span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-amber-400 font-mono border border-slate-700">{agents.length} Agents</span></h2><p className="text-xs text-slate-400 mt-0.5">Supabase-authoritative Agent Network • RLS/RPC protected</p></div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowCommissionRules(v => !v)} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-semibold border border-slate-700"><Award className="w-4 h-4 text-amber-400" />{showCommissionRules ? 'Hide 10-Tier Rules' : '10-Tier Rules'}</button>
          {['super_admin','office_admin','branch_manager'].includes(userRole) && <button onClick={() => setShowNewAgentModal(true)} className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500 text-slate-950 text-xs font-bold"><Plus className="w-4 h-4" />+ Onboard New Agent</button>}
        </div>
      </div>

      {showCommissionRules && <div className="bg-slate-900/90 rounded-xl p-4 border border-slate-800"><h3 className="text-xs font-bold text-slate-300 uppercase mb-2 flex items-center gap-2"><Award className="w-4 h-4 text-amber-400" />Active 10-Tier Commission Rules</h3><div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">{Object.entries(STANDARD_COMMISSION_RATES).map(([pos, data]) => <div key={pos} className="p-2.5 rounded-lg bg-slate-800/70 border border-slate-700/60"><div className="flex justify-between"><span className="font-mono text-amber-400 font-bold">Level {pos}</span><span className="font-mono text-emerald-400 font-bold">{data.ratePercent}%</span></div><div className="text-[11px] text-slate-400 mt-1 truncate">{data.title}</div></div>)}</div></div>}

      <div className={`p-3.5 rounded-xl border flex items-center justify-between text-xs ${canViewSensitiveAgentPii ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' : 'bg-amber-500/10 border-amber-500/30 text-amber-300'}`}>
        <div className="flex items-center gap-2.5">{canViewSensitiveAgentPii ? <ShieldCheck className="w-5 h-5 text-emerald-400" /> : <EyeOff className="w-5 h-5 text-amber-400" />}<div><span className="font-bold block">{canViewSensitiveAgentPii ? 'Sensitive Agent PII access authorized' : 'Sensitive banking/PAN data protected'}</span><span className="text-[11px] opacity-80">Role: {userRole}. Database RPC returns sensitive fields only to authorized roles or the agent's own profile.</span></div></div>
      </div>

      <div className="bg-slate-900/90 rounded-xl p-4 border border-slate-800 flex flex-col md:flex-row items-center gap-3">
        <div className="relative flex-1 w-full"><Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-amber-400" /><input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search name, agent code, phone, email, branch or sponsor..." className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-9 pr-20 py-2.5 text-xs text-slate-100 placeholder-slate-400 focus:outline-none focus:border-amber-400" />{searchQuery && <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 bg-slate-800 px-2 py-0.5 rounded">Clear</button>}</div>
        <div className="flex items-center gap-2 w-full md:w-auto">
          <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-2 text-xs"><Building className="w-3.5 h-3.5 text-slate-400" /><select value={branchFilter} onChange={e => setBranchFilter(e.target.value)} className="bg-transparent text-slate-200 focus:outline-none text-xs"><option value="ALL">All Branches</option>{BRANCHES_LIST.map(b => <option key={b} value={b}>{b}</option>)}</select></div>
          <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-2 text-xs"><Filter className="w-3.5 h-3.5 text-slate-400" /><select value={levelFilter} onChange={e => setLevelFilter(e.target.value)} className="bg-transparent text-slate-200 focus:outline-none text-xs"><option value="ALL">All Tiers</option>{[10,9,8,7,6,5,4,3,2,1].map(n => <option key={n} value={n}>Tier {n}</option>)}</select></div>
          <button onClick={() => void loadData()} className="p-2 rounded-lg bg-slate-800 text-amber-400 border border-slate-700" title="Refresh"><RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /></button>
        </div>
      </div>

      <div className="overflow-x-auto border border-slate-800 rounded-2xl shadow-xl bg-slate-900/90"><table className="w-full text-xs text-left"><thead className="bg-slate-950 text-slate-400 font-semibold border-b border-slate-800 text-[11px] uppercase tracking-wider"><tr><th className="p-3.5">Agent Code / Tier</th><th className="p-3.5">Full Name & Contact</th><th className="p-3.5">Branch</th><th className="p-3.5">Upline Sponsor</th><th className="p-3.5 text-right">Commission Earned</th><th className="p-3.5 text-right">Paid Out</th><th className="p-3.5 text-right">Advance</th><th className="p-3.5">Banking & PAN</th><th className="p-3.5 text-center">Status</th><th className="p-3.5 text-center">Actions</th></tr></thead>
        <tbody className="divide-y divide-slate-800/80 text-slate-200">{loading ? <tr><td colSpan={10} className="p-12 text-center text-slate-500">Loading Agent Network…</td></tr> : agents.length === 0 ? <tr><td colSpan={10} className="p-12 text-center text-slate-500">No agents found.</td></tr> : agents.map(agent => {
          const sponsor = agents.find(a => a.id === agent.sponsor_agent_id);
          const canViewPii = canViewSensitiveAgentPii || agent.profile_id === currentProfile.id;
          return <tr key={agent.id} className="hover:bg-slate-800/40">
            <td className="p-3.5"><div className="font-mono font-bold text-amber-400">{agent.agent_code}</div><span className="inline-block mt-1 text-[10px] px-2 py-0.5 rounded font-mono bg-amber-500/15 text-amber-300 border border-amber-500/30">Tier {agent.hierarchy_level}</span></td>
            <td className="p-3.5"><div className="font-bold text-slate-100 text-sm">{agent.profile?.full_name}</div><div className="text-xs text-slate-400 flex items-center gap-1"><Phone className="w-3 h-3" />{agent.profile?.phone}</div>{agent.profile?.email && <div className="text-[11px] text-slate-500 flex items-center gap-1"><Mail className="w-3 h-3" />{agent.profile.email}</div>}</td>
            <td className="p-3.5"><div className="flex items-center gap-1 text-slate-200 font-medium"><MapPin className="w-3 h-3 text-amber-400" />{agent.branch || '—'}</div><span className="text-[10px] text-slate-500">Chhattisgarh</span></td>
            <td className="p-3.5">{sponsor ? <><div className="text-slate-200 font-semibold">{sponsor.profile?.full_name}</div><div className="text-[10px] font-mono text-slate-400">{sponsor.agent_code}</div></> : <span className="text-[11px] text-emerald-400 font-mono">Company (Direct Root)</span>}</td>
            <td className="p-3.5 text-right font-mono font-bold text-emerald-400">₹{agent.total_commission_earned.toLocaleString('en-IN')}</td><td className="p-3.5 text-right font-mono">₹{agent.total_commission_paid.toLocaleString('en-IN')}</td><td className="p-3.5 text-right font-mono text-amber-400">₹{agent.outstanding_advance.toLocaleString('en-IN')}</td>
            <td className="p-3.5 text-[11px]">{canViewPii ? <div><div>PAN: <span className="font-mono">{agent.pan_number || 'N/A'}</span></div><div>Bank: <span className="font-mono">{agent.bank_name || 'N/A'} ({agent.bank_account_no ? `••${agent.bank_account_no.slice(-4)}` : 'N/A'})</span></div></div> : <span className="text-slate-500 italic">•••• Protected</span>}</td>
            <td className="p-3.5 text-center"><span className="inline-block px-2 py-0.5 rounded-full font-mono text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">{agent.is_active ? 'Active' : 'Inactive'}</span></td>
            <td className="p-3.5 text-center"><button onClick={() => void handleCopy(`Agent: ${agent.agent_code} (${agent.profile?.full_name})\nPhone: ${agent.profile?.phone}\nBranch: ${agent.branch}\nTier: ${agent.hierarchy_level}`, agent.id)} className="p-1.5 rounded-lg bg-slate-800 text-amber-400 border border-slate-700">{copiedId === agent.id ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}</button></td>
          </tr>;
        })}</tbody></table></div>

      {showNewAgentModal && <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm"><div className="w-full max-w-lg bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800"><h3 className="text-base font-bold text-slate-100 flex items-center gap-2"><Plus className="w-5 h-5 text-amber-400" />Onboard New Agent</h3><button onClick={() => setShowNewAgentModal(false)}>✕</button></div>
        <form onSubmit={handleCreateAgent} className="p-6 space-y-3.5 max-h-[75vh] overflow-y-auto">
          <div className="grid grid-cols-2 gap-3"><Field label="Agent Full Name *"><input required value={newAgentForm.full_name} onChange={e => setNewAgentForm({...newAgentForm, full_name:e.target.value})} className={inputClass}/></Field><Field label="Mobile Phone *"><input required pattern="[0-9]{10}" value={newAgentForm.phone} onChange={e => setNewAgentForm({...newAgentForm, phone:e.target.value})} className={inputClass}/></Field></div>
          <div className="grid grid-cols-2 gap-3"><Field label="Email / Login ID *"><input required type="email" value={newAgentForm.email} onChange={e => setNewAgentForm({...newAgentForm, email:e.target.value})} className={inputClass}/></Field><Field label="Initial Login Password *"><input required type="password" minLength={8} value={newAgentForm.password} onChange={e => setNewAgentForm({...newAgentForm, password:e.target.value})} className={inputClass}/></Field></div>
          <div className="grid grid-cols-2 gap-3"><Field label="Branch *"><select value={newAgentForm.branch} onChange={e => setNewAgentForm({...newAgentForm, branch:e.target.value as BranchLocation})} className={inputClass}>{BRANCHES_LIST.map(b=><option key={b} value={b}>{b}</option>)}</select></Field><Field label="Immediate Sponsor"><select value={newAgentForm.sponsor_agent_id} onChange={e => setNewAgentForm({...newAgentForm, sponsor_agent_id:e.target.value})} className={inputClass}><option value="">Company (Root)</option>{agents.map(a=><option key={a.id} value={a.id}>{a.agent_code} - {a.profile?.full_name}</option>)}</select></Field></div>
          <div className="p-3 bg-slate-950/70 rounded-xl border border-slate-800 text-[11px] text-slate-400"><strong className="text-slate-200 block">Automatic hierarchy placement</strong>New agents are created at Tier 10. Sponsor/upline is stored authoritatively in PostgreSQL.</div>
          <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 space-y-2.5"><div className="text-[11px] font-bold text-amber-400 uppercase">Bank & PAN / TDS</div><div className="grid grid-cols-2 gap-2"><Field label="PAN"><input maxLength={10} value={newAgentForm.pan_number} onChange={e => setNewAgentForm({...newAgentForm, pan_number:e.target.value.toUpperCase()})} className={inputClass}/></Field><Field label="TDS %"><input type="number" step="0.1" value={newAgentForm.tds_percentage} onChange={e => setNewAgentForm({...newAgentForm, tds_percentage:Number(e.target.value)})} className={inputClass}/></Field></div><div className="grid grid-cols-3 gap-2"><Field label="Bank"><input value={newAgentForm.bank_name} onChange={e => setNewAgentForm({...newAgentForm, bank_name:e.target.value})} className={inputClass}/></Field><Field label="Account"><input value={newAgentForm.bank_account_no} onChange={e => setNewAgentForm({...newAgentForm, bank_account_no:e.target.value})} className={inputClass}/></Field><Field label="IFSC"><input value={newAgentForm.bank_ifsc} onChange={e => setNewAgentForm({...newAgentForm, bank_ifsc:e.target.value.toUpperCase()})} className={inputClass}/></Field></div></div>
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-800"><button type="button" onClick={() => setShowNewAgentModal(false)} className="px-4 py-2 rounded-lg bg-slate-800 text-xs text-slate-300">Cancel</button><button disabled={saving} type="submit" className="px-5 py-2 rounded-lg bg-amber-500 text-xs text-slate-950 font-bold disabled:opacity-50">{saving ? 'Creating…' : 'Confirm & Onboard Agent'}</button></div>
        </form>
      </div></div>}
    </div>
  );
};
