import { 
  Agent, 
  Customer, 
  Lead, 
  PmsgTracking, 
  Project, 
  Installation,
  Loan,
  Payment,
  Quotation,
  Expense,
  RewardScheme,
  AuditLog,
  DocumentRecord
} from '../types/database';

import { BRANCHES_LIST } from '../lib/branches';
export { BRANCHES_LIST };

export interface StaffMember {
  id: string;
  employee_code: string;
  full_name: string;
  role: 'office_admin' | 'receptionist' | 'field_officer' | 'technician' | 'accountant' | 'super_admin';
  role_title: string;
  branch: typeof BRANCHES_LIST[number];
  phone: string;
  email: string;
  login_password: string; // Issued by Admin
  is_active: boolean;
  joined_date: string;
}

export const INITIAL_STAFF_MEMBERS: StaffMember[] = [
  {
    id: 'stf-001',
    employee_code: 'BNPS-MGR-01',
    full_name: 'Mukesh Choudhary (Director / Admin)',
    role: 'super_admin',
    role_title: 'Director & Super Admin',
    branch: 'Jaijaipur',
    phone: '9826011111',
    email: 'mukesh@bhuminidhi.com',
    login_password: 'Admin@Jaijaipur2026',
    is_active: true,
    joined_date: '2025-01-01',
  },
  {
    id: 'stf-002',
    employee_code: 'BNPS-JJ-01',
    full_name: 'Rameshwar Sahu',
    role: 'office_admin',
    role_title: 'Branch Manager',
    branch: 'Jaijaipur',
    phone: '9826044101',
    email: 'rameshwar.jj@bhuminidhi.com',
    login_password: 'Jaijaipur@123',
    is_active: true,
    joined_date: '2026-01-10',
  },
  {
    id: 'stf-003',
    employee_code: 'BNPS-JJ-02',
    full_name: 'Priya Chandra',
    role: 'receptionist',
    role_title: 'Receptionist / Front Desk',
    branch: 'Jaijaipur',
    phone: '9826044102',
    email: 'priya.jj@bhuminidhi.com',
    login_password: 'Priya@JJ2026',
    is_active: true,
    joined_date: '2026-01-15',
  },
  {
    id: 'stf-004',
    employee_code: 'BNPS-JJ-03',
    full_name: 'Vikas Yadav',
    role: 'field_officer',
    role_title: 'Field Officer',
    branch: 'Jaijaipur',
    phone: '9826044103',
    email: 'vikas.jj@bhuminidhi.com',
    login_password: 'Vikas@JJ2026',
    is_active: true,
    joined_date: '2026-01-20',
  },
  {
    id: 'stf-005',
    employee_code: 'BNPS-SKT-01',
    full_name: 'Rajesh Dewangan',
    role: 'office_admin',
    role_title: 'Branch Manager',
    branch: 'Sakti',
    phone: '9826055101',
    email: 'rajesh.sakti@bhuminidhi.com',
    login_password: 'Sakti@2026',
    is_active: true,
    joined_date: '2026-01-12',
  },
  {
    id: 'stf-006',
    employee_code: 'BNPS-KRB-01',
    full_name: 'Deepak Kanwar',
    role: 'office_admin',
    role_title: 'Branch Manager',
    branch: 'Korba',
    phone: '9826066101',
    email: 'deepak.korba@bhuminidhi.com',
    login_password: 'Korba@2026',
    is_active: true,
    joined_date: '2026-01-08',
  },
  {
    id: 'stf-007',
    employee_code: 'BNPS-BSP-01',
    full_name: 'Kavita Tiwari',
    role: 'office_admin',
    role_title: 'Branch Manager',
    branch: 'Bilaspur',
    phone: '9826033333',
    email: 'kavita.bsp@bhuminidhi.com',
    login_password: 'Bilaspur@2026',
    is_active: true,
    joined_date: '2025-12-15',
  },
  {
    id: 'stf-008',
    employee_code: 'BNPS-JGC-01',
    full_name: 'Arvind Patle',
    role: 'office_admin',
    role_title: 'Branch Manager',
    branch: 'Janjgir-Champa',
    phone: '9826077101',
    email: 'arvind.jgc@bhuminidhi.com',
    login_password: 'Janjgir@2026',
    is_active: true,
    joined_date: '2026-01-18',
  },
  {
    id: 'stf-009',
    employee_code: 'BNPS-RGH-01',
    full_name: 'Sunil Agrawal',
    role: 'office_admin',
    role_title: 'Branch Manager',
    branch: 'Raigarh',
    phone: '9826088101',
    email: 'sunil.rgh@bhuminidhi.com',
    login_password: 'Raigarh@2026',
    is_active: true,
    joined_date: '2026-01-22',
  },
  {
    id: 'stf-010',
    employee_code: 'BNPS-RPR-02',
    full_name: 'Pooja Sharma',
    role: 'office_admin',
    role_title: 'Headquarters Operations Head',
    branch: 'Raipur',
    phone: '9826022222',
    email: 'pooja.office@bhuminidhi.com',
    login_password: 'Pooja@RPR2026',
    is_active: true,
    joined_date: '2025-11-01',
  },
  {
    id: 'stf-011',
    employee_code: 'BNPS-RPR-03',
    full_name: 'Dinesh Khandelwal (CA)',
    role: 'accountant',
    role_title: 'Chief Accountant',
    branch: 'Raipur',
    phone: '9826099101',
    email: 'accounts@bhuminidhi.com',
    login_password: 'Accounts@2026',
    is_active: true,
    joined_date: '2025-11-15',
  },
  {
    id: 'stf-012',
    employee_code: 'BNPS-RPR-04',
    full_name: 'Rajendra Verma',
    role: 'technician',
    role_title: 'Lead Solar Technician',
    branch: 'Raipur',
    phone: '9826055555',
    email: 'rajendra.tech@bhuminidhi.com',
    login_password: 'Tech@2026',
    is_active: true,
    joined_date: '2026-01-05',
  },
];

