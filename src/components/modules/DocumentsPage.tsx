import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Files,
  CheckCircle2,
  Clock,
  XCircle,
  Upload,
  Eye,
  FileText,
} from 'lucide-react';
import { documentService } from '../../services/documentService';
import { customerService } from '../../services/customerService';
import { erpStore } from '../../services/erpStore';
import { DocumentRecord, Customer } from '../../types/database';

const DOCUMENT_CATEGORIES = [
  { value: 'aadhaar', label: 'Aadhaar Card' },
  { value: 'pan', label: 'PAN Card' },
  { value: 'electricity_bill', label: 'Electricity Bill' },
  { value: 'net_meter_cert', label: 'Net Meter Certificate' },
  { value: 'site_photo', label: 'Site Photo' },
  { value: 'bank_proof', label: 'Bank Proof' },
];

const getCategoryLabel = (category: string): string => {
  return (
    DOCUMENT_CATEGORIES.find((item) => item.value === category)?.label ??
    category
  );
};

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message;

  if (
    error &&
    typeof error === 'object' &&
    'message' in error &&
    typeof (error as { message?: unknown }).message === 'string'
  ) {
    return (error as { message: string }).message;
  }

  return 'Document operation failed.';
};

export const DocumentsPage: React.FC = () => {
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);

  const [showUploadForm, setShowUploadForm] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(
    DOCUMENT_CATEGORIES[0].value
  );
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const customerMap = useMemo(() => {
    return new Map(customers.map((customer) => [customer.id, customer]));
  }, [customers]);

  const loadDocuments = async () => {
    setIsLoading(true);

    try {
      const [dData, cData] = await Promise.all([
        documentService.fetchDocuments(),
        customerService.fetchCustomers(),
      ]);
      setDocuments(dData);
      setCustomers(cData);
    } catch (error) {
      console.error('[DocumentsPage.loadDocuments]', error);
      alert(getErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadDocuments();

    const unsubscribe = erpStore.subscribe(async () => {
      try {
        const cData = await customerService.fetchCustomers();
        setCustomers(cData);
      } catch {
        setCustomers(erpStore.getCustomers());
      }
    });

    return unsubscribe;
  }, []);

  const resetUploadForm = () => {
    setSelectedCustomerId('');
    setSelectedCategory(DOCUMENT_CATEGORIES[0].value);
    setSelectedFile(null);

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleUpload = async () => {
    if (!selectedCustomerId) {
      alert('Please select a customer.');
      return;
    }

    if (!selectedFile) {
      alert('Please select a document file.');
      return;
    }

    setIsUploading(true);

    try {
      await documentService.uploadDocument(
        selectedFile,
        'customer',
        selectedCustomerId,
        selectedCategory,
        false
      );

      alert('Document uploaded successfully.');

      resetUploadForm();
      setShowUploadForm(false);

      await loadDocuments();
    } catch (error) {
      console.error('[DocumentsPage.handleUpload]', error);
      alert(getErrorMessage(error));
    } finally {
      setIsUploading(false);
    }
  };

  const handleVerify = async (documentId: string) => {
    setActionId(documentId);

    try {
      await documentService.verifyDocument(documentId);
      await loadDocuments();
    } catch (error) {
      console.error('[DocumentsPage.handleVerify]', error);
      alert(getErrorMessage(error));
    } finally {
      setActionId(null);
    }
  };

  const handleReject = async (documentId: string) => {
    const reason = window.prompt('Enter document rejection reason:');

    if (!reason?.trim()) {
      return;
    }

    setActionId(documentId);

    try {
      await documentService.rejectDocument(documentId, reason);
      await loadDocuments();
    } catch (error) {
      console.error('[DocumentsPage.handleReject]', error);
      alert(getErrorMessage(error));
    } finally {
      setActionId(null);
    }
  };

  const handleView = async (document: DocumentRecord) => {
    setActionId(document.id);

    try {
      const signedUrl = await documentService.createSignedUrl(
        document.file_path
      );

      window.open(signedUrl, '_blank', 'noopener,noreferrer');
    } catch (error) {
      console.error('[DocumentsPage.handleView]', error);
      alert(getErrorMessage(error));
    } finally {
      setActionId(null);
    }
  };

  const getCustomerName = (entityId: string): string => {
    const customer = customerMap.get(entityId);

    if (!customer) {
      return entityId;
    }

    return customer.full_name || entityId;
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="bg-slate-900/90 rounded-2xl p-5 border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
            <Files className="w-5 h-5 text-amber-400" />
            <span>Digital Document Vault</span>
          </h2>

          <p className="text-xs text-slate-400 mt-0.5">
            Secure customer documents stored in private Supabase Storage
          </p>
        </div>

        <button
          onClick={() => setShowUploadForm((value) => !value)}
          disabled={isUploading}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 text-xs font-bold shadow-md shadow-amber-500/20 cursor-pointer"
        >
          <Upload className="w-4 h-4" />
          <span>{showUploadForm ? 'Close Upload' : '+ Upload Document'}</span>
        </button>
      </div>

      {showUploadForm && (
        <div className="bg-slate-900/90 rounded-2xl p-5 border border-slate-800">
          <h3 className="text-sm font-bold text-slate-100 mb-4">
            Upload Customer Document
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1.5">
                Customer
              </label>

              <select
                value={selectedCustomerId}
                onChange={(event) =>
                  setSelectedCustomerId(event.target.value)
                }
                className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-xs text-slate-100 outline-none focus:border-amber-500"
              >
                <option value="">Select customer</option>

                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.full_name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1.5">
                Document Category
              </label>

              <select
                value={selectedCategory}
                onChange={(event) =>
                  setSelectedCategory(event.target.value)
                }
                className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-xs text-slate-100 outline-none focus:border-amber-500"
              >
                {DOCUMENT_CATEGORIES.map((category) => (
                  <option key={category.value} value={category.value}>
                    {category.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1.5">
                File
              </label>

              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                onChange={(event) =>
                  setSelectedFile(event.target.files?.[0] ?? null)
                }
                className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-1.5 text-xs text-slate-300 file:mr-3 file:rounded file:border-0 file:bg-slate-700 file:px-2.5 file:py-1 file:text-xs file:text-slate-200"
              />
            </div>
          </div>

          <div className="flex justify-end mt-4">
            <button
              onClick={() => void handleUpload()}
              disabled={isUploading}
              className="px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 text-xs font-bold"
            >
              {isUploading ? 'Uploading...' : 'Upload Document'}
            </button>
          </div>
        </div>
      )}

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
              {isLoading ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-10 text-center text-slate-500"
                  >
                    Loading documents...
                  </td>
                </tr>
              ) : documents.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-10 text-center text-slate-500"
                  >
                    No documents found.
                  </td>
                </tr>
              ) : (
                documents.map((document) => (
                  <tr
                    key={document.id}
                    className="hover:bg-slate-800/50 transition-colors"
                  >
                    <td className="px-4 py-3.5 font-medium text-slate-100">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-amber-400 shrink-0" />
                        <span>
                          {getCategoryLabel(document.doc_category)}
                        </span>
                      </div>
                    </td>

                    <td className="px-4 py-3.5 text-slate-200">
                      {document.entity_type === 'customer'
                        ? getCustomerName(document.entity_id)
                        : document.entity_id}
                    </td>

                    <td className="px-4 py-3.5 font-mono text-slate-400 text-[11px]">
                      {document.file_name}
                    </td>

                    <td className="px-4 py-3.5 font-mono text-slate-400">
                      {new Date(document.created_at).toLocaleDateString(
                        'en-IN'
                      )}
                    </td>

                    <td className="px-4 py-3.5">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                          document.status === 'VERIFIED'
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : document.status === 'REJECTED'
                              ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                              : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        }`}
                      >
                        {document.status === 'VERIFIED' ? (
                          <CheckCircle2 className="w-3 h-3" />
                        ) : document.status === 'REJECTED' ? (
                          <XCircle className="w-3 h-3" />
                        ) : (
                          <Clock className="w-3 h-3" />
                        )}

                        <span>{document.status}</span>
                      </span>

                      {document.status === 'REJECTED' &&
                        document.rejection_reason && (
                          <div className="mt-1 text-[10px] text-red-400 max-w-xs">
                            {document.rejection_reason}
                          </div>
                        )}
                    </td>

                    <td className="px-4 py-3.5">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => void handleView(document)}
                          disabled={actionId === document.id}
                          title="View document"
                          className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-300"
                        >
                          <Eye className="w-4 h-4" />
                        </button>

                        {document.status === 'UPLOADED' && (
                          <>
                            <button
                              onClick={() => void handleVerify(document.id)}
                              disabled={actionId === document.id}
                              className="px-2.5 py-1 rounded bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 text-xs font-bold"
                            >
                              {actionId === document.id
                                ? 'Processing...'
                                : 'Verify'}
                            </button>

                            <button
                              onClick={() => void handleReject(document.id)}
                              disabled={actionId === document.id}
                              className="px-2.5 py-1 rounded bg-red-500/20 hover:bg-red-500/30 disabled:opacity-50 text-red-400 border border-red-500/30 text-xs font-bold"
                            >
                              Reject
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};