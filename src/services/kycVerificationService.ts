import { Lead, DocumentRecord } from '../types/database';
import { isSupabaseConfigured } from '../lib/supabaseClient';

/**
 * Normalizes text (e.g. name, father name) for robust Indian identity comparison.
 * Trims spaces, ignores case, strips common honorific prefixes (Shri, Smt, Mr, Mrs, Late, Dr).
 */
export const normalizeIdentityString = (input?: string | null): string => {
  if (!input) return '';
  // Mirror the database normalizer: punctuation becomes spaces before honorific stripping.
  let str = input.toLowerCase().trim().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  str = str.replace(/^(shri|smt|mr|mrs|ms|dr|late|s o|d o|w o)\s+/u, '');
  return str.replace(/\s+/g, ' ').trim();
};

/**
 * Normalizes dates to YYYY-MM-DD for standard comparison.
 * Supports:
 * - YYYY-MM-DD
 * - DD/MM/YYYY or DD-MM-YYYY
 * - DD.MM.YYYY
 */
export const normalizeDobString = (input?: string | null): string => {
  if (!input) return '';
  const trimmed = input.trim();
  
  // Format: YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }
  
  // Format: DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
  const dmyMatch = trimmed.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
  if (dmyMatch) {
    const day = dmyMatch[1].padStart(2, '0');
    const month = dmyMatch[2].padStart(2, '0');
    const year = dmyMatch[3];
    return `${year}-${month}-${day}`;
  }

  // Fallback Date parser
  const parsed = new Date(trimmed);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().split('T')[0];
  }

  return trimmed;
};

export interface KycFieldComparison {
  value: string;
  expected: string;
  matches: boolean;
}

export interface DocumentKycExtraction {
  categoryId: string;
  categoryLabel: string;
  docRecord?: DocumentRecord;
  name: KycFieldComparison;
  fatherName: KycFieldComparison;
  dob: KycFieldComparison;
  isFullyMatched: boolean;
}

export interface KycMatchResult {
  allMatch: boolean;
  nameMatch: boolean;
  fatherNameMatch: boolean;
  dobMatch: boolean;
  coreDocsCount: number;
  totalRequiredCoreDocs: number;
  missingDocs: string[];
  mismatches: string[];
  docExtractions: DocumentKycExtraction[];
  summaryMessage: string;
  badgeType: 'success' | 'warning' | 'pending';
}

/**
 * All core identity documents required for lead conversion KYC cross-matching:
 * 1. Aadhaar Card (Customer Name, Father Name, DOB)
 * 2. Bank Passbook / Proof (Account-holder Name, Father Name)
 * 3. Electricity Bill (Consumer / Customer Name, Father Name if present)
 */
export const CORE_KYC_CATEGORIES = [
  { category: 'aadhaar', label: 'Aadhaar Card' },
  { category: 'bank_proof', label: 'Bank Passbook / Proof' },
  { category: 'electricity_bill', label: 'Electricity Bill' },
] as const;

/**
 * Evaluates whether customer identity across uploaded documents
 * (Aadhaar, Bank Passbook, Electricity Bill, and optional PAN)
 * matches the Lead customer information (Name, Father Name, DOB) and matches each other.
 */
