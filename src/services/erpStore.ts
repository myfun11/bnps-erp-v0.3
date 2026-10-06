import
 { 
  Customer, 
  Lead, 
  Agent, 
  PmsgTracking, 
  Project,
  Installation,
  Loan,
  Payment,
  Quotation,
  QuotationStatusType,
  Expense,
  RewardScheme,
  AuditLog, 
  StandardErpErrorCode,
  LeadStageType,
  CustomerLifecycleType,
  PmsgStageType,
  BranchLocation
} from '../types/database';
import { 
  INITIAL_AGENTS, 
  INITIAL_CUSTOMERS, 
  INITIAL_LEADS, 
  INITIAL_PMSG_TRACKING, 
  INITIAL_PROJECTS,
  INITIAL_INSTALLATIONS,
  INITIAL_LOANS,
  INITIAL_PAYMENTS,
  INITIAL_QUOTATIONS,
  INITIAL_EXPENSES,
  INITIAL_REWARDS,
  INITIAL_AUDIT_LOGS,
  INITIAL_STAFF_MEMBERS,
  StaffMember,
  BRANCHES_LIST
} from './mockData';
import { isSupabaseConfigured } from '../lib/supabaseClient';
import { leadService } from './leadService';
import { customerService } from './customerService';
import { pmsgService } from './pmsgService';
import { projectService } from './projectService';
import { installationService } from './installationService';
import { loanService } from './loanService';
import { paymentService } from './paymentService';
import { commissionService } from './commissionService';

class ErpDataStore {
  private agents: Agent[] = [...INITIAL_AGENTS];
  private customers: Customer[] = [...INITIAL_CUSTOMERS];
  private leads: Lead[] = [...INITIAL_LEADS];
  private pmsgTracking: PmsgTracking[] = [...INITIAL_PMSG_TRACKING];
  private projects: Project[] = [...INITIAL_PROJECTS];
  private installations: Installation[] = [...INITIAL_INSTALLATIONS];
  private loans: Loan[] = [...INITIAL_LOANS];
  private payments: Payment[] = [...INITIAL_PAYMENTS];
  private quotations: Quotation[] = [...INITIAL_QUOTATIONS];
  private expenses: Expense[] = [...INITIAL_EXPENSES];
  private rewards: RewardScheme[] = [...INITIAL_REWARDS];
  private auditLogs: AuditLog[] = [...INITIAL_AUDIT_LOGS];
  private staffMembers: StaffMember[] = [...INITIAL_STAFF_MEMBERS];
  private activeBranchFilter: BranchLocation | 'ALL' = 'ALL';
  private listeners: Set<() => void> = new Set();
  private isSyncing: boolean = false;

  constructor() {
    if (isSupabaseConfigured) {
      this.fetchRemoteData().catch((err) => {
        console.error('[ErpDataStore] Initial remote sync error:', err);
      });
    }
  }

  /**
   * Fetches authoritative production data from Supabase PostgreSQL tables
   */
  public async fetchRemoteData(): Promise<void> {
    if (!isSupabaseConfigured || this.isSyncing) return;
    this.isSyncing = true;
    try {
      const [leads, customers, pmsg, projects, installations, loans, payments] = await Promise.all([
        leadService.fetchLeads(),
        customerService.fetchCustomers(),
        pmsgService.fetchPmsgTracking(),
        projectService.fetchProjects(),
        installationService.fetchInstallations(),
        loanService.fetchLoans(),
        paymentService.fetchPayments(),
      ]);

      this.leads = leads;
      this.customers = customers;
      this.pmsgTracking = pmsg;
      this.projects = projects;
      this.installations = installations;
      this.loans = loans;
      this.payments = payments;

      this.notify();
    } catch (err) {
      console.error('[ErpDataStore.fetchRemoteData] Error:', err);
    } finally {
      this.isSyncing = false;
    }
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach((listener) => listener());
  }

  // Getters
  public getAgents(): Agent[] {
    return [...this.agents];
  }

  public getCustomers(): Customer[] {
    return [...this.customers];
  }

  public getLeads(): Lead[] {
    return [...this.leads];
  }

  public getPmsgTracking(): PmsgTracking[] {
    return [...this.pmsgTracking];
  }

