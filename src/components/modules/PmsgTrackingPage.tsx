import React, { useState } from 'react';
import { erpStore } from '../../services/erpStore';
import { useAuth } from '../../context/AuthContext';
import { Sun, Search, ExternalLink, CheckCircle2, Clock, AlertCircle, Edit2 } from 'lucide-react';

export const PmsgTrackingPage: React.FC = () => {
  const pmsgList = erpStore.getPmsgTracking();
  const customers = erpStore.getCustomers();
  const [search, setSearch] = useState('');

  const filtered = pmsgList.filter((p) => {
    const cust = customers.find((c) => c.id === p.customer_id);
    const q = search.toLowerCase();
    return (
      (p.portal_application_no && p.portal_application_no.toLowerCase().includes(q)) ||
      (cust && cust.full_name.toLowerCase().includes(q)) ||
      (cust && cust.consumer_number.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="bg-slate-900/90 rounded-2xl p-5 border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
            <Sun className="w-5 h-5 text-amber-400" />
            <span>PM Surya Ghar Portal Tracking (National Portal Synchronization)</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Real-time tracking of portal application numbers, feasibility approvals, and DBT subsidies in Chhattisgarh
          </p>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by Portal No, Customer..."
            className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-400 font-mono"
          />
        </div>
      </div>

      <div className="bg-slate-900/90 rounded-2xl border border-slate-800 shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-800/80 text-slate-400 text-[11px] uppercase tracking-wider border-b border-slate-700/80">
              <tr>
                <th className="px-4 py-3">Customer & BP No</th>
                <th className="px-4 py-3">National Portal App No</th>
                <th className="px-4 py-3">Registered kW</th>
                <th className="px-4 py-3">Feasibility Status</th>
                <th className="px-4 py-3">Discom Sub-division</th>
                <th className="px-4 py-3">DBT Subsidy Amount</th>
                <th className="px-4 py-3 text-right">Portal Stage</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filtered.map((item) => {
                const cust = customers.find((c) => c.id === item.customer_id);
                return (
                  <tr key={item.id} className="hover:bg-slate-800/50 transition-colors">
                    <td className="px-4 py-3.5">
                      <div className="font-bold text-slate-100">{cust?.full_name || 'N/A'}</div>
                      <div className="font-mono text-[10px] text-slate-400 mt-0.5">
                        BP: {cust?.consumer_number} ({cust?.district || 'Raipur'})
                      </div>
                    </td>

                    <td className="px-4 py-3.5">
                      {item.portal_application_no ? (
                        <span className="font-mono text-emerald-400 font-bold bg-emerald-950/50 px-2 py-0.5 rounded border border-emerald-800/40">
                          {item.portal_application_no}
                        </span>
                      ) : (
                        <span className="text-amber-400 bg-amber-950/40 px-2 py-0.5 rounded border border-amber-800/30">
                          Submission Queued
                        </span>
                      )}
                    </td>

                    <td className="px-4 py-3.5 font-mono text-slate-200">
                      {item.registered_capacity_kw || 3.3} kW
                    </td>

                    <td className="px-4 py-3.5">
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400">
                        <CheckCircle2 className="w-3 h-3" />
                        {item.feasibility_status || 'APPROVED'}
                      </span>
                    </td>

                    <td className="px-4 py-3.5 text-slate-300">
                      {item.discom_subdivision || 'CSPDCL Sub-division'}
                    </td>

                    <td className="px-4 py-3.5 font-mono font-bold text-emerald-400">
                      ₹{(item.subsidy_amount_eligible || 78000).toLocaleString('en-IN')}
                    </td>

                    <td className="px-4 py-3.5 text-right">
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-mono font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                        {item.stage}
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
