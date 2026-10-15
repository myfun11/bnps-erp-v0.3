-- Migration 23: Include electricity_bill in evaluate_entity_kyc for Lead auto-verification
-- When customer name (and father name if present) across Aadhaar, Bank Passbook, and Electricity Bill match,
-- all documents including Electricity Bill are automatically VERIFIED.

CREATE OR REPLACE FUNCTION public.evaluate_entity_kyc(p_entity_type text, p_entity_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_entity_type text := lower(btrim(coalesce(p_entity_type,'')));
  v_full_name text;
  v_father_name text;
  v_dob text;
  v_aadhaar public.documents%ROWTYPE;
  v_aadhaar_back public.documents%ROWTYPE;
  v_pan public.documents%ROWTYPE;
  v_bank public.documents%ROWTYPE;
  v_elec public.documents%ROWTYPE;
  v_docs uuid[] := ARRAY[]::uuid[];
  v_name_ok boolean := false;
  v_father_ok boolean := false;
  v_dob_ok boolean := false;
  v_complete boolean := false;
BEGIN
  IF v_entity_type NOT IN ('lead','agent') OR p_entity_id IS NULL THEN
    RAISE EXCEPTION 'Unsupported KYC entity' USING ERRCODE='22023';
  END IF;

  IF v_entity_type='lead' THEN
    SELECT l.full_name, l.father_name, l.dob::text
      INTO v_full_name, v_father_name, v_dob
      FROM public.leads l WHERE l.id=p_entity_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Lead not found' USING ERRCODE='P0002'; END IF;

    SELECT d.* INTO v_aadhaar FROM public.documents d 
     WHERE d.entity_type='lead' AND d.entity_id=p_entity_id AND d.doc_category IN ('aadhaar','aadhaar_front') 
     ORDER BY d.created_at DESC LIMIT 1;
    SELECT d.* INTO v_pan FROM public.documents d 
     WHERE d.entity_type='lead' AND d.entity_id=p_entity_id AND d.doc_category='pan' 
     ORDER BY d.created_at DESC LIMIT 1;
    SELECT d.* INTO v_bank FROM public.documents d 
     WHERE d.entity_type='lead' AND d.entity_id=p_entity_id AND d.doc_category='bank_proof' 
     ORDER BY d.created_at DESC LIMIT 1;
    SELECT d.* INTO v_elec FROM public.documents d 
     WHERE d.entity_type='lead' AND d.entity_id=p_entity_id AND d.doc_category='electricity_bill' 
     ORDER BY d.created_at DESC LIMIT 1;

    IF v_pan.status='REJECTED' THEN v_pan := NULL; END IF;
    IF v_elec.status='REJECTED' THEN v_elec := NULL; END IF;

    -- Lead conversion requires Aadhaar + bank passbook (+ electricity bill if uploaded).
    -- PAN is optional; if uploaded, it must pass trusted OCR and all identity checks.
    v_complete := v_aadhaar.id IS NOT NULL AND v_bank.id IS NOT NULL
      AND v_aadhaar.extraction_status IN ('EXTRACTED','MATCHED','MISMATCH')
      AND v_bank.extraction_status IN ('EXTRACTED','MATCHED','MISMATCH')
      AND v_aadhaar.extraction_is_legible IS TRUE AND v_bank.extraction_is_legible IS TRUE
      AND coalesce(v_aadhaar.extraction_confidence,0)>=0.85
      AND coalesce(v_bank.extraction_confidence,0)>=0.85
      AND (v_pan.id IS NULL OR (
        v_pan.extraction_status IN ('EXTRACTED','MATCHED','MISMATCH')
        AND v_pan.extraction_is_legible IS TRUE
        AND coalesce(v_pan.extraction_confidence,0)>=0.85
      ))
      AND (v_elec.id IS NULL OR (
        v_elec.extraction_status IN ('EXTRACTED','MATCHED','MISMATCH')
        AND v_elec.extraction_is_legible IS TRUE
        AND coalesce(v_elec.extraction_confidence,0)>=0.85
      ));

    v_docs := array_remove(ARRAY[v_aadhaar.id,v_pan.id,v_bank.id,v_elec.id], NULL);
  ELSE
    SELECT p.full_name INTO v_full_name
      FROM public.agents a JOIN public.profiles p ON p.id=a.profile_id
     WHERE a.id=p_entity_id AND (a.is_active=true OR a.kyc_activation_pending=true) FOR UPDATE OF a;
    IF NOT FOUND THEN RAISE EXCEPTION 'Active agent not found' USING ERRCODE='P0002'; END IF;

    SELECT d.* INTO v_aadhaar FROM public.documents d 
     WHERE d.entity_type='agent' AND d.entity_id=p_entity_id AND d.doc_category='aadhaar_front' 
     ORDER BY d.created_at DESC LIMIT 1;
    SELECT d.* INTO v_aadhaar_back FROM public.documents d 
     WHERE d.entity_type='agent' AND d.entity_id=p_entity_id AND d.doc_category='aadhaar_back' 
     ORDER BY d.created_at DESC LIMIT 1;
    SELECT d.* INTO v_pan FROM public.documents d 
     WHERE d.entity_type='agent' AND d.entity_id=p_entity_id AND d.doc_category='pan' 
     ORDER BY d.created_at DESC LIMIT 1;
    SELECT d.* INTO v_bank FROM public.documents d 
     WHERE d.entity_type='agent' AND d.entity_id=p_entity_id AND d.doc_category='bank_proof' 
     ORDER BY d.created_at DESC LIMIT 1;

    v_complete := v_aadhaar.id IS NOT NULL AND v_aadhaar_back.id IS NOT NULL AND v_pan.id IS NOT NULL AND v_bank.id IS NOT NULL
      AND v_aadhaar.extraction_status IN ('EXTRACTED','MATCHED','MISMATCH') AND v_aadhaar_back.extraction_status IN ('EXTRACTED','MATCHED','MISMATCH')
      AND v_pan.extraction_status IN ('EXTRACTED','MATCHED','MISMATCH') AND v_bank.extraction_status IN ('EXTRACTED','MATCHED','MISMATCH')
      AND v_aadhaar.extraction_is_legible IS TRUE AND v_aadhaar_back.extraction_is_legible IS TRUE
      AND v_pan.extraction_is_legible IS TRUE AND v_bank.extraction_is_legible IS TRUE
      AND coalesce(v_aadhaar.extraction_confidence,0)>=0.85 AND coalesce(v_aadhaar_back.extraction_confidence,0)>=0.85
      AND coalesce(v_pan.extraction_confidence,0)>=0.85 AND coalesce(v_bank.extraction_confidence,0)>=0.85;

    v_docs := ARRAY[v_aadhaar.id,v_aadhaar_back.id,v_pan.id,v_bank.id];
  END IF;

  IF NOT v_complete OR public.kyc_normalize_identity(v_full_name)='' THEN
    RETURN jsonb_build_object('status','PENDING','reason','required_documents_or_trusted_extraction_pending');
  END IF;

  v_name_ok :=
    public.kyc_normalize_identity(v_aadhaar.extracted_name)=public.kyc_normalize_identity(v_full_name)
    AND public.kyc_normalize_identity(v_bank.extracted_name)=public.kyc_normalize_identity(v_full_name)
    AND (v_pan.id IS NULL OR
      public.kyc_normalize_identity(v_pan.extracted_name)=public.kyc_normalize_identity(v_full_name))
    AND (v_elec.id IS NULL OR
      public.kyc_normalize_identity(v_elec.extracted_name)=public.kyc_normalize_identity(v_full_name));

  IF v_entity_type='lead' THEN
    v_father_ok := public.kyc_normalize_identity(v_father_name)<>''
      AND public.kyc_normalize_identity(v_aadhaar.extracted_father_name)=public.kyc_normalize_identity(v_father_name)
      AND public.kyc_normalize_identity(v_bank.extracted_father_name)=public.kyc_normalize_identity(v_father_name)
      AND (v_pan.id IS NULL OR public.kyc_normalize_identity(v_pan.extracted_father_name)=public.kyc_normalize_identity(v_father_name))
      AND (v_elec.id IS NULL OR coalesce(public.kyc_normalize_identity(v_elec.extracted_father_name),'')='' OR public.kyc_normalize_identity(v_elec.extracted_father_name)=public.kyc_normalize_identity(v_father_name));
    v_dob_ok := public.kyc_normalize_dob(v_aadhaar.extracted_dob)=public.kyc_normalize_dob(v_dob)
      AND (v_pan.id IS NULL OR public.kyc_normalize_dob(v_pan.extracted_dob)=public.kyc_normalize_dob(v_dob))
      AND public.kyc_normalize_dob(v_dob) IS NOT NULL;
  ELSE
    v_father_ok := public.kyc_normalize_identity(v_aadhaar.extracted_father_name)<>''
      AND public.kyc_normalize_identity(v_aadhaar.extracted_father_name)=public.kyc_normalize_identity(v_pan.extracted_father_name)
      AND public.kyc_normalize_identity(v_aadhaar.extracted_father_name)=public.kyc_normalize_identity(v_bank.extracted_father_name);
    v_dob_ok := public.kyc_normalize_dob(v_aadhaar.extracted_dob) IS NOT NULL
      AND public.kyc_normalize_dob(v_aadhaar.extracted_dob)=public.kyc_normalize_dob(v_pan.extracted_dob);
  END IF;

  IF v_name_ok AND v_father_ok AND v_dob_ok THEN
    UPDATE public.documents 
       SET extraction_status='MATCHED', kyc_match_status='MATCHED',
           status='VERIFIED', verified_by=NULL, verified_at=clock_timestamp(),
           extraction_error=NULL
     WHERE id=ANY(v_docs) AND status<>'REJECTED';
    RETURN jsonb_build_object('status','MATCHED','auto_verified',true,'documents_verified',cardinality(v_docs));
  END IF;

  UPDATE public.documents 
     SET extraction_status='MISMATCH', kyc_match_status='MISMATCH',
         status='UPLOADED', verified_by=NULL, verified_at=NULL,
         rejection_reason=NULL
   WHERE id=ANY(v_docs) AND status<>'REJECTED';

  RETURN jsonb_build_object('status','MISMATCH','auto_verified',false,
    'name_match',v_name_ok,'father_name_match',v_father_ok,'dob_match',v_dob_ok);
END;
$$;

REVOKE ALL ON FUNCTION public.evaluate_entity_kyc(text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.evaluate_entity_kyc(text, uuid) TO service_role;
