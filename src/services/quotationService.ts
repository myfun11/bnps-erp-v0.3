import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';
import { erpStore } from './erpStore';
import { Quotation, QuotationStatusType } from '../types/database';

/**
 * Checks if a Supabase error is due to missing schema objects (table or function).
 */
export const isMissingSchemaError = (err: any): boolean => {
  if (!err) return false;
  const msg = (err.message || '').toLowerCase();
  const code = (err.code || '').toLowerCase();
  return (
    code === 'pgrst205' ||
    code === 'pgrst202' ||
    code === '42p01' ||
    code === '42883' ||
    msg.includes('schema cache') ||
    msg.includes('could not find the table') ||
    msg.includes('could not find the function') ||
    msg.includes('relation "public.quotations" does not exist') ||
    msg.includes('does not exist')
  );
};

export const quotationService = {
  isConfigured: () => isSupabaseConfigured,

  /**
   * Fetch list of quotations from authoritative Supabase database.
   * In production (when Supabase is configured), throws any schema or network error
   * without silent local-store fallback. Every call queries the live database.
   */
  async list(): Promise<Quotation[]> {
    if (isSupabaseConfigured) {
      const { data, error } = await supabase
        .from('quotations')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[quotationService.list] Supabase error:', error.message, error.code);
        const err = new Error(
          isMissingSchemaError(error)
            ? `Database table 'public.quotations' does not exist in Supabase (code: ${error.code || 'PGRST205'}). Migration 10 (database/10_quotations_table_ddl_and_rpc.sql) must be executed in Supabase SQL editor.`
            : (error.message || 'Failed to fetch quotations from database')
        );
        (err as any).code = error.code;
        (err as any).details = error.details;
        throw err;
      }

      return (data || []) as Quotation[];
    }
    // Deliberate offline/demo mode only (when Supabase credentials are not configured)
    return erpStore.getQuotations();
  },

  /**
   * Create a new rooftop solar quotation in authoritative Supabase database.
   * Throws database errors directly. Does not silently create local-only records in production.
   */
  async create(input: Omit<Quotation, 'id' | 'quotation_no' | 'created_at'>): Promise<Quotation> {
    if (isSupabaseConfigured) {
      const now = new Date();
      const timePart = Date.now().toString().slice(-5);
      const randPart = Math.floor(100 + Math.random() * 900);
      const qtnNo = (input as any).quotation_no || `BNPS/QTN/${String(now.getFullYear()).slice(-2)}${String(now.getMonth() + 1).padStart(2, '0')}/${timePart}-${randPart}`;

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
        console.error('[quotationService.create] Supabase insert error:', error.message, error.code);
        const err = new Error(
          isMissingSchemaError(error)
            ? `Cannot save quotation: table 'public.quotations' is missing in Supabase (code: ${error.code || 'PGRST205'}). Please run migration 10 in Supabase.`
            : (error.message || 'Failed to create quotation in database')
        );
        (err as any).code = error.code;
        throw err;
      }

      if (!data) {
        throw new Error('No data returned from database after quotation creation');
      }

      return data as Quotation;
    }
    // Deliberate offline/demo mode only
    return erpStore.createQuotation(input);
  },

  /**
   * Update quotation status in authoritative Supabase database.
   */
  async updateStatus(id: string, status: QuotationStatusType): Promise<void> {
    if (isSupabaseConfigured) {
      const { error } = await supabase
        .from('quotations')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) {
        console.error('[quotationService.updateStatus] Supabase update error:', error.message, error.code);
        const err = new Error(
          isMissingSchemaError(error)
            ? `Cannot update quotation status: table 'public.quotations' is missing in Supabase (code: ${error.code || 'PGRST205'}).`
            : (error.message || 'Failed to update quotation status in database')
        );
        (err as any).code = error.code;
        throw err;
      }
      return;
    }
    erpStore.updateQuotationStatus(id, status);
  },

  /**
   * Convert quotation to active customer & project via atomic transaction in Supabase.
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
        console.error('[quotationService.convertToCustomer] Supabase RPC error:', error.message, error.code);
        const err = new Error(
          isMissingSchemaError(error)
            ? `Conversion failed: RPC 'convert_quotation_to_customer_atomic' is missing in Supabase (code: ${error.code || 'PGRST202'}). Please execute migration 10 in Supabase.`
            : (error.message || 'Failed to convert quotation via atomic database RPC')
        );
        (err as any).code = error.code;
        throw err;
      }

      if (data && (data as any).success === false) {
        throw new Error((data as any).message || 'Database conversion transaction failed');
      }

      return data;
    }
    return erpStore.convertQuotationToCustomer(quotationId, actorProfileId);
  },
};
