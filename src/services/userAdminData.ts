export interface OfficeUser {
  id: string;
  user_code: string;
  avatar_letter: string;
  full_name: string;
  email: string;
  phone: string;
  role: 'MASTER_CONTROL' | 'BRANCH_MANAGER' | 'BACKOFFICE' | 'RECEPTIONIST' | 'OPERATIONAL_MANAGER';
  role_display: string;
  branch: string;
  designation: string;
  status: 'ACTIVE' | 'INACTIVE';
  appointment_date: string;
  last_login: string;
  salary_text?: string;
  appointment_letter_id: string;
}

export interface BranchSetup {
  id: string;
  branch_code: string;
  name: string;
  status: 'HQ - ACTIVE' | 'ACTIVE' | 'UPCOMING';
  location: string;
  manager_name: string;
  address: string;
  staff_assigned_count: number;
}

export interface RbacRoleStatus {
  role_id: string;
  role_name: string;
  status: 'ACTIVE' | 'INACTIVE';
}

export interface RbacPermissionRow {
  id: string;
  category: string;
  action: string;
  description: string;
  global_status: 'ACTIVE' | 'DISABLE';
  admin: boolean;
  branch_mgr: boolean;
  ops_mgr: boolean;
  backoffice: boolean;
  receptionist: boolean;
  agent: boolean;
}

export interface AppointmentOrder {
  id: string;
  order_no: string;
  staff_name: string;
  role: string;
  branch: string;
  appointment_date: string;
  remuneration_text: string;
  reporting_to: string;
  terms: string[];
}

export const INITIAL_OFFICE_USERS: OfficeUser[] = [
  {
    id: 'usr-001',
    user_code: 'USR00001',
    avatar_letter: 'B',
    full_name: 'BNPS Administrator',
    email: 'admin@bnps.local',
    phone: '+91 98290 10001',
    role: 'MASTER_CONTROL',
    role_display: 'Master Control',
    branch: '—',
    designation: 'Managing Director & Master Administrator',
    status: 'ACTIVE',
    appointment_date: '2026-01-01',
    last_login: '29 Sept 2026',
    salary_text: 'Executive Remuneration Package',
    appointment_letter_id: 'APPT-BNPS-HQ-001',
  },
  {
    id: 'usr-002',
    user_code: 'USR00002',
    avatar_letter: 'R',
    full_name: 'Rajesh Kumar Yadav',
    email: 'rajesh@gmail.com',
    phone: '+91 98290 20002',
    role: 'BRANCH_MANAGER',
    role_display: 'Manager',
    branch: 'Jaijaipur Branch',
    designation: 'Senior Branch Manager (Jaijaipur)',
    status: 'ACTIVE',
    appointment_date: '2026-01-15',
    last_login: '12 Sept 2026',
    salary_text: '₹45,000 / month + Target Performance Incentives',
    appointment_letter_id: 'APPT-BNPS-JJP-002',
  },
  {
    id: 'usr-003',
    user_code: 'USR00003',
    avatar_letter: 'R',
    full_name: 'Ravi Kumar',
    email: 'ravi@gmail.com',
    phone: '+91 98290 30003',
    role: 'BACKOFFICE',
    role_display: 'Back Office',
    branch: 'Sakti Branch',
    designation: 'Documentation & Back-Office In-Charge',
    status: 'ACTIVE',
    appointment_date: '2026-02-01',
    last_login: '24 Sept 2026',
    salary_text: '₹28,000 / month',
    appointment_letter_id: 'APPT-BNPS-SKT-003',
  },
  {
    id: 'usr-004',
    user_code: 'USR00004',
    avatar_letter: 'S',
    full_name: 'Sagar kumar Yadav',
    email: 'sagar@gamil.com',
    phone: '+91 98290 40004',
    role: 'RECEPTIONIST',
    role_display: 'Receptionist',
    branch: 'Jaijaipur Branch',
    designation: 'Front Desk Receptionist & Customer Desk',
    status: 'ACTIVE',
    appointment_date: '2026-02-15',
    last_login: '12 Sept 2026',
    salary_text: '₹22,000 / month',
    appointment_letter_id: 'APPT-BNPS-JJP-004',
  },
  {
    id: 'usr-005',
    user_code: 'USR00005',
    avatar_letter: 'O',
    full_name: 'Om Prakash Dewangan',
    email: 'omprakash@bnps.local',
    phone: '+91 98290 50005',
    role: 'OPERATIONAL_MANAGER',
    role_display: 'Operational Manager',
    branch: 'Jaijaipur (Central HQ)',
    designation: 'Central Operations & Technical Manager',
    status: 'ACTIVE',
    appointment_date: '2026-01-10',
    last_login: '28 Sept 2026',
    salary_text: '₹55,000 / month',
    appointment_letter_id: 'APPT-BNPS-OPS-005',
  },
];

