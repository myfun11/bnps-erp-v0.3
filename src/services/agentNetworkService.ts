import { supabase } from '../lib/supabaseClient';
import { Agent, BranchLocation } from '../types/database';

export interface AgentNetworkFilters {
  search?: string;
  branch?: string;
  hierarchyLevel?: number;
}

export interface CreateAgentInput {
  full_name: string;
  phone: string;
  email: string;
  branch: BranchLocation;
  sponsor_agent_id?: string;
  password: string;
  pan_number?: string;
  bank_account_no?: string;
  bank_name?: string;
  bank_ifsc?: string;
  tds_percentage: number;
}

const mapAgent = (row: any): Agent => ({
  id: row.id,
  profile_id: row.profile_id,
  agent_code: row.agent_code,
  branch: row.branch as BranchLocation | undefined,
  sponsor_agent_id: row.sponsor_agent_id ?? undefined,
  hierarchy_level: Number(row.hierarchy_level),
  pan_number: row.pan_number ?? undefined,
  aadhaar_masked: row.aadhaar_masked ?? undefined,
  bank_account_no: row.bank_account_no ?? undefined,
  bank_name: row.bank_name ?? undefined,
  bank_ifsc: row.bank_ifsc ?? undefined,
  tds_percentage: Number(row.tds_percentage ?? 5),
  total_commission_earned: Number(row.total_commission_earned ?? 0),
  total_commission_paid: Number(row.total_commission_paid ?? 0),
  outstanding_advance: Number(row.outstanding_advance ?? 0),
  is_active: Boolean(row.is_active),
  is_test: Boolean(row.is_test),
  created_at: row.created_at,
  updated_at: row.updated_at,
  profile: {
    id: row.profile_id,
    full_name: row.full_name,
    phone: row.phone,
    email: row.email ?? undefined,
    role: 'agent',
    branch: row.branch as BranchLocation | undefined,
    is_active: Boolean(row.is_active),
    is_test: Boolean(row.is_test),
    created_at: row.created_at,
    updated_at: row.updated_at,
  },
});

export const agentNetworkService = {
  async list(filters: AgentNetworkFilters = {}): Promise<Agent[]> {
    const { data, error } = await supabase.rpc('get_agent_network', {
      p_search: filters.search ?? '',
      p_branch: filters.branch && filters.branch !== 'ALL' ? filters.branch : null,
      p_hierarchy_level: filters.hierarchyLevel ?? null,
    });
    if (error) throw error;
    return (data ?? []).map(mapAgent);
  },

  async create(input: CreateAgentInput) {
    const { data, error } = await supabase.functions.invoke('admin-create-agent', {
      body: input,
    });
    if (error) throw error;
    if (!data?.success) throw new Error(data?.error || 'Agent onboarding failed');
    return data;
  },
};
