import { supabase, isSupabaseConfigured, extractFunctionsHttpError, sanitizeServerErrorMessage } from '../lib/supabaseClient';
import { Agent, BranchLocation } from '../types/database';
import { erpStore } from './erpStore';

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
  password?: string;
  pan_number?: string;
  bank_account_no?: string;
  bank_name?: string;
  bank_ifsc?: string;
  tds_percentage: number;
  is_test?: boolean;
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

export class AgentServiceError extends Error {
  code: string;
  status: number;
  requestId?: string;

  constructor(code: string, message: string, status = 500, requestId?: string) {
    super(`Agent creation failed [${code}]: ${message}`);
    this.name = 'AgentServiceError';
    this.code = code;
    this.status = status;
    this.requestId = requestId;
  }
}

export const agentNetworkService = {
  isConfigured: () => isSupabaseConfigured,

  async list(filters: AgentNetworkFilters = {}): Promise<Agent[]> {
    if (isSupabaseConfigured) {
      const { data, error } = await supabase.rpc('get_agent_network', {
        p_search: filters.search ?? '',
        p_branch: filters.branch && filters.branch !== 'ALL' ? filters.branch : null,
        p_hierarchy_level: filters.hierarchyLevel ?? null,
      });

      if (error) {
        console.error('[agentNetworkService.list] RPC error:', error.message);
        throw error;
      }

      if (Array.isArray(data)) {
        const mapped = data.map(mapAgent);
        erpStore.setAgents(mapped);
        return mapped;
      }
      return [];
    }

    // Disconnected verification mode only
    return erpStore.getAgents();
  },

  async create(input: CreateAgentInput) {
    if (isSupabaseConfigured) {
      const { data, error } = await supabase.functions.invoke('create-agent', {
        body: { ...input, credentials_flow_version: 1 },
      });

      if (error) {
        const parsed = await extractFunctionsHttpError(
          error,
          'The server encountered an error while processing the agent creation request.'
        );
        const serviceErr = new AgentServiceError(parsed.code, parsed.message, parsed.status, parsed.requestId);
        console.error('[agentNetworkService.create]', serviceErr.message);
        throw serviceErr;
      }

      if (data?.success) {
        return {
          success: true as const,
          agent_id: data.agent_id,
          profile_id: data.profile_id,
          agent_code: data.agent_code,
          auth_user_id: data.auth_user_id,
          login_email: data.login_email,
          temporary_password: data.temporary_password,
          password_display_once: data.password_display_once === true,
          invite_sent: data.invite_sent === true,
        };
      }

      const rawErr = data?.message || 'Failed to create agent in Supabase';
      const safeErr = sanitizeServerErrorMessage(rawErr);
      const code = data?.error ? String(data.error) : 'AGENT_CREATION_FAILED';
      throw new AgentServiceError(code, safeErr);
    }

    // Disconnected verification mode only
    const localRes = erpStore.createAgent({
      full_name: input.full_name,
      phone: input.phone,
      email: input.email,
      branch: input.branch,
      sponsor_agent_id: input.sponsor_agent_id,
      login_password: input.password,
      pan_number: input.pan_number,
      bank_account_no: input.bank_account_no,
      bank_name: input.bank_name,
      bank_ifsc: input.bank_ifsc,
      tds_percentage: input.tds_percentage,
    });

    const agent = localRes.agent!;
    return {
      success: true as const,
      agent_id: agent.id,
      profile_id: agent.profile_id,
      agent_code: agent.agent_code,
      auth_user_id: agent.id,
      login_email: input.email,
      temporary_password: undefined,
      password_display_once: false,
      invite_sent: false,
    };
  },
};
