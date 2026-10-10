import React from 'react';
import { 
  LayoutDashboard, 
  UserPlus, 
  Users, 
  ShieldCheck, 
  GitFork, 
  Sun, 
  FileText, 
  FolderKanban, 
  Wrench, 
  Landmark, 
  CreditCard, 
  Percent, 
  Trophy, 
  Receipt, 
  BarChart3, 
  Files, 
  History,
  Building2,
  ChevronRight
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  customerCount: number;
  agentCount: number;
  quotationCount?: number;
  staffCount?: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  customerCount,
  agentCount,
  quotationCount,
  staffCount = 12,
}) => {
  const { canViewQuotations } = useAuth();
  const menuItems = [
    { id: 'dashboard', num: '1', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'user-admin', num: '2', label: 'User Administration', icon: ShieldCheck },
    { id: 'leads', num: '3', label: 'Leads', icon: UserPlus },
    { id: 'customers', num: '4', label: 'Customers', icon: Users, badge: customerCount },
    { id: 'agents', num: '5', label: 'Agents', icon: ShieldCheck, badge: agentCount },
    { id: 'agent-tree', num: '6', label: 'Agent Network Tree', icon: GitFork },
    { id: 'pmsg', num: '7', label: 'PM Surya Ghar Tracking', icon: Sun },
    { id: 'quotations', num: '8', label: 'Quotations', icon: FileText, badge: quotationCount },
    { id: 'projects', num: '9', label: 'Projects', icon: FolderKanban },
    { id: 'installations', num: '10', label: 'Installations', icon: Wrench },
    { id: 'loans', num: '11', label: 'Loans', icon: Landmark },
    { id: 'payments', num: '12', label: 'Payments', icon: CreditCard },
    { id: 'commissions', num: '13', label: 'Commission & Payout', icon: Percent },
    { id: 'rewards', num: '14', label: 'Rewards', icon: Trophy },
    { id: 'finance', num: '15', label: 'Finance / Expenses', icon: Receipt },
    { id: 'reports', num: '16', label: 'Reports', icon: BarChart3 },
    { id: 'documents', num: '17', label: 'Documents', icon: Files },
    { id: 'audit', num: '18', label: 'Audit Log', icon: History },
  ];

  const visibleMenuItems = menuItems.filter(item => {
    if (item.id === 'quotations' && !canViewQuotations) return false;
    return true;
  });

  return (
    <aside className="w-64 bg-slate-950 border-r border-slate-800/80 flex flex-col shrink-0 h-full overflow-hidden text-slate-300 z-20 select-none">
      {/* Sidebar Header */}
      <div className="px-5 py-4 flex items-center justify-between border-b border-slate-800/60">
        <span className="text-[11px] font-bold text-slate-400 tracking-widest uppercase">
          ERP NAVIGATION
        </span>
        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 font-bold border border-amber-500/30">
          V2.4 CG
        </span>
      </div>

      {/* Navigation Items (Scrollable) */}
      <nav className="flex-1 overflow-y-auto p-2 space-y-0.5 custom-scrollbar">
        {visibleMenuItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;

          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all group ${
                isActive
                  ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30 font-semibold shadow-sm'
                  : 'text-slate-400 hover:text-slate-100 hover:bg-slate-900/80'
              }`}
            >
              <div className="flex items-center gap-2.5 truncate">
                <Icon className={`w-4 h-4 shrink-0 transition-colors ${
                  isActive ? 'text-amber-400' : 'text-slate-400 group-hover:text-amber-400'
                }`} />
                <span className="truncate">
                  {item.num}. {item.label}
                </span>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {item.badge !== undefined && (
                  <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full font-bold ${
                    isActive ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-400'
                  }`}>
                    {item.badge}
                  </span>
                )}
                {isActive && <ChevronRight className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
              </div>
            </button>
          );
        })}
      </nav>

      {/* Bottom Invariant System State */}
      <div className="p-3 border-t border-slate-800/80 bg-slate-950/80 text-[11px] text-slate-500">
        <div className="flex items-center gap-1.5 text-emerald-400 font-medium">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>CSPDCL Cloud Connected</span>
        </div>
        <div className="text-[10px] text-slate-500 mt-0.5">PostgreSQL Single Master Invariant</div>
      </div>
    </aside>
  );
};
