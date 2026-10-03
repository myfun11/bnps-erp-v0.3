import React, { useState } from 'react';
import { erpStore } from '../../services/erpStore';
import { Receipt, Plus, DollarSign, Wallet } from 'lucide-react';

export const FinanceExpensesPage: React.FC = () => {
  const [expenses, setExpenses] = useState(erpStore.getExpenses());
  const [showModal, setShowModal] = useState(false);

  const [category, setCategory] = useState('SITE_SURVEY');
  const [amount, setAmount] = useState(2500);
  const [paidTo, setPaidTo] = useState('');
  const [notes, setNotes] = useState('');

  const totalExpense = expenses.reduce((sum, e) => sum + e.amount, 0);

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!paidTo || amount <= 0) return;

    erpStore.recordExpense({
      category,
      amount: Number(amount),
      paidTo: paidTo,
      payment_mode: 'UPI',
      recorded_by: 'Accountant Officer',
      expense_date: new Date().toISOString().split('T')[0],
      notes,
    } as any);

    setExpenses(erpStore.getExpenses());
    setShowModal(false);
    setPaidTo('');
    setNotes('');
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="bg-slate-900/90 rounded-2xl p-5 border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
            <Receipt className="w-5 h-5 text-amber-400" />
            <span>Finance & Operating Expenses (Section 24 Compliance)</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Operational site surveys, transport, office overheads, and vendor clearance
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-[11px] text-slate-400">Total Month Expenses</div>
            <div className="text-base font-black font-mono text-rose-400">₹{totalExpense.toLocaleString('en-IN')}</div>
          </div>

          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold shadow-md shadow-amber-500/20"
          >
            <Plus className="w-4 h-4" />
            <span>+ Record Expense</span>
          </button>
        </div>
      </div>

      <div className="bg-slate-900/90 rounded-2xl border border-slate-800 shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-800/80 text-slate-400 text-[11px] uppercase tracking-wider border-b border-slate-700/80">
              <tr>
                <th className="px-4 py-3">Expense Voucher</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Paid To / Vendor</th>
                <th className="px-4 py-3">Payment Mode</th>
                <th className="px-4 py-3">Recorded By</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3 text-right">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {expenses.map((exp) => (
                <tr key={exp.id} className="hover:bg-slate-800/50 transition-colors">
                  <td className="px-4 py-3.5 font-mono text-amber-400 font-bold">
                    {exp.expense_code}
                  </td>
                  <td className="px-4 py-3.5">
                    <span className="font-mono text-[11px] bg-slate-800 px-2 py-0.5 rounded text-slate-200">
                      {exp.category}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 font-medium text-slate-100">{exp.paid_to}</td>
                  <td className="px-4 py-3.5 text-slate-400">{exp.payment_mode}</td>
                  <td className="px-4 py-3.5 text-slate-400">{exp.recorded_by}</td>
                  <td className="px-4 py-3.5 font-mono text-slate-400">{exp.expense_date}</td>
                  <td className="px-4 py-3.5 text-right font-mono font-bold text-rose-400 text-sm">
                    ₹{exp.amount.toLocaleString('en-IN')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-6 space-y-4">
            <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <Plus className="w-5 h-5 text-amber-400" />
              <span>Record Operating Expense</span>
            </h3>

            <form onSubmit={handleAdd} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Expense Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-xs text-slate-100 focus:outline-none"
                >
                  <option value="SITE_SURVEY">Site Survey & Engineering Team</option>
                  <option value="OFFICE_RENT">Office Lease & Utilities</option>
                  <option value="TRANSPORT">Material Freight & Travel</option>
                  <option value="MARKETING">CSPDCL Awareness Camp & Flyers</option>
                  <option value="HARDWARE">Testing & Electrical Tools</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Amount (₹) *</label>
                <input
                  type="number"
                  required
                  min="1"
                  value={amount}
                  onChange={(e) => setAmount(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-xs text-slate-100 font-mono font-bold text-rose-400 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Paid To / Recipient *</label>
                <input
                  type="text"
                  required
                  value={paidTo}
                  onChange={(e) => setPaidTo(e.target.value)}
                  placeholder="e.g. Raipur Transport Service"
                  className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-xs text-slate-100 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Notes / Description</label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Details of expense voucher..."
                  className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-xs text-slate-100 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 text-xs font-semibold text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold"
                >
                  Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
