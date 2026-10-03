import React from 'react';
import { erpStore } from '../../services/erpStore';
import { CreditCard, CheckCircle2, ShieldCheck, Lock, AlertCircle } from 'lucide-react';

export const PaymentsPage: React.FC = () => {
  const payments = erpStore.getPayments();
  const customers = erpStore.getCustomers();

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="bg-slate-900/90 rounded-2xl p-5 border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-amber-400" />
            <span>Customer Payments & Financial Ledger (Immutable State Machine)</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Section 15 Strict Policy: PAID records are tamper-proof. Adjustments permitted only via auditable reversal entries.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs text-emerald-400 font-mono font-bold bg-emerald-500/10 px-3 py-1.5 rounded-xl border border-emerald-500/30">
          <Lock className="w-3.5 h-3.5" />
          <span>PAID State Immutability Active</span>
        </div>
      </div>

      <div className="bg-slate-900/90 rounded-2xl border border-slate-800 shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-800/80 text-slate-400 text-[11px] uppercase tracking-wider border-b border-slate-700/80">
              <tr>
                <th className="px-4 py-3">Receipt / Ref No</th>
                <th className="px-4 py-3">Customer & BP No</th>
                <th className="px-4 py-3">Payment Milestone Stage</th>
                <th className="px-4 py-3">Mode & Txn Hash</th>
                <th className="px-4 py-3">Amount Paid</th>
                <th className="px-4 py-3 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {payments.map((pay) => {
                const cust = customers.find((c) => c.id === pay.customer_id);

                return (
                  <tr key={pay.id} className="hover:bg-slate-800/50 transition-colors">
                    <td className="px-4 py-3.5 font-mono text-amber-400 font-bold">
                      {pay.payment_reference_no}
                    </td>

                    <td className="px-4 py-3.5">
                      <div className="font-bold text-slate-100">{cust?.full_name}</div>
                      <div className="font-mono text-[10px] text-slate-400">BP: {cust?.consumer_number}</div>
                    </td>

                    <td className="px-4 py-3.5">
                      <span className="font-mono text-slate-200 bg-slate-800 px-2 py-0.5 rounded border border-slate-700 text-[11px]">
                        {pay.stage}
                      </span>
                    </td>

                    <td className="px-4 py-3.5">
                      <div className="text-slate-200">{pay.payment_mode}</div>
                      <div className="font-mono text-[10px] text-slate-500">{pay.transaction_identifier}</div>
                    </td>

                    <td className="px-4 py-3.5 font-mono font-bold text-emerald-400 text-sm">
                      ₹{pay.amount.toLocaleString('en-IN')}
                    </td>

                    <td className="px-4 py-3.5 text-right">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-mono text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                        <CheckCircle2 className="w-3 h-3" />
                        {pay.status}
                      </span>
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
