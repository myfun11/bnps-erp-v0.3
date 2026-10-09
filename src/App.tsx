import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Header } from './components/layout/Header';
import { Sidebar } from './components/layout/Sidebar';
import LoginPage from './components/auth/LoginPage';
import { GlobalSearch } from './components/GlobalSearch';
import { CommissionTestModal } from './components/modals/CommissionTestModal';
import { customerService } from './services/customerService';
import { agentNetworkService } from './services/agentNetworkService';
import { quotationService } from './services/quotationService';

// Pages & Modules
import { OverviewDashboard } from './components/dashboard/OverviewDashboard';
import { LeadList } from './components/leads/LeadList';
import { CustomerList } from './components/customers/CustomerList';
import { AgentNetwork } from './components/agents/AgentNetwork';
import { AgentTreeView } from './components/agents/AgentTreeView';
import { PmsgTrackingPage } from './components/modules/PmsgTrackingPage';
import { QuotationsPage } from './components/modules/QuotationsPage';
import { ProjectsPage } from './components/modules/ProjectsPage';
import { InstallationsPage } from './components/modules/InstallationsPage';
import { LoansPage } from './components/modules/LoansPage';
import { PaymentsPage } from './components/modules/PaymentsPage';
import { CommissionsPage } from './components/modules/CommissionsPage';
import { RewardsPage } from './components/modules/RewardsPage';
import { FinanceExpensesPage } from './components/modules/FinanceExpensesPage';
import { ReportsPage } from './components/modules/ReportsPage';
import { DocumentsPage } from './components/modules/DocumentsPage';
import { AuditLogViewer } from './components/audit/AuditLogViewer';
import { BranchStaffManagement } from './components/branches/BranchStaffManagement';
import { UserAdministrationPage } from './components/modules/UserAdministrationPage';
import { Footer } from './components/layout/Footer';

import { erpStore } from './services/erpStore';

function ErpAppShell() {
  const { isAuthenticated } = useAuth();
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isCommissionTestOpen, setIsCommissionTestOpen] = useState(false);
  const [openNewLeadModal, setOpenNewLeadModal] = useState(false);
  const [highlightCustomerId, setHighlightCustomerId] = useState<string | null>(null);

  const [customerCount, setCustomerCount] = useState<number>(erpStore.getCustomers().length);
  const [agentCount, setAgentCount] = useState<number>(erpStore.getAgents().length);
  const [quotationCount, setQuotationCount] = useState<number>(erpStore.getQuotations().length);

  useEffect(() => {
    let mounted = true;
    const syncCounts = async () => {
      try {
        const [cList, aList, qList] = await Promise.all([
          customerService.fetchCustomers(),
          agentNetworkService.list(),
          quotationService.list(),
        ]);
        if (mounted) {
          setCustomerCount(cList.length);
          setAgentCount(aList.length);
          setQuotationCount(qList.length);
        }
      } catch (err) {
        if (mounted) {
          setCustomerCount(erpStore.getCustomers().length);
          setAgentCount(erpStore.getAgents().length);
          setQuotationCount(erpStore.getQuotations().length);
        }
      }
    };

    if (isAuthenticated) {
      syncCounts();
    }
    const unsub = erpStore.subscribe(syncCounts);
    return () => {
      mounted = false;
      unsub();
    };
  }, [isAuthenticated]);

  // If not authenticated, show dedicated Login Page
  if (!isAuthenticated) {
    return <LoginPage />;
  }

  const handleOpenCustomer = (customerId: string) => {
    setHighlightCustomerId(customerId);
    setActiveTab('customers');
  };

  const handleSelectSearchEntity = (type: string, id: string) => {
    if (type === 'customer' || type === 'pmsg') {
      setHighlightCustomerId(id);
      setActiveTab('customers');
    } else if (type === 'lead') {
      setActiveTab('leads');
    } else if (type === 'agent') {
      setActiveTab('agents');
    }
  };

  return (
    <div className="h-screen w-screen bg-slate-950 text-slate-100 flex flex-col font-sans overflow-hidden selection:bg-amber-500 selection:text-slate-950">
      {/* Top Application Header */}
      <div className="shrink-0 z-40">
        <Header
          onOpenSearch={() => setIsSearchOpen(true)}
          onOpenNewLead={() => {
            setActiveTab('leads');
            setOpenNewLeadModal(true);
          }}
          onRunCommissionTest={() => setIsCommissionTestOpen(true)}
          onOpenBranches={() => setActiveTab('user-admin')}
        />
      </div>

      {/* Main Layout: Fixed/Static Left Sidebar + Scrollable Dynamic Page Workspace */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* Left Sidebar Menu (Static / Fixed on Left) */}
        <Sidebar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          customerCount={customerCount}
          agentCount={agentCount}
          quotationCount={quotationCount}
        />

        {/* Right Active Page Workspace (Scrolls up and down) */}
        <main className="flex-1 h-full overflow-y-auto p-4 sm:p-6 lg:p-8 custom-scrollbar">
          <div className="max-w-7xl mx-auto">
            {activeTab === 'dashboard' && (
              <OverviewDashboard
                onNavigate={(tab) => setActiveTab(tab)}
                onOpenNewLead={() => {
                  setActiveTab('leads');
                  setOpenNewLeadModal(true);
                }}
                onRunCommissionTest={() => setIsCommissionTestOpen(true)}
              />
            )}

            {activeTab === 'user-admin' && (
              <UserAdministrationPage />
            )}

            {activeTab === 'leads' && (
              <LeadList
                onOpenCustomer={handleOpenCustomer}
                openNewLeadDirectly={openNewLeadModal}
                onCloseNewLeadDirectly={() => setOpenNewLeadModal(false)}
              />
            )}

            {activeTab === 'customers' && (
              <CustomerList initialSelectedCustomerId={highlightCustomerId} />
            )}

            {activeTab === 'agents' && (
              <AgentNetwork />
            )}

            {activeTab === 'agent-tree' && (
              <AgentTreeView />
            )}

            {activeTab === 'pmsg' && (
              <PmsgTrackingPage />
            )}

            {activeTab === 'quotations' && (
              <QuotationsPage />
            )}

            {activeTab === 'projects' && (
              <ProjectsPage />
            )}

            {activeTab === 'installations' && (
              <InstallationsPage />
            )}

            {activeTab === 'loans' && (
              <LoansPage />
            )}

            {activeTab === 'payments' && (
              <PaymentsPage />
            )}

            {activeTab === 'commissions' && (
              <CommissionsPage />
            )}

            {activeTab === 'rewards' && (
              <RewardsPage />
            )}

            {activeTab === 'finance' && (
              <FinanceExpensesPage />
            )}

            {activeTab === 'reports' && (
              <ReportsPage />
            )}

            {activeTab === 'documents' && (
              <DocumentsPage />
            )}

            {activeTab === 'audit' && (
              <AuditLogViewer />
            )}

            {activeTab === 'branches' && (
              <BranchStaffManagement />
            )}
          </div>

          {/* Corporate Footer with full company details */}
          <Footer />
        </main>
      </div>

      {/* Global Unified Search Modal */}
      <GlobalSearch
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        onSelectEntity={handleSelectSearchEntity}
      />

      {/* Commission Test Modal */}
      <CommissionTestModal
        isOpen={isCommissionTestOpen}
        onClose={() => setIsCommissionTestOpen(false)}
      />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <ErpAppShell />
    </AuthProvider>
  );
}
