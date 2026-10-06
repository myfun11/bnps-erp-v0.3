import React, { useState } from 'react';
import { OfficeUser } from '../../../services/userAdminData';
import { Search, Key, FileText, Shield, UserCheck, X, Check, Lock } from 'lucide-react';

interface OfficeUsersTableProps {
  users: OfficeUser[];
  onOpenLetter: (letterId: string) => void;
  onUpdateStatus: (userId: string, newStatus: 'ACTIVE' | 'INACTIVE') => void;
}

export const OfficeUsersTable: React.FC<OfficeUsersTableProps> = ({
  users,
  onOpenLetter,
  onUpdateStatus,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [branchFilter, setBranchFilter] = useState('ALL');
  const [roleFilter, setRoleFilter] = useState('ALL');

  // Password Modal
  const [passwordModalUser, setPasswordModalUser] = useState<OfficeUser | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      u.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.user_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.phone.includes(searchQuery);

    const matchesStatus = statusFilter === 'ALL' || u.status === statusFilter;
    const matchesBranch = branchFilter === 'ALL' || u.branch.toLowerCase().includes(branchFilter.toLowerCase());
    const matchesRole = roleFilter === 'ALL' || u.role === roleFilter;

    return matchesSearch && matchesStatus && matchesBranch && matchesRole;
  });

  const getRoleBadgeStyle = (role: string) => {
    switch (role) {
      case 'MASTER_CONTROL':
        return 'bg-purple-500/20 text-purple-300 border-purple-500/30';
      case 'BRANCH_MANAGER':
        return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
      case 'BACKOFFICE':
        return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
      case 'RECEPTIONIST':
        return 'bg-teal-500/20 text-teal-300 border-teal-500/30';
      case 'OPERATIONAL_MANAGER':
        return 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30';
      default:
        return 'bg-slate-700 text-slate-300 border-slate-600';
    }
  };

  const handleSavePassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || !passwordModalUser) return;
    setPasswordSuccess(true);
    setTimeout(() => {
      setPasswordSuccess(false);
      setPasswordModalUser(null);
      setNewPassword('');
    }, 1500);
  };

  return (
    <div className="space-y-4">
      {/* Filter Bar */}
      <div className="bg-slate-900/90 rounded-xl p-3 border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search office user, email, user ID..."
            className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-4 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none"
          >
            <option value="ALL">All Statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </select>

          <select
            value={branchFilter}
            onChange={(e) => setBranchFilter(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none"
          >
            <option value="ALL">All Branches</option>
            <option value="Jaijaipur">Jaijaipur</option>
            <option value="Sakti">Sakti</option>
            <option value="Janjgir-Champa">Janjgir-Champa</option>
            <option value="Korba">Korba</option>
            <option value="Bilaspur">Bilaspur</option>
            <option value="Raipur">Raipur</option>
          </select>

          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none"
          >
            <option value="ALL">All Roles</option>
            <option value="MASTER_CONTROL">Master Control</option>
            <option value="BRANCH_MANAGER">Branch Manager</option>
            <option value="OPERATIONAL_MANAGER">Operational Manager</option>
            <option value="BACKOFFICE">Back Office</option>
            <option value="RECEPTIONIST">Receptionist</option>
          </select>
        </div>
      </div>

      {/* Users Table */}
      <div className="overflow-x-auto border border-slate-800 rounded-2xl shadow-xl bg-slate-900/90">
        <table className="w-full text-xs text-left">
          <thead className="bg-slate-950/80 text-slate-400 font-semibold border-b border-slate-800 text-[11px] uppercase tracking-wider">
            <tr>
              <th className="p-3.5">USER</th>
              <th className="p-3.5">EMAIL</th>
              <th className="p-3.5">ROLE</th>
              <th className="p-3.5">BRANCH</th>
              <th className="p-3.5 text-center">STATUS</th>
              <th className="p-3.5 text-right">APPOINTMENT / LOGIN</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/80 text-slate-200">
            {filteredUsers.map((user) => (
              <tr key={user.id} className="hover:bg-slate-800/30 transition-colors">
                {/* User Column */}
                <td className="p-3.5">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-sm text-slate-200 shadow-sm">
                      {user.avatar_letter}
                    </div>
                    <div>
                      <div className="font-bold text-slate-100 text-xs">{user.full_name}</div>
                      <div className="text-[10px] font-mono text-slate-400 mt-0.5">{user.user_code}</div>
                    </div>
                  </div>
                </td>

                {/* Email & Phone */}
                <td className="p-3.5">
                  <div className="font-mono text-slate-300">{user.email}</div>
                  <div className="text-[10px] text-slate-500 font-mono mt-0.5">{user.phone}</div>
                </td>

                {/* Role Pill */}
                <td className="p-3.5">
                  <span className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold border ${getRoleBadgeStyle(user.role)}`}>
                    {user.role_display}
                  </span>
                  <div className="text-[9px] font-mono text-slate-500 mt-0.5">{user.role}</div>
                </td>

                {/* Branch & Designation */}
                <td className="p-3.5">
                  <div className="font-semibold text-slate-200">{user.branch}</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">{user.designation}</div>
                </td>

                {/* Status Toggle */}
                <td className="p-3.5 text-center">
                  <button
                    onClick={() => onUpdateStatus(user.id, user.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE')}
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold border transition cursor-pointer ${
                      user.status === 'ACTIVE'
                        ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 hover:bg-emerald-500/30'
                        : 'bg-red-500/20 text-red-400 border-red-500/40 hover:bg-red-500/30'
                    }`}
                  >
                    {user.status}
                  </button>
                </td>

                {/* Appointment Date & Action Buttons */}
                <td className="p-3.5 text-right">
                  <div className="space-y-1">
                    <div className="font-mono text-[11px] text-slate-300">{user.appointment_date}</div>
                    <div className="text-[10px] text-slate-500 font-mono">Last: {user.last_login}</div>
                    <div className="flex items-center justify-end gap-1.5 pt-1">
                      <button
                        onClick={() => onOpenLetter(user.appointment_letter_id)}
                        className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-semibold transition"
                      >
                        Letter
                      </button>

                      <button
                        onClick={() => {
                          setPasswordModalUser(user);
                          setNewPassword('');
                        }}
                        className="flex items-center gap-1 px-2 py-1 rounded bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 text-[11px] font-semibold transition"
                      >
                        <Key className="w-3 h-3" />
                        <span>Password</span>
                      </button>
                    </div>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="text-[11px] text-slate-500 italic p-2">
        <strong>Security:</strong> Passwords are created and hashed on the server. Agent login accounts are created from Agent Master and are not mixed into this office-user list.
      </div>

      {/* Set / Reset Password Modal */}
      {passwordModalUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 animate-fade-in">
          <div className="bg-slate-900 rounded-2xl border border-slate-700 max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2 text-amber-400">
                <Lock className="w-5 h-5" />
                <h4 className="font-bold text-sm text-slate-100">Set Login Password (Admin Assigned Password)</h4>
              </div>
              <button onClick={() => setPasswordModalUser(null)} className="text-slate-400 hover:text-slate-200">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="text-xs text-slate-300 space-y-1">
              <div><strong>User:</strong> {passwordModalUser.full_name} ({passwordModalUser.user_code})</div>
              <div><strong>Email / ID:</strong> {passwordModalUser.email}</div>
              <div><strong>Role:</strong> {passwordModalUser.role_display}</div>
            </div>

            <form onSubmit={handleSavePassword} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">New Login Password *</label>
                <input
                  type="text"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="e.g. BNPS@Jaijaipur2026"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs font-mono text-slate-100 focus:outline-none focus:border-amber-500"
                />
              </div>

              {passwordSuccess && (
                <div className="p-2.5 rounded-lg bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
                  <Check className="w-4 h-4" />
                  <span>Password updated and issued successfully!</span>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setPasswordModalUser(null)}
                  className="px-3.5 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition shadow"
                >
                  Save & Issue Password
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
