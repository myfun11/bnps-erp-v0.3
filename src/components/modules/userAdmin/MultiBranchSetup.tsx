import React, { useState } from 'react';
import { BranchSetup } from '../../../services/userAdminData';
import { Building2, MapPin, UserPlus, Users, Check, X, Sparkles } from 'lucide-react';

interface MultiBranchSetupProps {
  branches: BranchSetup[];
  onAppointStaff: (branchName: string) => void;
  onAddBranch: () => void;
}

export const MultiBranchSetup: React.FC<MultiBranchSetupProps> = ({
  branches,
  onAppointStaff,
  onAddBranch,
}) => {
  return (
    <div className="space-y-6">
      {/* Notice Banner Matching 14.PNG */}
      <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 flex items-start gap-3 text-xs">
        <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 mt-0.5">
          <Building2 className="w-4 h-4" />
        </div>
        <div className="space-y-1 text-slate-300">
          <h4 className="font-bold text-amber-300 text-sm">
            Branch Network Expansion for Chhattisgarh Jurisdiction
          </h4>
          <p className="leading-relaxed">
            As requested, BNPS is operational at <strong className="text-slate-100">Jaijaipur (Central Head Office)</strong> and scheduled for rollout across <strong className="text-slate-100">Janjgir-Champa, Sakti, Raigarh, Korba, Bilaspur, Raipur, and Basana</strong>. Admin can appoint designated Branch Managers and Receptionists for each branch to run localized registrations and customer desks.
          </p>
        </div>
      </div>

      {/* Branch Cards Grid (4 columns on lg, 2 on md, 1 on sm) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {branches.map((b) => {
          const isHQ = b.status === 'HQ - ACTIVE';
          const isActive = b.status === 'ACTIVE';

          return (
            <div
              key={b.id}
              className={`rounded-2xl p-5 border transition shadow-lg flex flex-col justify-between space-y-4 ${
                isHQ
                  ? 'bg-gradient-to-b from-blue-950/40 to-slate-900 border-blue-500/40 shadow-blue-500/10'
                  : 'bg-slate-900/90 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="space-y-3">
                {/* Header Code & Status */}
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-slate-950 text-slate-400 border border-slate-800">
                    {b.branch_code}
                  </span>
                  <span
                    className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${
                      isHQ
                        ? 'bg-blue-500/20 text-blue-400 border-blue-500/40'
                        : isActive
                        ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                        : 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                    }`}
                  >
                    {b.status}
                  </span>
                </div>

                {/* Branch Name & Location */}
                <div>
                  <h3 className="text-lg font-bold text-slate-100">{b.name}</h3>
                  <div className="flex items-center gap-1 text-[11px] text-slate-400 mt-0.5">
                    <MapPin className="w-3 h-3 text-amber-400 shrink-0" />
                    <span>{b.location}</span>
                  </div>
                </div>

                {/* Branch Manager */}
                <div className="text-xs space-y-0.5 pt-1">
                  <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                    BRANCH MANAGER
                  </div>
                  <div
                    className={`font-semibold ${
                      b.manager_name === 'Open for Appointment'
                        ? 'text-amber-400/90 italic'
                        : 'text-slate-200'
                    }`}
                  >
                    {b.manager_name}
                  </div>
                </div>

                {/* Address */}
                <div className="text-xs space-y-0.5">
                  <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                    ADDRESS / LOCATION
                  </div>
                  <div className="text-[11px] text-slate-400 leading-snug">
                    {b.address}
                  </div>
                </div>

                {/* Staff Assigned */}
                <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                  <span>Staff Assigned:</span>
                  <span className="font-mono font-bold text-slate-200">
                    {b.staff_assigned_count} Member(s)
                  </span>
                </div>
              </div>

              {/* Appoint Staff Button */}
              <button
                onClick={() => onAppointStaff(b.name)}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 text-xs font-semibold transition"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Appoint Staff</span>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};
