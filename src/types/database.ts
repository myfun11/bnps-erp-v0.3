/**
 * BNPS ERP v0.3 — Canonical Database & Domain Model Types
 * Architecture: PostgreSQL / Supabase
 * Business: Bhumi Nidhi Powar Solution (PM Surya Ghar Rooftop Solar)
 */

export type UserRoleType = 
  | 'super_admin'
  | 'branch_manager'
  | 'operational_manager'
  | 'receptionist'
  | 'backoffice'
  | 'agent'
  | 'office_admin'
  | 'accountant'
  | 'field_officer'
  | 'technician';

export type BranchLocation = 
  | 'Jaijaipur'
  | 'Janjgir-Champa'
  | 'Sakti'
  | 'Raigarh'
  | 'Korba'
  | 'Bilaspur'
  | 'Raipur'
  | 'Basana';

export type LeadStageType = 
  | 'NEW'
  | 'CONTACTED'
  | 'INTERESTED'
  | 'DOCUMENT_PENDING'
  | 'READY_FOR_REGISTRATION'
  | 'CONVERTED'
  | 'LOST';

export type CustomerLifecycleType = 
  | 'UNREGISTERED'
  | 'REGISTERED'
  | 'INSTALLED'
  | 'COMMISSIONED'
  | 'INACTIVE';

export type PmsgStageType = 
  | 'INITIATED'
  | 'APPLICATION_SUBMITTED'
  | 'DOCUMENT_VERIFIED'
  | 'FEASIBILITY_APPROVED'
  | 'VENDOR_SELECTED'
  | 'SUBSIDY_CLAIMED'
  | 'SUBSIDY_DISBURSED'
  | 'REJECTED';

export type ProjectStatusType = 
  | 'PLANNING'
  | 'SITE_SURVEY'
  | 'APPROVED'
  | 'MATERIAL_DISPATCHED'
  | 'INSTALLATION_IN_PROGRESS'
  | 'INSTALLATION_COMPLETED'
  | 'NET_METERING_PENDING'
  | 'NET_METER_INSTALLED'
  | 'COMPLETED'
  | 'CANCELLED';

export type PaymentStageType = 
  | 'FIRST_ADVANCE'
  | 'SECOND_INSTALLATION'
  | 'FINAL_NET_METER'
  | 'SINGLE_LUMPSUM';

export type PaymentStatusType = 
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'PAID'
  | 'REVERSED';

export type LoanStatusType = 
  | 'NOT_REQUIRED'
  | 'APPLIED'
  | 'DOCUMENTS_SUBMITTED'
  | 'SANCTIONED'
  | 'DISBURSED'
  | 'REJECTED';

export type DocStatusType = 
  | 'UPLOADED'
  | 'VERIFIED'
  | 'REJECTED';

export type PayoutStatusType = 
  | 'DRAFT'
  | 'APPROVED'
  | 'PROCESSED'
  | 'REVERSED';

// Table Models
export interface Profile {
  id: string;
  auth_user_id?: string;
  full_name: string;
  email?: string;
  phone: string;
  role: UserRoleType;
  branch?: BranchLocation;
  employee_code?: string;
  login_password?: string;
  is_active: boolean;
  is_test: boolean;
  created_at: string;
  updated_at: string;
}

export interface Agent {
  id: string;
  profile_id: string;
  agent_code: string;
  branch?: BranchLocation;
  sponsor_agent_id?: string;
  hierarchy_level: number;
  pan_number?: string;
  aadhaar_masked?: string;
  bank_account_no?: string;
  bank_name?: string;
  bank_ifsc?: string;
  tds_percentage: number;
  total_commission_earned: number;
  total_commission_paid: number;
  outstanding_advance: number;
  is_active: boolean;
  is_test: boolean;
  created_at: string;
  updated_at: string;
  profile?: Profile;
}

export interface Lead {
  id: string;
  lead_code: string;
  branch?: BranchLocation;
  source_agent_id?: string;
  assigned_officer_id?: string;
  full_name: string;
  mobile: string;
  alternate_phone?: string;
  email?: string;
  discom_name: string;
  consumer_number?: string;
  sanctioned_load_kw?: number;
  proposed_capacity_kw?: number;
  address_line?: string;
  state?: string;
  district?: string;
  tehsil?: string;
  block?: string;
  panchayat_village?: string;
  pincode?: string;
  stage: LeadStageType;
  lost_reason?: string;
  notes?: string;
  converted_customer_id?: string;
  is_test: boolean;
  created_at: string;
  updated_at: string;
}

