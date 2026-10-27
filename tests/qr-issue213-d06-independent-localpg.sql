-- 04 QR Issue213 new-only independent effective-DB denial after Source143.
-- Run ONLY inside disposable locally bootstrapped Supabase; never linked/staging.
DO $qr$
DECLARE
 n integer;
 body text;
 consent_table text;
BEGIN
 IF (SELECT count(*) FROM supabase_migrations.schema_migrations)<>143
 THEN RAISE EXCEPTION 'QR213_MIGRATION_COUNT_NOT_143'; END IF;
 IF to_regclass('private.dreamsnap_official_result_account_consent_r20') IS NULL
 THEN RAISE EXCEPTION 'QR213_ACCOUNT_CONSENT_TABLE_MISSING'; END IF;
 SELECT count(*) INTO n FROM private.dreamsnap_official_result_account_consent_r20;
 IF n<>0 THEN RAISE EXCEPTION 'QR213_EMPTY_RESET_NOT_EMPTY'; END IF;
 SELECT pg_get_constraintdef(c.oid) INTO consent_table
 FROM pg_constraint c WHERE c.conname='dreamsnap_legacy_publication_disabled_r20';
 IF consent_table NOT LIKE '%cardinality(public_fields)%'
   OR consent_table NOT LIKE '%published_at IS NULL%'
 THEN RAISE EXCEPTION 'QR213_LEGACY_FIELDS_NOT_CONSTRAINED'; END IF;
 FOR n IN 1..1 LOOP
   IF has_function_privilege('anon','public.community_dreamsnap_set_official_result_publication_v1(uuid,uuid,text[])','EXECUTE')
     OR has_function_privilege('authenticated','public.community_dreamsnap_set_official_result_publication_v1(uuid,uuid,text[])','EXECUTE')
     OR has_function_privilege('service_role','public.community_dreamsnap_set_official_result_publication_v1(uuid,uuid,text[])','EXECUTE')
   THEN RAISE EXCEPTION 'QR213_OLD_SETTER_STILL_EXECUTABLE'; END IF;
 END LOOP;
 IF has_table_privilege('service_role','private.dreamsnap_official_result_account_consent_r20','SELECT')
  OR has_table_privilege('anon','private.dreamsnap_official_result_account_consent_r20','SELECT')
  OR has_table_privilege('authenticated','private.dreamsnap_official_result_account_consent_r20','SELECT')
 THEN RAISE EXCEPTION 'QR213_CONSENT_TABLE_DIRECT_READ_VISIBLE'; END IF;
 IF has_function_privilege('anon','public.community_dreamsnap_set_account_official_result_consent_r20(uuid,uuid,bigint,bigint,boolean,boolean)','EXECUTE')
  OR has_function_privilege('authenticated','public.community_dreamsnap_set_account_official_result_consent_r20(uuid,uuid,bigint,bigint,boolean,boolean)','EXECUTE')
  OR NOT has_function_privilege('service_role','public.community_dreamsnap_set_account_official_result_consent_r20(uuid,uuid,bigint,bigint,boolean,boolean)','EXECUTE')
 THEN RAISE EXCEPTION 'QR213_NEW_SETTER_ACL_BAD'; END IF;
 SELECT pg_get_functiondef('private.dreamsnap_public_official_result(uuid)'::regprocedure) INTO body;
 IF position('return null;' in lower(body))=0
  OR position('dreamsnap_official_result_account_consent_r20' in lower(body))=0
 THEN RAISE EXCEPTION 'QR213_EFFECTIVE_HELPER_NOT_NULL'; END IF;
 IF private.dreamsnap_public_official_result(gen_random_uuid()) IS NOT NULL
 THEN RAISE EXCEPTION 'QR213_UNKNOWN_RECORD_DISCLOSED'; END IF;
 BEGIN
  PERFORM public.community_dreamsnap_set_official_result_publication_v1(gen_random_uuid(),gen_random_uuid(),array['rank']::text[]);
  RAISE EXCEPTION 'QR213_OLD_SETTER_ACCEPTED';
 EXCEPTION WHEN OTHERS THEN
  IF SQLERRM NOT LIKE '%D06_LEGACY_PER_ENTRY_OFFICIAL_RESULT_PUBLICATION_DISABLED%'
  THEN RAISE; END IF;
 END;
 RAISE NOTICE 'QR213_D06_EFFECTIVE_LOCAL_PG_NEGATIVE_PASS_NO_SIGNED_ACTOR_NO_PROVIDER';
END
$qr$;
