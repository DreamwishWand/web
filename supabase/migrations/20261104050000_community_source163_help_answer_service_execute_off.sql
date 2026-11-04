-- 03 COMM / W-COMM-006 / Source163 Help Answer legacy direct service-role Writer OFF.
-- DRAFT / NO_MERGE / NO_DEPLOY / Public, Provider, Stage116, Community Writer OFF.
-- PR439: genuine GoTrue ES256 FULL162 local two PG, synthetic current Question
-- fixture (DB owner only), eligible A2 Answer positive SQL commit; after signed
-- A1 preflight + committed Local revoke, old and real-refreshed A1 JWT 401,
-- healthy A2 200, DIFFERENT PG service_role direct add_answer SQL still
-- committed QA Answer/Comment/Outbox/Idempotency. This is a bounded local
-- privileged SQL true RED, not an in-flight public HTTP exploit.
-- Do not modify Source154-162. Replacement Writer requires in-transaction
-- signed-v2 auth, CAS/idempotency, real rights + independent QR.
do $source163_pre$
begin
  if to_regprocedure('public.community_add_answer_v1(uuid,uuid,uuid,text,text)') is null then
    raise exception 'SOURCE163_HELP_ANSWER_LEGACY_RPC_MISSING';
  end if;
  if has_function_privilege('service_role',
      'public.community_ask_question_v1(uuid,uuid,text,text,text[],text,text,text)','EXECUTE')
     or has_function_privilege('service_role',
      'public.community_create_tip_v1(uuid,uuid,text,text,text[],text,text,uuid,uuid,text)','EXECUTE')
     or has_function_privilege('service_role',
      'public.community_create_gallery_draft(uuid,uuid,text,text,text)','EXECUTE')
     or has_function_privilege('service_role',
      'public.community_create_gallery_work_v1(uuid,uuid,text,text)','EXECUTE')
     or has_function_privilege('service_role',
      'public.community_publish_gallery_photo_v1(uuid,uuid,uuid,bigint,text,uuid,text,text,uuid[],uuid,boolean,text)','EXECUTE') then
    raise exception 'SOURCE163_NEEDS_ACCEPTED_SOURCE160_162_OFF';
  end if;
  if not has_function_privilege('service_role',
      'public.community_set_gallery_comments_enabled_atomic_signed_v1(uuid,bigint,uuid,uuid,bigint,uuid,boolean,text)','EXECUTE')
     or not has_function_privilege('service_role',
      'public.community_delete_ddv_profile_workspace_v1(uuid,uuid,bigint,uuid,text)','EXECUTE')
     or not has_function_privilege('service_role',
      'public.community_get_ddv_profile_workspaces_v1(uuid)','EXECUTE') then
    raise exception 'SOURCE163_SIGNED_R16_WORKSPACE_INVARIANT_MISSING';
  end if;
end
$source163_pre$;

revoke all on function public.community_add_answer_v1(uuid,uuid,uuid,text,text)
  from public,anon,authenticated,service_role;

do $source163_post$
declare r text;
begin
  foreach r in array array['anon','authenticated','service_role'] loop
    if has_function_privilege(r,
        'public.community_add_answer_v1(uuid,uuid,uuid,text,text)','EXECUTE') then
      raise exception 'SOURCE163_HELP_ANSWER_EXECUTE_STILL_ALLOWED_ROLE %',r;
    end if;
  end loop;
  if has_function_privilege('service_role',
      'public.community_ask_question_v1(uuid,uuid,text,text,text[],text,text,text)','EXECUTE')
     or has_function_privilege('service_role',
      'public.community_create_tip_v1(uuid,uuid,text,text,text[],text,text,uuid,uuid,text)','EXECUTE')
     or has_function_privilege('service_role',
      'public.community_publish_gallery_photo_v1(uuid,uuid,uuid,bigint,text,uuid,text,text,uuid[],uuid,boolean,text)','EXECUTE')
     or not has_function_privilege('service_role',
      'public.community_set_gallery_comments_enabled_atomic_signed_v1(uuid,bigint,uuid,uuid,bigint,uuid,boolean,text)','EXECUTE')
     or not has_function_privilege('service_role',
      'public.community_delete_ddv_profile_workspace_v1(uuid,uuid,bigint,uuid,text)','EXECUTE')
     or not has_function_privilege('service_role',
      'public.community_get_ddv_profile_workspaces_v1(uuid)','EXECUTE') then
    raise exception 'SOURCE163_PRIOR_SOURCE_INVARIANT_CHANGED';
  end if;
end
$source163_post$;