export interface Customer {
  id: string;
  customer_code: string;
  branch?: BranchLocation;
  full_name: string;
  primary_mobile: string;
  alternate_mobile?: string;
  email?: string;
  aadhaar_masked?: string;
  pan_number?: string;
  discom_name: string;
  consumer_number: string;
  sanctioned_load_kw?: number;
  installation_address: string;
  district: string;
  tehsil?: string;
  block?: string;
  panchayat_village?: string;
  state: string;
  pincode: string;
  lifecycle_status: CustomerLifecycleType;
  is_test: boolean;
  created_at: string;
  updated_at: string;
}

export interface Acquisition {
  id: string;
  customer_id: string;
  lead_id?: string;
  sourcing_agent_id: string;
  acquired_at: string;
  conversion_notes?: string;
  is_test: boolean;
}

export interface PmsgTracking {
  id: string;
  customer_id: string;
  portal_application_no?: string;
  application_submission_date?: string;
  registered_capacity_kw?: number;
  stage: PmsgStageType;
  feasibility_status?: string;
  discom_subdivision?: string;
  subsidy_amount_eligible: number;
  subsidy_disbursed_amount: number;
  subsidy_disbursed_date?: string;
  portal_remarks?: string;
  last_sync_at?: string;
  is_test: boolean;
  created_at: string;
  updated_at: string;
}

export interface Project {
  id: string;
  project_code: string;
  customer_id: string;
  vendor_id?: string;
  primary_agent_id: string;
  capacity_kw: number;
  total_contract_amount: number;
  discom_subsidy_amount: number;
  customer_payable_amount: number;
  status: ProjectStatusType;
  commission_distributed: boolean;
  is_test: boolean;
  created_at: string;
  updated_at: string;
}

