import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';
import { Installation } from '../types/database';
import { erpStore } from './erpStore';

export const installationService = {
  isConfigured: () => isSupabaseConfigured,

  async fetchInstallations(): Promise<Installation[]> {
    if (isSupabaseConfigured) {
      const { data, error } = await supabase
        .from('installations')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[installationService.fetchInstallations] Error:', error.message);
        throw error;
      }
      return (data || []) as Installation[];
    }
    return erpStore.getInstallations();
  },

  async createInstallation(input: Partial<Installation>): Promise<Installation> {
    if (isSupabaseConfigured) {
      const { data, error } = await supabase
        .from('installations')
        .insert([input])
        .select()
        .single();

      if (error) {
        console.error('[installationService.createInstallation] Error:', error.message);
        throw error;
      }
      return data as Installation;
    }
    return erpStore.createInstallation(input as any);
  },

  async completeInstallation(
    installationId: string,
    details: {
      net_meter_serial_no: string;
      net_meter_installed_date?: string;
      discom_inspection_date?: string;
      inspector_name?: string;
      notes?: string;
    }
  ): Promise<{ success: boolean; message?: string }> {
    if (isSupabaseConfigured) {
      const { data, error } = await supabase.rpc('complete_installation_atomic', {
        p_installation_id: installationId,
        p_net_meter_serial_no: details.net_meter_serial_no,
        p_net_meter_installed_date: details.net_meter_installed_date || new Date().toISOString().split('T')[0],
        p_discom_inspection_date: details.discom_inspection_date || new Date().toISOString().split('T')[0],
        p_inspector_name: details.inspector_name || 'CSPDCL Testing Division',
        p_notes: details.notes || null,
      });

      if (error) {
        console.error('[installationService.completeInstallation] RPC Error:', error.message);
        throw error;
      }
      return { success: true };
    }

    erpStore.updateInstallation(installationId, {
      net_meter_serial_no: details.net_meter_serial_no,
      net_meter_installed: true,
      net_meter_installed_date: details.net_meter_installed_date || new Date().toISOString().split('T')[0],
      discom_inspection_signoff: true,
      discom_inspection_date: details.discom_inspection_date || new Date().toISOString().split('T')[0],
      inspector_name: details.inspector_name || 'CSPDCL Testing Division',
      installation_completed_date: details.discom_inspection_date || new Date().toISOString().split('T')[0],
      notes: details.notes,
    });
    return { success: true };
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
