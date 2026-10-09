import React, { useState, useEffect } from 'react';
import { erpStore } from '../../services/erpStore';
import { loanService } from '../../services/loanService';
import { customerService } from '../../services/customerService';
import { Loan, Customer } from '../../types/database';
import { Landmark, CheckCircle2, Clock } from 'lucide-react';

export const LoansPage: React.FC = () => {
  const [loans, setLoans] = useState<Loan[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);

  useEffect(() => {
    let mounted = true;
    const loadLoansData = async () => {
      try {
        const [lData, cData] = await Promise.all([
          loanService.fetchLoans(),
          customerService.fetchCustomers(),
        ]);
        if (mounted) {
          setLoans(lData);
          setCustomers(cData);
        }
      } catch (err) {
        if (mounted) {
          setLoans(erpStore.getLoans());
          setCustomers(erpStore.getCustomers());
        }
      }
    };
    loadLoansData();
    const unsub = erpStore.subscribe(loadLoansData);
    return () => {
      mounted = false;
      unsub();
    };
  }, []);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="bg-slate-900/90 rounded-2xl p-5 border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
            <Landmark className="w-5 h-5 text-amber-400" />
            <span>Bank Solar Loans (PM Surya Ghar Collateral-Free Financing)</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            PSU & Private bank disbursements at 7% subsidized solar loan interest rates
          </p>
        </div>

        <div className="text-right">
          <div className="text-xs text-slate-400">Total Disbursed</div>
          <div className="text-lg font-black font-mono text-emerald-400">₹2.00 Lakhs</div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {loans.map((loan) => {
          const cust = customers.find((c) => c.id === loan.customer_id);

          return (
            <div key={loan.id} className="bg-slate-900/90 rounded-2xl p-5 border border-slate-800 shadow-md space-y-4">
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="text-base font-bold text-slate-100">{cust?.full_name}</h4>
                  <span className="text-xs font-mono text-amber-400">{loan.bank_name}</span>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    Loan App: <strong className="text-slate-300 font-mono">{loan.loan_application_no}</strong>
                  </div>
                </div>

                <span className="text-xs px-2.5 py-1 rounded-full font-mono font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{loan.status}</span>
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
                <div>
                  <span className="text-slate-400 block">Sanctioned Amount:</span>
                  <span className="font-mono font-bold text-slate-200">₹{loan.sanctioned_amount?.toLocaleString('en-IN')}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Disbursed Amount:</span>
                  <span className="font-mono font-bold text-emerald-400">₹{loan.disbursed_amount.toLocaleString('en-IN')}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Tenure:</span>
                  <span className="font-mono text-slate-200">{loan.tenure_months} Months (5 Years)</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Interest Rate:</span>
                  <span className="font-mono font-bold text-amber-400">{loan.interest_rate_pa}% p.a.</span>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-xs text-slate-500 font-mono">
                <span>Branch: {loan.branch_name}</span>
                <span>Disbursed: {loan.disbursement_date}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
