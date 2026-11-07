-- Source161 / W-COMM-006 / Legacy Gallery draft/create two direct Writers OFF
-- DRAFT / NO_MERGE / NO_DEPLOY / All Community Public/Provider/Writer OFF.
--
-- PR413 test-only exact 2e047e82e73e85a3cd03385154ca47daf5421b6c
-- genuinely signed GoTrue ES256 local FULL160 two-PG CI41797843780 SUCCESS:
-- valid A2 positive draft creation; signed A1 preflight, committed Local
-- revoke, old + real refreshed same-session A1 HTTP401, live sibling A2 200;
-- separate service-role SQL create_gallery_draft/create_gallery_work_v1
-- both COMMITTED Work/Gallery/Entity/Outbox/Idempotency after A1 revoked.
-- Idempotency same key replay exactly once and altered payload rejected.
-- Local direct SQL TRUE RED, NOT actual in-flight public HTTP exploit.
--
-- Only external direct EXECUTE revoked. SECURITY DEFINER parent
-- community_publish_gallery_photo_v1 calls create_gallery_work_v1 internally
-- with definer authority; this migration DOES NOT assert transitive closure of
-- Gallery Photo publication/Storage or those callers. Separate QA pending.
-- Original Source154–160 migrations not rewritten.
-- Rollback pre-deploy: discard Draft; post-approved deploy: forward signed
-- same-transaction replacement only, NEVER auto grant unsafe old APIs.
do $pre$
begin
  if to_regprocedure('public.community_create_gallery_draft(uuid,uuid,text,text,text)') is null
     or to_regprocedure('public.community_create_gallery_work_v1(uuid,uuid,text,text)') is null then
    raise exception 'SOURCE161_GALLERY_CREATE_DRAFT_RPC_ABSENT';
  end if;
  if has_function_privilege('service_role',
       'public.community_ask_question_v1(uuid,uuid,text,text,text[],text,text,text)','EXECUTE')
    or has_function_privilege('service_role',
       'public.community_create_tip_v1(uuid,uuid,text,text,text[],text,text,uuid,uuid,text)','EXECUTE') then
    raise exception 'SOURCE161_REQUIRES_SOURCE160_HELP_QA_OFF';
  end if;
  if has_function_privilege('service_role',
       'public.community_create_ddv_profile_workspace_v1(uuid,text)','EXECUTE')
    or has_function_privilege('service_role',
       'public.community_publish_gallery_pinned_r15(uuid,uuid,bigint,text,text,uuid[],uuid[],bigint[],bigint[],text,text,text)','EXECUTE')
    or has_function_privilege('service_role',
       'public.community_set_gallery_comments_enabled_v2(uuid,uuid,boolean)','EXECUTE') then
    raise exception 'SOURCE161_REQUIRES_157_158_159_ACCEPTED_OFF';
  end if;
  if not has_function_privilege('service_role',
       'public.community_set_gallery_comments_enabled_atomic_signed_v1(uuid,bigint,uuid,uuid,bigint,uuid,boolean,text)','EXECUTE')
    or not has_function_privilege('service_role',
       'public.community_delete_ddv_profile_workspace_v1(uuid,uuid,bigint,uuid,text)','EXECUTE')
    or not has_function_privilege('service_role',
       'public.community_get_ddv_profile_workspaces_v1(uuid)','EXECUTE') then
    raise exception 'SOURCE161_REQUIRES_SIGNED_R16_AND_WORKSPACE_READ_DELETE_GRANTS';
  end if;
end
$pre$;

revoke all on function public.community_create_gallery_draft(uuid,uuid,text,text,text)
  from public,anon,authenticated,service_role;
revoke all on function public.community_create_gallery_work_v1(uuid,uuid,text,text)
  from public,anon,authenticated,service_role;

do $post$
declare
  fn text;
  r text;
begin
  foreach fn in array array[
     'public.community_create_gallery_draft(uuid,uuid,text,text,text)',
     'public.community_create_gallery_work_v1(uuid,uuid,text,text)'
  ] loop
     foreach r in array array['anon','authenticated','service_role'] loop
       if has_function_privilege(r,fn,'EXECUTE') then
         raise exception 'SOURCE161_GALLERY_DRAFT_DIRECT_WRITER_EXECUTE_STILL_ON % %',fn,r;
       end if;
     end loop;
  end loop;
  if has_function_privilege('service_role',
      'public.community_ask_question_v1(uuid,uuid,text,text,text[],text,text,text)','EXECUTE')
     or has_function_privilege('service_role',
      'public.community_create_tip_v1(uuid,uuid,text,text,text[],text,text,uuid,uuid,text)','EXECUTE')
     or has_function_privilege('service_role',
      'public.community_create_ddv_profile_workspace_v1(uuid,text)','EXECUTE')
     or has_function_privilege('service_role',
      'public.community_publish_gallery_pinned_r15(uuid,uuid,bigint,text,text,uuid[],uuid[],bigint[],bigint[],text,text,text)','EXECUTE')
     or has_function_privilege('service_role',
      'public.community_set_gallery_comments_enabled_v2(uuid,uuid,boolean)','EXECUTE')
     or not has_function_privilege('service_role',
      'public.community_set_gallery_comments_enabled_atomic_signed_v1(uuid,bigint,uuid,uuid,bigint,uuid,boolean,text)','EXECUTE')
     or not has_function_privilege('service_role',
      'public.community_delete_ddv_profile_workspace_v1(uuid,uuid,bigint,uuid,text)','EXECUTE')
     or not has_function_privilege('service_role',
      'public.community_get_ddv_profile_workspaces_v1(uuid)','EXECUTE') then
    raise exception 'SOURCE161_SIGNED_PRIOR_WRITER_OFF_OR_READ_INVARIANT_FAILED';
  end if;
end
$post$;