export const INITIAL_BRANCH_SETUPS: BranchSetup[] = [
  {
    id: 'br-jjp',
    branch_code: 'BNPS-JJP',
    name: 'Jaijaipur',
    status: 'HQ - ACTIVE',
    location: 'Sakti / Janjgir, Chhattisgarh',
    manager_name: 'Rajesh Kumar Yadav',
    address: 'Main Market Road, Near Powar Grid Substation, Jaijaipur',
    staff_assigned_count: 3,
  },
  {
    id: 'br-jjc',
    branch_code: 'BNPS-JJC',
    name: 'Janjgir-Champa',
    status: 'ACTIVE',
    location: 'Janjgir-Champa, Chhattisgarh',
    manager_name: 'Open for Appointment',
    address: 'Kutchery Chowk, Near District Collectorate, Janjgir',
    staff_assigned_count: 0,
  },
  {
    id: 'br-skt',
    branch_code: 'BNPS-SKT',
    name: 'Sakti',
    status: 'ACTIVE',
    location: 'Sakti, Chhattisgarh',
    manager_name: 'Ravi Kumar (In-Charge)',
    address: 'Station Road, Near Railway Overbridge, Sakti',
    staff_assigned_count: 1,
  },
  {
    id: 'br-rgh',
    branch_code: 'BNPS-RGH',
    name: 'Raigarh',
    status: 'UPCOMING',
    location: 'Raigarh, Chhattisgarh',
    manager_name: 'Open for Appointment',
    address: 'Dhimrapur Chowk, Main Commercial Road, Raigarh',
    staff_assigned_count: 0,
  },
  {
    id: 'br-krb',
    branch_code: 'BNPS-KRB',
    name: 'Korba',
    status: 'UPCOMING',
    location: 'Korba, Chhattisgarh',
    manager_name: 'Open for Appointment',
    address: 'Transport Nagar, Powar City Hub, Korba',
    staff_assigned_count: 0,
  },
  {
    id: 'br-bsp',
    branch_code: 'BNPS-BSP',
    name: 'Bilaspur',
    status: 'UPCOMING',
    location: 'Bilaspur, Chhattisgarh',
    manager_name: 'Open for Appointment',
    address: 'Vyapar Vihar Commercial Hub, Bilaspur',
    staff_assigned_count: 0,
  },
  {
    id: 'br-rpr',
    branch_code: 'BNPS-RPR',
    name: 'Raipur',
    status: 'UPCOMING',
    location: 'Raipur, Chhattisgarh',
    manager_name: 'Open for Appointment',
    address: 'Pandri Commercial Complex, Raipur',
    staff_assigned_count: 0,
  },
  {
    id: 'br-bsn',
    branch_code: 'BNPS-BSN',
    name: 'Basana',
    status: 'UPCOMING',
    location: 'Mahasamund, Chhattisgarh',
    manager_name: 'Open for Appointment',
    address: 'National Highway Road, Near Bus Stand, Basana',
    staff_assigned_count: 0,
  },
];

export const INITIAL_RBAC_ROLES: RbacRoleStatus[] = [
  { role_id: 'admin', role_name: 'Administrator', status: 'ACTIVE' },
  { role_id: 'master_control', role_name: 'Master Control', status: 'ACTIVE' },
  { role_id: 'branch_manager', role_name: 'Branch Manager', status: 'ACTIVE' },
  { role_id: 'operational_manager', role_name: 'Operational Manager', status: 'ACTIVE' },
  { role_id: 'back_office', role_name: 'Back Office', status: 'ACTIVE' },
  { role_id: 'receptionist', role_name: 'Receptionist', status: 'ACTIVE' },
  { role_id: 'agent', role_name: 'Agent', status: 'ACTIVE' },
];

