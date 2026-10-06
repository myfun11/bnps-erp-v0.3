import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';
import { Customer } from '../types/database';

export interface ConvertLeadResult {
  success: boolean;
  lead_id?: string;
  customer_id?: string;
  customer_code?: string;
  message?: string;
  customer?: Customer;
}

export const customerService = {
  isConfigured: () => isSupabaseConfigured,

  async fetchCustomers(): Promise<Customer[]> {
    if (!isSupabaseConfigured) return [];
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[customerService.fetchCustomers] Error:', error.message);
      throw error;
    }
    return (data || []) as Customer[];
  },

  async fetchCustomerById(customerId: string): Promise<Customer | null> {
    if (!isSupabaseConfigured) return null;
    const { data, error } = await supabase
      .from('customers')
      .select('*')
      .eq('id', customerId)
      .maybeSingle();

    if (error) {
      console.error('[customerService.fetchCustomerById] Error:', error.message);
      throw error;
    }
    return data as Customer | null;
  },

  /**
   * Executes Authoritative Atomic Lead Conversion via PostgreSQL RPC convert_lead_atomic.
   * Transactionally:
   * 1. Locks lead record
   * 2. Checks/de-duplicates customer by mobile/consumer number
   * 3. Creates customer master record if not existing
   * 4. Creates acquisitions record
   * 5. Initializes pmsg_tracking record in INITIATED stage
   * 6. Marks lead as CONVERTED
   * 7. Creates audit log entry
   */
  async convertLeadAtomic(
    leadId: string,
    consumerNumber: string,
    actorProfileId: string
  ): Promise<ConvertLeadResult> {
    if (!isSupabaseConfigured) {
      throw new Error('Supabase is not configured.');
    }

    const { data, error } = await supabase.rpc('convert_lead_atomic', {
      p_lead_id: leadId,
      p_consumer_number: consumerNumber,
      p_actor_id: actorProfileId,
    });

    if (error) {
      console.error('[customerService.convertLeadAtomic] RPC Error:', error.message);
      return {
        success: false,
        message: error.message,
      };
    }

    const result = data as any;
    if (result && result.customer_id) {
      const customer = await this.fetchCustomerById(result.customer_id);
      return {
        success: true,
        customer_id: result.customer_id,
        customer_code: result.customer_code,
        lead_id: result.lead_id,
        customer: customer || undefined,
      };
    }

    return {
      success: Boolean(result?.success),
      customer_id: result?.customer_id,
      customer_code: result?.customer_code,
      message: result?.message,
    };
  },
};
