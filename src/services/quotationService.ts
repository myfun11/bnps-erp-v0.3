import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';
import { erpStore } from './erpStore';
import { Quotation, QuotationStatusType } from '../types/database';

export const quotationService = {
  isConfigured: () => isSupabaseConfigured,

  /**
   * Fetch list of quotations from Supabase
   * When Supabase is configured, errors are thrown directly to prevent silent fallback to erpStore.
   */
  async list(): Promise<Quotation[]> {
    if (isSupabaseConfigured) {
      const { data, error } = await supabase
        .from('quotations')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[quotationService.list] Supabase error:', error.message);
        throw new Error(error.message || 'Failed to fetch quotations from database');
      }

      return (data || []) as Quotation[];
    }
    return erpStore.getQuotations();
  },

  /**
   * Create a new rooftop solar quotation
   * When Supabase is configured, errors are thrown directly to prevent false success.
   */
  async create(input: Omit<Quotation, 'id' | 'quotation_no' | 'created_at'>): Promise<Quotation> {
    if (isSupabaseConfigured) {
      const now = new Date();
      // Generate collision-resistant quotation number:
      // Format: BNPS/QTN/YYMM/<5-digit-time>-<3-digit-random>
      const timePart = Date.now().toString().slice(-5);
      const randPart = Math.floor(100 + Math.random() * 900);
      const qtnNo = (input as any).quotation_no || `BNPS/QTN/${String(now.getFullYear()).slice(-2)}${String(now.getMonth() + 1).padStart(2, '0')}/${timePart}-${randPart}`;

      // Clean payload: strip client temporary 'id' and 'created_at' so PostgreSQL generates valid UUID and timestamp
      const { id, created_at, ...cleanPayload } = input as any;

      const { data, error } = await supabase
        .from('quotations')
        .insert({
          ...cleanPayload,
          quotation_no: qtnNo,
        })
        .select()
        .single();

      if (error) {
        console.error('[quotationService.create] Supabase insert error:', error.message);
        throw new Error(error.message || 'Failed to create quotation in database');
      }

      if (!data) {
        throw new Error('No data returned from database after quotation creation');
      }

      return data as Quotation;
    }
    return erpStore.createQuotation(input);
  },

  /**
   * Update quotation status
   * When Supabase is configured, errors are thrown directly to prevent false success.
   */
  async updateStatus(id: string, status: QuotationStatusType): Promise<void> {
    if (isSupabaseConfigured) {
      const { error } = await supabase
        .from('quotations')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) {
        console.error('[quotationService.updateStatus] Supabase update error:', error.message);
        throw new Error(error.message || 'Failed to update quotation status in database');
      }
      return;
    }
    erpStore.updateQuotationStatus(id, status);
  },

  /**
   * Convert quotation to active customer & project via atomic transaction
   * When Supabase is configured, errors are thrown directly to prevent false success.
   */
  async convertToCustomer(quotationId: string, actorProfileId?: string) {
    if (isSupabaseConfigured) {
      if (!actorProfileId) {
        throw new Error('Actor profile ID is required for conversion');
      }
      const { data, error } = await supabase.rpc('convert_quotation_to_customer_atomic', {
        p_quotation_id: quotationId,
        p_actor_id: actorProfileId,
      });

      if (error) {
        console.error('[quotationService.convertToCustomer] Supabase RPC error:', error.message);
        throw new Error(error.message || 'Failed to convert quotation via atomic database RPC');
      }

      if (data && (data as any).success === false) {
        throw new Error((data as any).message || 'Database conversion transaction failed');
      }

      return data;
    }
    return erpStore.convertQuotationToCustomer(quotationId, actorProfileId);
  },
};
