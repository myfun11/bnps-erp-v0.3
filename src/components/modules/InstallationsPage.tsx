import React, { useState, useEffect } from 'react';
import { erpStore } from '../../services/erpStore';
import { installationService } from '../../services/installationService';
import { projectService } from '../../services/projectService';
import { customerService } from '../../services/customerService';
import { Installation, Project, Customer, BranchLocation } from '../../types/database';
import { 
  Wrench, 
  CheckCircle2, 
  Clock, 
  Plus, 
  Zap, 
  Calendar, 
  Search, 
  Filter, 
  ExternalLink,
  ShieldCheck,
  Building,
  Edit2,
  X
} from 'lucide-react';

export const InstallationsPage: React.FC = () => {
  const [installations, setInstallations] = useState<Installation[]>(erpStore.getInstallations());
  const [projects, setProjects] = useState<Project[]>(erpStore.getProjects());
  const [customers, setCustomers] = useState<Customer[]>(erpStore.getCustomers());

  const [filterStage, setFilterStage] = useState<'ALL' | 'PENDING' | 'LIVE' | 'COMPLETED'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Schedule New Installation Modal
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [newInstForm, setNewInstForm] = useState({
    structure_type: 'ELEVATED_GI_HOT_DIP',
    solar_module_make: 'Waaree Bifacial TOPCon 540Wp',
    solar_module_capacity_wp: 540,
    solar_module_quantity: 6,
    inverter_make: 'Growatt 3.3kW On-Grid Dual MPPT',
    inverter_capacity_kw: 3.3,
    inverter_serial_no: '',
    dispatch_date: new Date().toISOString().split('T')[0],
    notes: '',
  });

  // Edit / Complete Installation Modal
  const [editingInst, setEditingInst] = useState<Installation | null>(null);
  const [editNetMeterNo, setEditNetMeterNo] = useState('');
  const [editNetMeterDate, setEditNetMeterDate] = useState('');
  const [editInspectionDate, setEditInspectionDate] = useState('');
  const [editInspectorName, setEditInspectorName] = useState('');
  const [editDiscomSignoff, setEditDiscomSignoff] = useState(false);
  const [editNotes, setEditNotes] = useState('');

  const refreshData = async () => {
    try {
      const [insts, projs, custs] = await Promise.all([
        installationService.fetchInstallations(),
        projectService.fetchProjects(),
        customerService.fetchCustomers(),
      ]);
      setInstallations(insts);
      setProjects(projs);
      setCustomers(custs);
    } catch (err) {
      console.error('Error refreshing installations data:', err);
      setInstallations(erpStore.getInstallations());
      setProjects(erpStore.getProjects());
      setCustomers(erpStore.getCustomers());
    }
  };

  useEffect(() => {
    refreshData();
    const unsub = erpStore.subscribe(refreshData);
    return () => unsub();
  }, []);

  const handleCreateInstallation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProjectId) {
      alert('Please select an active project.');
      return;
    }

    try {
      await installationService.createInstallation({
        project_id: selectedProjectId,
        structure_type: newInstForm.structure_type,
        solar_module_make: newInstForm.solar_module_make,
        solar_module_capacity_wp: Number(newInstForm.solar_module_capacity_wp),
        solar_module_quantity: Number(newInstForm.solar_module_quantity),
        inverter_make: newInstForm.inverter_make,
        inverter_capacity_kw: Number(newInstForm.inverter_capacity_kw),
        inverter_serial_no: newInstForm.inverter_serial_no || `INV-${Date.now().toString().slice(-6)}`,
        dispatch_date: newInstForm.dispatch_date,
        installation_start_date: new Date().toISOString().split('T')[0],
        net_meter_installed: false,
        discom_inspection_signoff: false,
        notes: newInstForm.notes,
      });
      await refreshData();
      setShowScheduleModal(false);
      setSelectedProjectId('');
    } catch (err: any) {
      alert(err?.message || 'Failed to create installation');
    }
  };

  const handleOpenEdit = (inst: Installation) => {
    setEditingInst(inst);
    setEditNetMeterNo(inst.net_meter_serial_no || '');
    setEditNetMeterDate(inst.net_meter_installed_date || new Date().toISOString().split('T')[0]);
    setEditInspectionDate(inst.discom_inspection_date || new Date().toISOString().split('T')[0]);
    setEditInspectorName(inst.inspector_name || 'CSPDCL Testing Division');
    setEditDiscomSignoff(inst.discom_inspection_signoff || false);
    setEditNotes(inst.notes || '');
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingInst) return;

    const isLive = Boolean(editNetMeterNo.trim());
    const isCompleted = editDiscomSignoff && isLive;

    try {
      if (isCompleted) {
        // Atomic installation completion + project status update + customer lifecycle transition
        await installationService.completeInstallation(editingInst.id, {
          net_meter_serial_no: editNetMeterNo.trim(),
          net_meter_installed_date: editNetMeterDate,
          discom_inspection_date: editInspectionDate,
          inspector_name: editInspectorName,
          notes: editNotes,
        });
      } else {
        await installationService.updateInstallation(editingInst.id, {
          net_meter_serial_no: editNetMeterNo.trim() || undefined,
          net_meter_installed: isLive,
          net_meter_installed_date: isLive ? editNetMeterDate : undefined,
          discom_inspection_signoff: false,
          notes: editNotes,
        });
      }

      await refreshData();
      setEditingInst(null);
    } catch (err: any) {
      alert(err?.message || 'Failed to update installation');
    }
  };

  // Stats
  const completedCount = installations.filter((i) => i.discom_inspection_signoff && i.net_meter_installed).length;
  const netMeterLiveCount = installations.filter((i) => i.net_meter_installed).length;
  const inProgressCount = installations.filter((i) => !i.net_meter_installed).length;

  const filteredInstallations = installations.filter((inst) => {
    const proj = projects.find((p) => p.id === inst.project_id);
    const cust = customers.find((c) => c.id === proj?.customer_id);

    if (filterStage === 'COMPLETED' && (!inst.discom_inspection_signoff || !inst.net_meter_installed)) {
      return false;
    }
    if (filterStage === 'LIVE' && !inst.net_meter_installed) {
      return false;
    }
    if (filterStage === 'PENDING' && inst.net_meter_installed) {
      return false;
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchesCust = (cust?.full_name || '').toLowerCase().includes(q);
      const matchesProj = (proj?.project_code || '').toLowerCase().includes(q);
      const matchesMeter = (inst.net_meter_serial_no || '').toLowerCase().includes(q);
      const matchesInv = (inst.inverter_serial_no || '').toLowerCase().includes(q);
      if (!matchesCust && !matchesProj && !matchesMeter && !matchesInv) {
        return false;
      }
    }

    return true;
  });

  // Eligible projects for scheduling that don't have an installation
  const existingProjectIds = new Set(installations.map((i) => i.project_id));
  const eligibleProjects = projects.filter((p) => !existingProjectIds.has(p.id));

  return (
    <div className="space-y-6 animate-fade-in font-sans">
      {/* Top Header */}
      <div className="bg-slate-900/90 rounded-2xl p-5 border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xl">
        <div>
          <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
            <Wrench className="w-5 h-5 text-amber-400" />
            <span>Technical Installations & CSPDCL Net Meter Sign-offs</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Rooftop solar hardware installation, hardware telemetry, and CSPDCL bidirectional grid synchronization
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span className="px-3.5 py-1.5 rounded-xl bg-emerald-500/20 text-emerald-400 font-bold text-xs font-mono border border-emerald-500/30">
            {completedCount} / {installations.length} Verified Completed
          </span>

          <button
            onClick={() => setShowScheduleModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-md shadow-amber-500/20 transition cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>+ Schedule Technical Installation</span>
          </button>
        </div>
      </div>

      {/* KPI Counters */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        <div className="bg-slate-900/80 p-3.5 rounded-xl border border-slate-800 flex items-center justify-between">
          <div>
            <span className="text-slate-400 block text-[11px]">Total Installations</span>
            <span className="text-base font-bold text-slate-100 font-mono">{installations.length}</span>
          </div>
          <Wrench className="w-5 h-5 text-slate-500" />
        </div>

        <div className="bg-slate-900/80 p-3.5 rounded-xl border border-slate-800 flex items-center justify-between">
          <div>
            <span className="text-slate-400 block text-[11px]">Net Meter Live</span>
            <span className="text-base font-bold text-emerald-400 font-mono">{netMeterLiveCount}</span>
          </div>
          <Zap className="w-5 h-5 text-emerald-400" />
        </div>

        <div className="bg-slate-900/80 p-3.5 rounded-xl border border-slate-800 flex items-center justify-between">
          <div>
            <span className="text-slate-400 block text-[11px]">Discom Inspection Signed</span>
            <span className="text-base font-bold text-sky-400 font-mono">{completedCount}</span>
          </div>
          <CheckCircle2 className="w-5 h-5 text-sky-400" />
        </div>

        <div className="bg-slate-900/80 p-3.5 rounded-xl border border-slate-800 flex items-center justify-between">
          <div>
            <span className="text-slate-400 block text-[11px]">Mounting / In Progress</span>
            <span className="text-base font-bold text-amber-400 font-mono">{inProgressCount}</span>
          </div>
          <Clock className="w-5 h-5 text-amber-400" />
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-slate-900/90 rounded-xl p-4 border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-md">
        <div className="flex items-center gap-1.5 p-1 bg-slate-950 rounded-xl border border-slate-800 w-full sm:w-auto">
          <button
            onClick={() => setFilterStage('ALL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
              filterStage === 'ALL'
                ? 'bg-amber-500 text-slate-950 font-bold shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            All ({installations.length})
          </button>
          <button
            onClick={() => setFilterStage('PENDING')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
              filterStage === 'PENDING'
                ? 'bg-amber-500 text-slate-950 font-bold shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            In Progress ({inProgressCount})
          </button>
          <button
            onClick={() => setFilterStage('LIVE')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
              filterStage === 'LIVE'
                ? 'bg-amber-500 text-slate-950 font-bold shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Net Meter Live ({netMeterLiveCount})
          </button>
          <button
            onClick={() => setFilterStage('COMPLETED')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
              filterStage === 'COMPLETED'
                ? 'bg-emerald-500 text-slate-950 font-bold shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Discom Signed ({completedCount})
          </button>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by customer, project, net meter S/N..."
            className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-100 placeholder-slate-400 focus:outline-none focus:border-amber-400"
          />
        </div>
      </div>

      {/* Installations Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredInstallations.length === 0 ? (
          <div className="col-span-2 p-12 text-center bg-slate-900/60 rounded-2xl border border-slate-800 text-slate-500">
            No installation records found matching the criteria.
          </div>
        ) : (
          filteredInstallations.map((inst) => {
            const proj = projects.find((p) => p.id === inst.project_id);
            const cust = customers.find((c) => c.id === proj?.customer_id);

            return (
              <div key={inst.id} className="bg-slate-900/90 rounded-2xl p-5 border border-slate-800 shadow-md space-y-4 hover:border-slate-700 transition">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="text-base font-bold text-slate-100">{cust?.full_name || 'Customer'}</h4>
                    <div className="text-xs font-mono text-amber-400 mt-0.5">{proj?.project_code} • {proj?.capacity_kw || 3.3} kW Solar</div>
                    <div className="text-xs text-slate-400 mt-1">
                      Structure: <strong className="text-slate-200">{inst.structure_type?.replace(/_/g, ' ')}</strong>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-1.5">
                    {inst.discom_inspection_signoff && inst.net_meter_installed ? (
                      <span className="text-xs px-2.5 py-1 rounded-full font-mono font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Discom Sign-off Done</span>
                      </span>
                    ) : inst.net_meter_installed ? (
                      <span className="text-xs px-2.5 py-1 rounded-full font-mono font-bold bg-sky-500/20 text-sky-300 border border-sky-500/30 flex items-center gap-1">
                        <Zap className="w-3.5 h-3.5" />
                        <span>Net Meter Live</span>
                      </span>
                    ) : (
                      <span className="text-xs px-2.5 py-1 rounded-full font-mono font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        <span>Installation In Progress</span>
                      </span>
                    )}

                    <button
                      onClick={() => handleOpenEdit(inst)}
                      className="flex items-center gap-1 px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-amber-300 text-[11px] border border-slate-700 cursor-pointer"
                    >
                      <Edit2 className="w-3 h-3" />
                      <span>Update Inspection / Meter</span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
                  <div>
                    <span className="text-slate-400 block">Solar Modules:</span>
                    <span className="text-slate-200 font-medium">{inst.solar_module_make}</span>
                    <span className="text-[11px] text-slate-400 block">Qty: {inst.solar_module_quantity} Panels ({inst.solar_module_capacity_wp || 540}Wp)</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Solar Inverter:</span>
                    <span className="text-slate-200 font-medium">{inst.inverter_make}</span>
                    <span className="text-[11px] font-mono text-slate-400 block">S/N: {inst.inverter_serial_no}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">CSPDCL Net Meter No:</span>
                    <span className="font-mono font-bold text-emerald-400">
                      {inst.net_meter_serial_no || 'Pending Installation'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Discom Testing Date:</span>
                    <span className="font-mono text-slate-200">
                      {inst.discom_inspection_date || 'Awaiting Inspection'}
                    </span>
                  </div>
                </div>

                {inst.notes && (
                  <div className="text-[11px] text-slate-400 bg-slate-800/40 p-2 rounded-lg border border-slate-800">
                    {inst.notes}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* SCHEDULE NEW INSTALLATION MODAL */}
      {showScheduleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/90">
              <div className="flex items-center gap-2">
                <Wrench className="w-5 h-5 text-amber-400" />
                <h3 className="text-base font-bold text-slate-100">Schedule Technical Installation</h3>
              </div>
              <button onClick={() => setShowScheduleModal(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleCreateInstallation} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Select Customer Project *</label>
                <select
                  required
                  value={selectedProjectId}
                  onChange={(e) => setSelectedProjectId(e.target.value)}
                  className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-slate-100 focus:outline-none focus:border-amber-400"
                >
                  <option value="">-- Choose Project --</option>
                  {eligibleProjects.map((p) => {
                    const c = customers.find((cust) => cust.id === p.customer_id);
                    return (
                      <option key={p.id} value={p.id}>
                        {p.project_code} • {c?.full_name} ({p.capacity_kw} kW - {c?.district})
                      </option>
                    );
                  })}
                </select>
                {eligibleProjects.length === 0 && (
                  <p className="text-[11px] text-amber-400 mt-1">
                    All current projects have already been scheduled for technical installation.
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">Structure Type *</label>
                  <select
                    value={newInstForm.structure_type}
                    onChange={(e) => setNewInstForm({ ...newInstForm, structure_type: e.target.value })}
                    className="w-full rounded bg-slate-950 border border-slate-700 px-2.5 py-1.5 text-slate-200"
                  >
                    <option value="ELEVATED_GI_HOT_DIP">Elevated GI Hot-Dip MMS</option>
                    <option value="STANDARD_TIN_SHED_RAIL">Tin Shed Rail Mount</option>
                    <option value="RCC_FLUSH_MOUNT">RCC Flat Flush Mount</option>
                    <option value="SUPER_ELEVATED_GAZEBO">Super Elevated Gazebo (7ft+)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">Dispatch Date</label>
                  <input
                    type="date"
                    value={newInstForm.dispatch_date}
                    onChange={(e) => setNewInstForm({ ...newInstForm, dispatch_date: e.target.value })}
                    className="w-full rounded bg-slate-950 border border-slate-700 px-2.5 py-1.5 text-slate-200"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">Solar Module Make</label>
                  <input
                    type="text"
                    value={newInstForm.solar_module_make}
                    onChange={(e) => setNewInstForm({ ...newInstForm, solar_module_make: e.target.value })}
                    className="w-full rounded bg-slate-950 border border-slate-700 px-2.5 py-1.5 text-slate-200"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">Module Qty (Panels)</label>
                  <input
                    type="number"
                    value={newInstForm.solar_module_quantity}
                    onChange={(e) => setNewInstForm({ ...newInstForm, solar_module_quantity: Number(e.target.value) })}
                    className="w-full rounded bg-slate-950 border border-slate-700 px-2.5 py-1.5 text-slate-200"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">Inverter Make</label>
                  <input
                    type="text"
                    value={newInstForm.inverter_make}
                    onChange={(e) => setNewInstForm({ ...newInstForm, inverter_make: e.target.value })}
                    className="w-full rounded bg-slate-950 border border-slate-700 px-2.5 py-1.5 text-slate-200"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">Inverter S/N</label>
                  <input
                    type="text"
                    placeholder="e.g. GW-2026-CG-091"
                    value={newInstForm.inverter_serial_no}
                    onChange={(e) => setNewInstForm({ ...newInstForm, inverter_serial_no: e.target.value })}
                    className="w-full rounded bg-slate-950 border border-slate-700 px-2.5 py-1.5 text-slate-200 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">Installation Notes</label>
                <textarea
                  rows={2}
                  value={newInstForm.notes}
                  onChange={(e) => setNewInstForm({ ...newInstForm, notes: e.target.value })}
                  placeholder="e.g. Inverter mounted on north exterior wall with IP65 weather seal."
                  className="w-full rounded bg-slate-950 border border-slate-700 p-2 text-slate-200"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowScheduleModal(false)}
                  className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={eligibleProjects.length === 0}
                  className="px-5 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-bold shadow"
                >
                  Confirm Installation Schedule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* UPDATE / DISCOM SIGN-OFF MODAL */}
      {editingInst && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/90">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                <h3 className="text-base font-bold text-slate-100">Update Net Meter & CSPDCL Inspection</h3>
              </div>
              <button onClick={() => setEditingInst(null)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleSaveEdit} className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">CSPDCL Net Meter Serial No</label>
                  <input
                    type="text"
                    placeholder="e.g. CSPDCL-NM-99201"
                    value={editNetMeterNo}
                    onChange={(e) => setEditNetMeterNo(e.target.value)}
                    className="w-full rounded bg-slate-950 border border-slate-700 px-2.5 py-1.5 text-slate-100 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">Net Meter Install Date</label>
                  <input
                    type="date"
                    value={editNetMeterDate}
                    onChange={(e) => setEditNetMeterDate(e.target.value)}
                    className="w-full rounded bg-slate-950 border border-slate-700 px-2.5 py-1.5 text-slate-200"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">CSPDCL Testing / Inspection Date</label>
                  <input
                    type="date"
                    value={editInspectionDate}
                    onChange={(e) => setEditInspectionDate(e.target.value)}
                    className="w-full rounded bg-slate-950 border border-slate-700 px-2.5 py-1.5 text-slate-200"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">Discom Inspector Name</label>
                  <input
                    type="text"
                    value={editInspectorName}
                    onChange={(e) => setEditInspectorName(e.target.value)}
                    className="w-full rounded bg-slate-950 border border-slate-700 px-2.5 py-1.5 text-slate-200"
                  />
                </div>
              </div>

              <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editDiscomSignoff}
                    onChange={(e) => setEditDiscomSignoff(e.target.checked)}
                    className="w-4 h-4 rounded text-emerald-500 focus:ring-0"
                  />
                  <span className="text-xs font-bold text-emerald-300">
                    CSPDCL Discom Inspection Sign-off Completed & Synchronized
                  </span>
                </label>
                <p className="text-[11px] text-emerald-400/80 pl-6">
                  Checking this marks the technical installation as 100% completed, updates the project status, and transitions the customer to Completed Installation.
                </p>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">Technical Notes</label>
                <textarea
                  rows={2}
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  className="w-full rounded bg-slate-950 border border-slate-700 p-2 text-slate-200"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingInst(null)}
                  className="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold shadow"
                >
                  Save & Update Lifecycle
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