export interface Installation {
  id: string;
  project_id: string;
  technician_profile_id?: string;
  structure_type?: string;
  solar_module_make?: string;
  solar_module_capacity_wp?: number;
  solar_module_quantity?: number;
  inverter_make?: string;
  inverter_capacity_kw?: number;
  inverter_serial_no?: string;
  dispatch_date?: string;
  installation_start_date?: string;
  installation_completed_date?: string;
  net_meter_installed: boolean;
  net_meter_installed_date?: string;
  net_meter_serial_no?: string;
  discom_inspection_signoff: boolean;
  discom_inspection_date?: string;
  inspector_name?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface Loan {
  id: string;
  project_id: string;
  customer_id: string;
  bank_name: string;
  branch_name?: string;
  loan_application_no?: string;
  applied_amount: number;
  sanctioned_amount?: number;
  disbursed_amount: number;
  tenure_months?: number;
  interest_rate_pa?: number;
  status: LoanStatusType;
  rejection_reason?: string;
  disbursement_date?: string;
  created_at: string;
  updated_at: string;
}

export interface Payment {
  id: string;
  payment_reference_no: string;
  project_id: string;
  customer_id: string;
  stage: PaymentStageType;
  amount: number;
  payment_mode: string;
  transaction_identifier?: string;
  status: PaymentStatusType;
  approved_by?: string;
  approved_at?: string;
  paid_at?: string;
  reversal_parent_payment_id?: string;
  reversal_reason?: string;
  is_test: boolean;
  created_at: string;
  updated_at: string;
}

export interface CommissionRate {
  id: string;
  position: number;
  position_title: string;
  default_rate_percent: number;
  is_active: boolean;
  updated_at: string;
}

export interface CommissionTransaction {
  id: string;
  project_id: string;
  payment_stage: PaymentStageType;
  position: number;
  agent_id: string;
  base_amount: number;
  rate_percent: number;
  gross_commission: number;
  tds_rate_percent: number;
  tds_amount: number;
  net_commission: number;
  hierarchy_snapshot: Record<string, unknown>;
  is_paid_out: boolean;
  payout_id?: string;
  is_test: boolean;
  created_at: string;
}

export interface DocumentRecord {
  id: string;
  entity_type: string;
  entity_id: string;
  doc_category: string;
  file_name: string;
  file_path: string;
  mime_type: string;
  file_size_bytes?: number;
  status: DocStatusType;
  uploaded_by?: string | null;
  verified_by?: string | null;
  verified_at?: string | null;
  rejection_reason?: string | null;
  is_test: boolean;
  created_at: string;
  updated_at?: string | null;
}

export interface AuditLog {
  id: string;
  actor_id?: string;
  action: string;
  entity_type: string;
  entity_id: string;
  old_data?: Record<string, unknown>;
  new_data?: Record<string, unknown>;
  ip_address?: string;
  user_agent?: string;
  created_at: string;
}

export type QuotationStatusType = 'DRAFT' | 'SENT' | 'ACCEPTED' | 'CONVERTED' | 'EXPIRED';

export interface QuotationEquipmentItem {
  id: string;
  name: string;
  category: 'MODULE' | 'INVERTER' | 'STRUCTURE' | 'ELECTRICAL' | 'SAFETY' | 'BATTERY' | 'OTHER';
  spec?: string;
  quantity: number;
  unit: string;
  unit_price: number;
  total_price: number;
  is_editable?: boolean;
}

export interface Quotation {
  id: string;
  quotation_no: string;
  customer_id?: string;
  lead_id?: string;
  lead_code?: string;
  customer_name: string;
  phone: string;
  email?: string;
  address_line?: string;
  state?: string;
  district?: string;
  tehsil?: string;
  block?: string;
  panchayat_village?: string;
  pincode?: string;
  branch?: string;
  consumer_number?: string;
  sanctioned_load_kw?: number;
  discom_name?: string;
  roof_type?: string;
  system_type?: 'ON_GRID' | 'HYBRID' | 'OFF_GRID';
  cell_type?: string; // Mono PERC, Bifacial, TopCon, Polycrystalline, DCR
  solar_brand?: string; // Tata, Adani, Waaree, Vikram, Rayzon, Goldi, etc.
  module_type?: string;
  module_quantity?: number;
  module_wattage_wp?: number;
  panel_unit_price?: number;
  panel_total_price?: number;
  inverter_brand?: string; // Growatt, Deye, Solis, Havells, Polycab, Microtek, etc.
  inverter_kw?: number;
  inverter_model?: string;
  inverter_price?: number;
  structure_type?: string;
  structure_price?: number;
  battery_capacity_kwh?: number;
  battery_brand?: string;
  battery_price?: number;
  installation_charge?: number;
  transport_other_charge?: number; // Freight / Transportation / Liaisoning
  equipment_items?: QuotationEquipmentItem[];
  capacity_kw: number;
  rate_per_kw?: number;
  subtotal_cost?: number;
  gst_percentage?: number;
  gst_amount?: number;
  total_project_cost: number;
  central_subsidy_amount: number;
  state_subsidy_amount: number;
  net_customer_cost: number;
  monthly_savings_est: number;
  annual_savings_est?: number;
  payback_period_years?: number;
  lifetime_savings_est?: number;
  loan_eligible_amount?: number;
  est_monthly_emi?: number;
  status?: QuotationStatusType;
  valid_until?: string;
  prepared_by?: string;
  notes?: string;
  is_test?: boolean;
  created_at: string;
}

export interface Expense {
  id: string;
  expense_code: string;
  category: string; // 'OFFICE_RENT', 'SITE_VISIT', 'MARKETING', 'SALARY', 'HARDWARE'
  amount: number;
  paid_to: string;
  payment_mode: string;
  recorded_by: string;
  expense_date: string;
  notes?: string;
}

export interface RewardScheme {
  id: string;
  title: string;
  target_capacity_kw: number;
  reward_amount: number;
  period: string;
  status: 'ACTIVE' | 'EXPIRED';
}

export type StandardErpErrorCode = 
  | 'INVALID_TRANSITION'
  | 'DUPLICATE_CUSTOMER'
  | 'DOCUMENTS_INCOMPLETE'
  | 'PAYMENT_NOT_APPROVED'
  | 'PAYMENT_ALREADY_PAID'
  | 'INSTALLATION_NOT_COMPLETED'
  | 'COMMISSION_ALREADY_GENERATED'
  | 'INSUFFICIENT_PERMISSION'
  | 'RECORD_NOT_FOUND'
  | 'INVALID_STATUS'
  | 'CONCURRENT_UPDATE';
