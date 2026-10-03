import React, { useState } from 'react';
import { Lead } from '../../types/database';
import { erpStore } from '../../services/erpStore';
import { useAuth } from '../../context/AuthContext';
import { ERROR_MESSAGES } from '../../lib/constants';
import { 
  CheckCircle, 
  AlertCircle, 
  ArrowRight, 
  X, 
  ShieldAlert, 
  Info,
  Loader2
} from 'lucide-react';

interface ConvertLeadModalProps {
  lead: Lead | null;
  isOpen: boolean;
  onClose: () => void;
  onConversionSuccess: (customerCode: string) => void;
}

export const ConvertLeadModal: React.FC<ConvertLeadModalProps> = ({
  lead,
  isOpen,
  onClose,
  onConversionSuccess,
}) => {
  const { currentProfile } = useAuth();
  const [consumerNumber, setConsumerNumber] = useState(lead?.consumer_number || '');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Sync state if lead changes
  React.useEffect(() => {
    if (lead) {
      setConsumerNumber(lead.consumer_number || '');
      setErrorMsg(null);
    }
  }, [lead]);

  if (!isOpen || !lead) return null;

  // Live duplicate check against Single Customer Master
  const existingCustomers = erpStore.getCustomers();
  const duplicateByMobile = existingCustomers.find((c) => c.primary_mobile === lead.mobile);
  const duplicateByConsumer = consumerNumber.trim() 
    ? existingCustomers.find((c) => c.consumer_number === consumerNumber.trim()) 
    : undefined;

  const handleConvert = () => {
    if (!consumerNumber.trim()) {
      setErrorMsg('Discom Consumer Number (BP No) is required.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    // Call atomic transactional command
    const res = erpStore.convertLeadAtomic(lead.id, consumerNumber.trim(), currentProfile.id);

    setLoading(false);
    if (res.success && res.customer) {
      onConversionSuccess(res.customer.customer_code);
      onClose();
    } else {
      const code = res.error || 'INVALID_TRANSITION';
      setErrorMsg(ERROR_MESSAGES[code] || res.message || 'Conversion failed.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/90">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center">
              <CheckCircle className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-100">Atomic Lead Conversion</h3>
              <p className="text-xs text-slate-400">Lead → Authoritative Customer Master Transition</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Content */}
        <div className="p-6 space-y-4">
          {/* Lead Summary Card */}
          <div className="bg-slate-800/80 rounded-lg p-3.5 border border-slate-700/80 space-y-2">
            <div className="flex justify-between items-start">
              <div>
                <div className="text-xs font-mono text-amber-400 font-semibold">{lead.lead_code}</div>
                <div className="text-sm font-bold text-slate-100">{lead.full_name}</div>
              </div>
              <span className="text-xs px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 font-mono">
                {lead.proposed_capacity_kw || 3.0} kW Solar
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs text-slate-400 pt-1 border-t border-slate-700/50">
              <div>Mobile: <span className="text-slate-200 font-mono">{lead.mobile}</span></div>
              <div>Discom: <span className="text-slate-200">{lead.discom_name}</span></div>
              <div>District: <span className="text-slate-200">{lead.district || 'Rajasthan'}</span></div>
              <div>Current Stage: <span className="text-amber-400 font-medium">{lead.stage}</span></div>
            </div>
          </div>

          {/* Consumer Number Input */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Discom Electricity Consumer Number (K-Number / CA Number) *
            </label>
            <input
              type="text"
              value={consumerNumber}
              onChange={(e) => setConsumerNumber(e.target.value)}
              placeholder="e.g. 11029485731"
              className="w-full px-3.5 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-100 text-sm font-mono placeholder-slate-500 focus:outline-none focus:border-amber-400"
            />
            <p className="text-[11px] text-slate-500 mt-1">
              This ID is mandatory for Discom portal registration and PM Surya Ghar subsidy tracking.
            </p>
          </div>

          {/* Duplicate Detection Alert (Single Customer Master Invariant) */}
          {(duplicateByMobile || duplicateByConsumer) && (
            <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex gap-2.5 items-start">
              <ShieldAlert className="w-5 h-5 shrink-0 text-amber-400 mt-0.5" />
              <div>
                <span className="font-semibold block text-amber-200">
                  Customer Master De-duplication Rule Detected:
                </span>
                This customer mobile ({duplicateByMobile?.primary_mobile}) or consumer number ({duplicateByConsumer?.consumer_number}) is already registered in Customer Master:
                <div className="font-mono text-[11px] mt-1 text-amber-300 bg-amber-950/40 p-1.5 rounded">
                  Existing Master: {duplicateByMobile?.customer_code || duplicateByConsumer?.customer_code} • {duplicateByMobile?.full_name || duplicateByConsumer?.full_name}
                </div>
                <div className="text-[11px] text-amber-400/90 mt-1">
                  No duplicate customer record will be created. This lead will be directly linked to this existing master customer record.
                </div>
              </div>
            </div>
          )}

          {/* Business Operation Invariant Info */}
          <div className="p-3 rounded-lg bg-slate-800/60 border border-slate-700 text-xs text-slate-400 flex gap-2">
            <Info className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
            <div>
              In this single atomic transaction:
              <ul className="list-disc pl-4 mt-1 space-y-0.5 text-slate-300">
                <li>Authoritative Customer Master record is verified</li>
                <li>PMSG Tracking entry (State: INITIATED) is activated</li>
                <li>Lead status is permanently transitioned to CONVERTED</li>
                <li>Audit trail record is logged immutably</li>
              </ul>
            </div>
          </div>

          {/* Error Message */}
          {errorMsg && (
            <div className="p-3 rounded-lg bg-rose-500/20 border border-rose-500/30 text-rose-300 text-xs flex gap-2 items-center">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{errorMsg}</span>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-800 bg-slate-900/90">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
          >
            Cancel
          </button>
          <button
            onClick={handleConvert}
            disabled={loading}
            className="flex items-center gap-2 px-5 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold shadow-lg shadow-emerald-500/20 transition-all disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Converting...</span>
              </>
            ) : (
              <>
                <span>Confirm & Create Customer</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
