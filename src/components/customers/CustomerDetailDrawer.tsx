import React, { useState } from 'react';
import { Customer, DocumentRecord } from '../../types/database';
import { erpStore } from '../../services/erpStore';
import { useAuth } from '../../context/AuthContext';
import { documentService } from '../../services/documentService';
import { 
  X, 
  User, 
  Phone, 
  MapPin, 
  FileText, 
  Zap, 
  ShieldCheck, 
  ExternalLink,
  Edit2,
  CheckCircle2,
  AlertCircle,
  Lock,
  Wrench,
  FolderKanban,
  Files,
  Upload,
  Check,
  Calendar,
  Layers,
  FileCheck
} from 'lucide-react';

interface CustomerDetailDrawerProps {
  customer: Customer | null;
  isOpen: boolean;
  onClose: () => void;
}

export const CustomerDetailDrawer: React.FC<CustomerDetailDrawerProps> = ({
  customer,
  isOpen,
  onClose,
}) => {
  const { currentProfile, userRole, hasPermission } = useAuth();
  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'PROJECT_INSTALLATION' | 'DOCUMENTS'>('OVERVIEW');
  const [editingPmsg, setEditingPmsg] = useState(false);
  const [portalAppNo, setPortalAppNo] = useState('');
  const [saving, setSaving] = useState(false);

  // Document upload state
  const [uploadCategory, setUploadCategory] = useState<'ELECTRICITY_BILL' | 'AADHAAR_FRONT' | 'AADHAAR_BACK' | 'BANK_PASSBOOK_OR_CHEQUE' | 'ROOF_PHOTO' | 'PAN_CARD'>('ELECTRICITY_BILL');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // Quick installation schedule
  const [showScheduleInst, setShowScheduleInst] = useState(false);
  const [structureType, setStructureType] = useState('ELEVATED_GI_HOT_DIP');
  const [moduleMake, setModuleMake] = useState('Waaree 540Wp Bi-facial TOPCon');
  const [inverterMake, setInverterMake] = useState('Growatt 3.3kW Dual MPPT');

  if (!isOpen || !customer) return null;

  const pmsg = erpStore.getPmsgByCustomerId(customer.id);
  const isFinalized = Boolean(pmsg && (pmsg.portal_application_no || pmsg.stage !== 'INITIATED'));
  const canCreatePmsg = hasPermission('pmsg.create');

  // Customer projects & installations
  const customerProjects = erpStore.getProjects().filter(p => p.customer_id === customer.id);
  const primaryProject = customerProjects[0];
  const customerInstallations = primaryProject 
    ? erpStore.getInstallations().filter(i => i.project_id === primaryProject.id)
    : [];
  const primaryInstallation = customerInstallations[0];

  // Customer KYC & portal documents (Canonical singular entity_type 'customer' + linked source lead documents)
  const convertedLead = erpStore.getLeads().find(l => l.converted_customer_id === customer.id);
  const directCustomerDocs = erpStore.getDocuments({ entityType: 'customer', entityId: customer.id });
  const linkedLeadDocs = convertedLead 
    ? erpStore.getDocuments({ entityType: 'lead', entityId: convertedLead.id })
    : [];
  // Unified document set without metadata duplication
  const customerDocs = [...directCustomerDocs, ...linkedLeadDocs];

  const handleCreatePmsg = async () => {
    if (!canCreatePmsg || pmsg || saving) return;

    setSaving(true);
    const result = await erpStore.createPmsgTracking(
      customer.id,
      currentProfile.id
    );
    setSaving(false);

    if (!result.success) {
      console.error('[CustomerDetailDrawer] PMSG registration failed:', result.error);
    }
  };

  const handleSavePmsg = async () => {
    if (portalAppNo.trim() && !isFinalized) {
      setSaving(true);
      const result = await erpStore.updatePmsgTracking(
        customer.id,
        {
          portal_application_no: portalAppNo.trim(),
          stage: 'APPLICATION_SUBMITTED',
          application_submission_date: new Date().toISOString().split('T')[0],
        },
        currentProfile.id
      );
      setSaving(false);
      if (!result.success) {
        return;
      }
      setEditingPmsg(false);
    }
  };

  const handleUploadDoc = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile) {
      alert('Please choose a file to upload.');
      return;
    }

    setIsUploading(true);
    try {
      await documentService.uploadDocument(
        uploadFile,
        'customer',
        customer.id,
        uploadCategory,
        false
      );
      setUploadFile(null);
      alert('Document uploaded to customer KYC repository.');
    } catch (err: any) {
      alert(err?.message || 'Upload failed.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleVerifyDoc = async (docId: string) => {
    try {
      await documentService.verifyDocument(docId);
      alert('Document verified.');
    } catch (err: any) {
      alert(err?.message || 'Verification failed.');
    }
  };

  const handleScheduleInstallation = () => {
    if (!primaryProject) {
      alert('Customer does not have an active project assigned.');
      return;
    }

    erpStore.createInstallation({
      project_id: primaryProject.id,
      structure_type: structureType,
      solar_module_make: moduleMake,
      solar_module_capacity_wp: 540,
      solar_module_quantity: Math.ceil((primaryProject.capacity_kw * 1000) / 540),
      inverter_make: inverterMake,
      inverter_capacity_kw: primaryProject.capacity_kw,
      dispatch_date: new Date().toISOString().split('T')[0],
      installation_start_date: new Date().toISOString().split('T')[0],
      net_meter_installed: false,
      discom_inspection_signoff: false,
      notes: `Scheduled via Customer Master: ${customer.full_name}`,
    });

    setShowScheduleInst(false);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-950/60 backdrop-blur-sm animate-fade-in flex justify-end">
      <div className="w-full max-w-2xl bg-slate-900 border-l border-slate-800 h-full flex flex-col shadow-2xl overflow-y-auto">
        {/* Drawer Header */}
        <div className="p-6 border-b border-slate-800 bg-slate-900/90 flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-semibold border border-amber-500/30">
                {customer.customer_code}
              </span>
              <span className={`text-xs px-2.5 py-0.5 rounded-full font-mono font-bold ${
                customer.lifecycle_status === 'INSTALLED' || customer.lifecycle_status === 'COMMISSIONED'
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
              }`}>
                {customer.lifecycle_status}
              </span>
            </div>
            <h3 className="text-lg font-bold text-slate-100 mt-2">{customer.full_name}</h3>
            <p className="text-xs text-slate-400">Authoritative Single Master Record • ID: {customer.id}</p>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Drawer Tabs */}
        <div className="flex border-b border-slate-800 bg-slate-950/40 px-6 pt-2">
          <button
            onClick={() => setActiveTab('OVERVIEW')}
            className={`px-4 py-2.5 text-xs font-semibold border-b-2 flex items-center gap-1.5 transition-colors cursor-pointer ${
              activeTab === 'OVERVIEW'
                ? 'border-amber-400 text-amber-400 font-bold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            <span>Profile & PM Surya Ghar</span>
          </button>
          <button
            onClick={() => setActiveTab('PROJECT_INSTALLATION')}
            className={`px-4 py-2.5 text-xs font-semibold border-b-2 flex items-center gap-1.5 transition-colors cursor-pointer ${
              activeTab === 'PROJECT_INSTALLATION'
                ? 'border-amber-400 text-amber-400 font-bold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Wrench className="w-3.5 h-3.5" />
            <span>Project & Installation ({customerInstallations.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('DOCUMENTS')}
            className={`px-4 py-2.5 text-xs font-semibold border-b-2 flex items-center gap-1.5 transition-colors cursor-pointer ${
              activeTab === 'DOCUMENTS'
                ? 'border-amber-400 text-amber-400 font-bold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Files className="w-3.5 h-3.5" />
            <span>KYC Vault ({customerDocs.length})</span>
          </button>
        </div>

        {/* Drawer Body */}
        <div className="p-6 space-y-6 flex-1">
          {activeTab === 'OVERVIEW' && (
            <>
              {/* Contact & Location Block */}
              <div className="bg-slate-800/60 rounded-xl p-4 border border-slate-700/60 space-y-3">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-amber-400" />
                  <span>Contact & Identity</span>
                </h4>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-slate-400 block">Primary Mobile</span>
                    <span className="text-slate-100 font-mono font-medium">{customer.primary_mobile}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Alternate Mobile</span>
                    <span className="text-slate-100 font-mono">{customer.alternate_mobile || 'None'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Email Address</span>
                    <span className="text-slate-100">{customer.email || 'None'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Aadhaar (Masked)</span>
                    <span className="text-slate-100 font-mono">{customer.aadhaar_masked || 'XXXX-XXXX-Verified'}</span>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-700/40 text-xs">
                  <span className="text-slate-400 block">Installation Address</span>
                  <span className="text-slate-200 mt-0.5 block">
                    {customer.installation_address}, {customer.district}, {customer.state} - {customer.pincode}
                  </span>
                </div>
              </div>

              {/* Electricity & Discom Connection */}
              <div className="bg-slate-800/60 rounded-xl p-4 border border-slate-700/60 space-y-3">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-amber-400" />
                  <span>Discom Electricity Account</span>
                </h4>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-slate-400 block">Distribution Company</span>
                    <span className="text-slate-100 font-semibold">{customer.discom_name}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Consumer Number (CA/K-No)</span>
                    <span className="text-amber-400 font-mono font-bold">{customer.consumer_number}</span>
                  </div>
                </div>
              </div>

              {/* PM Surya Ghar Operational State Tracking */}
              <div className="bg-slate-800/60 rounded-xl p-4 border border-slate-700/60 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                    <ExternalLink className="w-3.5 h-3.5 text-amber-400" />
                    <span>PM Surya Ghar Portal Tracking</span>
                  </h4>
                  {pmsg && !editingPmsg && (
                    isFinalized ? (
                      <span className="text-[11px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center gap-1 font-mono">
                        <Lock className="w-3 h-3 text-emerald-400" />
                        <span>Portal Submitted (Read-Only)</span>
                      </span>
                    ) : (
                      <button
                        onClick={() => {
                          setPortalAppNo(pmsg.portal_application_no || '');
                          setEditingPmsg(true);
                        }}
                        className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1 cursor-pointer"
                      >
                        <Edit2 className="w-3 h-3" />
                        <span>Update Portal No</span>
                      </button>
                    )
                  )}
                </div>

                {pmsg ? (
                  <div className="space-y-3 text-xs">
                    {editingPmsg ? (
                      <div className="p-3 bg-slate-900/90 rounded-lg border border-slate-700 space-y-2">
                        <label className="text-[11px] font-semibold text-slate-300 block">
                          National Portal Application Number
                        </label>
                        <input
                          type="text"
                          value={portalAppNo}
                          onChange={(e) => setPortalAppNo(e.target.value)}
                          placeholder="e.g. CG-CSPDCL-2026-XXXXX"
                          className="w-full px-3 py-1.5 rounded bg-slate-800 border border-slate-700 text-xs font-mono text-slate-100 focus:outline-none focus:border-amber-400"
                        />
                        <div className="flex justify-end gap-2 pt-1">
                          <button
                            onClick={() => setEditingPmsg(false)}
                            className="px-2.5 py-1 text-xs text-slate-400 hover:text-white cursor-pointer"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={handleSavePmsg}
                            className="px-3 py-1 text-xs bg-amber-500 text-slate-950 font-bold rounded cursor-pointer"
                          >
                            Save & Sync
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <span className="text-slate-400 block">Portal Application No</span>
                          <span className="text-slate-100 font-mono font-semibold">
                            {pmsg.portal_application_no || 'Pending Portal Submission'}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400 block">Tracking Stage</span>
                          <span className="text-amber-300 font-medium font-mono">{pmsg.stage}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block">Capacity Registered</span>
                          <span className="text-slate-100">{pmsg.registered_capacity_kw ? `${pmsg.registered_capacity_kw} kW` : 'Not entered'}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block">Govt Subsidy Eligible</span>
                          <span className="text-emerald-400 font-semibold font-mono">
                            ₹{pmsg.subsidy_amount_eligible > 0 ? pmsg.subsidy_amount_eligible.toLocaleString('en-IN') : 'Not calculated'}
                          </span>
                        </div>
                      </div>
                    )}

                    {pmsg.portal_remarks && (
                      <p className="text-[11px] text-slate-400 bg-slate-900/60 p-2 rounded border border-slate-700/40">
                        Remarks: {pmsg.portal_remarks}
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-3 rounded-lg border border-dashed border-slate-700 bg-slate-900/40 px-3 py-3">
                    <div>
                      <p className="text-xs text-slate-300 font-medium">PM Surya Ghar registration not initiated</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Registration creates the initial PMSG tracking record only.
                      </p>
                    </div>

                    {canCreatePmsg && (
                      <button
                        type="button"
                        onClick={handleCreatePmsg}
                        disabled={saving}
                        className="shrink-0 px-3 py-1.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/30 hover:bg-amber-500/20 disabled:opacity-50 disabled:cursor-not-allowed text-xs font-semibold cursor-pointer"
                      >
                        {saving ? 'Registering...' : 'Register on PM Surya Ghar'}
                      </button>
                    )}
                  </div>
                )}
              </div>
            </>
          )}

          {activeTab === 'PROJECT_INSTALLATION' && (
            <div className="space-y-4">
              {/* Project Card */}
              {primaryProject ? (
                <div className="bg-slate-800/60 rounded-xl p-4 border border-slate-700/60 space-y-3">
                  <div className="flex justify-between items-center">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                      <FolderKanban className="w-3.5 h-3.5 text-amber-400" />
                      <span>Contracted Rooftop Solar Project</span>
                    </h4>
                    <span className="text-xs font-mono font-bold text-amber-400 bg-amber-500/15 px-2 py-0.5 rounded border border-amber-500/30">
                      {primaryProject.project_code}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
                    <div>
                      <span className="text-slate-400 block text-[10px] font-sans">Capacity</span>
                      <span className="text-slate-100 font-bold">{primaryProject.capacity_kw} kW</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] font-sans">Contract Value</span>
                      <span className="text-slate-100 font-bold">₹{primaryProject.total_contract_amount.toLocaleString('en-IN')}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] font-sans">Govt Subsidy</span>
                      <span className="text-emerald-400 font-bold">₹{primaryProject.discom_subsidy_amount.toLocaleString('en-IN')}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px] font-sans">Project Stage</span>
                      <span className="text-amber-300 font-bold">{primaryProject.status}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-4 rounded-xl border border-dashed border-slate-700 bg-slate-900/40 text-center text-xs text-slate-400">
                  No contracted project active for this customer.
                </div>
              )}

              {/* Installation Card */}
              {primaryInstallation ? (
                <div className="bg-slate-800/60 rounded-xl p-4 border border-slate-700/60 space-y-3">
                  <div className="flex justify-between items-center">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Wrench className="w-3.5 h-3.5 text-amber-400" />
                      <span>Rooftop Solar Installation Details</span>
                    </h4>
                    <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold font-mono ${
                      primaryInstallation.discom_inspection_signoff && primaryInstallation.net_meter_installed
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        : primaryInstallation.net_meter_installed
                        ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30'
                        : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    }`}>
                      {primaryInstallation.discom_inspection_signoff && primaryInstallation.net_meter_installed
                        ? 'COMPLETED / COMMISSIONED'
                        : primaryInstallation.net_meter_installed
                        ? 'NET METER LIVE'
                        : 'INSTALLATION IN PROGRESS'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-slate-400 block">Structure Type</span>
                      <span className="text-slate-100 font-medium">{primaryInstallation.structure_type}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Solar Modules</span>
                      <span className="text-slate-100 font-medium">
                        {primaryInstallation.solar_module_make} ({primaryInstallation.solar_module_quantity} Panels)
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Solar Inverter</span>
                      <span className="text-slate-100 font-medium">{primaryInstallation.inverter_make}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Net Meter Serial No</span>
                      <span className="text-amber-400 font-mono font-bold">
                        {primaryInstallation.net_meter_serial_no || 'Pending CSPDCL Meter Installation'}
                      </span>
                    </div>
                  </div>

                  {primaryInstallation.discom_inspection_signoff && (
                    <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-xs text-emerald-300 flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        Discom Testing Sign-off: {primaryInstallation.inspector_name || 'CSPDCL Testing Division'}
                      </span>
                      <span className="font-mono">{primaryInstallation.discom_inspection_date}</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-4 rounded-xl border border-dashed border-slate-700 bg-slate-900/40 text-center space-y-2">
                  <p className="text-xs text-slate-400">No installation record found for this customer project.</p>
                  {primaryProject && (
                    <button
                      onClick={() => setShowScheduleInst(true)}
                      className="px-3 py-1.5 rounded-lg bg-amber-500 text-slate-950 font-bold text-xs cursor-pointer hover:bg-amber-400"
                    >
                      + Schedule Solar Installation
                    </button>
                  )}
                </div>
              )}

              {/* Schedule Installation Modal */}
              {showScheduleInst && (
                <div className="p-4 bg-slate-950 rounded-xl border border-amber-500/40 space-y-3">
                  <h5 className="text-xs font-bold text-amber-300 uppercase tracking-wider">Schedule New Installation</h5>
                  <div className="space-y-2 text-xs">
                    <div>
                      <label className="text-slate-400 block mb-1">Structure Type</label>
                      <input 
                        type="text" 
                        value={structureType} 
                        onChange={(e) => setStructureType(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded p-1.5 text-slate-100"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 block mb-1">Module Make</label>
                      <input 
                        type="text" 
                        value={moduleMake} 
                        onChange={(e) => setModuleMake(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded p-1.5 text-slate-100"
                      />
                    </div>
                    <div>
                      <label className="text-slate-400 block mb-1">Inverter Make</label>
                      <input 
                        type="text" 
                        value={inverterMake} 
                        onChange={(e) => setInverterMake(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded p-1.5 text-slate-100"
                      />
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                      <button 
                        onClick={() => setShowScheduleInst(false)}
                        className="px-3 py-1 text-slate-400 text-xs hover:text-white"
                      >
                        Cancel
                      </button>
                      <button 
                        onClick={handleScheduleInstallation}
                        className="px-3 py-1 bg-amber-500 text-slate-950 font-bold rounded text-xs"
                      >
                        Confirm Schedule
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'DOCUMENTS' && (
            <div className="space-y-4">
              {/* Upload Document Section */}
              <form onSubmit={handleUploadDoc} className="bg-slate-800/60 p-4 rounded-xl border border-slate-700/60 space-y-3">
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Upload className="w-3.5 h-3.5 text-amber-400" />
                  <span>Upload Customer KYC & Discom Document</span>
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="text-slate-400 block mb-1">Document Category</label>
                    <select
                      value={uploadCategory}
                      onChange={(e) => setUploadCategory(e.target.value as any)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-slate-200"
                    >
                      <option value="ELECTRICITY_BILL">CSPDCL Electricity Bill</option>
                      <option value="AADHAAR_FRONT">Aadhaar Card (Front)</option>
                      <option value="AADHAAR_BACK">Aadhaar Card (Back)</option>
                      <option value="BANK_PASSBOOK_OR_CHEQUE">Bank Passbook / Cancelled Cheque</option>
                      <option value="ROOF_PHOTO">Rooftop Site Photo</option>
                      <option value="PAN_CARD">PAN Card</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-slate-400 block mb-1">Select File (PDF, JPG, PNG)</label>
                    <input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png"
                      onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                      className="w-full text-slate-400 file:mr-3 file:py-1 file:px-3 file:rounded file:border-0 file:text-xs file:bg-slate-700 file:text-slate-200 file:cursor-pointer"
                    />
                  </div>
                </div>
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={isUploading}
                    className="px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs cursor-pointer disabled:opacity-50"
                  >
                    {isUploading ? 'Uploading...' : 'Upload Document'}
                  </button>
                </div>
              </form>

              {/* Uploaded Documents List */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Verified Customer Documents ({customerDocs.length})
                </h4>
                {customerDocs.length === 0 ? (
                  <div className="p-6 rounded-xl border border-dashed border-slate-800 text-center text-xs text-slate-500">
                    No documents uploaded yet for this customer.
                  </div>
                ) : (
                  customerDocs.map(doc => (
                    <div key={doc.id} className="p-3 rounded-xl bg-slate-800/40 border border-slate-700/60 flex items-center justify-between text-xs">
                      <div>
                        <div className="font-semibold text-slate-200 flex items-center gap-1.5">
                          <FileCheck className="w-4 h-4 text-emerald-400" />
                          <span>{doc.doc_category}</span>
                          <span className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${
                            doc.status === 'VERIFIED' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-300'
                          }`}>
                            {doc.status}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          {doc.file_name} • {doc.file_size_bytes ? `${(doc.file_size_bytes / 1024).toFixed(1)} KB` : 'Uploaded'}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {doc.status !== 'VERIFIED' && (
                          <button
                            onClick={() => handleVerifyDoc(doc.id)}
                            className="px-2.5 py-1 rounded bg-emerald-500/20 hover:bg-emerald-500 text-emerald-300 hover:text-slate-950 text-xs font-semibold cursor-pointer"
                          >
                            Verify
                          </button>
                        )}
                        <span className="text-[10px] text-slate-500 font-mono">
                          {doc.created_at.split('T')[0]}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Master Rule Verification Invariant Note */}
          <div className="p-3.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex gap-2.5 items-start">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400 mt-0.5" />
            <div>
              <span className="font-semibold block text-emerald-200">Single Authoritative Customer Master</span>
              This Customer ID is the authoritative single identity across BNPS ERP. PM Surya Ghar portal registration, solar installation, bank loan processing, and commissions all reference this master record.
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/90 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
