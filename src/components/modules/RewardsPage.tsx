import React from 'react';
import { erpStore } from '../../services/erpStore';
import { Trophy, Award, CheckCircle2, Sparkles } from 'lucide-react';

export const RewardsPage: React.FC = () => {
  const rewards = erpStore.getRewards();

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="bg-slate-900/90 rounded-2xl p-5 border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-400" />
            <span>Agent Reward & Incentive Schemes (Chhattisgarh Solar Growth)</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Quarterly and monthly milestone rewards for high-performing direct sourcing and district leaders
          </p>
        </div>

        <span className="px-3 py-1 rounded-xl bg-amber-500/20 text-amber-300 font-bold text-xs font-mono border border-amber-500/30">
          Active Schemes: {rewards.length}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {rewards.map((rew) => (
          <div key={rew.id} className="bg-slate-900/90 rounded-2xl p-6 border border-slate-800 shadow-md space-y-4 relative overflow-hidden">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-[11px] font-mono text-amber-400 font-bold uppercase tracking-wider block">
                  {rew.period}
                </span>
                <h4 className="text-lg font-bold text-slate-100 mt-1">{rew.title}</h4>
              </div>

              <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
                <Award className="w-5 h-5" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 p-3.5 bg-slate-950/70 rounded-xl border border-slate-800 text-xs">
              <div>
                <span className="text-slate-400 block">Target Capacity:</span>
                <span className="font-mono font-bold text-slate-100 text-sm">{rew.target_capacity_kw} kW Solar</span>
              </div>

              <div>
                <span className="text-slate-400 block">Bonus Reward:</span>
                <span className="font-mono font-bold text-emerald-400 text-sm">₹{rew.reward_amount.toLocaleString('en-IN')}</span>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-xs text-slate-400">
              <span className="flex items-center gap-1.5 text-emerald-400">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Scheme Status: Active
              </span>
              <span>Audited under Section 25</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
