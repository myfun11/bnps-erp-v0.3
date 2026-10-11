import { supabase, isSupabaseConfigured } from '../lib/supabaseClient';
import { DocumentRecord, DocStatusType } from '../types/database';
import { erpStore } from './erpStore';

const STORAGE_BUCKET = 'documents';

const sanitizeFileName = (fileName: string): string => {
  const cleaned = fileName
    .normalize('NFKD')
    .replace(/[^\w.\-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');

  return cleaned || 'document';
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

export const documentService = {
  isConfigured: () => isSupabaseConfigured,

  async fetchDocuments(): Promise<DocumentRecord[]> {
    if (!isSupabaseConfigured) {
      return erpStore.getDocuments();
    }

    try {
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw new Error(`Unable to load authoritative documents from Supabase: ${error.message}`);

      return (data || []) as DocumentRecord[];
    } catch (err) { throw err instanceof Error ? err : new Error('Unable to load authoritative documents from Supabase.'); }
  },

  async fetchDocumentsByEntity(entityType: string, entityId: string): Promise<DocumentRecord[]> {
    if (!isSupabaseConfigured) {
      return erpStore.getDocuments({ entityType, entityId });
    }

    try {
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .eq('entity_type', entityType)
        .eq('entity_id', entityId)
        .order('created_at', { ascending: false });

      if (error) throw new Error(`Unable to load authoritative documents from Supabase: ${error.message}`);

      return (data || []) as DocumentRecord[];
    } catch (err) { throw err instanceof Error ? err : new Error('Unable to load authoritative documents from Supabase.'); }
  },

  async uploadDocument(
    file: File,
    entityType: string,
    entityId: string,
    docCategory: string,
    isTest = false
  ): Promise<DocumentRecord | null> {
    if (!file) {
      throw new Error('Please select a document file.');
    }

    if (!entityType.trim() || !entityId.trim()) {
      throw new Error('Document entity information is required.');
    }

    if (!docCategory.trim()) {
      throw new Error('Document category is required.');
    }

    const allowedMimeTypes = [
      'application/pdf',
      'image/jpeg',
      'image/png',
    ];

    if (!allowedMimeTypes.includes(file.type)) {
      throw new Error('Only PDF, JPG and PNG documents are allowed.');
    }

    const maxFileSize = 10 * 1024 * 1024;

    if (file.size > maxFileSize) {
      throw new Error('Document size must not exceed 10 MB.');
    }

    const safeFileName = sanitizeFileName(file.name);
    const uniqueId =
      typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

    const filePath = `${entityType}/${entityId}/${uniqueId}-${safeFileName}`;

    if (!isSupabaseConfigured) {
      const newDoc = erpStore.createDocument({
        entity_type: entityType,
        entity_id: entityId,
        doc_category: docCategory,
        file_name: file.name,
        file_path: filePath,
        mime_type: file.type,
        file_size_bytes: file.size,
        status: 'UPLOADED',
        is_test: isTest,
      });
      return newDoc;
    }

    const { error: uploadError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
        contentType: file.type,
      });

    if (uploadError) {
      console.error('[documentService.uploadDocument] Storage error:', uploadError.message);
      throw uploadError;
    }

    let createdDocument: DocumentRecord | null = null;
    try {
      const { data: rpcData, error: rpcError } = await supabase.rpc(
        'create_document_atomic',
        {
          p_entity_type: entityType,
          p_entity_id: entityId,
          p_doc_category: docCategory,
          p_file_name: file.name,
          p_file_path: filePath,
          p_mime_type: file.type,
          p_file_size_bytes: file.size,
          p_is_test: isTest,
        }
      );

      if (rpcError) {
        throw rpcError;
      }
      const rpcResult = rpcData as { success?: boolean; document?: DocumentRecord } | null;
      if (rpcResult?.success && rpcResult.document) {
        createdDocument = rpcResult.document;
      }
    } catch (error) {
      console.error('[documentService.uploadDocument] RPC error:', getErrorMessage(error));

      const { error: cleanupError } = await supabase.storage
        .from(STORAGE_BUCKET)
        .remove([filePath]);

      if (cleanupError) {
        console.warn(
          '[documentService.uploadDocument] Storage cleanup failed:',
          cleanupError.message
        );
      }

      throw error;
    }

    if (createdDocument) return createdDocument;

    const { data, error: fetchError } = await supabase
      .from('documents')
      .select('*')
      .eq('file_path', filePath)
      .maybeSingle();

    if (fetchError) {
      console.warn(
        '[documentService.uploadDocument] Document created but fetch failed:',
        fetchError.message
      );
      return null;
    }

    return data as DocumentRecord | null;
  },

  async extractKycDocument(documentId: string): Promise<{ success: boolean; extraction_status: string; evaluation?: unknown; message?: string }> {
    if (!isSupabaseConfigured) {
      throw new Error('Trusted KYC OCR requires the live Supabase backend.');
    }
    const { data, error } = await supabase.functions.invoke('verify-kyc-document', {
      body: { document_id: documentId },
    });
    if (error) throw new Error(`KYC OCR request failed: ${error.message}`);
    if (!data?.success) throw new Error(data?.message || 'KYC OCR did not complete; the document remains unverified.');
    return data as { success: boolean; extraction_status: string; evaluation?: unknown; message?: string };
  },

  async evaluateKycEntity(entityType: 'lead' | 'agent', entityId: string): Promise<{ success: boolean; evaluation?: { status?: string; auto_verified?: boolean }; message?: string }> {
    if (!isSupabaseConfigured) {
      throw new Error('Trusted KYC evaluation requires the live Supabase backend.');
    }
    const { data, error } = await supabase.functions.invoke('verify-kyc-document', {
      body: { action: 'evaluate', entity_type: entityType, entity_id: entityId },
    });
    if (error) throw new Error(`KYC re-check failed: ${error.message}`);
    if (!data?.success) throw new Error(data?.message || 'KYC re-check failed.');
    return data as { success: boolean; evaluation?: { status?: string; auto_verified?: boolean }; message?: string };
  },

  async verifyDocument(documentId: string): Promise<void> {
    if (!isSupabaseConfigured) {
      erpStore.verifyDocument(documentId);
      return;
    }

    try {
      const { error } = await supabase.rpc(
        'verify_document_atomic',
        {
          p_document_id: documentId,
        }
      );

      if (error) {
        console.error('[documentService.verifyDocument]', error.message);
        throw error;
      }
    } catch (err) { throw err instanceof Error ? err : new Error('Supabase document verification failed.'); }
  },

  async rejectDocument(
    documentId: string,
    rejectionReason: string
  ): Promise<void> {
    const reason = rejectionReason.trim();
    if (!reason) {
      throw new Error('Rejection reason is required.');
    }

    if (!isSupabaseConfigured) {
      erpStore.rejectDocument(documentId, reason);
      return;
    }

    try {
      const { error } = await supabase.rpc(
        'reject_document_atomic',
        {
          p_document_id: documentId,
          p_rejection_reason: reason,
        }
      );

      if (error) {
        console.error('[documentService.rejectDocument]', error.message);
        throw error;
      }
    } catch (err) { throw err instanceof Error ? err : new Error('Supabase document rejection failed.'); }
  },

  async createSignedUrl(
    filePath: string,
    expiresIn = 300
  ): Promise<string> {
    if (!isSupabaseConfigured) {
      return '#preview-document';
    }

    try {
      const { data, error } = await supabase.storage
        .from(STORAGE_BUCKET)
        .createSignedUrl(filePath, expiresIn);

      if (error || !data?.signedUrl) {
        return '#preview-document';
      }

      return data.signedUrl;
    } catch {
      return '#preview-document';
    }
  },

  async removeUploadedFile(filePath: string): Promise<void> {
    if (!isSupabaseConfigured) return;

    const { error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .remove([filePath]);

    if (error) {
      console.warn(
        '[documentService.removeUploadedFile]',
        error.message
      );
    }
  },
};