import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';
import { Project, ProjectStatusType } from '../types/database';

export const projectService = {
  isConfigured: () => isSupabaseConfigured,

  async fetchProjects(): Promise<Project[]> {
    if (!isSupabaseConfigured) return [];
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[projectService.fetchProjects] Error:', error.message);
      throw error;
    }
    return (data || []) as Project[];
  },

  async fetchProjectById(projectId: string): Promise<Project | null> {
    if (!isSupabaseConfigured) return null;
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .maybeSingle();

    if (error) {
      console.error('[projectService.fetchProjectById] Error:', error.message);
      throw error;
    }
    return data as Project | null;
  },

  async createProject(projectInput: Partial<Project>): Promise<Project> {
    if (!isSupabaseConfigured) {
      throw new Error('Supabase is not configured.');
    }

    const { data, error } = await supabase
      .from('projects')
      .insert([projectInput])
      .select()
      .single();

    if (error) {
      console.error('[projectService.createProject] Error:', error.message);
      throw error;
    }
    return data as Project;
  },

  async updateProjectStatus(
    projectId: string,
    status: ProjectStatusType
  ): Promise<{ success: boolean; project?: Project; message?: string }> {
    if (!isSupabaseConfigured) {
      throw new Error('Supabase is not configured.');
    }

    const { data, error } = await supabase
      .from('projects')
      .update({
        status,
        updated_at: new Date().toISOString(),
      })
      .eq('id', projectId)
      .select()
      .single();

    if (error) {
      console.error('[projectService.updateProjectStatus] Error:', error.message);
      return { success: false, message: error.message };
    }

    return {
      success: true,
      project: data as Project,
    };
  },
};
