import React, { useState } from 'react';
import { erpStore } from '../../services/erpStore';
import { useAuth } from '../../context/AuthContext';
import { Sun, Search, CheckCircle2, UserPlus, X, Loader2 } from 'lucide-react';

export const PmsgTrackingPage: React.FC = () => {
  const { hasPermission, currentProfile } = useAuth();
  const pmsgList = erpStore.getPmsgTracking();
  const customers = erpStore.getCustomers();
  const [search, setSearch] = useState('');
  const [showRegister, setShowRegister] = useState(false);
  const [customerSearch, setCustomerSearch] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [saving, setSaving] = useState(false);

  const canCreatePmsg = hasPermission('pmsg.create');

  const filtered = pmsgList.filter((p) => {
    const cust = customers.find((c) => c.id === p.customer_id);
    const q = search.toLowerCase();
    return (
      (p.portal_application_no && p.portal_application_no.toLowerCase().includes(q)) ||
      (cust && cust.full_name.toLowerCase().includes(q)) ||
      (cust && cust.consumer_number.toLowerCase().includes(q))
    );
  });

  const registeredCustomerIds = new Set(
    pmsgList.map((p) => p.customer_id)
  );

  const availableCustomers = customers.filter((customer) => {
    if (registeredCustomerIds.has(customer.id)) return false;

    const q = customerSearch.trim().toLowerCase();
    if (!q) return true;

    return (
      customer.full_name.toLowerCase().includes(q) ||
      customer.consumer_number.toLowerCase().includes(q) ||
      customer.customer_code.toLowerCase().includes(q) ||
      customer.primary_mobile.toLowerCase().includes(q)
    );
  });

  const handleCreatePmsg = async () => {
    if (!canCreatePmsg || !selectedCustomerId || saving) return;

    setSaving(true);

    const result = await erpStore.createPmsgTracking(
      selectedCustomerId,
      currentProfile.id
    );

    setSaving(false);

    if (!result.success) {
      console.error('[PmsgTrackingPage] PMSG registration failed:', result.error);
      return;
    }

    setSelectedCustomerId('');
    setCustomerSearch('');
    setShowRegister(false);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="bg-slate-900/90 rounded-2xl p-5 border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
            <Sun className="w-5 h-5 text-amber-400" />
            <span>PM Surya Ghar Portal Tracking (National Portal Synchronization)</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Track customers after PM Surya Ghar registration and manage portal application progress
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          {canCreatePmsg && (
            <button
              type="button"
              onClick={() => setShowRegister(true)}
              className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/30 hover:bg-amber-500/20 text-xs font-semibold"
            >
              <UserPlus className="w-4 h-4" />
              Register Customer
            </button>
          )}

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
      </div>

      {showRegister && canCreatePmsg && (
        <div className="bg-slate-900/90 rounded-2xl p-5 border border-amber-500/20 shadow-md">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-100">
                Register Customer on PM Surya Ghar
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Select an existing customer. Registration creates the initial PMSG tracking record only.
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                setShowRegister(false);
                setSelectedCustomerId('');
                setCustomerSearch('');
              }}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800"
              aria-label="Close registration panel"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-3">
            <div>
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
                <input
                  type="text"
                  value={customerSearch}
                  onChange={(e) => {
                    setCustomerSearch(e.target.value);
                    setSelectedCustomerId('');
                  }}
                  placeholder="Search customer by name, BP/consumer no, code or mobile..."
                  className="w-full pl-9 pr-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-400"
                />
              </div>

              <div className="mt-2 max-h-52 overflow-y-auto rounded-lg border border-slate-800 divide-y divide-slate-800">
                {availableCustomers.length > 0 ? (
                  availableCustomers.slice(0, 25).map((customer) => (
                    <button
                      key={customer.id}
                      type="button"
                      onClick={() => setSelectedCustomerId(customer.id)}
                      className={`w-full text-left px-3 py-2.5 hover:bg-slate-800/80 transition-colors ${
                        selectedCustomerId === customer.id
                          ? 'bg-amber-500/10 border-l-2 border-amber-400'
                          : ''
                      }`}
                    >
                      <div className="text-xs font-semibold text-slate-100">
                        {customer.full_name}
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5 font-mono">
                        {customer.customer_code} · BP: {customer.consumer_number} · {customer.primary_mobile}
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="px-3 py-4 text-xs text-slate-500 text-center">
                    No eligible customers found.
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-end">
              <button
                type="button"
                onClick={handleCreatePmsg}
                disabled={!selectedCustomerId || saving}
                className="w-full lg:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-amber-500 text-slate-950 hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed text-xs font-bold"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Registering...
                  </>
                ) : (
                  <>
                    <UserPlus className="w-4 h-4" />
                    Confirm Registration
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

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
                        BP: {cust?.consumer_number} ({cust?.district || 'Not entered'})
                      </div>
                    </td>

                    <td className="px-4 py-3.5">
                      {item.portal_application_no ? (
                        <span className="font-mono text-emerald-400 font-bold bg-emerald-950/50 px-2 py-0.5 rounded border border-emerald-800/40">
                          {item.portal_application_no}
                        </span>
                      ) : (
                        <span className="text-amber-400 bg-amber-950/40 px-2 py-0.5 rounded border border-amber-800/30">
                          Not submitted
                        </span>
                      )}
                    </td>

                    <td className="px-4 py-3.5 font-mono text-slate-200">
                      {item.registered_capacity_kw ? `${item.registered_capacity_kw} kW` : 'Not entered'}
                    </td>

                    <td className="px-4 py-3.5">
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-400">
                        <CheckCircle2 className="w-3 h-3" />
                        {item.feasibility_status || 'Pending'}
                      </span>
                    </td>

                    <td className="px-4 py-3.5 text-slate-300">
                      {item.discom_subdivision || 'Not entered'}
                    </td>

                    <td className="px-4 py-3.5 font-mono font-bold text-emerald-400">
                      {item.subsidy_amount_eligible > 0
                        ? `₹${item.subsidy_amount_eligible.toLocaleString('en-IN')}`
                        : 'Not calculated'}
                    </td>

                    <td className="px-4 py-3.5 text-right">
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-mono font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                        {item.stage}
                      </span>
                    </td>
                  </tr>
                );
              })}

              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-xs text-slate-500">
                    No PMSG tracking records found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
