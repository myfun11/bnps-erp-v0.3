import { Lead, DocumentRecord } from '../types/database';

/**
 * Normalizes text (e.g. name, father name) for robust Indian identity comparison.
 * Trims spaces, ignores case, strips common honorific prefixes (Shri, Smt, Mr, Mrs, Late, Dr).
 */
export const normalizeIdentityString = (input?: string | null): string => {
  if (!input) return '';
  let str = input.toLowerCase().trim();
  // Strip honorifics
  str = str.replace(/^(shri|smt|mr\.|mr|mrs\.|mrs|dr\.|dr|late|s\/o|d\/o|w\/o)\s+/i, '');
  // Collapse whitespace
  str = str.replace(/\s+/g, ' ').trim();
  return str;
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
  { category: 'pan', label: 'PAN Card' },
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

  for (const core of CORE_KYC_CATEGORIES) {
    const doc = documents.find(
      (d) => d.doc_category === core.category && (d.status === 'UPLOADED' || d.status === 'VERIFIED')
    );

    if (!doc) {
      missingDocs.push(core.label);
      continue;
    }

    coreDocsCount++;

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

    const isFullyMatched = docNameMatches && docFatherMatches && docDobMatches;

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

  // All 3 core documents must be present to achieve overall match
  const coreDocsPresent = coreDocsCount === CORE_KYC_CATEGORIES.length;
  const allMatch = coreDocsPresent && nameMatch && fatherNameMatch && dobMatch && mismatches.length === 0;

  let summaryMessage = '';
  let badgeType: 'success' | 'warning' | 'pending' = 'pending';

  if (!coreDocsPresent) {
    summaryMessage = `Upload all 3 key KYC documents (Aadhaar, PAN, Bank Passbook) and complete trusted document extraction. (Pending: ${missingDocs.join(', ')})`;
    badgeType = 'pending';
  } else if (allMatch) {
    summaryMessage = `Extracted values matched: name and father's name across Aadhaar, PAN and bank passbook; DOB on Aadhaar and PAN. Backend extraction must be trusted before auto-verification.`;
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
