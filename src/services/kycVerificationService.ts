import { Lead, DocumentRecord } from '../types/database';

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

export const CORE_KYC_CATEGORIES = [
  { category: 'aadhaar', label: 'Aadhaar Card' },
  { category: 'bank_proof', label: 'Bank Passbook / Proof' },
] as const;

/**
 * Evaluates whether customer identity across uploaded documents
 * (Aadhaar, PAN, Bank Passbook) matches the Lead customer information.
 */
export const evaluateLeadKycMatching = (
  lead: Lead,
  documents: DocumentRecord[]
): KycMatchResult => {
  const normLeadName = normalizeIdentityString(lead.full_name);
  const normLeadFather = normalizeIdentityString(lead.father_name || '');
  const normLeadDob = normalizeDobString(lead.dob || '');

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
    const backendMatched = doc.status === 'VERIFIED'
      && doc.extraction_status === 'MATCHED'
      && doc.kyc_match_status === 'MATCHED';
    if (backendMatched) backendMatchedCount++;
    if (doc.extraction_status === 'MISMATCH' || doc.kyc_match_status === 'MISMATCH') backendMismatch = true;
    if (!backendMatched && !backendMismatch) missingDocs.push(`${core.label} (pending trusted auto-verification)`);

    // Fail closed: only values actually extracted from the uploaded document may be compared.
    // Never substitute lead-form values for OCR results.
    const extractedName = doc.extracted_name || '';
    const extractedFather = doc.extracted_father_name || '';
    const extractedDob = doc.extracted_dob || '';

    const normDocName = normalizeIdentityString(extractedName);
    const normDocFather = normalizeIdentityString(extractedFather);
    const normDocDob = normalizeDobString(extractedDob);

    // Name comparison (mandatory for all 3)
    const docNameMatches = normDocName.length > 0 && normLeadName.length > 0 && normDocName === normLeadName;
    if (!docNameMatches) {
      nameMatch = false;
      mismatches.push(
        `${core.label} Name ("${extractedName || 'Missing'}") does not match Lead Name ("${lead.full_name}")`
      );
    }

    // Father name must be present and match on each identity document.
    const docFatherMatches = normLeadFather.length > 0 && normDocFather.length > 0 && normDocFather === normLeadFather;
    if (!docFatherMatches) {
      fatherNameMatch = false;
      mismatches.push(`${core.label} Father Name ("${extractedFather || 'Missing'}") does not match Lead Father Name ("${lead.father_name || 'Missing'}")`);
    }

    // Bank passbook is compared by name and father name only; DOB is intentionally ignored.
    const requiresDob = core.category !== 'bank_proof';
    const docDobMatches = !requiresDob || (normLeadDob.length > 0 && normDocDob.length > 0 && normDocDob === normLeadDob);
    if (!docDobMatches) {
      dobMatch = false;
      mismatches.push(`${core.label} DOB ("${extractedDob || 'Missing'}") does not match Lead DOB ("${lead.dob || 'Missing'}")`);
    }

    const isFullyMatched = backendMatched && docNameMatches && docFatherMatches && docDobMatches;

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
    const backendMatched = optionalPan.status === 'VERIFIED'
      && optionalPan.extraction_status === 'MATCHED'
      && optionalPan.kyc_match_status === 'MATCHED';
    optionalPanPending = !backendMatched;
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
  const allMatch = coreDocsPresent && backendMatchedCount === CORE_KYC_CATEGORIES.length
    && !optionalPanPending && nameMatch && fatherNameMatch && dobMatch && mismatches.length === 0;

  let summaryMessage = '';
  let badgeType: 'success' | 'warning' | 'pending' = 'pending';

  if (!coreDocsPresent) {
    summaryMessage = `Upload both required KYC documents (Aadhaar and Bank Passbook). PAN is optional, but if uploaded it must verify. (Pending: ${missingDocs.join(', ')})`;
    badgeType = 'pending';
  } else if (backendMismatch) {
    summaryMessage = `Backend KYC mismatch detected. Review/re-upload the mismatching document(s). ${mismatches.join('; ')}`;
    badgeType = 'warning';
  } else if (backendMatchedCount !== CORE_KYC_CATEGORIES.length) {
    summaryMessage = `Documents are uploaded, but trusted OCR matching is still pending. ${missingDocs.join(', ')}`;
    badgeType = 'pending';
  } else if (allMatch) {
    summaryMessage = `Backend auto-verification confirmed: name and father's name on Aadhaar and bank passbook, and DOB on Aadhaar. Any uploaded PAN must also match.`;
    badgeType = 'success';
  } else {
    summaryMessage = `Identity mismatch detected: ${mismatches.join('; ')}`;
    badgeType = 'warning';
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
