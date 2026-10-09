import React, { useState, useEffect } from 'react';
import { erpStore } from '../../services/erpStore';
import { Agent } from '../../types/database';
import { 
  GitFork, 
  Users, 
  ShieldCheck, 
  Award, 
  ArrowDown, 
  Layers, 
  Sparkles, 
  Building, 
  ChevronRight, 
  ChevronDown, 
  Phone, 
  Mail, 
  Wallet,
  UserCheck
} from 'lucide-react';
import { BRANCHES_LIST } from '../../services/mockData';
import { agentNetworkService } from '../../services/agentNetworkService';

export const AgentTreeView: React.FC = () => {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<string>('ALL');
  const [expandedAgentIds, setExpandedAgentIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const fetchTreeAgents = async () => {
      try {
        setIsLoading(true);
        const data = await agentNetworkService.list();
        if (mounted) {
          setAgents(data);
          setErrorMsg(null);
        }
      } catch (err: any) {
        if (mounted) {
          setErrorMsg(err?.message || 'Failed to fetch agent network tree from Supabase');
        }
      } finally {
        if (mounted) setIsLoading(false);
      }
    };

    fetchTreeAgents();
    const unsub = erpStore.subscribe(() => {
      fetchTreeAgents();
    });
    return () => {
      mounted = false;
      unsub();
    };
  }, []);

  // Filter agents by branch if specified
  const filteredAgents = selectedBranch === 'ALL'
    ? agents
    : agents.filter(a => a.branch === selectedBranch);

  // Group agents by hierarchy: identify root agents (no sponsor or sponsor not found in current dataset)
  const agentMap = new Map<string, Agent>();
  agents.forEach(a => agentMap.set(a.id, a));

  const rootAgents = filteredAgents.filter(a => !a.sponsor_agent_id || !agentMap.has(a.sponsor_agent_id));
  
  // Downline lookup map
  const downlineMap = new Map<string, Agent[]>();
  agents.forEach(a => {
    if (a.sponsor_agent_id) {
      const list = downlineMap.get(a.sponsor_agent_id) || [];
      list.push(a);
      downlineMap.set(a.sponsor_agent_id, list);
    }
  });

  const toggleExpand = (agentId: string) => {
    setExpandedAgentIds(prev => {
      const next = new Set(prev);
      if (next.has(agentId)) next.delete(agentId);
      else next.add(agentId);
      return next;
    });
  };

  const getTierColor = (level: number) => {
    if (level === 10) return { bg: 'from-emerald-950/70 to-slate-900', border: 'border-emerald-500/50', badge: 'bg-emerald-500 text-slate-950', text: 'text-emerald-400' };
    if (level === 9) return { bg: 'from-amber-950/70 to-slate-900', border: 'border-amber-500/50', badge: 'bg-amber-500 text-slate-950', text: 'text-amber-400' };
    if (level === 8) return { bg: 'from-purple-950/70 to-slate-900', border: 'border-purple-500/50', badge: 'bg-purple-500 text-slate-950', text: 'text-purple-400' };
    return { bg: 'from-blue-950/70 to-slate-900', border: 'border-blue-500/50', badge: 'bg-blue-500 text-slate-950', text: 'text-blue-400' };
  };

  const renderAgentNode = (agent: Agent, depth = 0) => {
    const downlines = downlineMap.get(agent.id) || [];
    const colors = getTierColor(agent.hierarchy_level);
    const isExpanded = expandedAgentIds.has(agent.id) || depth === 0;

    return (
      <div key={agent.id} className="flex flex-col items-center w-full">
        <div className={`w-full max-w-xl p-4 rounded-2xl bg-gradient-to-r ${colors.bg} border-2 ${colors.border} shadow-lg transition-all`}>
          <div className="flex justify-between items-center mb-2">
            <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-black ${colors.badge}`}>
              TIER {agent.hierarchy_level} {agent.hierarchy_level === 10 ? 'DIRECT (7%)' : agent.hierarchy_level === 9 ? 'SPONSOR (1%)' : 'UPLINE (1%)'}
            </span>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-slate-300 font-bold">{agent.agent_code}</span>
              {agent.branch && (
                <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-amber-300 border border-slate-700">
                  {agent.branch}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-start justify-between">
            <div>
              <h4 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <span>{agent.profile?.full_name || 'Agent'}</span>
                {agent.is_active && (
                  <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" title="Active Operational" />
                )}
              </h4>
              <div className="text-xs text-slate-400 mt-1 flex flex-wrap items-center gap-3">
                <span className="flex items-center gap-1 font-mono">
                  <Phone className="w-3 h-3 text-slate-500" />
                  {agent.profile?.phone || 'No phone'}
                </span>
                {agent.profile?.email && (
                  <span className="flex items-center gap-1 text-[11px] text-slate-400">
                    <Mail className="w-3 h-3 text-slate-500" />
                    {agent.profile.email}
                  </span>
                )}
              </div>
            </div>

            {downlines.length > 0 && (
              <button 
                onClick={() => toggleExpand(agent.id)}
                className="px-2.5 py-1 text-xs rounded-lg bg-slate-800/80 hover:bg-slate-700 text-amber-300 border border-slate-700 flex items-center gap-1 cursor-pointer"
              >
                {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                <span>{downlines.length} Downline</span>
              </button>
            )}
          </div>

          <div className="mt-3 pt-2.5 border-t border-slate-800 flex justify-between text-xs font-mono">
            <div>
              <span className="text-slate-400 text-[10px] block">EARNED</span>
              <strong className="text-emerald-400">₹{agent.total_commission_earned.toLocaleString('en-IN')}</strong>
            </div>
            <div>
              <span className="text-slate-400 text-[10px] block">PAID OUT</span>
              <strong className="text-slate-200">₹{agent.total_commission_paid.toLocaleString('en-IN')}</strong>
            </div>
            <div>
              <span className="text-slate-400 text-[10px] block">ADVANCE BALANCE</span>
              <strong className={agent.outstanding_advance > 0 ? "text-amber-400" : "text-slate-400"}>
                ₹{agent.outstanding_advance.toLocaleString('en-IN')}
              </strong>
            </div>
          </div>
        </div>

        {/* Downline Nodes */}
        {isExpanded && downlines.length > 0 && (
          <div className="w-full flex flex-col items-center">
            <div className="w-0.5 h-6 bg-gradient-to-b from-amber-500 to-slate-700 my-1" />
            <div className="w-full space-y-4 pl-4 sm:pl-8 border-l-2 border-slate-800/60 my-2">
              {downlines.map(downline => renderAgentNode(downline, depth + 1))}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6 animate-fade-in font-sans">
      {/* Header */}
      <div className="bg-slate-900/90 rounded-2xl p-5 border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
            <GitFork className="w-5 h-5 text-amber-400" />
            <span>Agent Tree View (10-Tier Network Hierarchy)</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-800 text-amber-400 font-mono font-bold border border-slate-700">
              {agents.length} Total Authoritative Operational Agents
            </span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Deterministic Sponsor Tree • Position 10 (7% Direct Sourcing) to Position 1 (0.5% Super Upline) • Direct sync with Agent Master & Sidebar
          </p>
        </div>

        {/* Branch Filter */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-2 text-xs">
            <Building className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={selectedBranch}
              onChange={(e) => setSelectedBranch(e.target.value)}
              className="bg-transparent text-slate-200 focus:outline-none text-xs"
            >
              <option value="ALL">All Branches ({agents.length} Agents)</option>
              {BRANCHES_LIST.map((b) => {
                const count = agents.filter(a => a.branch === b).length;
                return (
                  <option key={b} value={b}>{b} ({count})</option>
                );
              })}
            </select>
          </div>
        </div>
      </div>

      {/* Visual Tree Card */}
      <div className="bg-slate-900/90 rounded-2xl p-6 border border-slate-800 shadow-md">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
            <Layers className="w-4 h-4 text-amber-400" />
            <span>Active Hierarchy Tree Structure (Chhattisgarh Operational Network)</span>
          </h3>
          <span className="text-xs text-slate-400 font-mono">
            Showing {filteredAgents.length} Agents ({rootAgents.length} Hierarchy Roots)
          </span>
        </div>

        {/* Dynamic Tree Render */}
        <div className="space-y-6 flex flex-col items-center">
          {filteredAgents.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-xs">
              No agents registered for the selected branch.
            </div>
          ) : rootAgents.length > 0 ? (
            rootAgents.map(root => renderAgentNode(root))
          ) : (
            filteredAgents.map(agent => renderAgentNode(agent))
          )}
        </div>

        {/* Multi-Tier Invariant Snapshot Explanation */}
        <div className="mt-8 p-4 rounded-xl bg-slate-950/70 border border-slate-800 text-xs text-slate-400 space-y-1">
          <div className="text-slate-200 font-bold flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span>Deterministic Hierarchy Rule (Section 16 Invariant):</span>
          </div>
          <p>
            Whenever payment is received for any project, the commission engine traces the sponsor chain starting from Position 10 upwards. In every transaction, the current tree snapshot is permanently frozen as JSONB, ensuring that historical financial calculations and audit trails remain completely immutable even if upline sponsors change in the future.
          </p>
        </div>
      </div>
    </div>
  );
};
