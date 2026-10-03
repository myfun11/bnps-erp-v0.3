import React, { useState } from 'react';
import { AppointmentOrder } from '../../../services/userAdminData';
import { BnpsLogo } from '../../common/BnpsLogo';
import { FileText, Building2, Calendar, IndianRupee, Printer, X, Zap, Phone, Mail, Award, CheckCircle } from 'lucide-react';

interface AppointmentOrdersListProps {
  orders: AppointmentOrder[];
}

export const AppointmentOrdersList: React.FC<AppointmentOrdersListProps> = ({ orders }) => {
  const [selectedOrder, setSelectedOrder] = useState<AppointmentOrder | null>(null);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-slate-900/90 rounded-2xl p-5 border border-slate-800">
        <h3 className="text-base font-bold text-slate-100">
          Official Staff Appointment Letters & Orders
        </h3>
        <p className="text-xs text-slate-400 mt-0.5">
          Official records of executive appointment issued under the authority of Admin for Branch Managers, Operations, and Receptionists.
        </p>
      </div>

      {/* Orders List Matching 17.PNG */}
      <div className="bg-slate-900/90 rounded-2xl border border-slate-800 divide-y divide-slate-800/80 shadow-xl overflow-hidden">
        {orders.map((ord) => (
          <div
            key={ord.id}
            className="p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 hover:bg-slate-800/30 transition-colors"
          >
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/30">
                  {ord.order_no}
                </span>
                <span className="font-bold text-slate-100 text-sm">{ord.staff_name}</span>
                <span className="text-xs text-slate-400">({ord.role})</span>
              </div>

              <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400">
                <span className="flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-amber-400" />
                  <span>{ord.branch}</span>
                </span>

                <span className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-slate-500" />
                  <span>Appointed on: {ord.appointment_date}</span>
                </span>

                <span className="font-semibold text-emerald-400">
                  {ord.remuneration_text}
                </span>
              </div>
            </div>

            <button
              onClick={() => setSelectedOrder(ord)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md transition shrink-0"
            >
              <FileText className="w-4 h-4" />
              <span>View Letter</span>
            </button>
          </div>
        ))}
      </div>

      {/* Printable Appointment Letter Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 overflow-y-auto animate-fade-in print:p-0 print:bg-white">
          <div className="bg-white text-slate-900 rounded-2xl max-w-3xl w-full p-8 sm:p-10 shadow-2xl space-y-6 my-8 print:m-0 print:p-0 print:border-none print:shadow-none">
            {/* Top Modal Close / Print Action Bar */}
            <div className="flex justify-between items-center border-b pb-4 print:hidden">
              <span className="text-xs font-mono text-slate-500">
                Order: <strong className="text-slate-900">{selectedOrder.order_no}</strong>
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={handlePrint}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Print Letter</span>
                </button>
                <button
                  onClick={() => setSelectedOrder(null)}
                  className="p-1 rounded-lg hover:bg-slate-100 text-slate-500"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Official Letterhead */}
            <div className="border-b-2 border-amber-600 pb-4">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <BnpsLogo variant="full" size="sm" />
                  <div>
                    <h2 className="text-xl sm:text-2xl font-black text-slate-900 uppercase tracking-tight">
                      BHUMI NIDHI POWAR SOLUTION
                    </h2>
                    <div className="text-xs font-semibold text-slate-600">
                      Rooftop Solar & Renewable Energy Engineering Enterprise
                    </div>
                  </div>
                </div>

                <div className="text-right text-[11px] text-slate-600">
                  <div>Ref: <strong>{selectedOrder.order_no}</strong></div>
                  <div>Date: <strong>{selectedOrder.appointment_date}</strong></div>
                  <div>Head Office: Jaijaipur, C.G.</div>
                </div>
              </div>
            </div>

            {/* Title */}
            <div className="text-center space-y-1">
              <h3 className="text-lg font-black text-slate-900 uppercase tracking-wide border-b-2 border-slate-300 pb-1 inline-block">
                OFFICIAL APPOINTMENT ORDER & EXECUTIVE DEPUTATION
              </h3>
              <div className="text-xs text-slate-600">
                Pursuant to the Authority of the Board of Administration, Bhumi Nidhi Powar Solution
              </div>
            </div>

            {/* Candidate & Appointment Details */}
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs space-y-2">
              <div><strong>To:</strong> <span className="font-bold text-sm text-slate-900">{selectedOrder.staff_name}</span></div>
              <div className="grid grid-cols-2 gap-4">
                <div><strong>Designation / Role:</strong> {selectedOrder.role}</div>
                <div><strong>Operational Branch:</strong> {selectedOrder.branch}</div>
                <div><strong>Reporting Authority:</strong> {selectedOrder.reporting_to}</div>
                <div><strong>Approved Remuneration:</strong> <span className="font-bold text-emerald-800">{selectedOrder.remuneration_text}</span></div>
              </div>
            </div>

            {/* Letter Body & Terms */}
            <div className="text-xs text-slate-700 space-y-3 leading-relaxed">
              <p>
                We take immense pleasure in issuing this formal Appointment Order appointing you to the executive position of <strong>{selectedOrder.role}</strong> at <strong>{selectedOrder.branch}</strong> with effect from <strong>{selectedOrder.appointment_date}</strong>.
              </p>

              <div>
                <strong>Terms of Engagement & Key Responsibilities:</strong>
                <ul className="list-disc pl-5 space-y-1 mt-1 text-slate-600">
                  {selectedOrder.terms.map((t, idx) => (
                    <li key={idx}>{t}</li>
                  ))}
                  <li>Adherence to PM Surya Ghar: Muft Bijli Yojana regulatory compliances and DISCOM CSPDCL grid protocols.</li>
                  <li>Strict confidentiality of customer and consumer account credentials in BNPS ERP.</li>
                </ul>
              </div>

              <p>
                You are issued official login credentials on the BNPS ERP portal with role-specific access permissions. Please sign and return the duplicate copy of this letter as confirmation of your acceptance.
              </p>
            </div>

            {/* Signatures & Seal */}
            <div className="pt-6 border-t border-slate-300 grid grid-cols-2 gap-8 text-xs">
              <div className="space-y-1">
                <div className="text-slate-500 text-[10px] uppercase">For Bhumi Nidhi Powar Solution:</div>
                <div className="h-12 flex items-center">
                  <div className="border border-dashed border-amber-600 bg-amber-50 rounded px-2.5 py-1 text-[11px] font-bold text-amber-900">
                    [ AUTHORIZED APPOINTING AUTHORITY ]
                  </div>
                </div>
                <div className="font-bold text-slate-900">Managing Director / Administrator</div>
                <div className="text-slate-500 text-[10px]">Bhumi Nidhi Powar Solution (Jaijaipur, C.G.)</div>
              </div>

              <div className="space-y-1 text-right">
                <div className="text-slate-500 text-[10px] uppercase">Appointee Acceptance:</div>
                <div className="h-12 flex items-center justify-end">
                  <div className="border-b border-slate-400 w-40"></div>
                </div>
                <div className="font-bold text-slate-900">{selectedOrder.staff_name}</div>
                <div className="text-slate-500 text-[10px]">Signature & Date</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
