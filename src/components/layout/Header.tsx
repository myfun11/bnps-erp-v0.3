import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { BranchLocation } from '../../types/database';
import { BRANCHES_LIST } from '../../services/mockData';
import { erpStore } from '../../services/erpStore';
import { BnpsLogo } from '../common/BnpsLogo';
import { 
  Sun, 
  Search, 
  Plus, 
  Zap, 
  ChevronDown, 
  LogOut, 
  User,
  Building2,
  MapPin
} from 'lucide-react';

interface HeaderProps {
  onOpenSearch: () => void;
  onOpenNewLead: () => void;
  onRunCommissionTest: () => void;
  onOpenBranches?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenSearch,
  onOpenNewLead,
  onRunCommissionTest,
  onOpenBranches,
}) => {
  const { currentProfile, userRole, logout } = useAuth();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [activeBranch, setActiveBranch] = useState<BranchLocation | 'ALL'>(erpStore.getActiveBranchFilter());

  const handleBranchChange = (branch: BranchLocation | 'ALL') => {
    setActiveBranch(branch);
    erpStore.setActiveBranchFilter(branch);
  };

  return (
    <header className="sticky top-0 z-40 bg-slate-950 border-b border-slate-800 text-white shadow-lg">
      <div className="px-4 sm:px-6 py-2.5 flex items-center justify-between gap-4">
        {/* Brand Section with Official BNPS Logo */}
        <div className="flex items-center gap-3 shrink-0">
          <BnpsLogo variant="icon" size="sm" />

          <div>
            <div className="flex items-center gap-2">
              <span className="text-base sm:text-lg font-black tracking-wider text-slate-100">
                BHUMI NIDHI
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500 text-slate-950 font-black tracking-wide uppercase shadow-sm">
                POWAR SOLUTION
              </span>
            </div>
            <div className="text-[11px] text-emerald-400 font-medium flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span>Powaring Global Connections • PM Surya Ghar CSPDCL</span>
            </div>
          </div>
        </div>

        {/* Global Search Bar (Center) */}
        <div className="flex-1 max-w-lg hidden md:block">
          <button
            onClick={onOpenSearch}
            className="w-full flex items-center justify-between px-4 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700 transition-all text-xs group"
          >
            <div className="flex items-center gap-2.5">
              <Search className="w-4 h-4 text-amber-400 group-hover:scale-110 transition-transform" />
              <span>Search Customer, Mobile, KNO, Agent ID, Project, Loan...</span>
            </div>
            <kbd className="px-2 py-0.5 text-[10px] font-mono rounded bg-slate-800 border border-slate-700 text-slate-400">
              /
            </kbd>
          </button>
        </div>

        {/* Branch Context Selector & Action Buttons (Right) */}
        <div className="flex items-center gap-2.5 shrink-0">
          {/* Active Branch Selector Pill */}
          <div className="hidden lg:flex items-center gap-1.5 bg-slate-900 px-2.5 py-1.5 rounded-xl border border-slate-800 text-xs">
            <MapPin className="w-3.5 h-3.5 text-amber-400" />
            <select
              value={activeBranch}
              onChange={(e) => handleBranchChange(e.target.value as any)}
              className="bg-transparent text-xs font-bold text-slate-200 outline-none cursor-pointer"
            >
              <option value="ALL" className="bg-slate-900 text-slate-200">All Branches ({BRANCHES_LIST.length} Locations)</option>
              {BRANCHES_LIST.map((b) => (
                <option key={b} value={b} className="bg-slate-900 text-amber-400 font-semibold">
                  Branch: {b === 'Jaijaipur' ? 'HQ Jaijaipur' : b}
                </option>
              ))}
            </select>
          </div>

          {/* Commission Test Action Button */}
          <button
            onClick={onRunCommissionTest}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-slate-950 font-bold text-xs shadow-md shadow-amber-500/20 transition-all cursor-pointer"
          >
            <Zap className="w-3.5 h-3.5 fill-slate-950" />
            <span>Commission Test</span>
          </button>

          {/* New Lead Action Button */}
          <button
            onClick={onOpenNewLead}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow-md shadow-emerald-500/20 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>+ New Lead</span>
          </button>

          {/* User Profile Pill & Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-left transition-all cursor-pointer"
            >
              <div className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center font-bold text-xs">
                A
              </div>
              <div className="hidden lg:block text-left text-xs leading-none">
                <div className="font-bold text-slate-200">{currentProfile.full_name}</div>
                <div className="text-[10px] text-amber-400 font-mono font-semibold mt-0.5">
                  {userRole.toUpperCase()} • {currentProfile.branch === 'Jaijaipur' ? 'HQ Jaijaipur' : (currentProfile.branch || 'HQ Jaijaipur')}
                </div>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>

            {/* Dropdown Menu */}
            {showUserMenu && (
              <div className="absolute right-0 mt-2 w-64 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-2 z-50 text-xs animate-fade-in">
                <div className="px-3 py-2 border-b border-slate-800">
                  <div className="font-bold text-slate-100">{currentProfile.full_name}</div>
                  <div className="text-[11px] text-slate-400">{currentProfile.email || currentProfile.phone}</div>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-semibold border border-amber-500/30">
                      {userRole}
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                      📍 {currentProfile.branch === 'Jaijaipur' ? 'HQ Jaijaipur' : (currentProfile.branch || 'HQ Jaijaipur')}
                    </span>
                  </div>
                </div>

                {/* Quick Link to Branches */}
                {onOpenBranches && (
                  <button
                    onClick={() => {
                      setShowUserMenu(false);
                      onOpenBranches();
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-slate-300 hover:bg-slate-800 rounded-lg text-left transition-colors font-medium"
                  >
                    <Building2 className="w-3.5 h-3.5 text-amber-400" />
                    <span>Manage Branches & Staff</span>
                  </button>
                )}

                {/* Logout Button */}
                <button
                  onClick={() => {
                    setShowUserMenu(false);
                    logout();
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-rose-400 hover:bg-rose-500/10 rounded-lg text-left transition-colors font-medium mt-1 cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sign Out</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
