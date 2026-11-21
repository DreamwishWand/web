-- Source162 / W-COMM-006 / Gallery Photo SECURITY DEFINER parent Writer OFF.
-- DRAFT / DO_NOT_MERGE / DO_NOT_DEPLOY / Community Public/Writer/Provider OFF.
-- Forward-only after accepted Source161, without rewriting Source154–161 SQL.
--
-- PR426 test-only genuine signed ES256 local FULL161, 2 PG:
-- Source161 removed external service_role EXECUTE from create_gallery_work_v1,
-- but the SECURITY DEFINER photo parent invokes the callee internally.
-- Genuine signed A2 eligible synthetic subject+READY media metadata positive
-- created public Gallery Work/Revision/Media/Search/Outbox/Idempotency.
-- Signed A1 preflight then committed local revocation and real refresh: both
-- A1 tokens HTTP401, sibling A2 HTTP200, yet a DIFFERENT PG direct service_role
-- photo parent call COMMITTED public Work/Revision/Media/Search/Outbox/Idem.
-- This proves disposable direct server-role SQL vulnerability only, NOT
-- actual public HTTP exploit, leaked credential, physical Provider or rights.
--
-- Do not auto re-GRANT. New Photo Writer requires same-transaction signed
-- v2, proven ownership, Work+Media CAS, current-revision and provenance,
-- rights/consent, replay/idempotency, independent local and managed QA.
-- Rollback predeploy: abandon Draft. After an approved managed deployment,
-- use separately authorized forward signed replacement, not privilege undo.
do $pre$
begin
  if to_regprocedure(
    'public.community_publish_gallery_photo_v1(uuid,uuid,uuid,bigint,text,uuid,text,text,uuid[],uuid,boolean,text)'
  ) is null then
    raise exception 'SOURCE162_GALLERY_PHOTO_PARENT_MISSING';
  end if;
  if has_function_privilege('service_role',
     'public.community_create_gallery_draft(uuid,uuid,text,text,text)','EXECUTE')
     or has_function_privilege('service_role',
     'public.community_create_gallery_work_v1(uuid,uuid,text,text)','EXECUTE') then
    raise exception 'SOURCE162_NEEDS_SOURCE161_DIRECT_DRAFT_OFF';
  end if;
  if has_function_privilege('service_role',
     'public.community_ask_question_v1(uuid,uuid,text,text,text[],text,text,text)','EXECUTE')
     or has_function_privilege('service_role',
     'public.community_create_tip_v1(uuid,uuid,text,text,text[],text,text,uuid,uuid,text)','EXECUTE')
     or has_function_privilege('service_role',
     'public.community_create_ddv_profile_workspace_v1(uuid,text)','EXECUTE')
     or has_function_privilege('service_role',
     'public.community_publish_gallery_pinned_r15(uuid,uuid,bigint,text,text,uuid[],uuid[],bigint[],bigint[],text,text,text)','EXECUTE')
     or has_function_privilege('service_role',
     'public.community_set_gallery_comments_enabled_v2(uuid,uuid,boolean)','EXECUTE') then
    raise exception 'SOURCE162_PRIOR_SOURCE157_160_OFF_GUARDS_MISSING';
  end if;
  if not has_function_privilege('service_role',
     'public.community_set_gallery_comments_enabled_atomic_signed_v1(uuid,bigint,uuid,uuid,bigint,uuid,boolean,text)','EXECUTE')
     or not has_function_privilege('service_role',
     'public.community_delete_ddv_profile_workspace_v1(uuid,uuid,bigint,uuid,text)','EXECUTE')
     or not has_function_privilege('service_role',
     'public.community_get_ddv_profile_workspaces_v1(uuid)','EXECUTE') then
    raise exception 'SOURCE162_SIGNED_R16_AND_WORKSPACE_READ_DELETE_GRANTS_MISSING';
  end if;
end
$pre$;

revoke all on function public.community_publish_gallery_photo_v1(
  uuid,uuid,uuid,bigint,text,uuid,text,text,uuid[],uuid,boolean,text
) from public,anon,authenticated,service_role;

do $post$
declare
  r text;
begin
  foreach r in array array['anon','authenticated','service_role'] loop
    if has_function_privilege(r,
      'public.community_publish_gallery_photo_v1(uuid,uuid,uuid,bigint,text,uuid,text,text,uuid[],uuid,boolean,text)',
      'EXECUTE') then
      raise exception 'SOURCE162_PHOTO_PARENT_EXECUTE_STILL_ALLOWED_ROLE %',r;
    end if;
  end loop;
  if has_function_privilege('service_role',
     'public.community_create_gallery_work_v1(uuid,uuid,text,text)','EXECUTE')
     or has_function_privilege('service_role',
     'public.community_create_gallery_draft(uuid,uuid,text,text,text)','EXECUTE')
     or not has_function_privilege('service_role',
     'public.community_set_gallery_comments_enabled_atomic_signed_v1(uuid,bigint,uuid,uuid,bigint,uuid,boolean,text)','EXECUTE')
     or not has_function_privilege('service_role',
     'public.community_delete_ddv_profile_workspace_v1(uuid,uuid,bigint,uuid,text)','EXECUTE')
     or not has_function_privilege('service_role',
     'public.community_get_ddv_profile_workspaces_v1(uuid)','EXECUTE') then
    raise exception 'SOURCE162_R16_SIGNED_OR_SOURCE161_160_INVARIANT_CHANGED';
  end if;
end
$post$;
