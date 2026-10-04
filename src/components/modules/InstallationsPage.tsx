import React from 'react';
import { erpStore } from '../../services/erpStore';
import { Wrench, CheckCircle2, ShieldCheck, Zap } from 'lucide-react';

export const InstallationsPage: React.FC = () => {
  const installations = erpStore.getInstallations();
  const projects = erpStore.getProjects();
  const customers = erpStore.getCustomers();

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="bg-slate-900/90 rounded-2xl p-5 border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
            <Wrench className="w-5 h-5 text-amber-400" />
            <span>Technical Installations & CSPDCL Net Meter Sign-offs</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Module serials, inverter telemetry, and Discom bidirectional net meter verification (Section 13 Invariant)
          </p>
        </div>

        <span className="px-3 py-1 rounded-xl bg-emerald-500/20 text-emerald-400 font-bold text-xs font-mono border border-emerald-500/30">
          2 / 2 Verified Completed
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {installations.map((inst) => {
          const proj = projects.find((p) => p.id === inst.project_id);
          const cust = customers.find((c) => c.id === proj?.customer_id);

          return (
            <div key={inst.id} className="bg-slate-900/90 rounded-2xl p-5 border border-slate-800 shadow-md space-y-4">
              <div className="flex justify-between items-start">
                <div>
                  <h4 className="text-base font-bold text-slate-100">{cust?.full_name}</h4>
                  <span className="text-xs font-mono text-amber-400">{proj?.project_code}</span>
                  <div className="text-xs text-slate-400 mt-0.5">
                    Structure: <strong className="text-slate-200">{inst.structure_type}</strong>
                  </div>
                </div>

                <span className="text-xs px-2.5 py-1 rounded-full font-mono font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Net Meter Live</span>
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
                <div>
                  <span className="text-slate-400 block">Solar Modules:</span>
                  <span className="text-slate-200 font-medium">{inst.solar_module_make}</span>
                  <span className="text-[11px] text-slate-400 block">Qty: {inst.solar_module_quantity} Panels</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Solar Inverter:</span>
                  <span className="text-slate-200 font-medium">{inst.inverter_make}</span>
                  <span className="text-[11px] font-mono text-slate-400 block">S/N: {inst.inverter_serial_no}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">CSPDCL Net Meter No:</span>
                  <span className="font-mono font-bold text-emerald-400">{inst.net_meter_serial_no}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Discom Testing Date:</span>
                  <span className="font-mono text-slate-200">{inst.discom_inspection_date}</span>
                </div>
              </div>

              {inst.notes && (
                <div className="text-[11px] text-slate-400 bg-slate-800/40 p-2 rounded-lg border border-slate-800">
                  {inst.notes}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
