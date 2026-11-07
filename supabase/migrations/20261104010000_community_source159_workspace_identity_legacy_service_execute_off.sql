-- Source159 / W-COMM-006 / DDV Workspace legacy four RPCs OFF.
-- Forward after independent accepted Source158; previous Source154-158 immutable.
-- DRAFT / DO_NOT_MERGE / DO_NOT_DEPLOY / PUBLIC COMMUNITY WRITER NO-GO.
--
-- Actual Source158 RED, genuine local GoTrue ES256 PR378 HEAD
-- 96c03b49794ec51319039142678f7fa6a2b5766a, CI41775933241:
-- signed A1 preflight -> terminal local revoke; old/refreshed JWT 401;
-- service_role create/update/associate/unlink each COMMITTED with DB effect.
-- This proves direct post-preflight SQL reachability, NOT a public HTTP exploit.
--
-- These four historically subject-only RPCs are not currently enrolled as
-- same-transaction signed v2 Writers. Deny execution even for service_role,
-- while retaining the separate session-bound signed DELETE RPC and read-only
-- Workspace list, accepted signed R16 Gallery Comments, Source157 old comments
-- OFF and Source158 R15 pinned Gallery OFF. No grants are introduced.
--
-- After authorized migration, do NOT auto regrant unsafe capabilities. Any
-- future enabled Writer requires a new session-bound signed SQL mutation,
-- CAS/replay/idempotency receipts, Owner approval, and independent QA.
-- Rollback before deploy: abandon branch; post-deploy: Owner-approved new
-- forward-only recovery with backups and independent signed evidence.
do $pre$
begin
  if has_function_privilege('service_role',
    'public.community_publish_gallery_pinned_r15(uuid,uuid,bigint,text,text,uuid[],uuid[],bigint[],bigint[],text,text,text)','EXECUTE')
    or has_function_privilege('service_role',
    'public.community_set_gallery_comments_enabled_v2(uuid,uuid,boolean)','EXECUTE') then
    raise exception 'SOURCE159_PRIOR_157_158_FAILCLOSED_GUARDS_MISSING';
  end if;
  if not has_function_privilege('service_role',
    'public.community_set_gallery_comments_enabled_atomic_signed_v1(uuid,bigint,uuid,uuid,bigint,uuid,boolean,text)','EXECUTE')
    or not has_function_privilege('service_role',
    'public.community_delete_ddv_profile_workspace_v1(uuid,uuid,bigint,uuid,text)','EXECUTE')
    or not has_function_privilege('service_role',
    'public.community_get_ddv_profile_workspaces_v1(uuid)','EXECUTE') then
    raise exception 'SOURCE159_SIGNED_OR_READONLY_DEPENDENCY_MISSING';
  end if;
  if to_regprocedure('public.community_create_ddv_profile_workspace_v1(uuid,text)') is null
    or to_regprocedure('public.community_update_ddv_profile_workspace_v1(uuid,uuid,text,text)') is null
    or to_regprocedure('public.community_associate_ddv_identity_v1(uuid,uuid,text)') is null
    or to_regprocedure('public.community_unlink_ddv_identity_v1(uuid,uuid)') is null then
    raise exception 'SOURCE159_EXPECTED_LEGACY_WORKSPACE_RPC_MISSING';
  end if;
end
$pre$;

revoke all on function public.community_create_ddv_profile_workspace_v1(uuid,text)
  from public,anon,authenticated,service_role;
revoke all on function public.community_update_ddv_profile_workspace_v1(uuid,uuid,text,text)
  from public,anon,authenticated,service_role;
revoke all on function public.community_associate_ddv_identity_v1(uuid,uuid,text)
  from public,anon,authenticated,service_role;
revoke all on function public.community_unlink_ddv_identity_v1(uuid,uuid)
  from public,anon,authenticated,service_role;

do $post$
declare
  fn text;
  role_name text;
begin
  foreach fn in array array[
    'public.community_create_ddv_profile_workspace_v1(uuid,text)',
    'public.community_update_ddv_profile_workspace_v1(uuid,uuid,text,text)',
    'public.community_associate_ddv_identity_v1(uuid,uuid,text)',
    'public.community_unlink_ddv_identity_v1(uuid,uuid)'
  ] loop
    foreach role_name in array array['anon','authenticated','service_role'] loop
      if has_function_privilege(role_name,fn,'EXECUTE') then
        raise exception 'SOURCE159_LEGACY_WORKSPACE_RPC_STILL_EXECUTABLE: % %',fn,role_name;
      end if;
    end loop;
  end loop;
  if not has_function_privilege('service_role',
    'public.community_delete_ddv_profile_workspace_v1(uuid,uuid,bigint,uuid,text)','EXECUTE')
    or not has_function_privilege('service_role',
    'public.community_get_ddv_profile_workspaces_v1(uuid)','EXECUTE')
    or not has_function_privilege('service_role',
    'public.community_set_gallery_comments_enabled_atomic_signed_v1(uuid,bigint,uuid,uuid,bigint,uuid,boolean,text)','EXECUTE')
    or has_function_privilege('service_role',
    'public.community_publish_gallery_pinned_r15(uuid,uuid,bigint,text,text,uuid[],uuid[],bigint[],bigint[],text,text,text)','EXECUTE')
    or has_function_privilege('service_role',
    'public.community_set_gallery_comments_enabled_v2(uuid,uuid,boolean)','EXECUTE') then
    raise exception 'SOURCE159_ACCEPTED_SIGNED_OR_157_158_INVARIANT_FAILED';
  end if;
end
$post$;
