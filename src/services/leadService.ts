import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';
import { Lead, LeadStageType } from '../types/database';

export const leadService = {
  isConfigured: () => isSupabaseConfigured,

  async fetchLeads(): Promise<Lead[]> {
    if (!isSupabaseConfigured) return [];
    const { data, error } = await supabase
      .from('leads')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[leadService.fetchLeads] Error:', error.message);
      throw error;
    }
    return (data || []) as Lead[];
  },

  async createLead(leadInput: Partial<Lead>): Promise<Lead> {
  if (!isSupabaseConfigured) {
    throw new Error('Supabase is not configured.');
  }

  const { data, error } = await supabase.rpc('create_lead_atomic', {
    p_source_agent_id: leadInput.source_agent_id ?? null,
    p_assigned_officer_id: leadInput.assigned_officer_id ?? null,
    p_full_name: leadInput.full_name ?? null,
    p_mobile: leadInput.mobile ?? null,
    p_alternate_phone: leadInput.alternate_phone ?? null,
    p_email: leadInput.email ?? null,
    p_discom_name: leadInput.discom_name ?? 'CSPDCL',
    p_consumer_number: leadInput.consumer_number ?? null,
    p_sanctioned_load_kw: leadInput.sanctioned_load_kw ?? null,
    p_proposed_capacity_kw: leadInput.proposed_capacity_kw ?? null,
    p_address_line: leadInput.address_line ?? null,
    p_state: leadInput.state ?? 'Chhattisgarh',
    p_district: leadInput.district ?? null,
    p_tehsil: leadInput.tehsil ?? null,
    p_block: leadInput.block ?? null,
    p_panchayat_village: leadInput.panchayat_village ?? null,
    p_pincode: leadInput.pincode ?? null,
    p_notes: leadInput.notes ?? null,
    p_is_test: leadInput.is_test ?? false,
    p_father_name: leadInput.father_name ?? null,
    p_dob: leadInput.dob ?? null,
  });

  if (error) {
    console.error('[leadService.createLead] RPC Error:', error.message);
    throw error;
  }

  const result = data as {
    success?: boolean;
    lead?: Lead;
    message?: string;
  };

  if (!result?.success || !result.lead) {
    throw new Error(result?.message || 'Lead creation failed.');
  }

  return result.lead;
},

  async convertLeadAtomic(
    leadId: string,
    consumerNumber: string,
    actorProfileId: string
  ): Promise<{ success: boolean; customer?: { id: string; customer_code: string }; error?: string; message?: string }> {
    if (!isSupabaseConfigured) throw new Error('Supabase is not configured.');
    const { data, error } = await supabase.rpc('convert_lead_atomic', {
      p_lead_id: leadId,
      p_consumer_number: consumerNumber,
      p_actor_id: actorProfileId,
    });
    if (error) throw error;
    const result = data as { success?: boolean; customer_id?: string; customer_code?: string; message?: string };
    if (!result?.success || !result.customer_id) {
      throw new Error(result?.message || 'Lead conversion failed.');
    }
    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .select('id, customer_code')
      .eq('id', result.customer_id)
      .single();
    if (customerError || !customer) {
      throw new Error(customerError?.message || 'Customer was created but could not be reloaded from Supabase.');
    }
    return { success: true, customer: customer as { id: string; customer_code: string } };
  },

  async updateLead(leadId: string, updates: Partial<Lead>): Promise<Lead> {
    if (!isSupabaseConfigured) {
      throw new Error('Supabase is not configured.');
    }

    const { data, error } = await supabase
      .from('leads')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', leadId)
      .select()
      .single();

    if (error) {
      console.error('[leadService.updateLead] Error:', error.message);
      throw error;
    }
    return data as Lead;
  },

  async updateLeadStage(leadId: string, stage: LeadStageType, lostReason?: string): Promise<Lead> {
    return this.updateLead(leadId, {
      stage,
      lost_reason: lostReason,
    });
  },
};
