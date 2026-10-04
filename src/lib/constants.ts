/**
 * BNPS ERP v0.3 — Business Constants & Error Mappings
 * Bhumi Nidhi Powar Solution
 */

import { StandardErpErrorCode, PaymentStageType, LeadStageType, UserRoleType } from '../types/database';

export const ERP_SYSTEM = {
  NAME: 'BNPS ERP',
  VERSION: 'v0.3',
  ORGANIZATION: 'Bhumi Nidhi Powar Solution',
  PORTAL_NAME: 'PM Surya Ghar: Muft Bijli Yojana',
} as const;

export const STANDARD_COMMISSION_RATES: Record<number, { title: string; ratePercent: number }> = {
  10: { title: 'Direct Sourcing Agent (Level 10)', ratePercent: 7.0 },
  9:  { title: 'Immediate Sponsor (Level 9)', ratePercent: 1.0 },
  8:  { title: 'Second Upline Sponsor (Level 8)', ratePercent: 1.0 },
  7:  { title: 'Third Upline Sponsor (Level 7)', ratePercent: 0.5 },
  6:  { title: 'Fourth Upline Sponsor (Level 6)', ratePercent: 0.5 },
  5:  { title: 'Fifth Upline Sponsor (Level 5)', ratePercent: 0.5 },
  4:  { title: 'Sixth Upline Sponsor (Level 4)', ratePercent: 0.5 },
  3:  { title: 'Seventh Upline Sponsor (Level 3)', ratePercent: 0.5 },
  2:  { title: 'Eighth Upline Sponsor (Level 2)', ratePercent: 0.5 },
  1:  { title: 'Ninth Upline Super (Level 1)', ratePercent: 0.5 },
};

export const PAYMENT_STAGES: Record<PaymentStageType, { label: string; description: string }> = {
  FIRST_ADVANCE: {
    label: 'First Payment (Advance)',
    description: 'Received at booking / token registration',
  },
  SECOND_INSTALLATION: {
    label: 'Second Payment (Pre-Installation)',
    description: 'Received before material dispatch & installation commencement',
  },
  FINAL_NET_METER: {
    label: 'Final Payment (Net Metering)',
    description: 'Received post Net Meter installation and Discom testing',
  },
  SINGLE_LUMPSUM: {
    label: 'Single Full Payment',
    description: '100% upfront settlement',
  },
};

export const LEAD_STAGES: Record<LeadStageType, { label: string; color: string }> = {
  NEW: { label: 'New Enquiry', color: 'bg-blue-100 text-blue-800' },
  CONTACTED: { label: 'Contacted', color: 'bg-purple-100 text-purple-800' },
  INTERESTED: { label: 'Interested', color: 'bg-indigo-100 text-indigo-800' },
  DOCUMENT_PENDING: { label: 'Docs Pending', color: 'bg-amber-100 text-amber-800' },
  READY_FOR_REGISTRATION: { label: 'Ready for Portal', color: 'bg-teal-100 text-teal-800' },
  CONVERTED: { label: 'Converted to Customer', color: 'bg-emerald-100 text-emerald-800' },
  LOST: { label: 'Lost / Disqualified', color: 'bg-rose-100 text-rose-800' },
};

export const ERROR_MESSAGES: Record<StandardErpErrorCode, string> = {
  INVALID_TRANSITION: 'Invalid workflow transition: This state change violates business validation rules.',
  DUPLICATE_CUSTOMER: 'Duplicate customer: The provided mobile number or electricity consumer BP number is already registered.',
  DOCUMENTS_INCOMPLETE: 'Incomplete documents: Required government documents (Aadhaar / Electricity Bill) are not verified.',
  PAYMENT_NOT_APPROVED: 'Payment not approved: Milestone payment must be fully approved and PAID before generating commission.',
  PAYMENT_ALREADY_PAID: 'Payment immutable: Once PAID, financial values cannot be edited directly. Corrections require reversal.',
  INSTALLATION_NOT_COMPLETED: 'Installation incomplete: Project cannot be completed without Net Meter and CSPDCL inspection sign-off.',
  COMMISSION_ALREADY_GENERATED: 'Commission already distributed: Commission for this stage has already been disbursed (Idempotency Locked).',
  INSUFFICIENT_PERMISSION: 'Permission denied: You do not possess the required privilege for this administrative action.',
  RECORD_NOT_FOUND: 'Record not found: The requested entity does not exist in the database.',
  INVALID_STATUS: 'Invalid status: Selected status code does not match enterprise workflow specifications.',
  CONCURRENT_UPDATE: 'Concurrent modification conflict: This record has been updated by another user. Please refresh.',
};