export const CHHATTISGARH_DISTRICTS = [
  'Raipur',
  'Durg',
  'Bilaspur',
  'Rajnandgaon',
  'Korba',
  'Raigarh',
  'Jagdalpur (Bastar)',
  'Ambikapur (Surguja)',
  'Dhamtari',
  'Mahasamund',
  'Kanker',
  'Kabirdham (Kawardha)',
  'Janjgir-Champa',
  'Balod',
  'Bemetara',
  'Baloda Bazar',
  'Gariaband',
  'Mungeli',
  'Surajpur',
  'Balrampur',
  'Jashpur',
  'Koriya',
  'Sukma',
  'Bijapur',
  'Dantewada',
  'Narayanpur',
  'Kondagaon',
  'Gaurela-Pendra-Marwahi',
  'Khairagarh-Chhuikhadan-Gandai',
  'Mohla-Manpur-Ambagarh Chowki',
  'Sarangarh-Bilaigarh',
  'Sakti',
  'Manendragarh-Chirmiri-Bharatpur',
];


export const INITIAL_AGENTS: Agent[] = [];

export const INITIAL_CUSTOMERS: Customer[] = [];

export const INITIAL_LEADS: Lead[] = [];

export const INITIAL_PMSG_TRACKING: PmsgTracking[] = [];

export const INITIAL_PROJECTS: Project[] = [];

export const INITIAL_INSTALLATIONS: Installation[] = [];

export const INITIAL_LOANS: Loan[] = [];

export const INITIAL_PAYMENTS: Payment[] = [];

export const INITIAL_QUOTATIONS: Quotation[] = [];

export const INITIAL_EXPENSES: Expense[] = [];

export const INITIAL_REWARDS: RewardScheme[] = [
  {
    id: 'rew-001',
    title: 'Chhattisgarh Surya Star Champion (Q1 2026)',
    target_capacity_kw: 25.0,
    reward_amount: 15000,
    period: 'Jan 2026 - Mar 2026',
    status: 'ACTIVE',
  },
  {
    id: 'rew-002',
    title: 'Top Village Electrification Award',
    target_capacity_kw: 15.0,
    reward_amount: 7500,
    period: 'February 2026',
    status: 'ACTIVE',
  },
];

export const INITIAL_AUDIT_LOGS: AuditLog[] = [];

export const INITIAL_DOCUMENTS: DocumentRecord[] = [];
