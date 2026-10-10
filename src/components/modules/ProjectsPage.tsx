import React, { useState, useEffect } from 'react';
import { erpStore } from '../../services/erpStore';
import { projectService } from '../../services/projectService';
import { customerService } from '../../services/customerService';
import { agentNetworkService } from '../../services/agentNetworkService';
import { Project, Customer, Agent } from '../../types/database';
import { FolderKanban, CheckCircle2, Clock, Zap, ArrowRight } from 'lucide-react';

export const ProjectsPage: React.FC = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);

  useEffect(() => {
    let mounted = true;
    const loadProjectsData = async () => {
      try {
        const [pData, cData, aData] = await Promise.all([
          projectService.fetchProjects(),
          customerService.fetchCustomers(),
          agentNetworkService.list(),
        ]);
        if (mounted) {
          setProjects(pData);
          setCustomers(cData);
          setAgents(aData);
        }
      } catch (err) {
        if (mounted) {
          setProjects(erpStore.getProjects());
          setCustomers(erpStore.getCustomers());
          setAgents(erpStore.getAgents());
        }
      }
    };
    loadProjectsData();
    const unsub = erpStore.subscribe(loadProjectsData);
    return () => {
      mounted = false;
      unsub();
    };
  }, []);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="bg-slate-900/90 rounded-2xl p-5 border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
            <FolderKanban className="w-5 h-5 text-amber-400" />
            <span>Solar Rooftop Projects (Installation & Grid Sync Pipeline)</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Full project engineering cycle • Capacity kW • Customer contract values & DBT subsidy tracking
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {projects.map((proj) => {
          const cust = customers.find((c) => c.id === proj.customer_id);
          const ag = agents.find((a) => a.id === proj.primary_agent_id);

          return (
            <div key={proj.id} className="bg-slate-900/90 rounded-2xl p-5 border border-slate-800 shadow-md space-y-4">
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-xs font-mono text-amber-400 font-bold">{proj.project_code}</span>
                  <h4 className="text-base font-bold text-slate-100">{cust?.full_name}</h4>
                  <div className="text-xs text-slate-400 mt-0.5">
                    BP: <span className="font-mono text-slate-300">{cust?.consumer_number}</span> ({cust?.district}, CG)
                  </div>
                </div>

                <span className="text-xs px-2.5 py-1 rounded-full font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  {proj.capacity_kw} kW
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
                <div>
                  <span className="text-slate-400 block">Total Contract:</span>
                  <span className="font-mono font-bold text-slate-200">₹{proj.total_contract_amount.toLocaleString('en-IN')}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">CSPDCL Subsidy:</span>
                  <span className="font-mono font-bold text-emerald-400">₹{proj.discom_subsidy_amount.toLocaleString('en-IN')}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Customer Payable:</span>
                  <span className="font-mono font-bold text-amber-400">₹{proj.customer_payable_amount.toLocaleString('en-IN')}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Commission Distributed:</span>
                  <span className="font-mono font-bold text-emerald-400">
                    {proj.commission_distributed ? 'Idempotent Locked' : 'Pending'}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-xs">
                <span className="text-slate-400">
                  Sourcing Agent: <strong className="text-slate-200">{ag?.profile?.full_name || 'Direct'}</strong>
                </span>
                <span className="px-2.5 py-1 rounded-full font-mono text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  {proj.status}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
