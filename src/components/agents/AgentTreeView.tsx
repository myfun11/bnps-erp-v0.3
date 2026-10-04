import React, { useState } from 'react';
import { erpStore } from '../../services/erpStore';
import { GitFork, Users, ShieldCheck, Award, ArrowDown, ChevronRight, Layers, Sparkles } from 'lucide-react';

export const AgentTreeView: React.FC = () => {
  const agents = erpStore.getAgents();
  const [selectedAgentId, setSelectedAgentId] = useState<string>(agents[0]?.id || '');

  const rootAgents = agents.filter((a) => !a.sponsor_agent_id || a.hierarchy_level <= 8);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="bg-slate-900/90 rounded-2xl p-5 border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
            <GitFork className="w-5 h-5 text-amber-400" />
            <span>Agent Tree View (10-Tier Network Hierarchy)</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Deterministic Sponsor Tree • Position 10 (7% Direct Sourcing) to Position 1 (0.5% Super Upline)
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-300 font-mono font-bold border border-amber-500/30">
            Multi-Tier Idempotent Engine
          </span>
        </div>
      </div>

      {/* Visual Tree Card */}
      <div className="bg-slate-900/90 rounded-2xl p-6 border border-slate-800 shadow-md">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-6 flex items-center gap-2">
          <Layers className="w-4 h-4 text-amber-400" />
          <span>Active Hierarchy Tree Structure (Chhattisgarh Network)</span>
        </h3>

        {/* Tree Render */}
        <div className="space-y-6">
          {/* Level 8: Zonal / Upline Leader */}
          <div className="flex flex-col items-center">
            <div className="w-full max-w-md p-4 rounded-2xl bg-gradient-to-r from-purple-950/60 to-slate-900 border-2 border-purple-500/50 shadow-lg text-center">
              <div className="flex justify-between items-center mb-1">
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-500 text-slate-950 font-black">
                  LEVEL 8 UPLINE (1.0%)
                </span>
                <span className="text-xs font-mono text-purple-300 font-bold">AGT00008</span>
              </div>
              <h4 className="text-sm font-bold text-slate-100">Kavita Tiwari (Bilaspur Leader)</h4>
              <p className="text-xs text-slate-400 mt-1">Zonal Network Head • Chhattisgarh North</p>
              <div className="mt-2 pt-2 border-t border-purple-900/50 flex justify-around text-xs font-mono">
                <div>Earned: <strong className="text-emerald-400">₹79,000</strong></div>
                <div>Downline: <strong className="text-purple-300">18 Agents</strong></div>
              </div>
            </div>

            {/* Tree Branch Line */}
            <div className="w-0.5 h-8 bg-gradient-to-b from-purple-500 to-amber-500 my-1" />

            {/* Level 9: Immediate Sponsor */}
            <div className="w-full max-w-md p-4 rounded-2xl bg-gradient-to-r from-amber-950/60 to-slate-900 border-2 border-amber-500/50 shadow-lg text-center">
              <div className="flex justify-between items-center mb-1">
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500 text-slate-950 font-black">
                  LEVEL 9 SPONSOR (1.0%)
                </span>
                <span className="text-xs font-mono text-amber-300 font-bold">AGT00009</span>
              </div>
              <h4 className="text-sm font-bold text-slate-100">Pooja Choudhary (Durg / Bhilai)</h4>
              <p className="text-xs text-slate-400 mt-1">Top Performer • 23 Verified Installs</p>
              <div className="mt-2 pt-2 border-t border-amber-900/50 flex justify-around text-xs font-mono">
                <div>Earned: <strong className="text-emerald-400">₹1,60,000</strong></div>
                <div>Downline: <strong className="text-amber-300">12 Agents</strong></div>
              </div>
            </div>

            {/* Tree Branch Line */}
            <div className="w-0.5 h-8 bg-gradient-to-b from-amber-500 to-emerald-500 my-1" />

            {/* Level 10: Direct Sourcing Agent */}
            <div className="w-full max-w-md p-4 rounded-2xl bg-gradient-to-r from-emerald-950/60 to-slate-900 border-2 border-emerald-500/50 shadow-lg text-center">
              <div className="flex justify-between items-center mb-1">
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500 text-slate-950 font-black">
                  LEVEL 10 DIRECT AGENT (7.0%)
                </span>
                <span className="text-xs font-mono text-emerald-300 font-bold">AGT00010</span>
              </div>
              <h4 className="text-sm font-bold text-slate-100">Mukesh Choudhary (ADMIN / Direct)</h4>
              <p className="text-xs text-slate-400 mt-1">Raipur City Lead Generator • Field Acquisition</p>
              <div className="mt-2 pt-2 border-t border-emerald-900/50 flex justify-around text-xs font-mono">
                <div>Earned: <strong className="text-emerald-400">₹42,500</strong></div>
                <div>Advance: <strong className="text-amber-400">₹5,000</strong></div>
              </div>
            </div>
          </div>
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
