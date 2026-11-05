-- Source167 / 03 COMM W-COMM-006 / legacy removeReaction OFF.
-- DRAFT DO_NOT_MERGE DO_NOT_DEPLOY. Genuine disposable signed FULL163
-- PR638 CI42121671595 confirms service_role direct removeReaction
-- second PostgreSQL COMMIT after signed A1 local revoke (old/refresh401).
-- LOCAL privileged SQL only. Not public HTTP, leaked key or managed DB.
-- Keep earlier Source164 Reaction Add, Source165 Save, Source166 Unsave OFF,
-- preserve accepted signed R16, Workspace and emergency privacy/moderation.
do $pre$
begin
  if to_regprocedure('public.community_remove_reaction(uuid,uuid,text)') is null then
    raise exception 'SOURCE167_REMOVE_REACTION_RPC_MISSING';
  end if;
  if has_function_privilege('service_role','public.community_add_reaction(uuid,uuid,text)','EXECUTE')
    or has_function_privilege('service_role','public.community_save_entity(uuid,uuid)','EXECUTE')
    or has_function_privilege('service_role','public.community_unsave_entity(uuid,uuid)','EXECUTE') then
    raise exception 'SOURCE167_REQUIRES_SOURCE164_166_OFF';
  end if;
  if not has_function_privilege('service_role',
       'public.community_set_gallery_comments_enabled_atomic_signed_v1(uuid,bigint,uuid,uuid,bigint,uuid,boolean,text)','EXECUTE')
    or not has_function_privilege('service_role',
       'public.community_delete_ddv_profile_workspace_v1(uuid,uuid,bigint,uuid,text)','EXECUTE')
    or not has_function_privilege('service_role',
       'public.community_get_ddv_profile_workspaces_v1(uuid)','EXECUTE') then
    raise exception 'SOURCE167_SIGNED_R16_WORKSPACE_GRANT_MISSING';
  end if;
end
$pre$;
revoke all on function public.community_remove_reaction(uuid,uuid,text)
  from public,anon,authenticated,service_role;
do $post$
declare v_role text;
begin
  foreach v_role in array array['anon','authenticated','service_role'] loop
    if has_function_privilege(v_role,
      'public.community_remove_reaction(uuid,uuid,text)','EXECUTE') then
      raise exception 'SOURCE167_REMOVE_REACTION_EXECUTE_ALLOWED_ROLE %',v_role;
    end if;
  end loop;
  if has_function_privilege('service_role','public.community_add_reaction(uuid,uuid,text)','EXECUTE')
    or has_function_privilege('service_role','public.community_save_entity(uuid,uuid)','EXECUTE')
    or has_function_privilege('service_role','public.community_unsave_entity(uuid,uuid)','EXECUTE')
    or not has_function_privilege('service_role',
       'public.community_set_gallery_comments_enabled_atomic_signed_v1(uuid,bigint,uuid,uuid,bigint,uuid,boolean,text)','EXECUTE')
    or not has_function_privilege('service_role',
       'public.community_delete_ddv_profile_workspace_v1(uuid,uuid,bigint,uuid,text)','EXECUTE')
    or not has_function_privilege('service_role',
       'public.community_get_ddv_profile_workspaces_v1(uuid)','EXECUTE') then
    raise exception 'SOURCE167_ANCESTOR_ACL_CHANGED';
  end if;
end
$post$;