export const INITIAL_RBAC_PERMISSIONS: RbacPermissionRow[] = [
  // Agent
  { id: 'p-ag-1', category: 'Agent', action: 'CREATE', description: 'Appoint or onboard new agent in ERP', global_status: 'ACTIVE', admin: true, branch_mgr: true, ops_mgr: false, backoffice: false, receptionist: false, agent: false },
  { id: 'p-ag-2', category: 'Agent', action: 'EXPORT', description: 'Export agent lists to Excel / CSV', global_status: 'ACTIVE', admin: true, branch_mgr: true, ops_mgr: true, backoffice: true, receptionist: false, agent: false },
  { id: 'p-ag-3', category: 'Agent', action: 'REVIEW', description: 'Review agent KYC, passbook, and Aadhaar', global_status: 'ACTIVE', admin: true, branch_mgr: true, ops_mgr: true, backoffice: true, receptionist: false, agent: false },
  { id: 'p-ag-4', category: 'Agent', action: 'UPDATE', description: 'Update agent profile, phone, or status', global_status: 'ACTIVE', admin: true, branch_mgr: true, ops_mgr: false, backoffice: false, receptionist: false, agent: false },
  { id: 'p-ag-5', category: 'Agent', action: 'VIEW', description: 'View agent directory and hierarchy', global_status: 'ACTIVE', admin: true, branch_mgr: true, ops_mgr: true, backoffice: true, receptionist: true, agent: true },

  // CRM
  { id: 'p-crm-1', category: 'CRM', action: 'CONVERT', description: 'Convert raw lead into official customer', global_status: 'ACTIVE', admin: true, branch_mgr: true, ops_mgr: true, backoffice: true, receptionist: true, agent: false },
  { id: 'p-crm-2', category: 'CRM', action: 'CREATE', description: 'Create enquiry / CRM record', global_status: 'ACTIVE', admin: true, branch_mgr: true, ops_mgr: true, backoffice: true, receptionist: true, agent: true },
  { id: 'p-crm-3', category: 'CRM', action: 'DELETE', description: 'Permanently remove CRM lead / record', global_status: 'ACTIVE', admin: true, branch_mgr: false, ops_mgr: false, backoffice: false, receptionist: false, agent: false },
  { id: 'p-crm-4', category: 'CRM', action: 'EXPORT', description: 'Export CRM leads data', global_status: 'ACTIVE', admin: true, branch_mgr: true, ops_mgr: true, backoffice: true, receptionist: false, agent: false },
  { id: 'p-crm-5', category: 'CRM', action: 'REVIEW', description: 'Review lead qualification & capacity', global_status: 'ACTIVE', admin: true, branch_mgr: true, ops_mgr: true, backoffice: true, receptionist: true, agent: false },
  { id: 'p-crm-6', category: 'CRM', action: 'VIEW', description: 'View lead pipeline and customer notes', global_status: 'ACTIVE', admin: true, branch_mgr: true, ops_mgr: true, backoffice: true, receptionist: true, agent: true },

  // Commission
  { id: 'p-com-1', category: 'Commission', action: 'CREATE', description: 'Generate 7-tier commission transactions', global_status: 'ACTIVE', admin: true, branch_mgr: false, ops_mgr: false, backoffice: true, receptionist: false, agent: false },
  { id: 'p-com-2', category: 'Commission', action: 'EXPORT', description: 'Export commission payouts summary', global_status: 'ACTIVE', admin: true, branch_mgr: true, ops_mgr: true, backoffice: true, receptionist: false, agent: false },
  { id: 'p-com-3', category: 'Commission', action: 'REVIEW', description: 'Review & audit commission payouts', global_status: 'ACTIVE', admin: true, branch_mgr: true, ops_mgr: false, backoffice: true, receptionist: false, agent: false },
  { id: 'p-com-4', category: 'Commission', action: 'VIEW', description: 'View commission balances and payouts', global_status: 'ACTIVE', admin: true, branch_mgr: true, ops_mgr: true, backoffice: true, receptionist: false, agent: true },

  // Customer
  { id: 'p-cust-1', category: 'Customer', action: 'CREATE', description: 'Create new direct customer in ERP', global_status: 'ACTIVE', admin: true, branch_mgr: true, ops_mgr: true, backoffice: true, receptionist: true, agent: false },
  { id: 'p-cust-2', category: 'Customer', action: 'EXPORT', description: 'Export customer database', global_status: 'ACTIVE', admin: true, branch_mgr: true, ops_mgr: true, backoffice: true, receptionist: false, agent: false },
  { id: 'p-cust-3', category: 'Customer', action: 'REVIEW', description: 'Review customer documents & verification', global_status: 'ACTIVE', admin: true, branch_mgr: true, ops_mgr: true, backoffice: true, receptionist: true, agent: false },
  { id: 'p-cust-4', category: 'Customer', action: 'UPDATE', description: 'Update customer address, phone, KNO', global_status: 'ACTIVE', admin: true, branch_mgr: true, ops_mgr: true, backoffice: true, receptionist: true, agent: false },
  { id: 'p-cust-5', category: 'Customer', action: 'VIEW', description: 'View customer details and status', global_status: 'ACTIVE', admin: true, branch_mgr: true, ops_mgr: true, backoffice: true, receptionist: true, agent: true },

  // DISCOM
  { id: 'p-disc-1', category: 'DISCOM', action: 'CREATE', description: 'Submit DISCOM application and load sanction', global_status: 'ACTIVE', admin: true, branch_mgr: true, ops_mgr: true, backoffice: true, receptionist: false, agent: false },
  { id: 'p-disc-2', category: 'DISCOM', action: 'UPDATE', description: 'Update DISCOM feasibility & approval', global_status: 'ACTIVE', admin: true, branch_mgr: true, ops_mgr: true, backoffice: true, receptionist: false, agent: false },
  { id: 'p-disc-3', category: 'DISCOM', action: 'VIEW', description: 'View DISCOM status & feasibility', global_status: 'ACTIVE', admin: true, branch_mgr: true, ops_mgr: true, backoffice: true, receptionist: true, agent: true },

  // Dashboard
  { id: 'p-dash-1', category: 'Dashboard', action: 'EXPORT', description: 'Export executive dashboard statistics', global_status: 'ACTIVE', admin: true, branch_mgr: true, ops_mgr: true, backoffice: true, receptionist: false, agent: false },
  { id: 'p-dash-2', category: 'Dashboard', action: 'VIEW', description: 'Access main ERP overview dashboard', global_status: 'ACTIVE', admin: true, branch_mgr: true, ops_mgr: true, backoffice: true, receptionist: true, agent: true },

  // Finance
  { id: 'p-fin-1', category: 'Finance', action: 'APPROVE', description: 'Authorize office vouchers and payments', global_status: 'ACTIVE', admin: true, branch_mgr: false, ops_mgr: false, backoffice: true, receptionist: false, agent: false },
  { id: 'p-fin-2', category: 'Finance', action: 'CREATE', description: 'Record office expense, travel or payment', global_status: 'ACTIVE', admin: true, branch_mgr: true, ops_mgr: true, backoffice: true, receptionist: true, agent: false },
  { id: 'p-fin-3', category: 'Finance', action: 'EXPORT', description: 'Download balance sheet & expense logs', global_status: 'ACTIVE', admin: true, branch_mgr: true, ops_mgr: false, backoffice: true, receptionist: false, agent: false },
  { id: 'p-fin-4', category: 'Finance', action: 'VIEW', description: 'View finance ledgers and statements', global_status: 'ACTIVE', admin: true, branch_mgr: true, ops_mgr: true, backoffice: true, receptionist: false, agent: false },

  // Lead
  { id: 'p-lead-1', category: 'Lead', action: 'CREATE', description: 'Create new solar customer enquiry/lead', global_status: 'ACTIVE', admin: true, branch_mgr: true, ops_mgr: true, backoffice: true, receptionist: true, agent: true },
  { id: 'p-lead-2', category: 'Lead', action: 'DOCUMENT_UPLOAD', description: 'Upload customer electricity bill, Aadhaar, Bank docs', global_status: 'ACTIVE', admin: true, branch_mgr: true, ops_mgr: true, backoffice: true, receptionist: true, agent: true },
  { id: 'p-lead-3', category: 'Lead', action: 'UPDATE', description: 'Update lead follow-up date and remarks', global_status: 'ACTIVE', admin: true, branch_mgr: true, ops_mgr: true, backoffice: true, receptionist: true, agent: true },
  { id: 'p-lead-4', category: 'Lead', action: 'VIEW', description: 'View assigned or created leads list', global_status: 'ACTIVE', admin: true, branch_mgr: true, ops_mgr: true, backoffice: true, receptionist: true, agent: true },

  // PSG (PM Surya Ghar)
  { id: 'p-psg-1', category: 'PSG', action: 'APPROVE', description: 'Final portal approval & verify customer registration', global_status: 'ACTIVE', admin: true, branch_mgr: true, ops_mgr: true, backoffice: true, receptionist: false, agent: false },
  { id: 'p-psg-2', category: 'PSG', action: 'CREATE', description: 'Officially register customer on PM Surya Ghar portal', global_status: 'ACTIVE', admin: true, branch_mgr: true, ops_mgr: true, backoffice: true, receptionist: true, agent: false },
  { id: 'p-psg-3', category: 'PSG', action: 'EXPORT', description: 'Export registered applications report', global_status: 'ACTIVE', admin: true, branch_mgr: true, ops_mgr: true, backoffice: true, receptionist: false, agent: false },
  { id: 'p-psg-4', category: 'PSG', action: 'FORWARD', description: 'Forward application to DISCOM / Bank', global_status: 'ACTIVE', admin: true, branch_mgr: true, ops_mgr: true, backoffice: true, receptionist: false, agent: false },
  { id: 'p-psg-5', category: 'PSG', action: 'PROCESS', description: 'Process feasibility and vendor allotment', global_status: 'ACTIVE', admin: true, branch_mgr: true, ops_mgr: true, backoffice: true, receptionist: false, agent: false },
  { id: 'p-psg-6', category: 'PSG', action: 'REJECT', description: 'Mark application rejected / document deficiency', global_status: 'ACTIVE', admin: true, branch_mgr: true, ops_mgr: true, backoffice: true, receptionist: false, agent: false },
  { id: 'p-psg-7', category: 'PSG', action: 'REVIEW', description: 'Review registration docket before submission', global_status: 'ACTIVE', admin: true, branch_mgr: true, ops_mgr: true, backoffice: true, receptionist: true, agent: false },
  { id: 'p-psg-8', category: 'PSG', action: 'UPDATE', description: 'Update application stage & tracking milestone', global_status: 'ACTIVE', admin: true, branch_mgr: true, ops_mgr: true, backoffice: true, receptionist: true, agent: false },
  { id: 'p-psg-9', category: 'PSG', action: 'VIEW', description: 'View 13-stage PM Surya Ghar tracker status', global_status: 'ACTIVE', admin: true, branch_mgr: true, ops_mgr: true, backoffice: true, receptionist: true, agent: true },

  // Project
  { id: 'p-prj-1', category: 'Project', action: 'APPROVE', description: 'Approve site design, structural layout & BOM', global_status: 'ACTIVE', admin: true, branch_mgr: true, ops_mgr: true, backoffice: false, receptionist: false, agent: false },
  { id: 'p-prj-2', category: 'Project', action: 'EXPORT', description: 'Export project milestones & inventory', global_status: 'ACTIVE', admin: true, branch_mgr: true, ops_mgr: true, backoffice: true, receptionist: false, agent: false },
  { id: 'p-prj-3', category: 'Project', action: 'FORWARD', description: 'Forward site to installation team', global_status: 'ACTIVE', admin: true, branch_mgr: true, ops_mgr: true, backoffice: true, receptionist: false, agent: false },
  { id: 'p-prj-4', category: 'Project', action: 'REJECT', description: 'Reject infeasible rooftop site', global_status: 'ACTIVE', admin: true, branch_mgr: true, ops_mgr: true, backoffice: false, receptionist: false, agent: false },
  { id: 'p-prj-5', category: 'Project', action: 'REVIEW', description: 'Review site survey and shading report', global_status: 'ACTIVE', admin: true, branch_mgr: true, ops_mgr: true, backoffice: true, receptionist: false, agent: false },
  { id: 'p-prj-6', category: 'Project', action: 'UPDATE', description: 'Update project progress & inventory consumption', global_status: 'ACTIVE', admin: true, branch_mgr: true, ops_mgr: true, backoffice: true, receptionist: false, agent: false },
  { id: 'p-prj-7', category: 'Project', action: 'VIEW', description: 'View project tracking & technical details', global_status: 'ACTIVE', admin: true, branch_mgr: true, ops_mgr: true, backoffice: true, receptionist: true, agent: true },

  // User Administration
  { id: 'p-ua-1', category: 'User Administration', action: 'MANAGE_USERS', description: 'Create office users, assign roles & set status', global_status: 'ACTIVE', admin: true, branch_mgr: false, ops_mgr: false, backoffice: false, receptionist: false, agent: false },
  { id: 'p-ua-2', category: 'User Administration', action: 'BRANCH_APPOINTMENT', description: 'Appoint branch managers & staff to branches', global_status: 'ACTIVE', admin: true, branch_mgr: false, ops_mgr: false, backoffice: false, receptionist: false, agent: false },
  { id: 'p-ua-3', category: 'User Administration', action: 'RBAC_CONFIG', description: 'Toggle active/inactive status and permissions', global_status: 'ACTIVE', admin: true, branch_mgr: false, ops_mgr: false, backoffice: false, receptionist: false, agent: false },
];

