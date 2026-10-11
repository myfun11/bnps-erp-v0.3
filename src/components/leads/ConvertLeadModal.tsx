import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Lead, DocumentRecord } from '../../types/database';
import { erpStore } from '../../services/erpStore';
import { documentService } from '../../services/documentService';
import { leadService } from '../../services/leadService';
import { useAuth } from '../../context/AuthContext';
import { ERROR_MESSAGES } from '../../lib/constants';
import { 
  evaluateLeadKycMatching, 
  CORE_KYC_CATEGORIES,
  KycMatchResult
} from '../../services/kycVerificationService';
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
  MapPin,
  Sparkles,
  ChevronDown,
  ChevronUp,
  UserCheck,
  Edit3,
  Save
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
  isCoreKyc: boolean;
}

const DOCUMENT_REQUIREMENTS: DocumentRequirement[] = [
  {
    category: 'aadhaar',
    label: 'Aadhaar Card',
    description: 'Mandatory for National PM Surya Ghar beneficiary identity',
    required: true,
    isCoreKyc: true,
  },
  {
    category: 'bank_proof',
    label: 'Bank Passbook / Bank Proof',
    description: 'Mandatory for Direct Benefit Transfer (DBT) central subsidy disbursement',
    required: true,
    isCoreKyc: true,
  },
  {
    category: 'electricity_bill',
    label: 'Electricity Bill',
    description: 'Mandatory for CSPDCL connection verification & sanctioned load match',
    required: true,
    isCoreKyc: true,
  },
  {
    category: 'noc_b1',
    label: 'NOC / B1 Land Document',
    description: 'Mandatory roof rights / land record clearance for solar installation',
    required: true,
    isCoreKyc: false,
  },
  {
    category: 'site_photo',
    label: 'Site Photo / Location Proof',
    description: 'Mandatory geo-tagged rooftop solar installation feasibility photograph',
    required: true,
    isCoreKyc: false,
  },
  {
    category: 'pan',
    label: 'PAN Card',
    description: 'Mandatory for KYC identity matching against Aadhaar and bank passbook',
    required: true,
    isCoreKyc: true,
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

  // Lead Customer Identity State (Name, Father's Name, DOB)
  const [fullName, setFullName] = useState(lead?.full_name || '');
  const [fatherName, setFatherName] = useState(lead?.father_name || '');
  const [dob, setDob] = useState(lead?.dob || '');
  const [isEditingIdentity, setIsEditingIdentity] = useState(false);
  const [savingIdentity, setSavingIdentity] = useState(false);

  // Document state
  const [leadDocuments, setLeadDocuments] = useState<DocumentRecord[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [uploadingCategory, setUploadingCategory] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  
  // KYC Inspector UI state (which document's extracted info is currently open for edit/inspection)
  const [expandedDocCategory, setExpandedDocCategory] = useState<string | null>(null);
  const [docKycEdits, setDocKycEdits] = useState<{
    [category: string]: { name: string; fatherName: string; dob: string };
  }>({});

  // Refresh lead documents from authoritative backend / store
  const refreshDocuments = useCallback(async (leadId: string) => {
    setLoadingDocs(true);
    try {
      const docs = await documentService.fetchDocumentsByEntity('lead', leadId);
      setLeadDocuments(docs);
    } catch (err: any) {
      console.error('[ConvertLeadModal] Failed to fetch authoritative documents:', err);
      setLeadDocuments([]);
      setUploadError(err?.message || 'Unable to load KYC documents from Supabase. Local demo data will not be used.');
    } finally {
      setLoadingDocs(false);
    }
  }, []);

  // Sync state if lead changes
  useEffect(() => {
    if (lead && isOpen) {
      setConsumerNumber(lead.consumer_number || '');
      setFullName(lead.full_name || '');
      setFatherName(lead.father_name || '');
      setDob(lead.dob || '');
      setErrorMsg(null);
      setUploadError(null);
      setExpandedDocCategory(null);
      setDocKycEdits({});
      refreshDocuments(lead.id);

    }
  }, [lead, isOpen, refreshDocuments]);

  if (!isOpen || !lead) return null;

  // Active Lead Object for identity evaluations
  const activeLead: Lead = {
    ...lead,
    full_name: fullName.trim() || lead.full_name,
    father_name: fatherName.trim(),
    dob: dob.trim(),
  };

  // Evaluate KYC Cross-Matching
  const kycResult: KycMatchResult = evaluateLeadKycMatching(activeLead, leadDocuments);

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
  // Documents are fetched newest-first. Only the latest record for each category counts.
  // This keeps an older VERIFIED upload from bypassing a newer pending/rejected replacement.
  const getCategoryDoc = (cat: RequiredCategory) => {
    return leadDocuments.find((d) => d.doc_category === cat);
  };

  const isCategoryComplete = (cat: RequiredCategory) => {
    return getCategoryDoc(cat)?.status === 'VERIFIED';
  };

  const isElectricityBillComplete = isCategoryComplete('electricity_bill');
  const isAadhaarComplete = isCategoryComplete('aadhaar');
  const isBankProofComplete = isCategoryComplete('bank_proof');
  const isNocB1Complete = isCategoryComplete('noc_b1');
  const isSitePhotoComplete = isCategoryComplete('site_photo');
  const isPanComplete = isCategoryComplete('pan');

  const allRequiredDocsComplete =
    isElectricityBillComplete &&
    isAadhaarComplete &&
    isPanComplete &&
    isBankProofComplete &&
    isNocB1Complete &&
    isSitePhotoComplete;

  const canConvert =
    allRequiredDocsComplete &&
    hasCompleteLocation &&
    consumerNumber.trim().length > 0 &&
    kycResult.allMatch &&
    !loading &&
    uploadingCategory === null;

  // Live duplicate check against Single Customer Master
  const existingCustomers = erpStore.getCustomers();
  const duplicateByMobile = existingCustomers.find((c) => c.primary_mobile === lead.mobile);
  const duplicateByConsumer = consumerNumber.trim() 
    ? existingCustomers.find((c) => c.consumer_number === consumerNumber.trim()) 
    : undefined;

  // Save updated Lead Master Identity
  const handleSaveLeadIdentity = async () => {
    if (!fullName.trim() || !fatherName.trim() || !dob.trim()) {
      setUploadError('Name, father name and DOB are required before KYC matching.');
      return;
    }
    setSavingIdentity(true);
    setUploadError(null);
    try {
      if (leadService.isConfigured()) {
        await leadService.updateLead(lead.id, {
          full_name: fullName.trim(),
          father_name: fatherName.trim(),
          dob: dob.trim(),
        });
        if (leadDocuments.length > 0) {
          const result = await documentService.evaluateKycEntity('lead', lead.id);
          if (result.evaluation?.status === 'MISMATCH') {
            setUploadError('KYC mismatch detected. Customer conversion remains blocked.');
          }
        }
      } else {
        erpStore.updateLeadDetails(lead.id, {
          full_name: fullName.trim(),
          father_name: fatherName.trim(),
          dob: dob.trim(),
        });
        erpStore.runLeadKycAutoVerification(lead.id);
      }
      await refreshDocuments(lead.id);
      setIsEditingIdentity(false);
    } catch (err: any) {
      console.error('[ConvertLeadModal] Failed to save lead identity:', err);
      setUploadError(err?.message || 'Lead identity could not be saved to the authoritative backend.');
    } finally {
      setSavingIdentity(false);
    }
  };

  // Handle in-modal document upload
  const handleFileUpload = async (category: RequiredCategory, file: File) => {
    if (!file) return;

    setUploadingCategory(category);
    setUploadError(null);
    setErrorMsg(null);

    try {
      const uploaded = await documentService.uploadDocument(
        file,
        'lead',
        lead.id,
        category,
        lead.is_test
      );

      if (leadService.isConfigured()) {
        if (['aadhaar', 'aadhaar_front', 'pan', 'bank_proof'].includes(category)) {
          if (!uploaded?.id) throw new Error('Document uploaded but its Supabase record could not be reloaded for OCR.');
          const ocr = await documentService.extractKycDocument(uploaded.id);
          if (ocr.extraction_status !== 'EXTRACTED') {
            setUploadError(ocr.message || 'OCR needs manual review. This document is not verified.');
          }
          if ((ocr.evaluation as { status?: string } | undefined)?.status === 'MISMATCH') {
            setUploadError('KYC information does not match. Customer conversion remains blocked.');
          }
        }
      } else {
        erpStore.runLeadKycAutoVerification(lead.id);
      }

      // Refresh from Supabase after OCR / matching, never from the local store in live mode.
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
    if (!kycResult.allMatch) {
      setErrorMsg('KYC verification is pending. Customer creation is blocked until trusted document extraction matches name and father name on Aadhaar, PAN and bank passbook, and DOB on Aadhaar and PAN.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      // Call atomic transactional command
      const res = leadService.isConfigured()
        ? await leadService.convertLeadAtomic(lead.id, consumerNumber.trim(), currentProfile.id)
        : await erpStore.convertLeadAtomic(lead.id, consumerNumber.trim(), currentProfile?.id || 'demo-profile');

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
      <div className="w-full max-w-2xl bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden max-h-[94vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/90 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <span>Lead → Customer Conversion</span>
                <span className="text-[11px] font-mono font-normal px-2 py-0.5 rounded bg-amber-500/20 text-amber-300">
                  Auto-KYC Engine Active
                </span>
              </h3>
              <p className="text-xs text-slate-400">Atomic KYC Verification & Single Customer Master Transition</p>
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
          {/* Customer Master KYC Identity Card */}
          <div className="bg-slate-800/90 rounded-lg p-3.5 border border-slate-700 space-y-2.5">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-200">
                <UserCheck className="w-4 h-4 text-emerald-400" />
                <span>Customer Master KYC Identity (PM Surya Ghar DBT Basis)</span>
              </div>
              <button
                type="button"
                onClick={() => setIsEditingIdentity(!isEditingIdentity)}
                className="text-[11px] text-amber-400 hover:text-amber-300 flex items-center gap-1 font-medium cursor-pointer"
              >
                <Edit3 className="w-3 h-3" />
                <span>{isEditingIdentity ? 'Cancel' : 'Edit Identity Info'}</span>
              </button>
            </div>

            {isEditingIdentity ? (
              <div className="p-3 bg-slate-900/90 rounded-lg border border-slate-700 space-y-2.5">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Customer Full Name *</label>
                    <input
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded bg-slate-800 border border-slate-700 text-slate-100 text-xs focus:outline-none focus:border-amber-400"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Father's / Husband's Name *</label>
                    <input
                      type="text"
                      value={fatherName}
                      onChange={(e) => setFatherName(e.target.value)}
                      placeholder="Enter exact name as printed on the documents"
                      className="w-full px-2.5 py-1.5 rounded bg-slate-800 border border-slate-700 text-slate-100 text-xs focus:outline-none focus:border-amber-400"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Date of Birth (DOB) *</label>
                    <input
                      type="date"
                      value={dob}
                      onChange={(e) => setDob(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded bg-slate-800 border border-slate-700 text-slate-100 text-xs focus:outline-none focus:border-amber-400"
                    />
                  </div>
                </div>
                <div className="flex justify-end pt-1">
                  <button
                    type="button"
                    onClick={handleSaveLeadIdentity}
                    disabled={savingIdentity}
                    className="flex items-center gap-1.5 px-3 py-1 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold"
                  >
                    {savingIdentity ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                    <span>Save & Cross-Check Documents</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs pt-1 border-t border-slate-700/60">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase">Customer Name</span>
                  <span className="text-slate-100 font-semibold truncate block">{activeLead.full_name}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase">Father's Name</span>
                  <span className="text-slate-200 font-medium truncate block">{activeLead.father_name || 'Not specified'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase">DOB</span>
                  <span className="text-slate-200 font-mono text-[11px] block">{activeLead.dob || 'Not specified'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase">Mobile</span>
                  <span className="text-slate-200 font-mono text-[11px] block">{activeLead.mobile}</span>
                </div>
              </div>
            )}
          </div>

          {/* Automated KYC Cross-Matching Engine Banner */}
          <div className={`p-3.5 rounded-lg border transition-all ${
            kycResult.badgeType === 'success'
              ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-200 shadow-sm shadow-emerald-500/10'
              : kycResult.badgeType === 'warning'
              ? 'bg-amber-950/30 border-amber-500/40 text-amber-200'
              : 'bg-slate-800/60 border-slate-700 text-slate-300'
          }`}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2.5">
                {kycResult.badgeType === 'success' ? (
                  <Sparkles className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5 animate-pulse" />
                ) : kycResult.badgeType === 'warning' ? (
                  <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                ) : (
                  <Clock className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
                )}
                <div>
                  <div className="font-bold text-xs flex items-center gap-2">
                    <span>
                      {kycResult.badgeType === 'success'
                        ? 'Auto-KYC Verification 100% Successful'
                        : kycResult.badgeType === 'warning'
                        ? 'Auto-KYC Attention Required'
                        : 'Auto-KYC Cross-Matching Engine'}
                    </span>
                    <span className={`px-2 py-0.2 rounded text-[10px] font-mono uppercase font-semibold ${
                      kycResult.badgeType === 'success'
                        ? 'bg-emerald-500/20 text-emerald-300'
                        : kycResult.badgeType === 'warning'
                        ? 'bg-amber-500/20 text-amber-300'
                        : 'bg-slate-700 text-slate-300'
                    }`}>
                      {kycResult.coreDocsCount} / {kycResult.totalRequiredCoreDocs} Core Docs
                    </span>
                  </div>
                  <p className="text-[11px] mt-1 leading-relaxed opacity-95">
                    {kycResult.summaryMessage}
                  </p>
                </div>
              </div>
            </div>

            {/* Quick Status Chips for Name, Father Name, and DOB */}
            <div className="grid grid-cols-3 gap-2 mt-2.5 pt-2 border-t border-slate-700/60 text-[11px]">
              <div className="flex items-center gap-1.5">
                <span className="text-slate-400">Name Match:</span>
                {kycResult.nameMatch && kycResult.coreDocsCount > 0 ? (
                  <span className="text-emerald-400 font-semibold flex items-center gap-0.5">
                    <CheckCircle2 className="w-3 h-3" /> 100% Match
                  </span>
                ) : (
                  <span className="text-amber-400/90 font-medium">Pending / Check</span>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-slate-400">Father Name:</span>
                {kycResult.fatherNameMatch && kycResult.coreDocsCount > 0 ? (
                  <span className="text-emerald-400 font-semibold flex items-center gap-0.5">
                    <CheckCircle2 className="w-3 h-3" /> 100% Match
                  </span>
                ) : (
                  <span className="text-amber-400/90 font-medium">Pending / Check</span>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-slate-400">DOB Match:</span>
                {kycResult.dobMatch && kycResult.coreDocsCount > 0 ? (
                  <span className="text-emerald-400 font-semibold flex items-center gap-0.5">
                    <CheckCircle2 className="w-3 h-3" /> 100% Match
                  </span>
                ) : (
                  <span className="text-amber-400/90 font-medium">Pending / Check</span>
                )}
              </div>
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

          {/* Mandatory Document Gate & Auto-Verification Section */}
          <div className="p-3.5 rounded-lg bg-slate-800/50 border border-slate-700 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-amber-400" />
                Lead KYC Documents (Aadhaar, Bank Passbook, Electricity Bill, NOC, Site Photo)
              </span>
              <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-slate-700 text-slate-300">
                Gate Enforced
              </span>
            </div>

            {loadingDocs ? (
              <div className="flex items-center justify-center py-4 text-xs text-slate-400 gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
                <span>Checking document records and evaluating KYC match...</span>
              </div>
            ) : (
              <div className="space-y-2.5">
                {DOCUMENT_REQUIREMENTS.map((req) => {
                  const doc = getCategoryDoc(req.category);
                  const isDone = isCategoryComplete(req.category);
                  const isUploading = uploadingCategory === req.category;
                  const isVerified = doc?.status === 'VERIFIED';
                  const isExpanded = expandedDocCategory === req.category;

                  const currentDocKyc = docKycEdits[req.category] || {
                    name: doc?.extracted_name || '',
                    fatherName: doc?.extracted_father_name || '',
                    dob: doc?.extracted_dob || '',
                  };

                  return (
                    <div 
                      key={req.category}
                      className={`p-3 rounded-lg border text-xs transition-colors ${
                        isVerified
                          ? 'bg-emerald-950/20 border-emerald-500/40 text-emerald-200'
                          : isDone 
                          ? 'bg-emerald-950/10 border-emerald-500/20 text-emerald-300' 
                          : req.required
                          ? 'bg-slate-900/80 border-slate-700/80 text-slate-300'
                          : 'bg-slate-900/40 border-slate-800 text-slate-400'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          {isVerified ? (
                            <FileCheck2 className="w-4 h-4 text-emerald-400 shrink-0" />
                          ) : isDone ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                          ) : (
                            <FileX2 className={`w-4 h-4 shrink-0 ${req.required ? 'text-amber-400' : 'text-slate-500'}`} />
                          )}
                          <div className="min-w-0 flex-1">
                            <div className="font-semibold text-slate-200 flex items-center gap-1.5">
                              <span>{req.label}</span>
                              {req.required && <span className="text-rose-400">*</span>}
                              {req.isCoreKyc && (
                                <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-300 font-normal">
                                  Core Identity
                                </span>
                              )}
                            </div>
                            {isDone ? (
                              <div className="text-[11px] text-emerald-400/90 font-mono truncate flex items-center gap-1.5 mt-0.5">
                                <span className="truncate">File: {doc?.file_name}</span>
                                <span className={`px-1.5 py-0.2 rounded text-[10px] font-semibold shrink-0 ${
                                  isVerified
                                    ? 'bg-emerald-500/30 text-emerald-300 border border-emerald-500/40'
                                    : 'bg-amber-500/20 text-amber-300'
                                }`}>
                                  {isVerified ? 'VERIFIED (Auto KYC Matched)' : doc?.status}
                                </span>
                              </div>
                            ) : (
                              <div className="text-[11px] text-slate-400/90 truncate mt-0.5">
                                {req.description}
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {isDone && req.isCoreKyc && (
                            <button
                              type="button"
                              onClick={() => {
                                if (isExpanded) {
                                  setExpandedDocCategory(null);
                                } else {
                                  setDocKycEdits((prev) => ({
                                    ...prev,
                                    [req.category]: {
                                      name: doc?.extracted_name || activeLead.full_name,
                                      fatherName: doc?.extracted_father_name || activeLead.father_name || '',
                                      dob: doc?.extracted_dob || activeLead.dob || '',
                                    },
                                  }));
                                  setExpandedDocCategory(req.category);
                                }
                              }}
                              className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-[11px] flex items-center gap-1"
                            >
                              <span>KYC Data</span>
                              {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                            </button>
                          )}

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

                      {/* Expandable Document KYC Data Inspector & Quick Adjuster */}
                      {isExpanded && doc && (
                        <div className="mt-2.5 pt-2.5 border-t border-slate-800 bg-slate-950/40 p-2.5 rounded-lg space-y-2">
                          <div className="flex justify-between items-center text-[11px] text-slate-300">
                            <span className="font-semibold text-amber-300">
                              Extracted KYC Identity on this Document:
                            </span>

                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                            <div>
                              <label className="block text-[10px] text-slate-400">Name on Document</label>
                              <input
                                type="text"
                                value={currentDocKyc.name}
                                disabled
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setDocKycEdits((prev) => ({
                                    ...prev,
                                    [req.category]: { ...currentDocKyc, name: val },
                                  }));
                                }}
                                className="w-full px-2 py-1 rounded bg-slate-900 border border-slate-700 text-slate-100 text-[11px] focus:outline-none focus:border-amber-400"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] text-slate-400">Father's Name on Document</label>
                              <input
                                type="text"
                                value={currentDocKyc.fatherName}
                                disabled
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setDocKycEdits((prev) => ({
                                    ...prev,
                                    [req.category]: { ...currentDocKyc, fatherName: val },
                                  }));
                                }}
                                className="w-full px-2 py-1 rounded bg-slate-900 border border-slate-700 text-slate-100 text-[11px] focus:outline-none focus:border-amber-400"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] text-slate-400">DOB on Document</label>
                              <input
                                type="text"
                                value={currentDocKyc.dob}
                                disabled
                                placeholder="YYYY-MM-DD or DD/MM/YYYY"
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setDocKycEdits((prev) => ({
                                    ...prev,
                                    [req.category]: { ...currentDocKyc, dob: val },
                                  }));
                                }}
                                className="w-full px-2 py-1 rounded bg-slate-900 border border-slate-700 text-slate-100 text-[11px] focus:outline-none focus:border-amber-400"
                              />
                            </div>
                          </div>
                          <p className="text-[10px] text-amber-300">Read-only extraction preview. Auto-verification is unavailable until trusted backend OCR data is recorded.</p>
                        </div>
                      )}
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
              Automated KYC & Conversion Rules:
              <ul className="list-disc pl-4 mt-1 space-y-0.5 text-slate-300">
                <li><strong className="text-emerald-300">Automatic Document Verification:</strong> Aadhaar, Bank Passbook और Electricity Bill में Customer Name, Father Name और DOB मैच होने पर documents अपने आप VERIFIED हो जाते हैं।</li>
                <li>All 5 required items uploaded (Electricity Bill, Aadhaar, Bank Proof, NOC/B1, Site Photo)</li>
                <li>Complete geographic location hierarchy verified</li>
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
            {!canConvert ? (
              <span className="text-amber-400/90 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                Complete location and upload all 5 required documents
              </span>
            ) : (
              <span className="text-emerald-400 flex items-center gap-1 font-semibold">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Ready to Convert! All requirements satisfied
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
