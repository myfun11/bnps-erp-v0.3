import React, { createContext, useContext, useState, useMemo, useEffect } from 'react';
import { UserRoleType, Profile, Agent } from '../types/database';
import { authService } from '../services/authService';

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  isLiveSupabase: boolean;
  currentProfile: Profile;
  currentAgent?: Agent;
  userRole: UserRoleType;
  loginWithPassword?: (email: string, password: string) => Promise<void>;
  logout: () => void;
  hasPermission: (permissionCode: string) => boolean;
  canViewSensitiveAgentPii: boolean;
  canConvertLeads: boolean;
  canApprovePayments: boolean;
  canGenerateCommissions: boolean;
  canViewQuotations: boolean;
  canCreateQuotations: boolean;
  canUpdateQuotations: boolean;
  canConvertQuotations: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Required Rule: Do not default to isAuthenticated = true.
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [customProfile, setCustomProfile] = useState<Profile | null>(null);
  const [customAgent, setCustomAgent] = useState<Agent | null>(null);

  const isLiveSupabase = authService.isConfigured();

  // Restore session from Supabase on mount
  useEffect(() => {
    let mounted = true;

    async function initAuth() {
      if (!isLiveSupabase) {
        setIsLoading(false);
        return;
      }

      try {
        const session = await authService.getSession();
        if (session && session.user && mounted) {
          const profile = await authService.fetchProfileByAuthUserId(session.user.id);
          if (profile?.is_active && mounted) {
            setCustomProfile(profile);
            if (profile.role === 'agent') {
              const agent = await authService.fetchAgentByProfileId(profile.id);
              if (mounted) setCustomAgent(agent);
            }
            setIsAuthenticated(true);
          } else if (profile && mounted) {
            await authService.signOut();
            setCustomProfile(null);
            setCustomAgent(null);
            setIsAuthenticated(false);
          }
        }
      } catch (err) {
        console.error('[AuthProvider.initAuth] Session restore error:', err);
      } finally {
        if (mounted) setIsLoading(false);
      }
    }

    initAuth();

    // Listen to Supabase auth state changes
    const { data: authListener } = authService.onAuthStateChange(async (event, session) => {
      if (!mounted) return;
      if (event === 'SIGNED_IN' && session?.user) {
        const profile = await authService.fetchProfileByAuthUserId(session.user.id);
        if (profile?.is_active && mounted) {
          setCustomProfile(profile);
          if (profile.role === 'agent') {
            const agent = await authService.fetchAgentByProfileId(profile.id);
            if (mounted) setCustomAgent(agent);
          }
          setIsAuthenticated(true);
        } else if (mounted) {
          await authService.signOut();
          setCustomProfile(null);
          setCustomAgent(null);
          setIsAuthenticated(false);
        }
      } else if (event === 'SIGNED_OUT') {
        setCustomProfile(null);
        setCustomAgent(null);
        setIsAuthenticated(false);
      }
    });

    return () => {
      mounted = false;
      authListener?.subscription?.unsubscribe?.();
    };
  }, [isLiveSupabase]);

  const currentRole: UserRoleType = customProfile?.role ?? 'receptionist';

  const currentProfile = useMemo<Profile>(() => {
    if (customProfile) return customProfile;

    return {
      id: '',
      auth_user_id: '',
      full_name: '',
      email: '',
      phone: '',
      role: currentRole,
      branch: undefined,
      is_active: false,
      is_test: false,
      created_at: '',
      updated_at: '',
    };
  }, [customProfile, currentRole]);

  const currentAgent = useMemo<Agent | undefined>(() => {
    return customAgent ?? undefined;
  }, [customAgent]);

  const loginWithPassword = async (email: string, password: string) => {
    if (!isLiveSupabase) {
      throw new Error('Supabase live backend is not configured. Please supply VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your environment.');
    }
    setIsLoading(true);
    try {
      const data = await authService.signInWithPassword(email, password);
      if (data.user) {
        const profile = await authService.fetchProfileByAuthUserId(data.user.id);

        if (!profile || !profile.is_active) {
          await authService.signOut();
          throw new Error('Your BNPS account is inactive or not authorized.');
        }

        setCustomProfile(profile);
        if (profile.role === 'agent') {
          const agent = await authService.fetchAgentByProfileId(profile.id);
          setCustomAgent(agent);
        }
        setIsAuthenticated(true);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    if (isLiveSupabase) {
      await authService.signOut();
    }
    setCustomProfile(null);
    setCustomAgent(null);
    setIsAuthenticated(false);
  };


  const hasPermission = (permissionCode: string): boolean => {
    if (!customProfile) return false;
    if (currentRole === 'super_admin') return true;
    if (currentRole === 'office_admin' || currentRole === 'branch_manager') {
      return !['commission.distribute_manual'].includes(permissionCode);
    }
    if (currentRole === 'accountant') {
      return ['payment.approve', 'payment.mark_paid', 'commission.view', 'payout.process', 'quotation.view'].includes(permissionCode);
    }
    if (currentRole === 'field_officer' || currentRole === 'backoffice') {
      return ['lead.create', 'lead.update', 'lead.convert', 'document.upload', 'pmsg.create', 'quotation.view', 'quotation.create', 'quotation.update', 'quotation.convert'].includes(permissionCode);
    }
    if (currentRole === 'agent') {
      return ['lead.create', 'lead.view_own', 'commission.view_own', 'quotation.view', 'quotation.create'].includes(permissionCode);
    }
    if (currentRole === 'operational_manager') {
      return ['pmsg.create'].includes(permissionCode);
    }
    if (currentRole === 'technician') {
      return ['installation.update', 'net_meter.record'].includes(permissionCode);
    }
    if (currentRole === 'receptionist') {
      return ['lead.create', 'lead.view_own', 'pmsg.create'].includes(permissionCode);
    }
    return false;
  };

  const canViewSensitiveAgentPii = useMemo(() => {
    return !!customProfile && ['super_admin', 'office_admin', 'branch_manager', 'accountant'].includes(currentRole);
  }, [currentRole]);

  const canConvertLeads = useMemo(() => {
    return !!customProfile && ['super_admin', 'office_admin', 'branch_manager', 'field_officer', 'backoffice'].includes(currentRole);
  }, [currentRole]);

  const canApprovePayments = useMemo(() => {
    return !!customProfile && ['super_admin', 'office_admin', 'branch_manager', 'accountant'].includes(currentRole);
  }, [currentRole]);

  const canGenerateCommissions = useMemo(() => {
    return !!customProfile && ['super_admin', 'office_admin', 'branch_manager'].includes(currentRole);
  }, [currentRole]);

  const canViewQuotations = useMemo(() => {
    return !!customProfile && ['super_admin', 'office_admin', 'branch_manager', 'field_officer', 'backoffice', 'accountant', 'agent'].includes(currentRole);
  }, [currentRole, customProfile]);

  const canCreateQuotations = useMemo(() => {
    return !!customProfile && ['super_admin', 'office_admin', 'branch_manager', 'field_officer', 'backoffice', 'agent'].includes(currentRole);
  }, [currentRole, customProfile]);

  const canUpdateQuotations = useMemo(() => {
    return !!customProfile && ['super_admin', 'office_admin', 'branch_manager', 'field_officer', 'backoffice'].includes(currentRole);
  }, [currentRole, customProfile]);

  const canConvertQuotations = useMemo(() => {
    return !!customProfile && ['super_admin', 'office_admin', 'branch_manager', 'field_officer', 'backoffice'].includes(currentRole);
  }, [currentRole, customProfile]);

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        isLoading,
        isLiveSupabase,
        currentProfile,
        currentAgent,
        userRole: currentRole,
        loginWithPassword,
        logout,
        hasPermission,
        canViewSensitiveAgentPii,
        canConvertLeads,
        canApprovePayments,
        canGenerateCommissions,
        canViewQuotations,
        canCreateQuotations,
        canUpdateQuotations,
        canConvertQuotations,
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