export const evaluateLeadKycMatching = (
  lead: Lead,
  documents: DocumentRecord[]
): KycMatchResult => {
  const normLeadName = normalizeIdentityString(lead.full_name);
  const normLeadFather = normalizeIdentityString(lead.father_name || '');
  const normLeadDob = normalizeDobString(lead.dob || '');
  const isLive = isSupabaseConfigured;

  const docExtractions: DocumentKycExtraction[] = [];
  const missingDocs: string[] = [];
  const mismatches: string[] = [];

  let nameMatch = true;
  let fatherNameMatch = true;
  let dobMatch = true;
  let coreDocsCount = 0;
  let backendMatchedCount = 0;
  let backendMismatch = false;

  for (const core of CORE_KYC_CATEGORIES) {
    // The document list is newest-first; the newest upload is authoritative even if rejected/pending.
    const doc = documents.find((d) => d.doc_category === core.category);

    if (!doc || doc.status === 'REJECTED') {
      missingDocs.push(core.label);
      continue;
    }

    coreDocsCount++;

    const backendMatched = isLive
      ? (doc.status === 'VERIFIED' && doc.extraction_status === 'MATCHED' && doc.kyc_match_status === 'MATCHED')
      : (doc.status === 'VERIFIED' || doc.auto_verified === true);

    if (backendMatched) backendMatchedCount++;
    if (doc.extraction_status === 'MISMATCH' || doc.kyc_match_status === 'MISMATCH') backendMismatch = true;
    if (isLive && !backendMatched && !backendMismatch) {
      missingDocs.push(`${core.label} (pending trusted auto-verification)`);
    }

    // Extracted values from document OCR / metadata
    const extractedName = doc.extracted_name || '';
    const extractedFather = doc.extracted_father_name || '';
    const extractedDob = doc.extracted_dob || '';

    const normDocName = normalizeIdentityString(extractedName);
    const normDocFather = normalizeIdentityString(extractedFather);
    const normDocDob = normalizeDobString(extractedDob);

    // 1. Name comparison: Customer name is mandatory across all 3 documents
    const docNameMatches = normDocName.length > 0 && normLeadName.length > 0 && normDocName === normLeadName;
    if (!docNameMatches) {
      nameMatch = false;
      mismatches.push(
        `${core.label} Name ("${extractedName || 'Missing'}") does not match Lead Name ("${lead.full_name}")`
      );
    }

    // 2. Father name comparison:
    // Mandatory on Aadhaar. On Bank Passbook and Electricity Bill, if printed/extracted, it must match.
    const requiresFatherOnDoc = core.category === 'aadhaar';
    const docFatherMatches = normDocFather.length > 0
      ? (normLeadFather.length > 0 && normDocFather === normLeadFather)
      : (!requiresFatherOnDoc);

    if (!docFatherMatches) {
      fatherNameMatch = false;
      mismatches.push(
        `${core.label} Father Name ("${extractedFather || 'Missing'}") does not match Lead Father Name ("${lead.father_name || 'Missing'}")`
      );
    }

    // 3. DOB comparison:
    // Mandatory on Aadhaar. Bank passbooks and Electricity bills do not print customer DOB.
    const requiresDobOnDoc = core.category === 'aadhaar';
    const docDobMatches = normDocDob.length > 0
      ? (normLeadDob.length > 0 && normDocDob === normLeadDob)
      : (!requiresDobOnDoc);

    if (!docDobMatches) {
      dobMatch = false;
      mismatches.push(
        `${core.label} DOB ("${extractedDob || 'Missing'}") does not match Lead DOB ("${lead.dob || 'Missing'}")`
      );
    }

    const isFullyMatched = (isLive ? backendMatched : true) && docNameMatches && docFatherMatches && docDobMatches;

    docExtractions.push({
      categoryId: core.category,
      categoryLabel: core.label,
      docRecord: doc,
      name: {
        value: extractedName,
        expected: lead.full_name,
        matches: docNameMatches,
      },
      fatherName: {
        value: extractedFather,
        expected: lead.father_name || '',
        matches: docFatherMatches,
      },
      dob: {
        value: extractedDob,
        expected: lead.dob || '',
        matches: docDobMatches,
      },
      isFullyMatched,
    });
  }

  // PAN is optional for lead conversion. If supplied, it must still pass trusted
  // OCR and match the lead identity; a rejected optional PAN is ignored.
  const optionalPan = documents.find((d) => d.doc_category === 'pan');
  let optionalPanPending = false;
  if (optionalPan && optionalPan.status !== 'REJECTED') {
    const backendMatched = isLive
      ? (optionalPan.status === 'VERIFIED' && optionalPan.extraction_status === 'MATCHED' && optionalPan.kyc_match_status === 'MATCHED')
      : (optionalPan.status === 'VERIFIED' || optionalPan.auto_verified === true);

    optionalPanPending = isLive && !backendMatched;
    if (optionalPan.extraction_status === 'MISMATCH' || optionalPan.kyc_match_status === 'MISMATCH') {
      backendMismatch = true;
    }

    const extractedName = optionalPan.extracted_name || '';
    const extractedFather = optionalPan.extracted_father_name || '';
    const extractedDob = optionalPan.extracted_dob || '';

    const panNameMatches = normalizeIdentityString(extractedName) === normLeadName && normLeadName.length > 0;
    const panFatherMatches = normalizeIdentityString(extractedFather) === normLeadFather && normLeadFather.length > 0;
    const panDobMatches = normalizeDobString(extractedDob) === normLeadDob && normLeadDob.length > 0;

    if (!panNameMatches) { nameMatch = false; mismatches.push('Optional PAN name does not match lead name.'); }
    if (!panFatherMatches) { fatherNameMatch = false; mismatches.push('Optional PAN father name does not match lead father name.'); }
    if (!panDobMatches) { dobMatch = false; mismatches.push('Optional PAN DOB does not match lead DOB.'); }
    if (optionalPanPending) missingDocs.push('Optional PAN (uploaded; trusted verification pending)');

    docExtractions.push({
      categoryId: 'pan',
      categoryLabel: 'PAN Card (optional)',
      docRecord: optionalPan,
      name: { value: extractedName, expected: lead.full_name, matches: panNameMatches },
      fatherName: { value: extractedFather, expected: lead.father_name || '', matches: panFatherMatches },
      dob: { value: extractedDob, expected: lead.dob || '', matches: panDobMatches },
      isFullyMatched: backendMatched && panNameMatches && panFatherMatches && panDobMatches,
    });
  }

  const coreDocsPresent = coreDocsCount === CORE_KYC_CATEGORIES.length;
  const allMatch = coreDocsPresent
    && (!isLive || backendMatchedCount === CORE_KYC_CATEGORIES.length)
    && !optionalPanPending
    && nameMatch
    && fatherNameMatch
    && dobMatch
    && mismatches.length === 0;

  let summaryMessage = '';
  let badgeType: 'success' | 'warning' | 'pending' = 'pending';

  if (!coreDocsPresent) {
    summaryMessage = `Upload all 3 required KYC documents: Aadhaar, Bank Passbook, and Electricity Bill. (Pending: ${missingDocs.join(', ')})`;
    badgeType = 'pending';
  } else if (backendMismatch || mismatches.length > 0) {
    summaryMessage = `Identity mismatch detected: ${mismatches.join('; ')}`;
    badgeType = 'warning';
  } else if (isLive && backendMatchedCount !== CORE_KYC_CATEGORIES.length) {
    summaryMessage = `Documents are uploaded, but trusted OCR matching is still pending. ${missingDocs.join(', ')}`;
    badgeType = 'pending';
  } else if (allMatch) {
    summaryMessage = `Auto-KYC Verification 100% Successful: Customer Name, Father Name, and DOB match across all documents (Aadhaar, Bank Passbook, Electricity Bill). Documents are automatically verified!`;
    badgeType = 'success';
  } else {
    summaryMessage = `Verification pending inspection.`;
    badgeType = 'pending';
  }

  return {
    allMatch,
    nameMatch,
    fatherNameMatch,
    dobMatch,
    coreDocsCount,
    totalRequiredCoreDocs: CORE_KYC_CATEGORIES.length,
    missingDocs,
    mismatches,
    docExtractions,
    summaryMessage,
    badgeType,
  };
};
