-- Source166 / W-COMM-006 / legacy unsaveEntity SQL privilege OFF.
-- DRAFT NO_MERGE / NO_DEPLOY. Source163 signed FULL163 disposable 2 PG
-- PR635 CI42119124561: A1 local revoke old and refreshed 401, healthy A2
-- 200; separate service_role direct unsave COMMIT after revoke.
-- Local privileged SQL gap ONLY, NOT public HTTP attack.
-- Prior Source164 Reaction and Source165 Save remain OFF. R16 intact.
do $pre$
begin
  if to_regprocedure('public.community_unsave_entity(uuid,uuid)') is null then
    raise exception 'SOURCE166_UNSAVE_ENTITY_RPC_MISSING';
  end if;
  if has_function_privilege('service_role','public.community_save_entity(uuid,uuid)','EXECUTE')
    or has_function_privilege('service_role','public.community_add_reaction(uuid,uuid,text)','EXECUTE')
    or has_function_privilege('service_role','public.community_add_answer_v1(uuid,uuid,uuid,text,text)','EXECUTE') then
    raise exception 'SOURCE166_REQUIRES_PREVIOUS_WRITERS_OFF';
  end if;
  if not has_function_privilege('service_role',
       'public.community_set_gallery_comments_enabled_atomic_signed_v1(uuid,bigint,uuid,uuid,bigint,uuid,boolean,text)','EXECUTE')
    or not has_function_privilege('service_role',
       'public.community_delete_ddv_profile_workspace_v1(uuid,uuid,bigint,uuid,text)','EXECUTE')
    or not has_function_privilege('service_role',
       'public.community_get_ddv_profile_workspaces_v1(uuid)','EXECUTE') then
    raise exception 'SOURCE166_SIGNED_R16_WORKSPACE_GRANT_MISSING';
  end if;
end
$pre$;
revoke all on function public.community_unsave_entity(uuid,uuid)
  from public,anon,authenticated,service_role;
do $post$
declare v_role text;
begin
  foreach v_role in array array['anon','authenticated','service_role'] loop
    if has_function_privilege(v_role,'public.community_unsave_entity(uuid,uuid)','EXECUTE') then
      raise exception 'SOURCE166_UNSAVE_ENTITY_STILL_EXECUTABLE_BY_ROLE %',v_role;
    end if;
  end loop;
  if has_function_privilege('service_role','public.community_save_entity(uuid,uuid)','EXECUTE')
    or has_function_privilege('service_role','public.community_add_reaction(uuid,uuid,text)','EXECUTE')
    or not has_function_privilege('service_role',
       'public.community_set_gallery_comments_enabled_atomic_signed_v1(uuid,bigint,uuid,uuid,bigint,uuid,boolean,text)','EXECUTE')
    or not has_function_privilege('service_role',
       'public.community_delete_ddv_profile_workspace_v1(uuid,uuid,bigint,uuid,text)','EXECUTE')
    or not has_function_privilege('service_role',
       'public.community_get_ddv_profile_workspaces_v1(uuid)','EXECUTE') then
    raise exception 'SOURCE166_ANCESTOR_ACL_CHANGED';
  end if;
end
$post$;
