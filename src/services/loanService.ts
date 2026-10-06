import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';
import { Loan } from '../types/database';

export const loanService = {
  isConfigured: () => isSupabaseConfigured,

  async fetchLoans(): Promise<Loan[]> {
    if (!isSupabaseConfigured) return [];
    const { data, error } = await supabase
      .from('loans')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[loanService.fetchLoans] Error:', error.message);
      throw error;
    }
    return (data || []) as Loan[];
  },

  async updateLoan(loanId: string, updates: Partial<Loan>): Promise<Loan> {
    if (!isSupabaseConfigured) {
      throw new Error('Supabase is not configured.');
    }

    const { data, error } = await supabase
      .from('loans')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', loanId)
      .select()
      .single();

    if (error) {
      console.error('[loanService.updateLoan] Error:', error.message);
      throw error;
    }
    return data as Loan;
  },
};
