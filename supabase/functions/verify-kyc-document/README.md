# BNPS KYC OCR — deployment notes (review only)

This Edge Function is part of PR #6. It is **not deployed to the live Supabase project by this PR**.

## Required secret

Set `GEMINI_API_KEY` as a **Supabase Edge Function secret** for project `oyogabtshehgwhbhxhid` before deploying `verify-kyc-document`.

- Use Supabase Dashboard → Edge Functions / Secrets (the exact menu label can vary) to add the secret.
- Do not commit the key, put it in `.env.local`, or expose it as a `VITE_*` variable for this OCR flow.
- The function sends the private document to Google Gemini only after authenticating the BNPS user and checking document/entity access.
- The prompt requests only document type, name, father name, DOB, legibility and confidence. It explicitly forbids returning Aadhaar number, PAN number, bank account number, IFSC, address, phone, or raw OCR text.
- Low confidence, unreadable images, unsupported document type, missing values, or mismatches do not auto-verify. The KYC conversion gate fails closed.

## Deployment order — only after source review and explicit approval

1. Review `database/15_kyc_ocr_and_atomic_conversion.sql` against the live schema and existing function grants. It adds columns/functions and replaces the lead conversion RPC; it must **not** be pasted into production until approved.
2. Configure the `GEMINI_API_KEY` Edge Function secret.
3. Deploy the source for `create-agent`, `change-initial-password`, and `verify-kyc-document`.
4. Run type/build checks and authenticated/unauthenticated tests before exposing the workflow to agents.
5. Test that mismatched and low-confidence documents cannot be verified or converted; test that matching documents are auto-verified and lead conversion succeeds only when the other required documents are also verified.

## Privacy and safety

- Keep the `documents` bucket private. Do not create public URLs for Aadhaar/PAN/bank documents.
- Do not log uploaded file contents, extracted identity values, API keys, temporary passwords, or full Gemini responses.
- Automatic matching is not proof of government-issued identity; OCR can misread documents. Keep a manual-review path for low confidence or mismatches.
- No SQL was executed and no live Edge Function was deployed while preparing this PR.
