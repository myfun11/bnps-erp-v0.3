import React, { useState } from 'react';
import { 
  OfficeUser, 
  BranchSetup, 
  RbacRoleStatus, 
  RbacPermissionRow, 
  AppointmentOrder,
  INITIAL_OFFICE_USERS, 
  INITIAL_BRANCH_SETUPS, 
  INITIAL_RBAC_ROLES, 
  INITIAL_RBAC_PERMISSIONS, 
  INITIAL_APPOINTMENT_ORDERS 
} from '../../services/userAdminData';
import { OfficeUsersTable } from './userAdmin/OfficeUsersTable';
import { MultiBranchSetup } from './userAdmin/MultiBranchSetup';
import { RbacMatrix } from './userAdmin/RbacMatrix';
import { AppointmentOrdersList } from './userAdmin/AppointmentOrdersList';
import { useAuth } from '../../context/AuthContext';
import { UserRoleType } from '../../types/database';
import { 
  ShieldCheck, 
  Users, 
  Building2, 
  Award, 
  FileText, 
  Plus, 
  RefreshCw, 
  CheckCircle2, 
  X,
  Lock,
  UserPlus
} from 'lucide-react';

export const UserAdministrationPage: React.FC = () => {
  const { switchRole, userRole } = useAuth();

  // Active Tab State
  const [activeSubTab, setActiveSubTab] = useState<'USERS' | 'BRANCHES' | 'RBAC' | 'ORDERS'>('USERS');

  // Core Data State
  const [officeUsers, setOfficeUsers] = useState<OfficeUser[]>(INITIAL_OFFICE_USERS);
  const [branches, setBranches] = useState<BranchSetup[]>(INITIAL_BRANCH_SETUPS);
  const [rbacRoles, setRbacRoles] = useState<RbacRoleStatus[]>(INITIAL_RBAC_ROLES);
  const [rbacPermissions, setRbacPermissions] = useState<RbacPermissionRow[]>(INITIAL_RBAC_PERMISSIONS);
  const [appointmentOrders, setAppointmentOrders] = useState<AppointmentOrder[]>(INITIAL_APPOINTMENT_ORDERS);

  // 6 Specified Active Personas for Switch Active Role
  const ACTIVE_PERSONAS = [
    {
      roleKey: 'super_admin' as UserRoleType,
      title: 'Admin (Master Control)',
      subtitle: 'BNPS Administrator · All controls, branches & appointments',
      badge: 'Master Control',
      badgeColor: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
      activeBorder: 'border-purple-500 ring-2 ring-purple-500/30 bg-purple-950/20',
      idleBorder: 'border-slate-800 hover:border-purple-500/50 hover:bg-slate-850',
    },
    {
      roleKey: 'branch_manager' as UserRoleType,
      title: 'Branch Manager',
      subtitle: 'Rajesh Kumar Yadav · Jaijaipur Branch Lead & Registration',
      badge: 'Jaijaipur Lead',
      badgeColor: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
      activeBorder: 'border-blue-500 ring-2 ring-blue-500/30 bg-blue-950/20',
      idleBorder: 'border-slate-800 hover:border-blue-500/50 hover:bg-slate-850',
    },
    {
      roleKey: 'operational_manager' as UserRoleType,
      title: 'Operational Manager',
      subtitle: 'Om Prakash Dewangan · Central Operations & Net Metering',
      badge: 'Central Ops',
      badgeColor: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
      activeBorder: 'border-indigo-500 ring-2 ring-indigo-500/30 bg-indigo-950/20',
      idleBorder: 'border-slate-800 hover:border-indigo-500/50 hover:bg-slate-850',
    },
    {
      roleKey: 'receptionist' as UserRoleType,
      title: 'Receptionist',
      subtitle: 'Sagar Kumar Yadav · Front Desk & Customer Registration',
      badge: 'Front Desk',
      badgeColor: 'bg-teal-500/20 text-teal-300 border-teal-500/30',
      activeBorder: 'border-teal-500 ring-2 ring-teal-500/30 bg-teal-950/20',
      idleBorder: 'border-slate-800 hover:border-teal-500/50 hover:bg-slate-850',
    },
    {
      roleKey: 'backoffice' as UserRoleType,
      title: 'Back Office & Documentation',
      subtitle: 'Ravi Kumar · Sakti Branch & Loan Verification',
      badge: 'Sakti Branch',
      badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
      activeBorder: 'border-amber-500 ring-2 ring-amber-500/30 bg-amber-950/20',
      idleBorder: 'border-slate-800 hover:border-amber-500/50 hover:bg-slate-850',
    },
    {
      roleKey: 'agent' as UserRoleType,
      title: 'Solar Agent',
      subtitle: 'Lead creation & document upload (Registration restricted)',
      badge: 'Field Agent',
      badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
      activeBorder: 'border-emerald-500 ring-2 ring-emerald-500/30 bg-emerald-950/20',
      idleBorder: 'border-slate-800 hover:border-emerald-500/50 hover:bg-slate-850',
    },
  ];

  // Modals
  const [showCreateUserModal, setShowCreateUserModal] = useState(false);
  const [showAddBranchModal, setShowAddBranchModal] = useState(false);
  const [appointBranchContext, setAppointBranchContext] = useState<string | null>(null);

  // Toast
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 4000);
  };

  // Form states for creating a new office user
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPhone, setNewUserPhone] = useState('');
  const [newUserRole, setNewUserRole] = useState<'MASTER_CONTROL' | 'BRANCH_MANAGER' | 'OPERATIONAL_MANAGER' | 'BACKOFFICE' | 'RECEPTIONIST'>('BRANCH_MANAGER');
  const [newUserBranch, setNewUserBranch] = useState('Jaijaipur Branch');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserSalary, setNewUserSalary] = useState('₹35,000 / month');

  // Form state for creating a new branch
  const [newBranchName, setNewBranchName] = useState('');
  const [newBranchCode, setNewBranchCode] = useState('');
  const [newBranchLocation, setNewBranchLocation] = useState('');
  const [newBranchAddress, setNewBranchAddress] = useState('');

  // Handle Create Office User Submit
  const handleCreateOfficeUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserName || !newUserEmail || !newUserPhone) return;

    const count = officeUsers.length + 1;
    const userCode = `USR${String(count).padStart(5, '0')}`;
    const letterId = `APPT-BNPS-${newUserBranch.slice(0, 3).toUpperCase()}-${String(count).padStart(3, '0')}`;

    const roleDisplayMap: Record<string, string> = {
      MASTER_CONTROL: 'Master Control',
      BRANCH_MANAGER: 'Manager',
      OPERATIONAL_MANAGER: 'Operational Manager',
      BACKOFFICE: 'Back Office',
      RECEPTIONIST: 'Receptionist',
    };

    const newUser: OfficeUser = {
      id: `usr-${Date.now()}`,
      user_code: userCode,
      avatar_letter: newUserName.charAt(0).toUpperCase(),
      full_name: newUserName,
      email: newUserEmail,
      phone: newUserPhone,
      role: newUserRole,
      role_display: roleDisplayMap[newUserRole] || 'Staff',
      branch: newUserBranch,
      designation: `${roleDisplayMap[newUserRole]} (${newUserBranch})`,
      status: 'ACTIVE',
      appointment_date: new Date().toISOString().split('T')[0],
      last_login: 'Just Created',
      salary_text: newUserSalary,
      appointment_letter_id: letterId,
    };

    // Also issue appointment order
    const newOrder: AppointmentOrder = {
      id: `apt-${Date.now()}`,
      order_no: letterId,
      staff_name: newUserName,
      role: roleDisplayMap[newUserRole],
      branch: newUserBranch,
      appointment_date: new Date().toISOString().split('T')[0],
      remuneration_text: newUserSalary,
      reporting_to: newUserRole === 'BRANCH_MANAGER' ? 'Managing Director' : 'Branch Manager',
      terms: [
        `Executive deputation to ${newUserBranch} for PM Surya Ghar operations.`,
        'Administered under official authority of Bhumi Nidhi Powar Solution.',
        'Assigned secure login credentials and role-specific RBAC privileges.',
      ],
    };

    setOfficeUsers([newUser, ...officeUsers]);
    setAppointmentOrders([newOrder, ...appointmentOrders]);
    setShowCreateUserModal(false);
    showToast(`Office user ${newUserName} created & Appointment Order ${letterId} generated!`);

    // Reset Form
    setNewUserName('');
    setNewUserEmail('');
    setNewUserPhone('');
    setNewUserPassword('');
  };

  // Handle Add Branch Submit
  const handleAddBranchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBranchName || !newBranchLocation) return;

    const code = newBranchCode || `BNPS-${newBranchName.slice(0, 3).toUpperCase()}`;
    const newBr: BranchSetup = {
      id: `br-${Date.now()}`,
      branch_code: code,
      name: newBranchName,
      status: 'UPCOMING',
      location: newBranchLocation,
      manager_name: 'Open for Appointment',
      address: newBranchAddress || `${newBranchName} Commercial Area, Chhattisgarh`,
      staff_assigned_count: 0,
    };

    setBranches([...branches, newBr]);
    setShowAddBranchModal(false);
    showToast(`Branch ${newBranchName} (${code}) added to setup pipeline!`);

    setNewBranchName('');
    setNewBranchCode('');
    setNewBranchLocation('');
    setNewBranchAddress('');
  };

  // User status toggle
  const handleUpdateUserStatus = (userId: string, newStatus: 'ACTIVE' | 'INACTIVE') => {
    setOfficeUsers(officeUsers.map((u) => (u.id === userId ? { ...u, status: newStatus } : u)));
    showToast(`User status updated to ${newStatus}`);
  };

  // RBAC Role status toggle
  const handleToggleRoleStatus = (roleId: string) => {
    setRbacRoles(
      rbacRoles.map((r) =>
        r.role_id === roleId ? { ...r, status: r.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE' } : r
      )
    );
  };

  // RBAC Permission cell toggle
  const handleTogglePermissionRole = (
    permId: string,
    roleKey: 'admin' | 'branch_mgr' | 'ops_mgr' | 'backoffice' | 'receptionist' | 'agent'
  ) => {
    setRbacPermissions(
      rbacPermissions.map((p) => {
        if (p.id === permId) {
          return { ...p, [roleKey]: !p[roleKey] };
        }
        return p;
      })
    );
  };

  // RBAC Global Status toggle
  const handleToggleGlobalStatus = (permId: string) => {
    setRbacPermissions(
      rbacPermissions.map((p) => {
        if (p.id === permId) {
          return { ...p, global_status: p.global_status === 'ACTIVE' ? 'DISABLE' : 'ACTIVE' };
        }
        return p;
      })
    );
  };

  const handleRoleSwitchFromUser = (role: string) => {
    const roleMapping: Record<string, UserRoleType> = {
      MASTER_CONTROL: 'super_admin',
      BRANCH_MANAGER: 'branch_manager',
      OPERATIONAL_MANAGER: 'operational_manager',
      RECEPTIONIST: 'receptionist',
      BACKOFFICE: 'backoffice',
    };
    const target = roleMapping[role] || 'super_admin';
    switchRole(target);
    showToast(`Switched active persona to ${role}`);
  };

  const handleAppointStaffForBranch = (branchName: string) => {
    setAppointBranchContext(branchName);
    setNewUserBranch(`${branchName} Branch`);
    setShowCreateUserModal(true);
  };

  // Metrics
  const activeCount = officeUsers.filter((u) => u.status === 'ACTIVE').length;
  const inactiveCount = officeUsers.filter((u) => u.status === 'INACTIVE').length;

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      {/* Toast Notification */}
      {toastMsg && (
        <div className="fixed top-20 right-6 z-50 bg-emerald-500 text-slate-950 font-bold px-4 py-2.5 rounded-xl shadow-2xl flex items-center gap-2 border border-emerald-300 animate-bounce">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm">{toastMsg}</span>
          <button onClick={() => setToastMsg(null)} className="ml-2 hover:opacity-75">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Main Header Matching 13.PNG */}
      <div className="bg-slate-900/90 rounded-2xl p-6 border border-slate-800 shadow-xl space-y-5">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="text-[11px] font-bold text-slate-400 tracking-wider uppercase">
              SECURITY / OFFICE USERS & BRANCH ADMINISTRATION
            </div>
            <div className="flex items-center gap-2.5 mt-1">
              <h2 className="text-2xl font-black text-slate-100 tracking-tight">
                User Administration
              </h2>
              <span className="text-xs px-2.5 py-0.5 rounded-md bg-blue-500/20 text-blue-300 font-mono font-bold border border-blue-500/30">
                RBAC v4.0
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1 max-w-2xl leading-relaxed">
              Manage office users, branch assignment, role assignment and account status. Agent login accounts are managed from Agent Master. All appointments are authorized by Admin.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => showToast('Refreshed user directory!')}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Refresh</span>
            </button>

            <button
              onClick={() => {
                setAppointBranchContext(null);
                setShowCreateUserModal(true);
              }}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-md shadow-blue-600/20 transition"
            >
              <Plus className="w-4 h-4" />
              <span>+ Create Office User</span>
            </button>

            <button
              onClick={() => setShowAddBranchModal(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md shadow-emerald-600/20 transition"
            >
              <Building2 className="w-4 h-4" />
              <span>+ Add Branch</span>
            </button>
          </div>
        </div>

        {/* 5 Metric Summary Cards Matching 13.PNG */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-2">
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
            <div className="text-[11px] font-semibold text-slate-400 uppercase">OFFICE USERS</div>
            <div className="text-2xl font-black font-mono text-slate-100 mt-1">{officeUsers.length}</div>
          </div>

          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
            <div className="text-[11px] font-semibold text-emerald-400 uppercase">ACTIVE</div>
            <div className="text-2xl font-black font-mono text-emerald-400 mt-1">{activeCount}</div>
          </div>

          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
            <div className="text-[11px] font-semibold text-slate-500 uppercase">INACTIVE</div>
            <div className="text-2xl font-black font-mono text-slate-400 mt-1">{inactiveCount}</div>
          </div>

          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
            <div className="text-[11px] font-semibold text-blue-400 uppercase">OFFICE ROLES</div>
            <div className="text-2xl font-black font-mono text-blue-400 mt-1">{rbacRoles.length}</div>
          </div>

          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
            <div className="text-[11px] font-semibold text-amber-400 uppercase">ACTIVE BRANCHES</div>
            <div className="text-2xl font-black font-mono text-amber-400 mt-1">{branches.length}</div>
          </div>
        </div>

        {/* Switch Active Role Card Grid matching user specification */}
        <div className="bg-slate-950/70 rounded-xl p-4 border border-slate-800 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-2.5">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-amber-400" />
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                Switch Active Role
              </h4>
            </div>
            <div className="text-[11px] text-slate-400">
              Current Session: <span className="font-mono font-bold text-amber-400 capitalize">{userRole.replace('_', ' ')}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pt-1">
            {ACTIVE_PERSONAS.map((persona) => {
              const isCurrent = userRole === persona.roleKey;
              return (
                <button
                  key={persona.roleKey}
                  type="button"
                  onClick={() => {
                    switchRole(persona.roleKey);
                    showToast(`Switched active role to ${persona.title}: ${persona.subtitle.split('·')[0].trim()}`);
                  }}
                  className={`text-left p-3.5 rounded-xl border transition-all duration-200 cursor-pointer relative group ${
                    isCurrent
                      ? persona.activeBorder
                      : `bg-slate-900/80 ${persona.idleBorder}`
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-100 group-hover:text-amber-300 transition-colors">
                          {persona.title}
                        </span>
                        <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${persona.badgeColor}`}>
                          {persona.badge}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 mt-1 leading-snug">
                        {persona.subtitle}
                      </div>
                    </div>

                    {isCurrent && (
                      <span className="shrink-0 flex items-center gap-1 text-[10px] font-bold font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                        ACTIVE
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* 4 Horizontal Sub-Tabs Matching 13.PNG, 14.PNG, 15.PNG, 17.PNG */}
        <div className="flex border-b border-slate-800 overflow-x-auto gap-2 custom-scrollbar pt-2">
          <button
            onClick={() => setActiveSubTab('USERS')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition whitespace-nowrap cursor-pointer ${
              activeSubTab === 'USERS'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Office Users & Staff ({officeUsers.length})</span>
          </button>

          <button
            onClick={() => setActiveSubTab('BRANCHES')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition whitespace-nowrap cursor-pointer ${
              activeSubTab === 'BRANCHES'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Building2 className="w-4 h-4" />
            <span>Multi-Branch Setup & Appointments ({branches.length})</span>
          </button>

          <button
            onClick={() => setActiveSubTab('RBAC')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition whitespace-nowrap cursor-pointer ${
              activeSubTab === 'RBAC'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Roles & Permissions (RBAC Matrix)</span>
          </button>

          <button
            onClick={() => setActiveSubTab('ORDERS')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition whitespace-nowrap cursor-pointer ${
              activeSubTab === 'ORDERS'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Award className="w-4 h-4" />
            <span>Appointment Orders ({appointmentOrders.length})</span>
          </button>
        </div>
      </div>

      {/* SUB-TAB CONTENTS */}
      {activeSubTab === 'USERS' && (
        <OfficeUsersTable
          users={officeUsers}
          onOpenLetter={(letterId) => {
            setActiveSubTab('ORDERS');
          }}
          onOpenRoleSwitch={handleRoleSwitchFromUser}
          onUpdateStatus={handleUpdateUserStatus}
        />
      )}

      {activeSubTab === 'BRANCHES' && (
        <MultiBranchSetup
          branches={branches}
          onAppointStaff={handleAppointStaffForBranch}
          onAddBranch={() => setShowAddBranchModal(true)}
        />
      )}

      {activeSubTab === 'RBAC' && (
        <RbacMatrix
          roles={rbacRoles}
          permissions={rbacPermissions}
          onToggleRoleStatus={handleToggleRoleStatus}
          onTogglePermissionRole={handleTogglePermissionRole}
          onToggleGlobalStatus={handleToggleGlobalStatus}
        />
      )}

      {activeSubTab === 'ORDERS' && (
        <AppointmentOrdersList orders={appointmentOrders} />
      )}

      {/* CREATE OFFICE USER MODAL */}
      {showCreateUserModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 animate-fade-in overflow-y-auto">
          <div className="bg-slate-900 rounded-2xl border border-slate-700 max-w-lg w-full p-6 shadow-2xl space-y-4 my-8">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2 text-blue-400">
                <UserPlus className="w-5 h-5" />
                <h3 className="font-bold text-base text-slate-100">
                  {appointBranchContext ? `Appoint Staff for ${appointBranchContext}` : 'Create New Office User & Issue Appointment'}
                </h3>
              </div>
              <button onClick={() => setShowCreateUserModal(false)} className="text-slate-400 hover:text-slate-200">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateOfficeUser} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-300 mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value)}
                  placeholder="e.g. Anand Kumar Agrawal"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Email Address *</label>
                  <input
                    type="email"
                    required
                    value={newUserEmail}
                    onChange={(e) => setNewUserEmail(e.target.value)}
                    placeholder="name@bhuminidhi.com"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Phone Number *</label>
                  <input
                    type="tel"
                    required
                    maxLength={10}
                    value={newUserPhone}
                    onChange={(e) => setNewUserPhone(e.target.value.replace(/\D/g, ''))}
                    placeholder="98290XXXXX"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 font-mono focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Office Role *</label>
                  <select
                    value={newUserRole}
                    onChange={(e) => setNewUserRole(e.target.value as any)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-blue-500"
                  >
                    <option value="BRANCH_MANAGER">Branch Manager</option>
                    <option value="OPERATIONAL_MANAGER">Operational Manager</option>
                    <option value="BACKOFFICE">Back Office & Documentation</option>
                    <option value="RECEPTIONIST">Receptionist / Front Desk</option>
                    <option value="MASTER_CONTROL">Master Control / Admin</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Assigned Branch *</label>
                  <select
                    value={newUserBranch}
                    onChange={(e) => setNewUserBranch(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-blue-500"
                  >
                    {branches.map((b) => (
                      <option key={b.id} value={`${b.name} Branch`}>
                        {b.name} Branch
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">
                    Initial Login Password (Issued by Admin) *
                  </label>
                  <input
                    type="text"
                    required
                    value={newUserPassword}
                    onChange={(e) => setNewUserPassword(e.target.value)}
                    placeholder="e.g. BNPS@Raigarh2026"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 font-mono text-slate-100 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Remuneration / Salary Package *</label>
                  <input
                    type="text"
                    required
                    value={newUserSalary}
                    onChange={(e) => setNewUserSalary(e.target.value)}
                    placeholder="₹35,000 / month"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <p className="text-[11px] text-slate-500 italic">
                * An official Appointment Order (APPT-BNPS-...) will be generated and signed automatically under Admin authority.
              </p>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowCreateUserModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold transition shadow-lg shadow-blue-600/30"
                >
                  Create & Issue Appointment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADD BRANCH MODAL */}
      {showAddBranchModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 animate-fade-in">
          <div className="bg-slate-900 rounded-2xl border border-slate-700 max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2 text-emerald-400">
                <Building2 className="w-5 h-5" />
                <h3 className="font-bold text-base text-slate-100">Add New Branch Location</h3>
              </div>
              <button onClick={() => setShowAddBranchModal(false)} className="text-slate-400 hover:text-slate-200">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddBranchSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-300 mb-1">Branch Name *</label>
                <input
                  type="text"
                  required
                  value={newBranchName}
                  onChange={(e) => setNewBranchName(e.target.value)}
                  placeholder="e.g. Durg / Ambikapur"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">Branch Code (Optional)</label>
                <input
                  type="text"
                  value={newBranchCode}
                  onChange={(e) => setNewBranchCode(e.target.value)}
                  placeholder="e.g. BNPS-DRG"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 font-mono focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">Location / Jurisdiction *</label>
                <input
                  type="text"
                  required
                  value={newBranchLocation}
                  onChange={(e) => setNewBranchLocation(e.target.value)}
                  placeholder="e.g. Durg, Chhattisgarh"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">Office Address</label>
                <input
                  type="text"
                  value={newBranchAddress}
                  onChange={(e) => setNewBranchAddress(e.target.value)}
                  placeholder="e.g. Station Road Commercial Complex"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddBranchModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition shadow-lg shadow-emerald-600/30"
                >
                  Add Branch to Network
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
