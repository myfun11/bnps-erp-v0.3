import React, { useState } from 'react';
import { Customer } from '../../types/database';
import { erpStore } from '../../services/erpStore';
import { useAuth } from '../../context/AuthContext';
import { 
  X, 
  User, 
  Phone, 
  MapPin, 
  FileText, 
  Zap, 
  ShieldCheck, 
  ExternalLink,
  Edit2,
  CheckCircle2,
  AlertCircle,
  Lock
} from 'lucide-react';

interface CustomerDetailDrawerProps {
  customer: Customer | null;
  isOpen: boolean;
  onClose: () => void;
}

export const CustomerDetailDrawer: React.FC<CustomerDetailDrawerProps> = ({
  customer,
  isOpen,
  onClose,
}) => {
  const { currentProfile, userRole, hasPermission } = useAuth();
  const [editingPmsg, setEditingPmsg] = useState(false);
  const [portalAppNo, setPortalAppNo] = useState('');
  const [saving, setSaving] = useState(false);

  if (!isOpen || !customer) return null;

  const pmsg = erpStore.getPmsgByCustomerId(customer.id);
  const isFinalized = Boolean(pmsg && (pmsg.portal_application_no || pmsg.stage !== 'INITIATED'));
  const canCreatePmsg = hasPermission('pmsg.create');

  const handleCreatePmsg = async () => {
    if (!canCreatePmsg || pmsg || saving) return;

    setSaving(true);

    const result = await erpStore.createPmsgTracking(
      customer.id,
      currentProfile.id
    );

    setSaving(false);

    if (!result.success) {
      console.error('[CustomerDetailDrawer] PMSG registration failed:', result.error);
    }
  };

  const handleSavePmsg = async () => {
    if (portalAppNo.trim() && !isFinalized) {
      setSaving(true);
      const result = await erpStore.updatePmsgTracking(
        customer.id,
        {
          portal_application_no: portalAppNo.trim(),
          stage: 'APPLICATION_SUBMITTED',
          application_submission_date: new Date().toISOString().split('T')[0],
        },
        currentProfile.id
      );
      setSaving(false);
      if (!result.success) {
        return;
      }
      setEditingPmsg(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-950/60 backdrop-blur-sm animate-fade-in flex justify-end">
      <div className="w-full max-w-xl bg-slate-900 border-l border-slate-800 h-full flex flex-col shadow-2xl overflow-y-auto">
        {/* Drawer Header */}
        <div className="p-6 border-b border-slate-800 bg-slate-900/90 flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-semibold border border-amber-500/30">
                {customer.customer_code}
              </span>
              <span className="text-xs px-2 py-0.5 rounded-full font-mono bg-emerald-500/20 text-emerald-400">
                {customer.lifecycle_status}
              </span>
            </div>
            <h3 className="text-lg font-bold text-slate-100 mt-2">{customer.full_name}</h3>
            <p className="text-xs text-slate-400">Authoritative Single Master Record • ID: {customer.id}</p>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Drawer Body */}
        <div className="p-6 space-y-6 flex-1">
          {/* Contact & Location Block */}
          <div className="bg-slate-800/60 rounded-xl p-4 border border-slate-700/60 space-y-3">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-amber-400" />
              <span>Contact & Identity</span>
            </h4>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-slate-400 block">Primary Mobile</span>
                <span className="text-slate-100 font-mono font-medium">{customer.primary_mobile}</span>
              </div>
              <div>
                <span className="text-slate-400 block">Alternate Mobile</span>
                <span className="text-slate-100 font-mono">{customer.alternate_mobile || 'None'}</span>
              </div>
              <div>
                <span className="text-slate-400 block">Email Address</span>
                <span className="text-slate-100">{customer.email || 'None'}</span>
              </div>
              <div>
                <span className="text-slate-400 block">Aadhaar (Masked)</span>
                <span className="text-slate-100 font-mono">{customer.aadhaar_masked || 'XXXX-XXXX-Verified'}</span>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-700/40 text-xs">
              <span className="text-slate-400 block">Installation Address</span>
              <span className="text-slate-200 mt-0.5 block">
                {customer.installation_address}, {customer.district}, {customer.state} - {customer.pincode}
              </span>
            </div>
          </div>

          {/* Electricity & Discom Connection */}
          <div className="bg-slate-800/60 rounded-xl p-4 border border-slate-700/60 space-y-3">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span>Discom Electricity Account</span>
            </h4>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-slate-400 block">Distribution Company</span>
                <span className="text-slate-100 font-semibold">{customer.discom_name}</span>
              </div>
              <div>
                <span className="text-slate-400 block">Consumer Number (CA/K-No)</span>
                <span className="text-amber-400 font-mono font-bold">{customer.consumer_number}</span>
              </div>
            </div>
          </div>

          {/* PM Surya Ghar Operational State Tracking */}
          <div className="bg-slate-800/60 rounded-xl p-4 border border-slate-700/60 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <ExternalLink className="w-3.5 h-3.5 text-amber-400" />
                <span>PM Surya Ghar Portal Tracking</span>
              </h4>
              {pmsg && !editingPmsg && (
                isFinalized ? (
                  <span className="text-[11px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center gap-1 font-mono">
                    <Lock className="w-3 h-3 text-emerald-400" />
                    <span>Portal Submitted (Read-Only)</span>
                  </span>
                ) : (
                  <button
                    onClick={() => {
                      setPortalAppNo(pmsg.portal_application_no || '');
                      setEditingPmsg(true);
                    }}
                    className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1"
                  >
                    <Edit2 className="w-3 h-3" />
                    <span>Update Portal No</span>
                  </button>
                )
              )}
            </div>

            {pmsg ? (
              <div className="space-y-3 text-xs">
                {editingPmsg ? (
                  <div className="p-3 bg-slate-900/90 rounded-lg border border-slate-700 space-y-2">
                    <label className="text-[11px] font-semibold text-slate-300 block">
                      National Portal Application Number
                    </label>
                    <input
                      type="text"
                      value={portalAppNo}
                      onChange={(e) => setPortalAppNo(e.target.value)}
                      placeholder="e.g. CG-CSPDCL-2026-XXXXX"
                      className="w-full px-3 py-1.5 rounded bg-slate-800 border border-slate-700 text-xs font-mono text-slate-100 focus:outline-none focus:border-amber-400"
                    />
                    <div className="flex justify-end gap-2 pt-1">
                      <button
                        onClick={() => setEditingPmsg(false)}
                        className="px-2.5 py-1 text-xs text-slate-400 hover:text-white"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleSavePmsg}
                        className="px-3 py-1 text-xs bg-amber-500 text-slate-950 font-bold rounded"
                      >
                        Save & Sync
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <span className="text-slate-400 block">Portal Application No</span>
                      <span className="text-slate-100 font-mono font-semibold">
                        {pmsg.portal_application_no || 'Pending Portal Submission'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Tracking Stage</span>
                      <span className="text-amber-300 font-medium font-mono">{pmsg.stage}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Capacity Registered</span>
                      <span className="text-slate-100">{pmsg.registered_capacity_kw ? `${pmsg.registered_capacity_kw} kW` : 'Not entered'}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Govt Subsidy Eligible</span>
                      <span className="text-emerald-400 font-semibold font-mono">
                        ₹{pmsg.subsidy_amount_eligible > 0 ? pmsg.subsidy_amount_eligible.toLocaleString('en-IN') : 'Not calculated'}
                      </span>
                    </div>
                  </div>
                )}

                {pmsg.portal_remarks && (
                  <p className="text-[11px] text-slate-400 bg-slate-900/60 p-2 rounded border border-slate-700/40">
                    Remarks: {pmsg.portal_remarks}
                  </p>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-between gap-3 rounded-lg border border-dashed border-slate-700 bg-slate-900/40 px-3 py-3">
                <div>
                  <p className="text-xs text-slate-300 font-medium">PM Surya Ghar registration not initiated</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Registration creates the initial PMSG tracking record only.
                  </p>
                </div>

                {canCreatePmsg && (
                  <button
                    type="button"
                    onClick={handleCreatePmsg}
                    disabled={saving}
                    className="shrink-0 px-3 py-1.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/30 hover:bg-amber-500/20 disabled:opacity-50 disabled:cursor-not-allowed text-xs font-semibold"
                  >
                    {saving ? 'Registering...' : 'Register on PM Surya Ghar'}
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Master Rule Verification Invariant Note */}
          <div className="p-3.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex gap-2.5 items-start">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400 mt-0.5" />
            <div>
              <span className="font-semibold block text-emerald-200">Single Authoritative Customer Master</span>
              This Customer ID is the authoritative single identity across BNPS ERP. PM Surya Ghar portal registration, solar installation, bank loan processing, and commissions all reference this master record.
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/90 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
