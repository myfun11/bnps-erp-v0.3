import React, { useState } from 'react';
import { erpStore } from '../../services/erpStore';
import { useAuth } from '../../context/AuthContext';
import { BRANCHES_LIST, StaffMember } from '../../services/mockData';
import { BranchLocation } from '../../types/database';
import { 
  Building2, 
  Users, 
  Plus, 
  Search, 
  Key, 
  Copy, 
  Check, 
  ShieldCheck, 
  Phone, 
  Mail, 
  MapPin, 
  Calendar,
  Lock,
  UserPlus,
  BadgeCheck
} from 'lucide-react';

export const BranchStaffManagement: React.FC = () => {
  const { currentProfile, userRole } = useAuth();
  const [selectedBranch, setSelectedBranch] = useState<BranchLocation | 'ALL'>('ALL');
  const [search, setSearch] = useState('');
  const [showStaffModal, setShowStaffModal] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [newlyCreatedStaff, setNewlyCreatedStaff] = useState<StaffMember | null>(null);

  // Form State
  const [staffForm, setStaffForm] = useState({
    full_name: '',
    role: 'office_admin' as 'office_admin' | 'receptionist' | 'field_officer' | 'technician' | 'accountant',
    branch: 'Jaijaipur' as BranchLocation,
    phone: '',
    email: '',
    login_password: '',
  });

  const staffList = erpStore.getStaffByBranch(selectedBranch);

  const filteredStaff = staffList.filter((s) => {
    const q = search.toLowerCase();
    return (
      s.full_name.toLowerCase().includes(q) ||
      s.employee_code.toLowerCase().includes(q) ||
      s.phone.includes(q) ||
      s.email.toLowerCase().includes(q) ||
      s.branch.toLowerCase().includes(q)
    );
  });

  const handleCopyCredentials = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  const handleCreateStaff = (e: React.FormEvent) => {
    e.preventDefault();
    if (!staffForm.full_name || !staffForm.phone) {
      alert('Please enter employee full name and mobile number');
      return;
    }

    const res = erpStore.createStaffMember(
      {
        ...staffForm,
        email: staffForm.email || `${staffForm.full_name.toLowerCase().replace(/\s+/g, '.')}.${staffForm.branch.toLowerCase()}@bhuminidhi.com`,
        login_password: staffForm.login_password || `${staffForm.full_name.split(' ')[0]}@${staffForm.branch}2026`,
      },
      currentProfile.id
    );

    if (res.success && res.staff) {
      setNewlyCreatedStaff(res.staff);
      setShowStaffModal(false);
      setStaffForm({
        full_name: '',
        role: 'office_admin',
        branch: 'Jaijaipur',
        phone: '',
        email: '',
        login_password: '',
      });
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="bg-slate-900/90 rounded-2xl p-5 border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
            <Building2 className="w-5 h-5 text-amber-400" />
            <span>Branch & Staff Appointment Management</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Branches: Jaijaipur, Sakti, Korba, Bilaspur, Janjgir-Champa, Raigarh, Raipur • Appointment & Admin Credentials Issuance
          </p>
        </div>

        <button
          onClick={() => setShowStaffModal(true)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold shadow-md shadow-amber-500/20 transition-all cursor-pointer"
        >
          <UserPlus className="w-4 h-4 stroke-[2.5]" />
          <span>+ Appoint New Staff / Manager</span>
        </button>
      </div>

      {/* Newly Created Credentials Flash Card */}
      {newlyCreatedStaff && (
        <div className="p-5 rounded-2xl bg-gradient-to-r from-emerald-950/80 to-slate-900 border-2 border-emerald-500/50 shadow-xl space-y-3 animate-fade-in">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BadgeCheck className="w-6 h-6 text-emerald-400" />
              <div>
                <h4 className="text-sm font-bold text-slate-100">
                  New Staff / Manager Appointed! Login Credentials Issued
                </h4>
                <p className="text-xs text-slate-400">
                  Share these login credentials securely with the new employee
                </p>
              </div>
            </div>
            <button
              onClick={() => setNewlyCreatedStaff(null)}
              className="text-xs text-slate-400 hover:text-white px-2 py-1"
            >
              ✕ Close
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3 bg-slate-950/70 rounded-xl border border-slate-800 text-xs font-mono">
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-sans">Employee Code</span>
              <span className="text-amber-400 font-bold">{newlyCreatedStaff.employee_code}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-sans">Assigned Branch</span>
              <span className="text-slate-100 font-bold">{newlyCreatedStaff.branch}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-sans">Login Mobile / Email</span>
              <span className="text-slate-200">{newlyCreatedStaff.phone}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-sans">Login Password</span>
              <span className="text-emerald-400 font-bold bg-emerald-950/50 px-2 py-0.5 rounded">
                {newlyCreatedStaff.login_password}
              </span>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              onClick={() => handleCopyCredentials(
                `BNPS ERP Login Credentials:\nBranch: ${newlyCreatedStaff.branch}\nEmployee ID: ${newlyCreatedStaff.employee_code}\nName: ${newlyCreatedStaff.full_name}\nRole: ${newlyCreatedStaff.role_title}\nLogin: ${newlyCreatedStaff.phone} / ${newlyCreatedStaff.email}\nPassword: ${newlyCreatedStaff.login_password}`,
                newlyCreatedStaff.id
              )}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow transition-all"
            >
              {copiedId === newlyCreatedStaff.id ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedId === newlyCreatedStaff.id ? 'Copied to Clipboard!' : 'Copy Credentials to Share'}</span>
            </button>
          </div>
        </div>
      )}

      {/* Branch Tabs Filter */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        <button
          onClick={() => setSelectedBranch('ALL')}
          className={`px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
            selectedBranch === 'ALL'
              ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
              : 'bg-slate-900/80 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
          }`}
        >
          All Branches (7 Locations)
        </button>

        {BRANCHES_LIST.map((br) => {
          const count = erpStore.getStaffByBranch(br).length;
          const isSelected = selectedBranch === br;
          return (
            <button
              key={br}
              onClick={() => setSelectedBranch(br)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all flex items-center gap-1.5 ${
                isSelected
                  ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                  : 'bg-slate-900/80 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              <span>{br}</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                isSelected ? 'bg-slate-950 text-amber-300' : 'bg-slate-800 text-slate-300'
              }`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Search Input */}
      <div className="relative max-w-sm">
        <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by Staff Name, Code, Phone, Branch..."
          className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-400"
        />
      </div>

      {/* Staff Roster Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredStaff.map((staff) => (
          <div
            key={staff.id}
            className="bg-slate-900/90 rounded-2xl p-5 border border-slate-800 shadow-md flex flex-col justify-between space-y-4 hover:border-slate-700 transition-all"
          >
            <div>
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-xs font-mono text-amber-400 font-bold">{staff.employee_code}</span>
                  <h4 className="text-base font-bold text-slate-100">{staff.full_name}</h4>
                  <div className="text-xs text-emerald-400 font-medium mt-0.5">{staff.role_title}</div>
                </div>

                <span className="text-xs px-2.5 py-1 rounded-full font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-amber-400" />
                  <span>{staff.branch}</span>
                </span>
              </div>

              {/* Contact info */}
              <div className="space-y-1.5 text-xs text-slate-300 mt-3 pt-3 border-t border-slate-800">
                <div className="flex items-center gap-2">
                  <Phone className="w-3.5 h-3.5 text-slate-400" />
                  <span className="font-mono">{staff.phone}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Mail className="w-3.5 h-3.5 text-slate-400" />
                  <span className="truncate">{staff.email}</span>
                </div>
              </div>

              {/* Login Credentials Box (Admin given) */}
              <div className="mt-3 p-2.5 rounded-xl bg-slate-950/70 border border-slate-800/80 text-[11px] space-y-1">
                <div className="flex items-center justify-between text-slate-400">
                  <span className="flex items-center gap-1">
                    <Lock className="w-3 h-3 text-amber-400" />
                    <span>Admin Issued Password:</span>
                  </span>
                  <span className="font-mono font-bold text-emerald-400 bg-emerald-950/40 px-2 py-0.5 rounded">
                    {staff.login_password}
                  </span>
                </div>
                <div className="text-[10px] text-slate-500">
                  Staff can login with Phone ({staff.phone}) or Email using this password
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-xs text-slate-500">
              <span>Appointed: {staff.joined_date}</span>
              <button
                onClick={() => handleCopyCredentials(
                  `BNPS ERP Login:\nStaff: ${staff.full_name}\nRole: ${staff.role_title}\nBranch: ${staff.branch}\nID: ${staff.employee_code}\nPhone: ${staff.phone}\nPassword: ${staff.login_password}`,
                  staff.id
                )}
                className="text-amber-400 hover:text-amber-300 flex items-center gap-1 text-[11px] font-semibold"
              >
                {copiedId === staff.id ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                <span>{copiedId === staff.id ? 'Copied!' : 'Copy Login Info'}</span>
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Appointment Modal */}
      {showStaffModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-amber-400" />
                <span>Appoint New Staff Member (Executive Deputation)</span>
              </h3>
              <button onClick={() => setShowStaffModal(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleCreateStaff} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Employee Full Name *</label>
                <input
                  type="text"
                  required
                  value={staffForm.full_name}
                  onChange={(e) => setStaffForm({ ...staffForm, full_name: e.target.value })}
                  placeholder="e.g. Amit Kumar Dewangan"
                  className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-xs text-slate-100 focus:outline-none focus:border-amber-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Assigned Branch *</label>
                  <select
                    value={staffForm.branch}
                    onChange={(e) => setStaffForm({ ...staffForm, branch: e.target.value as BranchLocation })}
                    className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-xs text-amber-400 font-bold focus:outline-none"
                  >
                    {BRANCHES_LIST.map((b) => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Staff Role / Designation *</label>
                  <select
                    value={staffForm.role}
                    onChange={(e) => setStaffForm({ ...staffForm, role: e.target.value as any })}
                    className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-xs text-slate-100 focus:outline-none"
                  >
                    <option value="office_admin">Office Admin / Branch Manager</option>
                    <option value="receptionist">Receptionist / Front Desk</option>
                    <option value="field_officer">Field Officer</option>
                    <option value="technician">Solar Technician</option>
                    <option value="accountant">Accountant</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Mobile Phone (Login Mobile) *</label>
                  <input
                    type="tel"
                    required
                    pattern="[0-9]{10}"
                    value={staffForm.phone}
                    onChange={(e) => setStaffForm({ ...staffForm, phone: e.target.value })}
                    placeholder="10-digit mobile"
                    className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-xs text-slate-100 font-mono focus:outline-none focus:border-amber-400"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Email Address (Login Email)</label>
                  <input
                    type="email"
                    value={staffForm.email}
                    onChange={(e) => setStaffForm({ ...staffForm, email: e.target.value })}
                    placeholder="auto-generated if empty"
                    className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-xs text-slate-100 focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Login Password (Admin Assigned Password) *
                </label>
                <div className="relative">
                  <Key className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
                  <input
                    type="text"
                    value={staffForm.login_password}
                    onChange={(e) => setStaffForm({ ...staffForm, login_password: e.target.value })}
                    placeholder="e.g. Jaijaipur@2026 (auto-generated if empty)"
                    className="w-full pl-9 pr-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-xs text-emerald-400 font-mono font-bold focus:outline-none focus:border-amber-400"
                  />
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  This password will be issued to the employee to enable instant ERP login.
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowStaffModal(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 text-xs font-semibold text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold shadow-md shadow-amber-500/20 cursor-pointer"
                >
                  Appoint Staff & Generate Credentials
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
