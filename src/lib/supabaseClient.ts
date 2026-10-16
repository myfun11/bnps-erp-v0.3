import { createClient } from '@supabase/supabase-js';

const supabaseUrl = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_URL) || '';
const supabaseAnonKey = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_ANON_KEY) || '';

/**
 * Check if the browser environment has live Supabase configuration.
 * When false, the application falls back safely to in-memory/mock operational mode
 * until live credentials are provided in .env or deployment settings.
 */
export const isSupabaseConfigured = Boolean(
  supabaseUrl && 
  supabaseAnonKey && 
  supabaseUrl.startsWith('http') && 
  !supabaseUrl.includes('placeholder')
);

/**
 * Single Authoritative Supabase Client Instance.
 * Uses browser LocalStorage for session persistence and auto-refreshes JWT tokens.
 */
export const supabase = createClient(
  isSupabaseConfigured ? supabaseUrl : 'https://placeholder.supabase.co',
  isSupabaseConfigured ? supabaseAnonKey : 'placeholder-anon-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  }
);

export interface ExtractedFunctionError {
  code: string;
  message: string;
  status: number;
  requestId?: string;
}

/**
 * Sanitizes server error messages before display to users or logging.
 * Redacts JWTs, Bearer tokens, secrets, private file paths, PAN numbers, and Aadhaar numbers.
 */
export function sanitizeServerErrorMessage(raw: string, fallback = 'An unexpected server error occurred.'): string {
  if (!raw || typeof raw !== 'string') return fallback;
  let clean = raw
    .replace(/Bearer\s+[A-Za-z0-9\-_.]+/gi, '[REDACTED_TOKEN]')
    .replace(/eyJ[A-Za-z0-9\-_.]+/g, '[REDACTED_JWT]')
    .replace(/(?:password|token|secret|key|service_role)["']?\s*[:=]\s*["']?[^"',\s}]+/gi, '$1: [REDACTED]')
    .replace(/\/[a-zA-Z0-9_\-./]+\.(?:pdf|png|jpg|jpeg)/gi, '[REDACTED_PATH]')
    .replace(/\b[2-9]{1}[0-9]{3}\s?[0-9]{4}\s?[0-9]{4}\b/g, '[REDACTED_AADHAAR]')
    .replace(/\b[A-Z]{5}[0-9]{4}[A-Z]{1}\b/g, '[REDACTED_PAN]');
  clean = clean.trim();
  if (clean.length > 240) {
    clean = clean.slice(0, 240) + '...';
  }
  return clean || fallback;
}

/**
 * Safely extracts structured error code, actionable server message, HTTP status, and correlation ID
 * from Supabase Functions errors (including FunctionsHttpError) with bounded fallbacks.
 * Never outputs only 'Edge Function returned a non-2xx status code'.
 */
export async function extractFunctionsHttpError(
  error: unknown,
  defaultMessage = 'The server encountered an error while processing the request.'
): Promise<ExtractedFunctionError> {
  let code = 'EDGE_FUNCTION_ERROR';
  let message = defaultMessage;
  let status = 500;
  let requestId: string | undefined = undefined;

  if (error && typeof error === 'object') {
    const errObj = error as any;
    const ctx = errObj.context;

    if (ctx) {
      if (typeof ctx.status === 'number') {
        status = ctx.status;
      }
      if (typeof ctx.json === 'function' || typeof ctx.text === 'function') {
        let body: any = null;
        try {
          const cloned = typeof ctx.clone === 'function' ? ctx.clone() : ctx;
          body = await cloned.json();
        } catch {
          try {
            const cloned = typeof ctx.clone === 'function' ? ctx.clone() : ctx;
            const text = await cloned.text();
            if (text && typeof text === 'string') {
              try {
                body = JSON.parse(text);
              } catch {
                const cleaned = text.trim();
                if (cleaned) {
                  message = cleaned;
                }
              }
            }
          } catch {
            // Response body could not be read
          }
        }

        if (body && typeof body === 'object') {
          const rawCode =
            body.error?.code ||
            (typeof body.error === 'string' ? body.error : undefined) ||
            body.code ||
            body.error_code ||
            body.statusCode;
          if (typeof rawCode === 'string' && rawCode.trim()) {
            code = rawCode.trim();
          }

          const rawMsg =
            body.error?.message ||
            body.message ||
            (typeof body.error === 'string' ? body.error : undefined) ||
            body.msg ||
            body.error_description ||
            body.details;
          if (typeof rawMsg === 'string' && rawMsg.trim()) {
            message = rawMsg.trim();
          }

          const rawReqId = body.request_id || body.requestId || body.id;
          if (typeof rawReqId === 'string' && rawReqId.trim()) {
            requestId = rawReqId.trim();
          }
        }
      } else if (typeof ctx === 'object') {
        if (typeof ctx.error === 'string' && ctx.error.trim()) code = ctx.error.trim();
        else if (typeof ctx.code === 'string' && ctx.code.trim()) code = ctx.code.trim();
        if (typeof ctx.message === 'string' && ctx.message.trim()) message = ctx.message.trim();
      }
    }

    // Map common HTTP status codes if error code remained generic
    if (code === 'EDGE_FUNCTION_ERROR') {
      if (status === 401) code = 'AUTH_REQUIRED';
      else if (status === 403) code = 'FORBIDDEN';
      else if (status === 404) code = 'NOT_FOUND';
      else if (status === 409) code = 'CONFLICT';
      else if (status === 422 || status === 400) code = 'VALIDATION_ERROR';
    }

    // If message is still default, check if error has a meaningful message other than the generic non-2xx string
    if (
      message === defaultMessage &&
      typeof errObj.message === 'string' &&
      errObj.message.trim() &&
      errObj.message !== 'Edge Function returned a non-2xx status code'
    ) {
      message = errObj.message.trim();
    }
  }

  const safeMsg = sanitizeServerErrorMessage(message, defaultMessage);
  return { code, message: safeMsg, status, requestId };
}

