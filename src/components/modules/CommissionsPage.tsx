import React from 'react';
import { erpStore } from '../../services/erpStore';
import { Percent, Award, ArrowUpRight, Zap, ShieldCheck } from 'lucide-react';

export const CommissionsPage: React.FC = () => {
  const agents = erpStore.getAgents();

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="bg-slate-900/90 rounded-2xl p-5 border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
            <Percent className="w-5 h-5 text-amber-400" />
            <span>Commission & Agent Payout Ledger (10-Tier Multi-Level)</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Idempotent PostgreSQL execution • Gross commission, 5% TDS deduction (Sec 194H), and Net Payable
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="px-2.5 py-1 rounded-lg bg-purple-500/20 text-purple-300 font-mono font-bold border border-purple-500/30">
            Total Distributed: ₹25,000+
          </span>
        </div>
      </div>

      <div className="bg-slate-900/90 rounded-2xl border border-slate-800 shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-800/80 text-slate-400 text-[11px] uppercase tracking-wider border-b border-slate-700/80">
              <tr>
                <th className="px-4 py-3">Agent Code & Name</th>
                <th className="px-4 py-3">Position / Tier</th>
                <th className="px-4 py-3">Earned Commission</th>
                <th className="px-4 py-3">Paid Out</th>
                <th className="px-4 py-3">Advance Balance</th>
                <th className="px-4 py-3">TDS Rate</th>
                <th className="px-4 py-3 text-right">Net Available</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {agents.map((ag) => {
                const netAvail = Math.max(0, ag.total_commission_earned - ag.total_commission_paid - ag.outstanding_advance);

                return (
                  <tr key={ag.id} className="hover:bg-slate-800/50 transition-colors">
                    <td className="px-4 py-3.5">
                      <div className="font-bold text-slate-100">{ag.profile?.full_name}</div>
                      <div className="font-mono text-[10px] text-amber-400">{ag.agent_code}</div>
                    </td>

                    <td className="px-4 py-3.5">
                      <span className="font-mono font-bold text-slate-200 bg-slate-800 px-2 py-0.5 rounded border border-slate-700">
                        Level {ag.hierarchy_level} ({ag.hierarchy_level === 10 ? '7.0%' : ag.hierarchy_level === 9 ? '1.0%' : '1.0%'})
                      </span>
                    </td>

                    <td className="px-4 py-3.5 font-mono font-bold text-emerald-400">
                      ₹{ag.total_commission_earned.toLocaleString('en-IN')}
                    </td>

                    <td className="px-4 py-3.5 font-mono text-slate-300">
                      ₹{ag.total_commission_paid.toLocaleString('en-IN')}
                    </td>

                    <td className="px-4 py-3.5 font-mono text-amber-400">
                      ₹{ag.outstanding_advance.toLocaleString('en-IN')}
                    </td>

                    <td className="px-4 py-3.5 font-mono text-slate-400">
                      {ag.tds_percentage}% (194H)
                    </td>

                    <td className="px-4 py-3.5 text-right font-mono font-bold text-amber-400 text-sm">
                      ₹{netAvail.toLocaleString('en-IN')}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