export const INITIAL_APPOINTMENT_ORDERS: AppointmentOrder[] = [
  {
    id: 'apt-001',
    order_no: 'APPT-BNPS-HQ-001',
    staff_name: 'BNPS Administrator',
    role: 'Master Control & Managing Director',
    branch: 'Corporate Headquarters & All Branches',
    appointment_date: '2026-01-01',
    remuneration_text: 'Executive Remuneration Package',
    reporting_to: 'Board of Directors / Apex Executive',
    terms: [
      'Full administrative authority across all operational branches in Chhattisgarh.',
      'Authority to approve appointment orders, role privileges, and banking credentials.',
      'Supervision of PM Surya Ghar vendor compliance, DISCOM liaisoning, and fiscal payouts.',
    ],
  },
  {
    id: 'apt-002',
    order_no: 'APPT-BNPS-JJP-002',
    staff_name: 'Rajesh Kumar Yadav',
    role: 'Senior Branch Manager',
    branch: 'Jaijaipur Branch',
    appointment_date: '2026-01-15',
    remuneration_text: '₹45,000 / month + Target Performance Incentives',
    reporting_to: 'Managing Director & Central Operations',
    terms: [
      'Lead branch operations, customer acquisition, and agent onboarding in Jaijaipur jurisdiction.',
      'Review and authorize PM Surya Ghar consumer registrations and site survey clearance.',
      'Ensure CSPDCL feasibility submissions and timely milestone payment collections.',
    ],
  },
  {
    id: 'apt-003',
    order_no: 'APPT-BNPS-SKT-003',
    staff_name: 'Ravi Kumar',
    role: 'Back Office & Documentation In-Charge',
    branch: 'Sakti Branch',
    appointment_date: '2026-02-01',
    remuneration_text: '₹28,000 / month',
    reporting_to: 'Branch Manager & Operational Manager',
    terms: [
      'Validation of electricity bills, Aadhaar, PAN, and rooftop ownership documents.',
      'Processing bank solar loans with SBI, Canara Bank, and CG Rajya Gramin Bank.',
      'Preparation of DISCOM net metering kits and technical BOM verification.',
    ],
  },
  {
    id: 'apt-004',
    order_no: 'APPT-BNPS-JJP-004',
    staff_name: 'Sagar kumar Yadav',
    role: 'Front Desk Receptionist & Customer Desk',
    branch: 'Jaijaipur Branch',
    appointment_date: '2026-02-15',
    remuneration_text: '₹22,000 / month',
    reporting_to: 'Branch Manager',
    terms: [
      'Manage front-desk inquiries, customer walk-ins, and initial PM Surya Ghar briefings.',
      'Data entry of new solar leads and customer registration document scanning.',
      'Coordinate site visit appointments for solar technical officers.',
    ],
  },
  {
    id: 'apt-005',
    order_no: 'APPT-BNPS-OPS-005',
    staff_name: 'Om Prakash Dewangan',
    role: 'Central Operations & Technical Manager',
    branch: 'Jaijaipur (Central HQ)',
    appointment_date: '2026-01-10',
    remuneration_text: '₹55,000 / month',
    reporting_to: 'Managing Director',
    terms: [
      'Central engineering supervision for all technical solar rooftop installations.',
      'Inventory control of Tier-1 solar panels, inverters, structures, and balance of systems.',
      'Liaisoning with CSPDCL Chief Engineer & CREDA for state subsidy disbursement.',
    ],
  },
];
