import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { 
  dashboardService, 
  TopAgentMetric 
} from '../../services/dashboardService';
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
  ChevronRight,
  Loader2,
  AlertCircle,
  Lock,
  RefreshCw
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
  const { currentProfile, isAuthenticated, isLiveSupabase, isLoading: isAuthLoading } = useAuth();
  
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [stats, setStats] = useState({
    totalLeads: 0,
    newLeadsWaiting: 0,
    convertedCustomers: 0,
    registeredOnPortal: 0,
    pendingRegistrations: 0,
    solarInstallations: '0 / 0',
    solarInstallationsPending: 0,
    bankLoansDisbursed: '₹0',
    loansPendingApproval: 0,
    vendorPayments: 'All Cleared',
    vendorPaymentsSubtext: 'Vendor loan disbursements',
    commissionGenerated: '₹0',
    commissionPaid: '₹0 paid to agents',
    activeAgents: '0 / 0',
  });

  const [monthlyChart, setMonthlyChart] = useState<Array<{ month: string; kw: number; height: string }>>([]);
  const [totalCapacityLabel, setTotalCapacityLabel] = useState<string>('Total 0 kW');
  const [topAgentsList, setTopAgentsList] = useState<TopAgentMetric[]>([]);

  const loadData = useCallback(async () => {
    if (isAuthLoading) {
      return;
    }

    if (!isAuthenticated) {
      setLoading(false);
      setErrorMessage(null);
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      const liveData = await dashboardService.getDashboardSummary();
      if (liveData && liveData.kpis) {
        const k = liveData.kpis;

        // Format Bank Loans Disbursed
        const loanAmt = Number(k.bank_loans_disbursed_amount || 0);
        const loanFormatted = loanAmt >= 100000 
          ? `₹${(loanAmt / 100000).toFixed(2)}L` 
          : `₹${loanAmt.toLocaleString('en-IN')}`;

        // Format Vendor Payments
        const vendorValue = k.vendor_payments_pending_count === 0 
          ? 'All Cleared' 
          : `${k.vendor_payments_pending_count} Pending`;
        const vendorSubtext = k.vendor_payments_pending_count === 0 
          ? 'Vendor loan disbursements' 
          : `₹${Number(k.vendor_payments_paid_amount || 0).toLocaleString('en-IN')} paid`;

        // Format Commission
        const commFormatted = `₹${Number(k.commission_generated_amount || 0).toLocaleString('en-IN')}`;
        const commPaidFormatted = `₹${Number(k.commission_paid_to_agents_amount || 0).toLocaleString('en-IN')} paid to agents`;

        setStats({
          totalLeads: k.total_leads,
          newLeadsWaiting: k.new_leads_waiting,
          convertedCustomers: k.converted_customers,
          registeredOnPortal: k.registered_on_portal,
          pendingRegistrations: k.pending_registrations,
          solarInstallations: `${k.solar_installations_completed} / ${k.solar_installations_total}`,
          solarInstallationsPending: k.solar_installations_pending,
          bankLoansDisbursed: loanFormatted,
          loansPendingApproval: k.loans_pending_approval_count,
          vendorPayments: vendorValue,
          vendorPaymentsSubtext: vendorSubtext,
          commissionGenerated: commFormatted,
          commissionPaid: commPaidFormatted,
          activeAgents: `${k.active_agents_count} / ${k.total_agents_count || 0}`,
        });

        // Live Monthly Solar Installations
        if (liveData.monthly_installations && liveData.monthly_installations.length > 0) {
          const sumCap = liveData.monthly_installations.reduce((acc, curr) => acc + Number(curr.capacity_kw || 0), 0);
          setTotalCapacityLabel(`Total ${sumCap.toFixed(0)} kW`);
          const maxKw = Math.max(...liveData.monthly_installations.map((m) => Number(m.capacity_kw || 0)), 1);
          const bars = liveData.monthly_installations.map((item) => {
            const kw = Number(item.capacity_kw || 0);
            const pct = Math.max(12, Math.min(100, Math.round((kw / maxKw) * 100)));
            return {
              month: item.month,
              kw,
              height: `${pct}%`,
            };
          });
          setMonthlyChart(bars);
        } else {
          setMonthlyChart([]);
          setTotalCapacityLabel('Total 0 kW');
        }

        // Live Top Performing Agents Leaderboard
        if (liveData.top_agents && liveData.top_agents.length > 0) {
          setTopAgentsList(liveData.top_agents);
        } else {
          setTopAgentsList([]);
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch live dashboard summary from Supabase RPC.';
      console.error('[OverviewDashboard] Live RPC get_dashboard_summary failed:', err);
      setErrorMessage(msg);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, isAuthLoading]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Alert banner for Unauthenticated Session or Live RPC Error */}
      {!isAuthenticated && !isAuthLoading && (
        <div className="rounded-xl bg-amber-500/10 border border-amber-500/30 p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Lock className="w-5 h-5 text-amber-400 shrink-0" />
            <div>
              <div className="text-xs sm:text-sm font-bold text-amber-300">Authentication Required</div>
              <div className="text-[11px] sm:text-xs text-amber-200/80">Please log in to view live operational metrics from Supabase.</div>
            </div>
          </div>
          <button
            onClick={() => onNavigate('login')}
            className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition-colors cursor-pointer shrink-0"
          >
            Log In
          </button>
        </div>
      )}

      {isAuthenticated && errorMessage && (
        <div className="rounded-xl bg-rose-500/10 border border-rose-500/30 p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
            <div>
              <div className="text-xs sm:text-sm font-bold text-rose-300">Live Backend RPC Error</div>
              <div className="text-[11px] sm:text-xs text-rose-200/80">{errorMessage}</div>
            </div>
          </div>
          <button
            onClick={loadData}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-colors cursor-pointer shrink-0"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Retry</span>
          </button>
        </div>
      )}

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
            <span>{stats.newLeadsWaiting} new leads waiting</span>
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
            <span>{stats.registeredOnPortal} registered on portal</span>
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
            <span>{stats.solarInstallationsPending} pending installation</span>
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
            <span>{stats.loansPendingApproval} loans pending approval</span>
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
            <span>{stats.vendorPaymentsSubtext}</span>
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
            <span>{stats.commissionPaid}</span>
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
                {totalCapacityLabel}
              </span>
            </div>

            {/* Visual Bar Chart */}
            <div className="pt-8 pb-3 grid grid-cols-6 gap-3 items-end h-56">
              {monthlyChart.map((bar) => (
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
              {topAgentsList.map((agent) => (
                <div key={agent.agent_code || agent.rank} className="p-3 rounded-xl bg-slate-800/60 border border-slate-700/60 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-7 h-7 rounded-full ${
                      agent.rank === 1 ? 'bg-amber-500' :
                      agent.rank === 2 ? 'bg-yellow-500' :
                      agent.rank === 3 ? 'bg-blue-500' : 'bg-slate-700'
                    } text-slate-950 font-black text-xs flex items-center justify-center shadow-md`}>
                      {agent.rank}
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-100">{agent.agent_name}</div>
                      <div className="text-[10px] font-mono text-slate-400">{agent.agent_code}</div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-xs font-bold text-emerald-400">{agent.verified_installs} Installs</div>
                    <div className="text-[10px] font-mono text-slate-400">₹{Number(agent.commission_earned_amount).toLocaleString('en-IN')}</div>
                  </div>
                </div>
              ))}
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
