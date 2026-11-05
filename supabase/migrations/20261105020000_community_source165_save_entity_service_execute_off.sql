-- Source165 / 03 COMM / W-COMM-006. DRAFT, NO_MERGE, NO_DEPLOY.
-- After independent local FULL163 ES256 two PG PR617 CI42012915279:
-- eligible signed A2 Save Entity persisted; revoked A1 old/refreshed JWT401,
-- healthy A2 200, yet separate service_role PG direct Save Entity COMMIT.
-- Privileged LOCAL SQL revocation gap ONLY; NOT a real public HTTP exploit.
-- Save Entity requires same-transaction signed authority before re-enabling.
-- Preserve unsaveEntity, privacy, moderation, R16 signed and Workspace.
do $pre$
begin
  if to_regprocedure('public.community_save_entity(uuid,uuid)') is null then
    raise exception 'SOURCE165_SAVE_ENTITY_RPC_MISSING';
  end if;
  if has_function_privilege('service_role','public.community_add_reaction(uuid,uuid,text)','EXECUTE')
    or has_function_privilege('service_role','public.community_add_answer_v1(uuid,uuid,uuid,text,text)','EXECUTE')
    or has_function_privilege('service_role','public.community_ask_question_v1(uuid,uuid,text,text,text[],text,text,text)','EXECUTE') then
    raise exception 'SOURCE165_REQUIRES_SOURCE160_164_OFF';
  end if;
  if not has_function_privilege('service_role',
       'public.community_set_gallery_comments_enabled_atomic_signed_v1(uuid,bigint,uuid,uuid,bigint,uuid,boolean,text)','EXECUTE')
    or not has_function_privilege('service_role',
       'public.community_delete_ddv_profile_workspace_v1(uuid,uuid,bigint,uuid,text)','EXECUTE')
    or not has_function_privilege('service_role',
       'public.community_get_ddv_profile_workspaces_v1(uuid)','EXECUTE') then
    raise exception 'SOURCE165_PRIOR_SIGNED_R16_WORKSPACE_GRANT_MISSING';
  end if;
end
$pre$;
revoke all on function public.community_save_entity(uuid,uuid)
  from public,anon,authenticated,service_role;
do $post$
declare v_role text;
begin
  foreach v_role in array array['anon','authenticated','service_role'] loop
    if has_function_privilege(v_role,
        'public.community_save_entity(uuid,uuid)','EXECUTE') then
      raise exception 'SOURCE165_SAVE_ENTITY_EXECUTE_STILL_ALLOWED_ROLE %',v_role;
    end if;
  end loop;
  if has_function_privilege('service_role','public.community_add_reaction(uuid,uuid,text)','EXECUTE')
    or has_function_privilege('service_role','public.community_add_answer_v1(uuid,uuid,uuid,text,text)','EXECUTE')
    or not has_function_privilege('service_role',
       'public.community_set_gallery_comments_enabled_atomic_signed_v1(uuid,bigint,uuid,uuid,bigint,uuid,boolean,text)','EXECUTE')
    or not has_function_privilege('service_role',
       'public.community_delete_ddv_profile_workspace_v1(uuid,uuid,bigint,uuid,text)','EXECUTE')
    or not has_function_privilege('service_role',
       'public.community_get_ddv_profile_workspaces_v1(uuid)','EXECUTE') then
    raise exception 'SOURCE165_SIGNED_ANCESTOR_ACL_CHANGED';
  end if;
end
$post$;
