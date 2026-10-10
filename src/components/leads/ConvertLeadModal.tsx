import React, { useState, useEffect, useCallback } from 'react';
import { Lead, DocumentRecord } from '../../types/database';
import { erpStore } from '../../services/erpStore';
import { documentService } from '../../services/documentService';
import { useAuth } from '../../context/AuthContext';
import { ERROR_MESSAGES } from '../../lib/constants';
import { 
  CheckCircle2, 
  AlertCircle, 
  ArrowRight, 
  X, 
  ShieldAlert, 
  Info,
  Loader2,
  UploadCloud,
  FileCheck2,
  FileX2,
  FileText,
  Clock,
  MapPin
} from 'lucide-react';

interface ConvertLeadModalProps {
  lead: Lead | null;
  isOpen: boolean;
  onClose: () => void;
  onConversionSuccess: (customerCode: string) => void;
}

type RequiredCategory = 'electricity_bill' | 'aadhaar' | 'bank_proof' | 'noc_b1' | 'site_photo' | 'pan';

interface DocumentRequirement {
  category: RequiredCategory;
  label: string;
  description: string;
  required: boolean;
}

const DOCUMENT_REQUIREMENTS: DocumentRequirement[] = [
  {
    category: 'electricity_bill',
    label: 'Electricity Bill',
    description: 'Mandatory for CSPDCL connection verification & sanctioned load match',
    required: true,
  },
  {
    category: 'aadhaar',
    label: 'Aadhaar Card',
    description: 'Mandatory for National PM Surya Ghar beneficiary identity',
    required: true,
  },
  {
    category: 'bank_proof',
    label: 'Bank Passbook / Bank Proof',
    description: 'Mandatory for Direct Benefit Transfer (DBT) central subsidy disbursement',
    required: true,
  },
  {
    category: 'noc_b1',
    label: 'NOC / B1 Land Document',
    description: 'Mandatory roof rights / land record clearance for solar installation',
    required: true,
  },
  {
    category: 'site_photo',
    label: 'Site Photo / Location Proof',
    description: 'Mandatory geo-tagged rooftop solar installation feasibility photograph',
    required: true,
  },
  {
    category: 'pan',
    label: 'PAN Card (Optional)',
    description: 'Optional tax identification document (never blocks conversion)',
    required: false,
  },
];

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

  // Document state
  const [leadDocuments, setLeadDocuments] = useState<DocumentRecord[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [uploadingCategory, setUploadingCategory] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Refresh lead documents from authoritative backend / store
  const refreshDocuments = useCallback(async (leadId: string) => {
    setLoadingDocs(true);
    try {
      const docs = await documentService.fetchDocumentsByEntity('lead', leadId);
      setLeadDocuments(docs);
    } catch (err: any) {
      console.warn('[ConvertLeadModal] Failed to fetch documents:', err);
      const localDocs = erpStore.getDocuments({ entityType: 'lead', entityId: leadId });
      setLeadDocuments(localDocs);
    } finally {
      setLoadingDocs(false);
    }
  }, []);

  // Sync state if lead changes
  useEffect(() => {
    if (lead && isOpen) {
      setConsumerNumber(lead.consumer_number || '');
      setErrorMsg(null);
      setUploadError(null);
      refreshDocuments(lead.id);
    }
  }, [lead, isOpen, refreshDocuments]);

  if (!isOpen || !lead) return null;

  // Geographic Location Complete Validation
  const hasCompleteLocation = Boolean(
    lead.address_line?.trim() &&
    lead.district?.trim() &&
    lead.pincode?.trim() &&
    lead.tehsil?.trim() &&
    lead.block?.trim() &&
    lead.panchayat_village?.trim()
  );

  // Check required documents presence & statuses (Active/valid: UPLOADED or VERIFIED)
  const isCategoryComplete = (cat: RequiredCategory) => {
    return Boolean(
      leadDocuments.find(
        (d) => d.doc_category === cat && (d.status === 'UPLOADED' || d.status === 'VERIFIED')
      )
    );
  };

  const getCategoryDoc = (cat: RequiredCategory) => {
    return leadDocuments.find(
      (d) => d.doc_category === cat && (d.status === 'UPLOADED' || d.status === 'VERIFIED')
    );
  };

  const isElectricityBillComplete = isCategoryComplete('electricity_bill');
  const isAadhaarComplete = isCategoryComplete('aadhaar');
  const isBankProofComplete = isCategoryComplete('bank_proof');
  const isNocB1Complete = isCategoryComplete('noc_b1');
  const isSitePhotoComplete = isCategoryComplete('site_photo');

  const allRequiredDocsComplete =
    isElectricityBillComplete &&
    isAadhaarComplete &&
    isBankProofComplete &&
    isNocB1Complete &&
    isSitePhotoComplete;

  const canConvert =
    allRequiredDocsComplete &&
    hasCompleteLocation &&
    consumerNumber.trim().length > 0 &&
    !loading &&
    uploadingCategory === null;

  // Live duplicate check against Single Customer Master
  const existingCustomers = erpStore.getCustomers();
  const duplicateByMobile = existingCustomers.find((c) => c.primary_mobile === lead.mobile);
  const duplicateByConsumer = consumerNumber.trim() 
    ? existingCustomers.find((c) => c.consumer_number === consumerNumber.trim()) 
    : undefined;

  // Handle in-modal document upload
  const handleFileUpload = async (category: RequiredCategory, file: File) => {
    if (!file) return;

    setUploadingCategory(category);
    setUploadError(null);
    setErrorMsg(null);

    try {
      await documentService.uploadDocument(
        file,
        'lead',
        lead.id,
        category,
        lead.is_test
      );
      // Refresh documents to verify actual creation
      await refreshDocuments(lead.id);
    } catch (err: any) {
      console.error('[ConvertLeadModal] Upload error:', err);
      setUploadError(err.message || `Failed to upload ${category}.`);
    } finally {
      setUploadingCategory(null);
    }
  };

  const handleConvert = async () => {
    if (loading) return; // Prevent duplicate conversion on repeated clicks

    if (!consumerNumber.trim()) {
      setErrorMsg('Discom Consumer Number (BP No) is required.');
      return;
    }

    if (!hasCompleteLocation) {
      setErrorMsg('Complete geographic location hierarchy (Address, District, Tehsil, Block, Village, Pincode) is required on the lead.');
      return;
    }

    if (!allRequiredDocsComplete) {
      setErrorMsg(ERROR_MESSAGES.DOCUMENTS_INCOMPLETE);
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      // Call atomic transactional command
      const res = await erpStore.convertLeadAtomic(
        lead.id, 
        consumerNumber.trim(), 
        currentProfile?.id || 'prof-super-admin-01'
      );

      if (res.success && res.customer) {
        onConversionSuccess(res.customer.customer_code);
        onClose();
      } else {
        const code = res.error || 'INVALID_TRANSITION';
        setErrorMsg(ERROR_MESSAGES[code] || res.message || 'Conversion failed.');
      }
    } catch (err: any) {
      console.error('[ConvertLeadModal] Conversion error:', err);
      setErrorMsg(err.message || 'An unexpected error occurred during lead conversion.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-xl bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/90 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-100">Atomic Lead Conversion</h3>
              <p className="text-xs text-slate-400">Lead → Authoritative Customer Master Transition</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            disabled={loading}
            className="text-slate-400 hover:text-white p-1 disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Content */}
        <div className="p-6 space-y-4 overflow-y-auto">
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
              <div>Branch: <span className="text-slate-200">{lead.branch || 'Jaijaipur'}</span></div>
              <div>Stage: <span className="text-amber-400 font-medium">{lead.stage}</span></div>
            </div>
          </div>

          {/* Location Completeness Check */}
          <div className={`p-3 rounded-lg border text-xs ${
            hasCompleteLocation
              ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-200'
              : 'bg-rose-950/20 border-rose-500/30 text-rose-200'
          }`}>
            <div className="flex items-center justify-between">
              <span className="font-semibold flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-amber-400" />
                Geographic Location Record: {hasCompleteLocation ? 'Complete' : 'Incomplete'}
              </span>
              <span className={`text-[10px] uppercase font-mono px-2 py-0.5 rounded ${
                hasCompleteLocation ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'
              }`}>
                {hasCompleteLocation ? 'VERIFIED' : 'ACTION REQUIRED'}
              </span>
            </div>
            <div className="mt-1 text-[11px] text-slate-400">
              {lead.address_line || 'No address'}, {lead.panchayat_village || 'No village'}, {lead.block || 'No block'}, {lead.tehsil || 'No tehsil'}, {lead.district || 'No district'}, {lead.state || 'Chhattisgarh'} - {lead.pincode || 'No PIN'}
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
              disabled={loading}
              onChange={(e) => setConsumerNumber(e.target.value)}
              placeholder="e.g. 11029485731"
              className="w-full px-3.5 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-100 text-sm font-mono placeholder-slate-500 focus:outline-none focus:border-amber-400 disabled:opacity-50"
            />
            <p className="text-[11px] text-slate-500 mt-1">
              Mandatory for Discom portal registration and PM Surya Ghar subsidy tracking.
            </p>
          </div>

          {/* Mandatory Document Gate Section */}
          <div className="p-3.5 rounded-lg bg-slate-800/50 border border-slate-700 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-amber-400" />
                Required Verification Documents (5 Mandatory + 1 Optional)
              </span>
              <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-slate-700 text-slate-300">
                Gate Enforced
              </span>
            </div>

            {loadingDocs ? (
              <div className="flex items-center justify-center py-4 text-xs text-slate-400 gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
                <span>Checking document records...</span>
              </div>
            ) : (
              <div className="space-y-2">
                {DOCUMENT_REQUIREMENTS.map((req) => {
                  const doc = getCategoryDoc(req.category);
                  const isDone = isCategoryComplete(req.category);
                  const isUploading = uploadingCategory === req.category;

                  return (
                    <div 
                      key={req.category}
                      className={`p-2.5 rounded-lg border text-xs transition-colors ${
                        isDone 
                          ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-200' 
                          : req.required
                          ? 'bg-slate-900/80 border-slate-700/80 text-slate-300'
                          : 'bg-slate-900/40 border-slate-800 text-slate-400'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          {isDone ? (
                            <FileCheck2 className="w-4 h-4 text-emerald-400 shrink-0" />
                          ) : (
                            <FileX2 className={`w-4 h-4 shrink-0 ${req.required ? 'text-amber-400' : 'text-slate-500'}`} />
                          )}
                          <div className="min-w-0 flex-1">
                            <div className="font-semibold text-slate-200 flex items-center gap-1.5">
                              <span>{req.label}</span>
                              {req.required && <span className="text-rose-400">*</span>}
                            </div>
                            {isDone ? (
                              <div className="text-[11px] text-emerald-400/90 font-mono truncate flex items-center gap-1">
                                <span className="truncate">Uploaded: {doc?.file_name}</span>
                                <span className="px-1.5 py-0.2 rounded bg-emerald-500/20 text-[10px] shrink-0">
                                  {doc?.status}
                                </span>
                              </div>
                            ) : (
                              <div className="text-[11px] text-slate-400/90 truncate">
                                {req.description}
                              </div>
                            )}
                          </div>
                        </div>

                        <label className={`cursor-pointer px-2.5 py-1 rounded text-[11px] font-medium border flex items-center gap-1.5 shrink-0 transition-colors ${
                          isUploading
                            ? 'opacity-50 cursor-not-allowed bg-slate-800 border-slate-700 text-slate-400'
                            : isDone
                            ? 'bg-slate-800 hover:bg-slate-700 border-slate-600 text-slate-300'
                            : req.required
                            ? 'bg-amber-500 hover:bg-amber-400 border-amber-400 text-slate-950 font-bold'
                            : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300'
                        }`}>
                          {isUploading ? (
                            <>
                              <Loader2 className="w-3 h-3 animate-spin" />
                              <span>Uploading...</span>
                            </>
                          ) : (
                            <>
                              <UploadCloud className="w-3 h-3" />
                              <span>{isDone ? 'Replace' : 'Upload'}</span>
                            </>
                          )}
                          <input
                            type="file"
                            accept=".pdf,.jpg,.jpeg,.png"
                            disabled={uploadingCategory !== null || loading}
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleFileUpload(req.category, file);
                            }}
                          />
                        </label>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Upload Error Banner */}
            {uploadError && (
              <div className="p-2.5 rounded bg-rose-500/20 border border-rose-500/30 text-rose-300 text-xs flex gap-2 items-center">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{uploadError}</span>
              </div>
            )}
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
                  The backend RPC will cross-verify that full names match before linking, or reject conflicting associations.
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
                <li>All 5 mandatory items verified (Electricity Bill, Aadhaar, Bank Proof, NOC/B1, Site Photo)</li>
                <li>Complete geographic location hierarchy verified</li>
                <li>Authoritative Customer Master record is created or verified</li>
                <li>Customer views query lead KYC documents directly through verified relationship</li>
                <li>Lead status transitions immutably to CONVERTED</li>
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
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-800 bg-slate-900/90 shrink-0">
          <div className="text-xs text-slate-400">
            {!canConvert && (
              <span className="text-amber-400/90 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                Complete location and upload all 5 required documents
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleConvert}
              disabled={!canConvert || loading}
              className="flex items-center gap-2 px-5 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold shadow-lg shadow-emerald-500/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
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
    </div>
  );
};