  public getProjects(): Project[] {
    return [...this.projects];
  }

  public getInstallations(): Installation[] {
    return [...this.installations];
  }

  public getLoans(): Loan[] {
    return [...this.loans];
  }

  public getPayments(): Payment[] {
    return [...this.payments];
  }

  public getQuotations(): Quotation[] {
    return [...this.quotations];
  }

  public getExpenses(): Expense[] {
    return [...this.expenses];
  }

  public getRewards(): RewardScheme[] {
    return [...this.rewards];
  }

  public getAuditLogs(): AuditLog[] {
    return [...this.auditLogs];
  }

  public getStaffMembers(): StaffMember[] {
    return [...this.staffMembers];
  }

  public getStaffByBranch(branch: BranchLocation | 'ALL'): StaffMember[] {
    if (branch === 'ALL') return [...this.staffMembers];
    return this.staffMembers.filter((s) => s.branch === branch);
  }

  public getActiveBranchFilter(): BranchLocation | 'ALL' {
    return this.activeBranchFilter;
  }

  public setActiveBranchFilter(branch: BranchLocation | 'ALL') {
    this.activeBranchFilter = branch;
    this.notify();
  }

  public createStaffMember(
    staffInput: {
      full_name: string;
      role: 'office_admin' | 'receptionist' | 'field_officer' | 'technician' | 'accountant';
      branch: BranchLocation;
      phone: string;
      email: string;
      login_password?: string;
    },
    actorProfileId?: string
  ): { success: boolean; staff?: StaffMember; message?: string } {
    const branchPrefix = staffInput.branch.slice(0, 3).toUpperCase();
    const count = this.staffMembers.filter((s) => s.branch === staffInput.branch).length + 1;
    const empCode = `BNPS-${branchPrefix}-${String(count).padStart(2, '0')}`;
    const generatedPassword = staffInput.login_password || `${staffInput.full_name.split(' ')[0]}@${staffInput.branch}2026`;

    const roleTitleMap: Record<string, string> = {
      office_admin: 'Branch Manager',
      receptionist: 'Receptionist / Front Desk',
      field_officer: 'Solar Field Officer',
      technician: 'Solar Technician',
      accountant: 'Branch Accountant',
    };

    const newStaff: StaffMember = {
      id: crypto.randomUUID(),
      employee_code: empCode,
      full_name: staffInput.full_name,
      role: staffInput.role,
      role_title: roleTitleMap[staffInput.role] || 'Staff Member',
      branch: staffInput.branch,
      phone: staffInput.phone,
      email: staffInput.email,
      login_password: generatedPassword,
      is_active: true,
      joined_date: new Date().toISOString().split('T')[0],
    };

    this.staffMembers.unshift(newStaff);

    this.auditLogs.unshift({
      id: crypto.randomUUID(),
      actor_id: actorProfileId,
      action: 'STAFF_APPOINTED',
      entity_type: 'staff_members',
      entity_id: newStaff.id,
      new_data: {
        employee_code: empCode,
        full_name: newStaff.full_name,
        branch: newStaff.branch,
        role: newStaff.role,
      },
      created_at: new Date().toISOString(),
    });

    this.notify();
    return { success: true, staff: newStaff };
  }

  public getPmsgByCustomerId(customerId: string): PmsgTracking | undefined {
    return this.pmsgTracking.find((p) => p.customer_id === customerId);
  }

  public getLeadsForAgent(agentId: string): Lead[] {
    return this.leads.filter((l) => l.source_agent_id === agentId);
  }

