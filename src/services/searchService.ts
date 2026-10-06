import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';

export interface GlobalSearchResultItem {
  entity_type: 'customer' | 'lead' | 'project' | 'pmsg_application' | 'agent' | string;
  entity_id: string;
  primary_label: string;
  secondary_label: string;
  status_label: string;
  created_date: string;
}

export const searchService = {
  isConfigured: () => isSupabaseConfigured,

  /**
   * Invokes PostgreSQL global_erp_search RPC for fast unified indexing across
   * customers, leads, projects, and PMSG records.
   */
  async searchGlobal(
    query: string,
    limit: number = 20
  ): Promise<GlobalSearchResultItem[]> {
    if (!query || query.trim().length < 2) return [];

    if (!isSupabaseConfigured) {
      return [];
    }

    const { data, error } = await supabase.rpc('global_erp_search', {
      p_query: query.trim(),
      p_max_limit: limit,
    });

    if (error) {
      console.error('[searchService.searchGlobal] RPC Error:', error.message);
      return [];
    }

    return (data || []) as GlobalSearchResultItem[];
  },
};
