import { evaluateLeadKycMatching, normalizeIdentityString, normalizeDobString } from '../src/services/kycVerificationService';
import { Lead, DocumentRecord } from '../src/types/database';

console.log('=== TEST SUITE: KYC Auto-Verification & Identity Cross-Matching ===\n');

// 1. Identity Normalization Tests
console.log('--- Test 1: Identity string normalization ---');
const n1 = normalizeIdentityString('Shri Rameshwar Prasad Patel');
const n2 = normalizeIdentityString('rameshwar prasad patel');
const n3 = normalizeIdentityString('Mr. Rameshwar Prasad Patel ');
console.log(`n1: "${n1}", n2: "${n2}", n3: "${n3}"`);
if (n1 === 'rameshwar prasad patel' && n2 === 'rameshwar prasad patel' && n3 === 'rameshwar prasad patel') {
  console.log('PASS: Normalization correctly strips prefixes and normalizes whitespace & casing.');
} else {
  console.error('FAIL: Normalization mismatch');
  process.exit(1);
}

// 2. DOB Normalization Tests
console.log('\n--- Test 2: DOB normalization ---');
const dob1 = normalizeDobString('1985-04-12');
const dob2 = normalizeDobString('12/04/1985');
const dob3 = normalizeDobString('12-04-1985');
console.log(`dob1: ${dob1}, dob2: ${dob2}, dob3: ${dob3}`);
if (dob1 === '1985-04-12' && dob2 === '1985-04-12' && dob3 === '1985-04-12') {
  console.log('PASS: DOB normalized accurately across ISO and DD/MM/YYYY formats.');
} else {
  console.error('FAIL: DOB normalization failed');
  process.exit(1);
}

// 3. Email Validation Regex Test
console.log('\n--- Test 3: Email validation regex ---');
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const validEmails = ['rameshwar.solar@gmail.com', 'test.agent@bnps.in', 'agent_42@sub.domain.co'];
const invalidEmails = ['plainaddress', '@missingusername.com', 'username@.com', 'user name@space.com', ''];
for (const email of validEmails) {
  if (!EMAIL_REGEX.test(email)) {
    console.error(`FAIL: Valid email ${email} rejected!`);
    process.exit(1);
  }
}
for (const email of invalidEmails) {
  if (EMAIL_REGEX.test(email)) {
    console.error(`FAIL: Invalid email ${email} accepted!`);
    process.exit(1);
  }
}
console.log('PASS: Email validation regex correctly accepts valid emails and rejects malformed addresses.');

