import { supabase, isSupabaseConfigured, extractFunctionsHttpError } from '../lib/supabaseClient';
import { Profile, Agent, UserRoleType } from '../types/database';

export interface AuthSessionState {
  session: any | null;
  user: any | null;
  profile: Profile | null;
  agent: Agent | null;
  role: UserRoleType;
}

export const authService = {
  isConfigured: () => isSupabaseConfigured,

  async getSession() {
    if (!isSupabaseConfigured) return null;
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      console.error('[authService.getSession] Error:', error.message);
      return null;
    }
    return data.session;
  },

  async signInWithPassword(email: string, password: string) {
    if (!isSupabaseConfigured) {
      throw new Error('Supabase is not configured. Please supply VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
    }
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
    return data;
  },

  async updatePasswordAndClearMustChange(currentPassword: string, newPassword: string) {
    if (!isSupabaseConfigured) {
      throw new Error('Supabase is not configured.');
    }
    const { data, error } = await supabase.functions.invoke('change-initial-password', {
      body: { current_password: currentPassword, new_password: newPassword },
    });
    if (error) {
      const parsed = await extractFunctionsHttpError(error, 'Password update failed.');
      throw new Error(`Password update failed [${parsed.code}]: ${parsed.message}`);
    }
    if (!data?.success) throw new Error(data?.message || 'Password update failed.');
    // Refresh so the client receives the server-controlled app_metadata flag.
    const { error: refreshError } = await supabase.auth.refreshSession();
    if (refreshError) {
      await supabase.auth.signOut();
      throw new Error('Password changed. Please log in again with the new password.');
    }
    return data;
  },

  async signOut() {
    if (!isSupabaseConfigured) return;
    const { error } = await supabase.auth.signOut();
    if (error) console.error('[authService.signOut] Error:', error.message);
  },

  onAuthStateChange(callback: (event: string, session: any | null) => void) {
    if (!isSupabaseConfigured) {
      return { data: { subscription: { unsubscribe: () => {} } } };
    }
    return supabase.auth.onAuthStateChange(callback);
  },

  async fetchProfileByAuthUserId(authUserId: string): Promise<Profile | null> {
    if (!isSupabaseConfigured) return null;
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('auth_user_id', authUserId)
      .maybeSingle();

    if (error) {
      console.error('[authService.fetchProfile] Error:', error.message);
      return null;
    }
    return data as Profile | null;
  },

  async fetchAgentByProfileId(profileId: string): Promise<Agent | null> {
    if (!isSupabaseConfigured) return null;
    const { data, error } = await supabase
      .from('agents')
      .select('*')
      .eq('profile_id', profileId)
      .maybeSingle();

    if (error) {
      console.error('[authService.fetchAgent] Error:', error.message);
      return null;
    }
    return data as Agent | null;
  },
};
