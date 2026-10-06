import React from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  Sun, 
  Search, 
  UserCheck, 
  Users, 
  UserPlus, 
  LayoutDashboard, 
  Layers, 
  History,
  CheckCircle2
} from 'lucide-react';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onOpenSearch: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ activeTab, setActiveTab, onOpenSearch }) => {
  const { currentProfile } = useAuth();

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'leads', label: 'Lead Engine', icon: UserPlus },
    { id: 'customers', label: 'Customer Master', icon: Users },
    { id: 'agents', label: 'Agent Hierarchy (10-Tier)', icon: Layers },
    { id: 'audit', label: 'Audit Ledger', icon: History },
  ];

  return (
    <header className="sticky top-0 z-40 bg-slate-900 border-b border-slate-800 text-white shadow-md">
      {/* Top Banner: Brand + Unified Search + Role Switcher */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          
          {/* Logo & Company Title */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-tr from-amber-500 to-yellow-400 flex items-center justify-center shadow-lg shadow-amber-500/20 text-slate-950 font-bold">
              <Sun className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-black tracking-wider text-amber-400">BNPS ERP</span>
                <span className="text-xs px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono font-medium border border-amber-500/30">
                  v0.3 LOCKED
                </span>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">
                Bhumi Nidhi Powar Solution • PM Surya Ghar Rooftop Solar
              </p>
            </div>
          </div>

          {/* Quick Universal Search Trigger */}
          <div className="flex-1 max-w-md hidden md:block">
            <button
              onClick={onOpenSearch}
              className="w-full flex items-center justify-between px-3.5 py-1.5 rounded-lg bg-slate-800/90 border border-slate-700/80 text-slate-400 hover:text-slate-200 hover:border-slate-600 transition-all text-sm group"
            >
              <div className="flex items-center gap-2">
                <Search className="w-4 h-4 text-amber-400 group-hover:scale-110 transition-transform" />
                <span>Search Customer, Lead, Mobile, Consumer No...</span>
              </div>
              <kbd className="px-1.5 py-0.5 text-[11px] font-mono rounded bg-slate-900 border border-slate-700 text-slate-400">
                /
              </kbd>
            </button>
          </div>

          {/* Role Switcher & Active Profile Simulation */}
          <div className="flex items-center gap-3">
            {/* Mobile search button */}
            <button
              onClick={onOpenSearch}
              className="md:hidden p-2 rounded-lg bg-slate-800 text-slate-300 hover:text-white"
              title="Search"
            >
              <Search className="w-5 h-5" />
            </button>

            {/* User Avatar & Name */}
            <div className="hidden lg:flex items-center gap-2.5 pl-2 border-l border-slate-800">
              <div className="w-8 h-8 rounded-full bg-slate-700 border border-slate-600 flex items-center justify-center font-bold text-xs text-amber-300">
                {currentProfile.full_name.charAt(0)}
              </div>
              <div className="text-left text-xs leading-tight">
                <div className="font-semibold text-slate-200">{currentProfile.full_name}</div>
                <div className="text-[11px] text-slate-400">{currentProfile.phone}</div>
              </div>
            </div>

          </div>
        </div>

        {/* Tab Navigation */}
        <nav className="flex space-x-1 sm:space-x-4 border-t border-slate-800/80 overflow-x-auto py-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center gap-2 px-3 py-2 rounded-md text-xs sm:text-sm font-medium whitespace-nowrap transition-all ${
                  isActive
                    ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-slate-950' : 'text-slate-400'}`} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
};
