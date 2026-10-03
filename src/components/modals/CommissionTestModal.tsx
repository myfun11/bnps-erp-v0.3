import React, { useState } from 'react';
import { erpStore } from '../../services/erpStore';
import { Zap, X, CheckCircle2, ShieldCheck, ArrowRight } from 'lucide-react';

interface CommissionTestModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CommissionTestModal: React.FC<CommissionTestModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const testResult = erpStore.runCommissionTest();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-xl bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/90">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center">
              <Zap className="w-5 h-5 fill-amber-400" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-100">
                10-Tier Commission Engine Idempotency Test
              </h3>
              <p className="text-xs text-slate-400">Section 16 & 17 Deterministic Concurrency Verification</p>
            </div>
          </div>

          <button onClick={onClose} className="text-slate-400 hover:text-white p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="font-semibold">{testResult.message}</span>
          </div>

          <div className="space-y-1.5 max-h-72 overflow-y-auto custom-scrollbar">
            {testResult.results.map((res) => (
              <div
                key={res.level}
                className="flex items-center justify-between p-2.5 rounded-lg bg-slate-800/60 border border-slate-700/50 text-xs"
              >
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-slate-900 text-amber-400 font-bold border border-slate-800">
                    Pos {res.level}
                  </span>
                  <span className="font-semibold text-slate-200">{res.agent}</span>
                </div>

                <div className="flex items-center gap-3 font-mono">
                  <span className="text-slate-400">{res.rate}</span>
                  <span className="font-bold text-emerald-400 text-sm">{res.amount}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="p-3 bg-slate-950/70 rounded-xl border border-slate-800 text-[11px] text-slate-400">
            <div className="text-slate-200 font-semibold mb-0.5">Concurrency Invariant Check:</div>
            If two accountants click "Generate Commission" simultaneously on the same project and stage, the composite unique constraint (`project_id`, `payment_stage`, `position`, `agent_id`) ensures only one transaction executes while duplicate payouts are strictly rejected.
          </div>
        </div>

        <div className="p-4 border-t border-slate-800 bg-slate-900/90 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold shadow-md shadow-amber-500/20"
          >
            Verified & Close
          </button>
        </div>
      </div>
    </div>
  );
};
