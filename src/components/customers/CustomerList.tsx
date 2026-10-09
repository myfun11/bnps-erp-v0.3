import React, { useState, useEffect } from 'react';
import { Customer, CustomerLifecycleType } from '../../types/database';
import { erpStore } from '../../services/erpStore';
import { customerService } from '../../services/customerService';
import { CustomerDetailDrawer } from './CustomerDetailDrawer';
import { 
  Users, 
  Search, 
  Filter, 
  MapPin, 
  Phone, 
  Zap, 
  ArrowRight, 
  ExternalLink,
  ShieldCheck,
  CheckCircle,
  FileSpreadsheet
} from 'lucide-react';

interface CustomerListProps {
  initialSelectedCustomerId?: string | null;
}

export const CustomerList: React.FC<CustomerListProps> = ({ initialSelectedCustomerId }) => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(initialSelectedCustomerId || null);
  const [viewMode, setViewMode] = useState<'ACTIVE' | 'COMPLETED' | 'ALL' | 'PMSG_REGISTERED'>('ACTIVE');
  const [searchQuery, setSearchQuery] = useState('');
  const [districtFilter, setDistrictFilter] = useState<string>('ALL');
  const [discomFilter, setDiscomFilter] = useState<string>('ALL');

  const loadData = async () => {
    try {
      const data = await customerService.fetchCustomers();
      setCustomers(data);
    } catch (err) {
      console.error('Failed to fetch customers:', err);
      setCustomers(erpStore.getCustomers());
    }
  };

  useEffect(() => {
    loadData();
    const unsub = erpStore.subscribe(loadData);
    return () => unsub();
  }, []);

  useEffect(() => {
    if (initialSelectedCustomerId) {
      setSelectedCustomerId(initialSelectedCustomerId);
    }
  }, [initialSelectedCustomerId]);

  const pmsgRecords = erpStore.getPmsgTracking();
  const pmsgCustomerIds = new Set(
    pmsgRecords
      .filter((p) => p.portal_application_no || p.stage !== 'INITIATED')
      .map((p) => p.customer_id)
  );

  const activeCount = customers.filter(
    (c) => c.lifecycle_status !== 'INSTALLED' && c.lifecycle_status !== 'COMMISSIONED'
  ).length;
  const completedCount = customers.filter(
    (c) => c.lifecycle_status === 'INSTALLED' || c.lifecycle_status === 'COMMISSIONED'
  ).length;

  const filteredCustomers = customers.filter((cust) => {
    // Lifecycle Mode Filter: Active vs Completed vs All vs PMSG
    if (viewMode === 'ACTIVE') {
      if (cust.lifecycle_status === 'INSTALLED' || cust.lifecycle_status === 'COMMISSIONED') {
        return false;
      }
    } else if (viewMode === 'COMPLETED') {
      if (cust.lifecycle_status !== 'INSTALLED' && cust.lifecycle_status !== 'COMMISSIONED') {
        return false;
      }
    } else if (viewMode === 'PMSG_REGISTERED') {
      if (!pmsgCustomerIds.has(cust.id)) {
        return false;
      }
    }

    // District filter
    if (districtFilter !== 'ALL' && cust.district.toLowerCase() !== districtFilter.toLowerCase()) {
      return false;
    }

    // Discom filter
    if (discomFilter !== 'ALL' && !cust.discom_name.toUpperCase().includes(discomFilter.toUpperCase())) {
      return false;
    }

    // Search query
    const q = searchQuery.toLowerCase();
    return (
      cust.full_name.toLowerCase().includes(q) ||
      cust.customer_code.toLowerCase().includes(q) ||
      cust.primary_mobile.includes(q) ||
      cust.consumer_number.toLowerCase().includes(q) ||
      cust.district.toLowerCase().includes(q) ||
      (cust.email || '').toLowerCase().includes(q)
    );
  });

  const selectedCustomer = customers.find((c) => c.id === selectedCustomerId) || null;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header & Mode Switcher */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-900/80 p-4 rounded-xl border border-slate-800">
        <div>
          <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
            <Users className="w-5 h-5 text-amber-400" />
            <span>Customer Master & Installation Lifecycle</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-amber-400 font-mono font-bold border border-slate-700">
              {filteredCustomers.length} Displayed ({customers.length} Total Masters)
            </span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Active installation workflows separated from completed rooftop solar projects • Complete audit history preserved
          </p>
        </div>

        {/* Operational View Switcher (Active vs Completed vs All vs PMSG) */}
        <div className="flex flex-wrap items-center gap-1.5 bg-slate-800/90 p-1.5 rounded-xl border border-slate-700">
          <button
            onClick={() => setViewMode('ACTIVE')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              viewMode === 'ACTIVE'
                ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Active Pipeline ({activeCount})
          </button>
          <button
            onClick={() => setViewMode('COMPLETED')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              viewMode === 'COMPLETED'
                ? 'bg-emerald-500 text-slate-950 font-bold shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Completed Installation ({completedCount})
          </button>
          <button
            onClick={() => setViewMode('ALL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              viewMode === 'ALL'
                ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            All Masters ({customers.length})
          </button>
          <button
            onClick={() => setViewMode('PMSG_REGISTERED')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              viewMode === 'PMSG_REGISTERED'
                ? 'bg-sky-500 text-slate-950 font-bold shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <span>PMSG ({pmsgCustomerIds.size})</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-slate-900/90 rounded-xl p-4 border border-slate-800 flex flex-col md:flex-row items-center gap-3 shadow-md">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-amber-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search particular customer by name, code (e.g. CUST-2601-001), mobile, BP/consumer number, district..."
            className="w-full pl-9 pr-20 py-2.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-slate-100 placeholder-slate-400 focus:outline-none focus:border-amber-400 shadow-inner"
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

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {/* District Filter */}
          <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-2 text-xs">
            <MapPin className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={districtFilter}
              onChange={(e) => setDistrictFilter(e.target.value)}
              className="bg-transparent text-slate-200 focus:outline-none text-xs"
            >
              <option value="ALL">All Districts (CG)</option>
              <option value="Sakti">Sakti</option>
              <option value="Janjgir-Champa">Janjgir-Champa</option>
              <option value="Korba">Korba</option>
              <option value="Bilaspur">Bilaspur</option>
              <option value="Raigarh">Raigarh</option>
              <option value="Raipur">Raipur</option>
              <option value="Durg">Durg</option>
            </select>
          </div>

          {/* Discom Circle Filter */}
          <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-2 text-xs">
            <span className="text-slate-400">Circle:</span>
            <select
              value={discomFilter}
              onChange={(e) => setDiscomFilter(e.target.value)}
              className="bg-transparent text-slate-200 focus:outline-none text-xs"
            >
              <option value="ALL">All CSPDCL Circles</option>
              <option value="Bilaspur">Bilaspur Circle</option>
              <option value="Janjgir">Janjgir / Sakti</option>
              <option value="Korba">Korba Circle</option>
              <option value="Raigarh">Raigarh Circle</option>
              <option value="Raipur">Raipur Circle</option>
              <option value="Durg">Durg Circle</option>
            </select>
          </div>
        </div>
      </div>

      {/* Single Master Table */}
      <div className="bg-slate-900/90 rounded-xl border border-slate-800 shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-800/80 text-slate-400 text-[11px] uppercase tracking-wider border-b border-slate-700/80">
              <tr>
                <th className="px-4 py-3">Customer ID / Code</th>
                <th className="px-4 py-3">Full Name & Contact</th>
                <th className="px-4 py-3">Discom & Consumer No (K-No)</th>
                <th className="px-4 py-3">Location / District</th>
                <th className="px-4 py-3">Lifecycle Status</th>
                <th className="px-4 py-3">PMSG Portal Status</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-slate-500">
                    No customer records found matching this criterion.
                  </td>
                </tr>
              ) : (
                filteredCustomers.map((cust) => {
                  const pmsg = erpStore.getPmsgByCustomerId(cust.id);

                  return (
                    <tr
                      key={cust.id}
                      className="hover:bg-slate-800/50 transition-colors group cursor-pointer"
                      onClick={() => setSelectedCustomerId(cust.id)}
                    >
                      {/* Code */}
                      <td className="px-4 py-3.5">
                        <span className="font-mono text-amber-400 font-semibold block">
                          {cust.customer_code}
                        </span>
                        <span className="text-[10px] text-slate-500 font-mono">
                          Since {new Date(cust.created_at).toLocaleDateString()}
                        </span>
                      </td>

                      {/* Name & Mobile */}
                      <td className="px-4 py-3.5">
                        <div className="font-bold text-slate-100 group-hover:text-amber-400 transition-colors">
                          {cust.full_name}
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono mt-0.5 flex items-center gap-1.5">
                          <Phone className="w-3 h-3 text-slate-500" />
                          <span>{cust.primary_mobile}</span>
                        </div>
                      </td>

                      {/* Consumer No */}
                      <td className="px-4 py-3.5">
                        <span className="font-mono text-slate-200 font-medium bg-slate-800 px-2 py-0.5 rounded border border-slate-700/60">
                          {cust.consumer_number}
                        </span>
                        <span className="block text-[11px] text-slate-400 mt-1">
                          {cust.discom_name}
                        </span>
                      </td>

                      {/* Location */}
                      <td className="px-4 py-3.5">
                        <div className="text-slate-200 font-medium">{cust.district}</div>
                        <div className="text-[11px] text-slate-500">{cust.pincode}, {cust.state}</div>
                      </td>

                      {/* Lifecycle */}
                      <td className="px-4 py-3.5">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold ${
                          cust.lifecycle_status === 'COMMISSIONED' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                          cust.lifecycle_status === 'INSTALLED' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' :
                          cust.lifecycle_status === 'REGISTERED' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' :
                          'bg-slate-700 text-slate-300'
                        }`}>
                          {cust.lifecycle_status}
                        </span>
                      </td>

                      {/* PMSG Portal */}
                      <td className="px-4 py-3.5">
                        {pmsg?.portal_application_no ? (
                          <div>
                            <span className="font-mono text-emerald-400 font-medium text-[11px] block">
                              {pmsg.portal_application_no}
                            </span>
                            <span className="text-[10px] text-slate-400 font-mono">
                              Stage: {pmsg.stage}
                            </span>
                          </div>
                        ) : (
                          <span className="text-[11px] text-amber-400/80 bg-amber-950/40 px-2 py-0.5 rounded border border-amber-800/30">
                            Portal Reg. Pending
                          </span>
                        )}
                      </td>

                      {/* Action */}
                      <td className="px-4 py-3.5 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedCustomerId(cust.id);
                          }}
                          className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 group-hover:text-amber-400 text-xs font-medium border border-slate-700 inline-flex items-center gap-1 transition-all"
                        >
                          <span>Master Details</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail Drawer */}
      <CustomerDetailDrawer
        customer={selectedCustomer}
        isOpen={!!selectedCustomerId}
        onClose={() => setSelectedCustomerId(null)}
      />
    </div>
  );
};
