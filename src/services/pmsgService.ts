import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';
import { PmsgTracking, PmsgStageType } from '../types/database';

export const pmsgService = {
  isConfigured: () => isSupabaseConfigured,

  async createPmsgTracking(
    customerId: string,
    isTest: boolean
  ): Promise<PmsgTracking> {
    if (!isSupabaseConfigured) {
      throw new Error('Supabase is not configured.');
    }

    const { data: existing, error: existingError } = await supabase
      .from('pmsg_tracking')
      .select('id')
      .eq('customer_id', customerId)
      .maybeSingle();

    if (existingError) {
      console.error('[pmsgService.createPmsgTracking] Duplicate check error:', existingError.message);
      throw existingError;
    }

    if (existing) {
      throw new Error('PMSG registration already exists for this customer.');
    }

    const { data, error } = await supabase
      .from('pmsg_tracking')
      .insert([{
        customer_id: customerId,
        stage: 'INITIATED',
        is_test: isTest,
      }])
      .select()
      .single();

    if (error) {
      console.error('[pmsgService.createPmsgTracking] Error:', error.message);
      throw error;
    }

    return data as PmsgTracking;
  },
  async fetchPmsgTracking(): Promise<PmsgTracking[]> {
    if (!isSupabaseConfigured) return [];
    const { data, error } = await supabase
      .from('pmsg_tracking')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[pmsgService.fetchPmsgTracking] Error:', error.message);
      throw error;
    }
    return (data || []) as PmsgTracking[];
  },

  async fetchPmsgByCustomerId(customerId: string): Promise<PmsgTracking | null> {
    if (!isSupabaseConfigured) return null;
    const { data, error } = await supabase
      .from('pmsg_tracking')
      .select('*')
      .eq('customer_id', customerId)
      .maybeSingle();

    if (error) {
      console.error('[pmsgService.fetchPmsgByCustomerId] Error:', error.message);
      throw error;
    }
    return data as PmsgTracking | null;
  },

  /**
   * Updates PM Surya Ghar portal application tracking.
   * Enforces business rule: Once APPLICATION_SUBMITTED / verified, edits are locked to preserve read-only integrity.
   */
  async updatePortalStatus(
    customerId: string,
    portalApplicationNo: string,
    remarks?: string
  ): Promise<{ success: boolean; pmsg?: PmsgTracking; message?: string }> {
    if (!isSupabaseConfigured) {
      throw new Error('Supabase is not configured.');
    }

    // Verify current state before update
    const current = await this.fetchPmsgByCustomerId(customerId);
    if (!current) {
      return { success: false, message: 'PMSG record not found for this customer.' };
    }

    // Portal/Application submission is a one-time transition.
    // Later operational stages are handled separately by updateStage().
    if (current.stage !== 'INITIATED') {
      return {
        success: false,
        message: 'IMMUTABLE_STAGE: Portal/Application status has already been submitted and is read-only.'
      };
    }

    const nextStage: PmsgStageType = 'APPLICATION_SUBMITTED';

    const { data, error } = await supabase
      .from('pmsg_tracking')
      .update({
        portal_application_no: portalApplicationNo.trim(),
        stage: nextStage,
        application_submission_date: current.application_submission_date || new Date().toISOString().split('T')[0],
        portal_remarks: remarks || current.portal_remarks,
        last_sync_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('customer_id', customerId)
      .select()
      .single();

    if (error) {
      console.error('[pmsgService.updatePortalStatus] Error:', error.message);
      return { success: false, message: error.message };
    }

    return {
      success: true,
      pmsg: data as PmsgTracking,
    };
  },

  async updateStage(
    pmsgId: string,
    stage: PmsgStageType,
    remarks?: string
  ): Promise<PmsgTracking> {
    if (!isSupabaseConfigured) {
      throw new Error('Supabase is not configured.');
    }

    const { data, error } = await supabase
      .from('pmsg_tracking')
      .update({
        stage,
        portal_remarks: remarks,
        last_sync_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', pmsgId)
      .select()
      .single();

    if (error) {
      console.error('[pmsgService.updateStage] Error:', error.message);
      throw error;
    }
    return data as PmsgTracking;
  },
};
