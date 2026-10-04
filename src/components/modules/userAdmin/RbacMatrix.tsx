import React, { useState } from 'react';
import { RbacRoleStatus, RbacPermissionRow } from '../../../services/userAdminData';
import { ShieldCheck, RefreshCw, AlertCircle, Check, X, Sliders, Search } from 'lucide-react';

interface RbacMatrixProps {
  roles: RbacRoleStatus[];
  permissions: RbacPermissionRow[];
  onToggleRoleStatus: (roleId: string) => void;
  onTogglePermissionRole: (permId: string, roleKey: 'admin' | 'branch_mgr' | 'ops_mgr' | 'backoffice' | 'receptionist' | 'agent') => void;
  onToggleGlobalStatus: (permId: string) => void;
}

export const RbacMatrix: React.FC<RbacMatrixProps> = ({
  roles,
  permissions,
  onToggleRoleStatus,
  onTogglePermissionRole,
  onToggleGlobalStatus,
}) => {
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3000);
  };

  const categories = ['ALL', ...Array.from(new Set(permissions.map((p) => p.category)))];

  const filteredPermissions = permissions.filter((p) => {
    const matchesCategory = selectedCategory === 'ALL' || p.category === selectedCategory;
    const matchesSearch =
      p.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toastMsg && (
        <div className="fixed top-20 right-6 z-50 bg-emerald-500 text-slate-950 px-4 py-2 rounded-xl font-bold text-xs shadow-xl flex items-center gap-2 border border-emerald-300">
          <Check className="w-4 h-4" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Header & Subtitle */}
      <div className="bg-slate-900/90 rounded-2xl p-5 border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            SECURITY / RBAC CONTROL
          </div>
          <h3 className="text-xl font-bold text-slate-100 mt-0.5">Roles & Permissions</h3>
          <p className="text-xs text-slate-400 mt-1">
            MASTER_CONTROL / ADMIN controls role status and role-level permissions. Permission changes are enforced server-side.
          </p>
        </div>

        <button
          onClick={() => showToast('RBAC policies re-synchronized with server!')}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh RBAC</span>
        </button>
      </div>

      {/* Role Status Cards Row (7 roles matching 15.PNG) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        {roles.map((r) => {
          const isActive = r.status === 'ACTIVE';

          return (
            <div
              key={r.role_id}
              className="bg-slate-900/90 rounded-xl p-3 border border-slate-800 text-center space-y-2 shadow"
            >
              <div className="text-xs font-bold text-slate-300 truncate">{r.role_name}</div>
              <div
                className={`text-[11px] font-mono font-bold ${
                  isActive ? 'text-emerald-400' : 'text-red-400'
                }`}
              >
                {r.status}
              </div>
              <button
                onClick={() => {
                  onToggleRoleStatus(r.role_id);
                  showToast(`Role ${r.role_name} marked as ${isActive ? 'INACTIVE' : 'ACTIVE'}`);
                }}
                className={`w-full py-1 rounded text-[10px] font-semibold border transition ${
                  isActive
                    ? 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                    : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 hover:bg-emerald-500/30'
                }`}
              >
                {isActive ? 'Set Inactive' : 'Set Active'}
              </button>
            </div>
          );
        })}
      </div>

      {/* Agent Permission Restriction Notice Banner Matching 15.PNG & 16.PNG */}
      <div className="bg-blue-500/10 border border-blue-500/30 rounded-2xl p-4 flex items-start gap-3 text-xs text-blue-200">
        <AlertCircle className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
        <div className="leading-relaxed">
          <strong className="text-blue-100">Notice on Solar Agent Permissions:</strong> Per requirement, Agents have permissions restricted to <strong className="text-white">Lead Creation & Document Uploading</strong>. Customer Registration on the PM Surya Ghar portal is restricted (INACTIVE for Agent) and handled by authorized office staff (Branch Manager, Operational Manager, Receptionist, or Admin).
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-900/90 p-3 rounded-xl border border-slate-800">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search permissions, actions (CREATE, EXPORT, VIEW, etc.) or description..."
              className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-4 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500"
            />
          </div>
          <div className="text-xs text-slate-400 whitespace-nowrap">
            Showing <strong className="text-amber-400">{filteredPermissions.length}</strong> of {permissions.length} permissions
          </div>
        </div>

        {/* Category Filter Pills */}
        <div className="flex flex-wrap gap-1.5 pt-1">
          {categories.map((cat) => {
            const count = cat === 'ALL' ? permissions.length : permissions.filter((p) => p.category === cat).length;
            const isSelected = selectedCategory === cat;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition border ${
                  isSelected
                    ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md font-bold'
                    : 'bg-slate-900/90 text-slate-400 border-slate-800 hover:text-slate-200 hover:border-slate-700'
                }`}
              >
                {cat} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* Full RBAC Permission Table Matching 16.PNG */}
      <div className="overflow-x-auto border border-slate-800 rounded-2xl shadow-xl bg-slate-900/90">
        <table className="w-full text-xs text-left">
          <thead className="bg-slate-950/90 text-slate-400 font-semibold border-b border-slate-800 text-[11px] uppercase tracking-wider">
            <tr>
              <th className="p-3.5 min-w-[240px]">PERMISSION</th>
              <th className="p-3.5 text-center w-28">ADMINISTRATOR</th>
              <th className="p-3.5 text-center w-24">ADMIN</th>
              <th className="p-3.5 text-center w-24">BRANCH MGR</th>
              <th className="p-3.5 text-center w-24">OPS MGR</th>
              <th className="p-3.5 text-center w-24">BACKOFFICE</th>
              <th className="p-3.5 text-center w-24">RECEPTIONIST</th>
              <th className="p-3.5 text-center w-24">AGENT</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/80 text-slate-200">
            {filteredPermissions.map((row) => (
              <tr key={row.id} className="hover:bg-slate-800/30 transition-colors">
                {/* Permission Details */}
                <td className="p-3.5">
                  <div className="font-bold text-slate-100">
                    <span className="text-amber-400">{row.category}</span> {row.action}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">{row.description}</div>
                </td>

                {/* Global Status Button */}
                <td className="p-3.5 text-center">
                  <div className="inline-flex items-center gap-1">
                    <button
                      onClick={() => onToggleGlobalStatus(row.id)}
                      className={`px-2 py-0.5 rounded text-[10px] font-bold border transition ${
                        row.global_status === 'ACTIVE'
                          ? 'bg-blue-600/30 text-blue-300 border-blue-500/40'
                          : 'bg-red-500/20 text-red-400 border-red-500/40'
                      }`}
                    >
                      {row.global_status}
                    </button>
                    <button
                      onClick={() => onToggleGlobalStatus(row.id)}
                      className="text-[10px] text-slate-400 hover:text-slate-200 underline"
                    >
                      {row.global_status === 'ACTIVE' ? 'Disable' : 'Enable'}
                    </button>
                  </div>
                </td>

                {/* Role Toggles */}
                {[
                  { key: 'admin', val: row.admin },
                  { key: 'branch_mgr', val: row.branch_mgr },
                  { key: 'ops_mgr', val: row.ops_mgr },
                  { key: 'backoffice', val: row.backoffice },
                  { key: 'receptionist', val: row.receptionist },
                  { key: 'agent', val: row.agent },
                ].map(({ key, val }) => (
                  <td key={key} className="p-3.5 text-center">
                    <button
                      onClick={() => onTogglePermissionRole(row.id, key as any)}
                      className={`px-2.5 py-0.5 rounded text-[10px] font-mono font-bold transition border ${
                        val
                          ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 hover:bg-emerald-500/30'
                          : 'bg-slate-800 text-slate-500 border-slate-700 hover:text-slate-300'
                      }`}
                    >
                      {val ? 'ACTIVE' : 'INACTIVE'}
                    </button>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
