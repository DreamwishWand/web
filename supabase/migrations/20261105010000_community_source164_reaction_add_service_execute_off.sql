-- Source164 / 03 COMM W-COMM-006 / legacy addReaction external SQL Writer OFF.
-- DRAFT / DO_NOT_MERGE / DO_NOT_DEPLOY. Source163 independent QA452 limited PASS reused.
-- Test-only PR611: actual locally signed GoTrue ES256 FULL163, two independent
-- PostgreSQL backends. Eligible signed A2 persisted Reaction+Outbox with real
-- owner/Question fixture (previous Question created only by disposable DB owner).
-- After signed A1 preflight and COMMITTED local session revoke, original and real
-- refreshed JWT both 401, healthy sibling A2 200, yet another PG service_role
-- direct community_add_reaction still COMMITTED Reaction+Outbox.
-- NOT proof of public HTTP abuse, leaked service key, or managed Provider.
-- Keep only this addReaction operation disabled until same-txn signed v2+CAS
-- proof and independent 04 QR; removeReaction and emergency safety untouched.
do $pre$
begin
  if to_regprocedure('public.community_add_reaction(uuid,uuid,text)') is null then
    raise exception 'SOURCE164_REACTION_ADD_RPC_MISSING';
  end if;
  if has_function_privilege('service_role',
       'public.community_add_answer_v1(uuid,uuid,uuid,text,text)','EXECUTE')
    or has_function_privilege('service_role',
       'public.community_ask_question_v1(uuid,uuid,text,text,text[],text,text,text)','EXECUTE')
    or has_function_privilege('service_role',
       'public.community_publish_gallery_photo_v1(uuid,uuid,uuid,bigint,text,uuid,text,text,uuid[],uuid,boolean,text)','EXECUTE') then
    raise exception 'SOURCE164_REQUIRES_SOURCE160_163_OFF';
  end if;
  if not has_function_privilege('service_role',
       'public.community_set_gallery_comments_enabled_atomic_signed_v1(uuid,bigint,uuid,uuid,bigint,uuid,boolean,text)','EXECUTE')
    or not has_function_privilege('service_role',
       'public.community_delete_ddv_profile_workspace_v1(uuid,uuid,bigint,uuid,text)','EXECUTE')
    or not has_function_privilege('service_role',
       'public.community_get_ddv_profile_workspaces_v1(uuid)','EXECUTE') then
    raise exception 'SOURCE164_PRIOR_SIGNED_R16_READ_DELETE_GRANT_MISSING';
  end if;
end
$pre$;

revoke all on function public.community_add_reaction(uuid,uuid,text)
  from public,anon,authenticated,service_role;

do $post$
declare v_role text;
begin
  foreach v_role in array array['anon','authenticated','service_role'] loop
    if has_function_privilege(v_role,
        'public.community_add_reaction(uuid,uuid,text)','EXECUTE') then
      raise exception 'SOURCE164_REACTION_ADD_EXECUTE_STILL_ALLOWED_ROLE %',v_role;
    end if;
  end loop;
  if has_function_privilege('service_role',
       'public.community_add_answer_v1(uuid,uuid,uuid,text,text)','EXECUTE')
    or has_function_privilege('service_role',
       'public.community_set_gallery_comments_enabled_v2(uuid,uuid,boolean)','EXECUTE')
    or not has_function_privilege('service_role',
       'public.community_set_gallery_comments_enabled_atomic_signed_v1(uuid,bigint,uuid,uuid,bigint,uuid,boolean,text)','EXECUTE')
    or not has_function_privilege('service_role',
       'public.community_delete_ddv_profile_workspace_v1(uuid,uuid,bigint,uuid,text)','EXECUTE')
    or not has_function_privilege('service_role',
       'public.community_get_ddv_profile_workspaces_v1(uuid)','EXECUTE') then
    raise exception 'SOURCE164_ACCEPTED_ANCESTOR_ACL_CHANGED';
  end if;
end
$post$;
