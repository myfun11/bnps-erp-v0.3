import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';
import { erpStore } from './erpStore';
import { Quotation, QuotationStatusType } from '../types/database';

let isTablePendingMigration = false;

const isMissingSchemaError = (err: any): boolean => {
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
    msg.includes('does not exist')
  );
};

export const quotationService = {
  isConfigured: () => isSupabaseConfigured,
  isPendingMigration: () => isTablePendingMigration,

  /**
   * Fetch list of quotations from Supabase.
   * If migration 10 has not yet been executed in Supabase ('public.quotations' missing from schema cache),
   * smoothly serves local operational store while setting isPendingMigration status.
   */
  async list(): Promise<Quotation[]> {
    if (isSupabaseConfigured) {
      try {
        const { data, error } = await supabase
          .from('quotations')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) {
          if (isMissingSchemaError(error)) {
            isTablePendingMigration = true;
            console.warn('[quotationService.list] Table "public.quotations" is not yet created in Supabase (Migration 10 pending). Serving local store.');
            return erpStore.getQuotations();
          }
          console.error('[quotationService.list] Supabase error:', error.message);
          throw new Error(error.message || 'Failed to fetch quotations from database');
        }

        isTablePendingMigration = false;
        return (data || []) as Quotation[];
      } catch (err: any) {
        if (isMissingSchemaError(err)) {
          isTablePendingMigration = true;
          console.warn('[quotationService.list] Table "public.quotations" not found in Supabase. Serving local store.');
          return erpStore.getQuotations();
        }
        throw err;
      }
    }
    return erpStore.getQuotations();
  },

  /**
   * Create a new rooftop solar quotation.
   * If database table is pending migration, smoothly saves to local store.
   */
  async create(input: Omit<Quotation, 'id' | 'quotation_no' | 'created_at'>): Promise<Quotation> {
    if (isSupabaseConfigured && !isTablePendingMigration) {
      const now = new Date();
      const timePart = Date.now().toString().slice(-5);
      const randPart = Math.floor(100 + Math.random() * 900);
      const qtnNo = (input as any).quotation_no || `BNPS/QTN/${String(now.getFullYear()).slice(-2)}${String(now.getMonth() + 1).padStart(2, '0')}/${timePart}-${randPart}`;

      const { id, created_at, ...cleanPayload } = input as any;

      try {
        const { data, error } = await supabase
          .from('quotations')
          .insert({
            ...cleanPayload,
            quotation_no: qtnNo,
          })
          .select()
          .single();

        if (error) {
          if (isMissingSchemaError(error)) {
            isTablePendingMigration = true;
            console.warn('[quotationService.create] Table "public.quotations" is pending migration. Saved in local store.');
            return erpStore.createQuotation(input);
          }
          console.error('[quotationService.create] Supabase insert error:', error.message);
          throw new Error(error.message || 'Failed to create quotation in database');
        }

        if (!data) {
          throw new Error('No data returned from database after quotation creation');
        }

        return data as Quotation;
      } catch (err: any) {
        if (isMissingSchemaError(err)) {
          isTablePendingMigration = true;
          console.warn('[quotationService.create] Table "public.quotations" is pending migration. Saved in local store.');
          return erpStore.createQuotation(input);
        }
        throw err;
      }
    }
    return erpStore.createQuotation(input);
  },

  /**
   * Update quotation status.
   */
  async updateStatus(id: string, status: QuotationStatusType): Promise<void> {
    if (isSupabaseConfigured && !isTablePendingMigration) {
      try {
        const { error } = await supabase
          .from('quotations')
          .update({ status, updated_at: new Date().toISOString() })
          .eq('id', id);

        if (error) {
          if (isMissingSchemaError(error)) {
            isTablePendingMigration = true;
            erpStore.updateQuotationStatus(id, status);
            return;
          }
          console.error('[quotationService.updateStatus] Supabase update error:', error.message);
          throw new Error(error.message || 'Failed to update quotation status in database');
        }
        return;
      } catch (err: any) {
        if (isMissingSchemaError(err)) {
          isTablePendingMigration = true;
          erpStore.updateQuotationStatus(id, status);
          return;
        }
        throw err;
      }
    }
    erpStore.updateQuotationStatus(id, status);
  },

  /**
   * Convert quotation to active customer & project via atomic transaction.
   */
  async convertToCustomer(quotationId: string, actorProfileId?: string) {
    if (isSupabaseConfigured && !isTablePendingMigration) {
      if (!actorProfileId) {
        throw new Error('Actor profile ID is required for conversion');
      }
      try {
        const { data, error } = await supabase.rpc('convert_quotation_to_customer_atomic', {
          p_quotation_id: quotationId,
          p_actor_id: actorProfileId,
        });

        if (error) {
          if (isMissingSchemaError(error)) {
            isTablePendingMigration = true;
            console.warn('[quotationService.convertToCustomer] RPC pending migration. Converting in local store.');
            return erpStore.convertQuotationToCustomer(quotationId, actorProfileId);
          }
          console.error('[quotationService.convertToCustomer] Supabase RPC error:', error.message);
          throw new Error(error.message || 'Failed to convert quotation via atomic database RPC');
        }

        if (data && (data as any).success === false) {
          throw new Error((data as any).message || 'Database conversion transaction failed');
        }

        return data;
      } catch (err: any) {
        if (isMissingSchemaError(err)) {
          isTablePendingMigration = true;
          console.warn('[quotationService.convertToCustomer] RPC pending migration. Converting in local store.');
          return erpStore.convertQuotationToCustomer(quotationId, actorProfileId);
        }
        throw err;
      }
    }
    return erpStore.convertQuotationToCustomer(quotationId, actorProfileId);
  },
};
