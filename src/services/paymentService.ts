import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';
import { Payment, PaymentStatusType } from '../types/database';

export const paymentService = {
  isConfigured: () => isSupabaseConfigured,

  async fetchPayments(): Promise<Payment[]> {
    if (!isSupabaseConfigured) return [];
    const { data, error } = await supabase
      .from('payments')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[paymentService.fetchPayments] Error:', error.message);
      throw error;
    }
    return (data || []) as Payment[];
  },

  /**
   * Approves or updates payment status.
   * Note: In accordance with PostgreSQL schema immutability, PAID payments cannot be mutated.
   */
  async updatePaymentStatus(
    paymentId: string,
    status: PaymentStatusType,
    approverProfileId?: string,
    remarks?: string
  ): Promise<{ success: boolean; payment?: Payment; message?: string }> {
    if (!isSupabaseConfigured) {
      throw new Error('Supabase is not configured.');
    }

    // Verify current status first
    const { data: currentPayment, error: fetchErr } = await supabase
      .from('payments')
      .select('*')
      .eq('id', paymentId)
      .single();

    if (fetchErr || !currentPayment) {
      return { success: false, message: 'Payment record not found.' };
    }

    if (currentPayment.status === 'PAID') {
      return {
        success: false,
        message: 'IMMUTABLE_RECORD: Verified PAID payment records are strictly immutable and cannot be updated.',
      };
    }

    const updates: any = {
      status,
      remarks: remarks || currentPayment.remarks,
      updated_at: new Date().toISOString(),
    };

    if (status === 'APPROVED' || status === 'PAID') {
      updates.approved_by = approverProfileId;
      updates.approval_timestamp = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from('payments')
      .update(updates)
      .eq('id', paymentId)
      .select()
      .single();

    if (error) {
      console.error('[paymentService.updatePaymentStatus] Error:', error.message);
      return { success: false, message: error.message };
    }

    return {
      success: true,
      payment: data as Payment,
    };
  },
};
