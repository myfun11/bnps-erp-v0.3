import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';
import { CommissionTransaction, PaymentStageType } from '../types/database';

export interface CommissionResult {
  success: boolean;
  message?: string;
  project_id?: string;
  payment_stage?: PaymentStageType;
  commissions_created?: number;
  total_commission_distributed?: number;
  distribution_tree?: Array<{
    level: number;
    agent_id: string;
    agent_name?: string;
    rate_percent: number;
    gross_amount: number;
    tds_amount: number;
    net_payable: number;
  }>;
}

export const commissionService = {
  isConfigured: () => isSupabaseConfigured,

  async fetchCommissions(): Promise<CommissionTransaction[]> {
    if (!isSupabaseConfigured) return [];
    const { data, error } = await supabase
      .from('commission_transactions')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[commissionService.fetchCommissions] Error:', error.message);
      throw error;
    }
    return (data || []) as CommissionTransaction[];
  },

  /**
   * Authoritative Multi-Tier Commission Generation RPC.
   * Calls PostgreSQL generate_project_commission_atomic() function which transactionally:
   * 1. Verifies that the triggering payment stage is verified PAID.
   * 2. Enforces concurrency lock and idempotency to prevent duplicate payouts.
   * 3. Traverses the 10-tier sponsor hierarchy up to level 1.
   * 4. Calculates exact TDS deductions and net payable ledger amounts.
   * 5. Atomically updates agent total_commission_earned totals and writes audit logs.
   */
  async generateCommissionAtomic(
    projectId: string,
    paymentStage: PaymentStageType,
    actorProfileId: string
  ): Promise<CommissionResult> {
    if (!isSupabaseConfigured) {
      throw new Error('Supabase is not configured.');
    }

    const { data, error } = await supabase.rpc('generate_project_commission_atomic', {
      p_project_id: projectId,
      p_payment_stage: paymentStage,
      p_actor_id: actorProfileId,
    });

    if (error) {
      console.error('[commissionService.generateCommissionAtomic] RPC Error:', error.message);
      return {
        success: false,
        message: error.message,
      };
    }

    const result = data as any;
    return {
      success: Boolean(result?.success),
      message: result?.message,
      project_id: result?.project_id,
      payment_stage: result?.payment_stage,
      commissions_created: result?.commissions_created,
      total_commission_distributed: result?.total_commission_distributed,
      distribution_tree: result?.distribution_tree,
    };
  },
};
