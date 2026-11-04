-- Source160 / W-COMM-006 / Legacy Help Question and Tip Writers OFF.
-- FORWARD ONLY after frozen Source154/155/156/157/158 and proposed Source159.
-- DRAFT / DO_NOT_MERGE / DO_NOT_DEPLOY / all Community Public Writer OFF.
--
-- Local FULL158 genuine GoTrue ES256, PR395 exact ecbb749c699beb45680f33d8fbcaf46f89eac594
-- CI41789165377: signed A2 eligible direct SQL positive creates genuine
-- Question+Tip Work/Revision/Search/Outbox/Idempotency; signed A1 preflight
-- followed by committed Source154 local revoke, original and refreshed
-- A1 HTTP401; then independent PostgreSQL backend direct service_role SQL
-- subject-only ask_question/create_tip each COMMITTED those same domains.
-- This is a direct SQL post-preflight authorization gap, NOT proven
-- in-flight HTTP exploit or compromised service-role credential.
--
-- Exact two legacy subject-only RPCs are not accepted signed session-bound
-- same-transaction Writers. Deny even to service_role while retaining
-- unrelated negative Moderation/privacy, R16 signed atomic comments and
-- Workspace signed DELETE + read, Source157/158/159 closures unchanged.
-- Restore only with new separately Owner-approved forward signed Writer
-- after independent 2PG CAS/replay/idempotency QA; NEVER auto re-GRANT.
do $pre$
begin
  if to_regprocedure('public.community_ask_question_v1(uuid,uuid,text,text,text[],text,text,text)') is null
    or to_regprocedure('public.community_create_tip_v1(uuid,uuid,text,text,text[],text,text,uuid,uuid,text)') is null then
    raise exception 'SOURCE160_EXPECTED_HELP_LEGACY_RPC_MISSING';
  end if;
  if has_function_privilege('service_role',
    'public.community_create_ddv_profile_workspace_v1(uuid,text)','EXECUTE')
    or has_function_privilege('service_role',
    'public.community_update_ddv_profile_workspace_v1(uuid,uuid,text,text)','EXECUTE')
    or has_function_privilege('service_role',
    'public.community_associate_ddv_identity_v1(uuid,uuid,text)','EXECUTE')
    or has_function_privilege('service_role',
    'public.community_unlink_ddv_identity_v1(uuid,uuid)','EXECUTE') then
    raise exception 'SOURCE160_SOURCE159_WORKSPACE_FOUR_OFF_PRECONDITION_MISSING';
  end if;
  if has_function_privilege('service_role',
    'public.community_publish_gallery_pinned_r15(uuid,uuid,bigint,text,text,uuid[],uuid[],bigint[],bigint[],text,text,text)','EXECUTE')
    or has_function_privilege('service_role',
    'public.community_set_gallery_comments_enabled_v2(uuid,uuid,boolean)','EXECUTE') then
    raise exception 'SOURCE160_SOURCE157_158_OFF_PRECONDITION_MISSING';
  end if;
  if not has_function_privilege('service_role',
    'public.community_set_gallery_comments_enabled_atomic_signed_v1(uuid,bigint,uuid,uuid,bigint,uuid,boolean,text)','EXECUTE')
    or not has_function_privilege('service_role',
    'public.community_delete_ddv_profile_workspace_v1(uuid,uuid,bigint,uuid,text)','EXECUTE')
    or not has_function_privilege('service_role',
    'public.community_get_ddv_profile_workspaces_v1(uuid)','EXECUTE') then
    raise exception 'SOURCE160_SIGNED_WRITER_OR_WORKSPACE_READ_DEPENDENCY_MISSING';
  end if;
end
$pre$;

revoke all on function public.community_ask_question_v1(uuid,uuid,text,text,text[],text,text,text)
  from public,anon,authenticated,service_role;
revoke all on function public.community_create_tip_v1(uuid,uuid,text,text,text[],text,text,uuid,uuid,text)
  from public,anon,authenticated,service_role;

do $post$
declare
  fn text;
  role_name text;
begin
  foreach fn in array array[
    'public.community_ask_question_v1(uuid,uuid,text,text,text[],text,text,text)',
    'public.community_create_tip_v1(uuid,uuid,text,text,text[],text,text,uuid,uuid,text)'
  ] loop
    foreach role_name in array array['anon','authenticated','service_role'] loop
      if has_function_privilege(role_name,fn,'EXECUTE') then
        raise exception 'SOURCE160_HELP_QA_LEGACY_WRITER_STILL_EXECUTABLE: % %',fn,role_name;
      end if;
    end loop;
  end loop;
  if not has_function_privilege('service_role',
    'public.community_set_gallery_comments_enabled_atomic_signed_v1(uuid,bigint,uuid,uuid,bigint,uuid,boolean,text)','EXECUTE')
    or not has_function_privilege('service_role',
    'public.community_delete_ddv_profile_workspace_v1(uuid,uuid,bigint,uuid,text)','EXECUTE')
    or not has_function_privilege('service_role',
    'public.community_get_ddv_profile_workspaces_v1(uuid)','EXECUTE')
    or has_function_privilege('service_role',
    'public.community_create_ddv_profile_workspace_v1(uuid,text)','EXECUTE')
    or has_function_privilege('service_role',
    'public.community_publish_gallery_pinned_r15(uuid,uuid,bigint,text,text,uuid[],uuid[],bigint[],bigint[],text,text,text)','EXECUTE')
    or has_function_privilege('service_role',
    'public.community_set_gallery_comments_enabled_v2(uuid,uuid,boolean)','EXECUTE') then
    raise exception 'SOURCE160_PRIOR_ACCEPTED_OR_SIGNED_INVARIANT_FAILED';
  end if;
end
$post$;
