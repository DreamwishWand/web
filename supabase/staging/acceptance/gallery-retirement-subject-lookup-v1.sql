-- STAGING ONLY. Non-destructive transaction. Assumes lookup migration installed.
begin;
do $$
declare
  v_all jsonb;
  v_outdoor jsonb;
  v_empty jsonb;
  v_subject jsonb;
  v_count int;
begin
  v_all := public.community_list_verified_gallery_subjects_v1(null,100);
  v_outdoor := public.community_list_verified_gallery_subjects_v1('outdoor',100);
  v_empty := public.community_list_verified_gallery_subjects_v1('indoor',100);
  v_count := jsonb_array_length(v_all->'subjects');
  if v_count<>13 then raise exception 'SUBJECT_LOOKUP_EXPECTED_13_ACTUAL_%',v_count; end if;
  if jsonb_array_length(v_outdoor->'subjects')<>13 then raise exception 'SUBJECT_OUTDOOR_COUNT'; end if;
  if jsonb_array_length(v_empty->'subjects')<>0 then raise exception 'UNVERIFIED_INDOOR_LEAK'; end if;
  if (v_all->>'catalogStatus')<>'partial_verified_only' then raise exception 'FALSE_CATALOG_COMPLETENESS'; end if;
  for v_subject in select value from jsonb_array_elements(v_all->'subjects')
  loop
    if (v_subject->>'subjectType')<>'floating_island'
      or (v_subject->>'verificationState')<>'verified'
      or (v_subject->>'platform')<>'switch'
      or (v_subject->>'gameVersion')<>'1.25.0'
      or (v_subject->>'buildId')<>'52BD625D9B4E0053'
      or (v_subject->>'profileSchema')::int<>624
      or (v_subject->>'displayName') is not null
      or nullif(v_subject->>'evidenceRef','') is null
    then raise exception 'UNSUPPORTED_SUBJECT_EXPOSED'; end if;
  end loop;
  if has_function_privilege('anon','public.community_list_verified_gallery_subjects_v1(text,integer)','EXECUTE')
    or has_function_privilege('authenticated','public.community_list_verified_gallery_subjects_v1(text,integer)','EXECUTE')
    or has_table_privilege('anon','public.gallery_verified_subjects','SELECT')
    or has_table_privilege('authenticated','public.gallery_verified_subjects','SELECT')
  then raise exception 'PUBLIC_RAW_REGISTRY_EXPOSURE';end if;
  if not has_function_privilege('service_role','public.community_list_verified_gallery_subjects_v1(text,integer)','EXECUTE')
  then raise exception 'SERVICE_ROLE_PROJECTION_UNAVAILABLE'; end if;
  if not exists (
    select 1 from pg_trigger where tgname='gallery_photo_issued_url_retirement_gate' and not tgisinternal
  ) then raise exception 'MEDIA_NEGATIVE_RETIREMENT_GATE_MISSING'; end if;
end $$;
rollback;
