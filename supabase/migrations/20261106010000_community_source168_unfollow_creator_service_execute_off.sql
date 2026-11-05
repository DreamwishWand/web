-- Source168 / 03 COMM / W-COMM-006. DRAFT NO_MERGE, NO_DEPLOY.
-- Signed local FULL163 two PG PR643 CI42130549863: service_role direct
-- unfollowCreator COMMITTED deletion after signed A1 local revoke,
-- original+actually refreshed JWT401, healthy sibling A2 200.
-- LOCAL privileged SQL gap only; NOT public HTTP or managed DB evidence.
-- Disable ONLY legacy unfollowCreator until same-transaction signed CAS.
-- Preserve followCreator, signed R16/Workspace, Moderator and Privacy.
do $pre$
begin
 if to_regprocedure('public.community_unfollow_creator(uuid,uuid)') is null then
   raise exception 'SOURCE168_UNFOLLOW_CREATOR_RPC_MISSING';
 end if;
 if has_function_privilege('service_role','public.community_add_reaction(uuid,uuid,text)','EXECUTE')
  or has_function_privilege('service_role','public.community_save_entity(uuid,uuid)','EXECUTE')
  or has_function_privilege('service_role','public.community_unsave_entity(uuid,uuid)','EXECUTE')
  or has_function_privilege('service_role','public.community_remove_reaction(uuid,uuid,text)','EXECUTE') then
   raise exception 'SOURCE168_REQUIRES_SOURCE164_167_OFF';
 end if;
 if not has_function_privilege('service_role',
      'public.community_set_gallery_comments_enabled_atomic_signed_v1(uuid,bigint,uuid,uuid,bigint,uuid,boolean,text)','EXECUTE')
  or not has_function_privilege('service_role',
      'public.community_delete_ddv_profile_workspace_v1(uuid,uuid,bigint,uuid,text)','EXECUTE')
  or not has_function_privilege('service_role',
      'public.community_get_ddv_profile_workspaces_v1(uuid)','EXECUTE')
  or not has_function_privilege('service_role','public.community_follow_creator(uuid,uuid)','EXECUTE') then
   raise exception 'SOURCE168_POSITIVE_SIGNED_OR_FOLLOW_GRANT_MISSING';
 end if;
end
$pre$;
revoke all on function public.community_unfollow_creator(uuid,uuid)
  from public,anon,authenticated,service_role;
do $post$
declare v_role text;
begin
 foreach v_role in array array['anon','authenticated','service_role'] loop
   if has_function_privilege(v_role,'public.community_unfollow_creator(uuid,uuid)','EXECUTE') then
     raise exception 'SOURCE168_UNFOLLOW_EXECUTE_ALLOWED_ROLE %',v_role;
   end if;
 end loop;
 if has_function_privilege('service_role','public.community_add_reaction(uuid,uuid,text)','EXECUTE')
  or has_function_privilege('service_role','public.community_save_entity(uuid,uuid)','EXECUTE')
  or has_function_privilege('service_role','public.community_unsave_entity(uuid,uuid)','EXECUTE')
  or has_function_privilege('service_role','public.community_remove_reaction(uuid,uuid,text)','EXECUTE')
  or not has_function_privilege('service_role',
      'public.community_set_gallery_comments_enabled_atomic_signed_v1(uuid,bigint,uuid,uuid,bigint,uuid,boolean,text)','EXECUTE')
  or not has_function_privilege('service_role',
      'public.community_delete_ddv_profile_workspace_v1(uuid,uuid,bigint,uuid,text)','EXECUTE')
  or not has_function_privilege('service_role',
      'public.community_get_ddv_profile_workspaces_v1(uuid)','EXECUTE')
  or not has_function_privilege('service_role','public.community_follow_creator(uuid,uuid)','EXECUTE') then
   raise exception 'SOURCE168_ANCESTOR_ACL_CHANGED';
 end if;
end
$post$;