// 4. Test Lead KYC Evaluation: 100% Match Scenario
console.log('\n--- Test 4: Positive Case - All documents (Aadhaar, Bank Passbook, Electricity Bill) match Lead info ---');
const testLead: Lead = {
  id: 'lead-test-01',
  lead_code: 'LD-2602-0099',
  full_name: 'Bhagwati Prasad Verma',
  father_name: 'Santosh Kumar Verma',
  dob: '1982-08-20',
  mobile: '9876543210',
  discom_name: 'CSPDCL',
  stage: 'NEW',
  is_test: true,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

const matchingDocuments: DocumentRecord[] = [
  {
    id: 'doc-aadhaar-01',
    entity_type: 'lead',
    entity_id: 'lead-test-01',
    doc_category: 'aadhaar',
    file_path: 'lead/test/aadhaar.pdf',
    file_name: 'Aadhaar.pdf',
    mime_type: 'application/pdf',
    status: 'VERIFIED',
    auto_verified: true,
    extracted_name: 'Bhagwati Prasad Verma',
    extracted_father_name: 'Santosh Kumar Verma',
    extracted_dob: '20/08/1982',
    is_test: true,
    created_at: new Date().toISOString(),
  },
  {
    id: 'doc-bank-01',
    entity_type: 'lead',
    entity_id: 'lead-test-01',
    doc_category: 'bank_proof',
    file_path: 'lead/test/bank.pdf',
    file_name: 'Bank_Passbook.pdf',
    mime_type: 'application/pdf',
    status: 'VERIFIED',
    auto_verified: true,
    extracted_name: 'Shri Bhagwati Prasad Verma',
    extracted_father_name: 'Santosh Kumar Verma',
    is_test: true,
    created_at: new Date().toISOString(),
  },
  {
    id: 'doc-elec-01',
    entity_type: 'lead',
    entity_id: 'lead-test-01',
    doc_category: 'electricity_bill',
    file_path: 'lead/test/elec.pdf',
    file_name: 'CSPDCL_Electricity_Bill.pdf',
    mime_type: 'application/pdf',
    status: 'VERIFIED',
    auto_verified: true,
    extracted_name: 'BHAGWATI PRASAD VERMA',
    extracted_father_name: 'Santosh Kumar Verma',
    is_test: true,
    created_at: new Date().toISOString(),
  },
];

const resultMatch = evaluateLeadKycMatching(testLead, matchingDocuments);
console.log('Result for matching documents:', {
  allMatch: resultMatch.allMatch,
  nameMatch: resultMatch.nameMatch,
  fatherNameMatch: resultMatch.fatherNameMatch,
  dobMatch: resultMatch.dobMatch,
  coreDocsCount: resultMatch.coreDocsCount,
  badgeType: resultMatch.badgeType,
  summaryMessage: resultMatch.summaryMessage,
});

if (resultMatch.allMatch && resultMatch.nameMatch && resultMatch.fatherNameMatch && resultMatch.dobMatch && resultMatch.badgeType === 'success') {
  console.log('PASS: Positive matching scenario successfully evaluated and verified!');
} else {
  console.error('FAIL: Positive matching failed', resultMatch);
  process.exit(1);
}

// 5. Test Negative Case: Name Mismatch on Electricity Bill
console.log('\n--- Test 5: Negative Case - Name Mismatch on Electricity Bill ---');
const mismatchingDocuments: DocumentRecord[] = [
  ...matchingDocuments.slice(0, 2),
  {
    ...matchingDocuments[2],
    extracted_name: 'Ramesh Kumar Verma', // Mismatch!
  },
];
const resultMismatch = evaluateLeadKycMatching(testLead, mismatchingDocuments);
console.log('Result for mismatched name on electricity bill:', {
  allMatch: resultMismatch.allMatch,
  nameMatch: resultMismatch.nameMatch,
  mismatches: resultMismatch.mismatches,
  badgeType: resultMismatch.badgeType,
});
if (!resultMismatch.allMatch && !resultMismatch.nameMatch && resultMismatch.badgeType === 'warning') {
  console.log('PASS: Electricity bill name mismatch blocked auto-verification as expected.');
} else {
  console.error('FAIL: Mismatch was not caught', resultMismatch);
  process.exit(1);
}

// 6. Test Negative Case: Missing Document (e.g. Electricity Bill not yet uploaded)
console.log('\n--- Test 6: Negative Case - Missing Core Document ---');
const missingOneDoc = matchingDocuments.slice(0, 2); // only Aadhaar + Bank
const resultMissing = evaluateLeadKycMatching(testLead, missingOneDoc);
console.log('Result for missing electricity bill:', {
  allMatch: resultMissing.allMatch,
  missingDocs: resultMissing.missingDocs,
  badgeType: resultMissing.badgeType,
});
if (!resultMissing.allMatch && resultMissing.badgeType === 'pending') {
  console.log('PASS: Missing core document keeps status pending and blocks conversion.');
} else {
  console.error('FAIL: Missing document did not block conversion', resultMissing);
  process.exit(1);
}

// 7. Test Negative Case: Father Name Mismatch
console.log('\n--- Test 7: Negative Case - Father Name Mismatch ---');
const fatherMismatchDocs: DocumentRecord[] = [
  {
    ...matchingDocuments[0],
    extracted_father_name: 'Gopal Verma', // Different father name!
  },
  matchingDocuments[1],
  matchingDocuments[2],
];
const resultFatherMismatch = evaluateLeadKycMatching(testLead, fatherMismatchDocs);
console.log('Result for father name mismatch:', {
  allMatch: resultFatherMismatch.allMatch,
  fatherNameMatch: resultFatherMismatch.fatherNameMatch,
  mismatches: resultFatherMismatch.mismatches,
});
if (!resultFatherMismatch.allMatch && !resultFatherMismatch.fatherNameMatch) {
  console.log('PASS: Father name mismatch blocked auto-verification.');
} else {
  console.error('FAIL: Father name mismatch not caught', resultFatherMismatch);
  process.exit(1);
}

// 8. Test Negative Case: DOB Mismatch
console.log('\n--- Test 8: Negative Case - DOB Mismatch ---');
const dobMismatchDocs: DocumentRecord[] = [
  {
    ...matchingDocuments[0],
    extracted_dob: '1990-01-01', // Different DOB!
  },
  matchingDocuments[1],
  matchingDocuments[2],
];
const resultDobMismatch = evaluateLeadKycMatching(testLead, dobMismatchDocs);
console.log('Result for DOB mismatch:', {
  allMatch: resultDobMismatch.allMatch,
  dobMatch: resultDobMismatch.dobMatch,
  mismatches: resultDobMismatch.mismatches,
});
if (!resultDobMismatch.allMatch && !resultDobMismatch.dobMatch) {
  console.log('PASS: DOB mismatch blocked auto-verification.');
} else {
  console.error('FAIL: DOB mismatch not caught', resultDobMismatch);
  process.exit(1);
}

console.log('\n=== ALL TARGETED TESTS PASSED ===');
