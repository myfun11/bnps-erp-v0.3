import React, { createContext, useContext, useState, useMemo } from 'react';
import { UserRoleType, Profile, Agent } from '../types/database';

interface AuthContextType {
  isAuthenticated: boolean;
  currentProfile: Profile;
  currentAgent?: Agent;
  userRole: UserRoleType;
  login: (role: UserRoleType) => void;
  logout: () => void;
  switchRole: (role: UserRoleType) => void;
  hasPermission: (permissionCode: string) => boolean;
  canViewSensitiveAgentPii: boolean;
  canConvertLeads: boolean;
  canApprovePayments: boolean;
  canGenerateCommissions: boolean;
}

// Preset demonstration profiles for each role
export const DEMO_PROFILES: Record<UserRoleType, { profile: Profile; agent?: Partial<Agent> }> = {
  super_admin: {
    profile: {
      id: 'prof-super-admin-01',
      auth_user_id: 'USR00001',
      full_name: 'BNPS Administrator',
      email: 'admin@bnps.local',
      phone: '+91 98290 10001',
      role: 'super_admin',
      branch: 'Jaijaipur',
      is_active: true,
      is_test: false,
      created_at: '2026-01-01T10:00:00Z',
      updated_at: '2026-01-01T10:00:00Z',
    },
    agent: {
      id: 'ag-admin-001',
      agent_code: 'BNPS-HQ-01',
      hierarchy_level: 10,
      is_active: true,
      is_test: false,
    },
  },
  branch_manager: {
    profile: {
      id: 'prof-branch-mgr-01',
      auth_user_id: 'USR00002',
      full_name: 'Rajesh Kumar Yadav',
      email: 'rajesh@gmail.com',
      phone: '+91 98290 20002',
      role: 'branch_manager',
      branch: 'Jaijaipur',
      is_active: true,
      is_test: false,
      created_at: '2026-01-15T10:00:00Z',
      updated_at: '2026-01-15T10:00:00Z',
    },
  },
  operational_manager: {
    profile: {
      id: 'prof-ops-mgr-01',
      auth_user_id: 'USR00005',
      full_name: 'Om Prakash Dewangan',
      email: 'omprakash@bnps.local',
      phone: '+91 98290 50005',
      role: 'operational_manager',
      branch: 'Jaijaipur',
      is_active: true,
      is_test: false,
      created_at: '2026-01-10T10:00:00Z',
      updated_at: '2026-01-10T10:00:00Z',
    },
  },
  receptionist: {
    profile: {
      id: 'prof-receptionist-01',
      auth_user_id: 'USR00004',
      full_name: 'Sagar Kumar Yadav',
      email: 'sagar@gamil.com',
      phone: '+91 98290 40004',
      role: 'receptionist',
      branch: 'Jaijaipur',
      is_active: true,
      is_test: false,
      created_at: '2026-02-15T11:00:00Z',
      updated_at: '2026-02-15T11:00:00Z',
    },
  },
  backoffice: {
    profile: {
      id: 'prof-backoffice-01',
      auth_user_id: 'USR00003',
      full_name: 'Ravi Kumar',
      email: 'ravi@gmail.com',
      phone: '+91 98290 30003',
      role: 'backoffice',
      branch: 'Sakti',
      is_active: true,
      is_test: false,
      created_at: '2026-02-01T11:00:00Z',
      updated_at: '2026-02-01T11:00:00Z',
    },
  },
  office_admin: {
    profile: {
      id: 'prof-office-admin-01',
      auth_user_id: 'USR00002-OA',
      full_name: 'Rajesh Kumar Yadav',
      email: 'rajesh@gmail.com',
      phone: '+91 98290 20002',
      role: 'office_admin',
      branch: 'Jaijaipur',
      is_active: true,
      is_test: false,
      created_at: '2026-01-15T11:00:00Z',
      updated_at: '2026-01-15T11:00:00Z',
    },
  },
  accountant: {
    profile: {
      id: 'prof-accountant-01',
      auth_user_id: 'auth-acc-003',
      full_name: 'Dinesh Khandelwal (CA / Accounts)',
      email: 'accounts@bhuminidhi.com',
      phone: '9826033333',
      role: 'accountant',
      branch: 'Raipur',
      is_active: true,
      is_test: false,
      created_at: '2026-01-20T09:30:00Z',
      updated_at: '2026-01-20T09:30:00Z',
    },
  },
  field_officer: {
    profile: {
      id: 'prof-field-01',
      auth_user_id: 'auth-fo-004',
      full_name: 'Anil Meena (Raipur & Durg Circle)',
      email: 'anil.field@bhuminidhi.com',
      phone: '9826044444',
      role: 'field_officer',
      branch: 'Raipur',
      is_active: true,
      is_test: false,
      created_at: '2026-02-01T12:00:00Z',
      updated_at: '2026-02-01T12:00:00Z',
    },
  },
  technician: {
    profile: {
      id: 'prof-tech-01',
      auth_user_id: 'auth-tech-005',
      full_name: 'Rajendra Verma (Senior Solar Engineer)',
      email: 'rajendra.tech@bhuminidhi.com',
      phone: '9826055555',
      role: 'technician',
      branch: 'Raipur',
      is_active: true,
      is_test: false,
      created_at: '2026-02-05T14:20:00Z',
      updated_at: '2026-02-05T14:20:00Z',
    },
  },
  agent: {
    profile: {
      id: 'prof-agent-01',
      auth_user_id: 'auth-ag-010',
      full_name: 'Mukesh Choudhary (Solar Agent)',
      email: 'mukesh.agent@gmail.com',
      phone: '+91 94250 88990',
      role: 'agent',
      branch: 'Jaijaipur',
      is_active: true,
      is_test: false,
      created_at: '2026-01-05T09:00:00Z',
      updated_at: '2026-01-05T09:00:00Z',
    },
    agent: {
      id: 'ag-mukesh-101',
      agent_code: 'AGT00010',
      hierarchy_level: 10,
      pan_number: 'ABCDE1234F',
      aadhaar_masked: 'XXXX-XXXX-8921',
      bank_account_no: '918237465019',
      bank_name: 'State Bank of India (Raipur)',
      bank_ifsc: 'SBIN0000461',
      tds_percentage: 5.0,
      total_commission_earned: 42500,
      total_commission_paid: 25000,
      outstanding_advance: 5000,
      is_active: true,
      is_test: false,
    },
  },
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(true); // Logged in by default
  const [currentRole, setCurrentRole] = useState<UserRoleType>('super_admin');

  const currentProfile = useMemo(() => {
    return DEMO_PROFILES[currentRole].profile;
  }, [currentRole]);

  const currentAgent = useMemo(() => {
    return DEMO_PROFILES[currentRole].agent as Agent | undefined;
  }, [currentRole]);

  const login = (role: UserRoleType) => {
    setCurrentRole(role);
    setIsAuthenticated(true);
  };

  const logout = () => {
    setIsAuthenticated(false);
  };

  const switchRole = (role: UserRoleType) => {
    setCurrentRole(role);
  };

  const hasPermission = (permissionCode: string): boolean => {
    if (currentRole === 'super_admin') return true;
    if (currentRole === 'office_admin') {
      return !['commission.distribute_manual'].includes(permissionCode);
    }
    if (currentRole === 'accountant') {
      return ['payment.approve', 'payment.mark_paid', 'commission.view', 'payout.process'].includes(permissionCode);
    }
    if (currentRole === 'field_officer') {
      return ['lead.create', 'lead.update', 'lead.convert', 'document.upload'].includes(permissionCode);
    }
    if (currentRole === 'technician') {
      return ['installation.update', 'net_meter.record'].includes(permissionCode);
    }
    if (currentRole === 'agent') {
      return ['lead.create', 'lead.view_own', 'commission.view_own'].includes(permissionCode);
    }
    return false;
  };

  const canViewSensitiveAgentPii = useMemo(() => {
    return ['super_admin', 'office_admin', 'accountant'].includes(currentRole);
  }, [currentRole]);

  const canConvertLeads = useMemo(() => {
    return ['super_admin', 'office_admin', 'field_officer'].includes(currentRole);
  }, [currentRole]);

  const canApprovePayments = useMemo(() => {
    return ['super_admin', 'office_admin', 'accountant'].includes(currentRole);
  }, [currentRole]);

  const canGenerateCommissions = useMemo(() => {
    return ['super_admin', 'office_admin'].includes(currentRole);
  }, [currentRole]);

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        currentProfile,
        currentAgent,
        userRole: currentRole,
        login,
        logout,
        switchRole,
        hasPermission,
        canViewSensitiveAgentPii,
        canConvertLeads,
        canApprovePayments,
        canGenerateCommissions,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
