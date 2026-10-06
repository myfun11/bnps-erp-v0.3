import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';
import { Installation } from '../types/database';

export const installationService = {
  isConfigured: () => isSupabaseConfigured,

  async fetchInstallations(): Promise<Installation[]> {
    if (!isSupabaseConfigured) return [];
    const { data, error } = await supabase
      .from('installations')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[installationService.fetchInstallations] Error:', error.message);
      throw error;
    }
    return (data || []) as Installation[];
  },

  async fetchInstallationByProjectId(projectId: string): Promise<Installation | null> {
    if (!isSupabaseConfigured) return null;
    const { data, error } = await supabase
      .from('installations')
      .select('*')
      .eq('project_id', projectId)
      .maybeSingle();

    if (error) {
      console.error('[installationService.fetchInstallationByProjectId] Error:', error.message);
      throw error;
    }
    return data as Installation | null;
  },

  async updateInstallation(
    installationId: string,
    updates: Partial<Installation>
  ): Promise<Installation> {
    if (!isSupabaseConfigured) {
      throw new Error('Supabase is not configured.');
    }

    const { data, error } = await supabase
      .from('installations')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', installationId)
      .select()
      .single();

    if (error) {
      console.error('[installationService.updateInstallation] Error:', error.message);
      throw error;
    }
    return data as Installation;
  },
};