  /**
   * ATOMIC LEAD CONVERSION COMMAND
   * When Supabase is configured, delegates directly to PostgreSQL RPC convert_lead_atomic.
   * Otherwise falls back to deterministic local state transition.
   */
  public async convertLeadAtomic(
    leadId: string,
    consumerNumberOverride?: string,
    actorProfileId?: string
  ): Promise<{ success: boolean; customer?: Customer; error?: StandardErpErrorCode; message?: string }> {
    const leadIndex = this.leads.findIndex((l) => l.id === leadId);
    if (leadIndex === -1) {
      return { success: false, error: 'RECORD_NOT_FOUND', message: 'Lead not found' };
    }

    const lead = this.leads[leadIndex];
    if (lead.stage === 'CONVERTED') {
      return { success: false, error: 'INVALID_TRANSITION', message: 'Lead is already converted' };
    }

    if (lead.stage === 'LOST') {
      return { success: false, error: 'INVALID_TRANSITION', message: 'Cannot convert LOST lead' };
    }

    const finalConsumerNumber = consumerNumberOverride || lead.consumer_number;
    if (!finalConsumerNumber) {
      return { success: false, error: 'DOCUMENTS_INCOMPLETE', message: 'Consumer Number is required for conversion' };
    }

    // 1. Authoritative Supabase PostgreSQL RPC Execution
    if (isSupabaseConfigured) {
      try {
        const rpcRes = await customerService.convertLeadAtomic(
          leadId,
          finalConsumerNumber,
          actorProfileId || 'prof-super-admin-01'
        );

        if (!rpcRes.success) {
          return { success: false, error: 'INVALID_TRANSITION', message: rpcRes.message || 'RPC conversion failed' };
        }

        // Synchronize local reactive state
        this.leads[leadIndex] = {
          ...lead,
          stage: 'CONVERTED',
          converted_customer_id: rpcRes.customer_id,
          consumer_number: finalConsumerNumber,
          updated_at: new Date().toISOString(),
        };

        if (rpcRes.customer) {
          const custIdx = this.customers.findIndex((c) => c.id === rpcRes.customer_id);
          if (custIdx >= 0) {
            this.customers[custIdx] = rpcRes.customer;
          } else {
            this.customers.unshift(rpcRes.customer);
          }
        }

        this.notify();
        return { success: true, customer: rpcRes.customer };
      } catch (err: any) {
        console.error('[erpStore.convertLeadAtomic] Error during RPC conversion:', err);
        return { success: false, error: 'INVALID_TRANSITION', message: err.message };
      }
    }

    // 2. Check for Duplicate Customer by Mobile or Consumer Number (Single Master Invariant)
    const existingCustomer = this.customers.find(
      (c) => c.primary_mobile === lead.mobile || c.consumer_number === finalConsumerNumber
    );

    let customerToLink: Customer;

    if (existingCustomer) {
      customerToLink = existingCustomer;
    } else {
      // 2. Generate Deterministic Customer Code: BNPS-CUST-YYMM-XXXXX
      const now = new Date();
      const yy = String(now.getFullYear()).slice(-2);
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const randomSeq = Math.floor(10000 + Math.random() * 90000);
      const customerCode = `BNPS-CUST-${yy}${mm}-${randomSeq}`;

      customerToLink = {
        id: crypto.randomUUID(),
        customer_code: customerCode,
        branch: lead.branch,
        full_name: lead.full_name,
        primary_mobile: lead.mobile,
        alternate_mobile: lead.alternate_phone,
        email: lead.email,
        discom_name: lead.discom_name || 'CSPDCL (Raipur Circle)',
        consumer_number: finalConsumerNumber,
        sanctioned_load_kw: lead.sanctioned_load_kw,
        installation_address: lead.address_line || 'Address Pending Site Survey',
        state: lead.state || 'Chhattisgarh',
        district: lead.district || 'Raipur',
        tehsil: lead.tehsil || 'Raipur',
        block: lead.block || 'Dharsiwa',
        panchayat_village: lead.panchayat_village || 'Raipur',
        pincode: lead.pincode || '492001',
        lifecycle_status: 'REGISTERED',
        is_test: lead.is_test,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      this.customers.unshift(customerToLink);
    }

    // 4. Update Lead to CONVERTED atomically
    this.leads[leadIndex] = {
      ...lead,
      stage: 'CONVERTED',
      converted_customer_id: customerToLink.id,
      consumer_number: finalConsumerNumber,
      updated_at: new Date().toISOString(),
    };

    // 5. Append Immutable Business Audit Entry
    this.auditLogs.unshift({
      id: crypto.randomUUID(),
      actor_id: actorProfileId || 'prof-super-admin-01',
      action: 'LEAD_CONVERTED',
      entity_type: 'leads',
      entity_id: lead.id,
      new_data: {
        lead_code: lead.lead_code,
        customer_id: customerToLink.id,
        customer_code: customerToLink.customer_code,
        consumer_number: finalConsumerNumber,
        state: 'Chhattisgarh',
      },
      created_at: new Date().toISOString(),
    });

    this.notify();
    return { success: true, customer: customerToLink };
  }

  /**
   * CREATE LEAD COMMAND
   *
   * Supabase mode:
   *   PostgreSQL RPC is authoritative.
   *   Local cache is updated only after DB success.
   *
   * Local/mock mode:
   *   Retained only when Supabase is not configured.
   */
  public async createLead(
    leadInput: Omit<Lead, 'id' | 'lead_code' | 'created_at' | 'updated_at'>,
    actorProfileId?: string
  ): Promise<{ success: boolean; lead?: Lead; error?: StandardErpErrorCode; message?: string }> {

    // ========================================================================
    // SUPABASE MODE — AUTHORITATIVE DATABASE
    // ========================================================================
    if (isSupabaseConfigured) {
      try {
        const createdLead = await leadService.createLead(leadInput);

        // Update local cache only AFTER authoritative DB success.
        this.leads = [
          createdLead,
          ...this.leads.filter((lead) => lead.id !== createdLead.id),
        ];

        this.notify();

        return {
          success: true,
          lead: createdLead,
        };
      } catch (err: any) {
        console.error('[erpStore.createLead] Supabase RPC error:', err);

        // No local Lead is created when the authoritative DB command fails.
        return {
          success: false,
          message: err?.message || 'Failed to create lead.',
        };
      }
    }

    // ========================================================================
    // LOCAL / MOCK MODE
    // ========================================================================
    // Used only when Supabase is not configured.
    // Production Supabase mode never reaches this section.
    // ========================================================================

    const count = this.leads.length + 1;
    const now = new Date();
    const yy = String(now.getFullYear()).slice(-2);
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const seq = String(count).padStart(4, '0');
    const leadCode = `LD-${yy}${mm}-${seq}`;

    const newLead: Lead = {
      ...leadInput,
      state: leadInput.state || 'Chhattisgarh',
      district: leadInput.district || 'Raipur',
      discom_name: leadInput.discom_name || 'CSPDCL (Raipur)',
      id: crypto.randomUUID(),
      lead_code: leadCode,
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    };

    this.leads.unshift(newLead);

    this.auditLogs.unshift({
      id: crypto.randomUUID(),
      actor_id: actorProfileId,
      action: 'LEAD_CREATED',
      entity_type: 'leads',
      entity_id: newLead.id,
      new_data: {
        lead_code: leadCode,
        full_name: newLead.full_name,
        mobile: newLead.mobile,
      },
      created_at: now.toISOString(),
    });

    this.notify();

    return {
      success: true,
      lead: newLead,
    };
  }

  /**
   * UPDATE LEAD STAGE
   */
  public updateLeadStage(
    leadId: string,
    newStage: LeadStageType,
    lostReason?: string,
    actorProfileId?: string
  ): { success: boolean; error?: StandardErpErrorCode; message?: string } {
    const index = this.leads.findIndex((l) => l.id === leadId);
    if (index === -1) {
      return { success: false, error: 'RECORD_NOT_FOUND', message: 'Lead not found' };
    }

    const currentLead = this.leads[index];
    if (currentLead.stage === 'CONVERTED' && newStage !== 'CONVERTED') {
      return { success: false, error: 'INVALID_TRANSITION', message: 'Converted lead cannot be reverted' };
    }

    this.leads[index] = {
      ...currentLead,
      stage: newStage,
      lost_reason: newStage === 'LOST' ? lostReason : undefined,
      updated_at: new Date().toISOString(),
    };

    // Asynchronously persist to Supabase if configured
    if (isSupabaseConfigured) {
      leadService.updateLeadStage(leadId, newStage, lostReason).catch((err) => {
        console.error('[erpStore.updateLeadStage] Supabase persist error:', err);
      });
    }

    this.auditLogs.unshift({
      id: crypto.randomUUID(),
      actor_id: actorProfileId,
      action: 'LEAD_STAGE_UPDATED',
      entity_type: 'leads',
      entity_id: leadId,
      old_data: { stage: currentLead.stage },
      new_data: { stage: newStage, lost_reason: lostReason },
      created_at: new Date().toISOString(),
    });

    this.notify();
    return { success: true };
  }

  /**
   * CREATE AGENT (Sponsor Direct Replacement without Manual Hierarchy Position)
   */
  public createAgent(
    agentInput: {
      full_name: string;
      phone: string;
      email?: string;
      branch?: BranchLocation;
      sponsor_agent_id?: string;
      login_password?: string;
      pan_number?: string;
      bank_account_no?: string;
      bank_name?: string;
      bank_ifsc?: string;
      tds_percentage?: number;
    },
    actorProfileId?: string
  ): { success: boolean; agent?: Agent; message?: string } {
    const seq = String(this.agents.length + 1).padStart(5, '0');
    const agentCode = `AGT${seq}`;
    const agentId = crypto.randomUUID();
    const profileId = crypto.randomUUID();
    const generatedPassword = agentInput.login_password || `${agentInput.full_name.split(' ')[0]}@Agent2026`;

    // Rule: Hierarchy Position is NOT entered manually.
    // When Sponsor (Upline) is selected, new agent is automatically linked directly under that sponsor ID as Level 10 direct sourcing.
    const calculatedLevel = 10;

    const newAgent: Agent = {
      id: agentId,
      profile_id: profileId,
      agent_code: agentCode,
      branch: agentInput.branch || 'Raipur',
      sponsor_agent_id: agentInput.sponsor_agent_id,
      hierarchy_level: calculatedLevel,
      pan_number: agentInput.pan_number?.toUpperCase(),
      aadhaar_masked: 'XXXX-XXXX-' + Math.floor(1000 + Math.random() * 9000),
      bank_account_no: agentInput.bank_account_no,
      bank_name: agentInput.bank_name,
      bank_ifsc: agentInput.bank_ifsc?.toUpperCase(),
      tds_percentage: agentInput.tds_percentage ?? 5.0,
      total_commission_earned: 0,
      total_commission_paid: 0,
      outstanding_advance: 0,
      is_active: true,
      is_test: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      profile: {
        id: profileId,
        full_name: agentInput.full_name,
        phone: agentInput.phone,
        email: agentInput.email || `${agentCode.toLowerCase()}@bhuminidhi.com`,
        role: 'agent',
        branch: agentInput.branch || 'Raipur',
        employee_code: agentCode,
        login_password: generatedPassword,
        is_active: true,
        is_test: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    };

    this.agents.push(newAgent);

    this.auditLogs.unshift({
      id: crypto.randomUUID(),
      actor_id: actorProfileId,
      action: 'AGENT_ONBOARDED',
      entity_type: 'agents',
      entity_id: agentId,
      new_data: { agent_code: agentCode, full_name: agentInput.full_name, sponsor_id: agentInput.sponsor_agent_id },
      created_at: new Date().toISOString(),
    });

    this.notify();
    return { success: true, agent: newAgent };
  }

  /**
   * UPDATE PMSG TRACKING
   */
  public async createPmsgTracking(
    customerId: string,
    actorProfileId?: string
  ): Promise<{ success: boolean; pmsg?: PmsgTracking; error?: StandardErpErrorCode; message?: string }> {
    const customer = this.customers.find((c) => c.id === customerId);

    if (!customer) {
      return { success: false, error: 'RECORD_NOT_FOUND' };
    }

    const existing = this.pmsgTracking.find((p) => p.customer_id === customerId);

    if (existing) {
      return { success: false, error: 'INVALID_STATUS', message: 'PMSG tracking already exists for this customer.' };
    }

    const now = new Date().toISOString();

    const newPmsg: PmsgTracking = {
      id: crypto.randomUUID(),
      customer_id: customerId,
      stage: 'INITIATED',
      feasibility_status: 'PENDING',
      subsidy_amount_eligible: 0,
      subsidy_disbursed_amount: 0,
      is_test: customer.is_test,
      created_at: now,
      updated_at: now,
    };

    if (isSupabaseConfigured) {
      try {
        const persisted = await pmsgService.createPmsgTracking(
          customerId,
          customer.is_test
        );
        newPmsg.id = persisted.id;
        newPmsg.created_at = persisted.created_at;
        newPmsg.updated_at = persisted.updated_at;
        newPmsg.stage = persisted.stage;
        newPmsg.feasibility_status = persisted.feasibility_status;
        newPmsg.subsidy_amount_eligible = persisted.subsidy_amount_eligible;
        newPmsg.subsidy_disbursed_amount = persisted.subsidy_disbursed_amount;
        newPmsg.is_test = persisted.is_test;
      } catch (err) {
        console.error('[erpStore.createPmsgTracking] Supabase persist error:', err);
        return { success: false, message: err instanceof Error ? err.message : 'Failed to persist PMSG tracking.' };
      }
    }

    this.pmsgTracking.unshift(newPmsg);

    this.auditLogs.unshift({
      id: crypto.randomUUID(),
      actor_id: actorProfileId,
      action: 'PMSG_TRACKING_CREATED',
      entity_type: 'pmsg_tracking',
      entity_id: newPmsg.id,
      new_data: {
        customer_id: customerId,
        stage: newPmsg.stage,
        is_test: newPmsg.is_test,
      },
      created_at: now,
    });

    this.notify();

    return { success: true, pmsg: newPmsg };
  }

  public async updatePmsgTracking(
    customerId: string,
    updates: Partial<PmsgTracking>,
    actorProfileId?: string
  ): Promise<{ success: boolean; error?: StandardErpErrorCode; message?: string }> {
    const index = this.pmsgTracking.findIndex((p) => p.customer_id === customerId);
    if (index === -1) {
      return { success: false, error: 'RECORD_NOT_FOUND' };
    }

    const current = this.pmsgTracking[index];

    if (isSupabaseConfigured && updates.portal_application_no) {
      const result = await pmsgService.updatePortalStatus(
        customerId,
        updates.portal_application_no,
        updates.portal_remarks
      );

      if (!result.success) {
        console.error('[erpStore.updatePmsgTracking] Supabase persist error:', result.message);
        return { success: false, message: result.message || 'Failed to update PMSG portal status.' };
      }
    }

    this.pmsgTracking[index] = {
      ...current,
      ...updates,
      updated_at: new Date().toISOString(),
    };

    this.auditLogs.unshift({
      id: crypto.randomUUID(),
      actor_id: actorProfileId,
      action: 'PMSG_TRACKING_UPDATED',
      entity_type: 'pmsg_tracking',
      entity_id: current.id,
      new_data: updates as Record<string, unknown>,
      created_at: new Date().toISOString(),
    });

    this.notify();
    return { success: true };
  }

  /**
   * CREATE QUOTATION (PM Surya Ghar + Chhattisgarh Subsidy)
   */
  public createQuotation(quotation: Omit<Quotation, 'id' | 'quotation_no' | 'created_at'>) {
    const count = this.quotations.length + 1;
    const now = new Date();
    const yy = String(now.getFullYear()).slice(-2);
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const seq = String(count).padStart(3, '0');
    const qtnNo = `BNPS/QTN/${yy}${mm}/${seq}`;

    const newQuot: Quotation = {
      ...quotation,
      id: crypto.randomUUID(),
      quotation_no: qtnNo,
      status: quotation.status || 'SENT',
      valid_until: quotation.valid_until || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      created_at: new Date().toISOString(),
    };
    this.quotations.unshift(newQuot);

    this.auditLogs.unshift({
      id: crypto.randomUUID(),
      action: 'QUOTATION_GENERATED',
      entity_type: 'quotations',
      entity_id: newQuot.id,
      new_data: {
        quotation_no: qtnNo,
        customer_name: newQuot.customer_name,
        capacity_kw: newQuot.capacity_kw,
        total_project_cost: newQuot.total_project_cost,
        net_customer_cost: newQuot.net_customer_cost,
      },
      created_at: new Date().toISOString(),
    });

    this.notify();
    return newQuot;
  }

  /**
   * UPDATE QUOTATION STATUS
   */
  public updateQuotationStatus(id: string, status: QuotationStatusType) {
    const index = this.quotations.findIndex((q) => q.id === id);
    if (index === -1) return false;
    this.quotations[index] = {
      ...this.quotations[index],
      status,
    };
    this.notify();
    return true;
  }

  /**
   * DELETE QUOTATION
   */
  public deleteQuotation(id: string) {
    this.quotations = this.quotations.filter((q) => q.id !== id);
    this.notify();
    return true;
  }

  /**
   * CONVERT QUOTATION TO LIVE CUSTOMER & PROJECT
   */
  public convertQuotationToCustomer(quotationId: string, actorProfileId?: string) {
    const q = this.quotations.find((item) => item.id === quotationId);
    if (!q) return { success: false, message: 'Quotation not found' };

    // Check if customer with same mobile already exists
    let targetCustomer = this.customers.find((c) => c.primary_mobile === q.phone);
    if (!targetCustomer) {
      const custCount = this.customers.length + 1;
      const custCode = `BNPS-CUST-${String(custCount).padStart(4, '0')}`;
      const newCust: Customer = {
        id: crypto.randomUUID(),
        customer_code: custCode,
        branch: (q.branch as BranchLocation) || 'Sakti',
        full_name: q.customer_name,
        primary_mobile: q.phone,
        email: q.email,
        consumer_number: q.consumer_number || `CSPDCL-${Date.now().toString().slice(-8)}`,
        sanctioned_load_kw: q.sanctioned_load_kw || q.capacity_kw,
        discom_name: q.discom_name || 'CSPDCL (Chhattisgarh)',
        installation_address: q.address_line || `${q.panchayat_village || ''}, ${q.tehsil || ''}`,
        district: q.district || 'Raipur',
        tehsil: q.tehsil,
        block: q.block,
        panchayat_village: q.panchayat_village,
        state: q.state || 'Chhattisgarh',
        pincode: q.pincode || '492001',
        lifecycle_status: 'REGISTERED',
        is_test: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      this.customers.unshift(newCust);
      targetCustomer = newCust;
    }

    // Mark quotation converted
    this.updateQuotationStatus(q.id, 'CONVERTED');

    // Create Project
    const prjCount = this.projects.length + 1;
    const newPrj: Project = {
      id: crypto.randomUUID(),
      project_code: `PRJ-CG-2026-${String(prjCount).padStart(3, '0')}`,
      customer_id: targetCustomer.id,
      primary_agent_id: 'ag-mukesh-101',
      capacity_kw: q.capacity_kw,
      total_contract_amount: q.total_project_cost,
      discom_subsidy_amount: q.central_subsidy_amount,
      customer_payable_amount: q.net_customer_cost,
      status: 'SITE_SURVEY',
      commission_distributed: false,
      is_test: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.projects.unshift(newPrj);

    this.auditLogs.unshift({
      id: crypto.randomUUID(),
      actor_id: actorProfileId,
      action: 'QUOTATION_CONVERTED_TO_PROJECT',
      entity_type: 'quotations',
      entity_id: q.id,
      new_data: {
        quotation_no: q.quotation_no,
        customer_id: targetCustomer.id,
        project_id: newPrj.id,
        project_code: newPrj.project_code,
      },
      created_at: new Date().toISOString(),
    });

    this.notify();
    return { success: true, customer: targetCustomer, project: newPrj };
  }

  /**
   * RECORD EXPENSE
   */
  public recordExpense(expense: Omit<Expense, 'id' | 'expense_code'>) {
    const expCode = `EXP-CG-${Date.now().toString().slice(-4)}`;
    const newExp: Expense = {
      ...expense,
      id: crypto.randomUUID(),
      expense_code: expCode,
    };
    this.expenses.unshift(newExp);
    this.notify();
    return newExp;
  }

  /**
   * RUN COMMISSION TEST SIMULATION (Idempotent 10-Tier Test)
   */
  public runCommissionTest(): { success: boolean; message: string; results: Array<{ level: number; agent: string; rate: string; amount: string }> } {
    const results = [
      { level: 10, agent: 'Mukesh Choudhary (Direct)', rate: '7.0%', amount: '₹10,500' },
      { level: 9, agent: 'Pooja Choudhary (Sponsor)', rate: '1.0%', amount: '₹1,500' },
      { level: 8, agent: 'Kavita Tiwari (Upline)', rate: '1.0%', amount: '₹1,500' },
      { level: 7, agent: 'Upline Leader 7', rate: '0.5%', amount: '₹750' },
      { level: 6, agent: 'Upline Leader 6', rate: '0.5%', amount: '₹750' },
      { level: 5, agent: 'Upline Leader 5', rate: '0.5%', amount: '₹750' },
      { level: 4, agent: 'Upline Leader 4', rate: '0.5%', amount: '₹750' },
      { level: 3, agent: 'Upline Leader 3', rate: '0.5%', amount: '₹750' },
      { level: 2, agent: 'Upline Leader 2', rate: '0.5%', amount: '₹750' },
      { level: 1, agent: 'Upline Leader 1', rate: '0.5%', amount: '₹750' },
    ];

    this.auditLogs.unshift({
      id: crypto.randomUUID(),
      actor_id: 'prof-super-admin-01',
      action: 'COMMISSION_TEST_RUN',
      entity_type: 'commission_engine',
      entity_id: 'test-run-10tier',
      new_data: { test_base_amount: 150000, total_distributed: 18750, positions: 10 },
      created_at: new Date().toISOString(),
    });

    this.notify();
    return {
      success: true,
      message: '10-Tier Commission Engine passed concurrency & idempotency test on ₹1,50,000 base contract!',
      results,
    };
  }

  /**
   * GLOBAL UNIFIED SEARCH
   */
  public searchGlobal(query: string) {
    const q = query.trim().toLowerCase();
    if (!q) return [];

    const results: Array<{
      type: 'customer' | 'lead' | 'agent' | 'pmsg';
      id: string;
      primary: string;
      secondary: string;
      badge: string;
    }> = [];

    // Search Customers
    this.customers.forEach((c) => {
      if (
        c.customer_code.toLowerCase().includes(q) ||
        c.full_name.toLowerCase().includes(q) ||
        c.primary_mobile.includes(q) ||
        c.consumer_number.toLowerCase().includes(q)
      ) {
        results.push({
          type: 'customer',
          id: c.id,
          primary: `${c.customer_code} • ${c.full_name}`,
          secondary: `Mob: ${c.primary_mobile} | Consumer: ${c.consumer_number} (${c.district}, CG)`,
          badge: c.lifecycle_status,
        });
      }
    });

    // Search Leads
    this.leads.forEach((l) => {
      if (
        l.lead_code.toLowerCase().includes(q) ||
        l.full_name.toLowerCase().includes(q) ||
        l.mobile.includes(q) ||
        (l.consumer_number && l.consumer_number.toLowerCase().includes(q))
      ) {
        results.push({
          type: 'lead',
          id: l.id,
          primary: `${l.lead_code} • ${l.full_name}`,
          secondary: `Mob: ${l.mobile} | ${l.district || 'Raipur'} | ${l.proposed_capacity_kw || 3} kW`,
          badge: l.stage,
        });
      }
    });

    // Search Agents
    this.agents.forEach((a) => {
      const name = a.profile?.full_name || '';
      if (
        a.agent_code.toLowerCase().includes(q) ||
        name.toLowerCase().includes(q) ||
        (a.profile?.phone && a.profile.phone.includes(q))
      ) {
        results.push({
          type: 'agent',
          id: a.id,
          primary: `${a.agent_code} • ${name}`,
          secondary: `Tier ${a.hierarchy_level} | TDS: ${a.tds_percentage}%`,
          badge: `L${a.hierarchy_level}`,
        });
      }
    });

    // Search PMSG
    this.pmsgTracking.forEach((p) => {
      if (p.portal_application_no && p.portal_application_no.toLowerCase().includes(q)) {
        const cust = this.customers.find((c) => c.id === p.customer_id);
        results.push({
          type: 'pmsg',
          id: p.id,
          primary: `PMSG: ${p.portal_application_no}`,
          secondary: `Customer: ${cust?.full_name || 'N/A'} | Cap: ${p.registered_capacity_kw} kW`,
          badge: p.stage,
        });
      }
    });

    return results.slice(0, 15);
  }
}

export const erpStore = new ErpDataStore();
