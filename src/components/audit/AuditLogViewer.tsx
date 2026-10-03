import React, { useState, useEffect } from 'react';
import { AuditLog } from '../../types/database';
import { erpStore } from '../../services/erpStore';
import { History, ShieldCheck, Filter, Search, FileCode } from 'lucide-react';

export const AuditLogViewer: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [search, setSearch] = useState('');
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  const loadData = () => {
    setLogs(erpStore.getAuditLogs());
  };

  useEffect(() => {
    loadData();
    const unsub = erpStore.subscribe(loadData);
    return () => unsub();
  }, []);

  const filteredLogs = logs.filter((l) => {
    const q = search.toLowerCase();
    return (
      l.action.toLowerCase().includes(q) ||
      l.entity_type.toLowerCase().includes(q) ||
      l.entity_id.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-900/80 p-4 rounded-xl border border-slate-800">
        <div>
          <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
            <History className="w-5 h-5 text-amber-400" />
            <span>Immutable Business Audit Ledger</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
              {logs.length} Events
            </span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Tamper-proof financial & operational event records • Mandated by Section 21
          </p>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter by action or entity..."
            className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-400"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Table of logs */}
        <div className="lg:col-span-2 bg-slate-900/90 rounded-xl border border-slate-800 shadow-md overflow-hidden">
          <div className="overflow-x-auto max-h-[600px]">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-800/80 text-slate-400 text-[11px] uppercase tracking-wider sticky top-0 border-b border-slate-700/80">
                <tr>
                  <th className="px-4 py-3">Timestamp</th>
                  <th className="px-4 py-3">Action Event</th>
                  <th className="px-4 py-3">Target Entity</th>
                  <th className="px-4 py-3">Actor Profile</th>
                  <th className="px-4 py-3 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredLogs.map((log) => {
                  const isSelected = selectedLog?.id === log.id;
                  return (
                    <tr
                      key={log.id}
                      onClick={() => setSelectedLog(log)}
                      className={`hover:bg-slate-800/60 transition-colors cursor-pointer ${
                        isSelected ? 'bg-amber-500/10 border-l-2 border-amber-400' : ''
                      }`}
                    >
                      <td className="px-4 py-3 font-mono text-[11px] text-slate-400 whitespace-nowrap">
                        {new Date(log.created_at).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 font-mono font-bold text-amber-400">
                        {log.action}
                      </td>
                      <td className="px-4 py-3 font-mono text-slate-300">
                        {log.entity_type} <span className="text-slate-500 text-[10px]">({log.entity_id.slice(0, 8)}...)</span>
                      </td>
                      <td className="px-4 py-3 text-slate-400 font-mono text-[11px]">
                        {log.actor_id ? log.actor_id.replace('prof-', '') : 'system'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-[11px] text-amber-400 hover:underline">
                          View JSON →
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Selected Log JSON Details */}
        <div className="bg-slate-900/90 rounded-xl p-4 border border-slate-800 flex flex-col justify-between max-h-[600px] overflow-hidden">
          <div>
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <FileCode className="w-4 h-4 text-amber-400" />
              <span>Event Snapshot & Payload</span>
            </h3>

            {selectedLog ? (
              <div className="space-y-3">
                <div className="bg-slate-800/70 p-3 rounded-lg border border-slate-700/60 text-xs space-y-1">
                  <div>Action: <strong className="text-amber-400 font-mono">{selectedLog.action}</strong></div>
                  <div>Entity: <strong className="text-slate-200 font-mono">{selectedLog.entity_type} ({selectedLog.entity_id})</strong></div>
                  <div>Actor ID: <span className="font-mono text-slate-400">{selectedLog.actor_id || 'System'}</span></div>
                  <div>Time: <span className="font-mono text-slate-400">{new Date(selectedLog.created_at).toISOString()}</span></div>
                </div>

                <div>
                  <span className="text-[11px] text-slate-400 block mb-1 font-semibold">New Data Delta (JSONB):</span>
                  <pre className="p-3 rounded-lg bg-slate-950 font-mono text-[11px] text-emerald-400 border border-slate-800 overflow-x-auto max-h-60">
                    {JSON.stringify(selectedLog.new_data || {}, null, 2)}
                  </pre>
                </div>

                {selectedLog.old_data && (
                  <div>
                    <span className="text-[11px] text-slate-400 block mb-1 font-semibold">Previous State (Before):</span>
                    <pre className="p-3 rounded-lg bg-slate-950 font-mono text-[11px] text-slate-400 border border-slate-800 overflow-x-auto max-h-32">
                      {JSON.stringify(selectedLog.old_data, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            ) : (
              <div className="py-20 text-center text-slate-500 text-xs">
                Select an audit entry from the table to inspect its immutable state delta.
              </div>
            )}
          </div>

          <div className="pt-3 border-t border-slate-800 text-[11px] text-slate-500 flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Immutable & Cryptographically Signed Database Logs</span>
          </div>
        </div>
      </div>
    </div>
  );
};
