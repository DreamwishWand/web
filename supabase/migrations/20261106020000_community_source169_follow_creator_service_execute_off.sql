-- Source169 W-COMM-006 FOLLOW only. DRAFT / DO_NOT_DEPLOY.
-- Test-only PR657 genuine signed ES256 FULL163 separate PG CI42148493080
-- confirmed direct service_role follow+outbox COMMIT AFTER signed A1 revoke.
-- Local privileged SQL finding, not public HTTP/managed DB attack.
do $pre$
begin
  if to_regprocedure('public.community_follow_creator(uuid,uuid)') is null then
    raise exception 'SOURCE169_FOLLOW_CREATOR_RPC_MISSING';
  end if;
  if not has_function_privilege('service_role','public.community_follow_creator(uuid,uuid)','EXECUTE') then
    raise exception 'SOURCE169_LEGACY_FOLLOW_EXPECTED_EXECUTE_MISSING';
  end if;
  if has_function_privilege('service_role','public.community_add_reaction(uuid,uuid,text)','EXECUTE')
     or has_function_privilege('service_role','public.community_save_entity(uuid,uuid)','EXECUTE')
     or has_function_privilege('service_role','public.community_unsave_entity(uuid,uuid)','EXECUTE')
     or has_function_privilege('service_role','public.community_remove_reaction(uuid,uuid,text)','EXECUTE')
     or has_function_privilege('service_role','public.community_unfollow_creator(uuid,uuid)','EXECUTE') then
     raise exception 'SOURCE169_REQUIRES_SOURCE164_168_DENIALS';
  end if;
  if not has_function_privilege('service_role',
    'public.community_set_gallery_comments_enabled_atomic_signed_v1(uuid,bigint,uuid,uuid,bigint,uuid,boolean,text)','EXECUTE')
     or not has_function_privilege('service_role',
    'public.community_delete_ddv_profile_workspace_v1(uuid,uuid,bigint,uuid,text)','EXECUTE')
     or not has_function_privilege('service_role',
    'public.community_get_ddv_profile_workspaces_v1(uuid)','EXECUTE') then
    raise exception 'SOURCE169_SIGNED_R16_WORKSPACE_GRANT_MISSING';
  end if;
end
$pre$;
revoke all on function public.community_follow_creator(uuid,uuid)
  from public,anon,authenticated,service_role;
do $post$
declare v_role text;
begin
  foreach v_role in array array['anon','authenticated','service_role'] loop
    if has_function_privilege(v_role,'public.community_follow_creator(uuid,uuid)','EXECUTE') then
      raise exception 'SOURCE169_FOLLOW_EXECUTE_STILL_ALLOWED_ROLE %',v_role;
    end if;
  end loop;
  if has_function_privilege('service_role','public.community_add_reaction(uuid,uuid,text)','EXECUTE')
    or has_function_privilege('service_role','public.community_save_entity(uuid,uuid)','EXECUTE')
    or has_function_privilege('service_role','public.community_unsave_entity(uuid,uuid)','EXECUTE')
    or has_function_privilege('service_role','public.community_remove_reaction(uuid,uuid,text)','EXECUTE')
    or has_function_privilege('service_role','public.community_unfollow_creator(uuid,uuid)','EXECUTE')
    or not has_function_privilege('service_role',
      'public.community_set_gallery_comments_enabled_atomic_signed_v1(uuid,bigint,uuid,uuid,bigint,uuid,boolean,text)','EXECUTE')
    or not has_function_privilege('service_role',
      'public.community_delete_ddv_profile_workspace_v1(uuid,uuid,bigint,uuid,text)','EXECUTE')
    or not has_function_privilege('service_role',
      'public.community_get_ddv_profile_workspaces_v1(uuid)','EXECUTE') then
    raise exception 'SOURCE169_ANCESTOR_ACL_CHANGED';
  end if;
end
$post$;
