import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';

export interface DashboardKpis {
  total_leads: number;
  new_leads_waiting: number;
  converted_customers: number;
  registered_on_portal: number;
  pending_registrations: number;
  solar_installations_completed: number;
  solar_installations_total: number;
  solar_installations_pending: number;
  bank_loans_disbursed_amount: number;
  loans_pending_approval_count: number;
  vendor_payments_pending_count: number;
  vendor_payments_paid_amount: number;
  commission_generated_amount: number;
  commission_paid_to_agents_amount: number;
  active_agents_count: number;
  total_agents_count: number;
}

export interface MonthlyInstallationMetric {
  month: string;
  capacity_kw: number;
  projects_count: number;
}

export interface TopAgentMetric {
  rank: number;
  agent_name: string;
  agent_code: string;
  verified_installs: number;
  commission_earned_amount: number;
}

export interface DashboardProfileScope {
  role: string;
  branch: string | null;
  is_global_scope: boolean;
}

export interface DashboardSummaryResponse {
  profile: DashboardProfileScope;
  kpis: DashboardKpis;
  monthly_installations: MonthlyInstallationMetric[];
  top_agents: TopAgentMetric[];
}

export const dashboardService = {
  isConfigured: () => isSupabaseConfigured,

  /**
   * Invokes the authoritative get_dashboard_summary() PostgreSQL RPC on Supabase.
   * Resolves caller identity strictly from authenticated auth.uid() in JWT session.
   */
  async getDashboardSummary(): Promise<DashboardSummaryResponse | null> {
    if (!isSupabaseConfigured) {
      return null;
    }

    const { data, error } = await supabase.rpc('get_dashboard_summary');

    if (error) {
      console.error('[dashboardService.getDashboardSummary] RPC Error:', error.message);
      throw error;
    }

    return data as DashboardSummaryResponse;
  },
};
