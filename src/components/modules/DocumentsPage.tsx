import React, { useState } from 'react';
import { Files, CheckCircle2, Clock, XCircle, Upload, Eye, FileText } from 'lucide-react';

interface MockDoc {
  id: string;
  category: string;
  customerName: string;
  fileName: string;
  uploadedAt: string;
  status: 'VERIFIED' | 'UPLOADED' | 'REJECTED';
}

export const DocumentsPage: React.FC = () => {
  const [docs, setDocs] = useState<MockDoc[]>([
    {
      id: 'doc-01',
      category: 'CSPDCL Electricity Bill',
      customerName: 'Shree Radheshyam Verma',
      fileName: 'cspdcl_bill_10029485731.pdf',
      uploadedAt: '2026-01-20',
      status: 'VERIFIED',
    },
    {
      id: 'doc-02',
      category: 'Aadhaar Card (Identity Proof)',
      customerName: 'Balveer Singh Sahu',
      fileName: 'aadhaar_sahu_masked.pdf',
      uploadedAt: '2026-01-22',
      status: 'VERIFIED',
    },
    {
      id: 'doc-03',
      category: 'Discom Net Meter Inspection Signoff',
      customerName: 'Balveer Singh Sahu',
      fileName: 'cspdcl_net_meter_inspection.pdf',
      uploadedAt: '2026-02-18',
      status: 'VERIFIED',
    },
    {
      id: 'doc-04',
      category: 'Rooftop Site Survey Photos',
      customerName: 'Mahesh Kumar Kashyap',
      fileName: 'roof_shadow_survey_450sqft.jpg',
      uploadedAt: '2026-02-20',
      status: 'UPLOADED',
    },
  ]);

  const handleVerify = (id: string) => {
    setDocs(docs.map((d) => (d.id === id ? { ...d, status: 'VERIFIED' } : d)));
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="bg-slate-900/90 rounded-2xl p-5 border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
            <Files className="w-5 h-5 text-amber-400" />
            <span>Digital Document Vault (Section 22 Verification System)</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            CSPDCL bills, Aadhaar cards, rooftop shadow analysis, and official net meter sanction certificates
          </p>
        </div>

        <button 
          onClick={() => alert('Document upload modal: Select Aadhaar or CSPDCL bill')}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold shadow-md shadow-amber-500/20 cursor-pointer"
        >
          <Upload className="w-4 h-4" />
          <span>+ Upload Document</span>
        </button>
      </div>

      <div className="bg-slate-900/90 rounded-2xl border border-slate-800 shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-800/80 text-slate-400 text-[11px] uppercase tracking-wider border-b border-slate-700/80">
              <tr>
                <th className="px-4 py-3">Document Category</th>
                <th className="px-4 py-3">Customer Reference</th>
                <th className="px-4 py-3">File Name</th>
                <th className="px-4 py-3">Upload Date</th>
                <th className="px-4 py-3">Verification Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {docs.map((doc) => (
                <tr key={doc.id} className="hover:bg-slate-800/50 transition-colors">
                  <td className="px-4 py-3.5 font-medium text-slate-100 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>{doc.category}</span>
                  </td>

                  <td className="px-4 py-3.5 text-slate-200">
                    {doc.customerName}
                  </td>

                  <td className="px-4 py-3.5 font-mono text-slate-400 text-[11px]">
                    {doc.fileName}
                  </td>

                  <td className="px-4 py-3.5 font-mono text-slate-400">
                    {doc.uploadedAt}
                  </td>

                  <td className="px-4 py-3.5">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                      doc.status === 'VERIFIED'
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    }`}>
                      {doc.status === 'VERIFIED' ? <CheckCircle2 className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                      <span>{doc.status}</span>
                    </span>
                  </td>

                  <td className="px-4 py-3.5 text-right">
                    {doc.status === 'UPLOADED' ? (
                      <button
                        onClick={() => handleVerify(doc.id)}
                        className="px-2.5 py-1 rounded bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold transition-all"
                      >
                        Verify & Sign Off
                      </button>
                    ) : (
                      <span className="text-[11px] text-slate-500 font-mono">Signed & Secure</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
