import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';
import { erpStore } from './erpStore';
import { Quotation, QuotationStatusType } from '../types/database';

export const quotationService = {
  isConfigured: () => isSupabaseConfigured,

  /**
   * Fetch list of quotations from Supabase
   */
  async list(): Promise<Quotation[]> {
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from('quotations')
          .select('*')
          .order('created_at', { ascending: false });

        if (!error && Array.isArray(data)) {
          return data as Quotation[];
        }

        if (error) {
          console.warn('[quotationService.list] Supabase notice (table may be pending migration in SQL Editor):', error.message);
          return erpStore.getQuotations();
        }
      } catch (err: any) {
        console.warn('[quotationService.list] Supabase query exception:', err?.message || err);
        return erpStore.getQuotations();
      }
    }
    return erpStore.getQuotations();
  },

  /**
   * Create a new rooftop solar quotation
   */
  async create(input: Omit<Quotation, 'id' | 'quotation_no' | 'created_at'>): Promise<Quotation> {
    if (isSupabaseConfigured) {
      try {
        const now = new Date();
        const qtnNo = `BNPS/QTN/${String(now.getFullYear()).slice(-2)}${String(now.getMonth() + 1).padStart(2, '0')}/${Math.floor(100 + Math.random() * 900)}`;
        const { data, error } = await supabase
          .from('quotations')
          .insert({
            ...input,
            quotation_no: qtnNo,
          })
          .select()
          .single();

        if (!error && data) {
          return data as Quotation;
        }

        if (error) {
          console.warn('[quotationService.create] Supabase insert notice (table may be pending migration):', error.message);
        }
      } catch (err: any) {
        console.warn('[quotationService.create] Supabase insert exception:', err?.message || err);
      }
    }
    return erpStore.createQuotation(input);
  },

  /**
   * Update quotation status
   */
  async updateStatus(id: string, status: QuotationStatusType): Promise<void> {
    if (isSupabaseConfigured) {
      try {
        const { error } = await supabase
          .from('quotations')
          .update({ status, updated_at: new Date().toISOString() })
          .eq('id', id);

        if (!error) {
          return;
        }
        console.warn('[quotationService.updateStatus] Supabase notice:', error.message);
      } catch (err: any) {
        console.warn('[quotationService.updateStatus] Supabase exception:', err?.message || err);
      }
    }
    erpStore.updateQuotationStatus(id, status);
  },

  /**
   * Convert quotation to active customer & project via atomic transaction
   */
  async convertToCustomer(quotationId: string, actorProfileId?: string) {
    if (isSupabaseConfigured && actorProfileId) {
      try {
        const { data, error } = await supabase.rpc('convert_quotation_to_customer_atomic', {
          p_quotation_id: quotationId,
          p_actor_id: actorProfileId,
        });

        if (!error && data?.success) {
          return data;
        }
        if (error) {
          console.warn('[quotationService.convertToCustomer] Supabase RPC notice (migration may be pending):', error.message);
        }
      } catch (err: any) {
        console.warn('[quotationService.convertToCustomer] Supabase RPC exception:', err?.message || err);
      }
    }
    return erpStore.convertQuotationToCustomer(quotationId, actorProfileId);
  },
};
