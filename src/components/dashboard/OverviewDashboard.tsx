import React, { useState, useEffect } from 'react';
import { erpStore } from '../../services/erpStore';
import { useAuth } from '../../context/AuthContext';
import { 
  Users, 
  UserPlus, 
  Clock, 
  Wrench, 
  Landmark, 
  CreditCard, 
  Percent, 
  ShieldCheck, 
  Plus, 
  FileText, 
  Zap, 
  ArrowUpRight,
  Sun,
  Award,
  ChevronRight
} from 'lucide-react';

interface OverviewDashboardProps {
  onNavigate: (tab: string) => void;
  onOpenNewLead: () => void;
  onRunCommissionTest: () => void;
}

export const OverviewDashboard: React.FC<OverviewDashboardProps> = ({
  onNavigate,
  onOpenNewLead,
  onRunCommissionTest,
}) => {
  const { currentProfile } = useAuth();
  const [stats, setStats] = useState({
    totalLeads: 5,
    convertedCustomers: 3,
    pendingRegistrations: 1,
    solarInstallations: '2 / 2',
    bankLoansDisbursed: '₹2.00L',
    vendorPayments: 'All Cleared',
    commissionGenerated: '₹25,000',
    activeAgents: '9 / 10',
  });

  const loadData = () => {
    const leads = erpStore.getLeads();
    const customers = erpStore.getCustomers();
    const pmsg = erpStore.getPmsgTracking();
    const agents = erpStore.getAgents();

    const converted = leads.filter((l) => l.stage === 'CONVERTED').length;
    const pending = pmsg.filter((p) => !p.portal_application_no && p.stage === 'INITIATED').length;

    setStats({
      totalLeads: leads.length,
      convertedCustomers: customers.length,
      pendingRegistrations: pending > 0 ? pending : 1,
      solarInstallations: '2 / 2',
      bankLoansDisbursed: '₹2.00L',
      vendorPayments: 'All Cleared',
      commissionGenerated: '₹25,000',
      activeAgents: `${agents.length} / 10`,
    });
  };

  useEffect(() => {
    loadData();
    const unsub = erpStore.subscribe(loadData);
    return () => unsub();
  }, []);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* 1. Hero Workflow Banner (Matching 2.PNG) */}
      <div className="rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900 to-slate-950 p-6 sm:p-7 border border-slate-800 shadow-xl relative overflow-hidden">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/15 text-amber-300 font-semibold text-xs border border-amber-500/30 mb-3">
              <Sun className="w-3.5 h-3.5 text-amber-400" />
              <span>PM Surya Ghar Muft Bijli Yojana Partner</span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-black text-slate-100 tracking-wide">
              BHUMI NIDHI POWAR SOLUTION
            </h1>

            <p className="text-xs sm:text-sm text-slate-300 mt-2 font-medium">
              End-to-End Rooftop Solar Workflow:{' '}
              <span className="text-amber-400 font-semibold">Lead</span> →{' '}
              <span className="text-amber-400 font-semibold">Customer</span> →{' '}
              <span className="text-amber-400 font-semibold">Registration</span> →{' '}
              <span className="text-amber-400 font-semibold">Project</span> →{' '}
              <span className="text-amber-400 font-semibold">Installation</span> →{' '}
              <span className="text-amber-400 font-semibold">Loan</span> →{' '}
              <span className="text-amber-400 font-semibold">Payment</span> →{' '}
              <span className="text-amber-400 font-semibold">Commission</span> →{' '}
              <span className="text-amber-400 font-semibold">Reward</span>
            </p>
          </div>

          {/* Quick Action Button Group */}
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              onClick={onOpenNewLead}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold shadow-lg shadow-emerald-500/20 transition-all cursor-pointer"
            >
              <UserPlus className="w-4 h-4 stroke-[2.5]" />
              <span>+ Add New Lead</span>
            </button>

            <button
              onClick={() => onNavigate('quotations')}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-400 text-xs font-bold border border-amber-500/40 shadow-sm transition-all cursor-pointer"
            >
              <FileText className="w-4 h-4" />
              <span>Generate Quote</span>
            </button>

            <button
              onClick={onRunCommissionTest}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-slate-950 text-xs font-bold shadow-lg shadow-amber-500/20 transition-all cursor-pointer"
            >
              <Zap className="w-4 h-4 fill-slate-950" />
              <span>Run Commission Test</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. Eight Core Metric KPI Cards (Exact Grid from 2.PNG) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Card 1: TOTAL LEADS */}
        <div 
          onClick={() => onNavigate('leads')}
          className="bg-slate-900/90 rounded-2xl p-4 sm:p-5 border border-slate-800/90 hover:border-slate-700 transition-all cursor-pointer group shadow-sm flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">TOTAL LEADS</span>
            <div className="w-9 h-9 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center">
              <UserPlus className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-slate-100 font-mono mt-3">
            {stats.totalLeads}
          </div>
          <div className="text-[11px] text-slate-400 mt-2 flex items-center justify-between">
            <span>0 new leads waiting</span>
            <ArrowUpRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-blue-400 transition-colors" />
          </div>
        </div>

        {/* Card 2: CONVERTED CUSTOMERS */}
        <div 
          onClick={() => onNavigate('customers')}
          className="bg-slate-900/90 rounded-2xl p-4 sm:p-5 border border-slate-800/90 hover:border-slate-700 transition-all cursor-pointer group shadow-sm flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">CONVERTED CUSTOMERS</span>
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-slate-100 font-mono mt-3">
            {stats.convertedCustomers}
          </div>
          <div className="text-[11px] text-slate-400 mt-2 flex items-center justify-between">
            <span>2 registered on portal</span>
            <ArrowUpRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-emerald-400 transition-colors" />
          </div>
        </div>

        {/* Card 3: PENDING REGISTRATIONS */}
        <div 
          onClick={() => onNavigate('pmsg')}
          className="bg-slate-900/90 rounded-2xl p-4 sm:p-5 border border-slate-800/90 hover:border-slate-700 transition-all cursor-pointer group shadow-sm flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">PENDING REGISTRATIONS</span>
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-slate-100 font-mono mt-3">
            {stats.pendingRegistrations}
          </div>
          <div className="text-[11px] text-slate-400 mt-2 flex items-center justify-between">
            <span>Awaiting doc/portal approval</span>
            <ArrowUpRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-amber-400 transition-colors" />
          </div>
        </div>

        {/* Card 4: SOLAR INSTALLATIONS */}
        <div 
          onClick={() => onNavigate('installations')}
          className="bg-slate-900/90 rounded-2xl p-4 sm:p-5 border border-slate-800/90 hover:border-slate-700 transition-all cursor-pointer group shadow-sm flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">SOLAR INSTALLATIONS</span>
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
              <Wrench className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-slate-100 font-mono mt-3">
            {stats.solarInstallations}
          </div>
          <div className="text-[11px] text-slate-400 mt-2 flex items-center justify-between">
            <span>0 pending installation</span>
            <ArrowUpRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-amber-400 transition-colors" />
          </div>
        </div>

        {/* Card 5: BANK LOANS DISBURSED */}
        <div 
          onClick={() => onNavigate('loans')}
          className="bg-slate-900/90 rounded-2xl p-4 sm:p-5 border border-slate-800/90 hover:border-slate-700 transition-all cursor-pointer group shadow-sm flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">BANK LOANS DISBURSED</span>
            <div className="w-9 h-9 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center">
              <Landmark className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-slate-100 font-mono mt-3">
            {stats.bankLoansDisbursed}
          </div>
          <div className="text-[11px] text-slate-400 mt-2 flex items-center justify-between">
            <span>0 loans pending approval</span>
            <ArrowUpRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-blue-400 transition-colors" />
          </div>
        </div>

        {/* Card 6: VENDOR PAYMENTS */}
        <div 
          onClick={() => onNavigate('payments')}
          className="bg-slate-900/90 rounded-2xl p-4 sm:p-5 border border-slate-800/90 hover:border-slate-700 transition-all cursor-pointer group shadow-sm flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">VENDOR PAYMENTS</span>
            <div className="w-9 h-9 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center">
              <CreditCard className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-slate-100 font-mono mt-3">
            {stats.vendorPayments}
          </div>
          <div className="text-[11px] text-slate-400 mt-2 flex items-center justify-between">
            <span>Vendor loan disbursements</span>
            <ArrowUpRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-rose-400 transition-colors" />
          </div>
        </div>

        {/* Card 7: COMMISSION GENERATED */}
        <div 
          onClick={() => onNavigate('commissions')}
          className="bg-slate-900/90 rounded-2xl p-4 sm:p-5 border border-slate-800/90 hover:border-slate-700 transition-all cursor-pointer group shadow-sm flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">COMMISSION GENERATED</span>
            <div className="w-9 h-9 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center">
              <Percent className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-slate-100 font-mono mt-3">
            {stats.commissionGenerated}
          </div>
          <div className="text-[11px] text-slate-400 mt-2 flex items-center justify-between">
            <span>₹0 paid to agents</span>
            <ArrowUpRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-purple-400 transition-colors" />
          </div>
        </div>

        {/* Card 8: ACTIVE AGENTS */}
        <div 
          onClick={() => onNavigate('agents')}
          className="bg-slate-900/90 rounded-2xl p-4 sm:p-5 border border-slate-800/90 hover:border-slate-700 transition-all cursor-pointer group shadow-sm flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">ACTIVE AGENTS</span>
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-slate-100 font-mono mt-3">
            {stats.activeAgents}
          </div>
          <div className="text-[11px] text-slate-400 mt-2 flex items-center justify-between">
            <span>Unlimited depth network</span>
            <ArrowUpRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-emerald-400 transition-colors" />
          </div>
        </div>
      </div>

      {/* 3. Monthly Solar Installations Bar Chart & Top Performing Agents (From 2.PNG) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Monthly Installations Chart Card */}
        <div className="lg:col-span-2 bg-slate-900/90 rounded-2xl p-6 border border-slate-800 shadow-md flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-100">
                  Monthly Solar Installations (FY 2026)
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Completed rooftop solar capacity under PM Surya Ghar
                </p>
              </div>

              <span className="px-3 py-1 rounded-xl bg-amber-500/20 text-amber-300 font-bold text-xs font-mono border border-amber-500/30">
                Total 355 kW+
              </span>
            </div>

            {/* Visual Bar Chart */}
            <div className="pt-8 pb-3 grid grid-cols-6 gap-3 items-end h-56">
              {[
                { month: 'Oct', kw: 21, height: '22%' },
                { month: 'Nov', kw: 38, height: '39%' },
                { month: 'Dec', kw: 52, height: '54%' },
                { month: 'Jan', kw: 68, height: '70%' },
                { month: 'Feb', kw: 84, height: '86%' },
                { month: 'Mar', kw: 98, height: '100%' },
              ].map((bar) => (
                <div key={bar.month} className="flex flex-col items-center h-full justify-end group">
                  <span className="text-[11px] font-mono text-slate-400 mb-1 font-semibold group-hover:text-amber-400 transition-colors">
                    {bar.kw} kW
                  </span>
                  <div className="w-full bg-slate-800/80 rounded-t-xl overflow-hidden flex items-end h-full">
                    <div
                      style={{ height: bar.height }}
                      className="w-full bg-gradient-to-t from-amber-600 to-amber-400 rounded-t-lg transition-all group-hover:brightness-110 shadow-lg shadow-amber-500/10"
                    />
                  </div>
                  <span className="text-xs font-medium text-slate-400 mt-2">{bar.month}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-500">
            <span>CSPDCL Feeder Synchronized Installations</span>
            <span className="text-emerald-400 font-semibold font-mono">100% Net Meter Verified</span>
          </div>
        </div>

        {/* Top Performing Agents Leaderboard Card */}
        <div className="bg-slate-900/90 rounded-2xl p-6 border border-slate-800 shadow-md flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <Award className="w-4 h-4 text-amber-400" />
                <span>Top Performing Agents</span>
              </h3>
              <button 
                onClick={() => onNavigate('agents')}
                className="text-xs text-amber-400 hover:text-amber-300 font-semibold"
              >
                All Agents
              </button>
            </div>

            <p className="text-[11px] text-slate-400 mb-4">
              Ranked by total verified installations in Chhattisgarh
            </p>

            <div className="space-y-3">
              {/* Rank 1 */}
              <div className="p-3 rounded-xl bg-slate-800/60 border border-slate-700/60 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-full bg-amber-500 text-slate-950 font-black text-xs flex items-center justify-center shadow-md">
                    1
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-100">Pooja Choudhary</div>
                    <div className="text-[10px] font-mono text-slate-400">AGT00009</div>
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-xs font-bold text-emerald-400">23 Installs</div>
                  <div className="text-[10px] font-mono text-slate-400">₹1,60,000</div>
                </div>
              </div>

              {/* Rank 2 */}
              <div className="p-3 rounded-xl bg-slate-800/60 border border-slate-700/60 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-full bg-yellow-500 text-slate-950 font-black text-xs flex items-center justify-center shadow-md">
                    2
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-100">Kavita Tiwari</div>
                    <div className="text-[10px] font-mono text-slate-400">AGT00008</div>
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-xs font-bold text-emerald-400">17 Installs</div>
                  <div className="text-[10px] font-mono text-slate-400">₹79,000</div>
                </div>
              </div>

              {/* Rank 3 */}
              <div className="p-3 rounded-xl bg-slate-800/60 border border-slate-700/60 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-full bg-blue-500 text-slate-950 font-black text-xs flex items-center justify-center shadow-md">
                    3
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-100">Mukesh Choudhary</div>
                    <div className="text-[10px] font-mono text-slate-400">AGT00010</div>
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-xs font-bold text-emerald-400">12 Installs</div>
                  <div className="text-[10px] font-mono text-slate-400">₹42,500</div>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-800 mt-4">
            <button
              onClick={() => onNavigate('agent-tree')}
              className="w-full py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 flex items-center justify-center gap-1.5 transition-all"
            >
              <span>View Full 10-Tier Agent Network Tree</span>
              <ChevronRight className="w-3.5 h-3.5 text-amber-400" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
